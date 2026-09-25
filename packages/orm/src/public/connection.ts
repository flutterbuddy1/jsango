import type { DatabaseManager } from '@jsango/database';

let activeDatabaseManager: DatabaseManager | undefined;

export function setDatabaseManager(manager: DatabaseManager): void {
  activeDatabaseManager = manager;
}

export function getDatabaseManager(): DatabaseManager | undefined {
  return activeDatabaseManager;
}

export function clearDatabaseManager(): void {
  activeDatabaseManager = undefined;
}
