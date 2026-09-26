# JSango Admin Resource & Code Generation Guide

This guide explains how to define, scaffold, and customize Admin Resources in the JSango framework using `@jsango/admin-core`, `@jsango/admin-ui`, and `@jsango/cli`.

---

## 1. Quick Start with CLI Scaffolding

The fastest way to add a new model and its Admin interface is using the JSango CLI:

```bash
npx jsango make:admin <ModelName> [options]
```

### Examples:

```bash
# Generate 'Article' resource + ORM model
npx jsango make:admin Article

# Generate with custom group and icon
npx jsango make:admin Coupon --group "Promotions & Discounts" --icon "tag"

# Generate with custom output directory
npx jsango make:admin ProductReview --group "Catalog" --output "src/admin"
```

### CLI Options:

| Flag           | Short | Default                | Description                                        |
| -------------- | ----- | ---------------------- | -------------------------------------------------- |
| `--group`      | `-g`  | `'Content Management'` | Category group in the admin sidebar                |
| `--icon`       | `-i`  | `'file-text'`          | [Lucide Icon](https://lucide.dev/icons) name       |
| `--output`     | `-o`  | `'src/admin'`          | Target folder for resource file                    |
| `--with-model` | `-m`  | `true`                 | Generate ORM model in `src/models` if not existing |

---

## 2. Defining an Admin Resource Manually

An `AdminResource` configures how an ORM model is presented, filtered, searched, and mutated in the Admin UI.

```typescript
// src/admin/page-resource.ts
import { AdminResource } from '@jsango/admin-core';

export const PageResource = new AdminResource({
  id: 'pages',
  modelName: 'Page',
  label: 'Site Page',
  pluralLabel: 'Site Pages',
  navigationGroup: 'Content Management',
  navigationIcon: 'file-text',
  navigationOrder: 1,
  primaryKey: 'id',
  fields: [
    { name: 'id', type: 'uuid', readonly: true },
    { name: 'title', type: 'text', required: true, label: 'Page Title', searchable: true },
    { name: 'slug', type: 'text', required: true, label: 'URL Slug' },
    { name: 'description', type: 'textarea', label: 'Meta Description', searchable: true },
    { name: 'content', type: 'textarea', required: true, label: 'Page Content' },
    {
      name: 'status',
      type: 'enum',
      enumChoices: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    { name: 'isActive', type: 'boolean', label: 'Visible to Public' },
    { name: 'createdAt', type: 'datetime', readonly: true, label: 'Created At' },
  ],
  listFields: ['id', 'title', 'slug', 'status', 'isActive', 'createdAt'],
  searchFields: ['title', 'slug', 'description'],
  filters: [
    { name: 'status', type: 'enum', field: 'status' },
    { name: 'isActive', type: 'boolean', field: 'isActive' },
  ],
  bulkActions: [
    {
      id: 'bulk-publish',
      label: 'Publish Selected Pages',
      requiresConfirmation: true,
    },
    {
      id: 'bulk-archive',
      label: 'Archive Selected Pages',
      requiresConfirmation: true,
    },
  ],
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
});
```

---

## 3. Supported Field Types

| Field Type   | Form Widget               | Supported Options                         |
| ------------ | ------------------------- | ----------------------------------------- |
| `'text'`     | Single-line Text Input    | `required`, `searchable`, `label`         |
| `'textarea'` | Multi-line Textarea       | `rows`, `required`, `label`               |
| `'number'`   | Numeric Input (int/float) | `min`, `max`, `step`                      |
| `'email'`    | Email Input               | Validates email syntax                    |
| `'boolean'`  | Checkbox / Switch         | Rendered with Yes/No badges in changelist |
| `'enum'`     | Select Dropdown           | `enumChoices: [{ label, value }]`         |
| `'datetime'` | Datetime Display / Picker | Formats timestamps gracefully             |
| `'uuid'`     | Readonly identifier       | Automatically generated                   |

---

## 4. Registering in the Admin Registry & Query Adapter

After creating a resource, register it in your application's admin configuration:

```typescript
// src/admin/index.ts
import { AdminRegistry } from '@jsango/admin-core';
import type { IAdminQueryAdapter } from '@jsango/admin-server';
import { User, Product, Order, Page } from '../models/index.js';
import { PageResource } from './pages-resource.js';
// ... other resources

export function createAdminRegistry(): AdminRegistry {
  const registry = new AdminRegistry();
  registry.register(PageResource);
  // register other resources...
  return registry;
}

export function createOrmAdminQueryAdapter(): IAdminQueryAdapter {
  const models = {
    User,
    Product,
    Order,
    Page,
  };

  return {
    // Bridges JSango ORM query builder with Admin CRUD layer
    // ...
  };
}
```

---

## 5. Mounting the Chakra UI Admin Console

Mount the single-page application directly on your HTTP router:

```typescript
import { createAdminUiHandler } from '@jsango/admin-ui';

// Mounts Chakra UI v3 Admin Console with full mobile & desktop responsiveness
router.get(
  '/admin',
  createAdminUiHandler({
    title: 'JSango Enterprise Admin',
    brandSubtitle: 'Management Console',
    apiPrefix: '/api/admin',
    defaultTheme: 'dark',
  })
);
```
