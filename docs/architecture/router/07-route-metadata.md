# Route Metadata

## Purpose

Route metadata provides a non-intrusive mechanism to attach arbitrary context to routes. This metadata is extracted at match time and returned in `RouteMatch.metadata`.

## Typical Use Cases

- **Authentication & Authorization**: Specifying required scopes, roles, or public bypass flags (`{ isPublic: true }`, `{ role: 'admin' }`).
- **Rate Limiting**: Custom per-route quotas (`{ rateLimit: { points: 10, duration: 60 } }`).
- **Telemetry & Monitoring**: Custom operation names or metrics tags (`{ operation: 'checkout' }`).
- **Documentation & OpenAPI**: Route descriptions, tags, and summary markers.

## Immutable Metadata Contracts

Metadata objects attached to `Route` instances are deeply copied and frozen upon route compilation (`Object.freeze`). Handlers and downstream middleware can safely inspect metadata without risk of mutating the route definition.
