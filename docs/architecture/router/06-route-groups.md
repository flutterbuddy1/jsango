# Route Groups

## Overview

Route groups allow modular organization of routes by sharing common path prefixes and metadata across sets of related routes.

## Basic Usage

Groups are registered via `router.group(prefixOrConfig, callback, options)`:

```typescript
router.group('/api/v1', (api) => {
  api.get('/users', listUsersHandler);
  api.post('/users', createUserHandler);
});
```

## Nested Groups

Groups can be nested to arbitrary depths:

```typescript
router.group('/api', (api) => {
  api.group('/v1', (v1) => {
    v1.get('/status', statusHandler); // Path: /api/v1/status
  });
});
```

## Metadata Inheritance

Route groups support metadata inheritance. Metadata defined at an outer group level is automatically merged into inner groups and leaf routes:

```typescript
router.group(
  {
    prefix: '/admin',
    metadata: { authRequired: true, role: 'admin' },
  },
  (admin) => {
    admin.get('/dashboard', dashboardHandler, {
      metadata: { permission: 'view_dashboard' },
    });
    // Resulting route metadata:
    // { authRequired: true, role: 'admin', permission: 'view_dashboard' }
  }
);
```

Leaf route metadata takes precedence over group metadata for identical keys.
