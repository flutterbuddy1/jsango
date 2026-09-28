import { MetadataError } from './errors.js';
export class FieldMetadata {
    name;
    type;
    columnName;
    nullable;
    primaryKey;
    autoIncrement;
    unique;
    indexed;
    defaultValue;
    length;
    precision;
    scale;
    comment;
    options;
    constructor(name, config) {
        this.name = name;
        this.type = config.type;
        this.columnName = config.columnName ?? name;
        this.nullable = config.nullable ?? false;
        this.primaryKey = config.primaryKey ?? false;
        this.autoIncrement = config.autoIncrement ?? false;
        this.unique = config.unique ?? false;
        this.indexed = config.indexed ?? false;
        this.defaultValue = config.default;
        this.length = config.length;
        this.precision = config.precision;
        this.scale = config.scale;
        this.comment = config.comment;
        this.options = Object.freeze({ ...(config.options ?? {}) });
        Object.freeze(this);
    }
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            columnName: this.columnName,
            nullable: this.nullable,
            primaryKey: this.primaryKey,
            autoIncrement: this.autoIncrement,
            unique: this.unique,
            indexed: this.indexed,
            defaultValue: typeof this.defaultValue === 'function' ? '[Function]' : this.defaultValue,
            length: this.length,
            precision: this.precision,
            scale: this.scale,
            comment: this.comment,
            options: this.options,
        };
    }
}
export class RelationMetadata {
    name;
    type;
    sourceModel;
    foreignKey;
    localKey;
    pivotForeignKey;
    pivotTargetKey;
    inverseRelation;
    options;
    targetResolver;
    throughResolver;
    static targetCache = new WeakMap();
    static throughCache = new WeakMap();
    constructor(name, sourceModel, config) {
        this.name = name;
        this.sourceModel = sourceModel;
        this.type = config.type;
        this.targetResolver = config.target;
        this.foreignKey = config.foreignKey;
        this.localKey = config.localKey ?? 'id';
        this.throughResolver = config.through;
        this.pivotForeignKey = config.pivotForeignKey;
        this.pivotTargetKey = config.pivotTargetKey;
        this.inverseRelation = config.inverseRelation;
        this.options = Object.freeze({ ...(config.options ?? {}) });
        Object.freeze(this);
    }
    resolveTarget(registryLookup) {
        const cached = RelationMetadata.targetCache.get(this);
        if (cached) {
            return cached;
        }
        const resolved = typeof this.targetResolver === 'function' ? this.targetResolver() : this.targetResolver;
        if (typeof resolved === 'function' && 'metadata' in resolved) {
            RelationMetadata.targetCache.set(this, resolved);
            return resolved;
        }
        if (typeof resolved === 'string' && registryLookup) {
            const found = registryLookup(resolved);
            if (found) {
                RelationMetadata.targetCache.set(this, found);
                return found;
            }
        }
        throw new MetadataError(`Could not resolve target model for relation '${this.sourceModel}.${this.name}'.`);
    }
    resolveThrough(registryLookup) {
        const cached = RelationMetadata.throughCache.get(this);
        if (cached) {
            return cached;
        }
        if (!this.throughResolver) {
            return undefined;
        }
        const resolved = typeof this.throughResolver === 'function' ? this.throughResolver() : this.throughResolver;
        if (typeof resolved === 'function' && 'metadata' in resolved) {
            RelationMetadata.throughCache.set(this, resolved);
            return resolved;
        }
        if (typeof resolved === 'string' && registryLookup) {
            const found = registryLookup(resolved);
            if (found) {
                RelationMetadata.throughCache.set(this, found);
                return found;
            }
        }
        throw new MetadataError(`Could not resolve through model for relation '${this.sourceModel}.${this.name}'.`);
    }
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            sourceModel: this.sourceModel,
            foreignKey: this.foreignKey,
            localKey: this.localKey,
            pivotForeignKey: this.pivotForeignKey,
            pivotTargetKey: this.pivotTargetKey,
            inverseRelation: this.inverseRelation,
            options: this.options,
        };
    }
}
export class IndexMetadata {
    name;
    columns;
    unique;
    constructor(def) {
        this.name = def.name;
        this.columns = Object.freeze([...def.columns]);
        this.unique = def.unique ?? false;
        Object.freeze(this);
    }
    toJSON() {
        return {
            name: this.name,
            columns: this.columns,
            unique: this.unique,
        };
    }
}
export class ModelMetadata {
    name;
    table;
    connection;
    primaryKey;
    fields;
    relations;
    timestamps;
    softDelete;
    indexes;
    options;
    columnToFieldMap;
    fieldToColumnMap;
    constructor(options) {
        this.name = options.name;
        this.table = options.table ?? options.tableName ?? (options.name.toLowerCase() + 's');
        this.connection = options.connection ?? 'default';
        const fieldsMap = new Map();
        const colToField = new Map();
        const fieldToCol = new Map();
        let detectedPk = options.primaryKey;
        for (const [fieldName, fieldDef] of Object.entries(options.fields)) {
            const fieldMeta = new FieldMetadata(fieldName, fieldDef);
            fieldsMap.set(fieldName, fieldMeta);
            colToField.set(fieldMeta.columnName, fieldName);
            fieldToCol.set(fieldName, fieldMeta.columnName);
            if (fieldMeta.primaryKey && !detectedPk) {
                detectedPk = fieldName;
            }
        }
        this.primaryKey = detectedPk ?? 'id';
        this.fields = fieldsMap;
        this.columnToFieldMap = colToField;
        this.fieldToColumnMap = fieldToCol;
        const relationsMap = new Map();
        if (options.relations) {
            for (const [relName, relDef] of Object.entries(options.relations)) {
                const relMeta = new RelationMetadata(relName, this.name, relDef);
                relationsMap.set(relName, relMeta);
            }
        }
        this.relations = relationsMap;
        // Timestamps configuration
        if (typeof options.timestamps === 'boolean') {
            this.timestamps = Object.freeze({
                enabled: options.timestamps,
                createdAt: 'createdAt',
                updatedAt: 'updatedAt',
            });
        }
        else if (options.timestamps) {
            this.timestamps = Object.freeze({
                enabled: true,
                createdAt: options.timestamps.createdAt ?? 'createdAt',
                updatedAt: options.timestamps.updatedAt ?? 'updatedAt',
            });
        }
        else {
            this.timestamps = Object.freeze({
                enabled: false,
                createdAt: 'createdAt',
                updatedAt: 'updatedAt',
            });
        }
        // Soft delete configuration
        if (typeof options.softDelete === 'boolean') {
            this.softDelete = Object.freeze({
                enabled: options.softDelete,
                deletedAt: 'deletedAt',
            });
        }
        else if (options.softDelete) {
            this.softDelete = Object.freeze({
                enabled: true,
                deletedAt: options.softDelete.deletedAt ?? 'deletedAt',
            });
        }
        else {
            this.softDelete = Object.freeze({
                enabled: false,
                deletedAt: 'deletedAt',
            });
        }
        this.indexes = Object.freeze((options.indexes ?? []).map((idx) => new IndexMetadata(idx)));
        this.options = Object.freeze({ ...(options.metadata ?? {}) });
        Object.freeze(this);
    }
    getField(name) {
        return this.fields.get(name);
    }
    getRelation(name) {
        return this.relations.get(name);
    }
    hasField(name) {
        return this.fields.has(name);
    }
    hasRelation(name) {
        return this.relations.has(name);
    }
    columnToField(column) {
        return this.columnToFieldMap.get(column) ?? column;
    }
    fieldToColumn(field) {
        return this.fieldToColumnMap.get(field) ?? field;
    }
    toJSON() {
        const fieldsObj = {};
        for (const [name, meta] of this.fields.entries()) {
            fieldsObj[name] = meta.toJSON();
        }
        const relationsObj = {};
        for (const [name, meta] of this.relations.entries()) {
            relationsObj[name] = meta.toJSON();
        }
        return {
            name: this.name,
            table: this.table,
            connection: this.connection,
            primaryKey: this.primaryKey,
            fields: fieldsObj,
            relations: relationsObj,
            timestamps: this.timestamps,
            softDelete: this.softDelete,
            indexes: this.indexes.map((idx) => idx.toJSON()),
            options: this.options,
        };
    }
}
//# sourceMappingURL=metadata.js.map