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
  readonly driver: string;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly username?: string | undefined;
  readonly password?: string | undefined;
  readonly url?: string | undefined;
  readonly ssl?: boolean | Record<string, unknown> | undefined;
  readonly pool?: PoolConfig | undefined;
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

/**
 * Parses a standard database connection URL into ConnectionConfig properties.
 */
export function parseConnectionUrl(url: string): Partial<ConnectionConfig> {
  try {
    const parsed = new URL(url);
    const driver = parsed.protocol.replace(':', '');
    const database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined;
    const port = parsed.port ? parseInt(parsed.port, 10) : undefined;

    return {
      driver,
      host: parsed.hostname || undefined,
      port: Number.isNaN(port) ? undefined : port,
      database: database || undefined,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
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
