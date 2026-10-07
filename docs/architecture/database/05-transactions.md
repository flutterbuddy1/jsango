# Database Transactions

`@jsango/database` provides transaction isolation, state machine guards, and automatic rollback on failure.

## Transaction State Machine

Transactions advance through three states:

- `active`: Queries and savepoints are permitted.
- `committed`: Terminal success state; no further actions allowed.
- `rolledBack`: Terminal aborted state; all changes discarded; no further actions allowed.

Attempting to commit, rollback, query, or create savepoints on a completed transaction throws `TransactionClosedError`.

## Automatic Scoped Transactions

The recommended API is `connection.transaction()`:

```typescript
import { DatabaseManager } from '@jsango/database';

const db = new DatabaseManager({
  default: 'main',
  connections: { main: { driver: 'sqlite', filename: './app.db' } },
});

const conn = await db.connection();
const result = await conn.transaction(async (tx) => {
  await tx.query('INSERT INTO orders (user_id, total) VALUES (?, ?)', [1, 99.5]);
  await tx.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [99.5, 1]);
  return { status: 'ordered' };
});
await conn.release();

// Shortcut: DatabaseManager.transaction() acquires and releases the default connection for you
await db.transaction(async (tx) => {
  await tx.query('DELETE FROM carts WHERE user_id = ?', [1]);
});
```

- If the callback resolves, `tx.commit()` is automatically invoked.
- If the callback throws an error, `tx.rollback()` is automatically invoked, and the original error is rethrown.
- With `DatabaseManager.transaction()`, the underlying connection is guaranteed to be released back to the pool in a `finally` block; with `connection.transaction()` you release the connection yourself.

## Savepoints

Nested work within a transaction is handled through named savepoints:

```typescript
await db.transaction(async (tx) => {
  await tx.savepoint('my_savepoint');
  try {
    await tx.query('INSERT INTO logs (message) VALUES (?)', ['Tentative log']);
    await tx.releaseSavepoint('my_savepoint');
  } catch {
    await tx.rollbackTo('my_savepoint');
  }
  // committed automatically when the callback resolves
});
```

## Isolation Levels

Supported levels:

- `READ UNCOMMITTED`
- `READ COMMITTED`
- `REPEATABLE READ`
- `SERIALIZABLE`

If the configured driver does not support isolation levels or the specific level requested, `IsolationLevelUnsupportedError` is thrown immediately.
