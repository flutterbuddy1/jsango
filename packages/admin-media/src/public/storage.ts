import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { MediaFile, MediaUploadOptions, MediaDeleteOptions } from './types.js';

/**
 * Abstracts the underlying file storage backend.
 * Implement this interface to support local disk, S3, GCS, or any custom system.
 */
export interface IMediaStorage {
  /**
   * Stores a file and returns a MediaFile descriptor.
   */
  store(options: MediaUploadOptions): Promise<MediaFile>;

  /**
   * Retrieves a file descriptor by key.
   */
  get(key: string): Promise<MediaFile | undefined>;

  /**
   * Deletes a file by key.
   */
  delete(options: MediaDeleteOptions): Promise<void>;

  /**
   * Generates a public or signed URL for a stored file.
   * By default this may be the same as MediaFile.url, but some drivers
   * (e.g. S3 private buckets) generate signed URLs here.
   */
  url(key: string, expiresInSeconds?: number): Promise<string>;

  /** Lists stored files, optionally under a key prefix (used by the admin media library). */
  list?(prefix?: string): Promise<MediaFile[]>;

  /** Reads a file's bytes (used to serve local files). */
  read?(key: string): Promise<{ content: Uint8Array; mimeType: string } | undefined>;
}

/** A storage key `<prefix>/<timestamp>-<safe name>`; rejects path traversal in the prefix. */
export function buildMediaKey(originalName: string, prefix = 'uploads'): string {
  const safe = (s: string) => s.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  const folders = prefix
    .split('/')
    .map(safe)
    .filter((s) => s && s !== '.' && s !== '..');
  const name = safe(originalName.split(/[\\/]/).pop()!).replace(/^\.+/, '') || 'file';
  return [...folders, `${Date.now().toString(36)}-${name}`].join('/');
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  csv: 'text/csv',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  zip: 'application/zip',
};

export function mimeFromName(name: string): string {
  return MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/**
 * In-memory storage backend for development and testing.
 * Files are stored in a Map; URLs are data URIs so images preview without a file server.
 */
export class InMemoryMediaStorage implements IMediaStorage {
  private readonly store_: Map<string, { file: MediaFile; content: Uint8Array }> = new Map();
  private counter = 0;

  public async store(options: MediaUploadOptions): Promise<MediaFile> {
    const key = `${options.prefix ?? 'uploads'}/${++this.counter}-${options.originalName}`;
    const content =
      options.content instanceof Buffer ? options.content : Buffer.from(options.content);
    const file: MediaFile = {
      key,
      originalName: options.originalName,
      mimeType: options.mimeType,
      size: options.content.byteLength,
      url: `data:${options.mimeType};base64,${content.toString('base64')}`,
      metadata: options.metadata,
    };
    this.store_.set(key, { file, content });
    return file;
  }

  public async get(key: string): Promise<MediaFile | undefined> {
    return this.store_.get(key)?.file;
  }

  public async delete(options: MediaDeleteOptions): Promise<void> {
    this.store_.delete(options.key);
  }

  public async url(key: string): Promise<string> {
    return this.store_.get(key)?.file.url ?? `memory://${key}`;
  }

  public async list(prefix = ''): Promise<MediaFile[]> {
    return [...this.store_.values()].map((e) => e.file).filter((f) => f.key.startsWith(prefix));
  }

  public async read(key: string) {
    const entry = this.store_.get(key);
    return entry && { content: entry.content, mimeType: entry.file.mimeType };
  }

  public clear(): void {
    this.store_.clear();
    this.counter = 0;
  }
}

export interface LocalDiskMediaStorageOptions {
  /** Directory files are written to. Default `./uploads`. */
  readonly root?: string | undefined;
  /** URL the directory is served at (the admin serves it when it starts with '/'). Default `/media`. */
  readonly publicUrl?: string | undefined;
}

/** Stores files on the local filesystem. */
export class LocalDiskMediaStorage implements IMediaStorage {
  public readonly root: string;
  public readonly publicUrl: string;

  constructor(options: LocalDiskMediaStorageOptions = {}) {
    this.root = path.resolve(options.root ?? 'uploads');
    this.publicUrl = (options.publicUrl ?? '/media').replace(/\/$/, '');
  }

  /** Absolute path of a key, or undefined if the key escapes the root. */
  private resolve(key: string): string | undefined {
    const full = path.resolve(this.root, key);
    return full.startsWith(this.root + path.sep) ? full : undefined;
  }

  private describe(key: string, size: number): MediaFile {
    const name = path.basename(key);
    return {
      key,
      originalName: name.replace(/^[a-z0-9]+-/, ''),
      mimeType: mimeFromName(name),
      size,
      url: `${this.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`,
    };
  }

  public async store(options: MediaUploadOptions): Promise<MediaFile> {
    const key = buildMediaKey(options.originalName, options.prefix);
    const full = this.resolve(key)!;
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, options.content);
    return { ...this.describe(key, options.content.byteLength), mimeType: options.mimeType };
  }

  public async get(key: string): Promise<MediaFile | undefined> {
    const full = this.resolve(key);
    const stat = full ? await fs.stat(full).catch(() => undefined) : undefined;
    return stat?.isFile() ? this.describe(key, stat.size) : undefined;
  }

  public async delete(options: MediaDeleteOptions): Promise<void> {
    const full = this.resolve(options.key);
    if (full) await fs.rm(full, { force: true });
  }

  public async url(key: string): Promise<string> {
    return this.describe(key, 0).url;
  }

  // ponytail: walks the folder on every call; paginate / index when folders hold 100k+ files
  public async list(prefix = ''): Promise<MediaFile[]> {
    // Only walk the prefix's folder, and stat files in parallel.
    const folder = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/')) : '';
    const start = folder ? this.resolve(folder) : this.root;
    if (!start) return [];
    const entries = await fs
      .readdir(start, { recursive: true, withFileTypes: true })
      .catch(() => []);
    const keys = entries
      .filter((e) => e.isFile())
      .map((e) => path.join(e.parentPath ?? (e as { path?: string }).path ?? start, e.name))
      .map((full) => path.relative(this.root, full).split(path.sep).join('/'))
      .filter((key) => key.startsWith(prefix));
    return Promise.all(
      keys.map(async (key) => this.describe(key, (await fs.stat(this.resolve(key)!)).size))
    );
  }

  public async read(key: string) {
    const full = this.resolve(key);
    const content = full ? await fs.readFile(full).catch(() => undefined) : undefined;
    return content && { content, mimeType: mimeFromName(key) };
  }
}
