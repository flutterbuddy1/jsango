import { describe, it, expect, beforeEach } from 'vitest';
import { AdminMediaManager } from '../public/manager.js';
import { InMemoryMediaStorage } from '../public/storage.js';

const makeContent = (bytes: number): Buffer => Buffer.alloc(bytes, 0x00);

describe('AdminMediaManager', () => {
  let storage: InMemoryMediaStorage;
  let manager: AdminMediaManager;

  beforeEach(() => {
    storage = new InMemoryMediaStorage();
    manager = new AdminMediaManager({ storage });
  });

  it('uploads a file and returns a MediaFile descriptor', async () => {
    const file = await manager.upload({
      content: makeContent(512),
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(file.key).toContain('photo.jpg');
    expect(file.originalName).toBe('photo.jpg');
    expect(file.mimeType).toBe('image/jpeg');
    expect(file.size).toBe(512);
  });

  it('retrieves an uploaded file by key', async () => {
    const uploaded = await manager.upload({
      content: makeContent(128),
      originalName: 'doc.pdf',
      mimeType: 'application/pdf',
    });

    const found = await manager.get(uploaded.key);
    expect(found).toBeDefined();
    expect(found!.key).toBe(uploaded.key);
  });

  it('returns undefined when getting a non-existent key', async () => {
    const found = await manager.get('does-not-exist');
    expect(found).toBeUndefined();
  });

  it('deletes an uploaded file', async () => {
    const uploaded = await manager.upload({
      content: makeContent(64),
      originalName: 'temp.txt',
      mimeType: 'text/plain',
    });

    await manager.delete(uploaded.key);
    const found = await manager.get(uploaded.key);
    expect(found).toBeUndefined();
  });

  describe('validation — size', () => {
    it('rejects files exceeding maxSizeBytes', async () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: { maxSizeBytes: 100 },
      });

      await expect(
        mgr.upload({
          content: makeContent(200),
          originalName: 'big.bin',
          mimeType: 'application/octet-stream',
        })
      ).rejects.toThrow('FILE_TOO_LARGE');
    });

    it('accepts files within size limit', async () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: { maxSizeBytes: 1024 },
      });

      await expect(
        mgr.upload({
          content: makeContent(512),
          originalName: 'ok.bin',
          mimeType: 'application/octet-stream',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('validation — MIME type', () => {
    it('rejects disallowed MIME types', async () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: { allowedMimeTypes: ['image/jpeg', 'image/png'] },
      });

      await expect(
        mgr.upload({
          content: makeContent(64),
          originalName: 'script.js',
          mimeType: 'application/javascript',
        })
      ).rejects.toThrow('MIME_NOT_ALLOWED');
    });

    it('accepts wildcard MIME patterns', async () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: { allowedMimeTypes: ['image/*'] },
      });

      await expect(
        mgr.upload({ content: makeContent(64), originalName: 'photo.webp', mimeType: 'image/webp' })
      ).resolves.toBeDefined();
    });
  });

  describe('validation — extension', () => {
    it('rejects disallowed extensions', async () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: { allowedExtensions: ['jpg', 'png'] },
      });

      await expect(
        mgr.upload({
          content: makeContent(64),
          originalName: 'malware.exe',
          mimeType: 'application/octet-stream',
        })
      ).rejects.toThrow('EXTENSION_NOT_ALLOWED');
    });

    it('accepts allowed extensions', async () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: { allowedExtensions: ['jpg', 'png'], allowedMimeTypes: ['image/*'] },
      });

      await expect(
        mgr.upload({ content: makeContent(64), originalName: 'photo.jpg', mimeType: 'image/jpeg' })
      ).resolves.toBeDefined();
    });
  });

  describe('validate()', () => {
    it('returns multiple errors at once', () => {
      const mgr = new AdminMediaManager({
        storage,
        validation: {
          maxSizeBytes: 10,
          allowedMimeTypes: ['image/jpeg'],
          allowedExtensions: ['jpg'],
        },
      });

      const errors = mgr.validate({
        content: makeContent(100),
        originalName: 'file.png',
        mimeType: 'image/png',
      });

      expect(errors.length).toBeGreaterThanOrEqual(2);
      const codes = errors.map((e) => e.code);
      expect(codes).toContain('FILE_TOO_LARGE');
      expect(codes).toContain('MIME_NOT_ALLOWED');
      expect(codes).toContain('EXTENSION_NOT_ALLOWED');
    });
  });
});
