/**
 * Admin API Error representation
 */
export class AdminApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly fieldErrors?: Record<string, string> | undefined;
  public readonly metadata?: Record<string, unknown> | undefined;

  constructor(options: {
    readonly code: string;
    readonly message: string;
    readonly status: number;
    readonly fieldErrors?: Record<string, string> | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
  }) {
    super(options.message);
    this.name = 'AdminApiError';
    this.code = options.code;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.metadata = options.metadata;
  }
}
