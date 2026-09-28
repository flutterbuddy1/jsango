import { DatabaseManager, MemoryDatabaseDriver } from '@jsango/database';
import { defaultMigrationRegistry } from '../public/registry.js';
import { defaultModelRegistry } from '@jsango/orm';
export function createTestDatabase() {
    const driver = new MemoryDatabaseDriver();
    const manager = new DatabaseManager({
        default: 'default',
        connections: {
            default: { driver: 'memory' },
        },
    });
    manager.registerDriver('memory', driver);
    defaultMigrationRegistry.clear();
    defaultModelRegistry.clear();
    return {
        manager,
        driver,
        connection: driver,
    };
}
export function resetTestState() {
    defaultMigrationRegistry.clear();
    defaultModelRegistry.clear();
}
//# sourceMappingURL=test-utils.js.map