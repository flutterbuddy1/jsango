import type { IConfigProvider } from '@jsango/config';
import { DatabaseConfigurationError } from './errors.js';

export interface PoolConfig {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly acquireTimeoutMs?: number | undefined;
  readonly idleTimeoutMs?: number | undefined;
  readonly connectionTimeoutMs?: number | undefined;
  readonly maxLifetimeMs?: number | undefined;
}

export interface ConnectionConfig {
  /**
   * Driver name: 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'mongodb' | 'memory' (or a custom
   * registered driver). May be omitted when `url` is set; it is inferred from the URL scheme.
   */
  readonly driver?: string | undefined;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly filename?: string | undefined;
  readonly username?: string | undefined;
  readonly password?: string | undefined;
  readonly url?: string | undefined;
  readonly ssl?: boolean | Record<string, unknown> | undefined;
  readonly pool?: PoolConfig | undefined;
  /**
   * Cancels a query running longer than this (PostgreSQL, MySQL). A hung query otherwise holds a
   * pooled connection forever. Per query: `{ timeoutMs }`. Default: no limit.
   */
  readonly queryTimeoutMs?: number | undefined;
  readonly options?: Record<string, unknown> | undefined;
}

export interface DatabaseConfig {
  readonly default: string;
  readonly connections: Record<string, ConnectionConfig>;
}

export interface ResolvedPoolConfig {
  readonly min: number;
  readonly max: number;
  readonly acquireTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly maxLifetimeMs: number;
}

export const DEFAULT_POOL_CONFIG: ResolvedPoolConfig = {
  min: 2,
  max: 10,
  acquireTimeoutMs: 10000,
  idleTimeoutMs: 30000,
  connectionTimeoutMs: 5000,
  maxLifetimeMs: 1800000, // 30 minutes
};

/**
 * Masks the password in a database connection URL string (e.g., postgres://user:pass@host/db).
 */
export function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '********';
    }
    return parsed.toString();
  } catch {
    // If not a valid standard URL, mask using regex fallback
    return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1********$3');
  }
}

/**
 * Creates a sanitized copy of a ConnectionConfig with sensitive credentials masked.
 */
export function maskConnectionConfig(config: ConnectionConfig): ConnectionConfig {
  return {
    ...config,
    password: config.password ? '********' : undefined,
    url: config.url ? maskConnectionString(config.url) : undefined,
  };
}

const URL_SCHEME_DRIVERS: Readonly<Record<string, string>> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  pg: 'postgres',
  mysql: 'mysql',
  mysql2: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  sqlite3: 'sqlite',
  file: 'sqlite',
  mongodb: 'mongodb',
  'mongodb+srv': 'mongodb',
  memory: 'memory',
};

/**
 * Extracts the SQLite filename from `sqlite:./app.db`, `sqlite://./app.db`,
 * `sqlite:///abs/path.db`, `file:./app.db` or `sqlite::memory:` style URLs.
 */
export function parseSqliteFilename(url: string): string {
  const stripped = url.replace(/^(sqlite3?|file):/i, '');
  if (stripped === ':memory:' || stripped === '//:memory:') {
    return ':memory:';
  }
  // sqlite:///abs/path -> /abs/path ; sqlite://./rel -> ./rel ; sqlite:rel -> rel
  if (stripped.startsWith('///')) return stripped.slice(2);
  if (stripped.startsWith('//')) return stripped.slice(2);
  return stripped.split('?')[0] ?? stripped;
}

/**
 * Parses a standard database connection URL into ConnectionConfig properties.
 */
