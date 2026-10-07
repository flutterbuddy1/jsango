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
   import { getAllModels, defaultModelRegistry } from '@jsango/orm';

   const models = getAllModels(); // All registered models in the application
   const userMeta = defaultModelRegistry.getMetadata('User'); // ModelMetadata | undefined
   ```

2. **Form & Table Rendering**:

   ```typescript
   import { defineModel, fields } from '@jsango/orm';

   const User = defineModel('User', {
     id: fields.id(),
     email: fields.string({ unique: true }),
   });

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
   const meta = Post.metadata;

   for (const [name, rel] of meta.relations) {
     rel.type; // 'hasMany', 'belongsTo', etc.
     rel.foreignKey; // Select dropdown foreign key
     const Target = rel.resolveTarget(); // Target model to populate options
   }
   ```

4. **Custom Admin Metadata Extension**:
   Models can provide custom admin options in their definition:
   ```typescript
   import { defineModel, fields } from '@jsango/orm';

   const User = defineModel({
     name: 'User',
     table: 'users',
     fields: {
       id: fields.id(),
       email: fields.string(),
       name: fields.string(),
       role: fields.string(),
       active: fields.boolean(),
     },
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
