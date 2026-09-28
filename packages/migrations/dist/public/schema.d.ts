import type { ColumnDefinition, ColumnType, ForeignKeyAction, ForeignKeyDefinition, IndexDefinition, SchemaSnapshotData, TableDefinition, UniqueConstraintDefinition } from './types.js';
export declare class ColumnSchema {
    readonly name: string;
    readonly type: ColumnType;
    readonly nullable: boolean;
    readonly primaryKey: boolean;
    readonly autoIncrement: boolean;
    readonly unique: boolean;
    readonly defaultValue: unknown;
    readonly length?: number | undefined;
    readonly precision?: number | undefined;
    readonly scale?: number | undefined;
    readonly comment?: string | undefined;
    constructor(def: ColumnDefinition);
    equals(other: ColumnSchema): boolean;
    toJSON(): ColumnDefinition;
}
export declare class IndexSchema {
    readonly name: string;
    readonly columns: readonly string[];
    readonly unique: boolean;
    constructor(def: IndexDefinition);
    equals(other: IndexSchema): boolean;
    toJSON(): IndexDefinition;
}
export declare class ForeignKeySchema {
    readonly name: string;
    readonly columns: readonly string[];
    readonly referencedTable: string;
    readonly referencedColumns: readonly string[];
    readonly onDelete: ForeignKeyAction;
    readonly onUpdate: ForeignKeyAction;
    constructor(def: ForeignKeyDefinition);
    equals(other: ForeignKeySchema): boolean;
    toJSON(): ForeignKeyDefinition;
}
export declare class UniqueConstraintSchema {
    readonly name: string;
    readonly columns: readonly string[];
    constructor(def: UniqueConstraintDefinition);
    equals(other: UniqueConstraintSchema): boolean;
    toJSON(): UniqueConstraintDefinition;
}
export declare class TableSchema {
    readonly name: string;
    readonly columns: ReadonlyMap<string, ColumnSchema>;
    readonly primaryKey: readonly string[];
    readonly indexes: readonly IndexSchema[];
    readonly foreignKeys: readonly ForeignKeySchema[];
    readonly uniqueConstraints: readonly UniqueConstraintSchema[];
    readonly comment?: string | undefined;
    constructor(def: TableDefinition);
    getColumn(name: string): ColumnSchema | undefined;
    hasColumn(name: string): boolean;
    getColumnNames(): readonly string[];
    toJSON(): TableDefinition;
}
export declare class SchemaSnapshot {
    readonly version: number;
    readonly createdAt: string;
    readonly tables: ReadonlyMap<string, TableSchema>;
    constructor(data?: {
        version?: number;
        createdAt?: string;
        tables?: readonly TableDefinition[] | readonly TableSchema[];
    });
    getTable(name: string): TableSchema | undefined;
    hasTable(name: string): boolean;
    getTableNames(): readonly string[];
    toJSON(): SchemaSnapshotData;
    calculateChecksum(): string;
    static fromJSON(data: SchemaSnapshotData): SchemaSnapshot;
    static empty(): SchemaSnapshot;
}
//# sourceMappingURL=schema.d.ts.map