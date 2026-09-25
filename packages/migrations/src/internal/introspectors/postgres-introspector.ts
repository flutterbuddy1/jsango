import type { IDatabaseConnection } from '@django-js/database';
import { SchemaSnapshot, TableSchema } from '../../public/schema.js';
import type { ColumnDefinition, TableDefinition } from '../../public/types.js';

export class PostgresSchemaIntrospector {
  public async introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot> {
    const tablesRes = await connection.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'django_js_%'
      ORDER BY table_name ASC
    `);

    const tables: TableDefinition[] = [];

    for (const row of tablesRes.rows) {
      const tableName = String(row.table_name);

      const columnsRes = await connection.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        character_maximum_length: number | null;
      }>(
        `
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ?
        ORDER BY ordinal_position ASC
      `,
        [tableName]
      );

      const columns: ColumnDefinition[] = columnsRes.rows.map((c) => ({
        name: String(c.column_name),
        type: this.mapPostgresType(String(c.data_type)),
        nullable: c.is_nullable === 'YES',
        defaultValue: c.column_default ?? undefined,
        length: c.character_maximum_length ? Number(c.character_maximum_length) : undefined,
      }));

      tables.push({
        name: tableName,
        columns,
      });
    }

    return new SchemaSnapshot({
      tables: tables.map((t) => new TableSchema(t)),
    });
  }

  private mapPostgresType(pgType: string): ColumnDefinition['type'] {
    const lower = pgType.toLowerCase();
    if (lower.includes('bigint') || lower.includes('bigserial')) return 'bigint';
    if (lower.includes('int') || lower.includes('serial')) return 'integer';
    if (lower.includes('bool')) return 'boolean';
    if (lower.includes('timestamp')) return 'dateTime';
    if (lower.includes('date')) return 'date';
    if (lower.includes('time')) return 'time';
    if (lower.includes('json')) return 'json';
    if (lower.includes('uuid')) return 'uuid';
    if (lower.includes('numeric') || lower.includes('decimal')) return 'decimal';
    if (lower.includes('double') || lower.includes('real')) return 'float';
    if (lower.includes('text')) return 'text';
    return 'string';
  }
}
