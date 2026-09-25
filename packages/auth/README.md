# @jsango/auth

> Authentication and authorization subsystem with Session, JWT, API Key strategies, Scrypt hashing, and object policies.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/auth
```

## Usage

```typescript
import { AuthService, ScryptHasher, PolicyRegistry, definePolicy } from '@jsango/auth';

const hasher = new ScryptHasher();
const hash = await hasher.hash('secure-password');
const valid = await hasher.verify('secure-password', hash);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
