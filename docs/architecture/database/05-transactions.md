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
const result = await db.transaction(async (tx) => {
  await tx.query('INSERT INTO orders (user_id, total) VALUES (?, ?)', [1, 99.5]);
  await tx.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [99.5, 1]);
  return { status: 'ordered' };
});
```

- If the callback resolves, `tx.commit()` is automatically invoked.
- If the callback throws an error, `tx.rollback()` is automatically invoked, and the original error is rethrown.
- The underlying connection is guaranteed to be released back to the pool in a `finally` block.

## Savepoints

Nested work within a transaction is handled through named savepoints:

```typescript
await tx.savepoint('my_savepoint');
try {
  await tx.query('INSERT INTO logs (message) VALUES (?)', ['Tentative log']);
} catch {
  await tx.rollbackTo('my_savepoint');
}
await tx.commit();
```

## Isolation Levels

Supported levels:

- `READ UNCOMMITTED`
- `READ COMMITTED`
- `REPEATABLE READ`
- `SERIALIZABLE`

If the configured driver does not support isolation levels or the specific level requested, `IsolationLevelUnsupportedError` is thrown immediately.
