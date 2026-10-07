/**
 * createAuth(): every authentication method and security guarantee, over real HTTP.
 */
import * as crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createApp,
  createAuth,
  DatabaseAuthStore,
  MemoryAuthStore,
  oauthProvider,
  HttpResponse,
  JwtService,
  JwtTokenVerifier,
  Base64Url,
  type Auth,
} from '../packages/jsango/dist/index.js';
import { DatabaseManager } from '../packages/database/dist/index.js';

interface TestUser {
  id: number;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
  totpSecret?: string;
}

const SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';

async function setup(extra: Partial<Parameters<typeof createAuth<TestUser>>[0]> = {}) {
  const users: TestUser[] = [];
  const auth = createAuth<TestUser>({
    secret: SECRET,
    users: {
      findById: (id) => users.find((u) => String(u.id) === id),
      findByLogin: (email) => users.find((u) => u.email === email),
      isActive: (u) => u.active,
    },
    roles: { admin: ['posts.delete', 'posts.update'], editor: ['posts.update'] },
    apiKeys: { find: (hash) => users.find((u) => apiKeys.get(hash) === u.id) },
    ...extra,
  });
  const apiKeys = new Map<string, number>();
  const add = async (u: Omit<TestUser, 'passwordHash'> & { password: string }) => {
    const { password, ...rest } = u;
    const user = { ...rest, passwordHash: await auth.hashPassword(password) };
    users.push(user);
    return user;
  };

  const app = createApp();
  app.post('/login', async (ctx) => {
    const body = await ctx.request.json<{ email: string; password: string }>();
    return auth.login(body.email, body.password, ctx);
  });
  app.post('/login-session', async (ctx) => {
    const body = await ctx.request.json<{ email: string; password: string }>();
    const result = await auth.login(body.email, body.password, ctx);
    if (result.mfaRequired) return result;
    return auth.startSession(HttpResponse.json({ ok: true }), result.user);
  });
  app.post('/refresh', async (ctx) => auth.refresh((await ctx.request.json<{ refreshToken: string }>()).refreshToken));
  app.post('/logout', auth.required(), async (ctx) => {
    const res = HttpResponse.json({ ok: true });
    await auth.logout(ctx, res);
    return res;
  });
  app.get('/me', auth.required(), async (ctx) => ({ id: auth.identity(ctx).id, user: (await auth.user(ctx))?.email ?? null }));
  app.post('/me', auth.required(), async (ctx) => ({ id: auth.identity(ctx).id }));
  app.get('/admin', auth.required({ roles: ['admin'] }), () => ({ ok: true }));
  app.delete('/posts/1', auth.required({ permissions: ['posts.delete'] }), () => ({ deleted: true }));
  app.get('/public', auth.optional(), (ctx) => ({ who: auth.identity(ctx).id }));

  const server = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${server.address!.port}`;
  const call = async (method: string, path: string, opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      redirect: 'manual',
    });
    const text = await res.text();
    let json: any = undefined;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    return { status: res.status, json, headers: res.headers };
  };
  return { auth, add, users, apiKeys, call, base, close: () => server.close() };
}

describe('createAuth: password login & tokens', () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    t = await setup();
    await t.add({ id: 1, email: 'ada@example.com', password: 'correct horse', role: 'admin', active: true });
    await t.add({ id: 2, email: 'bob@example.com', password: 'bob password', role: 'editor', active: true });
    await t.add({ id: 3, email: 'off@example.com', password: 'disabled user', role: 'editor', active: false });
  });
  afterAll(() => t.close());

  it('logs in and protects routes', async () => {
    const login = await t.call('POST', '/login', { body: { email: 'ada@example.com', password: 'correct horse' } });
    expect(login.status).toBe(200);
    expect(login.json).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(login.json.user).toBeUndefined(); // never serialized: no password hash in responses
    expect(JSON.stringify(login.json)).not.toContain('scrypt');
    const me = await t.call('GET', '/me', { token: login.json.accessToken });
    expect(me.json).toEqual({ id: '1', user: 'ada@example.com' });
    expect((await t.call('GET', '/me')).status).toBe(401);
    expect((await t.call('GET', '/me', { token: 'garbage.token.here' })).status).toBe(401);
    expect((await t.call('GET', '/public')).json).toEqual({ who: 'anonymous' });
    expect((await t.call('GET', '/public', { token: 'bad.token.x' })).status).toBe(401); // never silently anonymous
  });

  it('uses one generic error for unknown users, wrong passwords and disabled accounts', async () => {
    const wrong = await t.call('POST', '/login', { body: { email: 'bob@example.com', password: 'nope-nope' } });
    const unknown = await t.call('POST', '/login', { body: { email: 'ghost@example.com', password: 'nope-nope' } });
    const disabled = await t.call('POST', '/login', { body: { email: 'off@example.com', password: 'disabled user' } });
    for (const r of [wrong, unknown, disabled]) {
      expect(r.status).toBe(401);
      expect(r.json.error.message).toBe('Invalid login or password.');
    }
  });

  it('locks out after repeated failures, even with the right password', async () => {
    for (let i = 0; i < 5; i++) {
      await t.call('POST', '/login', { body: { email: 'BOB@example.com ', password: `wrong-${i}` } });
    }
    const locked = await t.call('POST', '/login', { body: { email: 'bob@example.com', password: 'bob password' } });
    expect(locked.status).toBe(429);
  });

  it('enforces roles and role-derived permissions', async () => {
    const admin = (await t.call('POST', '/login', { body: { email: 'ada@example.com', password: 'correct horse' } })).json.accessToken;
    expect((await t.call('GET', '/admin', { token: admin })).status).toBe(200);
    expect((await t.call('DELETE', '/posts/1', { token: admin })).json).toEqual({ deleted: true });

    const editorToken = (await t.auth.issueTokens(t.users[1]!)).accessToken;
    expect((await t.call('GET', '/admin', { token: editorToken })).status).toBe(403);
    expect((await t.call('DELETE', '/posts/1', { token: editorToken })).status).toBe(403);
  });

  it('rotates refresh tokens and revokes the login when an old one is reused', async () => {
    const first = await t.auth.issueTokens(t.users[0]!);
    const second = await t.call('POST', '/refresh', { body: { refreshToken: first.refreshToken } });
    expect(second.status).toBe(200);
    expect(second.json.refreshToken).not.toBe(first.refreshToken);

    const replay = await t.call('POST', '/refresh', { body: { refreshToken: first.refreshToken } });
    expect(replay.status).toBe(401);
    expect(replay.json.error.message).toMatch(/already used/);
    // the legitimate (newest) token was revoked too, forcing a fresh login
    expect((await t.call('POST', '/refresh', { body: { refreshToken: second.json.refreshToken } })).status).toBe(401);
  });

  it('logout revokes the access and refresh token immediately', async () => {
    const pair = await t.auth.issueTokens(t.users[0]!);
    expect((await t.call('POST', '/logout', { token: pair.accessToken })).status).toBe(200);
    expect((await t.call('GET', '/me', { token: pair.accessToken })).status).toBe(401);
    expect((await t.call('POST', '/refresh', { body: { refreshToken: pair.refreshToken } })).status).toBe(401);
  });

  it('logoutAll signs out every device, and a new login right after works', async () => {
    const a = await t.auth.issueTokens(t.users[0]!);
    const b = await t.auth.issueTokens(t.users[0]!);
    await t.auth.logoutAll(1);
    expect((await t.call('GET', '/me', { token: a.accessToken })).status).toBe(401);
    expect((await t.call('POST', '/refresh', { body: { refreshToken: b.refreshToken } })).status).toBe(401);
    const fresh = await t.auth.issueTokens(t.users[0]!);
    expect((await t.call('GET', '/me', { token: fresh.accessToken })).status).toBe(200);
  });

  it('rejects weak passwords', async () => {
    await expect(t.auth.hashPassword('short')).rejects.toThrow(/at least 8/);
  });
});

describe('createAuth: cookie sessions', () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    t = await setup();
    await t.add({ id: 1, email: 'ada@example.com', password: 'correct horse', role: 'admin', active: true });
  });
  afterAll(() => t.close());

  it('sets a hardened cookie, authenticates with it, blocks cross-site writes and logs out', async () => {
    const login = await t.call('POST', '/login-session', { body: { email: 'ada@example.com', password: 'correct horse' } });
    const setCookie = login.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/jsango_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const cookie = setCookie.split(';')[0]!;

    expect((await t.call('GET', '/me', { headers: { cookie } })).json).toEqual({ id: '1', user: 'ada@example.com' });
    // CSRF: a cookie-authenticated write must come from a trusted origin
    expect((await t.call('POST', '/me', { headers: { cookie } })).status).toBe(401);
    expect((await t.call('POST', '/me', { headers: { cookie, origin: 'https://evil.example' } })).status).toBe(401);
    expect((await t.call('POST', '/me', { headers: { cookie, origin: t.base } })).status).toBe(200);

    // tampering with the signed cookie fails
    expect((await t.call('GET', '/me', { headers: { cookie: cookie.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')) } })).status).toBe(401);

    // disabling the user ends the session immediately
    t.users[0]!.active = false;
    expect((await t.call('GET', '/me', { headers: { cookie } })).status).toBe(401);
    t.users[0]!.active = true;
  });
});

describe('createAuth: API keys and MFA', () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    t = await setup();
    await t.add({ id: 7, email: 'svc@example.com', password: 'service account', role: 'editor', active: true });
  });
  afterAll(() => t.close());

  it('authenticates API keys by hash', async () => {
    const { key, hash, prefix } = t.auth.createApiKey('live');
    expect(key.startsWith('live_')).toBe(true);
    expect(prefix).toBe('live');
    t.apiKeys.set(hash, 7);
    expect((await t.call('GET', '/me', { headers: { 'x-api-key': key } })).json.id).toBe('7');
    expect((await t.call('GET', '/me', { headers: { authorization: `ApiKey ${key}` } })).json.id).toBe('7');
    expect((await t.call('GET', '/me', { headers: { 'x-api-key': `${key}x` } })).status).toBe(401);
  });

  it('requires a TOTP code when MFA is enabled and blocks code replay', async () => {
    const { secret } = t.auth.totp.generateSecret({ issuer: 'test', accountName: 'mfa@example.com' });
    await t.add({ id: 9, email: 'mfa@example.com', password: 'mfa password', role: 'editor', active: true, totpSecret: secret });
    const step1 = await t.auth.login('mfa@example.com', 'mfa password');
    expect(step1.mfaRequired).toBe(true);
    if (!step1.mfaRequired) return;
    await expect(t.auth.verifyMfa(step1.mfaToken, '000000')).rejects.toThrow(/Invalid authentication code/);
    const code = t.auth.totp.generateToken(secret);
    const tokens = await t.auth.verifyMfa(step1.mfaToken, code);
    expect(tokens.accessToken).toBeTruthy();
    await expect(t.auth.verifyMfa(step1.mfaToken, code)).rejects.toThrow(/Invalid authentication code/);
    // an MFA token is not an access token
    expect((await t.call('GET', '/me', { token: step1.mfaToken })).status).toBe(401);
  });
});

describe('createAuth: external identity provider (JWKS)', () => {
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwks = {
    keys: [
      { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa1', alg: 'RS256', use: 'sig' },
      { ...ec.publicKey.export({ format: 'jwk' }), kid: 'ec1', alg: 'ES256', use: 'sig' },
    ],
  };
  let fetches = 0;
  const fakeFetch = (async (url: string) => {
    fetches++;
    expect(url).toBe('https://idp.example.com/.well-known/jwks.json');
    return new Response(JSON.stringify(jwks), { headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

  function sign(alg: 'RS256' | 'ES256', kid: string, claims: Record<string, unknown>) {
    const header = Base64Url.encode(JSON.stringify({ alg, kid, typ: 'JWT' }));
    const payload = Base64Url.encode(JSON.stringify(claims));
    const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), {
      key: alg === 'RS256' ? rsa.privateKey : ec.privateKey,
      ...(alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}),
    });
    return `${header}.${payload}.${Base64Url.encode(sig)}`;
  }
  const now = () => Math.floor(Date.now() / 1000);

  let t: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    t = await setup({
      fetch: fakeFetch,
      external: {
        jwksUrl: 'https://idp.example.com/.well-known/jwks.json',
        issuer: 'https://idp.example.com/',
        audience: 'my-api',
        identity: (claims) => ({ id: String(claims.sub), roles: (claims['https://example.com/roles'] as string[]) ?? [] }),
      },
    });
  });
  afterAll(() => t.close());

  it('accepts RS256 and ES256 tokens from the provider', async () => {
    const claims = { sub: 'auth0|42', iss: 'https://idp.example.com/', aud: 'my-api', exp: now() + 60, 'https://example.com/roles': ['admin'] };
    expect((await t.call('GET', '/me', { token: sign('RS256', 'rsa1', claims) })).json.id).toBe('auth0|42');
    expect((await t.call('GET', '/admin', { token: sign('ES256', 'ec1', claims) })).status).toBe(200);
    expect(fetches).toBe(1); // keys are cached
  });

  it('rejects wrong issuer/audience, expired, unknown keys and forged HMAC tokens', async () => {
    const good = { sub: 'x', iss: 'https://idp.example.com/', aud: 'my-api', exp: now() + 60 };
    expect((await t.call('GET', '/me', { token: sign('RS256', 'rsa1', { ...good, aud: 'other' }) })).status).toBe(401);
    expect((await t.call('GET', '/me', { token: sign('RS256', 'rsa1', { ...good, exp: now() - 120 }) })).status).toBe(401);
    expect((await t.call('GET', '/me', { token: sign('RS256', 'nope', good) })).status).toBe(401);
    // Algorithm confusion: an HS256 token "signed" with the public key must not pass
    const header = Base64Url.encode(JSON.stringify({ alg: 'HS256', kid: 'rsa1' }));
    const payload = Base64Url.encode(JSON.stringify(good));
    const forged = `${header}.${payload}.${Base64Url.encode(crypto.createHmac('sha256', JSON.stringify(jwks.keys[0])).update(`${header}.${payload}`).digest())}`;
    expect((await t.call('GET', '/me', { token: forged })).status).toBe(401);
  });
});

describe('createAuth: social login (OAuth2 + PKCE)', () => {
  let tokenRequest: URLSearchParams | undefined;
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    if (url === 'https://login.example.com/token') {
      tokenRequest = new URLSearchParams(String(init?.body));
      return new Response(JSON.stringify({ access_token: 'provider-access', token_type: 'bearer' }));
    }
    if (url === 'https://login.example.com/userinfo') {
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer provider-access');
      return new Response(JSON.stringify({ sub: 'p-1', email: 'ada@example.com', email_verified: true, name: 'Ada' }));
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;

  it('redirects with state + PKCE and completes the callback', async () => {
    const auth = createAuth({
      secret: SECRET,
      users: { findById: () => null },
      fetch: fakeFetch,
      oauth: [
        oauthProvider({
          name: 'example',
          clientId: 'cid',
          clientSecret: 'csecret',
          redirectUri: 'http://localhost/auth/example/callback',
          authorizeUrl: 'https://login.example.com/authorize',
          tokenUrl: 'https://login.example.com/token',
          userInfoUrl: 'https://login.example.com/userinfo',
        }),
      ],
    });
    const app = createApp();
    app.get('/auth/example', () => auth.oauth.redirect('example'));
    app.get('/auth/example/callback', (ctx) => auth.oauth.callback('example', ctx));
    const server = await app.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${server.address!.port}`;
    try {
      const start = await fetch(`${base}/auth/example`, { redirect: 'manual' });
      expect(start.status).toBe(302);
      const location = new URL(start.headers.get('location')!);
      expect(location.origin + location.pathname).toBe('https://login.example.com/authorize');
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
      const state = location.searchParams.get('state')!;
      const cookie = start.headers.get('set-cookie')!.split(';')[0]!;

      const done = await fetch(`${base}/auth/example/callback?code=abc&state=${state}`, { headers: { cookie } });
      expect(await done.json()).toMatchObject({ provider: 'example', id: 'p-1', email: 'ada@example.com', emailVerified: true });
      expect(tokenRequest?.get('code_verifier')).toBeTruthy();
      expect(tokenRequest?.get('code')).toBe('abc');

      const forged = await fetch(`${base}/auth/example/callback?code=abc&state=attacker`, { headers: { cookie } });
      expect(forged.status).toBe(400);
      const noCookie = await fetch(`${base}/auth/example/callback?code=abc&state=${state}`);
      expect(noCookie.status).toBe(400);
    } finally {
      await server.close();
    }
  });
});

