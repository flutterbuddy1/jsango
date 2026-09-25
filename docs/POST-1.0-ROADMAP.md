# django-js Post-1.0 Roadmap

With the completion and freezing of the **1.0.0 Stable Release**, future enhancements will proceed under normal Semantic Versioning minor/patch releases (`1.1.0`, `1.2.0`, etc.).

---

## Post-1.0 Milestone Initiatives

### 1. Multi-Runtime Platform Adapters

- Dedicated Bun platform adapter (`@django-js/runtime-bun`) utilizing Bun's native HTTP and WebSocket primitives.
- Deno runtime adapter evaluation (`@django-js/runtime-deno`).

### 2. Distributed Infrastructure Drivers

- Production Redis cache & pub/sub driver (`@django-js/cache-redis`).
- Distributed Redis queue driver (`@django-js/queue-redis`) with BullMQ-compatible leasing semantics.
- PostgreSQL LISTEN/NOTIFY and Kafka event stream adapters.

### 3. Additional Database Adapters

- Dedicated MySQL driver and dialect compiler (`@django-js/database-mysql`).
- Native Microsoft SQL Server driver adapter.

### 4. Admin UI Enhancements

- Pre-compiled React / Web Component Admin UI SPA bundle.
- Advanced analytics dashboards and live chart widgets.

### 5. OpenTelemetry Native Exporters

- Native OTLP gRPC/HTTP metric and trace span exporters.
