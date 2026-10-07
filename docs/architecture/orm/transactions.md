# Transactions & Connection Management

## Transaction Integration

`@jsango/orm` integrates directly with the transaction infrastructure from `@jsango/database` (Phase 5).

---

## Scoped Transactions via `transaction()`

Transactions are managed using the scoped callback pattern. Every model operation inside the callback (including nested async calls) automatically runs on the transaction, so `tx` does not need to be passed around:

```typescript
import { defineModel, fields, transaction } from '@jsango/orm';

const Account = defineModel('Account', {
  id: fields.id(),
  balance: fields.decimal(),
});

await transaction(async () => {
  const sender = await Account.findOrFail(1);
  const recipient = await Account.findOrFail(2);

  await sender.decrement('balance', 100);
  await recipient.increment('balance', 100);

  // If an error is thrown, the transaction automatically rolls back!
});
```

The transaction object is still passed to the callback when you want to be explicit (`Account.query().using(tx)`, `model.save({ connection: tx })`). Use `transaction(cb, { connection: 'analytics' })` for a non-default connection. Note that `DatabaseManager.transaction()` is a lower-level API that does **not** make the transaction ambient for models.

---

## QueryBuilder Execution Context (`.using()`)

Queries can be bound to any active transaction or specific connection using `.using(...)`:

```typescript
import { transaction } from '@jsango/orm';

await transaction(async (tx) => {
  const posts = await Post.query().using(tx).where('status', 'draft').get();
});
```

---

## Automatic Connection Lifecycle

When operations run without an explicit connection, the ORM automatically acquires a connection from the model's configured pool and guarantees that it is released in a `finally` block:

```text
// Internally executed by QueryBuilder and Model (simplified):
const conn = await manager.connection(metadata.connection);
try {
  return await conn.query(sql, params);
} finally {
  await conn.release();
}
```

This prevents connection leaks and guarantees that pool limits are respected even under high concurrency.
