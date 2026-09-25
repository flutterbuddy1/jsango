# Enterprise Admin UI Architecture & Guide

`@jsango/admin-ui` is the frontend administration console foundation for the `jsango` (JSango) framework. It connects directly to `@jsango/admin-server` and `@jsango/admin-core`, providing a fully metadata-driven interface for resource management, system observability, audit history, and administrative operations.

---

## 1. Architectural Principles

1. **Backend as Source of Truth**: The Admin UI never defines schema or permission boundaries on the client. All fields, relations, validation rules, searchable columns, and actions are discovered via `/admin/api/v1/resources/:resourceId/schema`.
2. **Zero Hardcoded Resource Views**: Rather than creating individual `UsersView.tsx` or `OrdersView.tsx`, the UI uses generic, metadata-driven `ResourceListView`, `ResourceDetailView`, and `ResourceForm` renderers.
3. **Strict Layering & Isolation**:
   ```text
   Admin HTTP API (/admin/api/v1/*)
         ↓
   AdminApiClient (Typed Fetch + Token Auth)
         ↓
   QueryClient (Caching, Invalidation, Stale-Time, Deduplication)
         ↓
   Resource Metadata & Schemas
         ↓
   UI Components (DataTable, Form, Shell, Modals)
         ↓
   Views (Dashboard, ResourceList, Detail, Audit, Health)
         ↓
   AdminApp (SPA State & Layout Shell)
   ```
4. **Information Density over Decoration**: Designed for daily administrative work by operators and engineers—compact tables, visible status badges, keyboard navigation, and fast command palettes.

---

## 2. Package Structure

- **`@jsango/admin-ui/client`**: Typed HTTP client (`AdminApiClient`), error types (`AdminApiError`), and API response contracts.
- **`@jsango/admin-ui/query`**: In-memory query caching, stale-while-revalidate, and mutation invalidation engine (`QueryClient`).
- **`@jsango/admin-ui/theme`**: Semantic design tokens, light/dark/system mode manager (`ThemeManager`).
- **`@jsango/admin-ui/auth`**: Client-side authentication and role/permission evaluation (`AdminAuthManager`).
- **`@jsango/admin-ui/notifications`**: Toast notification dispatcher (`ToastManager`).
- **`@jsango/admin-ui/components`**:
  - `ui/`: Buttons, badges, inputs, skeletons, alerts, diff viewer, JSON viewer.
  - `data-table/`: Data table with sorting, search, filtering, pagination, and bulk actions.
  - `forms/`: Form field renderers, validation error mapping, create/edit forms.
  - `layout/`: Sidebar, top bar, breadcrumbs, page header, responsive master shell.
  - `modals/`: Confirmation dialogs, delete modals, `Cmd+K` command palette.
  - `views/`: Dashboard, Resource list, Resource detail, Create, Edit, Audit logs, System health, Login.
- **`@jsango/admin-ui/plugins`**: Custom widget, custom field renderer, and custom page registry (`AdminUiPluginRegistry`).

---

## 3. Core Capabilities

### 3.1 Metadata-Driven Resource System

Any ORM model or explicit `AdminResource` registered on the backend is automatically discovered:

- **List View**: Paginated server-side data table with sortable columns, active filter chips, search input, and multi-row selection.
- **Detail View**: Formatted card displaying all fields, raw JSON viewers, timestamps, and relational identifiers.
- **Create & Edit Forms**: Generated dynamically from `createFields` and `editFields` with server validation error mapping.
- **Row & Bulk Actions**: Custom business actions and bulk mutations with confirmation modals.
- **Soft Delete Support**: Visual indicators and dedicated restore actions for soft-deleted entities.

### 3.2 Command Palette (`Cmd+K` / `Ctrl+K`)

Instant search across:

- All registered resources and model tables.
- System operational tools (Audit Logs, System Health).
- Theme toggles (Light, Dark, System).

### 3.3 Audit Trail & Diff Viewer

Provides an audit log timeline capturing actor, action, timestamp, and IP address. The built-in `DiffViewer` highlights added properties in green, removed properties in red with strikethrough, and modified properties with before-and-after values.

### 3.4 System Health & Diagnostics

Monitors:

- Overall framework status (healthy / degraded / unhealthy).
- Runtime process uptime and Node environment.
- Resident memory, heap allocation, and garbage collection metrics.
- Subsystem health checks (Database, Cache, Queue).

### 3.5 Theming & Dark Mode

Built with CSS variables and semantic design tokens:

- High-contrast Light Mode.
- Dark Mode optimized for low-light enterprise monitoring.
- System mode adhering to `prefers-color-scheme`.

---

## 4. Quick Start & Integration

```typescript
import { AdminApp, AdminApiClient } from '@jsango/admin-ui';

// 1. Initialize Typed API Client
const client = new AdminApiClient({
  baseUrl: '/admin/api/v1',
  getAuthToken: () => localStorage.getItem('token'),
  onUnauthorized: () => {
    window.location.href = '/admin/login';
  },
});

// 2. Initialize Admin Application
const app = new AdminApp({
  client,
  config: {
    title: 'Enterprise Management Console',
    defaultTheme: 'system',
    enableCommandPalette: true,
  },
});

// 3. Set Active Route & Render Shell
app.setRoute({ name: 'resource-list', resourceId: 'users' });
const html = await app.render();
```

---

## 5. Security & Authorization Guarantees

- **The UI is Never the Security Boundary**: Every read, write, delete, and custom action executes through `@jsango/admin-server`, which enforces `@jsango/admin-auth` permissions server-side.
- **Redaction by Default**: Sensitive fields (e.g., passwords, tokens) are excluded or masked by the server before reaching the UI.
- **No Direct Database Access**: The Admin UI interacts exclusively via structured REST endpoints.
