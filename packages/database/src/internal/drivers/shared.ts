/* eslint-disable @typescript-eslint/no-explicit-any -- wraps untyped optional peer clients (pg, mysql2, better-sqlite3, node:sqlite, mongodb) */
import { maskConnectionString } from '../../public/config.js';

/**
 * Loads an optional peer package (pg, mysql2, better-sqlite3, mongodb) from the application.
 * Returns undefined when it is not installed; any other load failure is rethrown.
 */
export async function importOptional(specifier: string): Promise<any | undefined> {
  try {
    return await import(specifier);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (
      code === 'ERR_MODULE_NOT_FOUND' ||
      code === 'MODULE_NOT_FOUND' ||
      message.includes('Cannot find module') ||
      message.includes('Cannot find package') ||
      message.includes('Failed to load url')
    ) {
      return undefined;
    }
    throw err;
  }
}

export interface ConnectionTarget {
  readonly url?: string | undefined;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly username?: string | undefined;
  readonly user?: string | undefined;
}

/** Human-readable, credential-free description of where a driver is connecting. */
export function describeTarget(target: ConnectionTarget, defaultPort: number): string {
  if (target.url) {
    return maskConnectionString(target.url);
  }
  const host = target.host ?? '127.0.0.1';
  const port = target.port ?? defaultPort;
  const db = target.database ? `/${target.database}` : '';
  const user = target.username ?? target.user;
  return `${user ? `${user}@` : ''}${host}:${port}${db}`;
}

/**
 * Adds a short remediation hint for the most common connection failures.
 */
export function connectionHint(err: unknown): string | undefined {
  const code = String((err as { code?: unknown } | null)?.code ?? '');
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
    return 'The server refused the connection. Is the database running and listening on this host/port?';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'The database host name could not be resolved. Check DATABASE_HOST / DATABASE_URL.';
  }
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return 'Connecting timed out. Check firewall rules, the host/port, and whether SSL is required.';
  }
  // PostgreSQL SQLSTATE codes / MySQL error codes
  if (code === '28P01' || code === 'ER_ACCESS_DENIED_ERROR' || message.includes('password authentication failed')) {
    return 'Authentication failed. Check the username and password.';
  }
  if (code === '3D000' || code === 'ER_BAD_DB_ERROR') {
    return 'The database does not exist. Create it first (e.g. CREATE DATABASE <name>).';
  }
  if (message.includes('SSL') || message.includes('ssl')) {
    return 'SSL negotiation failed. Set ssl: true (or DATABASE_SSL=true) for servers that require SSL, or ssl: false for local servers.';
  }
  return undefined;
}

function errorReason(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length > 0) {
    // net.connect reports one error per resolved address (IPv6 + IPv4) with an empty message.
    const inner = err.errors.map((e) => (e instanceof Error ? e.message : String(e)));
    return [...new Set(inner)].join('; ');
  }
  const message = err instanceof Error ? err.message : String(err);
  return message || String((err as { code?: unknown } | null)?.code ?? 'unknown error');
}

export function formatConnectionFailure(
  driverLabel: string,
  target: string,
  err: unknown
): string {
  const reason = errorReason(err);
  const hint = connectionHint(err);
  return `Failed to connect to ${driverLabel} at ${target}: ${reason}${hint ? `\nHint: ${hint}` : ''}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Converts a JavaScript value into something a SQL client accepts as a bound parameter.
 *
 * - `undefined` -> `null`
 * - plain objects / arrays -> JSON text (JSON columns)
 * - `Date` / `boolean` handling depends on the dialect (SQLite has no native types for them)
 */
export function toSqlParam(value: unknown, dialect: 'postgres' | 'mysql' | 'sqlite'): unknown {
  if (value === undefined) return null;
  if (value === null) return null;

  if (dialect === 'sqlite') {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    // pg serializes objects itself but turns arrays into Postgres array literals, which breaks
    // JSON columns; mysql2 expands objects into `key = value` lists. JSON text is safe for all.
    return JSON.stringify(value);
  }

  return value;
}
