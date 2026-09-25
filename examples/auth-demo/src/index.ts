import { HttpResponse, HttpRequest } from '@jsango/http';
import { Application } from '@jsango/middleware';
import {
  JwtService,
  JwtTokenVerifier,
  BearerTokenAuthenticationStrategy,
  AuthenticationManager,
  AuthorizationManager,
  PermissionRegistry,
  RoleRegistry,
  BasePolicy,
  PolicyRegistry,
  authenticate,
  authorize,
  getIdentity,
  type Identity,
} from '@jsango/auth';

// 1. Domain Resource & Policy Definition
interface Document {
  id: string;
  title: string;
  authorId: string;
  isPublic: boolean;
}

class DocumentPolicy extends BasePolicy<Document> {
  public readonly name = 'DocumentPolicy';

  public view(_identity: Identity, doc?: Document): boolean {
    if (!doc) return false;
    return doc.isPublic || doc.authorId === _identity.id;
  }

  public update(identity: Identity, doc?: Document): boolean {
    if (!doc) return false;
    return doc.authorId === identity.id;
  }
}

// 2. Setup Security Registries & Managers
const jwtSecret = 'demo-application-secret-key-32-chars-long';
const jwt = new JwtService(jwtSecret);
const bearerStrategy = new BearerTokenAuthenticationStrategy({
  verifier: new JwtTokenVerifier({ jwt }),
});

const authManager = new AuthenticationManager({
  strategies: [bearerStrategy],
});

const permissions = new PermissionRegistry();
permissions.register({ name: 'reports.export', description: 'Export internal reports' });

const roles = new RoleRegistry();
roles.register({
  name: 'analyst',
  permissions: ['reports.export'],
});

const policies = new PolicyRegistry();
policies.registerFor('Document', new DocumentPolicy());

const authzManager = new AuthorizationManager({
  permissions,
  roles,
  policies,
});

// Mock database
const documents: Record<string, Document> = {
  doc1: { id: 'doc1', title: 'Public Roadmap', authorId: 'alice', isPublic: true },
  doc2: { id: 'doc2', title: 'Internal Financials', authorId: 'bob', isPublic: false },
};

// 3. Application Setup
export function createAuthApp(): Application {
  const app = new Application();

  // Route 1: Public route with optional authentication
  app.get(
    '/api/public',
    (ctx) => {
      const identity = getIdentity(ctx);
      return HttpResponse.json({
        message: 'Hello, world!',
        authenticated: identity.isAuthenticated,
        user: identity.id,
      });
    },
    {
      middleware: [authenticate({ manager: authManager, required: false })],
    }
  );

  // Route 2: Authenticated route (any authenticated identity)
  app.get(
    '/api/me',
    (ctx) => {
      const identity = getIdentity(ctx);
      return HttpResponse.json({
        id: identity.id,
        roles: identity.roles,
        permissions: identity.permissions,
      });
    },
    {
      middleware: [authenticate(authManager)],
    }
  );

  // Route 3: Role / Permission-protected route
  app.get('/api/reports', () => HttpResponse.json({ report: 'Quarterly Metrics' }), {
    middleware: [authenticate(authManager), authorize('reports.export', { manager: authzManager })],
  });

  // Route 4: Object-level policy route
  app.patch(
    '/api/documents/:id',
    (ctx) => {
      const doc = documents[ctx.request.params['id'] as string];
      return HttpResponse.json({ message: 'Updated', document: doc });
    },
    {
      middleware: [
        authenticate(authManager),
        authorize('update', {
          manager: authzManager,
          policy: 'Document',
          resource: (ctx) => {
            const id = ctx.request.params['id'] as string;
            return documents[id];
          },
        }),
      ],
    }
  );

  return app;
}

// 4. Standalone demonstration
async function runDemo(): Promise<void> {
  const app = createAuthApp();

  // Create demo token for Alice (author of doc1, analyst role)
  const aliceToken = await jwt.sign({
    sub: 'alice',
    roles: ['analyst'],
  });

  console.log('--- Phase 10 Auth Demo ---');

  // Test 1: Public endpoint
  const publicRes = await app.handle(
    new HttpRequest({ method: 'GET', url: 'http://localhost/api/public' })
  );
  console.log('1. Public access:', publicRes.statusCode, publicRes.body);

  // Test 2: Authenticated /api/me with Alice's token
  const meRes = await app.handle(
    new HttpRequest({
      method: 'GET',
      url: 'http://localhost/api/me',
      headers: { authorization: `Bearer ${aliceToken}` },
    })
  );
  console.log('2. /api/me access:', meRes.statusCode, meRes.body);

  // Test 3: Permission-protected /api/reports (Alice is analyst -> 200)
  const reportsRes = await app.handle(
    new HttpRequest({
      method: 'GET',
      url: 'http://localhost/api/reports',
      headers: { authorization: `Bearer ${aliceToken}` },
    })
  );
  console.log('3. Permission protected reports:', reportsRes.statusCode, reportsRes.body);

  // Test 4: Object-level authorization (Alice updating her own doc1 -> 200)
  const aliceDoc1Res = await app.handle(
    new HttpRequest({
      method: 'PATCH',
      url: 'http://localhost/api/documents/doc1',
      headers: { authorization: `Bearer ${aliceToken}` },
    })
  );
  console.log('4. Object policy update (own doc):', aliceDoc1Res.statusCode);

  // Test 5: Object-level authorization (Alice updating Bob's doc2 -> 403 Forbidden)
  const aliceDoc2Res = await app.handle(
    new HttpRequest({
      method: 'PATCH',
      url: 'http://localhost/api/documents/doc2',
      headers: { authorization: `Bearer ${aliceToken}` },
    })
  );
  console.log('5. Object policy update (other doc):', aliceDoc2Res.statusCode);
}

if (process.env.NODE_ENV !== 'test') {
  runDemo().catch(console.error);
}
