import { DatabaseManager } from '@jsango/database';
let activeDatabaseManager;
export function setDatabaseManager(manager) {
    activeDatabaseManager = manager;
}
export function getDatabaseManager() {
    if (!activeDatabaseManager) {
        activeDatabaseManager = new DatabaseManager({
            default: 'default',
            connections: {
                default: {
                    driver: 'memory',
                },
            },
        });
    }
    return activeDatabaseManager;
}
export function clearDatabaseManager() {
    activeDatabaseManager = undefined;
}
//# sourceMappingURL=connection.js.map