# Migration Guide: django-js → JSango

This document provides instructions for migrating existing applications and configuration from the legacy development name (**django-js**) to the official production release name (**JSango**).

---

## 1. Overview of Changes

| Category                   | Legacy Identifier (`django-js`) | Official Release Identifier (`JSango`) |
| :------------------------- | :------------------------------ | :------------------------------------- |
| **Framework Product Name** | `django-js` / `Django-JS`       | **`JSango`**                           |
| **CLI Binary**             | `django-js`                     | **`jsango`**                           |
| **npm Scope**              | `@django-js/*`                  | **`@jsango/*`**                        |
| **Project Generator**      | `create-django-js-app`          | **`create-jsango-app`**                |
| **Base Error Class**       | `DjangoJsError`                 | **`JsangoError`**                      |
| **Config Env Prefix**      | `DJANGO_JS_*`                   | **`JSANGO_*`**                         |
| **Config File**            | `django-js.config.ts`           | **`jsango.config.ts`**                 |
| **Admin UI Console**       | `Django-JS Admin`               | **`JSango Admin`**                     |

---

## 2. Package Dependency Updates

Update your `package.json` dependencies from `@django-js/*` to `@jsango/*`:

```diff
  "dependencies": {
-   "@django-js/core": "^1.0.0",
-   "@django-js/http": "^1.0.0",
-   "@django-js/router": "^1.0.0",
-   "@django-js/middleware": "^1.0.0",
-   "@django-js/database": "^1.0.0",
-   "@django-js/orm": "^1.0.0",
-   "@django-js/migrations": "^1.0.0",
-   "@django-js/auth": "^1.0.0",
-   "@django-js/admin-ui": "^1.0.0"
+   "@jsango/core": "^1.0.0",
+   "@jsango/http": "^1.0.0",
+   "@jsango/router": "^1.0.0",
+   "@jsango/middleware": "^1.0.0",
+   "@jsango/database": "^1.0.0",
+   "@jsango/orm": "^1.0.0",
+   "@jsango/migrations": "^1.0.0",
+   "@jsango/auth": "^1.0.0",
+   "@jsango/admin-ui": "^1.0.0"
  }
```

---

## 3. TypeScript Imports

Update all module imports in your application codebase:

```diff
- import { Application } from '@django-js/middleware';
- import { Model, Column, PrimaryKey } from '@django-js/orm';
- import { DjangoJsError } from '@django-js/core';
+ import { Application } from '@jsango/middleware';
+ import { Model, Column, PrimaryKey } from '@jsango/orm';
+ import { JsangoError } from '@jsango/core';
```

---

## 4. CLI Commands

The CLI binary has been renamed from `django-js` to `jsango`:

```bash
# Start development server
jsango dev

# Database migrations
jsango migrate

# System doctor & diagnostics
jsango doctor

# Inspect routes & models
jsango routes
jsango models
```

---

## 5. Environment Variables

Update any framework-level environment variables in your `.env` and deployment environments:

```diff
- DJANGO_JS_ENV=production
- DJANGO_JS_DEBUG=false
- DJANGO_JS_DATABASE_URL=sqlite://./app.db
+ JSANGO_ENV=production
+ JSANGO_DEBUG=false
+ JSANGO_DATABASE_URL=sqlite://./app.db
```

---

## 6. Compatibility & SemVer Guarantees

All framework runtime behaviors, lifecycle hooks, ORM semantics, middleware pipelines, and API contracts remain 100% backward-compatible under the **JSango 1.0.0** stable release.
