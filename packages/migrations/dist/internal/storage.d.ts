import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';
import type { MigrationRecord } from '../public/types.js';
import type { Migration } from '../public/migration.js';
export type DatabaseExecutor = IDatabaseConnection | IDatabaseTransaction;
export declare class MigrationStorage {
    static readonly TABLE_NAME = "jsango_migrations";
    static ensureTable(connection: DatabaseExecutor): Promise<void>;
    static getAppliedMigrations(connection: DatabaseExecutor): Promise<readonly MigrationRecord[]>;
    static recordMigration(connection: DatabaseExecutor, migration: Migration, batch: number, checksum?: string): Promise<void>;
    static removeMigration(connection: DatabaseExecutor, id: string): Promise<void>;
    static getMaxBatch(connection: DatabaseExecutor): Promise<number>;
}
//# sourceMappingURL=storage.d.ts.map