export function parseConnectionUrl(url: string): Partial<ConnectionConfig> {
  const scheme = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();
  if (scheme && URL_SCHEME_DRIVERS[scheme] === 'sqlite') {
    return { driver: 'sqlite', filename: parseSqliteFilename(url), url };
  }

  try {
    const parsed = new URL(url);
    const driver = parsed.protocol.replace(':', '');
    const database = parsed.pathname
      ? decodeURIComponent(parsed.pathname.replace(/^\//, ''))
      : undefined;
    const port = parsed.port ? parseInt(parsed.port, 10) : undefined;

    return {
      driver,
      host: parsed.hostname || undefined,
      port: Number.isNaN(port) ? undefined : port,
      database: database || undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      url,
    };
  } catch (err) {
    throw new DatabaseConfigurationError(
      `Failed to parse database connection URL: ${maskConnectionString(url)}`,
      { cause: err instanceof Error ? err.message : String(err) }
    );
  }
}

/**
 * Returns the canonical driver for a URL scheme (`postgresql://` -> 'postgres'), if known.
 */
export function driverFromUrl(url: string): string | undefined {
  const scheme = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();
  return scheme ? URL_SCHEME_DRIVERS[scheme] : undefined;
}

/**
 * Validates a connection entry and fills in the driver from `url` when it is omitted.
 * Empty-string values (common with unset env vars) are treated as not set.
 */
export function resolveConnectionConfig(
  name: string,
  config: ConnectionConfig
): ConnectionConfig & { driver: string } {
  if (!config || typeof config !== 'object') {
    throw new DatabaseConfigurationError(`Database connection "${name}" must be an object.`);
  }

  const url =
    typeof config.url === 'string' && config.url.trim() !== '' ? config.url.trim() : undefined;
  const explicitDriver =
    typeof config.driver === 'string' && config.driver.trim() !== ''
      ? config.driver.trim()
      : undefined;
  const driver = explicitDriver ?? (url ? driverFromUrl(url) : undefined);

  if (!driver) {
    throw new DatabaseConfigurationError(
      `Database connection "${name}" has no driver. Set "driver" (postgres, mysql, sqlite, mongodb, memory) or a "url" such as postgres://user:pass@host:5432/db.`
    );
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === '' || value === undefined) continue;
    cleaned[key] = value;
  }

  return { ...(cleaned as ConnectionConfig), driver, url };
}

/**
 * Loads a structured DatabaseConfig from an IConfigProvider.
 */
export function loadDatabaseConfig(provider: IConfigProvider, prefix = 'database'): DatabaseConfig {
  const defaultConnection = provider.getString(`${prefix}.default`, 'default');
  const rawConnections = provider.get<Record<string, ConnectionConfig>>(
    `${prefix}.connections`,
    {}
  );

  if (!rawConnections || typeof rawConnections !== 'object') {
    throw new DatabaseConfigurationError(
      `Database configuration at "${prefix}.connections" must be a valid connection map.`
    );
  }

  return {
    default: defaultConnection,
    connections: rawConnections,
  };
}

function envFlagToSsl(value: string | undefined): ConnectionConfig['ssl'] {
  if (value === undefined || value === '') return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'require' || v === 'verify-full') return true;
  if (v === 'no-verify' || v === 'allow-self-signed') return { rejectUnauthorized: false };
  if (v === 'false' || v === '0' || v === 'disable') return false;
  return undefined;
}

function envNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Builds a single-connection DatabaseConfig from environment variables:
 *
 * | Variable              | Meaning                                                      |
 * |-----------------------|--------------------------------------------------------------|
 * | DATABASE_URL          | Full URL, e.g. postgres://user:pass@host:5432/db (wins)      |
 * | DATABASE_DRIVER       | postgres, mysql, mariadb, sqlite, mongodb, memory            |
 * | DATABASE_HOST / PORT  | Server address                                               |
 * | DATABASE_NAME         | Database (schema) name                                       |
 * | DATABASE_USER / PASSWORD | Credentials                                               |
 * | DATABASE_FILE         | SQLite file (default ./db.sqlite3)                           |
 * | DATABASE_SSL          | true / require, no-verify, false                             |
 * | DATABASE_POOL_MIN/MAX | Pool size                                                    |
 * | DATABASE_QUERY_TIMEOUT | Milliseconds before a query is cancelled (PostgreSQL, MySQL) |
 *
 * With nothing set, it uses SQLite at ./db.sqlite3.
 */
export function databaseConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  options?: { prefix?: string; defaultDriver?: string; defaultSqliteFile?: string }
): DatabaseConfig {
  const p = options?.prefix ?? 'DATABASE';
  const get = (key: string): string | undefined => {
    const value = env[`${p}_${key}`];
    return value === undefined || value.trim() === '' ? undefined : value.trim();
  };

  const url = get('URL');
  const driver =
    get('DRIVER') ?? (url ? driverFromUrl(url) : undefined) ?? options?.defaultDriver ?? 'sqlite';
  const poolMin = envNumber(get('POOL_MIN'));
  const poolMax = envNumber(get('POOL_MAX'));

  const connection: ConnectionConfig = {
    driver,
    url,
    host: get('HOST'),
    port: envNumber(get('PORT')),
    database: get('NAME'),
    username: get('USER'),
    password: get('PASSWORD'),
    filename:
      driver === 'sqlite' && !url
        ? (get('FILE') ?? options?.defaultSqliteFile ?? './db.sqlite3')
        : undefined,
    ssl: envFlagToSsl(get('SSL')),
    pool:
      poolMin !== undefined || poolMax !== undefined ? { min: poolMin, max: poolMax } : undefined,
    queryTimeoutMs: envNumber(get('QUERY_TIMEOUT')),
  };

  return { default: 'default', connections: { default: connection } };
}
