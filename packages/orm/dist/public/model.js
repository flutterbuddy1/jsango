import { ModelMetadata } from './metadata.js';
import { QueryBuilder } from './query.js';
import { SqlCompiler } from '../internal/compiler.js';
import { Hydrator } from '../internal/hydration.js';
import { ModelNotFoundError, QueryError } from './errors.js';
import { defaultModelRegistry } from './registry.js';
import { getDatabaseManager } from './connection.js';
export class Model {
    static metadata;
    static modelName;
    static tableName;
    _attributes = {};
    _originalAttributes = {};
    _isNew = true;
    _relations = new Map();
    constructor(attributes = {}, isNew = true) {
        this._isNew = isNew;
        this._attributes = { ...attributes };
        if (!isNew) {
            this._originalAttributes = { ...attributes };
        }
    }
    get isNew() {
        return this._isNew;
    }
    get primaryKey() {
        const meta = this.constructor.metadata;
        return this._attributes[meta.primaryKey];
    }
    getAttributes() {
        return Object.freeze({ ...this._attributes });
    }
    setAttribute(key, value) {
        this._attributes[key] = value;
    }
    get(field) {
        return this._attributes[field];
    }
    set(field, value) {
        this._attributes[field] = value;
        return this;
    }
    isDirty(field) {
        if (this._isNew) {
            return true;
        }
        if (field !== undefined) {
            return this._attributes[field] !== this._originalAttributes[field];
        }
        for (const key of Object.keys(this._attributes)) {
            if (this._attributes[key] !== this._originalAttributes[key]) {
                return true;
            }
        }
        return false;
    }
    getDirty() {
        if (this._isNew) {
            return { ...this._attributes };
        }
        const dirty = {};
        for (const [key, val] of Object.entries(this._attributes)) {
            if (val !== this._originalAttributes[key]) {
                dirty[key] = val;
            }
        }
        return dirty;
    }
    getOriginal(field) {
        if (field !== undefined) {
            return this._originalAttributes[field];
        }
        return Object.freeze({ ...this._originalAttributes });
    }
    getRelation(relationName) {
        return this._relations.get(relationName);
    }
    setRelation(relationName, value) {
        this._relations.set(relationName, value);
        return this;
    }
    async executeWithConnection(explicit, fn) {
        if (explicit) {
            return fn(explicit);
        }
        const meta = this.constructor.metadata;
        const manager = getDatabaseManager();
        if (!manager) {
            throw new QueryError(`No database connection provided for model '${meta.name}'. Pass connection via options or configure via setDatabaseManager().`);
        }
        const conn = await manager.connection(meta.connection);
        try {
            return await fn(conn);
        }
        finally {
            if ('release' in conn && typeof conn.release === 'function') {
                await conn.release();
            }
        }
    }
    async save(options) {
        return this.executeWithConnection(options?.connection, async (conn) => {
            const meta = this.constructor.metadata;
            const compiler = new SqlCompiler();
            if (this._isNew) {
                // 1. Apply defaults for any missing fields
                for (const [fieldName, fieldMeta] of meta.fields.entries()) {
                    if (this._attributes[fieldName] === undefined && fieldMeta.defaultValue !== undefined) {
                        this._attributes[fieldName] =
                            typeof fieldMeta.defaultValue === 'function'
                                ? fieldMeta.defaultValue()
                                : fieldMeta.defaultValue;
                    }
                }
                // 2. Set timestamps if enabled
                if (meta.timestamps.enabled) {
                    const now = new Date();
                    if (this._attributes[meta.timestamps.createdAt] === undefined) {
                        this._attributes[meta.timestamps.createdAt] = now;
                    }
                    if (this._attributes[meta.timestamps.updatedAt] === undefined) {
                        this._attributes[meta.timestamps.updatedAt] = now;
                    }
                }
                // 3. Prepare column values
                const cols = [];
                const rowValues = [];
                for (const [fieldName, val] of Object.entries(this._attributes)) {
                    if (val !== undefined) {
                        cols.push(meta.fieldToColumn(fieldName));
                        rowValues.push(val);
                    }
                }
                const { sql, params } = compiler.compileInsert({
                    table: meta.table,
                    columns: cols,
                    rows: [rowValues],
                });
                const result = await conn.query(sql, params);
                // Assign auto-generated primary key if returned
                const pkMeta = meta.getField(meta.primaryKey);
                if (pkMeta?.autoIncrement && result.lastInsertId !== undefined) {
                    this._attributes[meta.primaryKey] = result.lastInsertId;
                }
                else if (result.rows.length > 0 && result.rows[0][meta.primaryKey] !== undefined) {
                    this._attributes[meta.primaryKey] = result.rows[0][meta.primaryKey];
                }
                this._originalAttributes = { ...this._attributes };
                this._isNew = false;
                return this;
            }
            // Existing model update
            if (!this.isDirty()) {
                return this;
            }
            if (meta.timestamps.enabled) {
                this._attributes[meta.timestamps.updatedAt] = new Date();
            }
            const dirty = this.getDirty();
            const updateValues = {};
            for (const [fieldName, val] of Object.entries(dirty)) {
                updateValues[meta.fieldToColumn(fieldName)] = val;
            }
            const pkCol = meta.fieldToColumn(meta.primaryKey);
            const pkVal = this._originalAttributes[meta.primaryKey] ?? this._attributes[meta.primaryKey];
            const { sql, params } = compiler.compileUpdate({
                table: meta.table,
                values: updateValues,
                where: [
                    {
                        type: 'comparison',
                        column: pkCol,
                        operator: '=',
                        value: pkVal,
                        boolean: 'AND',
                    },
                ],
            });
            await conn.query(sql, params);
            this._originalAttributes = { ...this._attributes };
            return this;
        });
    }
    async delete(options) {
        return this.executeWithConnection(options?.connection, async (conn) => {
            const meta = this.constructor.metadata;
            const pkCol = meta.fieldToColumn(meta.primaryKey);
            const pkVal = this.primaryKey;
            if (pkVal === undefined || pkVal === null) {
                throw new QueryError(`Cannot delete model '${meta.name}' without a primary key.`);
            }
            if (meta.softDelete.enabled && !options?.force) {
                this._attributes[meta.softDelete.deletedAt] = new Date();
                await this.save(options);
                return;
            }
            const compiler = new SqlCompiler();
            const { sql, params } = compiler.compileDelete({
                table: meta.table,
                where: [
                    {
                        type: 'comparison',
                        column: pkCol,
                        operator: '=',
                        value: pkVal,
                        boolean: 'AND',
                    },
                ],
            });
            await conn.query(sql, params);
        });
    }
    async refresh(options) {
        return this.executeWithConnection(options?.connection, async (conn) => {
            const meta = this.constructor.metadata;
            const pkVal = this.primaryKey;
            if (pkVal === undefined || pkVal === null) {
                throw new QueryError(`Cannot refresh model '${meta.name}' without a primary key.`);
            }
            const modelClass = this.constructor;
            const fresh = await modelClass.query().using(conn).find(pkVal);
            if (!fresh) {
                throw new ModelNotFoundError(meta.name, pkVal);
            }
            this._attributes = { ...fresh.getAttributes() };
            this._originalAttributes = { ...this._attributes };
            this._isNew = false;
            return this;
        });
    }
    toJSON() {
        const json = {};
        for (const [key, val] of Object.entries(this._attributes)) {
            if (val instanceof Date) {
                json[key] = val.toISOString();
            }
            else {
                json[key] = val;
            }
        }
        for (const [relName, relVal] of this._relations.entries()) {
            if (Array.isArray(relVal)) {
                json[relName] = relVal.map((item) => item && typeof item === 'object' && 'toJSON' in item ? item.toJSON() : item);
            }
            else if (relVal && typeof relVal === 'object' && 'toJSON' in relVal) {
                json[relName] = relVal.toJSON();
            }
            else {
                json[relName] = relVal;
            }
        }
        return json;
    }
}
export function defineModel(nameOrOptions, fieldsArg, extraOptions) {
    const options = typeof nameOrOptions === 'string'
        ? {
            name: nameOrOptions,
            fields: fieldsArg ?? {},
            ...extraOptions,
        }
        : nameOrOptions;
    const metadata = new ModelMetadata(options);
    class DefinedModel extends Model {
        static metadata = metadata;
        static modelName = options.name;
        static tableName = metadata.table;
        static query() {
            return new QueryBuilder(this);
        }
        static async all() {
            return this.query().get();
        }
        static async find(id) {
            return this.query().find(id);
        }
        static async findOrFail(id) {
            return this.query().findOrFail(id);
        }
        static async first() {
            return this.query().first();
        }
        static where(columnOrConditions, operatorOrValue, value) {
            return this.query().where(columnOrConditions, operatorOrValue, value);
        }
        static orWhere(columnOrConditions, operatorOrValue, value) {
            return this.query().orWhere(columnOrConditions, operatorOrValue, value);
        }
        static whereIn(column, values) {
            return this.query().whereIn(column, values);
        }
        static whereNotIn(column, values) {
            return this.query().whereNotIn(column, values);
        }
        static whereNull(column) {
            return this.query().whereNull(column);
        }
        static whereNotNull(column) {
            return this.query().whereNotNull(column);
        }
        static orderBy(column, direction = 'ASC') {
            return this.query().orderBy(column, direction);
        }
        static limit(n) {
            return this.query().limit(n);
        }
        static offset(n) {
            return this.query().offset(n);
        }
        static async count(column) {
            return this.query().count(column);
        }
        static async paginate(options) {
            return this.query().paginate(options);
        }
        static with(...relations) {
            return this.query().with(...relations);
        }
        static async create(attributes) {
            const instance = new this(attributes, true);
            await instance.save();
            return instance;
        }
        static async bulkCreate(records) {
            if (records.length === 0) {
                return Object.freeze([]);
            }
            const compiler = new SqlCompiler();
            const manager = getDatabaseManager();
            if (!manager) {
                throw new QueryError(`No database connection provided for model '${this.modelName}'. Call setDatabaseManager().`);
            }
            const conn = await manager.connection(this.metadata.connection);
            try {
                // Normalize columns
                const first = records[0];
                const cols = Object.keys(first).map((key) => this.metadata.fieldToColumn(key));
                const rows = [];
                for (const rec of records) {
                    const rowVals = [];
                    for (const key of Object.keys(first)) {
                        let val = rec[key];
                        const fieldMeta = this.metadata.getField(key);
                        if (val === undefined && fieldMeta?.defaultValue !== undefined) {
                            val =
                                typeof fieldMeta.defaultValue === 'function'
                                    ? fieldMeta.defaultValue()
                                    : fieldMeta.defaultValue;
                        }
                        rowVals.push(val ?? null);
                    }
                    rows.push(rowVals);
                }
                const { sql, params } = compiler.compileInsert({
                    table: this.metadata.table,
                    columns: cols,
                    rows,
                });
                const result = await conn.query(sql, params);
                // If returned rows exist, hydrate them. Otherwise instantiate with input records.
                if (result.rows.length > 0) {
                    return Hydrator.hydrateModels(result.rows, this);
                }
                return Object.freeze(records.map((r) => new this(r, false)));
            }
            finally {
                if ('release' in conn && typeof conn.release === 'function') {
                    await conn.release();
                }
            }
        }
    }
    // Define properties on prototype for all fields
    for (const fieldName of Object.keys(options.fields)) {
        Object.defineProperty(DefinedModel.prototype, fieldName, {
            get() {
                return this._attributes[fieldName];
            },
            set(value) {
                this._attributes[fieldName] = value;
            },
            enumerable: true,
            configurable: true,
        });
    }
    // Define properties on prototype for all relations
    if (options.relations) {
        for (const relName of Object.keys(options.relations)) {
            Object.defineProperty(DefinedModel.prototype, relName, {
                get() {
                    return this._relations.get(relName);
                },
                set(value) {
                    this._relations.set(relName, value);
                },
                enumerable: true,
                configurable: true,
            });
        }
    }
    if (options.registry !== false) {
        const reg = typeof options.registry === 'object' && options.registry !== null
            ? options.registry
            : defaultModelRegistry;
        reg.register(DefinedModel);
    }
    return DefinedModel;
}
export const model = defineModel;
//# sourceMappingURL=model.js.map