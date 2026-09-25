import { describe, it, expect } from 'vitest';
import { HttpRequest, HttpResponse } from '@jsango/http';
import { Application } from '@jsango/middleware';
import {
  authenticate,
  authorize,
  getIdentity,
  getAuthContext,
  JwtService,
  JwtTokenVerifier,
  BearerTokenAuthenticationStrategy,
  AuthenticationManager,
  AuthorizationManager,
  RoleRegistry,
  BasePolicy,
  PolicyRegistry,
  type Identity,
} from '../public/index.js';

interface Project {
  id: string;
  ownerId: string;
}

class ProjectPolicy extends BasePolicy<Project> {
  public readonly name = 'ProjectPolicy';

  public view(identity: Identity, project?: Project): boolean {
    if (!project) return false;
    return project.ownerId === identity.id;
  }
}

describe('Auth Middleware Integration', () => {
  const secret = 'jwt-middleware-test-secret-at-least-32-chars';
  const jwt = new JwtService(secret);
  const bearerStrategy = new BearerTokenAuthenticationStrategy({
    verifier: new JwtTokenVerifier({ jwt }),
  });
  const authManager = new AuthenticationManager({ strategies: [bearerStrategy] });

  const roles = new RoleRegistry();
  roles.register({ name: 'admin', permissions: ['system.manage'] });

  const policies = new PolicyRegistry();
  policies.registerFor('Project', new ProjectPolicy());

  const authzManager = new AuthorizationManager({ roles, policies });

  it('rejects unauthenticated request to required endpoint with 401', async () => {
    const app = new Application();
    app.use(authenticate(authManager));
    app.get('/protected', () => HttpResponse.json({ message: 'secret' }));

    const req = new HttpRequest({ method: 'GET', url: 'http://localhost/protected' });
    const res = await app.handle(req);

    expect(res.statusCode).toBe(401);
  });

  it('allows unauthenticated request to optional endpoint and sets AnonymousIdentity', async () => {
    const app = new Application();
    app.use(authenticate({ manager: authManager, required: false }));
    app.get('/public-or-personal', (ctx) => {
      const identity = getIdentity(ctx);
      return HttpResponse.json({
        authenticated: identity.isAuthenticated,
        id: identity.id,
      });
    });

    const req = new HttpRequest({ method: 'GET', url: 'http://localhost/public-or-personal' });
    const res = await app.handle(req);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.authenticated).toBe(false);
    expect(body.id).toBe('anonymous');
  });

  it('authenticates valid token, sets identity in context and container, returns 200', async () => {
    const token = await jwt.sign({ sub: 'user-77', roles: ['admin'] });

    const app = new Application();
    app.use(authenticate(authManager));
    app.get('/profile', (ctx) => {
      const identity = getIdentity(ctx);
      const authCtx = getAuthContext(ctx);

      return HttpResponse.json({
        id: identity.id,
        roles: identity.roles,
        strategy: authCtx?.strategyUsed,
      });
    });

    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/profile',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await app.handle(req);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.id).toBe('user-77');
    expect(body.roles).toContain('admin');
    expect(body.strategy).toBe('bearer');
  });

  it('distinguishes 401 Unauthenticated from 403 Forbidden in authorize middleware', async () => {
    // 1. Unauthenticated request to authorize() -> 401
    const app401 = new Application();
    app401.use(authorize('system.manage', { manager: authzManager }));
    app401.get('/admin', () => HttpResponse.text('ok'));

    const req1 = new HttpRequest({ method: 'GET', url: 'http://localhost/admin' });
    const res1 = await app401.handle(req1);
    expect(res1.statusCode).toBe(401);

    // 2. Authenticated user without permission to authorize() -> 403
    const regularToken = await jwt.sign({ sub: 'user-regular', roles: ['viewer'] });
    const app403 = new Application();
    app403.use(authenticate(authManager));
    app403.use(authorize('system.manage', { manager: authzManager }));
    app403.get('/admin', () => HttpResponse.text('ok'));

    const req2 = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/admin',
      headers: { authorization: `Bearer ${regularToken}` },
    });
    const res2 = await app403.handle(req2);
    expect(res2.statusCode).toBe(403);

    // 3. Authenticated user with permission -> 200
    const adminToken = await jwt.sign({ sub: 'user-admin', roles: ['admin'] });
    const req3 = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/admin',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const res3 = await app403.handle(req3);
    expect(res3.statusCode).toBe(200);
  });

  it('supports object-level authorization via resource resolver in middleware', async () => {
    const projects: Record<string, Project> = {
      p1: { id: 'p1', ownerId: 'user-alice' },
      p2: { id: 'p2', ownerId: 'user-bob' },
    };

    class ProjectModel {
      public static readonly metadata = { name: 'Project' };
      public id: string;
      public ownerId: string;
      constructor(p: Project) {
        this.id = p.id;
        this.ownerId = p.ownerId;
      }
    }

    const app = new Application();
    app.use(authenticate(authManager));

    // Custom route with resource resolver looking up Project
    app.get('/projects/:id', (ctx) => HttpResponse.json({ id: ctx.request.params['id'] }), {
      middleware: [
        authorize('view', {
          manager: authzManager,
          resource: (ctx) => {
            const id = ctx.request.params['id'] as string;
            const p = projects[id];
            return p ? new ProjectModel(p) : undefined;
          },
        }),
      ],
    });

    const aliceToken = await jwt.sign({ sub: 'user-alice' });

    // Alice accesses her own project p1 -> 200
    const resAliceP1 = await app.handle(
      new HttpRequest({
        method: 'GET',
        url: 'http://localhost/projects/p1',
        headers: { authorization: `Bearer ${aliceToken}` },
      })
    );
    expect(resAliceP1.statusCode).toBe(200);

    // Alice accesses Bob's project p2 -> 403 Forbidden
    const resAliceP2 = await app.handle(
      new HttpRequest({
        method: 'GET',
        url: 'http://localhost/projects/p2',
        headers: { authorization: `Bearer ${aliceToken}` },
      })
    );
    expect(resAliceP2.statusCode).toBe(403);
  });
});
