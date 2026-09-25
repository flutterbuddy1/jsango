/**
 * Media / file upload types for the Admin platform.
 */

export type MediaStorageDriver = 'local' | 's3' | 'gcs' | 'custom';

export interface MediaFile {
  /** Unique stable key within the storage driver. */
  readonly key: string;
  /** Original filename as provided by the uploader. */
  readonly originalName: string;
  /** MIME type detected or declared at upload time. */
  readonly mimeType: string;
  /** File size in bytes. */
  readonly size: number;
  /** Public or signed URL to retrieve the file. */
  readonly url: string;
  /** Metadata attached at upload time. */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface MediaUploadOptions {
  /**
   * The binary content of the file.
   * Accept Buffer or Uint8Array so the package is runtime-agnostic.
   */
  readonly content: Buffer | Uint8Array;
  readonly originalName: string;
  readonly mimeType: string;
  /**
   * Optional target path prefix / folder within the storage backend.
   */
  readonly prefix?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface MediaDeleteOptions {
  readonly key: string;
}

export interface MediaValidationRules {
  /** Max file size in bytes. Default: 10 MB. */
  readonly maxSizeBytes?: number | undefined;
  /** Allowed MIME type patterns. Supports `*` wildcard. E.g. `image/*`. */
  readonly allowedMimeTypes?: readonly string[] | undefined;
  /** Allowed extensions (without dot). E.g. `['jpg', 'png']`. */
  readonly allowedExtensions?: readonly string[] | undefined;
}

export interface MediaValidationError {
  readonly code: 'FILE_TOO_LARGE' | 'MIME_NOT_ALLOWED' | 'EXTENSION_NOT_ALLOWED';
  readonly message: string;
}
