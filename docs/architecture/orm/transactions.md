# Transactions & Connection Management

## Transaction Integration

`@django-js/orm` integrates directly with the transaction infrastructure from `@django-js/database` (Phase 5).

---

## Scoped Transactions via DatabaseManager

Transactions are managed using the scoped callback pattern:

```typescript
import { getDatabaseManager } from '@django-js/orm';

const db = getDatabaseManager()!;

await db.transaction(async (tx) => {
  // Save model inside transaction
  const sender = await Account.query().using(tx).find(1);
  const recipient = await Account.query().using(tx).find(2);

  sender.balance -= 100;
  recipient.balance += 100;

  await sender.save({ connection: tx });
  await recipient.save({ connection: tx });

  // If an error is thrown, the transaction automatically rolls back!
});
```

---

## QueryBuilder Execution Context (`.using()`)

Queries can be bound to any active transaction or specific connection using `.using(...)`:

```typescript
const posts = await Post.query().using(tx).where('status', 'draft').get();
```

---

## Automatic Connection Lifecycle

When operations run without an explicit connection, the ORM automatically acquires a connection from the model's configured pool and guarantees that it is released in a `finally` block:

```typescript
// Internally executed by QueryBuilder and Model:
const conn = await manager.connection(metadata.connection);
try {
  return await conn.query(sql, params);
} finally {
  await conn.release();
}
```

This prevents connection leaks and guarantees that pool limits are respected even under high concurrency.
