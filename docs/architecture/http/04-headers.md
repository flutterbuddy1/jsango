# 04 — Safe Case-Insensitive Headers

## Overview

HTTP header field names are case-insensitive per RFC 7230. `HttpHeaders` provides case-insensitive lookup, mutation, and iteration, while shielding the application from host-specific raw header structures.

---

## Security Guarantees

1. **CRLF Injection Prevention**:
   Headers are verified against carriage return (`\r`) and newline (`\n`) characters. Attempting to insert CRLF in either a header name or header value immediately throws `JsangoError` with code `ERR_HEADER_INJECTION`.
2. **Control Character Defense**:
   Disallows null bytes and ASCII control characters in header keys.
3. **Multi-Value Support**:
   Supports both comma-delimited concatenation (`get()`) and isolated arrays (`getAll()`).

---

## Example Usage

```typescript
const headers = new HttpHeaders();
headers.set('Content-Type', 'application/json');
headers.append('Accept', 'application/json');
headers.append('Accept', 'text/plain');

headers.get('content-type'); // 'application/json'
headers.get('ACCEPT'); // 'application/json, text/plain'
headers.getAll('accept'); // ['application/json', 'text/plain']
```
