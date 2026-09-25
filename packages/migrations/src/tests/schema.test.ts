import { describe, it, expect } from 'vitest';
import {
  ColumnSchema,
  IndexSchema,
  ForeignKeySchema,
  UniqueConstraintSchema,
  TableSchema,
  SchemaSnapshot,
} from '../public/schema.js';

describe('Schema Representation', () => {
  it('should create and freeze ColumnSchema with default values', () => {
    const col = new ColumnSchema({
      name: 'email',
      type: 'string',
      nullable: false,
      unique: true,
      length: 120,
    });

    expect(col.name).toBe('email');
    expect(col.type).toBe('string');
    expect(col.nullable).toBe(false);
    expect(col.unique).toBe(true);
    expect(col.length).toBe(120);
    expect(Object.isFrozen(col)).toBe(true);

    const same = new ColumnSchema({
      name: 'email',
      type: 'string',
      nullable: false,
      unique: true,
      length: 120,
    });
    expect(col.equals(same)).toBe(true);

    const diff = new ColumnSchema({
      name: 'email',
      type: 'string',
      nullable: true,
      unique: true,
    });
    expect(col.equals(diff)).toBe(false);
  });

  it('should create and verify IndexSchema, ForeignKeySchema, and UniqueConstraintSchema', () => {
    const idx = new IndexSchema({
      name: 'idx_users_email',
      columns: ['email'],
      unique: true,
    });
    expect(idx.name).toBe('idx_users_email');
    expect(idx.columns).toEqual(['email']);
    expect(idx.unique).toBe(true);

    const fk = new ForeignKeySchema({
      name: 'fk_posts_user_id',
      columns: ['user_id'],
      referencedTable: 'users',
      referencedColumns: ['id'],
      onDelete: 'CASCADE',
    });
    expect(fk.name).toBe('fk_posts_user_id');
    expect(fk.referencedTable).toBe('users');
    expect(fk.onDelete).toBe('CASCADE');

    const uc = new UniqueConstraintSchema({
      name: 'uq_users_username',
      columns: ['username'],
    });
    expect(uc.name).toBe('uq_users_username');
    expect(uc.columns).toEqual(['username']);
  });

  it('should create TableSchema and SchemaSnapshot with checksum and JSON serialization', () => {
    const snapshot = new SchemaSnapshot({
      version: 1,
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string', unique: true },
          ],
          indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false }],
        },
      ],
    });

    expect(snapshot.hasTable('users')).toBe(true);
    expect(snapshot.hasTable('posts')).toBe(false);
    expect(snapshot.getTableNames()).toEqual(['users']);

    const table = snapshot.getTable('users')!;
    expect(table).toBeInstanceOf(TableSchema);
    expect(table.hasColumn('name')).toBe(true);
    expect(table.hasColumn('missing')).toBe(false);
    expect(table.primaryKey).toEqual(['id']);

    const checksum1 = snapshot.calculateChecksum();
    expect(typeof checksum1).toBe('string');
    expect(checksum1.length).toBeGreaterThan(0);

    const json = snapshot.toJSON();
    const reconstructed = SchemaSnapshot.fromJSON(json);
    expect(reconstructed.calculateChecksum()).toBe(checksum1);
  });
});
