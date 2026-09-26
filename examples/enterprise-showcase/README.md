# JSango Enterprise Showcase

> A complete, production-grade reference application demonstrating the full capabilities of the **JSango** framework, including ORM Models, Relationships, High-Performance HTTP Routing, Middleware, In-Memory Caching, Background Job Queues, Event Bus, and the **JSango Admin Console**.

---

## 🌟 Included Features & Subsystems

1. **ORM & Data Layer (`@jsango/orm`, `@jsango/database`)**:
   - Declarative models (`User`, `Product`, `Order`) with typed fields (`uuid`, `string`, `number`, `boolean`, `dateTime`).
   - Query builder with filtering, ordering, pagination, batch mutations, and atomic transactions.
2. **High-Performance HTTP Router & Middleware (`@jsango/router`, `@jsango/middleware`, `@jsango/http`)**:
   - Runtime-independent `HttpRequest` and `HttpResponse` lifecycle state machine.
   - Built-in CORS, security headers, correlation IDs, and global structured error handling.
3. **Caching Subsystem (`@jsango/cache`)**:
   - In-memory cache store with stampede protection (`remember()`) caching catalog products for high throughput.
   - Transparent cache invalidation when mutations occur.
4. **Background Queue & Workers (`@jsango/queue`)**:
   - Background job dispatching for asynchronous transactional emails and order fulfillment.
   - Automatic retry policies, exponential backoff, and execution metrics.
5. **Typed Application Events (`@jsango/events`)**:
   - Decoupled event publication (`order.created`) with strongly typed payloads.
6. **Enterprise Admin Platform (`@jsango/admin-core`, `@jsango/admin-server`, `@jsango/admin-ui`)**:
   - **Backend Admin REST API** mounted at `/api/admin` with full schema introspection, resource CRUD, pagination, filtering, search, and audit logs.
   - **Interactive Frontend Admin Console** delivered at `/admin`, featuring a modern dark-mode UI, platform overview dashboard, live metrics, resource tables, modal dialogs, and mutation tracking.

---

## 🚀 Getting Started

### 1. Run the Application

From the repository root:

```bash
# Start the example application
pnpm --filter example-enterprise-showcase dev
```

The application will boot on `http://127.0.0.1:3000`.

### 2. Available Endpoints

| URL                                             | Description                               |
| :---------------------------------------------- | :---------------------------------------- |
| `http://127.0.0.1:3000/admin`                   | **JSango Admin Console** (Interactive UI) |
| `http://127.0.0.1:3000/api/products`            | Public REST API: Active Catalog Products  |
| `http://127.0.0.1:3000/api/orders`              | Public REST API: Order Placement (POST)   |
| `http://127.0.0.1:3000/api/health`              | System Diagnostics & Runtime Telemetry    |
| `http://127.0.0.1:3000/api/admin/resources`     | Admin REST API: Registered Resources      |
| `http://127.0.0.1:3000/api/admin/system/health` | Admin REST API: Subsystem Diagnostics     |

---

## 🛡️ Admin Panel

The Admin Console provides immediate management of all database models without writing custom dashboard views.

### Default Demonstration User:

- **Email**: `admin@jsango.dev`
- **Role**: `admin` (Superuser & Staff status)
- **Permissions**: Full system access (`admin.*`)

### Features Available in Admin:

- **Platform Overview**: Real-time summary cards for revenue, total products, processed orders, and registered accounts.
- **Resource Management**: Full tabular views for `Products`, `Orders`, and `Users` with pagination and live search.
- **Record Operations**: Create new products, update existing records, and delete items.
- **Bulk Actions**: Batch activate/deactivate products or update order fulfillment states.
- **Audit Logs**: Comprehensive audit trail of administrative modifications.
- **System Health**: Telemetry, memory consumption, and runtime status.

---

## 🧪 Running Tests

To run the automated integration tests for this showcase:

```bash
pnpm --filter example-enterprise-showcase test
```
