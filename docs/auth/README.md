# Authentication Guide

`createAuth()` gives you complete authentication in one object, with secure defaults:

| Method | Use it for |
| --- | --- |
| [Password login + JWT](#3-tokens-for-apis-and-mobile-apps) | APIs, SPAs, mobile apps |
| [Cookie sessions](#5-cookie-sessions-for-web-apps) | Server-rendered / same-site web apps |
| [API keys](#6-api-keys) | Server-to-server integrations, CLI tools |
| [Social login (OAuth2)](#7-social-login-google-github-) | "Sign in with Google / GitHub / …" |
| [External identity providers](#8-external-identity-providers-auth0-clerk-cognito-firebase-) | Auth0, Clerk, Cognito, Firebase, Azure AD, Keycloak |
| [Two-factor (TOTP)](#9-two-factor-authentication-totp) | Authenticator-app codes on top of passwords |

All of them are checked by the same middleware, `auth.required()`, so one route can
accept a session cookie from your web app, a bearer token from your mobile app, and an API key
from a partner at the same time.

- [1. Quick start](#1-quick-start)
- [2. Users and passwords](#2-users-and-passwords)
- [3. Tokens (for APIs and mobile apps)](#3-tokens-for-apis-and-mobile-apps)
- [4. Protecting routes](#4-protecting-routes)
- [5. Cookie sessions (for web apps)](#5-cookie-sessions-for-web-apps)
- [6. API keys](#6-api-keys)
- [7. Social login (Google, GitHub, …)](#7-social-login-google-github-)
- [8. External identity providers](#8-external-identity-providers-auth0-clerk-cognito-firebase-)
- [9. Two-factor authentication (TOTP)](#9-two-factor-authentication-totp)
- [10. Production checklist](#10-production-checklist)
- [11. What jsango protects you from](#11-what-jsango-protects-you-from)

---

## 1. Quick start

```ts
// src/auth.ts
import { createAuth, DatabaseAuthStore } from 'jsango';
import { User } from './models/user.js';
import { db } from './database.js';

export const auth = createAuth({
  secret: process.env.AUTH_SECRET!, // at least 32 characters: `openssl rand -base64 48`
  users: {
    findById: (id) => User.find(id),
    findByLogin: (email) => User.where('email', email).first(),
  },
  store: new DatabaseAuthStore({ connection: db }), // sessions & tokens survive restarts
});
```

```ts
// src/index.ts
import { createApp } from 'jsango';
import { auth } from './auth.js';

const app = createApp();

app.post('/auth/login', async (ctx) => {
  const { email, password } = (await ctx.request.json()) as { email: string; password: string };
  return auth.login(email, password, ctx);
  // => { tokenType: 'Bearer', accessToken, expiresIn: 900, refreshToken }
});

app.get('/me', auth.required(), async (ctx) => {
  const user = await auth.user(ctx);
  return { id: user?.id, email: user?.email };
});
```

```bash
curl -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse"}'
curl localhost:3000/me -H "Authorization: Bearer <accessToken>"
```

Errors become JSON responses automatically: `401` when not authenticated, `403` for a missing
role or permission, and `429` when locked out.

---

## 2. Users and passwords

jsango doesn't own your user table. You tell it how to load users, and it reads these
fields from them (configurable):

| Field | Purpose | Option to rename |
| --- | --- | --- |
| `id` | User id (stored in tokens and sessions) | `identity` |
| `passwordHash` | scrypt hash from `auth.hashPassword()` | `password.field` |
| `role` or `roles` | Roles for `auth.required({ roles })` | `identity` |
| `permissions` | Extra permissions | `identity` |
| `tenantId` | Multi-tenant apps | `identity` |
| `isSuperuser` | Bypasses role/permission checks | `identity` |
| `totpSecret` | Enables two-factor login | `mfa.field` |

```ts
export const User = defineModel('User', {
  id: fields.id(),
  email: fields.string({ maxLength: 255, unique: true }),
  passwordHash: fields.string({ nullable: true }), // null for social-login-only users
  role: fields.string({ maxLength: 20, defaultValue: 'member' }),
  totpSecret: fields.string({ nullable: true }),
  isActive: fields.boolean({ defaultValue: true }),
}, { table: 'users', timestamps: true });
```

**Sign-up:**

```ts
app.post('/auth/register', async (ctx) => {
  const { email, password } = (await ctx.request.json()) as { email: string; password: string };
  const user = await User.create({
    email: email.trim().toLowerCase(),
    passwordHash: await auth.hashPassword(password), // rejects < 8 characters (422)
  });
  return auth.issueTokens(user); // sign them in right away
});
```

**Blocking users.** Add `users.isActive` and disabled users can neither log in nor refresh
tokens. Their cookie sessions also stop working immediately:

```ts
createAuth({
  secret: process.env.AUTH_SECRET!,
  users: {
    findById: (id) => User.find(id),
    findByLogin: (email) => User.where('email', email).first(),
    isActive: (user) => user.isActive && !user.bannedAt,
  },
});
```

**Upgrading hashes.** When you raise the scrypt cost, `password.onRehash` receives a new hash on
each user's next successful login:

```ts
createAuth({
  // ...secret, users
  password: { onRehash: (user, hash) => User.query().where('id', user.id).update({ passwordHash: hash }) },
});
```

**Changing a password:** save the new hash, then sign the user out everywhere with
`await auth.logoutAll(user.id)`.

---

## 3. Tokens (for APIs and mobile apps)

`auth.login()` returns a short-lived **access token** (JWT, 15 minutes) and a long-lived
**refresh token** (30 days):

```ts
// Client: send the access token on every request
//   Authorization: Bearer <accessToken>
// When it expires (401 with code ERR_AUTH_TOKEN_EXPIRED), exchange the refresh token:
app.post('/auth/refresh', async (ctx) => {
  const { refreshToken } = (await ctx.request.json()) as { refreshToken: string };
  return auth.refresh(refreshToken); // new accessToken AND new refreshToken
});

app.post('/auth/logout', auth.required(), async (ctx) => {
  await auth.logout(ctx); // the access token stops working now, not in 15 minutes
  return { ok: true };
});
```

- **Rotation:** every `refresh()` returns a new refresh token, and the old one stops working.
- **Reuse detection:** if an old refresh token is presented again (it was stolen and both
  the thief and the user try to use it), the whole login is revoked and both must sign in again.
- **`auth.logoutAll(userId)`** revokes every token and session of a user, on all devices.
- **`auth.revokeRefreshToken(token)`** is for clients signing out without an access token.

The returned object has a non-enumerable `user` property (`result.user` in your code), so returning
the result from a handler never sends the user record, including its password hash, to the client.

Options: `tokens: { accessTtl: 900, refreshTtl: 2592000, issuer: 'jsango', audience: 'my-api' }`.

Access tokens carry `sub`, `roles`, `permissions` and `tenantId`. A role change therefore takes
effect when the access token is refreshed (at most 15 minutes later). Call `logoutAll()` to
force it immediately.

---

## 4. Protecting routes

```ts
app.get('/me', auth.required(), handler);                                // any signed-in user
app.get('/admin', auth.required({ roles: ['admin'] }), handler);         // any of these roles
app.delete('/posts/:id', auth.required({ permissions: ['posts.delete'] }), handler); // all of these
app.get('/feed', auth.optional(), handler);                              // anonymous allowed
app.post('/webhook', auth.required({ methods: ['apiKey'] }), handler);   // only API keys here
```

Map roles to permissions once:

```ts
createAuth({
  // ...
  roles: {
    admin: ['posts.update', 'posts.delete', 'users.manage'],
    editor: ['posts.update'],
  },
});
```

Inside handlers:

```ts
const identity = auth.identity(ctx); // { id, roles, permissions, tenantId, hasRole(), hasPermission() }
const user = await auth.user(ctx);   // your user record (loaded once per request), null if anonymous
```

`auth.optional()` still rejects credentials that are present but invalid. A bad or expired token
never silently turns into anonymous access.

For per-object rules ("users can only edit their own posts"), check in the handler or use
policies with `authorize()` (`docs/architecture/auth/policies.md`). They read the same identity.

---

## 5. Cookie sessions (for web apps)

```ts
app.post('/login', async (ctx) => {
  const { email, password } = (await ctx.request.json()) as { email: string; password: string };
  const result = await auth.login(email, password, ctx);
  if (result.mfaRequired) return result; // see section 9
  return auth.startSession(HttpResponse.json({ ok: true }), result.user);
});

app.post('/logout', auth.required(), async (ctx) => {
  const response = HttpResponse.json({ ok: true });
  await auth.logout(ctx, response); // deletes the session and clears the cookie
  return response;
});
```

- The cookie holds only a random, HMAC-signed session id. It's `HttpOnly`, `SameSite=Lax`, and
  `Secure` in production. Session data stays on the server, and every login gets a new id.
- Sessions slide: they last `session.ttl` (7 days) after the last activity.
- **CSRF protection:** cookie-authenticated `POST/PUT/PATCH/DELETE` requests must carry an
  `Origin` (or `Referer`) from a trusted origin. Bearer tokens and API keys are not affected.
  By default only the API's own origin is trusted. If your frontend runs on another origin, list it:

```ts
createAuth({
  // ...secret, users
  session: {
    trustedOrigins: ['https://app.example.com'],
    sameSite: 'None', // only when frontend and API are on different sites (requires HTTPS)
    domain: '.example.com',
  },
});
```

Each request re-loads the user, so blocking a user or changing their role applies immediately.

---

## 6. API keys

```ts
createAuth({
  // ...
  apiKeys: {
    find: async (hash) => {
      const key = await ApiKey.where('hash', hash).whereNull('revokedAt').first();
      return key ? User.find(key.userId) : null; // the owner the request acts as
    },
  },
});

app.post('/settings/api-keys', auth.required(), async (ctx) => {
  const { key, hash, prefix, last4 } = auth.createApiKey('live'); // live_9fKx...
  await ApiKey.create({ userId: auth.identity(ctx).id, hash, prefix, last4 });
  return { key }; // shown once, never stored in plain text
});
```

Clients send `X-API-Key: live_...` or `Authorization: ApiKey live_...`. Only the SHA-256 hash is
ever stored or looked up. To revoke a key, set `revokedAt`.

---

## 7. Social login (Google, GitHub, …)

```ts
import { createAuth, google, github, oauthProvider, HttpResponse } from 'jsango';

export const auth = createAuth({
  secret: process.env.AUTH_SECRET!,
  users: { findById: (id) => User.find(id) },
  oauth: [
    google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'https://api.example.com/auth/google/callback',
    }),
    github({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'https://api.example.com/auth/github/callback',
    }),
  ],
});

app.get('/auth/:provider', (ctx) => auth.oauth.redirect(ctx.request.params['provider']!));

app.get('/auth/:provider/callback', async (ctx) => {
  const profile = await auth.oauth.callback(ctx.request.params['provider']!, ctx);
  // { provider, id, email, emailVerified, name, avatarUrl }

  let account = await SocialAccount.where({ provider: profile.provider, providerId: profile.id }).first();
  let user = account ? await User.find(account.userId) : null;
  if (!user) {
    if (!profile.email || !profile.emailVerified) return HttpResponse.badRequest('A verified email is required.');
    user = await User.firstOrCreate({ email: profile.email.toLowerCase() }, { name: profile.name });
    await SocialAccount.create({ provider: profile.provider, providerId: profile.id, userId: user.id });
  }
  return auth.startSession(HttpResponse.redirect('https://app.example.com/'), user);
});
```

The flow uses the authorization code with **PKCE**, and a signed, HttpOnly `state` cookie that
expires after 10 minutes. Forged or replayed callbacks are rejected with 400. Only link
accounts by email when `emailVerified` is true.

Any other OAuth2 / OpenID Connect provider:

```ts
oauthProvider({
  name: 'microsoft',
  clientId: process.env.MS_CLIENT_ID!,
  clientSecret: process.env.MS_CLIENT_SECRET!,
  redirectUri: 'https://api.example.com/auth/microsoft/callback',
  authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
});
```

---

## 8. External identity providers (Auth0, Clerk, Cognito, Firebase, …)

If users sign in through a hosted provider, jsango verifies the provider's tokens with its public
keys (JWKS). RS256/384/512, PS256/384/512, ES256/384/512 and EdDSA are supported. Shared-secret
algorithms are refused, so tokens can't be forged.

```ts
createAuth({
  // ...
  external: {
    jwksUrl: 'https://YOUR_TENANT.auth0.com/.well-known/jwks.json',
    issuer: 'https://YOUR_TENANT.auth0.com/',
    audience: 'https://api.example.com',
    identity: (claims) => ({
      id: String(claims.sub),
      roles: (claims['https://example.com/roles'] as string[]) ?? [],
    }),
  },
});
```

| Provider | `jwksUrl` | `issuer` |
| --- | --- | --- |
| Auth0 | `https://TENANT.auth0.com/.well-known/jwks.json` | `https://TENANT.auth0.com/` |
| Clerk | `https://YOUR_FRONTEND_API/.well-known/jwks.json` | `https://YOUR_FRONTEND_API` |
| AWS Cognito | `https://cognito-idp.REGION.amazonaws.com/POOL_ID/.well-known/jwks.json` | `https://cognito-idp.REGION.amazonaws.com/POOL_ID` |
| Firebase | `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com` | `https://securetoken.google.com/PROJECT_ID` |
| Keycloak | `https://HOST/realms/REALM/protocol/openid-connect/certs` | `https://HOST/realms/REALM` |

Keys are cached for 10 minutes and refetched when the provider rotates them. Expiry,
`iss` and `aud` are always checked. Your own tokens and the provider's can be accepted side
by side.

---

## 9. Two-factor authentication (TOTP)

**Enrollment** (authenticator apps such as Google Authenticator or 1Password):

```ts
app.post('/account/2fa/setup', auth.required(), async (ctx) => {
  const user = (await auth.user(ctx))!;
  const { secret, uri } = auth.totp.generateSecret({ issuer: 'My App', accountName: user.email });
  await User.query().where('id', user.id).update({ pendingTotpSecret: secret });
  return { uri }; // render as a QR code in the browser (e.g. the `qrcode` npm package)
});

app.post('/account/2fa/confirm', auth.required(), async (ctx) => {
  const { code } = (await ctx.request.json()) as { code: string };
  const user = (await auth.user(ctx))!;
  if (!auth.totp.verifyToken(code, user.pendingTotpSecret)) return HttpResponse.badRequest('Invalid code');
  await User.query().where('id', user.id).update({ totpSecret: user.pendingTotpSecret, pendingTotpSecret: null });
  return { backupCodes: auth.totp.generateBackupCodes(8) }; // store hashed, show once
});
```

Render the QR code yourself. `qrCodeUrl` is a convenience that sends the secret to a third-party QR
service, so don't use it in production.

**Login.** For users with a `totpSecret`, `login()` returns a challenge instead of tokens:

```ts
app.post('/auth/login', async (ctx) => {
  const { email, password } = (await ctx.request.json()) as { email: string; password: string };
  return auth.login(email, password, ctx);
  // => { mfaRequired: true, mfaToken } for 2FA users
});

app.post('/auth/login/2fa', async (ctx) => {
  const { mfaToken, code } = (await ctx.request.json()) as { mfaToken: string; code: string };
  return auth.verifyMfa(mfaToken, code); // => tokens; use startSession(...) for cookie apps
});
```

The `mfaToken` is valid for 5 minutes and can't be used as an access token. Codes allow ±30
seconds of clock drift, work only once, and are brute-force limited.

---

## 10. Production checklist

- [ ] **`AUTH_SECRET`**: 32+ random characters from your secret manager (`openssl rand -base64 48`).
      Rotating it signs everyone out.
- [ ] **`store: new DatabaseAuthStore({ connection: db })`**: the in-memory store (default) loses
      sessions and refresh tokens on restart and isn't shared between instances; jsango
      warns at startup in production. You can also implement `AuthStore` on Redis (`get`, `set`,
      `delete`, `increment` with TTLs).
- [ ] **HTTPS everywhere.** Cookies are `Secure` when `NODE_ENV=production`.
- [ ] Behind a proxy or load balancer, make sure `ctx.request.ip` is the client IP (brute-force limits
      are per account and per IP).
- [ ] Call `auth.logoutAll(user.id)` after password changes and account recovery.
- [ ] Validate login / registration bodies (`validate({ body: ... })`) and rate-limit sign-up.
- [ ] Never return user records with `passwordHash` or `totpSecret`. Token results already hide
      `user`; for your own endpoints, return only the fields the client needs.

---

## 11. What jsango protects you from

| Threat | Protection |
| --- | --- |
| Password database leak | scrypt (memory-hard) with per-password salt; automatic rehash on login |
| Online password guessing | 5 failures per account per 15 minutes (20 per IP) → `429` |
| Account enumeration | One generic error message; unknown users cost the same hashing time |
| Stolen access token | 15-minute lifetime; `logout()` revokes it immediately |
| Stolen refresh token | Rotation on every use; reuse revokes the whole login |
| JWT forgery / algorithm confusion | HMAC key derived from your secret, `alg` pinned to HS256; external tokens accept asymmetric algorithms only; `none` is rejected |
| Tokens that never expire | Every token has `exp`; tokens without one are rejected |
| Session fixation / cookie tampering | New random id per login; HMAC-signed cookie; HttpOnly + SameSite |
| CSRF on cookie sessions | Trusted `Origin` / `Referer` required for state-changing requests |
| OAuth login CSRF / code interception | Signed one-time `state` + PKCE (S256) |
| TOTP brute force / replay | Attempt limit + each code accepted once |
| Disabled user keeps access | `isActive` checked on login, refresh and every session request |
| Leaking the user record | Token results never serialize `user` |
| API key database leak | Only SHA-256 hashes are stored and compared |

**Lower-level building blocks** are still available when you need full control: `JwtService`,
`ScryptPasswordHasher`, `TotpService`, the `authenticate()` / `authorize()` middleware with
custom strategies, roles, permissions and policies. See `docs/architecture/auth/`.
