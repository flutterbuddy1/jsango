# @jsango/admin-media

> Secure media uploads, MIME/extension validation, and storage abstraction for jsango Admin.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-media
```

## Usage

```typescript
import { AdminMediaManager, InMemoryMediaStorage } from '@jsango/admin-media';

const storage = new InMemoryMediaStorage();
const media = new AdminMediaManager(storage, { maxSizeBytes: 5 * 1024 * 1024 });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
