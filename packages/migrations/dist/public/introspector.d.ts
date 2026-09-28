import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot } from './schema.js';
import type { MigrationDialect } from '../internal/compiler.js';
export interface ISchemaIntrospector {
    introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot>;
}
export declare class SchemaIntrospector implements ISchemaIntrospector {
    private readonly dialect;
    private readonly delegate;
    constructor(dialect?: MigrationDialect);
    get currentDialect(): MigrationDialect;
    introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot>;
}
//# sourceMappingURL=introspector.d.ts.map