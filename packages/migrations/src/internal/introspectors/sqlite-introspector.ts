import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot, TableSchema } from '../../public/schema.js';
import type { ColumnDefinition, TableDefinition } from '../../public/types.js';

export class SqliteSchemaIntrospector {
  public async introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot> {
    const tablesRes = await connection.query<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'jsango_%'
      ORDER BY name ASC
    `);

    const tables: TableDefinition[] = [];

    for (const row of tablesRes.rows) {
      const tableName = String(row.name);

      const columnsRes = await connection.query<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>(`PRAGMA table_info("${tableName}")`);

      const columns: ColumnDefinition[] = columnsRes.rows.map((c) => ({
        name: String(c.name),
        type: this.mapSqliteType(String(c.type)),
        nullable: Number(c.notnull) === 0,
        primaryKey: Number(c.pk) > 0,
        defaultValue: c.dflt_value ?? undefined,
      }));

      tables.push({
        name: tableName,
        columns,
        primaryKey: columns.filter((c) => c.primaryKey).map((c) => c.name),
      });
    }

    return new SchemaSnapshot({
      tables: tables.map((t) => new TableSchema(t)),
    });
  }

  private mapSqliteType(sqliteType: string): ColumnDefinition['type'] {
    const upper = sqliteType.toUpperCase();
    if (upper.includes('INT')) return 'integer';
    if (upper.includes('CHAR') || upper.includes('CLOB')) return 'string';
    if (upper.includes('TEXT')) return 'text';
    if (upper.includes('BLOB')) return 'binary';
    if (upper.includes('REAL') || upper.includes('FLOA') || upper.includes('DOUB')) return 'float';
    if (upper.includes('BOOL')) return 'boolean';
    if (upper.includes('TIME') || upper.includes('DATE')) return 'dateTime';
    return 'string';
  }
}
