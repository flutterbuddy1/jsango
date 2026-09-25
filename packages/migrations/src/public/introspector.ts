import type { IDatabaseConnection } from '@jsango/database';
import { SchemaSnapshot } from './schema.js';
import { MemorySchemaIntrospector } from '../internal/introspectors/memory-introspector.js';
import { PostgresSchemaIntrospector } from '../internal/introspectors/postgres-introspector.js';
import { SqliteSchemaIntrospector } from '../internal/introspectors/sqlite-introspector.js';
import type { MigrationDialect } from '../internal/compiler.js';

export interface ISchemaIntrospector {
  introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot>;
}

export class SchemaIntrospector implements ISchemaIntrospector {
  private readonly dialect: MigrationDialect;
  private readonly delegate: ISchemaIntrospector;

  public constructor(dialect: MigrationDialect = 'memory') {
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

  public get currentDialect(): MigrationDialect {
    return this.dialect;
  }

  public async introspect(connection: IDatabaseConnection): Promise<SchemaSnapshot> {
    return this.delegate.introspect(connection);
  }
}
