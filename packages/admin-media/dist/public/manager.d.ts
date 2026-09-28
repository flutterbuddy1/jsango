import type { IMediaStorage } from './storage.js';
import type { MediaFile, MediaUploadOptions, MediaValidationRules, MediaValidationError } from './types.js';
export interface MediaManagerOptions {
    readonly storage: IMediaStorage;
    readonly validation?: MediaValidationRules | undefined;
}
/**
 * Validates and proxies file upload requests through the configured storage driver.
 * Validation always runs before any I/O.
 */
export declare class AdminMediaManager {
    private readonly storage;
    private readonly rules;
    constructor(options: MediaManagerOptions);
    /**
     * Validates then stores a file.
     * Throws an Error with code ERR_ADMIN_MEDIA_VALIDATION if validation fails.
     */
    upload(options: MediaUploadOptions): Promise<MediaFile>;
    /**
     * Retrieves a file descriptor by key.
     */
    get(key: string): Promise<MediaFile | undefined>;
    /**
     * Deletes a stored file by key.
     */
    delete(key: string): Promise<void>;
    /**
     * Returns a public or signed URL for a file.
     */
    url(key: string, expiresInSeconds?: number): Promise<string>;
    /**
     * Validates an upload against the configured rules.
     * Returns an array of validation errors (empty if valid).
     */
    validate(options: Pick<MediaUploadOptions, 'content' | 'originalName' | 'mimeType'>): MediaValidationError[];
    private isMimeAllowed;
    private extractExtension;
}
//# sourceMappingURL=manager.d.ts.map