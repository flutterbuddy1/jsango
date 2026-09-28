import { DatabaseManager } from '@jsango/database';

let activeDatabaseManager: DatabaseManager | undefined;

export function setDatabaseManager(manager: DatabaseManager): void {
  activeDatabaseManager = manager;
}

export function getDatabaseManager(): DatabaseManager {
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

export function clearDatabaseManager(): void {
  activeDatabaseManager = undefined;
}

