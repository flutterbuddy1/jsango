# @jsango/admin-ui

Enterprise-grade frontend Admin UI foundation for the `jsango` (JSango) framework.

## Features

- **Metadata-Driven**: Consumes `@jsango/admin-core` & `@jsango/admin-server` schemas without hard-coding models.
- **Enterprise Design System**: High-contrast, themeable light/dark/system palettes, semantic design tokens, zero external CSS bloat.
- **Typed API & Query Layer**: `AdminApiClient` with token auth, retry logic, `QueryClient` cache with automatic invalidation.
- **Data Table Engine**: Multi-column sorting, row selection, metadata formatters, bulk actions, search and filters.
- **Form Engine**: Metadata-driven form generation supporting text, textarea, numbers, booleans, enums, dates, json, passwords, and validation error mapping.
- **Operations & System Views**: Realtime dashboard with metrics and activity feeds, audit log timeline with property diff viewers, and system health status.
- **Fast Navigation**: `Cmd+K` / `Ctrl+K` Command Palette, collapsible sidebar with navigation groups, responsive mobile drawer.

## Usage

```typescript
import { AdminApp, AdminApiClient } from '@jsango/admin-ui';

const client = new AdminApiClient({
  baseUrl: '/admin/api/v1',
  getAuthToken: () => localStorage.getItem('token'),
});

const app = new AdminApp({
  client,
  config: {
    title: 'Acme Admin Console',
    defaultTheme: 'system',
  },
});

const html = await app.render();
```
