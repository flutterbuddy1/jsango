# Error Handling Pipeline

## Centralized Exception Handling

Errors thrown anywhere during request processing (global middleware, router, route middleware, handler, or response normalizer) are routed to a centralized error boundary:

```
Exception Thrown
       │
       ▼
Global Middleware Catch (if wrapped in try/catch)
       │
       ▼
Application Error Boundary
       ├── Custom Error Handler (app.setErrorHandler)
       └── Default Error Formatter (formatHttpErrorResponse)
               ├── Status Code Determination (default: 500)
               ├── Production Masking (5xx messages masked to "An internal error occurred.")
               └── Non-Production Rich Diagnostics
```

## Error Safety Rules

1. **Production Masking**:
   In production (`isProduction: true`), 5xx errors are stripped of internal stack traces, database queries, and private system metadata.
2. **Framework Errors**:
   Errors extending `DjangoJsError` carry structured error codes (e.g. `ERR_HTTP_NOT_FOUND`, `ERR_MIDDLEWARE_MULTIPLE_NEXT_CALLS`) and explicit HTTP status codes.
3. **Global After-Middleware Execution**:
   Because route-level errors are caught at the terminal boundary of the global pipeline, global after-middleware (such as CORS headers or telemetry loggers) executes on the generated error response, ensuring clients receive valid CORS headers on errors.
