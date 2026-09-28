import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';
import type { MigrationDefinition } from './types.js';
import type { MigrationOperation } from './operations.js';
import { type MigrationDialect } from '../internal/compiler.js';
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
export declare class MigrationContext {
    readonly connection: IDatabaseConnection | IDatabaseTransaction;
    readonly dialect: MigrationDialect;
    private readonly compiler;
    constructor(connection: IDatabaseConnection | IDatabaseTransaction, dialect?: MigrationDialect);
    sql(sql: string, params?: readonly unknown[]): Promise<void>;
    executeOperation(operation: MigrationOperation): Promise<void>;
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
export declare class Migration implements MigrationDefinition {
    readonly id: string;
    readonly name: string;
    readonly connection?: string | undefined;
    readonly operations?: readonly MigrationOperation[] | undefined;
    readonly isDestructive: boolean;
    readonly isReversible: boolean;
    private readonly upFn?;
    private readonly downFn?;
    constructor(options: MigrationOptions);
    up(ctx: MigrationContext): Promise<void>;
    down(ctx: MigrationContext): Promise<void>;
}
//# sourceMappingURL=migration.d.ts.map