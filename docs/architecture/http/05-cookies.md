# 05 — Cookie Parsing & Serialization

## Overview

The cookie module provides secure parsing of incoming `Cookie` headers and robust serialization of outgoing `Set-Cookie` directives.

---

## Security Defaults

- **`httpOnly: true`**: Enabled by default to mitigate XSS-based cookie theft.
- **`path: '/'`**: Default path unless explicitly restricted.
- **`sameSite`**: Supports `'Strict'`, `'Lax'`, and `'None'`.
- **Validation**: Enforces strict RFC 6265 token rules for cookie names and sanitizes values against CRLF injection (`ERR_COOKIE_INJECTION`).

---

## Example Usage

```typescript
// Parsing request cookies
const cookies = parseCookies(request.headers.get('cookie'));
const token = cookies['session_id'];

// Setting response cookies
response.setCookie('session_id', 'secret123', {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  maxAge: 86400, // 1 day
});

// Deleting cookies
response.deleteCookie('session_id');
```