describe('auth hardening of low-level pieces', () => {
  it('JwtTokenVerifier rejects tokens without exp or subject', async () => {
    const jwt = new JwtService('another-test-secret-1234567890');
    const verifier = new JwtTokenVerifier({ jwt });
    await expect(verifier.verifyToken(jwt.sign({ sub: 'a' }))).rejects.toThrow(/no expiry/);
    expect(await verifier.verifyToken(jwt.sign({ roles: ['admin'] }, { expiresInSeconds: 60 }))).toBeUndefined();
  });

  it('createAuth refuses a short secret', () => {
    expect(() => createAuth({ secret: 'short', users: { findById: () => null } })).toThrow(/at least 32/);
  });
});

describe('auth stores', () => {
  async function exercise(store: { get: Auth['store']['get']; set: Auth['store']['set']; delete: Auth['store']['delete']; increment: Auth['store']['increment'] }) {
    await store.set('k', 'v', 60);
    expect(await store.get('k')).toBe('v');
    await store.set('k', 'v2', 60);
    expect(await store.get('k')).toBe('v2');
    await store.delete('k');
    expect(await store.get('k')).toBeUndefined();
    expect(await store.increment('c', 60)).toBe(1);
    expect(await store.increment('c', 60)).toBe(2);
    // concurrent increments are never lost
    const counts = await Promise.all([store.increment('c', 60), store.increment('c', 60), store.increment('c', 60)]);
    expect(Math.max(...counts)).toBe(5);
    expect(await store.increment('c', 60)).toBe(6);
    await store.set('short', 'x', 0.05);
    await new Promise((r) => setTimeout(r, 80));
    expect(await store.get('short')).toBeUndefined();
  }

  it('memory', async () => {
    await exercise(new MemoryAuthStore());
  });

  it('SQLite', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { driver: 'sqlite', filename: ':memory:' } } });
    try {
      await exercise(new DatabaseAuthStore({ connection: db }));
    } finally {
      await db.close();
    }
  });

  let mongod: MongoMemoryServer;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
  }, 120_000);
  afterAll(async () => {
    await mongod?.stop();
  });

  it('MongoDB', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { url: `${mongod.getUri()}authstore` } } });
    try {
      await exercise(new DatabaseAuthStore({ connection: db }));
    } finally {
      await db.close();
    }
  });
});
