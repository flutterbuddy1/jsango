import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel, fields } from '@jsango/orm';
import { DriftDetector } from '../public/drift.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('DriftDetector', () => {
  let db: ReturnType<typeof createTestDatabase>;
  let driftDetector: DriftDetector;

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
    driftDetector = new DriftDetector('memory');
  });

  it('should detect drift when database does not have tables defined in ORM', async () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        name: fields.string(),
      },
    });

    const conn = await db.manager.connection('default');
    try {
      const result = await driftDetector.detectDrift(conn, [User.metadata]);
      expect(result.hasDrift).toBe(true);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(result.differences[0]).toContain('create_table');
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  });

  it('should detect no drift when database schema matches ORM models', async () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true }),
        name: fields.string(),
      },
    });

    const conn = await db.manager.connection('default');
    try {
      // Seed table matching User model
      db.driver.seed('users', [{ id: 1, name: 'Alice' }]);

      const result = await driftDetector.detectDrift(conn, [User.metadata]);
      expect(result.hasDrift).toBe(false);
      expect(result.differences).toEqual([]);
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  });
});
