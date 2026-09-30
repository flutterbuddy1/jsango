import type { IDatabaseConnection, IDatabaseTransaction, MongoCommand, DatabaseResult } from '@jsango/database';
import type {
  ColumnDefinition,
  ColumnType,
  ForeignKeyAction,
  ForeignKeyDefinition,
  IndexDefinition,
  MigrationDefinition,
  TableDefinition,
  UniqueConstraintDefinition,
} from './types.js';
import {
  AddColumnOperation,
  AddForeignKeyOperation,
  AlterColumnOperation,
  CreateIndexOperation,
  CreateTableOperation,
  CreateUniqueConstraintOperation,
  DropColumnOperation,
  DropForeignKeyOperation,
  DropIndexOperation,
  DropTableOperation,
  DropUniqueConstraintOperation,
  RenameColumnOperation,
  RenameTableOperation,
  type MigrationOperation,
} from './operations.js';
import {
  SqlMigrationCompiler,
  SqliteRebuildRequired,
  type MigrationDialect,
} from '../internal/compiler.js';
import { rebuildSqliteTable } from '../internal/sqlite-rebuild.js';
import { compileMongoOperation } from '../internal/mongo-compiler.js';
import { SchemaState } from './state.js';
import { IrreversibleMigrationError, MigrationError } from './errors.js';

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

type MutableColumn = { -readonly [K in keyof ColumnDefinition]: ColumnDefinition[K] };

/** Fluent modifiers for a column declared in a TableBuilder. */
export class ColumnModifier {
  /** @internal */
  public readonly def: MutableColumn;
  private readonly table: TableBuilder;

  public constructor(table: TableBuilder, def: MutableColumn) {
    this.table = table;
    this.def = def;
  }

  public primaryKey(): this {
    this.def.primaryKey = true;
    this.def.nullable = false;
    return this;
  }

  public autoIncrement(): this {
    this.def.autoIncrement = true;
    return this;
  }

  /** Allows NULL values (columns are NOT NULL by default, matching ORM fields). */
  public nullable(value = true): this {
    this.def.nullable = value;
    return this;
  }

  public notNull(): this {
    this.def.nullable = false;
    return this;
  }

  /** Adds a unique constraint named `uq_<table>_<column>`. */
  public unique(name?: string): this {
    this.table.unique([this.def.name], name);
    return this;
  }

  /** Adds an index named `idx_<table>_<column>`. */
  public index(name?: string): this {
    this.table.index([this.def.name], name);
    return this;
  }

  public default(value: unknown): this {
    this.def.defaultValue = value;
    return this;
  }

  public length(length: number): this {
    this.def.length = length;
    return this;
  }

  public comment(text: string): this {
    this.def.comment = text;
    return this;
  }

  /**
   * Adds a foreign key from this column: `t.integer('userId').references('users')`.
   * Defaults to the referenced table's `id` column and ON DELETE CASCADE.
   */
  public references(
    table: string,
    column = 'id',
    options?: { onDelete?: ForeignKeyAction; onUpdate?: ForeignKeyAction; name?: string }
  ): this {
    this.table.foreign(this.def.name, table, column, options);
    return this;
  }
}

/** Declares columns, indexes and constraints for `ctx.createTable()`. */
export class TableBuilder {
  public readonly name: string;
  private readonly columns: MutableColumn[] = [];
  private readonly indexes: IndexDefinition[] = [];
  private readonly uniques: UniqueConstraintDefinition[] = [];
  private readonly foreignKeys: ForeignKeyDefinition[] = [];
  private compositePrimaryKey: string[] | undefined;

  public constructor(name: string) {
    this.name = name;
  }

  public column(name: string, type: ColumnType, extra?: Partial<ColumnDefinition>): ColumnModifier {
    const def: MutableColumn = { name, type, nullable: false, ...extra };
    const existing = this.columns.findIndex((c) => c.name === name);
    if (existing >= 0) this.columns.splice(existing, 1);
    this.columns.push(def);
    return new ColumnModifier(this, def);
  }

  /** Auto-incrementing integer primary key (default name `id`). */
  public id(name = 'id'): ColumnModifier {
    return this.column(name, 'integer', { primaryKey: true, autoIncrement: true });
  }

  /** Auto-incrementing BIGINT primary key (default name `id`). */
  public bigId(name = 'id'): ColumnModifier {
    return this.column(name, 'bigint', { primaryKey: true, autoIncrement: true });
  }

