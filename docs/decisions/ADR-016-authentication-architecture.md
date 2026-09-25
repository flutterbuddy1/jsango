# ADR-016: Authentication Architecture & Strategy Chaining

## Context

Authentication must answer "Who is this principal?" without presuming a specific credential transport (cookies, headers, bearer tokens, or query parameters) or tightly coupling to a single authentication mechanism or database user table.

## Decision

1. **Authentication Strategy Interface**:
   - Every mechanism implements `IAuthenticationStrategy` with `authenticate(request, context): Promise<AuthenticationResult>`.
2. **AuthenticationManager Orchestration**:
   - Evaluates a deterministic chain of strategies.
   - Distinct statuses: `authenticated`, `unauthenticated`, `invalid_credentials`, `expired_credentials`, `malformed_credentials`.
   - **Fail-Fast Defense**: With `failOnError: true`, when a strategy identifies credentials intended for it that fail validation, execution halts immediately without falling through to weaker strategies.

## Consequences

- Highly extensible: session, JWT, API keys, and future OAuth/OIDC can be chained transparently.
- Protects against downgrade attacks where a malformed strong credential falls back to an anonymous or weaker credential.
