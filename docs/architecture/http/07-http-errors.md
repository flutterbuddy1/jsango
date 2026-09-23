# 07 — Structured HTTP Errors

## Overview

All HTTP-specific errors inherit from `DjangoJsError` (from `@django-js/core`), ensuring structured error codes, standard HTTP status codes, causes, and safe serialization.

---

## Hierarchy

```
DjangoJsError (Core)
       ↓
    HttpError
       ├── BadRequestError (400)
       ├── UnauthorizedError (401)
       ├── ForbiddenError (403)
       ├── NotFoundError (404)
       ├── MethodNotAllowedError (405)
       ├── ConflictError (409)
       ├── PayloadTooLargeError (413)
       ├── UnsupportedMediaTypeError (415)
       ├── UnprocessableEntityError (422)
       ├── TooManyRequestsError (429)
       ├── InternalServerError (500)
       ├── BadGatewayError (502)
       ├── ServiceUnavailableError (503)
       └── GatewayTimeoutError (504)
```

---

## Safe Production Serialization

When an error escapes to the top-level HTTP handler:

- **In Production (`isProduction = true`)**:
  5xx internal server errors mask sensitive details and internal messages with `"An internal error occurred."` and strip `metadata` to prevent leaking database connection strings or stack traces.
- **In Development (`isProduction = false`)**:
  Full message and metadata details are included for swift debugging.

```json
{
  "error": {
    "code": "ERR_HTTP_NOT_FOUND",
    "message": "User not found"
  }
}
```
