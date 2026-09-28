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
export declare class InMemoryMediaStorage implements IMediaStorage {
    private readonly store_;
    private counter;
    store(options: MediaUploadOptions): Promise<MediaFile>;
    get(key: string): Promise<MediaFile | undefined>;
    delete(options: MediaDeleteOptions): Promise<void>;
    url(key: string): Promise<string>;
    clear(): void;
}
//# sourceMappingURL=storage.d.ts.map