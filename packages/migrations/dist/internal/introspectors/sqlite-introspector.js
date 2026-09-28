import { SchemaSnapshot, TableSchema } from '../../public/schema.js';
export class SqliteSchemaIntrospector {
    async introspect(connection) {
        const tablesRes = await connection.query(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'jsango_%'
      ORDER BY name ASC
    `);
        const tables = [];
        for (const row of tablesRes.rows) {
            const tableName = String(row.name);
            const columnsRes = await connection.query(`PRAGMA table_info("${tableName}")`);
            const columns = columnsRes.rows.map((c) => ({
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
    mapSqliteType(sqliteType) {
        const upper = sqliteType.toUpperCase();
        if (upper.includes('INT'))
            return 'integer';
        if (upper.includes('CHAR') || upper.includes('CLOB'))
            return 'string';
        if (upper.includes('TEXT'))
            return 'text';
        if (upper.includes('BLOB'))
            return 'binary';
        if (upper.includes('REAL') || upper.includes('FLOA') || upper.includes('DOUB'))
            return 'float';
        if (upper.includes('BOOL'))
            return 'boolean';
        if (upper.includes('TIME') || upper.includes('DATE'))
            return 'dateTime';
        return 'string';
    }
}
//# sourceMappingURL=sqlite-introspector.js.map