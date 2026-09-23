# Database Architecture & Layering

The database package is organized into four distinct operational layers:

```
[ Application / Services / CLI / Jobs ]
                   │
                   ▼
┌──────────────────────────────────────────────┐
│ DatabaseManager                              │
│ - Named connection registry                  │
│ - Default connection resolution              │
│ - Health checks and lifecycle shutdown       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ ConnectionPool                               │
│ - Min/Max capacity allocation                │
│ - FIFO acquisition queue with timeouts       │
│ - Idle reaping and max lifetime eviction     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ DatabaseConnection & DatabaseTransaction     │
│ - Query execution & parameter binding        │
│ - Transaction lifecycle & state validation   │
│ - Savepoint management                      │
│ - Automatic cleanup and release in finally   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ IDatabaseDriver (Driver Adapter)             │
│ - Capability declaration                     │
│ - Low-level engine connection & query        │
│ - Engine-level dialect placeholder mapping   │
└──────────────────────────────────────────────┘
```

## Layer Descriptions

1. **DatabaseManager**: Acts as the central registry holding configuration, driver factories, and active connection pools. Exposes top-level convenience methods (`query`, `transaction`) that automatically manage connection checkout and checkin.
2. **ConnectionPool**: Manages raw physical driver connections. Maintains active connections and idle connections, and uses an asynchronous FIFO queue for pending acquisitions when capacity is reached.
3. **DatabaseConnection**: The client-facing connection wrapper. Dispatches queries, handles dialect normalization, creates transactions, and manages automatic rollback on release if an uncommitted transaction was left open.
4. **Driver Adapter**: The low-level connector to the underlying database engine (PostgreSQL, MySQL, SQLite, in-memory mock). Completely shields upper layers from driver-specific sockets or native handles.
