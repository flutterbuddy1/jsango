# ADR-003: Structured Error Architecture & Safe Serialization

## Status

Accepted

## Context

Standard JavaScript `Error` objects lack machine-readable error codes, contextual metadata, and HTTP status mappings. In production environments, unhandled exceptions frequently leak stack traces, internal database table names, SQL queries, or environment variables to client HTTP responses, creating severe security vulnerabilities.

## Decision

We establish a structured error model centered on `JsangoError`:

- Every framework error contains an explicit error code (`code`), human message (`message`), optional underlying error cause (`cause`), and contextual metadata (`metadata`).
- All framework errors implement `toSafeJSON(isProduction: boolean)`.
- In production (`isProduction = true`), 5xx errors mask internal details and messages with a generic fallback (`"An internal error occurred."`) and omit raw metadata. In non-production, full diagnostic details are serialized for rapid debugging.
- Internal stack traces are never exposed in production HTTP responses.

## Alternatives Considered

1. **Relying on Native Error Only**: Use native `new Error(message)`. Rejected because string messages cannot be reliably handled programmatically by consumers without fragile string regex matching, and lacks safety serialization controls.
2. **Third-Party Error Libraries**: Bring in external libraries like `ts-custom-error` or `http-errors`. Rejected per our dependency policy to keep the core lightweight, avoid unnecessary dependencies, and support native Node/Bun serialization.

## Consequences

- **Positive**: Machine-readable error handling; prevention of sensitive data leakage; predictable HTTP error mapping; compliance with security rules.
- **Negative**: Developers must instantiate `JsangoError` with structured options instead of throwing raw strings or plain native errors.
