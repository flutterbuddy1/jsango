import { Migration } from './migration.js';
export declare class MigrationRegistry {
    private readonly migrations;
    register(migration: Migration): void;
    getMigration(id: string): Migration | undefined;
    hasMigration(id: string): boolean;
    getAllMigrations(connection?: string): readonly Migration[];
    clear(): void;
}
export declare const defaultMigrationRegistry: MigrationRegistry;
export declare function registerMigration(migration: Migration): void;
export declare function getAllMigrations(connection?: string): readonly Migration[];
//# sourceMappingURL=registry.d.ts.map