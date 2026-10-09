import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { defineModel, fields, transaction, DatabaseManager, setDatabaseManager } from './index.js';
import { clearDatabaseManager } from '@jsango/orm';

describe('ORM data safety (SQLite)', () => {
  let db: DatabaseManager;
  const Order = defineModel(
    'SafetyOrder',
    {
      id: fields.id(),
      code: fields.string(),
      views: fields.bigint({ nullable: true }),
      opensAt: fields.time({ nullable: true }),
      day: fields.date({ nullable: true }),
    },
    { table: 'safety_orders', registry: false }
  );

  beforeEach(async () => {
    db = new DatabaseManager({
      default: 'default',
      connections: { default: { driver: 'sqlite', filename: ':memory:' } },
    });
    setDatabaseManager(db);
    await db.query(
      'CREATE TABLE safety_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, views BIGINT, opensAt TEXT, day TEXT)'
    );
  });
  afterEach(async () => {
    clearDatabaseManager();
    await db.close();
  });

  it('undoes only a failed nested transaction', async () => {
    await transaction(async () => {
      await Order.create({ code: 'A' });
      await expect(
        transaction(async () => {
          await Order.create({ code: 'B' });
          await Order.create({ code: 'A' }); // unique violation
        })
      ).rejects.toThrow();
      await Order.create({ code: 'C' });
    });
    const codes = (await Order.query().get()).map((o) => o.get('code')).sort();
    expect(codes).toEqual(['A', 'C']);
  });

  it('serializes bigint, time and date fields', async () => {
    await Order.create({
      code: 'X',
      views: 12345678901n,
      opensAt: '09:30:00',
      day: '2026-10-09',
    } as never);
    const json = (await Order.query().first())!.toJSON();
    expect(JSON.parse(JSON.stringify(json))).toMatchObject({
      views: '12345678901',
      opensAt: '09:30:00',
      day: '2026-10-09',
    });
  });

  it('whereContains matches % and _ literally', async () => {
    await Order.create({ code: '50%_off' });
    await Order.create({ code: '500 off' });
    const hits = await Order.query().whereContains('code', '50%_').get();
    expect(hits.map((o) => o.get('code'))).toEqual(['50%_off']);
  });
});
