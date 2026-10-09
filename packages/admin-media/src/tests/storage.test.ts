import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { LocalDiskMediaStorage, buildMediaKey } from '../public/storage.js';
import { S3MediaStorage } from '../public/s3.js';

describe('S3MediaStorage', () => {
  it('presigns URLs matching the AWS SigV4 reference example', () => {
    const s3 = new S3MediaStorage({
      bucket: 'examplebucket',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    });
    const url = s3.presign('GET', 'test.txt', 86400, {}, new Date('2013-05-24T00:00:00Z'));
    expect(url).toMatch(/^https:\/\/examplebucket\.s3\.amazonaws\.com\/test\.txt\?/);
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
    );
  });

  it('uses path-style URLs for custom endpoints', () => {
    const r2 = new S3MediaStorage({
      bucket: 'media',
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      accessKeyId: 'a',
      secretAccessKey: 'b',
    });
    expect(r2.presign('PUT', 'a b/c.png')).toMatch(
      /^https:\/\/acct\.r2\.cloudflarestorage\.com\/media\/a%20b\/c\.png\?/
    );
  });

  it('refuses keys outside its root folder', async () => {
    const s3 = new S3MediaStorage({ bucket: 'b', accessKeyId: 'a', secretAccessKey: 'b' });
    await expect(s3.delete({ key: 'invoices/2026.pdf' })).rejects.toThrow('outside');
    await expect(s3.url('uploads/../invoices/x')).rejects.toThrow('outside');
  });
});

describe('LocalDiskMediaStorage', () => {
  it('stores, lists, reads and deletes files inside its root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jsango-media-'));
    const disk = new LocalDiskMediaStorage({ root });
    const file = await disk.store({
      content: Buffer.from('hi'),
      originalName: 'hello world.txt',
      mimeType: 'text/plain',
      prefix: '../../etc',
    });
    expect(file.key).toMatch(/^etc\/[a-z0-9]+-hello-world\.txt$/);
    expect(file.url).toBe(`/media/${file.key}`);
    expect((await disk.list()).map((f) => f.key)).toEqual([file.key]);
    expect(Buffer.from((await disk.read(file.key))!.content).toString()).toBe('hi');
    expect(await disk.read('../outside.txt')).toBeUndefined();
    await disk.delete({ key: file.key });
    expect(await disk.list()).toEqual([]);
    await fs.rm(root, { recursive: true });
  });

  it('builds safe keys', () => {
    expect(buildMediaKey('../x.png', 'a/../b')).toMatch(/^a\/b\/[a-z0-9]+-x\.png$/);
  });
});
