# Model Definition & Model Instances

## Defining Models

Models in `jsango` are defined using the declarative `defineModel()` factory:

```typescript
import { defineModel, fields, relations } from '@jsango/orm';

export const User = defineModel({
  name: 'User',
  table: 'users',
  connection: 'default',
  fields: {
    id: fields.integer({ primaryKey: true, autoIncrement: true }),
    name: fields.string(),
    email: fields.string({ unique: true }),
    role: fields.string({ default: 'user' }),
    active: fields.boolean({ default: true }),
  },
  relations: {
    posts: relations.hasMany(() => Post, { foreignKey: 'userId' }),
  },
  timestamps: true,
  softDelete: true,
});
```

### Key Capabilities of `defineModel()`

- **Type Inference**: Produces a strongly typed class where attributes (`user.name`, `user.email`) are inferred as direct TypeScript properties with autocomplete.
- **Static Query Methods**: Attaches `create()`, `find()`, `findOrFail()`, `query()`, and `bulkCreate()` directly to the model constructor.
- **Prototype Property Access**: Properties are backed by getters and setters defined on the model prototype that read and write to the internal `_attributes` map.

---

## Model Instance Lifecycle

Each model instance represents a single database record:

```typescript
// Creating an unsaved instance
const user = new User({ name: 'Alice', email: 'alice@example.com' });
user.isNew; // true
user.isDirty(); // true

// Persisting to the database
await user.save();
user.isNew; // false
user.isDirty(); // false
user.id; // 1 (auto-populated by primary key generation)

// Modifying attributes
user.name = 'Alice Smith';
user.isDirty('name'); // true
user.getDirty(); // { name: 'Alice Smith' }
user.getOriginal('name'); // 'Alice'

// Updating dirty attributes
await user.save(); // Executes UPDATE only for modified columns
user.isDirty(); // false

// Calling save on clean model
await user.save(); // No-op, bypasses database query entirely!
```

---

## Deleting Models

### Soft Deletion

When a model has `softDelete: true`, calling `delete()` automatically updates the `deletedAt` timestamp without removing the database record:

```typescript
await user.delete();
user.deletedAt; // Current Date
```

### Hard Deletion

To permanently delete a soft-deletable record:

```typescript
await user.delete({ force: true });
```

---

## Serialization with `toJSON()`

Calling `.toJSON()` returns a clean, plain JavaScript object containing all field attributes and any loaded relationships:

```typescript
const json = user.toJSON();
```

- Date objects are converted to standard ISO 8601 strings.
- Internal change tracking state (`_originalAttributes`, `_isNew`) and query methods are excluded.
- Loaded relations are recursively serialized via their own `.toJSON()` implementations.
