import {
  DatabaseManager,
  MemoryDatabaseDriver,
  type IDatabaseConnection,
} from '@django-js/database';
import { defaultMigrationRegistry } from '../public/registry.js';
import { defaultModelRegistry } from '@django-js/orm';

export function createTestDatabase(): {
  manager: DatabaseManager;
  driver: MemoryDatabaseDriver;
  connection: IDatabaseConnection;
} {
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
    connection: driver as unknown as { sharedTables: unknown } as unknown as IDatabaseConnection,
  };
}

export function resetTestState(): void {
  defaultMigrationRegistry.clear();
  defaultModelRegistry.clear();
}
