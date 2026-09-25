# Model Hydration & Change Tracking

## Hydration Pipeline

When a query executes, raw rows returned by the database driver are transformed into typed model instances via the `Hydrator`:

```
Raw Database Row (Record<string, unknown>)
        ↓
Column-to-Field Mapping (metadata.columnToField)
        ↓
Data Type Normalization (Dates, Booleans, Numbers, BigInts, JSON)
        ↓
Model Instance Instantiation (new Model(attributes, isNew = false))
        ↓
Baseline Snapshot Recording (originalAttributes = { ...attributes })
```

---

## Type Normalization Rules

- **DateTime / Date / Time**: String timestamps and numbers are parsed into standard JavaScript `Date` instances.
- **Boolean**: Database integer flags (`0` / `1`) or strings (`"t"`, `"true"`) are normalized to boolean `true` / `false`.
- **Numbers & BigInt**: Numeric strings are converted to JavaScript `number` or `bigint`.
- **JSON**: Serialized JSON strings are parsed with `JSON.parse`.

---

## Dirty State Tracking

Model instances track modifications relative to their original baseline:

```typescript
const user = await User.find(1);

user.isDirty(); // false
user.getDirty(); // {}

user.name = 'New Name';

user.isDirty(); // true
user.isDirty('name'); // true
user.isDirty('email'); // false
user.getDirty(); // { name: 'New Name' }
user.getOriginal('name'); // Original name
```

### Save Optimization

When `user.save()` is called on an existing record:

1. If `user.isDirty()` is `false`, the method returns immediately without executing an SQL query.
2. If dirty, it compiles an `UPDATE` statement that sets **only the dirty columns**, minimizing network transfer and database write lock contention.
