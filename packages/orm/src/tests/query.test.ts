import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { ModelNotFoundError } from '../public/errors.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('QueryBuilder', () => {
  let _db: ReturnType<typeof createTestDatabase>;

  const User = defineModel({
    name: 'User',
    table: 'users',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      name: fields.string(),
      email: fields.string({ unique: true }),
      role: fields.string({ default: 'user' }),
      active: fields.boolean({ default: true }),
    },
  });

  beforeEach(async () => {
    resetTestState();
    _db = createTestDatabase();

    // Seed test users
    await User.create({ name: 'Alice', email: 'alice@example.com', role: 'admin', active: true });
    await User.create({ name: 'Bob', email: 'bob@example.com', role: 'user', active: true });
    await User.create({
      name: 'Charlie',
      email: 'charlie@example.com',
      role: 'user',
      active: false,
    });
    await User.create({ name: 'David', email: 'david@example.com', role: 'user', active: true });
    await User.create({ name: 'Eve', email: 'eve@example.com', role: 'guest', active: false });
  });

  it('should support safe query immutability and branching', async () => {
    const base = User.query().where('active', true);
    const admins = base.where('role', 'admin');
    const users = base.where('role', 'user');

    expect(base.toSql().sql).not.toContain('"role"');
    expect(admins.toSql().sql).toContain('"role" = ?');
    expect(users.toSql().sql).toContain('"role" = ?');

    const adminResults = await admins.get();
    const userResults = await users.get();

    expect(adminResults.length).toBe(1);
    expect(adminResults[0]?.name).toBe('Alice');

    expect(userResults.length).toBe(2);
    expect(userResults.map((u) => u.name)).toEqual(['Bob', 'David']);
  });

  it('should support filtering with whereIn, whereNull, and objects', async () => {
    const byIds = await User.query().whereIn('id', [1, 2]).get();
    expect(byIds.length).toBe(2);
    expect(byIds.map((u) => u.name)).toEqual(['Alice', 'Bob']);

    const byObj = await User.query().where({ role: 'user', active: true }).get();
    expect(byObj.length).toBe(2);
  });

  it('should find by id and throw ModelNotFoundError on findOrFail', async () => {
    const found = await User.find(1);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Alice');

    const missing = await User.find(999);
    expect(missing).toBeNull();

    await expect(User.findOrFail(999)).rejects.toThrow(ModelNotFoundError);
  });

  it('should calculate count and exists efficiently without loading records', async () => {
    const totalUsers = await User.query().count();
    expect(totalUsers).toBe(5);

    const activeUsers = await User.query().where('active', true).count();
    expect(activeUsers).toBe(3);

    const hasAdmins = await User.query().where('role', 'admin').exists();
    expect(hasAdmins).toBe(true);

    const hasSuper = await User.query().where('role', 'superadmin').exists();
    expect(hasSuper).toBe(false);
  });

  it('should paginate results cleanly', async () => {
    const page1 = await User.query().orderBy('id', 'ASC').paginate({ page: 1, pageSize: 2 });
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(2);
    expect(page1.totalPages).toBe(3);
    expect(page1.items.length).toBe(2);
    expect(page1.items.map((u) => u.name)).toEqual(['Alice', 'Bob']);

    const page2 = await User.query().orderBy('id', 'ASC').paginate({ page: 2, pageSize: 2 });
    expect(page2.items.map((u) => u.name)).toEqual(['Charlie', 'David']);
  });

  it('should stream results using cursor iterator', async () => {
    const names: string[] = [];
    for await (const user of User.query().orderBy('id', 'ASC').cursor(2)) {
      names.push(user.name);
    }

    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'David', 'Eve']);
  });

  it('should support bulk update and bulk delete', async () => {
    const updatedCount = await User.query().where('role', 'user').update({ active: false });

    expect(updatedCount).toBe(3);

    const activeCount = await User.query().where('active', true).count();
    expect(activeCount).toBe(1); // Only Alice remains active

    const deletedCount = await User.query().where('role', 'guest').delete();
    expect(deletedCount).toBe(1);

    const remaining = await User.query().count();
    expect(remaining).toBe(4);
  });
});
