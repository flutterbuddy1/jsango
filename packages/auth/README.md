# @jsango/auth

> Authentication and authorization subsystem with Session, JWT, API Key strategies, Scrypt password hashing, TOTP, and object policies.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/auth
```

## Quick start

```typescript
import { createAuth, DatabaseAuthStore } from '@jsango/auth';

export const auth = createAuth({
  secret: process.env.AUTH_SECRET!, // 32+ characters
  users: {
    findById: (id) => User.find(id),
    findByLogin: (email) => User.where('email', email).first(),
  },
  store: new DatabaseAuthStore({ connection: db }),
});

app.post('/auth/login', async (ctx) => {
  const { email, password } = (await ctx.request.json()) as { email: string; password: string };
  return auth.login(email, password, ctx); // { accessToken, refreshToken, expiresIn }
});
app.get('/admin', auth.required({ roles: ['admin'] }), handler);
```

`createAuth()` also covers refresh-token rotation, cookie sessions, API keys, social login
(Google, GitHub, any OAuth2), Auth0/Clerk/Cognito/Firebase tokens (JWKS) and TOTP 2FA. See the
[authentication guide](../../docs/auth/README.md).

## Low-level building blocks

```typescript
import {
  ScryptPasswordHasher,
  JwtService,
  BasePolicy,
  PolicyRegistry,
  AuthorizationManager,
  UserIdentity,
  type Identity,
} from '@jsango/auth';

// Password hashing (scrypt)
const hasher = new ScryptPasswordHasher();
const hash = await hasher.hash('secure-password');
const valid = await hasher.verify('secure-password', hash);

// JWT
const jwt = new JwtService(process.env.JWT_SECRET!);
const token = jwt.sign({ sub: 'user-1' }, { expiresInSeconds: 3600 });
const payload = await jwt.verify(token);

// Object-level policies: methods are named after the action
class PostPolicy extends BasePolicy<{ authorId: string }> {
  public readonly name = 'post';
  update(identity: Identity, post?: { authorId: string }) {
    return post?.authorId === identity.id;
  }
}

const authz = new AuthorizationManager({
  policies: new PolicyRegistry().registerFor('Post', new PostPolicy()),
});
const user = new UserIdentity({ id: 'user-1' });
// `$type` (or a model instance) tells the registry which policy applies.
const allowed = await authz.can(user, 'update', { $type: 'Post', authorId: 'user-1' }); // true
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
