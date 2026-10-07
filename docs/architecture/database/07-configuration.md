# Database Configuration

Database configuration is integrated with `@jsango/config` to avoid hardcoding `process.env` lookups across framework packages.

## Configuration Structure

```typescript
import type { PoolConfig } from '@jsango/database';

export interface DatabaseConfig {
  readonly default: string;
  readonly connections: Record<string, ConnectionConfig>;
}

export interface ConnectionConfig {
  // 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'mongodb' | 'memory' (or a custom driver).
  // May be omitted when `url` is set; it is inferred from the URL scheme.
  readonly driver?: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly filename?: string; // sqlite
  readonly username?: string;
  readonly password?: string;
  readonly url?: string;
  readonly ssl?: boolean | Record<string, unknown>;
  readonly pool?: PoolConfig;
  readonly options?: Record<string, unknown>;
}
```

## Loading Configuration

```typescript
import { loadDatabaseConfig } from '@jsango/database';
import { createConfigProvider } from '@jsango/config';

const configProvider = createConfigProvider({
  'database.default': 'primary',
  'database.connections': {
    primary: {
      driver: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'app_dev',
      username: 'postgres',
      password: 'password',
      pool: { min: 5, max: 20 },
    },
  },
});

const dbConfig = loadDatabaseConfig(configProvider);
```
