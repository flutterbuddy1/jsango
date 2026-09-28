export class ColumnSchema {
    name;
    type;
    nullable;
    primaryKey;
    autoIncrement;
    unique;
    defaultValue;
    length;
    precision;
    scale;
    comment;
    constructor(def) {
        this.name = def.name;
        this.type = def.type;
        this.nullable = def.nullable ?? false;
        this.primaryKey = def.primaryKey ?? false;
        this.autoIncrement = def.autoIncrement ?? false;
        this.unique = def.unique ?? false;
        this.defaultValue = def.defaultValue;
        this.length = def.length;
        this.precision = def.precision;
        this.scale = def.scale;
        this.comment = def.comment;
        Object.freeze(this);
    }
    equals(other) {
        return (this.name === other.name &&
            this.type === other.type &&
            this.nullable === other.nullable &&
            this.primaryKey === other.primaryKey &&
            this.autoIncrement === other.autoIncrement &&
            this.unique === other.unique &&
            this.defaultValue === other.defaultValue &&
            this.length === other.length &&
            this.precision === other.precision &&
            this.scale === other.scale);
    }
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            nullable: this.nullable,
            primaryKey: this.primaryKey,
            autoIncrement: this.autoIncrement,
            unique: this.unique,
            defaultValue: this.defaultValue,
            length: this.length,
            precision: this.precision,
            scale: this.scale,
            comment: this.comment,
        };
    }
}
export class IndexSchema {
    name;
    columns;
    unique;
    constructor(def) {
        this.name = def.name;
        this.columns = Object.freeze([...def.columns]);
        this.unique = def.unique ?? false;
        Object.freeze(this);
    }
    equals(other) {
        if (this.name !== other.name || this.unique !== other.unique) {
            return false;
        }
        if (this.columns.length !== other.columns.length) {
            return false;
        }
        return this.columns.every((col, i) => col === other.columns[i]);
    }
    toJSON() {
        return {
            name: this.name,
            columns: [...this.columns],
            unique: this.unique,
        };
    }
}
export class ForeignKeySchema {
    name;
    columns;
    referencedTable;
    referencedColumns;
    onDelete;
    onUpdate;
    constructor(def) {
        this.name = def.name;
        this.columns = Object.freeze([...def.columns]);
        this.referencedTable = def.referencedTable;
        this.referencedColumns = Object.freeze([...def.referencedColumns]);
        this.onDelete = def.onDelete ?? 'NO ACTION';
        this.onUpdate = def.onUpdate ?? 'NO ACTION';
        Object.freeze(this);
    }
    equals(other) {
        if (this.name !== other.name ||
            this.referencedTable !== other.referencedTable ||
            this.onDelete !== other.onDelete ||
            this.onUpdate !== other.onUpdate) {
            return false;
        }
        if (this.columns.length !== other.columns.length) {
            return false;
        }
        if (this.referencedColumns.length !== other.referencedColumns.length) {
            return false;
        }
        return (this.columns.every((c, i) => c === other.columns[i]) &&
            this.referencedColumns.every((rc, i) => rc === other.referencedColumns[i]));
    }
    toJSON() {
        return {
            name: this.name,
            columns: [...this.columns],
            referencedTable: this.referencedTable,
            referencedColumns: [...this.referencedColumns],
            onDelete: this.onDelete,
            onUpdate: this.onUpdate,
        };
    }
}
export class UniqueConstraintSchema {
    name;
    columns;
    constructor(def) {
        this.name = def.name;
        this.columns = Object.freeze([...def.columns]);
        Object.freeze(this);
    }
    equals(other) {
        if (this.name !== other.name || this.columns.length !== other.columns.length) {
            return false;
        }
        return this.columns.every((col, i) => col === other.columns[i]);
    }
    toJSON() {
        return {
            name: this.name,
            columns: [...this.columns],
        };
    }
}
export class TableSchema {
    name;
    columns;
    primaryKey;
    indexes;
    foreignKeys;
    uniqueConstraints;
    comment;
    constructor(def) {
        this.name = def.name;
        const colMap = new Map();
        const pkCols = def.primaryKey ? [...def.primaryKey] : [];
        for (const colDef of def.columns) {
            const col = new ColumnSchema(colDef);
            colMap.set(col.name, col);
            if (col.primaryKey && !pkCols.includes(col.name)) {
                pkCols.push(col.name);
            }
        }
        this.columns = colMap;
        this.primaryKey = Object.freeze(pkCols.sort());
        this.indexes = Object.freeze((def.indexes ?? []).map((i) => new IndexSchema(i)));
        this.foreignKeys = Object.freeze((def.foreignKeys ?? []).map((fk) => new ForeignKeySchema(fk)));
        this.uniqueConstraints = Object.freeze((def.uniqueConstraints ?? []).map((uc) => new UniqueConstraintSchema(uc)));
        this.comment = def.comment;
        Object.freeze(this);
    }
    getColumn(name) {
        return this.columns.get(name);
    }
    hasColumn(name) {
        return this.columns.has(name);
    }
    getColumnNames() {
        return Object.freeze([...this.columns.keys()].sort());
    }
    toJSON() {
        return {
            name: this.name,
            columns: [...this.columns.values()].map((c) => c.toJSON()),
            primaryKey: [...this.primaryKey],
            indexes: this.indexes.map((i) => i.toJSON()),
            foreignKeys: this.foreignKeys.map((fk) => fk.toJSON()),
            uniqueConstraints: this.uniqueConstraints.map((uc) => uc.toJSON()),
            comment: this.comment,
        };
    }
}
export class SchemaSnapshot {
    version;
    createdAt;
    tables;
    constructor(data) {
        this.version = data?.version ?? 1;
        this.createdAt = data?.createdAt ?? new Date().toISOString();
        const tableMap = new Map();
        if (data?.tables) {
            for (const t of data.tables) {
                if (t instanceof TableSchema) {
                    tableMap.set(t.name, t);
                }
                else {
                    const schema = new TableSchema(t);
                    tableMap.set(schema.name, schema);
                }
            }
        }
        this.tables = tableMap;
        Object.freeze(this);
    }
    getTable(name) {
        return this.tables.get(name);
    }
    hasTable(name) {
        return this.tables.has(name);
    }
    getTableNames() {
        return Object.freeze([...this.tables.keys()].sort());
    }
    toJSON() {
        const sortedTables = [...this.tables.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => t.toJSON());
        return {
            version: this.version,
            createdAt: this.createdAt,
            tables: sortedTables,
        };
    }
    calculateChecksum() {
        const serialized = JSON.stringify(this.toJSON());
        // Simple deterministic hash function for snapshots
        let hash = 0;
        for (let i = 0; i < serialized.length; i++) {
            const char = serialized.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
    static fromJSON(data) {
        return new SchemaSnapshot(data);
    }
    static empty() {
        return new SchemaSnapshot({ tables: [] });
    }
}
//# sourceMappingURL=schema.js.map