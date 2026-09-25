export interface ErrorMetadata {
  readonly [key: string]: unknown;
}

export interface SafeErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly metadata?: ErrorMetadata | undefined;
}

export interface JsangoErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly metadata?: ErrorMetadata | undefined;
  readonly statusCode?: number | undefined;
}

export class JsangoError extends Error {
  public readonly code: string;
  public readonly metadata?: ErrorMetadata | undefined;
  public readonly statusCode: number;

  constructor(options: JsangoErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'JsangoError';
    this.code = options.code;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.statusCode = options.statusCode ?? 500;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serializes the error safely for HTTP responses without exposing sensitive internal stack traces.
   */
  public toSafeJSON(isProduction = true): SafeErrorResponse {
    if (!isProduction) {
      return {
        code: this.code,
        message: this.message,
        ...(this.metadata ? { metadata: this.metadata } : {}),
      };
    }

    // In production, mask 5xx messages to prevent leaking internal error details
    const safeMessage = this.statusCode >= 500 ? 'An internal error occurred.' : this.message;

    return {
      code: this.code,
      message: safeMessage,
      ...(this.statusCode < 500 && this.metadata ? { metadata: this.metadata } : {}),
    };
  }
}
