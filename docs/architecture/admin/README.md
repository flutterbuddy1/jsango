# @jsango Admin Platform Architecture Overview

## 1. Core Mission & Philosophy

The JSango (`jsango`) Admin Platform provides a production-grade, model-driven, convention-over-configuration administration interface for TypeScript backends.

Key design principles:

- **Model-Driven Foundation**: Admin resources are generated automatically from `@jsango/orm` model metadata with sensible, robust defaults.
- **Explicit Customization**: Every automatic aspect (list fields, search fields, filters, forms, actions, permissions) can be explicitly overridden without rewriting boilerplate.
- **Secure by Default (API as Security Boundary)**: The Admin UI is never trusted. All access control, field visibility, mass-assignment protection, and mutation policies are strictly enforced in the server layer.
- **Decoupled Package Architecture**: Admin is cleanly partitioned into 5 focused packages following the dependency inversion principle.
- **Immutable Audit Trail**: All administrative create, update, delete, restore, and custom action operations produce structured audit entries with sensitive field redaction.
- **Pluggable Media Storage**: Validated file upload and storage management with configurable MIME, size, and extension validation before I/O.

---

## 2. Package Architecture & Layering

```
@jsango/admin-core
  ├── Resource definition & schema metadata
  ├── Field definitions & widgets
  ├── Filter, table, form, dashboard, page abstractions
  ├── Model-driven auto-generator (ModelMetadata → AdminResource)
  └── AdminRegistry

@jsango/admin-auth
  └── AdminPermissionChecker (RBAC, superuser, row-level, field-level auth)

@jsango/admin-audit
  ├── AdminAuditLogger (structured logging, diff changes, sensitive redaction)
  ├── IAuditStore contract
  └── InMemoryAuditStore

@jsango/admin-media
  ├── AdminMediaManager (validation before I/O)
  ├── IMediaStorage contract
  └── InMemoryMediaStorage

@jsango/admin-server
  ├── IAdminQueryAdapter (database/ORM abstraction)
  ├── AdminCrudService (business logic, permission checks, audit emission)
  ├── AdminServer (HTTP route registration onto IRouter)
  └── HTTP helpers & error translators
```

---

## 3. Key Packages & Components

### 3.1 `@jsango/admin-core`

Core resource abstractions:

- `AdminResource`: Central class defining how an ORM model is administered. Configures `listFields`, `detailFields`, `createFields`, `editFields`, `searchFields`, `filters`, `actions`, `bulkActions`, and pagination.
- `AdminResourceAutoGenerator`: Inspects `ModelMetadata` from `@jsango/orm` and generates complete `AdminResource` instances with default searchable fields, list displays, and editable fields.
- `AdminRegistry`: Central singleton/scoped registry for registering and looking up resources and custom dashboard pages.
- Field types: `textField()`, `numberField()`, `booleanField()`, `dateField()`, `emailField()`, `passwordField()`, `jsonField()`, `uuidField()`, etc.

### 3.2 `@jsango/admin-auth`

Security and permission checking:

- `AdminPermissionChecker`: Enforces granular access control at every layer.
- **Admin Access**: Verifies if an identity is authenticated, is a superuser, or has the designated staff role or `admin.access` permission.
- **Resource Actions**: Checks `canViewResource`, `canCreate`, `canUpdate`, `canDelete`, `canRestore`.
- **Field-Level Permissions**: Checks `canViewField` and `canEditField`, hiding sensitive fields (passwords, tokens) from non-superusers unless explicitly granted.
- **Custom Actions**: Validates row and bulk action execution rights.

### 3.3 `@jsango/admin-audit`

Audit trail logging:

- `AdminAuditLogger`: Non-blocking, fire-and-forget audit entry recorder.
- `diffChanges(before, after)`: Automatically computes changed fields and redacts sensitive keys matching regex `/password|secret|token|key|hash|salt|credential/i`.
- `IAuditStore`: Persistence contract for storing, querying, and paginating audit entries by resource, action, actor, or date range.

### 3.4 `@jsango/admin-media`

Media management:

- `AdminMediaManager`: Validates uploads against `maxSizeBytes`, `allowedMimeTypes`, and `allowedExtensions` before performing any storage I/O.
- `IMediaStorage`: Storage abstraction supporting `store()`, `get()`, `delete()`, and signed/public `url()` generation.

### 3.5 `@jsango/admin-server`

REST API & Controller layer:

- `AdminCrudService`: Orchestrates CRUD operations with permission checks, mass-assignment sanitization, field-level filtering, and audit logging.
- `AdminServer`: Mounts RESTful endpoints onto any `IRouter`:
  - `GET    /admin/api/v1/resources`
  - `GET    /admin/api/v1/resources/:resourceId/schema`
  - `GET    /admin/api/v1/resources/:resourceId`
  - `POST   /admin/api/v1/resources/:resourceId`
  - `GET    /admin/api/v1/resources/:resourceId/:id`
  - `PATCH  /admin/api/v1/resources/:resourceId/:id`
  - `DELETE /admin/api/v1/resources/:resourceId/:id`
  - `POST   /admin/api/v1/resources/:resourceId/:id/restore`
  - `POST   /admin/api/v1/resources/:resourceId/:id/actions/:actionId`
  - `POST   /admin/api/v1/resources/:resourceId/bulk/:actionId`
  - `GET    /admin/api/v1/audit`

---

## 4. Security Model

1. **Server-Enforced Access**: Every HTTP handler authenticates the incoming `Identity` and evaluates permissions through `AdminPermissionChecker`.
2. **Mass-Assignment Protection**: When creating or updating items, input data is sanitized to only include fields declared in `createFields` or `editFields`.
3. **Field Redaction**: For `list` and `detail` views, fields that the actor lacks permission to view are stripped before serialization.
4. **Audit Immutability**: All mutations record an immutable audit entry with actor snapshot and timestamp.
5. **Safe Error Serialization**: Internal errors and stack traces are suppressed in HTTP responses; standard error codes and safe messages are returned.
