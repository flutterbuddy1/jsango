import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot, TableSchema } from '../../public/schema.js';
import type { ColumnDefinition, TableDefinition } from '../../public/types.js';

export class MysqlSchemaIntrospector {
  public async introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot> {
    const tablesRes = await connection.query<Record<string, unknown>>(`
      SELECT TABLE_NAME AS table_name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME NOT LIKE 'jsango\\_%'
      ORDER BY TABLE_NAME ASC
    `);

    const tables: TableDefinition[] = [];

    for (const row of tablesRes.rows) {
      const tableName = String(row['table_name'] ?? row['TABLE_NAME']);

      const columnsRes = await connection.query<Record<string, unknown>>(
        `
        SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, COLUMN_TYPE AS column_type,
               IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
               CHARACTER_MAXIMUM_LENGTH AS max_length, COLUMN_KEY AS column_key, EXTRA AS extra
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION ASC
      `,
        [tableName]
      );

      const columns: ColumnDefinition[] = columnsRes.rows.map((c) => ({
        name: String(c['column_name']),
        type: this.mapMysqlType(String(c['data_type']), String(c['column_type'] ?? '')),
        nullable: c['is_nullable'] === 'YES',
        primaryKey: c['column_key'] === 'PRI',
        autoIncrement: String(c['extra'] ?? '').includes('auto_increment'),
        defaultValue: c['column_default'] ?? undefined,
        length: c['max_length'] ? Number(c['max_length']) : undefined,
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

  private mapMysqlType(dataType: string, columnType: string): ColumnDefinition['type'] {
    const lower = dataType.toLowerCase();
    if (lower === 'tinyint' && columnType.toLowerCase().startsWith('tinyint(1)')) return 'boolean';
    if (lower === 'bigint') return 'bigint';
    if (lower.includes('int')) return 'integer';
    if (lower === 'bool' || lower === 'boolean') return 'boolean';
    if (lower === 'datetime' || lower === 'timestamp') return 'dateTime';
    if (lower === 'date') return 'date';
    if (lower === 'time') return 'time';
    if (lower === 'json') return 'json';
    if (lower === 'decimal' || lower === 'numeric') return 'decimal';
    if (lower === 'double' || lower === 'float' || lower === 'real') return 'float';
    if (lower.includes('text')) return 'text';
    if (lower.includes('blob') || lower.includes('binary')) return 'binary';
    if (lower === 'char' && columnType.toLowerCase() === 'char(36)') return 'uuid';
    return 'string';
  }
}
