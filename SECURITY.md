# Security Policy

The `jsango` team takes the security of our framework, ecosystem, and applications built with it seriously.

## Supported Versions

Only the latest Release Candidate and GA releases receive active security updates.

| Version        | Supported                              |
| :------------- | :------------------------------------- |
| `1.0.x`        | :white_check_mark: Yes (Active Stable) |
| `0.1.0-rc.1`   | :white_check_mark: Yes                 |
| `< 0.1.0-rc.1` | :x: No                                 |

---

## Reporting a Vulnerability

If you discover a security vulnerability within `jsango`, please report it responsibly.

**Please DO NOT report security vulnerabilities via public GitHub issues.**

Instead, please report security issues by emailing:
`security@jsango.org` (or opening a private GitHub Security Advisory).

### What to Include

Please provide:

1. A detailed description of the vulnerability and potential impact.
2. Steps to reproduce or a minimal proof-of-concept (POC) repository.
3. Affected package(s) and version(s).
4. Any proposed fixes or remediations, if available.

### Response Timeline

- **Initial Acknowledgement**: Within 48 hours.
- **Triage & Reproduction**: Within 5 business days.
- **Remediation & Advisory**: Security advisories will be published alongside patched releases via standard npm security channels.

---

## Security Invariants in jsango

1. **Fail-Closed Security**: All unhandled authentication, authorization, or policy evaluations default to DENY (`401 Unauthorized` / `403 Forbidden`).
2. **Sensitive Data Redaction**: Passwords, API keys, JWT tokens, and sensitive headers are strictly masked in structured logs, debug outputs, and Admin audit trails.
3. **Parameterization**: All database query abstractions enforce parameterized inputs to eliminate SQL injection vectors.
4. **Denial of Service Defenses**: Request body sizes, WebSocket connections, room joins, queue job sizes, and metrics label cardinality are bounded by default.
