import type { IConfigProvider } from '@jsango/config';
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
export declare const DEFAULT_POOL_CONFIG: ResolvedPoolConfig;
/**
 * Masks the password in a database connection URL string (e.g., postgres://user:pass@host/db).
 */
export declare function maskConnectionString(url: string): string;
/**
 * Creates a sanitized copy of a ConnectionConfig with sensitive credentials masked.
 */
export declare function maskConnectionConfig(config: ConnectionConfig): ConnectionConfig;
/**
 * Parses a standard database connection URL into ConnectionConfig properties.
 */
export declare function parseConnectionUrl(url: string): Partial<ConnectionConfig>;
/**
 * Loads a structured DatabaseConfig from an IConfigProvider.
 */
export declare function loadDatabaseConfig(provider: IConfigProvider, prefix?: string): DatabaseConfig;
//# sourceMappingURL=config.d.ts.map