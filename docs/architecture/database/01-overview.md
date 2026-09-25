# Database Layer: Overview

`@jsango/database` provides a runtime-independent, high-performance database connectivity and connection pooling foundation for the JSango framework.

## Core Responsibilities

1. **Named Connection Management**: Support multiple isolated named database connections (`default`, `analytics`, `readonly`).
2. **Production Connection Pooling**: High-concurrency connection pools with acquisition queueing, idle connection eviction, and timeout guarantees.
3. **Driver Abstraction**: Clean boundary decoupling client code from driver-specific mechanics (PostgreSQL, MySQL, SQLite, in-memory).
4. **Parameterized Query Dispatch**: Safe execution preventing SQL injection with universal dialect placeholder translation.
5. **Deterministic Transactions**: Atomic execution with auto-commit/rollback semantics, savepoint mechanics, and state machine guards.
6. **Graceful Lifecycle Integration**: Clean shutdown hooks draining in-flight queries and closing connections.

## Architectural Boundaries

`@jsango/database` is strictly an infrastructure layer:

- **No ORM models or schemas**
- **No query builders or fluent SQL compilers**
- **No migrations or DDL generators**
- **No HTTP or web-specific dependencies**

```
Domain / Application Logic / Background Workers
                    ↓
               Phase 6: ORM
                    ↓
          Phase 5: @jsango/database
                    ↓
             Driver Adapters
                    ↓
          Database Engines (SQL)
```
