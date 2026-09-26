# JSango Admin UI Customization & Security Guide

This guide covers complete customization of the `@jsango/admin-ui` dashboard, including branding, theme overrides, custom navigation groups, custom widgets, authentication and profile management, two-factor authentication (2FA / TOTP), and active session revocation.

---

## 1. Top-Level Admin Customization Options

When registering the admin SPA in your JSango HTTP router via `createAdminUiHandler(options)`, you can configure global branding, title, subtitle, site link, and default theme.

```typescript
import { createAdminUiHandler } from '@jsango/admin-ui';

// In your application route setup (e.g., src/app.ts or routes/admin.ts):
router.get('/admin', createAdminUiHandler({
  title: 'Acme Corp Admin Portal',           // Top-left branding title
  brandSubtitle: 'JSango Enterprise Platform', // Subtitle underneath title
  siteUrl: 'https://acme.example.com',       // "View Site" external link
  apiBasePath: '/admin/api/v1',              // Admin API endpoint root
  defaultTheme: 'dark',                      // 'dark' | 'light' | 'system'
  enableCommandPalette: true,                // Enables ⌘K / Ctrl+K quick navigator
  enableTwoFactor: true,                     // Enables 2FA / TOTP profile section
}));
```

### Configuration Property Reference

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `'JSango Administration'` | Main brand title in topbar and browser page title |
| `brandSubtitle` | `string` | `'Enterprise Admin Control'` | Small sub-text under the brand title |
| `siteUrl` | `string` | `'/'` | URL linked by the "View Site" header button |
| `apiBasePath` | `string` | `'/admin/api/v1'` | Prefix path where `@jsango/admin-server` is mounted |
| `defaultTheme` | `'light' \| 'dark' \| 'system'` | `'dark'` | Initial color mode before user toggle |
| `enableCommandPalette` | `boolean` | `true` | Keyboard shortcut `⌘K` or `Ctrl+K` for instant search |

---

## 2. Theme & Design Token Overrides

The Admin UI is styled using **Chakra UI v3** semantic design tokens and CSS custom properties. You can customize the look and feel by injecting custom CSS overrides or configuring your brand palette:

```css
/* Custom Admin Theme Overrides (e.g. in your public/admin-theme.css or custom head injection) */
:root {
  /* Brand Primary Colors */
  --chakra-colors-brand-solid: #0d9488;
  --chakra-colors-brand-solid-hover: #0f766e;
  --chakra-colors-brand-fg: #14b8a6;
  --chakra-colors-brand-subtle: #f0fdfa;

  /* Typography */
  --chakra-fonts-heading: 'Plus Jakarta Sans', system-ui, sans-serif;
  --chakra-fonts-body: 'Plus Jakarta Sans', system-ui, sans-serif;
  --chakra-fonts-mono: 'JetBrains Mono', monospace;

  /* Layout Widths */
  --admin-sidebar-width: 260px;
}

[data-theme="dark"] {
  --chakra-colors-brand-subtle: rgba(13, 148, 136, 0.15);
  --chakra-colors-bg-default: #090d16;
  --chakra-colors-bg-card: #0f172a;
}
```

---

## 3. Resource Customization & Navigation Groups

Resources can be customized using `AdminResourceConfig` to organize them into groups, configure icons, specify fields, list displays, search fields, and bulk actions.

### 3.1 Customizing Navigation Icon and Group

```typescript
import { AdminResourceConfig } from '@jsango/admin-core';

export const ProductResource: AdminResourceConfig = {
  id: 'products',
  label: 'Product',
  pluralLabel: 'Products',
  
  // Sidebar Grouping & Lucide Icon
  navigationGroup: 'E-Commerce & Catalog',
  navigationIcon: 'shopping-bag', // Any Lucide icon name: package, users, file-text, layers, etc.
  
  // List View Configuration
  listDisplay: ['id', 'title', 'sku', 'price', 'status', 'createdAt'],
  searchFields: ['title', 'sku', 'description'],
  listFilter: ['status', 'category'],
  listPerPage: 25,
  ordering: [{ field: 'createdAt', direction: 'desc' }],
  
  // Field-level widget customizations
  fields: [
    { name: 'title', label: 'Product Title', type: 'string', required: true },
    { name: 'sku', label: 'SKU Code', type: 'string', helpText: 'Unique inventory barcode' },
    { name: 'price', label: 'Unit Price ($)', type: 'number', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    {
      name: 'status',
      label: 'Publish Status',
      type: 'enum',
      choices: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'archived', label: 'Archived' },
      ],
    },
  ],
};
```

---

## 4. Authentication, Profile & 2FA Management

The Admin UI includes a built-in **Profile & Security** center accessible from:
1. The sidebar navigation under **Platform → Profile & Security** (`#profile`).
2. The user avatar badge in the top right header.

### 4.1 Features in Profile & Security

1. **Administrator Identity**: Displays superuser/staff roles, email, avatar, and account timestamps.
2. **Interactive Password Change**:
   - Current password validation.
   - Live 4-tier password strength meter (Weak, Fair, Good, Strong) with real-time feedback.
   - Confirm password verification.
3. **Two-Factor Authentication (2FA / TOTP)**:
   - One-click TOTP activation modal.
   - Live QR Code visual representation for Google Authenticator / Authy / 1Password.
   - Secret key copy button.
   - 6-digit TOTP verification code input.
   - Recovery backup emergency codes generation with one-click clipboard copy.
4. **Active Sessions & Device Management**:
   - Lists active browser sessions with browser type, IP address, location, and activity timestamps.
   - Current session badge (`This Session`).
   - One-click "Log Out Other Sessions" button to revoke compromised admin sessions.

---

## 5. Generating Resources with the CLI

You can scaffold new admin resources and ORM models directly using the `jsango` CLI:

```bash
# Generate an Admin Resource for an existing model
npx jsango make:admin Product --group="Catalog" --icon="shopping-bag"

# Generate both the ORM Model and the Admin Resource
npx jsango make:admin BlogPost --group="Content" --icon="file-text" --with-model

# Custom output directory
npx jsango make:admin Order --output="./src/admin/resources"
```

The CLI automatically generates:
- Typed TypeScript resource definition with full `AdminResourceConfig` schema.
- Automatic fields, `listDisplay`, `searchFields`, `listFilter`, and batch export action.
- Ready to register directly into your `createAdminRegistry()` and `createOrmAdminQueryAdapter()`.

---

## 6. Full Integration Example

```typescript
import { createAdminRegistry } from '@jsango/admin-core';
import { createOrmAdminQueryAdapter } from '@jsango/admin-orm';
import { createAdminUiHandler } from '@jsango/admin-ui';
import { ProductResource } from './admin/product-resource.js';
import { PageResource } from './admin/pages-resource.js';

// 1. Register resources
const adminRegistry = createAdminRegistry();
adminRegistry.register(ProductResource);
adminRegistry.register(PageResource);

// 2. Setup ORM Adapter
const queryAdapter = createOrmAdminQueryAdapter({
  resources: [ProductResource, PageResource],
});

// 3. Mount Admin UI Handler
router.get('/admin', createAdminUiHandler({
  title: 'Acme Super Admin',
  brandSubtitle: 'Production Cluster',
  siteUrl: '/',
  defaultTheme: 'dark',
}));
```
