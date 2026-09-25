import { describe, it, expect } from 'vitest';
import { HttpRequest, HttpResponse } from '@django-js/http';
import { Application } from '@django-js/middleware';
import {
  authenticate,
  getIdentity,
  JwtService,
  JwtTokenVerifier,
  BearerTokenAuthenticationStrategy,
  AuthenticationManager,
} from '../public/index.js';

describe('Concurrency & Context Isolation', () => {
  const secret = 'concurrent-tests-super-secure-key-32-chars';
  const jwt = new JwtService(secret);
  const bearerStrategy = new BearerTokenAuthenticationStrategy({
    verifier: new JwtTokenVerifier({ jwt }),
  });
  const authManager = new AuthenticationManager({ strategies: [bearerStrategy] });

  it('maintains strict identity and authorization isolation across concurrent requests', async () => {
    const app = new Application();
    app.use(authenticate({ manager: authManager, required: false }));

    app.get('/whoami', (ctx) => {
      const identity = getIdentity(ctx);
      return HttpResponse.json({
        id: identity.id,
        roles: identity.roles,
        authenticated: identity.isAuthenticated,
      });
    });

    const tokenAlice = await jwt.sign({ sub: 'alice', roles: ['admin'] });
    const tokenBob = await jwt.sign({ sub: 'bob', roles: ['editor'] });

    const requestsCount = 60;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < requestsCount; i++) {
      const remainder = i % 3;
      if (remainder === 0) {
        // Alice request
        promises.push(
          (async () => {
            const req = new HttpRequest({
              method: 'GET',
              url: 'http://localhost/whoami',
              headers: { authorization: `Bearer ${tokenAlice}` },
            });
            const res = await app.handle(req);
            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body as string);
            expect(data.id).toBe('alice');
            expect(data.roles).toContain('admin');
            expect(data.authenticated).toBe(true);
          })()
        );
      } else if (remainder === 1) {
        // Bob request
        promises.push(
          (async () => {
            const req = new HttpRequest({
              method: 'GET',
              url: 'http://localhost/whoami',
              headers: { authorization: `Bearer ${tokenBob}` },
            });
            const res = await app.handle(req);
            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body as string);
            expect(data.id).toBe('bob');
            expect(data.roles).toContain('editor');
            expect(data.authenticated).toBe(true);
          })()
        );
      } else {
        // Anonymous request
        promises.push(
          (async () => {
            const req = new HttpRequest({
              method: 'GET',
              url: 'http://localhost/whoami',
            });
            const res = await app.handle(req);
            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res.body as string);
            expect(data.id).toBe('anonymous');
            expect(data.roles).toEqual([]);
            expect(data.authenticated).toBe(false);
          })()
        );
      }
    }

    await Promise.all(promises);
  });
});
