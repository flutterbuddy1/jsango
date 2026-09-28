import { MigrationError } from './errors.js';
export class MigrationRegistry {
    migrations = new Map();
    register(migration) {
        if (this.migrations.has(migration.id)) {
            throw new MigrationError({
                message: `Migration with id '${migration.id}' is already registered.`,
            });
        }
        this.migrations.set(migration.id, migration);
    }
    getMigration(id) {
        return this.migrations.get(id);
    }
    hasMigration(id) {
        return this.migrations.has(id);
    }
    getAllMigrations(connection) {
        const list = [...this.migrations.values()];
        const filtered = connection
            ? list.filter((m) => !m.connection || m.connection === connection)
            : list;
        // Strict deterministic alphabetical sort by ID (YYYYMMDDHHmmss_name)
        return Object.freeze(filtered.sort((a, b) => a.id.localeCompare(b.id)));
    }
    clear() {
        this.migrations.clear();
    }
}
export const defaultMigrationRegistry = new MigrationRegistry();
export function registerMigration(migration) {
    defaultMigrationRegistry.register(migration);
}
export function getAllMigrations(connection) {
    return defaultMigrationRegistry.getAllMigrations(connection);
}
//# sourceMappingURL=registry.js.map