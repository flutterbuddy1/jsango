# Database Errors & Security

All database errors inherit from `JsangoError` and include structured error codes, HTTP status mappings, and sanitized metadata.

## Error Hierarchy

```
JsangoError
  └── DatabaseError (500, ERR_DATABASE)
        ├── ConnectionError (503, ERR_DB_CONNECTION)
        ├── ConnectionAcquisitionTimeoutError (504, ERR_DB_POOL_TIMEOUT)
        ├── PoolExhaustedError (503, ERR_DB_POOL_EXHAUSTED)
        ├── QueryError (500, ERR_DB_QUERY)
        ├── TransactionError (500, ERR_DB_TRANSACTION)
        │     └── TransactionClosedError (500, ERR_DB_TRANSACTION)
        ├── IsolationLevelUnsupportedError (400, ERR_DB_ISOLATION_UNSUPPORTED)
        └── DatabaseConfigurationError (500, ERR_DB_CONFIG)
```

## Credential Masking & Security

Under no circumstances should database passwords or secret connection strings appear in logs, error objects, or stack traces.

### 1. `maskConnectionString(url)`

Replaces the password portion of database URLs with asterisks:

```typescript
maskConnectionString('postgres://admin:secret123@db.prod:5432/app');
// => 'postgres://admin:********@db.prod:5432/app'
```

### 2. `maskConnectionConfig(config)`

Produces a sanitized clone of the connection configuration, masking both `password` and any credentials embedded in `url`.
