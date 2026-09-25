import { describe, it, expect } from 'vitest';
import { SqlCompiler } from '../internal/compiler.js';
import { QueryError } from '../public/errors.js';

describe('SqlCompiler', () => {
  const compiler = new SqlCompiler({ quoteIdentifiers: true, placeholderType: 'question' });

  it('should compile simple SELECT queries', () => {
    const res = compiler.compileSelect({
      table: 'users',
      columns: ['id', 'email', 'name'],
      where: [],
      orderBy: [],
    });

    expect(res.sql).toBe('SELECT "id", "email", "name" FROM "users"');
    expect(res.params).toEqual([]);
  });

  it('should compile SELECT with WHERE, ORDER BY, LIMIT, and OFFSET', () => {
    const res = compiler.compileSelect({
      table: 'users',
      columns: ['id', 'email'],
      where: [
        { type: 'comparison', column: 'active', operator: '=', value: true, boolean: 'AND' },
        { type: 'comparison', column: 'age', operator: '>=', value: 18, boolean: 'AND' },
      ],
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit: 10,
      offset: 20,
    });

    expect(res.sql).toBe(
      'SELECT "id", "email" FROM "users" WHERE "active" = ? AND "age" >= ? ORDER BY "created_at" DESC LIMIT 10 OFFSET 20'
    );
    expect(res.params).toEqual([true, 18]);
  });

  it('should compile WHERE IN and handle empty IN lists safely', () => {
    const res1 = compiler.compileSelect({
      table: 'posts',
      columns: ['id'],
      where: [{ type: 'in', column: 'user_id', operator: 'IN', values: [1, 2, 3], boolean: 'AND' }],
      orderBy: [],
    });

    expect(res1.sql).toBe('SELECT "id" FROM "posts" WHERE "user_id" IN (?, ?, ?)');
    expect(res1.params).toEqual([1, 2, 3]);

    // Empty list compilation
    const res2 = compiler.compileSelect({
      table: 'posts',
      columns: ['id'],
      where: [{ type: 'in', column: 'user_id', operator: 'IN', values: [], boolean: 'AND' }],
      orderBy: [],
    });

    expect(res2.sql).toBe('SELECT "id" FROM "posts" WHERE 1 = 0');
    expect(res2.params).toEqual([]);
  });

  it('should compile IS NULL and IS NOT NULL', () => {
    const res = compiler.compileSelect({
      table: 'users',
      columns: ['id'],
      where: [{ type: 'null', column: 'deleted_at', operator: 'IS NULL', boolean: 'AND' }],
      orderBy: [],
    });

    expect(res.sql).toBe('SELECT "id" FROM "users" WHERE "deleted_at" IS NULL');
    expect(res.params).toEqual([]);
  });

  it('should compile INSERT queries with parameters', () => {
    const res = compiler.compileInsert({
      table: 'users',
      columns: ['name', 'email'],
      rows: [
        ['Alice', 'alice@example.com'],
        ['Bob', 'bob@example.com'],
      ],
    });

    expect(res.sql).toBe('INSERT INTO "users" ("name", "email") VALUES (?, ?), (?, ?)');
    expect(res.params).toEqual(['Alice', 'alice@example.com', 'Bob', 'bob@example.com']);
  });

  it('should compile UPDATE queries with parameters', () => {
    const res = compiler.compileUpdate({
      table: 'users',
      values: { name: 'Alice Smith', active: false },
      where: [{ type: 'comparison', column: 'id', operator: '=', value: 42, boolean: 'AND' }],
    });

    expect(res.sql).toBe('UPDATE "users" SET "name" = ?, "active" = ? WHERE "id" = ?');
    expect(res.params).toEqual(['Alice Smith', false, 42]);
  });

  it('should compile DELETE queries with parameters', () => {
    const res = compiler.compileDelete({
      table: 'users',
      where: [{ type: 'comparison', column: 'id', operator: '=', value: 1, boolean: 'AND' }],
    });

    expect(res.sql).toBe('DELETE FROM "users" WHERE "id" = ?');
    expect(res.params).toEqual([1]);
  });

  it('should compile COUNT and EXISTS queries', () => {
    const countRes = compiler.compileCount({
      table: 'users',
      where: [{ type: 'comparison', column: 'active', operator: '=', value: true, boolean: 'AND' }],
    });
    expect(countRes.sql).toBe('SELECT COUNT(*) AS "aggregate" FROM "users" WHERE "active" = ?');
    expect(countRes.params).toEqual([true]);

    const existsRes = compiler.compileExists({
      table: 'users',
      where: [
        {
          type: 'comparison',
          column: 'email',
          operator: '=',
          value: 'test@example.com',
          boolean: 'AND',
        },
      ],
    });
    expect(existsRes.sql).toBe('SELECT 1 AS "exists_flag" FROM "users" WHERE "email" = ? LIMIT 1');
    expect(existsRes.params).toEqual(['test@example.com']);
  });

  it('should support dollar placeholder compilation for PostgreSQL', () => {
    const pgCompiler = new SqlCompiler({ quoteIdentifiers: true, placeholderType: 'dollar' });
    const pgRes = pgCompiler.compileSelect({
      table: 'users',
      columns: ['id'],
      where: [
        { type: 'comparison', column: 'a', operator: '=', value: 1, boolean: 'AND' },
        { type: 'comparison', column: 'b', operator: '=', value: 2, boolean: 'AND' },
      ],
      orderBy: [],
    });

    expect(pgRes.sql).toBe('SELECT "id" FROM "users" WHERE "a" = $1 AND "b" = $2');
    expect(pgRes.params).toEqual([1, 2]);
  });

  it('should reject unsafe identifiers to prevent SQL injection', () => {
    expect(() => {
      compiler.compileSelect({
        table: 'users; DROP TABLE students;',
        columns: ['id'],
        where: [],
        orderBy: [],
      });
    }).toThrow(QueryError);

    expect(() => {
      compiler.compileSelect({
        table: 'users',
        columns: ['id; --'],
        where: [],
        orderBy: [],
      });
    }).toThrow(QueryError);
  });
});
