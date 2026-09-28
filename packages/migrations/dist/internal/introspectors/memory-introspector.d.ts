import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot } from '../../public/schema.js';
export declare class MemorySchemaIntrospector {
    introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot>;
}
//# sourceMappingURL=memory-introspector.d.ts.map