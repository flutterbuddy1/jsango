# Database Driver Abstraction

The driver abstraction allows the framework to support any relational database engine without altering upper-level code.

## Contracts

### 1. `IDatabaseDriver`

The driver factory contract:

```typescript
export interface IDatabaseDriver {
  readonly name: string;
  readonly capabilities: DatabaseCapabilities;
  connect(): Promise<IDriverConnection>;
  disconnect(): Promise<void>;
}
```

### 2. `IDriverConnection`

The low-level connection contract:

```typescript
export interface IDriverConnection {
  readonly isClosed: boolean;
  query<T>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
```

## Capability Model

Drivers explicitly declare their capabilities using `DatabaseCapabilities`:

```typescript
export interface DatabaseCapabilities {
  readonly supportsTransactions: boolean;
  readonly supportsSavepoints: boolean;
  readonly supportsIsolationLevels: boolean;
  readonly supportsReturning: boolean;
  readonly supportsCancellation: boolean;
  readonly placeholderType: 'dollar' | 'question' | 'named';
  readonly supportedIsolationLevels?: readonly IsolationLevel[];
}
```

## SQL Dialect & Parameter Placeholders

Different databases employ different parameter placeholder syntaxes:

- **SQLite / MySQL**: `?` positional placeholders
- **PostgreSQL**: `$1, $2, $3` positional placeholders

`SqlDialect` translates universal `?` placeholders into native driver syntax while strictly preserving question marks found inside string literals (e.g. `'where is this? answers?'`).
