# Security Architecture & Cryptographic Decisions

## 1. Zero External Dependencies

`@django-js/auth` relies entirely on native Web Cryptography and runtime primitives (`node:crypto`), ensuring zero supply-chain risk and cross-runtime compatibility (Node.js and Bun).

## 2. Password Hashing: Scrypt (RFC 7914)

Passwords are hashed using Scrypt, a memory-hard key derivation function:

- Standard cost parameters: $N = 16384$ ($2^{14}$), $r = 8$, $p = 1$.
- 128-bit cryptographically secure random salt generated via `crypto.randomBytes(16)`.
- Stored using standard modular format: `$scrypt$ln=14,r=8,p=1$<salt-b64>$<hash-b64>`.
- Verification uses `crypto.timingSafeEqual` in constant time.
- Upgrade strategy supported via `needsRehash(hash)`.

## 3. Timing Attack Defenses

- Constant-time comparison using `timingSafeEqualString` for all token, API key, and credential checks.
- Constant-time dummy comparisons execute even when hash formats or lengths mismatch, neutralizing timing oracles.

## 4. Account Enumeration Prevention

Authentication errors return generic messages (`Invalid authentication credentials.`) rather than distinguishing between "user not found" and "incorrect password".
