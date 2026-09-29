import type { DatabaseConfig, DatabaseManager } from '@jsango/database';

/**
 * Contents of `jsango.config.ts` (or `.js` / `.mjs`) at the project root.
 *
 * ```ts
 * import { defineConfig } from 'jsango';
 * import { databaseConfig } from './src/database.js';
 *
 * export default defineConfig({
 *   database: databaseConfig,
 *   models: './src/models',
 *   migrations: './migrations',
 * });
 * ```
 */
export interface JsangoProjectConfig {
  /**
   * Database used by `jsango migrate`, `db:status`, etc. Either a DatabaseConfig object or an
   * existing DatabaseManager instance. When omitted, DATABASE_URL / DATABASE_* env vars are used.
   */
  readonly database?: DatabaseConfig | DatabaseManager | (() => DatabaseConfig | DatabaseManager) | undefined;
  /**
   * Files or directories containing `defineModel()` models. Directories are scanned recursively.
   * Default: `./src/models` when it exists.
   */
  readonly models?: string | readonly string[] | undefined;
  /** Directory containing migration files. Default: `./migrations`. */
  readonly migrations?: string | { readonly directory: string } | undefined;
  /** `.env` file loaded before the config (existing environment variables win). Default: `.env`. */
  readonly envFile?: string | false | undefined;
}

/** Identity helper that gives `jsango.config.ts` type checking and editor completion. */
export function defineConfig(config: JsangoProjectConfig): JsangoProjectConfig {
  return config;
}
