# @django-js/admin-media

> Secure media uploads, MIME/extension validation, and storage abstraction for django-js Admin.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/admin-media
```

## Usage

```typescript
import { AdminMediaManager, InMemoryMediaStorage } from '@django-js/admin-media';

const storage = new InMemoryMediaStorage();
const media = new AdminMediaManager(storage, { maxSizeBytes: 5 * 1024 * 1024 });
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
