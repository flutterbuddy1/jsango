import { AddColumnOperation, AddForeignKeyOperation, AlterColumnOperation, CreateIndexOperation, CreateTableOperation, CreateUniqueConstraintOperation, DropColumnOperation, DropForeignKeyOperation, DropIndexOperation, DropTableOperation, DropUniqueConstraintOperation, } from './operations.js';
export class SchemaDiff {
    operations;
    hasChanges;
    hasDestructiveOperations;
    destructiveOperations;
    isReversible;
    constructor(operations) {
        this.operations = Object.freeze([...operations]);
        this.hasChanges = operations.length > 0;
        this.destructiveOperations = Object.freeze(operations.filter((op) => op.isDestructive));
        this.hasDestructiveOperations = this.destructiveOperations.length > 0;
        this.isReversible = operations.every((op) => op.isReversible);
        Object.freeze(this);
    }
    getReverseOperations() {
        const reversed = [];
        // Rollback operations execute in reverse chronological order
        for (let i = this.operations.length - 1; i >= 0; i--) {
            const op = this.operations[i];
            const rev = op.getReverse();
            if (!rev) {
                throw new Error(`Cannot reverse irreversible operation '${op.type}'.`);
            }
            reversed.push(rev);
        }
        return Object.freeze(reversed);
    }
    toJSON() {
        return {
            hasChanges: this.hasChanges,
            hasDestructiveOperations: this.hasDestructiveOperations,
            isReversible: this.isReversible,
            operations: this.operations.map((op) => op.toJSON()),
        };
    }
}
export class SchemaDiffEngine {
    static diff(expected, actual) {
        const createTables = [];
        const addColumns = [];
        const alterColumns = [];
        const createUniqueConstraints = [];
        const createIndexes = [];
        const addForeignKeys = [];
        const dropForeignKeys = [];
        const dropIndexes = [];
        const dropUniqueConstraints = [];
        const dropColumns = [];
        const dropTables = [];
        const expectedTableNames = expected.getTableNames();
        const actualTableNames = actual.getTableNames();
        // 1. Detect new tables in expected
        for (const tableName of expectedTableNames) {
            if (!actual.hasTable(tableName)) {
                const table = expected.getTable(tableName);
                createTables.push(new CreateTableOperation(table.toJSON()));
            }
        }
        // 2. Detect dropped tables in actual
        for (const tableName of actualTableNames) {
            if (!expected.hasTable(tableName)) {
                const table = actual.getTable(tableName);
                dropTables.push(new DropTableOperation(tableName, table.toJSON()));
            }
        }
        // 3. Compare tables present in both
        for (const tableName of expectedTableNames) {
            if (actual.hasTable(tableName)) {
                const expTable = expected.getTable(tableName);
                const actTable = actual.getTable(tableName);
                SchemaDiffEngine.diffTable(expTable, actTable, addColumns, alterColumns, dropColumns, createUniqueConstraints, dropUniqueConstraints, createIndexes, dropIndexes, addForeignKeys, dropForeignKeys);
            }
        }
        // Sort operations deterministically
        createTables.sort((a, b) => a.table.name.localeCompare(b.table.name));
        addColumns.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.column.name.localeCompare(b.column.name));
        alterColumns.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.column.name.localeCompare(b.column.name));
        createUniqueConstraints.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.constraint.name.localeCompare(b.constraint.name));
        createIndexes.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.index.name.localeCompare(b.index.name));
        addForeignKeys.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.foreignKey.name.localeCompare(b.foreignKey.name));
        dropForeignKeys.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.foreignKeyName.localeCompare(b.foreignKeyName));
        dropIndexes.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.indexName.localeCompare(b.indexName));
        dropUniqueConstraints.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.constraintName.localeCompare(b.constraintName));
        dropColumns.sort((a, b) => a.tableName.localeCompare(b.tableName) || a.columnName.localeCompare(b.columnName));
        dropTables.sort((a, b) => a.tableName.localeCompare(b.tableName));
        // Ordered sequence ensuring safe relational resolution
        const orderedOperations = [
            ...createTables,
            ...addColumns,
            ...alterColumns,
            ...createUniqueConstraints,
            ...createIndexes,
            ...addForeignKeys,
            ...dropForeignKeys,
            ...dropIndexes,
            ...dropUniqueConstraints,
            ...dropColumns,
            ...dropTables,
        ];
        return new SchemaDiff(orderedOperations);
    }
    static diffTable(expected, actual, addColumns, alterColumns, dropColumns, createUniqueConstraints, dropUniqueConstraints, createIndexes, dropIndexes, addForeignKeys, dropForeignKeys) {
        const expColNames = expected.getColumnNames();
        const actColNames = actual.getColumnNames();
        // Column additions
        for (const colName of expColNames) {
            if (!actual.hasColumn(colName)) {
                addColumns.push(new AddColumnOperation(expected.name, expected.getColumn(colName).toJSON()));
            }
        }
        // Column drops
        for (const colName of actColNames) {
            if (!expected.hasColumn(colName)) {
                dropColumns.push(new DropColumnOperation(expected.name, colName, actual.getColumn(colName).toJSON()));
            }
        }
        // Column alterations
        for (const colName of expColNames) {
            if (actual.hasColumn(colName)) {
                const expCol = expected.getColumn(colName);
                const actCol = actual.getColumn(colName);
                if (!expCol.equals(actCol)) {
                    alterColumns.push(new AlterColumnOperation(expected.name, expCol.toJSON(), actCol.toJSON()));
                }
            }
        }
        // Unique constraints
        for (const expUc of expected.uniqueConstraints) {
            const match = actual.uniqueConstraints.find((uc) => uc.name === expUc.name);
            if (!match) {
                createUniqueConstraints.push(new CreateUniqueConstraintOperation(expected.name, expUc.toJSON()));
            }
        }
        for (const actUc of actual.uniqueConstraints) {
            const match = expected.uniqueConstraints.find((uc) => uc.name === actUc.name);
            if (!match) {
                dropUniqueConstraints.push(new DropUniqueConstraintOperation(expected.name, actUc.name, actUc.toJSON()));
            }
        }
        // Indexes
        for (const expIdx of expected.indexes) {
            const match = actual.indexes.find((i) => i.name === expIdx.name);
            if (!match) {
                createIndexes.push(new CreateIndexOperation(expected.name, expIdx.toJSON()));
            }
        }
        for (const actIdx of actual.indexes) {
            const match = expected.indexes.find((i) => i.name === actIdx.name);
            if (!match) {
                dropIndexes.push(new DropIndexOperation(expected.name, actIdx.name, actIdx.toJSON()));
            }
        }
        // Foreign keys
        for (const expFk of expected.foreignKeys) {
            const match = actual.foreignKeys.find((fk) => fk.name === expFk.name);
            if (!match) {
                addForeignKeys.push(new AddForeignKeyOperation(expected.name, expFk.toJSON()));
            }
        }
        for (const actFk of actual.foreignKeys) {
            const match = expected.foreignKeys.find((fk) => fk.name === actFk.name);
            if (!match) {
                dropForeignKeys.push(new DropForeignKeyOperation(expected.name, actFk.name, actFk.toJSON()));
            }
        }
    }
}
//# sourceMappingURL=diff.js.map