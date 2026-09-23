# 11 — HTTP Security Controls

## Core Security Safeguards

1. **CRLF Injection Prevention**:
   Strict validation on `HttpHeaders.set()`, `append()`, and `serializeCookie()` prevents carriage return (`\r`) or newline (`\n`) characters from splitting HTTP response streams.
2. **Body Size Limits**:
   Requests enforce a configurable `maxBodySize` (default: 10MB). When this threshold is exceeded, reading stops immediately and `PayloadTooLargeError` (413) is thrown, protecting against denial-of-service (DoS) memory exhaustion.
3. **Single Consumption Guarantee**:
   Prevents double-reading request streams via `PayloadAlreadyConsumedError`.
4. **Secure Cookie Defaults**:
   Cookies default to `HttpOnly: true` and enforce token-safe naming rules per RFC 6265.
5. **Masked Production Errors**:
   5xx errors return generic `An internal error occurred.` responses to external clients, preventing information disclosure of credentials, connection strings, or system paths.
