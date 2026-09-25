import { describe, it, expect } from 'vitest';
import { SqliteSchemaIntrospector } from '../internal/introspectors/sqlite-introspector.js';
import { PostgresSchemaIntrospector } from '../internal/introspectors/postgres-introspector.js';
import type { IDatabaseConnection } from '@django-js/database';

describe('Dialect Schema Introspectors', () => {
  it('should introspect SQLite schema from pragma queries', async () => {
    const mockSqliteConn: Partial<IDatabaseConnection> = {
      query: async (sql: string) => {
        if (sql.includes('sqlite_master')) {
          return {
            rows: [{ name: 'products' }],
            rowCount: 1,
          };
        }
        if (sql.includes('PRAGMA table_info')) {
          return {
            rows: [
              { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { name: 'title', type: 'VARCHAR(255)', notnull: 1, dflt_value: null, pk: 0 },
              { name: 'price', type: 'REAL', notnull: 0, dflt_value: '0.0', pk: 0 },
            ],
            rowCount: 3,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const introspector = new SqliteSchemaIntrospector();
    const snapshot = await introspector.introspect(
      mockSqliteConn as unknown as IDatabaseConnection
    );

    expect(snapshot.hasTable('products')).toBe(true);
    const table = snapshot.getTable('products')!;
    expect(table.primaryKey).toEqual(['id']);
    expect(table.getColumn('id')?.type).toBe('integer');
    expect(table.getColumn('title')?.type).toBe('string');
    expect(table.getColumn('price')?.type).toBe('float');
  });

  it('should introspect PostgreSQL schema from information_schema', async () => {
    const mockPgConn: Partial<IDatabaseConnection> = {
      query: async (sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return {
            rows: [{ table_name: 'orders' }],
            rowCount: 1,
          };
        }
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              {
                column_name: 'id',
                data_type: 'bigint',
                is_nullable: 'NO',
                column_default: null,
                character_maximum_length: null,
              },
              {
                column_name: 'total',
                data_type: 'numeric',
                is_nullable: 'NO',
                column_default: '0',
                character_maximum_length: null,
              },
            ],
            rowCount: 2,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const introspector = new PostgresSchemaIntrospector();
    const snapshot = await introspector.introspect(mockPgConn as unknown as IDatabaseConnection);

    expect(snapshot.hasTable('orders')).toBe(true);
    const table = snapshot.getTable('orders')!;
    expect(table.getColumn('id')?.type).toBe('bigint');
    expect(table.getColumn('total')?.type).toBe('decimal');
  });
});
