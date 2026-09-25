import { describe, it, expect } from 'vitest';
import {
  MemorySessionStore,
  SessionAuthenticationStrategy,
} from '../public/authentication/session.js';
import { HttpRequest, RequestContext } from '@jsango/http';

describe('Session Authentication & Store', () => {
  it('creates, retrieves, updates, and touches sessions in MemorySessionStore', async () => {
    const store = new MemorySessionStore(1000);
    const session = await store.create({
      identityId: 'user-42',
      roles: ['editor'],
      data: { theme: 'dark' },
    });

    expect(session.identityId).toBe('user-42');
    expect(session.roles).toEqual(['editor']);
    expect(session.data['theme']).toBe('dark');

    // Retrieve
    const fetched = await store.get(session.id);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(session.id);

    // Update
    const updated = await store.update(session.id, { data: { theme: 'light' } });
    expect(updated?.data['theme']).toBe('light');

    // Touch
    const touched = await store.touch(session.id, 5000);
    expect(touched).toBe(true);

    // Delete
    const deleted = await store.delete(session.id);
    expect(deleted).toBe(true);
    expect(await store.get(session.id)).toBeUndefined();
  });

  it('expires sessions when TTL passes', async () => {
    const store = new MemorySessionStore(-10); // created with negative TTL = already expired
    const session = await store.create({ identityId: 'user-expired' });

    const fetched = await store.get(session.id);
    expect(fetched).toBeUndefined();
  });

  it('rotates session ID on login to prevent session fixation', async () => {
    const store = new MemorySessionStore(60000);
    const strategy = new SessionAuthenticationStrategy({ store });

    const initialSession = await store.create({
      identityId: 'pre-login-user',
      roles: ['guest'],
      data: { cart: ['item-1'] },
    });

    const rotatedSession = await strategy.rotate(initialSession.id);

    // Old session ID must be destroyed
    expect(await store.get(initialSession.id)).toBeUndefined();

    // New session ID must exist with identical data
    expect(rotatedSession.id).not.toBe(initialSession.id);
    expect(rotatedSession.identityId).toBe('pre-login-user');
    expect(rotatedSession.roles).toEqual(['guest']);
    expect(rotatedSession.data['cart']).toEqual(['item-1']);
  });

  it('authenticates valid session cookie correctly', async () => {
    const store = new MemorySessionStore(60000);
    const strategy = new SessionAuthenticationStrategy({ store, cookieName: 'session_id' });

    const session = await store.create({
      identityId: 'user-alice',
      roles: ['admin'],
      tenantId: 'tenant-1',
    });

    const request = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/dashboard',
      headers: {
        cookie: `session_id=${session.id}`,
      },
    });
    const ctx = new RequestContext({ request });

    const result = await strategy.authenticate(request, ctx);
    expect(result.status).toBe('authenticated');
    expect(result.identity.id).toBe('user-alice');
    expect(result.identity.roles).toContain('admin');
    expect(result.identity.tenantId).toBe('tenant-1');
  });

  it('returns unauthenticated when cookie is missing', async () => {
    const store = new MemorySessionStore(60000);
    const strategy = new SessionAuthenticationStrategy({ store });

    const request = new HttpRequest({ method: 'GET', url: 'http://localhost/' });
    const ctx = new RequestContext({ request });

    const result = await strategy.authenticate(request, ctx);
    expect(result.status).toBe('unauthenticated');
    expect(result.identity.isAuthenticated).toBe(false);
  });

  it('returns invalid_credentials when session does not exist in store', async () => {
    const store = new MemorySessionStore(60000);
    const strategy = new SessionAuthenticationStrategy({ store });

    const request = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/',
      headers: { cookie: 'session_id=non-existent-session-id' },
    });
    const ctx = new RequestContext({ request });

    const result = await strategy.authenticate(request, ctx);
    expect(result.status).toBe('invalid_credentials');
  });
});
