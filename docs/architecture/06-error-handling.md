# 06 — Structured Error Handling & Production Safety

## Foundational Error Principles

1. **No Silent Swallowing**: Catch blocks must never be empty (`catch (error) {}`). Every error must be handled, transformed, rethrown, or explicitly justified in a comment.
2. **Structured Errors**: Framework errors inherit from `DjangoJsError` and include machine-readable error codes, human messages, optional causes, and contextual metadata.
3. **Safe Serialization**: Sensitive details (stack traces, database credentials, internal hosts) must never be returned in HTTP responses in production environments.

---

## The `DjangoJsError` Model

```typescript
export class DjangoJsError extends Error {
  public readonly code: string;
  public readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  public readonly statusCode: number;

  constructor(options: DjangoJsErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'DjangoJsError';
    this.code = options.code;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.statusCode = options.statusCode ?? 500;
  }

  public toSafeJSON(isProduction = true): SafeErrorResponse {
    if (!isProduction) {
      return {
        code: this.code,
        message: this.message,
        ...(this.metadata ? { metadata: this.metadata } : {}),
      };
    }

    const safeMessage = this.statusCode >= 500 ? 'An internal error occurred.' : this.message;
    return {
      code: this.code,
      message: safeMessage,
      ...(this.statusCode < 500 && this.metadata ? { metadata: this.metadata } : {}),
    };
  }
}
```

### Production Behavior vs Development Behavior

- **In Development**: `toSafeJSON(false)` returns the full message and metadata for swift debugging.
- **In Production**: `toSafeJSON(true)` strips metadata for 5xx errors and returns a generic `'An internal error occurred.'` message while preserving the error code for tracking. Full error diagnostics are logged securely through `ILogger`.
