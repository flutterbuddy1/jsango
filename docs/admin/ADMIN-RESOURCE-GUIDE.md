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
| `'textarea'` | Multi-line Textarea       | `required`, `label`, `description`        |
| `'number'`   | Numeric Input (int/float) | `required`, `sortable`, `filterable`      |
| `'email'`    | Email Input               | Validates email syntax                    |
| `'boolean'`  | Checkbox / Switch         | Rendered with Yes/No badges in changelist |
| `'enum'`     | Select Dropdown           | `enumChoices: [{ label, value }]`         |
| `'datetime'` | Datetime Display / Picker | Formats timestamps gracefully             |
| `'uuid'`     | Readonly identifier       | Automatically generated                   |

Other types: `'date'`, `'time'`, `'url'`, `'json'`, `'password'`, `'file'`, `'image'`, `'relation'` (with `relationTarget` / `relationType`), `'computed'` (with `computedGetter`) and `'readonly'`. Every field also accepts `readonly`, `hidden`, `sensitive`, `sortable`, `searchable`, `filterable` and `widget`.

---

## 4. Registering in the Admin Registry & Query Adapter

The simplest path is `app.admin({ resources: [PageResource] })` from `jsango`, which builds the registry, an ORM-backed query adapter (column selection, keyset-streamed CSV export, one-query bulk delete) and the Admin API for you. See the [admin panel guide](./ADMIN-CUSTOMIZATION.md). For a manual setup, register resources on an `AdminRegistry` and implement `IAdminQueryAdapter` to bridge the ORM with the Admin CRUD layer:

```typescript
// src/admin/index.ts
import { AdminRegistry } from '@jsango/admin-core';
import { AdminServer, type IAdminQueryAdapter } from '@jsango/admin-server';
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';
import { defaultModelRegistry } from '@jsango/orm';
import { Router } from '@jsango/router';
import { PageResource } from './pages-resource.js';
// ... other resources

export function createAdminRegistry(): AdminRegistry {
  const registry = new AdminRegistry();
  registry.register(PageResource);
  // register other resources...
  return registry;
}

function modelFor(name: string) {
  const modelClass = defaultModelRegistry.getModel(name);
  if (!modelClass) throw new Error(`Model ${name} is not registered`);
  return modelClass;
}

export function createOrmAdminQueryAdapter(): IAdminQueryAdapter {
  return {
    // `query` arrives validated: sort/filter fields are allow-listed and pageSize is capped.
    async list({
      modelName,
      query,
      searchFields,
      primaryKey,
      defaultSortField,
      defaultSortDirection,
      pageSize,
    }) {
      let q = modelFor(modelName).query();
      const search = query.search;
      if (search && searchFields.length > 0) {
        // Group the ORs so they can't escape the filters below.
        q = q.where((g) => searchFields.reduce((acc, f) => acc.orWhereLike(f, `%${search}%`), g));
      }
      for (const [field, value] of Object.entries(query.filters ?? {})) q = q.where(field, value);
      const dir = (query.sortDirection ?? defaultSortDirection) === 'desc' ? 'DESC' : 'ASC';
      q = q.orderBy(query.sort ?? defaultSortField, dir).orderBy(primaryKey, 'ASC');
      const result = await q.paginate({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? pageSize,
      });
      return { ...result, items: result.items.map((item) => item.toJSON()) };
    },
    async findById({ modelName, id }) {
      const item = await modelFor(modelName).find(id);
      return item ? item.toJSON() : null;
    },
    async create({ modelName, data }) {
      return (await modelFor(modelName).create(data)).toJSON();
    },
    async update({ modelName, id, data }) {
      const item = await modelFor(modelName).findOrFail(id);
      for (const [key, value] of Object.entries(data)) item.set(key, value);
      return (await item.save()).toJSON();
    },
    async delete({ modelName, id, soft }) {
      const item = await modelFor(modelName).find(id);
      if (item) await item.delete({ force: !soft });
    },
  };
}

// Mount the Admin REST API
const router = new Router();
new AdminServer({
  registry: createAdminRegistry(),
  queryAdapter: createOrmAdminQueryAdapter(),
  permissions: new AdminPermissionChecker(),
  audit: new AdminAuditLogger({ store: new InMemoryAuditStore() }),
  prefix: '/admin/api/v1',
}).mount(router);
```

---

## 5. Mounting the Chakra UI Admin Console

Mount the single-page application directly on your HTTP router:

```typescript
import { Router } from '@jsango/router';
import { createAdminUiHandler } from '@jsango/admin-ui';

const router = new Router();

// Mounts Chakra UI v3 Admin Console with full mobile & desktop responsiveness
router.get(
  '/admin',
  createAdminUiHandler({
    title: 'JSango Enterprise Admin',
    brandSubtitle: 'Management Console',
    apiBasePath: '/admin/api/v1', // where AdminServer is mounted
    defaultTheme: 'dark',
  })
);
```
