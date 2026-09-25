import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('Bulk Operations', () => {
  let db: ReturnType<typeof createTestDatabase>;

  const LogEntry = defineModel({
    name: 'LogEntry',
    table: 'log_entries',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      level: fields.string(),
      message: fields.string(),
    },
  });

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
  });

  it('should insert multiple records in a single bulkCreate operation', async () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      level: i % 2 === 0 ? 'INFO' : 'WARN',
      message: `Message ${i}`,
    }));

    db.connection.executedQueries.length = 0;
    const inserted = await LogEntry.bulkCreate(entries);

    // Verify exactly 1 query executed
    expect(db.connection.executedQueries.length).toBe(1);
    expect(db.connection.executedQueries[0]?.sql).toContain('INSERT INTO "log_entries"');
    expect(inserted.length).toBe(50);

    const total = await LogEntry.query().count();
    expect(total).toBe(50);
  });

  it('should bulk update and delete matching records efficiently', async () => {
    await LogEntry.bulkCreate([
      { level: 'INFO', message: 'Ready' },
      { level: 'INFO', message: 'Running' },
      { level: 'ERROR', message: 'Crash' },
    ]);

    const updatedCount = await LogEntry.query().where('level', 'INFO').update({ level: 'DEBUG' });

    expect(updatedCount).toBe(2);

    const infoCount = await LogEntry.query().where('level', 'INFO').count();
    expect(infoCount).toBe(0);

    const debugCount = await LogEntry.query().where('level', 'DEBUG').count();
    expect(debugCount).toBe(2);

    const deletedCount = await LogEntry.query().where('level', 'ERROR').delete();
    expect(deletedCount).toBe(1);

    const remaining = await LogEntry.query().count();
    expect(remaining).toBe(2);
  });
});
