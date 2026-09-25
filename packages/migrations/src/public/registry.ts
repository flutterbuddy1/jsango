import { Migration } from './migration.js';
import { MigrationError } from './errors.js';

export class MigrationRegistry {
  private readonly migrations = new Map<string, Migration>();

  public register(migration: Migration): void {
    if (this.migrations.has(migration.id)) {
      throw new MigrationError({
        message: `Migration with id '${migration.id}' is already registered.`,
      });
    }
    this.migrations.set(migration.id, migration);
  }

  public getMigration(id: string): Migration | undefined {
    return this.migrations.get(id);
  }

  public hasMigration(id: string): boolean {
    return this.migrations.has(id);
  }

  public getAllMigrations(connection?: string): readonly Migration[] {
    const list = [...this.migrations.values()];
    const filtered = connection
      ? list.filter((m) => !m.connection || m.connection === connection)
      : list;

    // Strict deterministic alphabetical sort by ID (YYYYMMDDHHmmss_name)
    return Object.freeze(filtered.sort((a, b) => a.id.localeCompare(b.id)));
  }

  public clear(): void {
    this.migrations.clear();
  }
}

export const defaultMigrationRegistry = new MigrationRegistry();

export function registerMigration(migration: Migration): void {
  defaultMigrationRegistry.register(migration);
}

export function getAllMigrations(connection?: string): readonly Migration[] {
  return defaultMigrationRegistry.getAllMigrations(connection);
}
