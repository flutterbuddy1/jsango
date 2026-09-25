# Middleware Integration & Request Lifecycle

## 1. Middleware Flow

```
HttpRequest
   ↓
[authenticate(options)]
   ↓
   Resolves credentials via configured strategies
   Attaches Identity to ctx.state and request-scoped DI container
   ↓
[authorize(action, options)]
   ↓
   Checks if identity is authenticated (401 if unauthenticated)
   Checks permission, role, or object policy (403 if denied)
   ↓
Handler (200 OK)
```

## 2. Distinction: 401 Unauthorized vs 403 Forbidden

- **401 Unauthorized (`UnauthenticatedError`)**: Client did not present valid authentication credentials (or token expired). The client identity is unknown.
- **403 Forbidden (`ForbiddenError`)**: Client is authenticated and identified, but the principal lacks permissions to access the requested resource.

`authorize()` strictly maintains this distinction: an unauthenticated request arriving at an `authorize()` middleware produces 401, not 403.

## 3. Optional Authentication

Public endpoints can inspect the current principal without failing when unauthenticated:

```typescript
app.get('/public', handler, {
  middleware: [authenticate({ required: false })],
});
```

If unauthenticated, `ctx.state.get('django-js:auth').identity` returns an `AnonymousIdentity` (`isAuthenticated: false`).
