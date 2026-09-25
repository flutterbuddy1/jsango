# ADR-021: Fail-Closed Security Defaults and Password Cryptography

## Context

Security frameworks that fail open under unexpected conditions or use weak password hashing create critical vulnerabilities in production applications.

## Decision

1. **Strict Fail-Closed Defaults**:
   - Any missing identity, missing policy, unhandled exception inside a policy, or unknown permission immediately resolves to **DENY**.
   - No implicit grants or optimistic passes are permitted.
2. **Password Cryptography: Scrypt (RFC 7914)**:
   - Evaluated Bcrypt vs Argon2id vs Scrypt.
   - Selected **Scrypt** as the native memory-hard hashing algorithm available across Node.js and Bun without compiling native binary bindings (`node-gyp`).
   - Default parameters: $N = 16384$ ($2^{14}$), $r = 8$, $p = 1$, 16-byte random salt.
   - Modular storage format: `$scrypt$ln=14,r=8,p=1$<salt-b64>$<hash-b64>`.
   - Upgrade strategy via `needsRehash()`.
3. **Timing-Safe Equivalence**:
   - `crypto.timingSafeEqual` and `timingSafeEqualString` are enforced on all secret comparisons to eliminate timing oracle vulnerabilities.

## Consequences

- Maximum default security posture against brute-force and timing attacks.
- Zero native compilation dependencies; guaranteed portability across Linux, macOS, Windows, Docker, and Bun.
