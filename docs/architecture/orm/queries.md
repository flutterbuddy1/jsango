# Query Builder

## Overview

The `QueryBuilder` provides a type-safe, immutable interface for building and executing database queries.

```typescript
const users = await User.query()
  .where('active', true)
  .where('role', 'admin')
  .orderBy('createdAt', 'DESC')
  .limit(10)
  .get();
```

---

## Query Immutability & Branching

Every method on `QueryBuilder` returns a new cloned builder instance. Base queries can be created and branched without shared mutable state:

```typescript
const base = User.query().where('active', true);

// Branch A: Active Admins
const admins = base.where('role', 'admin');

// Branch B: Active Standard Users
const regular = base.where('role', 'user');

// Base query remains unmodified!
```

---

## Filtering Operations

### Comparison

```typescript
query.where('age', '>=', 21);
query.where('email', 'LIKE', '%@example.com');
query.orWhere('role', 'superadmin');
```

### Key-Value Objects

```typescript
query.where({ role: 'admin', active: true });
```

### IN and NOT IN

```typescript
query.whereIn('id', [1, 2, 3]);
query.whereNotIn('status', ['banned', 'suspended']);
```

### NULL Checks

```typescript
query.whereNull('deletedAt');
query.whereNotNull('verifiedAt');
```

---

## Pagination & Streaming

### Page-Based Pagination

```typescript
const result = await User.query().where('active', true).paginate({ page: 1, pageSize: 20 });

result.items; // readonly User[]
result.total; // Total matching record count
result.page; // Current page number (1-indexed)
result.pageSize; // 20
result.totalPages; // Total calculated pages
```

### Memory-Efficient Cursor Streaming

When processing large datasets, `cursor()` streams results in configurable batches using an async generator without loading the entire table into memory:

```typescript
for await (const user of User.query().cursor(100)) {
  await processUser(user);
}
```

---

## Aggregations

### Count

Compiles into `SELECT COUNT(*) AS aggregate ...` and does not load rows into memory:

```typescript
const totalActive = await User.query().where('active', true).count();
```

### Existence Check

Compiles into `SELECT 1 AS exists_flag ... LIMIT 1`:

```typescript
const hasAdmins = await User.query().where('role', 'admin').exists();
```

---

## Bulk Operations

### Bulk Update

Updates matching rows without loading them into memory:

```typescript
const updatedCount = await User.query().where('role', 'guest').update({ active: false });
```

### Bulk Delete

Deletes matching rows:

```typescript
const deletedCount = await User.query().where('active', false).delete();
```
