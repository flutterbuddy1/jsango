# Token Architecture & JWT

## 1. Overview

Token authentication in Nexora is abstracted through `ITokenVerifier`:

```typescript
export interface ITokenVerifier {
  verifyToken(token: string): Promise<Identity | undefined>;
}
```

The framework provides an RFC 7519-compliant `JwtService` implementing HMAC algorithms (`HS256`, `HS384`, `HS512`).

## 2. Algorithm Confusion Defense

A common vulnerability in JWT implementations is algorithm substitution (e.g. CVE-2015-9235), where attackers supply `alg: "none"` or use asymmetric public keys as HMAC secrets.

`JwtService` defends against this by:

1. Enforcing an explicit whitelist of allowed algorithms (`allowedAlgorithms: ['HS256', 'HS384', 'HS512']`).
2. Strictly rejecting `alg: "none"`.
3. Validating that the header algorithm matches the configured whitelist before evaluating signatures.

## 3. Claims Verification

`JwtService.verify()` validates:

- `exp` (Expiration time) with optional clock skew tolerance.
- `nbf` (Not Before time).
- `iss` (Issuer equality check).
- `aud` (Audience inclusion check).

## 4. Token Revocation

Stateless tokens can be revoked using an `ITokenRevocationStore`:

- Token IDs (`jti`) can be revoked until their expiration timestamp.
- In-memory (`MemoryTokenRevocationStore`) is supplied by default, with Redis backing available in Phase 11.
