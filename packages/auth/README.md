# @django-js/auth

> Authentication and authorization subsystem with Session, JWT, API Key strategies, Scrypt hashing, and object policies.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/auth
```

## Usage

```typescript
import { AuthService, ScryptHasher, PolicyRegistry, definePolicy } from '@django-js/auth';

const hasher = new ScryptHasher();
const hash = await hasher.hash('secure-password');
const valid = await hasher.verify('secure-password', hash);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
