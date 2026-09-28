import type { ColumnDefinition, ForeignKeyDefinition, IndexDefinition, TableDefinition, UniqueConstraintDefinition } from './types.js';
export declare abstract class MigrationOperation {
    abstract readonly type: string;
    abstract readonly isDestructive: boolean;
    abstract readonly isReversible: boolean;
    readonly destructiveReason?: string | undefined;
    abstract getReverse(): MigrationOperation | null;
    abstract toJSON(): Record<string, unknown>;
}
export declare class CreateTableOperation extends MigrationOperation {
    readonly type = "create_table";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly table: TableDefinition;
    constructor(table: TableDefinition);
    getReverse(): DropTableOperation;
    toJSON(): Record<string, unknown>;
}
export declare class DropTableOperation extends MigrationOperation {
    readonly type = "drop_table";
    readonly isDestructive = true;
    readonly destructiveReason = "Dropping a table permanently destroys all data stored within it.";
    readonly isReversible: boolean;
    readonly tableName: string;
    readonly previousTable?: TableDefinition | undefined;
    constructor(tableName: string, previousTable?: TableDefinition);
    getReverse(): CreateTableOperation | null;
    toJSON(): Record<string, unknown>;
}
export declare class AddColumnOperation extends MigrationOperation {
    readonly type = "add_column";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly tableName: string;
    readonly column: ColumnDefinition;
    constructor(tableName: string, column: ColumnDefinition);
    getReverse(): DropColumnOperation;
    toJSON(): Record<string, unknown>;
}
export declare class DropColumnOperation extends MigrationOperation {
    readonly type = "drop_column";
    readonly isDestructive = true;
    readonly destructiveReason = "Dropping a column permanently destroys all data stored in that column.";
    readonly isReversible: boolean;
    readonly tableName: string;
    readonly columnName: string;
    readonly previousColumn?: ColumnDefinition | undefined;
    constructor(tableName: string, columnName: string, previousColumn?: ColumnDefinition);
    getReverse(): AddColumnOperation | null;
    toJSON(): Record<string, unknown>;
}
export declare class AlterColumnOperation extends MigrationOperation {
    readonly type = "alter_column";
    readonly isDestructive: boolean;
    readonly destructiveReason?: string | undefined;
    readonly isReversible = true;
    readonly tableName: string;
    readonly column: ColumnDefinition;
    readonly previousColumn: ColumnDefinition;
    constructor(tableName: string, column: ColumnDefinition, previousColumn: ColumnDefinition);
    getReverse(): AlterColumnOperation;
    toJSON(): Record<string, unknown>;
}
export declare class RenameColumnOperation extends MigrationOperation {
    readonly type = "rename_column";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly tableName: string;
    readonly oldName: string;
    readonly newName: string;
    constructor(tableName: string, oldName: string, newName: string);
    getReverse(): RenameColumnOperation;
    toJSON(): Record<string, unknown>;
}
export declare class RenameTableOperation extends MigrationOperation {
    readonly type = "rename_table";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly oldName: string;
    readonly newName: string;
    constructor(oldName: string, newName: string);
    getReverse(): RenameTableOperation;
    toJSON(): Record<string, unknown>;
}
export declare class CreateIndexOperation extends MigrationOperation {
    readonly type = "create_index";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly tableName: string;
    readonly index: IndexDefinition;
    constructor(tableName: string, index: IndexDefinition);
    getReverse(): DropIndexOperation;
    toJSON(): Record<string, unknown>;
}
export declare class DropIndexOperation extends MigrationOperation {
    readonly type = "drop_index";
    readonly isDestructive = false;
    readonly isReversible: boolean;
    readonly tableName: string;
    readonly indexName: string;
    readonly previousIndex?: IndexDefinition | undefined;
    constructor(tableName: string, indexName: string, previousIndex?: IndexDefinition);
    getReverse(): CreateIndexOperation | null;
    toJSON(): Record<string, unknown>;
}
export declare class CreateUniqueConstraintOperation extends MigrationOperation {
    readonly type = "create_unique_constraint";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly tableName: string;
    readonly constraint: UniqueConstraintDefinition;
    constructor(tableName: string, constraint: UniqueConstraintDefinition);
    getReverse(): DropUniqueConstraintOperation;
    toJSON(): Record<string, unknown>;
}
export declare class DropUniqueConstraintOperation extends MigrationOperation {
    readonly type = "drop_unique_constraint";
    readonly isDestructive = false;
    readonly isReversible: boolean;
    readonly tableName: string;
    readonly constraintName: string;
    readonly previousConstraint?: UniqueConstraintDefinition | undefined;
    constructor(tableName: string, constraintName: string, previousConstraint?: UniqueConstraintDefinition);
    getReverse(): CreateUniqueConstraintOperation | null;
    toJSON(): Record<string, unknown>;
}
export declare class AddForeignKeyOperation extends MigrationOperation {
    readonly type = "add_foreign_key";
    readonly isDestructive = false;
    readonly isReversible = true;
    readonly tableName: string;
    readonly foreignKey: ForeignKeyDefinition;
    constructor(tableName: string, foreignKey: ForeignKeyDefinition);
    getReverse(): DropForeignKeyOperation;
    toJSON(): Record<string, unknown>;
}
export declare class DropForeignKeyOperation extends MigrationOperation {
    readonly type = "drop_foreign_key";
    readonly isDestructive = false;
    readonly isReversible: boolean;
    readonly tableName: string;
    readonly foreignKeyName: string;
    readonly previousForeignKey?: ForeignKeyDefinition | undefined;
    constructor(tableName: string, foreignKeyName: string, previousForeignKey?: ForeignKeyDefinition);
    getReverse(): AddForeignKeyOperation | null;
    toJSON(): Record<string, unknown>;
}
export declare class RawSqlOperation extends MigrationOperation {
    readonly type = "raw_sql";
    readonly isDestructive: boolean;
    readonly destructiveReason?: string | undefined;
    readonly isReversible: boolean;
    readonly upSql: string;
    readonly downSql?: string | undefined;
    constructor(options: {
        upSql: string;
        downSql?: string | undefined;
        isDestructive?: boolean | undefined;
        destructiveReason?: string | undefined;
    });
    getReverse(): RawSqlOperation | null;
    toJSON(): Record<string, unknown>;
}
//# sourceMappingURL=operations.d.ts.map