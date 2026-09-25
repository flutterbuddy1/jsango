# Authentication Engine & Strategies

## 1. Overview

The authentication subsystem is responsible for verifying client credentials and resolving an authenticated principal. It does not evaluate permissions or authorize access.

## 2. Authentication Strategies

Authentication strategies implement `IAuthenticationStrategy`:

```typescript
export interface IAuthenticationStrategy {
  readonly name: string;
  authenticate(request: HttpRequest, context: RequestContext): Promise<AuthenticationResult>;
}
```

### Provided Strategies:

1. **`SessionAuthenticationStrategy`**: Inspects configured cookie (`session_id`), looks up session in `ISessionStore`, handles expiration, and provides `rotate()` for session fixation defense.
2. **`BearerTokenAuthenticationStrategy`**: Inspects `Authorization: Bearer <token>` header, verifies token via `ITokenVerifier` (e.g. `JwtTokenVerifier`), and maps claims to `Identity`.
3. **`ApiKeyAuthenticationStrategy`**: Inspects `x-api-key` header or `Authorization: ApiKey <key>`. Hashes raw keys with SHA-256 before invoking `IApiKeyVerifier` to avoid raw token exposure.

## 3. AuthenticationManager & Deterministic Chaining

`AuthenticationManager` evaluates strategies in a deterministic, user-configured order:

```typescript
const manager = new AuthenticationManager({
  strategies: [sessionStrategy, bearerStrategy, apiKeyStrategy],
  failOnError: true,
});
```

### Chaining Rules:

- **`unauthenticated`**: No credentials intended for this strategy were found in the request (e.g., no Bearer header). The manager proceeds to the next strategy in the chain.
- **`authenticated`**: Credentials were valid; manager immediately halts and returns the authenticated `Identity`.
- **`failOnError` (Fail-Fast)**: If a strategy detects credentials intended for it (e.g., a Bearer token is provided) but they are invalid, expired, or malformed, the manager halts immediately and returns the failure. It does **not** fall through to weaker strategies, preventing downgrade attacks.
