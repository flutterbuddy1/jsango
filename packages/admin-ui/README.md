# @jsango/admin-ui

Enterprise-grade, Chakra UI v3-styled frontend Admin UI foundation for the `jsango` (JSango) framework.

## Features

- **Chakra UI v3 Design System**: Semantic color tokens (`bg.canvas`, `bg.panel`, `bg.subtle`, `border.subtle`, `brand.solid`), glassmorphism cards, and Lucide vector icons.
- **100% Mobile-Friendly & Responsive**: Responsive topbar, collapsible slide-over hamburger drawer, touch-optimized horizontal scroll tables, and mobile bottom sheet filters.
- **Metadata-Driven Django Architecture**: Consumes `@jsango/admin-core` & `@jsango/admin-server` schemas without hardcoding model views.
- **Full Django Admin Capabilities**:
  - **App Index & Dashboard**: Grouped model categories with "+ Add" & "Change" links, live stat cards, and recent actions timeline.
  - **Changelist**: Search bar, facet filter drawer (`list_filter`), column sorting (`ordering`), pagination, bulk actions, and CSV export.
  - **Changeform**: Typed inputs (text, number, email, textarea, enums, booleans), field validation, and sticky bottom actions bar (`Save`, `Save and continue editing`, `Save and add another`, `Delete`).
  - **Item-Level History**: Change history modal tracking past mutations with timestamps and actor details.
- **Fast Command Palette (`Cmd+K` / `Ctrl+K`)**: Instant keyboard navigation across all models and tools.
- **Light & Dark Mode**: Seamless toggle with system color scheme preference.

## Mounting the Admin Single-Page App (SPA)

In your JSango application router:

```typescript
import { createAdminUiHandler } from '@jsango/admin-ui';

// Mount the Chakra UI Admin Console
const adminHandler = createAdminUiHandler({
  title: 'JSango Enterprise Admin',
  brandSubtitle: 'Management Console',
  apiPrefix: '/api/admin',
  defaultTheme: 'dark',
  siteUrl: '/',
});

router.get('/admin', adminHandler);
```

## CLI Resource Scaffolding

To quickly generate a new typed `AdminResource` and corresponding ORM model:

```bash
# Basic usage
npx jsango make:admin <ModelName>

# With custom navigation group and Lucide icon
npx jsango make:admin Article --group "Blog Management" --icon "newspaper"
```

## Programmatic / Isomorphic Component API

```typescript
import { AdminApp, AdminApiClient, ThemeManager } from '@jsango/admin-ui';

const client = new AdminApiClient({
  baseUrl: '/api/admin',
});

const app = new AdminApp({
  client,
  config: {
    title: 'Acme Admin Console',
    defaultTheme: 'dark',
  },
});

const html = await app.render();
```
