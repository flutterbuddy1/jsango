# Connection Pooling

`ConnectionPool` is a zero-dependency, asynchronous resource manager designed for high-concurrency workloads.

## Configuration Parameters

| Parameter          | Default           | Purpose                                                                                      |
| :----------------- | :---------------- | :------------------------------------------------------------------------------------------- |
| `min`              | 2                 | Minimum baseline connections kept in the idle pool.                                          |
| `max`              | 10                | Maximum active + idle connections allowed simultaneously.                                    |
| `acquireTimeoutMs` | 10,000ms          | Maximum wait time for a free connection before throwing `ConnectionAcquisitionTimeoutError`. |
| `idleTimeoutMs`    | 30,000ms          | Maximum duration a connection may remain idle before eviction.                               |
| `maxLifetimeMs`    | 1,800,000ms (30m) | Maximum overall age of a connection before replacement upon return.                          |

## Acquisition Lifecycle

1. **Idle Pool Check**: If a valid, non-expired connection exists in the idle list, it is immediately marked active and returned.
2. **Dynamic Creation**: If no idle connection exists and current total connections `< max`, a new physical connection is created and returned.
3. **FIFO Queue**: If the pool is at maximum capacity, the acquisition request is enqueued as a `Waiter` in a FIFO promise queue.
4. **Timeout & Abort**: If `acquireTimeoutMs` expires or the client's `AbortSignal` fires, the waiter is evicted from the queue and rejected.

## Connection Return & Replacement

When `release(conn)` is called:

- If pending waiters exist, the connection is immediately resolved to the next waiter in queue.
- If no waiters exist, the connection is returned to the idle pool.
- If a connection is closed or destroyed (`destroy(conn)`), the pool allocates a replacement connection for any queued waiters.
