import { MemorySchemaIntrospector } from '../internal/introspectors/memory-introspector.js';
import { PostgresSchemaIntrospector } from '../internal/introspectors/postgres-introspector.js';
import { SqliteSchemaIntrospector } from '../internal/introspectors/sqlite-introspector.js';
export class SchemaIntrospector {
    dialect;
    delegate;
    constructor(dialect = 'memory') {
        this.dialect = dialect;
        switch (dialect) {
            case 'postgres':
                this.delegate = new PostgresSchemaIntrospector();
                break;
            case 'sqlite':
                this.delegate = new SqliteSchemaIntrospector();
                break;
            default:
                this.delegate = new MemorySchemaIntrospector();
                break;
        }
    }
    get currentDialect() {
        return this.dialect;
    }
    async introspect(connection) {
        return this.delegate.introspect(connection);
    }
}
//# sourceMappingURL=introspector.js.map