import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('ORM Transaction Integration', () => {
  let db: ReturnType<typeof createTestDatabase>;

  const Account = defineModel({
    name: 'Account',
    table: 'accounts',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      owner: fields.string(),
      balance: fields.integer({ default: 0 }),
    },
  });

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
  });

  it('should commit operations executed within a transaction', async () => {
    await db.manager.transaction(async (tx) => {
      const acc1 = new Account({ owner: 'Alice', balance: 100 });
      await acc1.save({ connection: tx });

      const acc2 = new Account({ owner: 'Bob', balance: 200 });
      await acc2.save({ connection: tx });
    });

    const accounts = await Account.query().get();
    expect(accounts.length).toBe(2);
    expect(accounts.map((a) => a.owner)).toEqual(['Alice', 'Bob']);
  });

  it('should rollback operations when an error is thrown within a transaction', async () => {
    // Initial record
    await Account.create({ owner: 'Initial', balance: 50 });

    await expect(
      db.manager.transaction(async (tx) => {
        const acc = new Account({ owner: 'Charlie', balance: 300 });
        await acc.save({ connection: tx });

        // Query using transaction
        const insideTx = await Account.query().using(tx).get();
        expect(insideTx.length).toBe(2);

        throw new Error('Simulated failure during checkout');
      })
    ).rejects.toThrow('Simulated failure during checkout');

    // Outside transaction, Charlie was rolled back!
    const outsideTx = await Account.query().get();
    expect(outsideTx.length).toBe(1);
    expect(outsideTx[0]?.owner).toBe('Initial');
  });
});
