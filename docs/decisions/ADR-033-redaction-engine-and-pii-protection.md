# ADR-033: Redaction Engine and PII Protection

## Status

Accepted

## Context

Logging, tracing, and diagnostics must never leak secrets (passwords, tokens, API keys, credentials, session cookies, SSNs, credit card data) into log files, APM tools, or error trackers.

## Decision

1. Implement `Redactor` with recursive object scanning and regular expression pattern matching across property keys:
   `/(password|token|secret|hash|salt|credential|authorization|cookie|session|ssn|cvv|api[-_]?key|private[-_]?key|^key$)/i`
2. Automatically mask sensitive HTTP headers (`Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`).
3. Ensure redaction produces pure deep copies without mutating input application objects.
4. Support configurable additional sensitive keys and replacement mask strings (`[REDACTED]`).

## Consequences

- Guarantees fail-safe PII and credential privacy across all logging, tracing, and diagnostic streams.
- Preserves object immutability.