  /** ObjectId primary key (native `_id` on MongoDB, VARCHAR(24) on SQL databases). */
  public objectIdKey(name = 'id'): ColumnModifier {
    return this.column(name, 'string', { primaryKey: true, length: 24, objectId: true });
  }

  /** ObjectId reference column (native ObjectId on MongoDB, VARCHAR(24) on SQL databases). */
  public objectId(name: string): ColumnModifier {
    return this.column(name, 'string', { length: 24, objectId: true });
  }

  public string(name: string, length = 255): ColumnModifier {
    return this.column(name, 'string', { length });
  }
  public text(name: string): ColumnModifier {
    return this.column(name, 'text');
  }
  public integer(name: string): ColumnModifier {
    return this.column(name, 'integer');
  }
  public bigint(name: string): ColumnModifier {
    return this.column(name, 'bigint');
  }
  public float(name: string): ColumnModifier {
    return this.column(name, 'float');
  }
  public decimal(name: string, precision = 10, scale = 2): ColumnModifier {
    return this.column(name, 'decimal', { precision, scale });
  }
  public boolean(name: string): ColumnModifier {
    return this.column(name, 'boolean');
  }
  public dateTime(name: string): ColumnModifier {
    return this.column(name, 'dateTime');
  }
  public date(name: string): ColumnModifier {
    return this.column(name, 'date');
  }
  public time(name: string): ColumnModifier {
    return this.column(name, 'time');
  }
  public json(name: string): ColumnModifier {
    return this.column(name, 'json');
  }
  public uuid(name: string): ColumnModifier {
    return this.column(name, 'uuid');
  }
  public binary(name: string): ColumnModifier {
    return this.column(name, 'binary');
  }

  /** `createdAt` / `updatedAt` columns, matching models defined with `timestamps: true`. */
  public timestamps(createdAt = 'createdAt', updatedAt = 'updatedAt'): void {
    this.dateTime(createdAt);
    this.dateTime(updatedAt);
  }

  /** Nullable `deletedAt` column, matching models defined with `softDelete: true`. */
  public softDeletes(column = 'deletedAt'): ColumnModifier {
    return this.dateTime(column).nullable();
  }

  public primary(columns: readonly string[]): void {
    this.compositePrimaryKey = [...columns];
  }

  public index(columns: readonly string[], name?: string): void {
    this.indexes.push({ name: name ?? `idx_${this.name}_${columns.join('_')}`, columns: [...columns], unique: false });
  }

  public unique(columns: readonly string[], name?: string): void {
    this.uniques.push({ name: name ?? `uq_${this.name}_${columns.join('_')}`, columns: [...columns] });
  }

  public foreign(
    column: string | readonly string[],
    referencedTable: string,
    referencedColumn: string | readonly string[] = 'id',
    options?: { onDelete?: ForeignKeyAction; onUpdate?: ForeignKeyAction; name?: string }
  ): void {
    const columns = typeof column === 'string' ? [column] : [...column];
    const refColumns = typeof referencedColumn === 'string' ? [referencedColumn] : [...referencedColumn];
    this.foreignKeys.push({
      name: options?.name ?? `fk_${this.name}_${columns.join('_')}`,
      columns,
      referencedTable,
      referencedColumns: refColumns,
      onDelete: options?.onDelete ?? 'CASCADE',
      onUpdate: options?.onUpdate ?? 'CASCADE',
    });
  }

  public toDefinition(): TableDefinition {
    const columns = this.columns.map((c) => ({ ...c }));
    const pk = this.compositePrimaryKey ?? columns.filter((c) => c.primaryKey).map((c) => c.name);
    if (this.compositePrimaryKey) {
      for (const c of columns) {
        if (this.compositePrimaryKey.includes(c.name)) {
          c.primaryKey = true;
          c.nullable = false;
        }
      }
    }
    return {
      name: this.name,
      columns,
      primaryKey: pk.length > 0 ? pk : undefined,
      indexes: [...this.indexes],
      uniqueConstraints: [...this.uniques],
      foreignKeys: [...this.foreignKeys],
    };
  }
}

