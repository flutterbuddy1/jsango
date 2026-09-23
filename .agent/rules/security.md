---
trigger: always_on
---

# Security Rules

Security is a first-class framework concern.

Defaults must be secure.

Never:

- disable TLS verification
- log passwords
- log tokens
- expose secrets
- trust user input
- construct SQL from raw input
- expose internal errors
- store plaintext passwords
- trust client-provided roles

Required security areas:

- CSRF
- CORS
- rate limiting
- secure cookies
- password hashing
- session security
- JWT validation
- input validation
- output encoding
- SQL injection protection
- path traversal protection
- file upload validation
- security headers