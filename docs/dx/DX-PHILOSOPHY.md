# JSango Developer Experience (DX) Philosophy

## Core Tenet: "Powerful Internally, Simple Externally"

JSango is architected as a modular, production-grade backend framework. Underneath the hood, it features rigorous dependency injection, query AST abstraction, decoupled transport layers, backpressure-managed WebSockets, enterprise auth security, and lifecycle management.

However, **internal complexity must never translate into user complexity**.

---

## 1. Principles

### 1.1 One Obvious Entry Point
Application developers should only ever need:
```typescript
import { createApp, model, fields, validate, schema, string, events, jobs, cache } from "jsango";
```
Internal packages (`@jsango/http`, `@jsango/router`, `@jsango/orm`, `@jsango/websocket`, etc.) remain fully accessible for advanced users, custom engines, and plugins, but are completely abstracted away for day-to-day application development.

### 1.2 Zero-Config Boilerplate & Sensible Defaults
- Common application bootstrap should take fewer than 10 lines of code.
- Routes accept variadic middleware, eliminating manual array construction.
- Handlers automatically serialize JSON, strings, buffers, and streams.
- HTTP server, router, request IDs, JSON parsing, error boundaries, and logging are configured automatically with opt-out capabilities.

### 1.3 Progressive Disclosure
Simple use-cases look simple:
```typescript
app.get("/users", async () => {
  return User.all();
});
```
When advanced control is required, lower-level primitives are immediately accessible without breaking existing code:
```typescript
app.get("/users", async (ctx) => {
  ctx.response.setHeader("X-Custom-Header", "Value");
  return ctx.response.json({ data: await User.all() }, 200);
});
```

### 1.4 Define Once, Use Everywhere
Model and validation definitions power ORM queries, database migrations, route payload validation, OpenAPI schema generation, and Admin UI auto-discovery without schema duplication.

### 1.5 Secure by Default
Simplicity never compromises security:
- Automatic SQL injection protection via parameterized query compilation.
- Input validation with strict type assertions.
- Secure HTTP headers and cookie handling.
- Automatic password hashing and JWT/session management.
- Sanitized error responses in production (preventing stack trace leakage).

---

## 2. API Ergonomics Summary

| Domain | Facade API | Internal Architecture |
|---|---|---|
| **App Bootstrap** | `const app = createApp()` | Inversion of Control Container, Router Engine, Node HTTP Server, Request Pipeline |
| **HTTP Routing** | `app.get(path, ...middleware, handler)` | Trie-based Route Matcher, Middleware Registry, Execution Chain |
| **WebSockets** | `app.ws(path, (socket) => { ... })` | WebSocket Server, Heartbeat Monitor, Connection Registry, Room Manager |
| **ORM & Queries** | `User.all()`, `User.where(...).get()` | Query AST, Dialect SQL Compilers, Connection Pool, Hydrator |
| **Validation** | `validate({ body: schema(...) })` | Schema Validator, Field Formatters, Constraint Engine |
| **Events** | `events.emit(event, data)` | Async Event Bus, Listener Registry, Error Isolation |
| **Background Jobs**| `jobs.dispatch(name, data)` | Queue Store, Concurrency Worker, Exponential Retry Engine |
| **Cache** | `cache.remember(key, ttl, fn)` | Cache Store Abstraction, Eviction Manager, Multi-driver Support |
| **Admin UI** | `app.admin({ resources: [User] })` | Admin Registry, Query Adapter, CRUD Controller, Schema Introspector |
| **OpenAPI** | `app.openapi()` | OpenAPI 3.1 Spec Generator, Route Metadata Introspector |