/** Minimal schema-builder surface kept for backwards compatibility. */
export interface SchemaBuilder {
  createTable(name: string, callback: (table: TableBuilder) => void): Promise<void>;
  dropTable(name: string): Promise<void>;
  addColumn(tableName: string, colDef: ColumnDefinition): Promise<void>;
  dropColumn(tableName: string, columnName: string): Promise<void>;
  raw(sql: string, params?: readonly unknown[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Migration context
// ---------------------------------------------------------------------------

export interface MigrationContextOptions {
  /**
   * When set, schema operations are recorded here instead of executed and ctx.sql() is a no-op.
   * Used to compute the schema produced by hand-written migrations without a database.
   */
  readonly recordTo?: MigrationOperation[] | undefined;
  /**
   * Schema before this migration (replayed from earlier migrations). Operations update it as they
   * run. MongoDB needs it to regenerate collection validators and indexes.
   */
  readonly schemaState?: SchemaState | undefined;
}

/**
 * Passed to a migration's `up`/`down` functions. Use the schema helpers (`createTable`,
 * `addColumn`, `addIndex`, ...) for portable DDL, or `sql()` for anything else.
 */
export class MigrationContext implements SchemaBuilder {
  public readonly connection: IDatabaseConnection | IDatabaseTransaction;
  public readonly dialect: MigrationDialect;
  private readonly compiler: SqlMigrationCompiler;
  private readonly recordTo: MigrationOperation[] | undefined;
  /** Schema as of the operations executed so far. */
  public readonly schema: SchemaState;

  public constructor(
    connection: IDatabaseConnection | IDatabaseTransaction,
    dialect: MigrationDialect = 'memory',
    options?: MigrationContextOptions
  ) {
    this.connection = connection;
    this.dialect = dialect;
    this.compiler = new SqlMigrationCompiler(dialect);
    this.recordTo = options?.recordTo;
    this.schema = options?.schemaState ?? new SchemaState();
  }

  /** True while the migration is being replayed to compute schema state (nothing is executed). */
  public get isDryRun(): boolean {
    return this.recordTo !== undefined;
  }

  /** Executes raw SQL. Skipped (no-op) when the migration is only being replayed. */
  public async sql(sql: string, params?: readonly unknown[]): Promise<void> {
    if (this.recordTo) return;
    if (this.dialect === 'mongodb') {
      throw new MigrationError({
        message: 'ctx.sql() is not available on MongoDB. Use ctx.execute({ op: "updateMany", collection: "users", filter: {}, update: { $set: {...} } }) for data migrations.',
      });
    }
    await this.connection.query(sql, params);
  }

  /**
   * Runs a MongoDB command (data migrations, custom indexes, ...). Skipped while the migration is
   * only being replayed.
   *
   * ```ts
   * await ctx.execute({ op: 'updateMany', collection: 'users', filter: { role: null }, update: { $set: { role: 'member' } } });
   * ```
   */
  public async execute<T = Record<string, unknown>>(command: MongoCommand): Promise<DatabaseResult<T>> {
    if (this.recordTo) return { rows: [], rowCount: 0 };
    if (typeof this.connection.execute !== 'function') {
      throw new MigrationError({ message: 'ctx.execute() is only available on MongoDB connections; use ctx.sql() instead.' });
    }
    return this.connection.execute<T>(command);
  }

  public async raw(sql: string, params?: readonly unknown[]): Promise<void> {
    await this.sql(sql, params);
  }

  /** Compiles and executes a schema operation for the connection's dialect. */
  public async executeOperation(operation: MigrationOperation): Promise<void> {
    if (this.recordTo) {
      this.recordTo.push(operation);
      return;
    }

    if (this.dialect === 'mongodb') {
      const before = this.schema.clone();
      this.schema.apply(operation);
      for (const command of compileMongoOperation(operation, before, this.schema)) {
        await this.execute(command);
      }
      return;
    }

    this.schema.apply(operation);
    let statements: string[];
    try {
      statements = this.compiler.compileStatements(operation);
    } catch (err) {
      if (err instanceof SqliteRebuildRequired) {
        await rebuildSqliteTable(this.connection, this.compiler, operation);
        return;
      }
      throw err;
    }

    for (const statement of statements) {
      await this.connection.query(statement);
    }
  }

  public async createTable(name: string, callback: (table: TableBuilder) => void): Promise<void> {
    const builder = new TableBuilder(name);
    callback(builder);
    await this.executeOperation(new CreateTableOperation(builder.toDefinition()));
  }

  public async dropTable(name: string, previous?: TableDefinition): Promise<void> {
    await this.executeOperation(new DropTableOperation(name, previous));
  }

  public async renameTable(oldName: string, newName: string): Promise<void> {
    await this.executeOperation(new RenameTableOperation(oldName, newName));
  }

  /**
   * Adds a column: `ctx.addColumn('users', { name: 'age', type: 'integer', nullable: true })`.
   */
  public async addColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    await this.executeOperation(new AddColumnOperation(tableName, column));
  }

  public async dropColumn(tableName: string, columnName: string, previous?: ColumnDefinition): Promise<void> {
    await this.executeOperation(new DropColumnOperation(tableName, columnName, previous));
  }

  public async alterColumn(
    tableName: string,
    column: ColumnDefinition,
    previous: ColumnDefinition
  ): Promise<void> {
    await this.executeOperation(new AlterColumnOperation(tableName, column, previous));
  }

  public async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    await this.executeOperation(new RenameColumnOperation(tableName, oldName, newName));
  }

  public async addIndex(
    tableName: string,
    columns: readonly string[],
    options?: { name?: string; unique?: boolean }
  ): Promise<void> {
    await this.executeOperation(
      new CreateIndexOperation(tableName, {
        name: options?.name ?? `idx_${tableName}_${columns.join('_')}`,
        columns: [...columns],
        unique: options?.unique ?? false,
      })
    );
  }

  public async dropIndex(tableName: string, indexName: string): Promise<void> {
    await this.executeOperation(new DropIndexOperation(tableName, indexName));
  }

  public async addUnique(tableName: string, columns: readonly string[], name?: string): Promise<void> {
    await this.executeOperation(
      new CreateUniqueConstraintOperation(tableName, {
        name: name ?? `uq_${tableName}_${columns.join('_')}`,
        columns: [...columns],
      })
    );
  }

  public async dropUnique(tableName: string, name: string): Promise<void> {
    await this.executeOperation(new DropUniqueConstraintOperation(tableName, name));
  }

  public async addForeignKey(tableName: string, foreignKey: ForeignKeyDefinition): Promise<void> {
    await this.executeOperation(new AddForeignKeyOperation(tableName, foreignKey));
  }

  public async dropForeignKey(tableName: string, name: string, previous?: ForeignKeyDefinition): Promise<void> {
    await this.executeOperation(new DropForeignKeyOperation(tableName, name, previous));
  }
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

export interface MigrationOptions {
  readonly id: string;
  readonly name?: string | undefined;
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
    if (!options || typeof options.id !== 'string' || options.id.trim() === '') {
      throw new MigrationError({ message: 'A migration requires a non-empty string id.' });
    }
    this.id = options.id;
    this.name = options.name ?? options.id.replace(/^\d+_/, '');
    this.connection = options.connection;
    this.operations = options.operations ? Object.freeze([...options.operations]) : undefined;
    this.upFn = options.up;
    this.downFn = options.down;

    if (!this.upFn && !this.operations) {
      throw new MigrationError({
        message: `Migration '${this.id}' must define either an up() function or an operations list.`,
      });
    }

    if (this.operations && !this.upFn) {
      this.isDestructive = options.isDestructive ?? this.operations.some((op) => op.isDestructive);
      this.isReversible = this.downFn !== undefined || this.operations.every((op) => op.isReversible);
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

  /**
   * Schema operations this migration performs, without touching a database. For migrations
   * with an `up()` function, it is run against a recording context; raw `ctx.sql()` calls are
   * opaque and skipped.
   */
  public async collectOperations(dialect: MigrationDialect = 'memory'): Promise<MigrationOperation[]> {
    if (this.operations && !this.upFn) {
      return [...this.operations];
    }
    const recorded: MigrationOperation[] = [];
    const ctx = new MigrationContext(RECORDING_CONNECTION, dialect, { recordTo: recorded });
    await this.up(ctx);
    return recorded;
  }
}

/** Connection stub for recording contexts: every query returns an empty result. */
const RECORDING_CONNECTION: IDatabaseConnection = {
  isReleased: false,
  async query() {
    return { rows: [], rowCount: 0 };
  },
  async beginTransaction() {
    throw new MigrationError({ message: 'Transactions are not available while replaying migrations.' });
  },
  async transaction() {
    throw new MigrationError({ message: 'Transactions are not available while replaying migrations.' });
  },
  async ping() {
    return true;
  },
  async release() {
    return undefined;
  },
};

/**
 * Convenience factory for hand-written migrations:
 *
 * ```ts
 * export default defineMigration({
 *   id: '20260101120000_create_users',
 *   async up(ctx) {
 *     await ctx.createTable('users', (t) => {
 *       t.id();
 *       t.string('email').unique();
 *       t.timestamps();
 *     });
 *   },
 *   async down(ctx) {
 *     await ctx.dropTable('users');
 *   },
 * });
 * ```
 */
export function defineMigration(options: MigrationOptions): Migration {
  return new Migration(options);
}

