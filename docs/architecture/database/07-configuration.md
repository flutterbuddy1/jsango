# Database Configuration

Database configuration is integrated with `@django-js/config` to avoid hardcoding `process.env` lookups across framework packages.

## Configuration Structure

```typescript
export interface DatabaseConfig {
  readonly default: string;
  readonly connections: Record<string, ConnectionConfig>;
}

export interface ConnectionConfig {
  readonly driver: string; // 'postgres' | 'mysql' | 'sqlite' | 'memory'
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
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
import { loadDatabaseConfig } from '@django-js/database';
import { MemoryConfigProvider } from '@django-js/config';

const configProvider = new MemoryConfigProvider({
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
