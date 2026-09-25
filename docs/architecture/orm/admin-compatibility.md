# Admin Compatibility & Introspection

## Architectural Role in Future Admin (Phase 13)

Future Admin architecture will follow a strict layered pipeline:

```
ORM Model
   ↓
Model Metadata (ModelMetadata)
   ↓
Admin Resource Definition
   ↓
Admin API Generation
   ↓
Admin Dashboard UI
```

The future Admin framework will interact with models purely through `ModelMetadata`, eliminating any dependency on internal ORM query mechanisms or specific database drivers.

---

## Introspecting Models for Admin

Admin controllers and UI generators will query `ModelMetadata` for:

1. **Model Discovery**:

   ```typescript
   import { getAllModels, getMetadata } from '@django-js/orm';

   const models = getAllModels(); // All registered models in the application
   ```

2. **Form & Table Rendering**:

   ```typescript
   const meta = User.metadata;

   for (const [name, field] of meta.fields) {
     field.name; // Column label
     field.type; // Render input type (string -> text, integer -> number, boolean -> checkbox)
     field.nullable; // Mark field as optional in form
     field.primaryKey; // Identify table ID column
   }
   ```

3. **Relationship Navigation**:

   ```typescript
   for (const [name, rel] of meta.relations) {
     rel.type; // 'hasMany', 'belongsTo', etc.
     rel.foreignKey; // Select dropdown foreign key
     const Target = rel.resolveTarget(); // Target model to populate options
   }
   ```

4. **Custom Admin Metadata Extension**:
   Models can provide custom admin options in their definition:
   ```typescript
   const User = defineModel({
     name: 'User',
     table: 'users',
     fields: { ... },
     metadata: {
       admin: {
         searchFields: ['email', 'name'],
         listDisplay: ['id', 'name', 'email', 'role'],
         listFilter: ['role', 'active'],
       },
     },
   });
   ```
   Admin can inspect `User.metadata.options['admin']` without modifying ORM internals.
