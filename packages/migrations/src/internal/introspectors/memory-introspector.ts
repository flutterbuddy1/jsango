import type { IDatabaseConnection } from '@django-js/database';
import { SchemaSnapshot, TableSchema } from '../../public/schema.js';
import type { ColumnDefinition, TableDefinition } from '../../public/types.js';

export class MemorySchemaIntrospector {
  public async introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot> {
    // If the underlying connection has access to tables
    const tableNames: string[] = [];

    // Check if conn has tables map or driver
    const anyConn = connection as unknown as {
      tables?: Map<string, Record<string, unknown>[]>;
      sharedTables?: Map<string, Record<string, unknown>[]>;
      rawConnection?: {
        tables?: Map<string, Record<string, unknown>[]>;
        sharedTables?: Map<string, Record<string, unknown>[]>;
      };
    };

    const tablesMap =
      anyConn.tables ??
      anyConn.sharedTables ??
      anyConn.rawConnection?.tables ??
      anyConn.rawConnection?.sharedTables;
    if (tablesMap) {
      for (const t of tablesMap.keys()) {
        if (!t.startsWith('django_js_')) {
          tableNames.push(t);
        }
      }
    }

    const tables: TableDefinition[] = [];

    for (const tableName of tableNames) {
      const rows = tablesMap?.get(tableName) ?? [];
      const colsMap = new Map<string, ColumnDefinition>();

      // Sample rows to infer columns
      if (rows.length > 0) {
        for (const row of rows) {
          for (const [key, val] of Object.entries(row)) {
            if (!colsMap.has(key)) {
              let type: ColumnDefinition['type'] = 'string';
              if (typeof val === 'number') {
                type = Number.isInteger(val) ? 'integer' : 'float';
              } else if (typeof val === 'bigint') {
                type = 'bigint';
              } else if (typeof val === 'boolean') {
                type = 'boolean';
              } else if (val instanceof Date) {
                type = 'dateTime';
              } else if (typeof val === 'object' && val !== null) {
                type = 'json';
              }

              colsMap.set(key, {
                name: key,
                type,
                primaryKey: key.toLowerCase() === 'id',
                nullable: val === null || val === undefined,
              });
            }
          }
        }
      } else {
        // Fallback default id column if table is empty
        colsMap.set('id', {
          name: 'id',
          type: 'integer',
          primaryKey: true,
          autoIncrement: true,
          nullable: false,
        });
      }

      tables.push({
        name: tableName,
        columns: [...colsMap.values()],
        primaryKey: [...colsMap.values()].filter((c) => c.primaryKey).map((c) => c.name),
      });
    }

    return new SchemaSnapshot({
      tables: tables.map((t) => new TableSchema(t)),
    });
  }
}
