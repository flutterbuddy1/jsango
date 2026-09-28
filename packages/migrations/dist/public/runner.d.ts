import type { DatabaseManager } from '@jsango/database';
import { MigrationRegistry } from './registry.js';
import type { MigrateOptions, MigrationStatus, ResetOptions, RollbackOptions } from './types.js';
import type { MigrationDialect } from '../internal/compiler.js';
export declare class MigrationRunner {
    private readonly databaseManager;
    private readonly registry;
    private readonly dialect;
    constructor(options: {
        databaseManager: DatabaseManager;
        registry?: MigrationRegistry | undefined;
        dialect?: MigrationDialect | undefined;
    });
    status(connectionName?: string): Promise<MigrationStatus>;
    migrate(options?: MigrateOptions): Promise<{
        applied: readonly string[];
        batch: number;
    }>;
    rollback(options?: RollbackOptions): Promise<{
        rolledBack: readonly string[];
    }>;
    reset(options: ResetOptions): Promise<{
        rolledBack: readonly string[];
    }>;
    private executeSingleMigration;
    private executeSingleRollback;
}
//# sourceMappingURL=runner.d.ts.map