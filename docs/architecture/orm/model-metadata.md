# Model Metadata System

## Overview

The `jsango` Model Metadata system is a first-class architectural component. It decouples model schema definitions from database queries and runtime drivers.

Future systems—such as Admin (Phase 13), Migrations (Phase 7), and Validation (Phase 8)—depend directly on this metadata.

---

## Accessing Model Metadata

Metadata is accessible statically on every model:

```typescript
const meta = User.metadata;
```

### Inspecting Model Properties

```typescript
meta.name; // "User"
meta.table; // "users"
meta.connection; // "default"
meta.primaryKey; // "id"
meta.timestamps; // { enabled: true, createdAt: "createdAt", updatedAt: "updatedAt" }
meta.softDelete; // { enabled: true, deletedAt: "deletedAt" }
meta.indexes; // readonly IndexMetadata[]
```

---

## Field Metadata (`FieldMetadata`)

Every field defined on a model produces an immutable `FieldMetadata` descriptor:

```typescript
const emailField = meta.getField('email');

emailField.name; // "email"
emailField.type; // "string"
emailField.columnName; // "email" (or custom DB column)
emailField.nullable; // false
emailField.unique; // true
emailField.defaultValue; // undefined
emailField.length; // 255
emailField.options; // Readonly<Record<string, unknown>>
```

### Column Name Mapping

Column names can differ from model property names (e.g. `viewCount` in TypeScript mapped to `view_count` in the database).

`ModelMetadata` provides bidirectional lookups:

```typescript
meta.fieldToColumn('viewCount'); // "view_count"
meta.columnToField('view_count'); // "viewCount"
```

---

## Relationship Metadata (`RelationMetadata`)

Relationships produce `RelationMetadata` descriptors describing associations:

```typescript
const postsRelation = meta.getRelation('posts');

postsRelation.name; // "posts"
postsRelation.type; // "hasMany" | "hasOne" | "belongsTo" | "manyToMany"
postsRelation.sourceModel; // "User"
postsRelation.foreignKey; // "userId"
postsRelation.localKey; // "id"
postsRelation.resolveTarget(); // Returns Post model constructor
```

---

## Immutability & Serialization

To ensure stability across concurrent requests:

1. `ModelMetadata`, `FieldMetadata`, and `RelationMetadata` instances are frozen with `Object.freeze()`.
2. Target model resolution caches resolved references in static `WeakMap` collections, preventing runtime mutation of metadata instances.
3. Every metadata descriptor implements `.toJSON()`, enabling Admin UIs and code generators to inspect the complete schema in JSON format.
