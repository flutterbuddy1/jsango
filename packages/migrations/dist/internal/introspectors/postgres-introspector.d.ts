import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot } from '../../public/schema.js';
export declare class PostgresSchemaIntrospector {
    introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot>;
    private mapPostgresType;
}
//# sourceMappingURL=postgres-introspector.d.ts.map