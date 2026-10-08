# Admin Panel Guide

`app.admin()` gives your app a Django-style admin: CRUD screens generated from your models,
dashboards and custom pages built from widgets, CSV export, an audit trail and a system page.
It is built for large tables (millions of rows) and is safe to expose in production.

- [1. Quick start](#1-quick-start)
- [2. Who can sign in](#2-who-can-sign-in)
- [3. Customizing a model's screens](#3-customizing-a-models-screens)
- [4. Dashboards](#4-dashboards)
- [5. Custom pages](#5-custom-pages)
- [6. Actions](#6-actions)
- [7. Millions of rows](#7-millions-of-rows)
- [8. Permissions](#8-permissions)
- [9. Audit trail, health checks and branding](#9-audit-trail-health-checks-and-branding)
- [10. Security](#10-security)
- [11. HTTP API](#11-http-api)

---

## 1. Quick start

```ts
import { createApp, createAuth } from 'jsango';
import { User, Order, Product } from './models/index.js';

const app = createApp();

app.admin({
  title: 'Shop Admin',
  auth: createAuth({
    secret: process.env.AUTH_SECRET!,
    users: {
      findById: (id) => User.find(id),
      findByLogin: (email) => User.where('email', email).first(),
    },
  }),
  resources: [User, Order, Product],
});

await app.listen(3000); // http://localhost:3000/admin
```

Every model gets a list screen (search, filters, sorting, paging, bulk delete, CSV export/import)
and a create/edit form. Field types, required fields, read-only fields (`id`, `createdAt`,
`updatedAt`) and secrets (`password`, `token`, ... are hidden) are taken from the model.

---

## 2. Who can sign in

**Your application's users (recommended).** Pass your `createAuth()` instance as `auth`.
Passwords, lockout after failed attempts, two-factor login and `isActive` come from your auth setup
([authentication guide](../auth/README.md)). A user can enter the admin when they have:

- `isSuperuser: true`, or
- the `admin` or `staff` role, or
- the `admin.access` permission.

Other users get `403`.

**A single built-in super admin** (small projects, internal tools):

```ts
app.admin({
  auth: { email: 'ops@example.com', password: process.env.ADMIN_PASSWORD },
  resources: [Order],
});
```

You can also set `JSANGO_ADMIN_EMAIL` and `JSANGO_ADMIN_PASSWORD`. Without a password, the
development default `admin123` works locally, and **login is refused when
`NODE_ENV=production`**.

Admin logins last 8 hours (`sessionTtlSeconds`). The **Profile & Security** page lists the account's
real sessions and can sign out other devices. For the built-in account it also changes the password
(the current password is required, 12+ characters) and turns two-factor authentication on or off.

---

## 3. Customizing a model's screens

Pass `{ model, ...options }`. Anything you don't set still comes from the model, so you only write
what you want to change:

```ts
app.admin({
  resources: [
    {
      model: Order,
      label: 'Order',
      navigationGroup: 'Sales',
      navigationIcon: 'shopping-bag',
      listFields: ['id', 'customer', 'total', 'status', 'createdAt', 'summary'],
      searchFields: ['customer', 'email'],
      defaultSortField: 'createdAt',
      defaultSortDirection: 'desc',
      defaultPageSize: 50,
      fields: [
        // override one field...
        {
          name: 'status',
          enumChoices: [
            { label: 'Paid', value: 'paid' },
            { label: 'Refunded', value: 'refunded' },
          ],
          filterable: true,
        },
        // ...or add a computed column
        {
          name: 'summary',
          type: 'computed',
          computedGetter: (o) => `${o['customer']} · ₹${o['total']}`,
        },
      ],
    },
    User, // plain models still work
  ],
});
```

| Option                                                                       | What it controls                                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`, `pluralLabel`                                                       | Names in the sidebar and headings                                                                                                                         |
| `navigationGroup`, `navigationIcon`, `navigationOrder`                       | Sidebar placement                                                                                                                                         |
| `listFields`                                                                 | Columns of the list (and of the CSV export)                                                                                                               |
| `detailFields`, `createFields`, `editFields`                                 | What the detail page and the forms show and accept. Anything else in a request body is ignored, which prevents mass assignment                            |
| `searchFields`                                                               | Columns matched by the search box (case-insensitive contains)                                                                                             |
| `filters`                                                                    | Filter dropdowns. Default: boolean fields and fields with `enumChoices` marked `filterable`                                                               |
| `fields`                                                                     | Per-field overrides by name: `label`, `type`, `hidden`, `readonly`, `sensitive`, `sortable`, `filterable`, `enumChoices`, `description`, `computedGetter` |
| `defaultSortField`, `defaultSortDirection`, `defaultPageSize`, `maxPageSize` | Default ordering and paging (`maxPageSize` caps `?pageSize=`)                                                                                             |
| `actions`, `bulkActions`                                                     | Custom buttons (see [Actions](#6-actions))                                                                                                                |
| `exactCount`, `exportBatchSize`                                              | Large-table tuning (see [Millions of rows](#7-millions-of-rows))                                                                                          |

`new AdminResource({ modelName: 'Order', ... })` works too and also inherits the model's fields.

---

## 4. Dashboards

The dashboard is made of widgets. Every widget loads its own data (in parallel), so one slow query
never blocks the page:

```ts
import { createApp, MetricWidget, ChartWidget, TableWidget, ActivityWidget } from 'jsango';

const app = createApp();
app.admin({
  resources: [Order],
  dashboard: [
    new MetricWidget({
      title: 'Orders today',
      cacheSeconds: 60, // cache expensive queries for every viewer
      getValue: async () => ({
        value: await Order.where('createdAt', '>=', startOfDay()).count(),
        change: 12.5,
        hint: 'vs yesterday',
      }),
    }),
    new MetricWidget({
      title: 'Revenue',
      permission: 'finance.view',
      getValue: async () => `₹${await Order.query().sum('total')}`,
    }),
    new ChartWidget({
      title: 'Orders by status',
      chartType: 'bar', // or 'line'
      width: 'half',
      refreshIntervalSeconds: 60,
      cacheSeconds: 60,
      getChartData: async () => {
        const rows = await Order.query().groupBy(['status'], {
          orders: ['count'],
          revenue: ['sum', 'total'],
        });
        return {
          labels: rows.map((r) => String(r['status'])),
          datasets: [{ label: 'Orders', data: rows.map((r) => Number(r['orders'])) }],
        };
      },
    }),
    new TableWidget({
      title: 'Latest orders',
      width: 'full',
      getTableData: async () => ({
        headers: ['#', 'Customer', 'Total'],
        rows: (await Order.query().latest().limit(5).get()).map((o) => [o.id, o.customer, o.total]),
      }),
    }),
    new ActivityWidget({
      title: 'Signups',
      getActivity: async () =>
        (await User.query().latest().limit(10).get()).map((u) => ({
          id: String(u.id),
          title: u.email,
          timestamp: u.createdAt.getTime(),
        })),
    }),
  ],
});

declare function startOfDay(): Date;
```

| Option (every widget)    | Meaning                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `title`, `description`   | Card heading (the id defaults to a slug of the title)                                                        |
| `width`                  | `'quarter'` (metrics default), `'third'`, `'half'` (default), `'full'`                                       |
| `permission`             | Only identities with this permission (or superusers) see it                                                  |
| `cacheSeconds`           | Server-side cache shared by all viewers; concurrent requests share one query. Don't use it for per-user data |
| `refreshIntervalSeconds` | The browser reloads the widget on this interval                                                              |

Getters receive `{ identity }`, so a widget can show per-user data:
`getValue: ({ identity }) => Order.where('ownerId', identity.id).count()`.

A metric value is a number, a string, or `{ value, change, trend, hint }`. Charts take up to eight
series on one shared axis, with a legend and a hover tooltip, in light and dark mode. Without widgets,
the dashboard shows the recent admin activity.

---

## 5. Custom pages

A page is a dashboard of its own, with a sidebar link:

```ts
import { AdminPage, MetricWidget, ChartWidget } from 'jsango';

const finance = new AdminPage({
  id: 'finance',
  label: 'Finance',
  description: 'Revenue and refunds',
  navigationGroup: 'Reports',
  permission: 'finance.view', // hidden for everyone else
  widgets: [
    new MetricWidget({ title: 'Refunds this month', getValue: () => 12 }),
    new ChartWidget({
      title: 'Revenue',
      chartType: 'bar',
      getChartData: () => ({
        labels: ['Jan', 'Feb'],
        datasets: [{ label: 'Revenue', data: [120, 180] }],
      }),
    }),
  ],
});

// app.admin({ resources: [...], pages: [finance] });
```

---

## 6. Actions

```ts
import { createApp } from 'jsango';

const app = createApp();
app.admin({
  resources: [
    {
      model: Order,
      actions: [
        {
          id: 'refund',
          label: 'Refund',
          permission: 'orders.refund',
          requiresConfirmation: true,
          handler: async ({ item, actor }) => {
            await refund(item['id'] as number, actor);
            return 'Refunded';
          },
        },
      ],
      bulkActions: [
        {
          id: 'mark-shipped',
          label: 'Mark as shipped',
          handler: async ({ ids }) =>
            Order.query().whereIn('id', ids).update({ status: 'shipped' }),
        },
      ],
    },
  ],
});

declare function refund(id: number, actor: unknown): Promise<void>;
```

Every list also has a built-in **bulk delete**. It deletes the selected rows (up to 1,000) in one
query after checking `canDelete` for each of them.

---

## 7. Millions of rows

The admin only ever loads one page:

- **Only the list columns are read** (`listFields` plus the primary key), not whole rows.
- **Stable paging.** Every sort has a primary-key tie-breaker, so rows never repeat or vanish
  between pages.
- **Parallel count.** `COUNT(*)` and the page query run at the same time. On tables where even
  that is too slow, set `exactCount: false`: the list then pages with next/previous only, using
  `LIMIT n+1` and no count.
- **CSV export streams.** Every matching row (with the same search and filters) is exported in
  `exportBatchSize` batches (1,000 by default), using keyset pagination (`WHERE id > last`). Batch
  1,000 costs the same as batch 1, and memory stays flat. The browser downloads it natively through
  a one-time link.
- **Search waits for typing to stop** (300 ms) and is limited to `searchFields`. Search is a
  case-insensitive "contains" match. On very large tables, index those columns (or use a full-text
  index) and keep `searchFields` short.
- **Sort and filter only on indexed columns** for large tables. Unknown or non-sortable sort fields
  are ignored, and `pageSize` is capped by `maxPageSize`.
- **Dashboard widgets load independently**, in parallel. Use `cacheSeconds` for expensive aggregates.

```ts
const events = {
  model: Event,
  listFields: ['id', 'type', 'userId', 'createdAt'],
  searchFields: ['type'],
  exactCount: false,
  defaultSortField: 'id',
  defaultSortDirection: 'desc' as const,
};
// app.admin({ resources: [events] });
```

The same keyset batching powers the ORM: `Model.query().chunk(1000, fn)` and `.cursor()` (without an
`orderBy()`) now seek by primary key instead of `OFFSET`.

---

## 8. Permissions

Superusers can do everything. Other admin users need permissions per resource (the resource id is
the lower-cased model name):

| Permission                                                  | Allows                                     |
| ----------------------------------------------------------- | ------------------------------------------ |
| `admin.access` (or role `admin` / `staff`)                  | Entering the admin                         |
| `admin.<resource>.view`                                     | List, detail, export                       |
| `admin.<resource>.add` / `.change` / `.delete` / `.restore` | Create / edit / delete / restore           |
| `admin.<resource>.*`, `admin.*`                             | Everything on one resource / all resources |
| an action's `permission`                                    | Running that action                        |
| a widget's or page's `permission`                           | Seeing it                                  |

Resources a user can't view are hidden from the sidebar. Fields marked `sensitive` are visible only
to superusers.

---

## 9. Audit trail, health checks and branding

```ts
import { createApp } from 'jsango';
import type { IAuditStore } from 'jsango';

declare const auditStore: IAuditStore; // e.g. a table-backed implementation
declare const redis: { ping(): Promise<string> };

const app = createApp();
app.admin({
  resources: [],
  auditStore, // default: in memory
  healthChecks: { redis: () => redis.ping() }, // the database is checked automatically
  title: 'Acme Admin',
  brandSubtitle: 'Operations', // '' hides it
  logoUrl: '/static/acme-logo.svg', // https URL, path served by your app, or data:image URL
  logoText: 'AC', // badge letters when there is no logoUrl (default: the title's initials)
  faviconUrl: '/static/favicon.png', // default: logoUrl
  siteUrl: 'https://acme.example.com',
  defaultTheme: 'system',
  customCss: ':root { --chakra-colors-brand-solid: #7c3aed; }',
  path: '/backoffice',
});
```

- **Audit Trail** records who changed what (with before/after values), exports, bulk actions,
  sign-ins and sign-outs, with IP and user agent. It is filterable by resource and action.
- **Branding** works on every screen size: long titles are shortened with "…" in the header, the
  subtitle is hidden on phones, and the full title stays on the dashboard and the login page.
  Square logos look best; only http(s), relative and `data:image` URLs are accepted.
- **System** shows process stats and every health check, with latency or the error message.

---

## 10. Security

| Threat                           | Protection                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Default or guessable credentials | Login refused in production without a configured password; use `createAuth` users                          |
| Password guessing                | 5 failures per account per 15 minutes (20 per IP) → `429` (auth-kit lockout when using `createAuth`)       |
| Stolen session token             | 256-bit random tokens, stored hashed, 8-hour lifetime; sessions can be revoked                             |
| Mass assignment                  | Only `createFields` / `editFields` are written                                                             |
| Data leaks                       | Hidden and sensitive fields are stripped server-side; sorting, filtering and export only on visible fields |
| SQL injection via sort/filter    | Sort and filter fields are allow-listed; values are bound parameters                                       |
| CSV / formula injection          | Exported cells starting with `= + - @` are prefixed with `'`                                               |
| Export links leaking             | One-time links valid for 60 seconds; the session token never appears in a URL                              |
| 2FA secret leaks                 | The QR secret never leaves the page (no third-party QR service)                                            |

---

## 11. HTTP API

All routes are under `/admin/api/v1` (`apiPrefix`) and return `{ ok, data }` or `{ ok: false, error }`.

| Route                                                                                                              | Purpose                                         |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`                                                          | Sign in / out                                   |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/sessions/terminate-others`                        | Sessions                                        |
| `GET /resources`                                                                                                   | Resources the user can view, with their schemas |
| `GET /resources/:id?page&pageSize&search&sort&sortDirection&filter_<field>`                                        | List                                            |
| `POST /resources/:id` · `GET/PATCH/DELETE /resources/:id/:pk`                                                      | CRUD                                            |
| `POST /resources/:id/bulk/delete` · `POST /resources/:id/bulk/:action` · `POST /resources/:id/:pk/actions/:action` | Actions                                         |
| `POST /resources/:id/export` → `GET /resources/:id/export?ticket=`                                                 | CSV export                                      |
| `GET /dashboard` · `GET /dashboard/widgets/:id`                                                                    | Dashboard                                       |
| `GET /pages` · `GET /pages/:id` · `GET /pages/:id/widgets/:widget`                                                 | Custom pages                                    |
| `GET /audit` · `GET /system/health`                                                                                | Audit trail, health                             |
