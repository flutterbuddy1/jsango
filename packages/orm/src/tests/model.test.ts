import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('Model & defineModel', () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
  });

  it('should instantiate and track dirty state correctly', async () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        name: fields.string(),
        email: fields.string({ unique: true }),
        role: fields.string({ default: 'user' }),
      },
      timestamps: true,
    });

    const user = new User({ name: 'Alice', email: 'alice@example.com' });
    expect(user.isNew).toBe(true);
    expect(user.isDirty()).toBe(true);
    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@example.com');

    // Save user
    await user.save();
    expect(user.isNew).toBe(false);
    expect(user.isDirty()).toBe(false);
    expect(user.id).toBe(1);
    expect(user.role).toBe('user'); // Default applied

    // Inspect executed queries
    expect(db.connection.executedQueries.length).toBe(1);
    expect(db.connection.executedQueries[0]?.sql).toContain('INSERT INTO "users"');

    // Modify a property
    user.name = 'Alice Wonderland';
    expect(user.isDirty('name')).toBe(true);
    expect(user.isDirty('email')).toBe(false);
    expect(user.getDirty()).toEqual({ name: 'Alice Wonderland' });
    expect(user.getOriginal('name')).toBe('Alice');

    // Save modified user
    await user.save();
    expect(user.isDirty()).toBe(false);
    expect(db.connection.executedQueries.length).toBe(2);
    expect(db.connection.executedQueries[1]?.sql).toContain('UPDATE "users"');

    // Saving when clean should not execute any query
    await user.save();
    expect(db.connection.executedQueries.length).toBe(2);
  });

  it('should support soft delete and force delete', async () => {
    const Article = defineModel({
      name: 'Article',
      table: 'articles',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        title: fields.string(),
        deletedAt: fields.dateTime({ nullable: true }),
      },
      softDelete: true,
    });

    const article = await Article.create({ title: 'Important Post' });
    expect(article.id).toBe(1);
    expect(article.deletedAt ?? null).toBeNull();

    // Soft delete
    await article.delete();
    expect(article.deletedAt).toBeInstanceOf(Date);

    // Verify row still exists in table with deletedAt populated
    const rows = db.connection.getTable('articles');
    expect(rows.length).toBe(1);
    expect(rows[0]?.['deletedAt']).toBeDefined();

    // Force delete
    await article.delete({ force: true });
    const remaining = db.connection.getTable('articles');
    expect(remaining.length).toBe(0);
  });

  it('should serialize to clean JSON', async () => {
    const Item = defineModel({
      name: 'Item',
      table: 'items',
      fields: {
        id: fields.integer({ primaryKey: true }),
        title: fields.string(),
        createdAt: fields.dateTime(),
      },
    });

    const now = new Date('2026-09-23T12:00:00.000Z');
    const item = new Item({ id: 1, title: 'Gadget', createdAt: now }, false);

    const json = item.toJSON();
    expect(json).toEqual({
      id: 1,
      title: 'Gadget',
      createdAt: '2026-09-23T12:00:00.000Z',
    });
    // Should NOT contain internal fields like _attributes or _isNew
    expect(json['_attributes']).toBeUndefined();
    expect(json['_isNew']).toBeUndefined();
  });
});
