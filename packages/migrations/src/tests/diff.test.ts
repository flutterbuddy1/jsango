import { describe, it, expect } from 'vitest';
import { SchemaSnapshot } from '../public/schema.js';
import { SchemaDiffEngine } from '../public/diff.js';

describe('SchemaDiffEngine', () => {
  it('should detect table creations when actual schema is empty', () => {
    const expected = new SchemaSnapshot({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
            { name: 'name', type: 'string' },
          ],
        },
      ],
    });

    const actual = SchemaSnapshot.empty();
    const diff = SchemaDiffEngine.diff(expected, actual);

    expect(diff.hasChanges).toBe(true);
    expect(diff.hasDestructiveOperations).toBe(false);
    expect(diff.operations.length).toBe(1);
    expect(diff.operations[0]!.type).toBe('create_table');
  });

  it('should detect table drops and mark them destructive', () => {
    const expected = SchemaSnapshot.empty();
    const actual = new SchemaSnapshot({
      tables: [
        {
          name: 'legacy_data',
          columns: [{ name: 'id', type: 'integer', primaryKey: true }],
        },
      ],
    });

    const diff = SchemaDiffEngine.diff(expected, actual);

    expect(diff.hasChanges).toBe(true);
    expect(diff.hasDestructiveOperations).toBe(true);
    expect(diff.operations.length).toBe(1);
    expect(diff.operations[0]!.type).toBe('drop_table');
    expect(diff.operations[0]!.isDestructive).toBe(true);
  });

  it('should detect added, altered, and dropped columns', () => {
    const actual = new SchemaSnapshot({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', primaryKey: true },
            { name: 'old_field', type: 'string' },
            { name: 'bio', type: 'string', length: 255 },
          ],
        },
      ],
    });

    const expected = new SchemaSnapshot({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', primaryKey: true },
            { name: 'bio', type: 'text' }, // altered
            { name: 'new_field', type: 'integer' }, // added
          ],
        },
      ],
    });

    const diff = SchemaDiffEngine.diff(expected, actual);

    expect(diff.hasChanges).toBe(true);
    expect(diff.operations.map((op) => op.type)).toContain('add_column');
    expect(diff.operations.map((op) => op.type)).toContain('alter_column');
    expect(diff.operations.map((op) => op.type)).toContain('drop_column');

    // drop_column and type alter should be marked destructive
    expect(diff.hasDestructiveOperations).toBe(true);
  });

  it('should detect indexes, unique constraints, and foreign keys', () => {
    const actual = new SchemaSnapshot({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', primaryKey: true },
            { name: 'email', type: 'string' },
          ],
        },
      ],
    });

    const expected = new SchemaSnapshot({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'integer', primaryKey: true },
            { name: 'email', type: 'string' },
          ],
          uniqueConstraints: [{ name: 'uq_users_email', columns: ['email'] }],
          indexes: [{ name: 'idx_users_email', columns: ['email'], unique: false }],
        },
      ],
    });

    const diff = SchemaDiffEngine.diff(expected, actual);

    expect(diff.operations.map((op) => op.type)).toContain('create_unique_constraint');
    expect(diff.operations.map((op) => op.type)).toContain('create_index');
  });

  it('should produce identical deterministic operation ordering on repeated runs', () => {
    const actual = SchemaSnapshot.empty();
    const expected = new SchemaSnapshot({
      tables: [
        {
          name: 'posts',
          columns: [{ name: 'id', type: 'integer', primaryKey: true }],
        },
        {
          name: 'authors',
          columns: [{ name: 'id', type: 'integer', primaryKey: true }],
        },
        {
          name: 'categories',
          columns: [{ name: 'id', type: 'integer', primaryKey: true }],
        },
      ],
    });

    const diff1 = SchemaDiffEngine.diff(expected, actual);
    const diff2 = SchemaDiffEngine.diff(expected, actual);

    expect(diff1.operations.map((o) => o.toJSON())).toEqual(
      diff2.operations.map((o) => o.toJSON())
    );
  });
});
