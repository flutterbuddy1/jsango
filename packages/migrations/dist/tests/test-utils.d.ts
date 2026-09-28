import { DatabaseManager, MemoryDatabaseDriver, type IDatabaseConnection } from '@jsango/database';
export declare function createTestDatabase(): {
    manager: DatabaseManager;
    driver: MemoryDatabaseDriver;
    connection: IDatabaseConnection;
};
export declare function resetTestState(): void;
//# sourceMappingURL=test-utils.d.ts.map