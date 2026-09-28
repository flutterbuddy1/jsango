export class MigrationOperation {
    destructiveReason;
}
export class CreateTableOperation extends MigrationOperation {
    type = 'create_table';
    isDestructive = false;
    isReversible = true;
    table;
    constructor(table) {
        super();
        this.table = table;
        Object.freeze(this);
    }
    getReverse() {
        return new DropTableOperation(this.table.name, this.table);
    }
    toJSON() {
        return { type: this.type, table: this.table };
    }
}
export class DropTableOperation extends MigrationOperation {
    type = 'drop_table';
    isDestructive = true;
    destructiveReason = 'Dropping a table permanently destroys all data stored within it.';
    isReversible;
    tableName;
    previousTable;
    constructor(tableName, previousTable) {
        super();
        this.tableName = tableName;
        this.previousTable = previousTable;
        this.isReversible = previousTable !== undefined;
        Object.freeze(this);
    }
    getReverse() {
        if (!this.previousTable) {
            return null;
        }
        return new CreateTableOperation(this.previousTable);
    }
    toJSON() {
        return { type: this.type, tableName: this.tableName, previousTable: this.previousTable };
    }
}
export class AddColumnOperation extends MigrationOperation {
    type = 'add_column';
    isDestructive = false;
    isReversible = true;
    tableName;
    column;
    constructor(tableName, column) {
        super();
        this.tableName = tableName;
        this.column = column;
        Object.freeze(this);
    }
    getReverse() {
        return new DropColumnOperation(this.tableName, this.column.name, this.column);
    }
    toJSON() {
        return { type: this.type, tableName: this.tableName, column: this.column };
    }
}
export class DropColumnOperation extends MigrationOperation {
    type = 'drop_column';
    isDestructive = true;
    destructiveReason = 'Dropping a column permanently destroys all data stored in that column.';
    isReversible;
    tableName;
    columnName;
    previousColumn;
    constructor(tableName, columnName, previousColumn) {
        super();
        this.tableName = tableName;
        this.columnName = columnName;
        this.previousColumn = previousColumn;
        this.isReversible = previousColumn !== undefined;
        Object.freeze(this);
    }
    getReverse() {
        if (!this.previousColumn) {
            return null;
        }
        return new AddColumnOperation(this.tableName, this.previousColumn);
    }
    toJSON() {
        return {
            type: this.type,
            tableName: this.tableName,
            columnName: this.columnName,
            previousColumn: this.previousColumn,
        };
    }
}
export class AlterColumnOperation extends MigrationOperation {
    type = 'alter_column';
    isDestructive;
    destructiveReason;
    isReversible = true;
    tableName;
    column;
    previousColumn;
    constructor(tableName, column, previousColumn) {
        super();
        this.tableName = tableName;
        this.column = column;
        this.previousColumn = previousColumn;
        // Detect destructive alterations
        let destructive = false;
        let reason;
        if (previousColumn.nullable && !column.nullable && column.defaultValue === undefined) {
            destructive = true;
            reason = `Changing column '${column.name}' from nullable to non-nullable without default may fail if nulls exist.`;
        }
        else if (previousColumn.length !== undefined &&
            column.length !== undefined &&
            column.length < previousColumn.length) {
            destructive = true;
            reason = `Shrinking column '${column.name}' length from ${previousColumn.length} to ${column.length} may truncate existing data.`;
        }
        else if (previousColumn.type !== column.type) {
            destructive = true;
            reason = `Changing column '${column.name}' type from ${previousColumn.type} to ${column.type} may fail or corrupt data.`;
        }
        this.isDestructive = destructive;
        this.destructiveReason = reason;
        Object.freeze(this);
    }
    getReverse() {
        return new AlterColumnOperation(this.tableName, this.previousColumn, this.column);
    }
    toJSON() {
        return {
            type: this.type,
            tableName: this.tableName,
            column: this.column,
            previousColumn: this.previousColumn,
        };
    }
}
export class RenameColumnOperation extends MigrationOperation {
    type = 'rename_column';
    isDestructive = false;
    isReversible = true;
    tableName;
    oldName;
    newName;
    constructor(tableName, oldName, newName) {
        super();
        this.tableName = tableName;
        this.oldName = oldName;
        this.newName = newName;
        Object.freeze(this);
    }
    getReverse() {
        return new RenameColumnOperation(this.tableName, this.newName, this.oldName);
    }
    toJSON() {
        return {
            type: this.type,
            tableName: this.tableName,
            oldName: this.oldName,
            newName: this.newName,
        };
    }
}
export class RenameTableOperation extends MigrationOperation {
    type = 'rename_table';
    isDestructive = false;
    isReversible = true;
    oldName;
    newName;
    constructor(oldName, newName) {
        super();
        this.oldName = oldName;
        this.newName = newName;
        Object.freeze(this);
    }
    getReverse() {
        return new RenameTableOperation(this.newName, this.oldName);
    }
    toJSON() {
        return { type: this.type, oldName: this.oldName, newName: this.newName };
    }
}
export class CreateIndexOperation extends MigrationOperation {
    type = 'create_index';
    isDestructive = false;
    isReversible = true;
    tableName;
    index;
    constructor(tableName, index) {
        super();
        this.tableName = tableName;
        this.index = index;
        Object.freeze(this);
    }
    getReverse() {
        return new DropIndexOperation(this.tableName, this.index.name, this.index);
    }
    toJSON() {
        return { type: this.type, tableName: this.tableName, index: this.index };
    }
}
export class DropIndexOperation extends MigrationOperation {
    type = 'drop_index';
    isDestructive = false;
    isReversible;
    tableName;
    indexName;
    previousIndex;
    constructor(tableName, indexName, previousIndex) {
        super();
        this.tableName = tableName;
        this.indexName = indexName;
        this.previousIndex = previousIndex;
        this.isReversible = previousIndex !== undefined;
        Object.freeze(this);
    }
    getReverse() {
        if (!this.previousIndex) {
            return null;
        }
        return new CreateIndexOperation(this.tableName, this.previousIndex);
    }
    toJSON() {
        return {
            type: this.type,
            tableName: this.tableName,
            indexName: this.indexName,
            previousIndex: this.previousIndex,
        };
    }
}
export class CreateUniqueConstraintOperation extends MigrationOperation {
    type = 'create_unique_constraint';
    isDestructive = false;
    isReversible = true;
    tableName;
    constraint;
    constructor(tableName, constraint) {
        super();
        this.tableName = tableName;
        this.constraint = constraint;
        Object.freeze(this);
    }
    getReverse() {
        return new DropUniqueConstraintOperation(this.tableName, this.constraint.name, this.constraint);
    }
    toJSON() {
        return { type: this.type, tableName: this.tableName, constraint: this.constraint };
    }
}
export class DropUniqueConstraintOperation extends MigrationOperation {
    type = 'drop_unique_constraint';
    isDestructive = false;
    isReversible;
    tableName;
    constraintName;
    previousConstraint;
    constructor(tableName, constraintName, previousConstraint) {
        super();
        this.tableName = tableName;
        this.constraintName = constraintName;
        this.previousConstraint = previousConstraint;
        this.isReversible = previousConstraint !== undefined;
        Object.freeze(this);
    }
    getReverse() {
        if (!this.previousConstraint) {
            return null;
        }
        return new CreateUniqueConstraintOperation(this.tableName, this.previousConstraint);
    }
    toJSON() {
        return {
            type: this.type,
            tableName: this.tableName,
            constraintName: this.constraintName,
            previousConstraint: this.previousConstraint,
        };
    }
}
export class AddForeignKeyOperation extends MigrationOperation {
    type = 'add_foreign_key';
    isDestructive = false;
    isReversible = true;
    tableName;
    foreignKey;
    constructor(tableName, foreignKey) {
        super();
        this.tableName = tableName;
        this.foreignKey = foreignKey;
        Object.freeze(this);
    }
    getReverse() {
        return new DropForeignKeyOperation(this.tableName, this.foreignKey.name, this.foreignKey);
    }
    toJSON() {
        return { type: this.type, tableName: this.tableName, foreignKey: this.foreignKey };
    }
}
export class DropForeignKeyOperation extends MigrationOperation {
    type = 'drop_foreign_key';
    isDestructive = false;
    isReversible;
    tableName;
    foreignKeyName;
    previousForeignKey;
    constructor(tableName, foreignKeyName, previousForeignKey) {
        super();
        this.tableName = tableName;
        this.foreignKeyName = foreignKeyName;
        this.previousForeignKey = previousForeignKey;
        this.isReversible = previousForeignKey !== undefined;
        Object.freeze(this);
    }
    getReverse() {
        if (!this.previousForeignKey) {
            return null;
        }
        return new AddForeignKeyOperation(this.tableName, this.previousForeignKey);
    }
    toJSON() {
        return {
            type: this.type,
            tableName: this.tableName,
            foreignKeyName: this.foreignKeyName,
            previousForeignKey: this.previousForeignKey,
        };
    }
}
export class RawSqlOperation extends MigrationOperation {
    type = 'raw_sql';
    isDestructive;
    destructiveReason;
    isReversible;
    upSql;
    downSql;
    constructor(options) {
        super();
        this.upSql = options.upSql;
        this.downSql = options.downSql;
        this.isDestructive = options.isDestructive ?? false;
        this.destructiveReason = options.destructiveReason;
        this.isReversible = options.downSql !== undefined;
        Object.freeze(this);
    }
    getReverse() {
        if (!this.downSql) {
            return null;
        }
        return new RawSqlOperation({
            upSql: this.downSql,
            downSql: this.upSql,
        });
    }
    toJSON() {
        return {
            type: this.type,
            upSql: this.upSql,
            downSql: this.downSql,
            isDestructive: this.isDestructive,
        };
    }
}
//# sourceMappingURL=operations.js.map