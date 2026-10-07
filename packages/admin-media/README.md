# @jsango/admin-media

> Secure media uploads, MIME/extension validation, and storage abstraction for jsango Admin.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-media
```

## Usage

```typescript
import { AdminMediaManager, InMemoryMediaStorage } from '@jsango/admin-media';

const media = new AdminMediaManager({
  storage: new InMemoryMediaStorage(), // implement IMediaStorage for disk/S3/GCS
  validation: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/*'],
    allowedExtensions: ['jpg', 'png'],
  },
});

// Throws (code ERR_ADMIN_MEDIA_VALIDATION) if the file breaks a rule.
const file = await media.upload({
  content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  originalName: 'avatar.png',
  mimeType: 'image/png',
  prefix: 'avatars',
});
const url = await media.url(file.key);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
