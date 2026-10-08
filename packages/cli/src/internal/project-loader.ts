import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseManager, databaseConfigFromEnv, type DatabaseConfig } from '@jsango/database';
import { setDatabaseManager } from '@jsango/orm';
import {
  loadMigrationsFromDirectory,
  MigrationRegistry,
  type LoadedMigrations,
} from '@jsango/migrations';
import { CliError } from '../public/errors.js';
import { ExitCode } from '../public/types.js';
import type { JsangoProjectConfig } from '../public/project-config.js';

export const CONFIG_FILE_NAMES = [
  'jsango.config.ts',
  'jsango.config.mts',
  'jsango.config.js',
  'jsango.config.mjs',
] as const;

const SOURCE_FILE = /^(?!.*\.d\.[cm]?ts$)(?!.*\.(test|spec)\.).+\.(ts|mts|cts|js|mjs|cjs)$/;

export class ProjectLoadError extends CliError {
  public constructor(message: string, cause?: unknown) {
    super({ code: 'ERR_CLI_PROJECT_LOAD', message, exitCode: ExitCode.CONFIG_ERROR, cause });
  }
}

export interface LoadedProject {
  readonly rootDir: string;
  readonly configFile: string | undefined;
  readonly config: JsangoProjectConfig;
  /** Undefined when neither the config nor the environment defines a database. */
  readonly databaseManager: DatabaseManager | undefined;
  /** Where the database configuration came from, for diagnostics. */
  readonly databaseSource: 'config' | 'env' | 'none';
  /** True when the CLI created the manager (and must close it); false for app-owned instances. */
  readonly ownsDatabaseManager: boolean;
  readonly migrationsDir: string;
  readonly migrations: LoadedMigrations;
  readonly modelFiles: readonly string[];
}

let typeScriptRegistered = false;

/**
 * Enables importing .ts files (config, models, migrations) with Node's `.js`-extension import
 * convention, via tsx. Safe to call repeatedly.
 */
export async function enableTypeScript(): Promise<void> {
  if (typeScriptRegistered) return;
  // Already running under a TypeScript-aware loader (inside a vitest worker, or node --import tsx)?
  // (Not the VITEST env var: child processes spawned from a test inherit it but have no loader.)
  if ('__vitest_worker__' in globalThis || process.execArgv.some((a) => a.includes('tsx'))) {
    typeScriptRegistered = true;
    return;
  }
  try {
    const api = (await import('tsx/esm/api')) as { register: () => unknown };
    api.register();
    typeScriptRegistered = true;
  } catch (err) {
    throw new ProjectLoadError(
      `Loading TypeScript project files requires 'tsx', which could not be loaded: ${err instanceof Error ? err.message : String(err)}. Reinstall dependencies (npm install), or point jsango at compiled .js files.`,
      err
    );
  }
}

/**
 * Minimal .env parser: KEY=value lines, optional `export`, quotes and # comments.
 * Variables already present in the environment are never overwritten.
 */
export function loadEnvFile(file: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!fs.existsSync(file)) return false;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (env[key] === undefined) env[key] = value;
  }
  return true;
}

export function findConfigFile(rootDir: string): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = path.join(rootDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function listSourceFiles(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (SOURCE_FILE.test(entry.name)) out.push(full);
  }
  return out.sort();
}

async function importFile(file: string, what: string): Promise<Record<string, unknown>> {
  if (/\.[cm]?ts$/.test(file)) {
    await enableTypeScript();
  }
  try {
    return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ProjectLoadError(
      `Failed to load ${what} ${path.relative(process.cwd(), file) || file}: ${reason}`,
      err
    );
  }
}

function isDatabaseManager(value: unknown): value is DatabaseManager {
  return (
    value instanceof DatabaseManager ||
    (typeof value === 'object' &&
      value !== null &&
      typeof (value as DatabaseManager).connection === 'function' &&
      typeof (value as DatabaseManager).close === 'function')
  );
}

function envDefinesDatabase(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env['DATABASE_URL']?.trim() || env['DATABASE_DRIVER']?.trim());
}

/**
 * Loads the project at `rootDir`: `.env`, `jsango.config.*`, the database, models and
 * migration files. Relative paths in the config resolve against the project root.
 */
