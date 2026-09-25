import type { IDatabaseConnection, IDatabaseTransaction } from '@django-js/database';
import type { MigrationDefinition } from './types.js';
import type { MigrationOperation } from './operations.js';
import { SqlMigrationCompiler, type MigrationDialect } from '../internal/compiler.js';
import { IrreversibleMigrationError } from './errors.js';

export interface SchemaBuilder {
  createTable(name: string, callback: (table: TableBuilder) => void): Promise<void>;
  dropTable(name: string): Promise<void>;
  addColumn(tableName: string, colDef: unknown): Promise<void>;
  dropColumn(tableName: string, columnName: string): Promise<void>;
  raw(sql: string, params?: readonly unknown[]): Promise<void>;
}

export interface TableBuilder {
  integer(name: string): ColumnModifier;
  string(name: string, length?: number): ColumnModifier;
  text(name: string): ColumnModifier;
  boolean(name: string): ColumnModifier;
  dateTime(name: string): ColumnModifier;
  json(name: string): ColumnModifier;
  uuid(name: string): ColumnModifier;
}

export interface ColumnModifier {
  primaryKey(): ColumnModifier;
  autoIncrement(): ColumnModifier;
  nullable(): ColumnModifier;
  unique(): ColumnModifier;
  default(val: unknown): ColumnModifier;
}

export class MigrationContext {
  public readonly connection: IDatabaseConnection | IDatabaseTransaction;
  public readonly dialect: MigrationDialect;
  private readonly compiler: SqlMigrationCompiler;

  public constructor(
    connection: IDatabaseConnection | IDatabaseTransaction,
    dialect: MigrationDialect = 'memory'
  ) {
    this.connection = connection;
    this.dialect = dialect;
    this.compiler = new SqlMigrationCompiler(dialect);
  }

  public async sql(sql: string, params?: readonly unknown[]): Promise<void> {
    await this.connection.query(sql, params);
  }

  public async executeOperation(operation: MigrationOperation): Promise<void> {
    const ddl = this.compiler.compile(operation);
    await this.sql(ddl);
  }
}

export interface MigrationOptions {
  readonly id: string;
  readonly name: string;
  readonly connection?: string | undefined;
  readonly up?: ((ctx: MigrationContext) => Promise<void>) | undefined;
  readonly down?: ((ctx: MigrationContext) => Promise<void>) | undefined;
  readonly operations?: readonly MigrationOperation[] | undefined;
  readonly isDestructive?: boolean | undefined;
}

export class Migration implements MigrationDefinition {
  public readonly id: string;
  public readonly name: string;
  public readonly connection?: string | undefined;
  public readonly operations?: readonly MigrationOperation[] | undefined;
  public readonly isDestructive: boolean;
  public readonly isReversible: boolean;

  private readonly upFn?: ((ctx: MigrationContext) => Promise<void>) | undefined;
  private readonly downFn?: ((ctx: MigrationContext) => Promise<void>) | undefined;

  public constructor(options: MigrationOptions) {
    this.id = options.id;
    this.name = options.name;
    this.connection = options.connection;
    this.operations = options.operations ? Object.freeze([...options.operations]) : undefined;
    this.upFn = options.up;
    this.downFn = options.down;

    if (this.operations) {
      this.isDestructive = options.isDestructive ?? this.operations.some((op) => op.isDestructive);
      this.isReversible = this.operations.every((op) => op.isReversible);
    } else {
      this.isDestructive = options.isDestructive ?? false;
      this.isReversible = this.downFn !== undefined;
    }

    Object.freeze(this);
  }

  public async up(ctx: MigrationContext): Promise<void> {
    if (this.upFn) {
      await this.upFn(ctx);
      return;
    }
    if (this.operations) {
      for (const op of this.operations) {
        await ctx.executeOperation(op);
      }
      return;
    }
    throw new Error(`Migration '${this.id}' has neither up function nor operations defined.`);
  }

  public async down(ctx: MigrationContext): Promise<void> {
    if (this.downFn) {
      await this.downFn(ctx);
      return;
    }
    if (this.operations) {
      // Revert operations in reverse order
      for (let i = this.operations.length - 1; i >= 0; i--) {
        const op = this.operations[i]!;
        const rev = op.getReverse();
        if (!rev) {
          throw new IrreversibleMigrationError(this.id, op.type);
        }
        await ctx.executeOperation(rev);
      }
      return;
    }
    throw new IrreversibleMigrationError(this.id);
  }
}
