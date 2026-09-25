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
}

/**
 * In-memory storage backend for development and testing.
 * Files are stored in a Map; all URLs are synthetic data-URI-like placeholders.
 */
export class InMemoryMediaStorage implements IMediaStorage {
  private readonly store_: Map<string, { file: MediaFile; content: Uint8Array }> = new Map();
  private counter = 0;

  public async store(options: MediaUploadOptions): Promise<MediaFile> {
    const key = `${options.prefix ?? 'uploads'}/${++this.counter}-${options.originalName}`;
    const file: MediaFile = {
      key,
      originalName: options.originalName,
      mimeType: options.mimeType,
      size: options.content.byteLength,
      url: `memory://${key}`,
      metadata: options.metadata,
    };
    this.store_.set(key, {
      file,
      content: options.content instanceof Buffer ? options.content : Buffer.from(options.content),
    });
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

  public clear(): void {
    this.store_.clear();
    this.counter = 0;
  }
}
