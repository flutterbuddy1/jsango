# 01 — HTTP Architecture Overview

## Objective & Scope

The `@django-js/http` package forms the runtime-independent foundation for all HTTP interactions across the framework. It models HTTP abstractions (`HttpRequest`, `HttpResponse`, `HttpHeaders`, `Cookies`, `RequestContext`, `HttpServer`) without coupling to Node.js standard library specifics or higher-level concerns (routing, middleware, ORM, authentication).

---

## Architectural Flow

```
+------------------------------------------+
|          Native Host Transport           |
| (Node.js http.Server / Future Bun.serve) |
+------------------------------------------+
                    ↓
+------------------------------------------+
|          Runtime Adapter Layer           |
|   (Translates IncomingMessage to Request)|
+------------------------------------------+
                    ↓
+------------------------------------------+
|         django-js HTTP Layer             |
|   (HttpRequest, HttpResponse, Context)   |
+------------------------------------------+
                    ↓
+------------------------------------------+
|               Router / App               |
|      (Dispatches to Route Handlers)      |
+------------------------------------------+
```

---

## Core Characteristics

1. **Host Agnostic**: Works equally well on Node.js and Bun without changing application code.
2. **Safe By Default**: Prevents CRLF injection, header manipulation after commit, and unbounded body consumption.
3. **Zero Leaking Globals**: No reliance on `process.env` or host-specific request descriptors.
4. **Lifecycle Enforcement**: Strict response progression (`created` → `configured` → `committed` → `completed`).