export async function loadProject(rootDir: string): Promise<LoadedProject> {
  const configFile = findConfigFile(rootDir);

  // Relative SQLite files and paths in user config are relative to the project root, exactly as
  // when the app is started with `npm start` from there.
  if (path.resolve(process.cwd()) !== path.resolve(rootDir)) {
    process.chdir(rootDir);
  }

  let config: JsangoProjectConfig = {};
  const envFile = path.join(rootDir, '.env');
  loadEnvFile(envFile);

  if (configFile) {
    const mod = await importFile(configFile, 'config file');
    const exported = (mod['default'] ?? mod['config']) as JsangoProjectConfig | undefined;
    if (!exported || typeof exported !== 'object') {
      throw new ProjectLoadError(
        `${path.basename(configFile)} must \`export default defineConfig({ ... })\`.`
      );
    }
    config = exported;
    if (config.envFile && path.resolve(rootDir, config.envFile) !== envFile) {
      loadEnvFile(path.resolve(rootDir, config.envFile));
    }
  }

  // Database
  let databaseManager: DatabaseManager | undefined;
  let databaseSource: LoadedProject['databaseSource'] = 'none';
  let ownsDatabaseManager = false;
  const rawDb = typeof config.database === 'function' ? config.database() : config.database;
  try {
    if (rawDb) {
      ownsDatabaseManager = !isDatabaseManager(rawDb);
      databaseManager = isDatabaseManager(rawDb)
        ? rawDb
        : new DatabaseManager(rawDb as DatabaseConfig);
      databaseSource = 'config';
    } else if (envDefinesDatabase(process.env)) {
      databaseManager = new DatabaseManager(databaseConfigFromEnv(process.env));
      databaseSource = 'env';
      ownsDatabaseManager = true;
    }
  } catch (err) {
    throw new ProjectLoadError(
      `Invalid database configuration${configFile ? ` in ${path.basename(configFile)}` : ''}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
  if (databaseManager) {
    // Models used by commands (and imported model files) run against the same manager.
    setDatabaseManager(databaseManager);
  }

  // Models
  const modelTargets =
    config.models === undefined
      ? [path.join(rootDir, 'src', 'models')]
      : (typeof config.models === 'string' ? [config.models] : [...config.models]).map((m) =>
          path.resolve(rootDir, m)
        );
  const modelFiles: string[] = [];
  for (const target of modelTargets) {
    if (config.models !== undefined && !fs.existsSync(target)) {
      throw new ProjectLoadError(
        `Models path "${path.relative(rootDir, target)}" from the config does not exist.`
      );
    }
    for (const file of listSourceFiles(target)) {
      await importFile(file, 'model file');
      modelFiles.push(file);
    }
  }

  // Migrations
  const migrationsSetting =
    typeof config.migrations === 'object' ? config.migrations.directory : config.migrations;
  const migrationsDir = path.resolve(rootDir, migrationsSetting ?? 'migrations');
  if (
    fs.existsSync(migrationsDir) &&
    fs.readdirSync(migrationsDir).some((f) => /\.[cm]?ts$/.test(f))
  ) {
    await enableTypeScript();
  }
  let migrations: LoadedMigrations;
  try {
    migrations = await loadMigrationsFromDirectory(migrationsDir, {
      registry: new MigrationRegistry(),
    });
  } catch (err) {
    throw new ProjectLoadError(err instanceof Error ? err.message : String(err), err);
  }

  return {
    rootDir,
    configFile,
    config,
    databaseManager,
    databaseSource,
    ownsDatabaseManager,
    migrationsDir,
    migrations,
    modelFiles,
  };
}

/** Help text shown when a database command runs without any database configuration. */
export function missingDatabaseHelp(rootDir: string): string {
  return [
    'No database is configured for this project.',
    '',
    `Create ${path.join(rootDir, 'jsango.config.ts')}:`,
    '',
    "  import { defineConfig, databaseConfigFromEnv } from 'jsango';",
    '  export default defineConfig({',
    '    database: databaseConfigFromEnv(),   // reads DATABASE_URL or DATABASE_* from .env',
    "    models: './src/models',",
    "    migrations: './migrations',",
    '  });',
    '',
    'or set DATABASE_URL (e.g. postgres://user:pass@localhost:5432/app) in .env.',
  ].join('\n');
}
