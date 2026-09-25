# Auth Testing Architecture

## 1. Test Suite Coverage

The `@django-js/auth` package is thoroughly tested across 6 test suites:

| Suite                   | Focus Areas                                                                                                                   |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `password.test.ts`      | Scrypt hashing, random salt uniqueness, constant-time verification, `needsRehash` detection                                   |
| `jwt.test.ts`           | HS256/384/512 signing, claim validation (`exp`, `nbf`, `iss`, `aud`), algorithm confusion (`alg: none`) rejection, revocation |
| `session.test.ts`       | `MemorySessionStore` CRUD, TTL expiration, session fixation rotation (`rotate()`)                                             |
| `strategies.test.ts`    | Session, Bearer, and API Key strategies, deterministic manager ordering, fail-fast on malformed credentials                   |
| `authorization.test.ts` | Permission wildcards (`users.*`), roles, object-level policies, composite policies (`and`, `or`, `not`), bulk authorization   |
| `middleware.test.ts`    | Request lifecycle integration, 401 vs 403 status code verification, optional vs required auth, resource resolvers             |
| `security.test.ts`      | Fail-closed invariants, token tampering rejection, safe `toJSON()` serialization without credential leaks                     |
| `concurrency.test.ts`   | 60 simultaneous requests across Alice, Bob, and Anonymous verifying strict context isolation                                  |
