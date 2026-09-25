import type { IMediaStorage } from './storage.js';
import type {
  MediaFile,
  MediaUploadOptions,
  MediaValidationRules,
  MediaValidationError,
} from './types.js';

export interface MediaManagerOptions {
  readonly storage: IMediaStorage;
  readonly validation?: MediaValidationRules | undefined;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface ResolvedRules {
  readonly maxSizeBytes: number;
  readonly allowedMimeTypes: readonly string[];
  readonly allowedExtensions: readonly string[];
}

/**
 * Validates and proxies file upload requests through the configured storage driver.
 * Validation always runs before any I/O.
 */
export class AdminMediaManager {
  private readonly storage: IMediaStorage;
  private readonly rules: ResolvedRules;

  constructor(options: MediaManagerOptions) {
    this.storage = options.storage;
    this.rules = {
      maxSizeBytes: options.validation?.maxSizeBytes ?? DEFAULT_MAX_SIZE,
      allowedMimeTypes: options.validation?.allowedMimeTypes ?? ['*/*'],
      allowedExtensions: options.validation?.allowedExtensions ?? [],
    };
  }

  /**
   * Validates then stores a file.
   * Throws an Error with code ERR_ADMIN_MEDIA_VALIDATION if validation fails.
   */
  public async upload(options: MediaUploadOptions): Promise<MediaFile> {
    const errors = this.validate(options);
    if (errors.length > 0) {
      const messages = errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
      throw Object.assign(new Error(`Media upload rejected: ${messages}`), {
        code: 'ERR_ADMIN_MEDIA_VALIDATION',
        validationErrors: errors,
      });
    }

    return this.storage.store(options);
  }

  /**
   * Retrieves a file descriptor by key.
   */
  public get(key: string): Promise<MediaFile | undefined> {
    return this.storage.get(key);
  }

  /**
   * Deletes a stored file by key.
   */
  public delete(key: string): Promise<void> {
    return this.storage.delete({ key });
  }

  /**
   * Returns a public or signed URL for a file.
   */
  public url(key: string, expiresInSeconds?: number): Promise<string> {
    return this.storage.url(key, expiresInSeconds);
  }

  /**
   * Validates an upload against the configured rules.
   * Returns an array of validation errors (empty if valid).
   */
  public validate(
    options: Pick<MediaUploadOptions, 'content' | 'originalName' | 'mimeType'>
  ): MediaValidationError[] {
    const errors: MediaValidationError[] = [];

    // Size check
    if (options.content.byteLength > this.rules.maxSizeBytes) {
      const maxMb = (this.rules.maxSizeBytes / (1024 * 1024)).toFixed(1);
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size ${options.content.byteLength} bytes exceeds the maximum of ${maxMb} MB.`,
      });
    }

    // MIME type check
    if (!this.isMimeAllowed(options.mimeType)) {
      errors.push({
        code: 'MIME_NOT_ALLOWED',
        message: `MIME type "${options.mimeType}" is not allowed.`,
      });
    }

    // Extension check
    if (this.rules.allowedExtensions.length > 0) {
      const ext = this.extractExtension(options.originalName);
      if (!this.rules.allowedExtensions.includes(ext)) {
        errors.push({
          code: 'EXTENSION_NOT_ALLOWED',
          message: `File extension ".${ext}" is not allowed.`,
        });
      }
    }

    return errors;
  }

  private isMimeAllowed(mime: string): boolean {
    for (const pattern of this.rules.allowedMimeTypes) {
      if (pattern === '*/*') return true;
      if (pattern === mime) return true;
      // Wildcard sub-type: "image/*"
      if (pattern.endsWith('/*')) {
        const type = pattern.slice(0, -2);
        if (mime.startsWith(`${type}/`)) return true;
      }
    }
    return false;
  }

  private extractExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? (parts.at(-1) ?? '').toLowerCase() : '';
  }
}
