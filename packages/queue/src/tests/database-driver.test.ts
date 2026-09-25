import { describe } from 'vitest';
import { runQueueDriverContractTests } from '../public/testing/contract.js';
import { DatabaseQueueDriver } from '../public/drivers/database.js';
import { DatabaseManager } from '@django-js/database';

describe('DatabaseQueueDriver Contract Tests', () => {
  runQueueDriverContractTests('DatabaseQueueDriver', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });

    const driver = new DatabaseQueueDriver({ databaseManager: db });
    await driver.ensureTable();

    return {
      driver,
      cleanup: async () => {
        await db.close();
      },
    };
  });
});
