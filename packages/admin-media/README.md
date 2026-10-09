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

## Storage drivers & the admin media library

```typescript
import { LocalDiskMediaStorage, S3MediaStorage } from 'jsango';

app.admin({
  resources: [Product],
  // Each disk is a tab in Admin → Media. The first one receives form uploads.
  media: {
    local: new LocalDiskMediaStorage({ root: './uploads', publicUrl: '/media' }), // served by the app
    s3: new S3MediaStorage({
      bucket: 'my-bucket',
      region: 'ap-south-1',
      accessKeyId: process.env.S3_KEY!,
      secretAccessKey: process.env.S3_SECRET!,
    }),
    r2: new S3MediaStorage({
      bucket: 'assets',
      region: 'auto',
      endpoint: 'https://<account>.r2.cloudflarestorage.com', // MinIO, Spaces, B2 work the same way
      publicUrl: 'https://cdn.example.com', // optional; otherwise previews use signed URLs
      accessKeyId: process.env.R2_KEY!,
      secretAccessKey: process.env.R2_SECRET!,
    }),
  },
});
```

S3 disks only touch keys under `root` (default `uploads`). The file type comes from the file extension, never the browser.

Default (no `media` option): one `local` disk in `./uploads`, served at `/media`. Pass `media: {}` to disable.
Mark a column as `{ name: 'image', type: 'image' }` (or `'file'`) to get upload + "Library" picker in forms.

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
