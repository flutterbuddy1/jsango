import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Migration, type MigrationOptions } from './migration.js';
import { MigrationRegistry } from './registry.js';
import { MigrationError } from './errors.js';

const MIGRATION_FILE =
  /^(?!.*\.d\.[cm]?ts$)(?!.*\.(test|spec)\.)(?!index\.).+\.(ts|mts|cts|js|mjs|cjs)$/;

export interface LoadedMigrations {
  readonly registry: MigrationRegistry;
  readonly migrations: readonly Migration[];
  /** Absolute path of the file each migration id was loaded from. */
  readonly files: ReadonlyMap<string, string>;
}

function isMigrationOptions(value: unknown): value is MigrationOptions {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (typeof (value as { up?: unknown }).up === 'function' ||
      Array.isArray((value as { operations?: unknown }).operations))
  );
}

/** Lists migration files in a directory, sorted by file name (i.e. by timestamp prefix). */
export function listMigrationFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_FILE.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

/**
 * Imports every migration file in `directory` and registers it.
 *
 * A file must `export default` a Migration (as written by `jsango migrate:generate`), a
 * `defineMigration({...})` result, or a plain `{ id, up, down }` object. TypeScript files require
 * a TypeScript-aware loader; the jsango CLI registers one automatically.
 */
export async function loadMigrationsFromDirectory(
  directory: string,
  options?: { registry?: MigrationRegistry | undefined }
): Promise<LoadedMigrations> {
  const registry = options?.registry ?? new MigrationRegistry();
  const files = new Map<string, string>();
  const migrations: Migration[] = [];

  for (const file of listMigrationFiles(directory)) {
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const hint =
        /\.[cm]?ts$/.test(file) && /Unknown file extension/.test(reason)
          ? ' TypeScript migrations must be loaded through the jsango CLI (npx jsango migrate) or a TypeScript loader such as tsx.'
          : '';
      throw new MigrationError({
        message: `Failed to load migration file ${path.relative(process.cwd(), file)}: ${reason}${hint}`,
        cause: err,
      });
    }

    const candidates = [
      mod['default'],
      ...Object.entries(mod)
        .filter(([k]) => k !== 'default')
        .map(([, v]) => v),
    ];
    const found = candidates.filter(
      (value, index, all) =>
        (value instanceof Migration || isMigrationOptions(value)) && all.indexOf(value) === index
    );

    if (found.length === 0) {
      throw new MigrationError({
        message: `Migration file ${path.relative(process.cwd(), file)} does not export a migration. Use \`export default defineMigration({ id, up, down })\`.`,
      });
    }

    for (const value of found) {
      const migration =
        value instanceof Migration ? value : new Migration(value as MigrationOptions);
      const previous = files.get(migration.id);
      if (previous) {
        throw new MigrationError({
          message: `Duplicate migration id '${migration.id}' in ${path.basename(previous)} and ${path.basename(file)}.`,
        });
      }
      if (!registry.hasMigration(migration.id)) {
        registry.register(migration);
      }
      files.set(migration.id, file);
      migrations.push(migration);
    }
  }

  return { registry, migrations, files };
}
