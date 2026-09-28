import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot } from '../../public/schema.js';
export declare class SqliteSchemaIntrospector {
    introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot>;
    private mapSqliteType;
}
//# sourceMappingURL=sqlite-introspector.d.ts.map