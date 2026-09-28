import { SqlCompiler } from '../internal/compiler.js';
import { Hydrator } from '../internal/hydration.js';
import { EagerLoader } from '../internal/eager-loader.js';
import { ModelNotFoundError, QueryError } from './errors.js';
import { defaultModelRegistry } from './registry.js';
import { getDatabaseManager } from './connection.js';
export class QueryBuilder {
    modelClass;
    ast;
    compiler;
    registry;
    context;
    eagerRelations;
    constructor(modelClass, ast, options) {
        this.modelClass = modelClass;
        this.ast = ast ?? {
            table: modelClass.tableName,
            columns: [],
            where: [],
            orderBy: [],
        };
        this.compiler = options?.compiler ?? new SqlCompiler();
        this.registry = options?.registry ?? defaultModelRegistry;
        this.context = options?.context;
        this.eagerRelations = options?.eagerRelations
            ? Object.freeze([...options.eagerRelations])
            : Object.freeze([]);
    }
    clone(modifiedAst, modifiedOptions) {
        const newAst = {
            table: modifiedAst?.table ?? this.ast.table,
            columns: modifiedAst?.columns ?? [...this.ast.columns],
            where: modifiedAst?.where ?? [...this.ast.where],
            orderBy: modifiedAst?.orderBy ?? [...this.ast.orderBy],
            limit: modifiedAst && 'limit' in modifiedAst ? modifiedAst.limit : this.ast.limit,
            offset: modifiedAst && 'offset' in modifiedAst ? modifiedAst.offset : this.ast.offset,
            joins: modifiedAst?.joins ?? (this.ast.joins ? [...this.ast.joins] : undefined),
        };
        return new QueryBuilder(this.modelClass, newAst, {
            compiler: modifiedOptions?.compiler ?? this.compiler,
            registry: modifiedOptions?.registry ?? this.registry,
            context: modifiedOptions && 'context' in modifiedOptions ? modifiedOptions.context : this.context,
            eagerRelations: modifiedOptions && 'eagerRelations' in modifiedOptions
                ? modifiedOptions.eagerRelations
                : this.eagerRelations,
        });
    }
    select(...columns) {
        const mapped = columns.map((col) => this.modelClass.metadata.fieldToColumn(col));
        return this.clone({ columns: mapped });
    }
    where(columnOrConditions, operatorOrValue, value) {
        return this.addWhere('AND', columnOrConditions, operatorOrValue, value);
    }
    orWhere(columnOrConditions, operatorOrValue, value) {
        return this.addWhere('OR', columnOrConditions, operatorOrValue, value);
    }
    addWhere(boolean, columnOrConditions, operatorOrValue, value) {
        const newWhere = [...this.ast.where];
        if (typeof columnOrConditions === 'object' && columnOrConditions !== null) {
            for (const [key, val] of Object.entries(columnOrConditions)) {
                const col = this.modelClass.metadata.fieldToColumn(key);
                if (val === null) {
                    newWhere.push({
                        type: 'null',
                        column: col,
                        operator: 'IS NULL',
                        boolean,
                    });
                }
                else {
                    newWhere.push({
                        type: 'comparison',
                        column: col,
                        operator: '=',
                        value: val,
                        boolean,
                    });
                }
            }
            return this.clone({ where: newWhere });
        }
        const column = this.modelClass.metadata.fieldToColumn(columnOrConditions);
        if (value !== undefined) {
            const op = String(operatorOrValue);
            newWhere.push({
                type: 'comparison',
                column,
                operator: op,
                value,
                boolean,
            });
        }
        else {
            // 2 arguments: where(column, value)
            if (operatorOrValue === null) {
                newWhere.push({
                    type: 'null',
                    column,
                    operator: 'IS NULL',
                    boolean,
                });
            }
            else {
                newWhere.push({
                    type: 'comparison',
                    column,
                    operator: '=',
                    value: operatorOrValue,
                    boolean,
                });
            }
        }
        return this.clone({ where: newWhere });
    }
    whereIn(column, values) {
        const col = this.modelClass.metadata.fieldToColumn(column);
        const newWhere = [
            ...this.ast.where,
            {
                type: 'in',
                column: col,
                operator: 'IN',
                values: [...values],
                boolean: 'AND',
            },
        ];
        return this.clone({ where: newWhere });
    }
    whereNotIn(column, values) {
        const col = this.modelClass.metadata.fieldToColumn(column);
        const newWhere = [
            ...this.ast.where,
            {
                type: 'in',
                column: col,
                operator: 'NOT IN',
                values: [...values],
                boolean: 'AND',
            },
        ];
        return this.clone({ where: newWhere });
    }
    whereNull(column) {
        const col = this.modelClass.metadata.fieldToColumn(column);
        const newWhere = [
            ...this.ast.where,
            {
                type: 'null',
                column: col,
                operator: 'IS NULL',
                boolean: 'AND',
            },
        ];
        return this.clone({ where: newWhere });
    }
    whereNotNull(column) {
        const col = this.modelClass.metadata.fieldToColumn(column);
        const newWhere = [
            ...this.ast.where,
            {
                type: 'null',
                column: col,
                operator: 'IS NOT NULL',
                boolean: 'AND',
            },
        ];
        return this.clone({ where: newWhere });
    }
    orderBy(column, direction = 'ASC') {
        const col = this.modelClass.metadata.fieldToColumn(column);
        const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const newOrder = [...this.ast.orderBy, { column: col, direction: dir }];
        return this.clone({ orderBy: newOrder });
    }
    limit(n) {
        return this.clone({ limit: n });
    }
    offset(n) {
        return this.clone({ offset: n });
    }
    with(...relations) {
        const set = new Set([...this.eagerRelations, ...relations]);
        return this.clone(undefined, { eagerRelations: [...set] });
    }
    using(context) {
        return this.clone(undefined, { context });
    }
    toSql() {
        return this.compiler.compileSelect(this.ast);
    }
    async executeWithConnection(operation) {
        if (this.context) {
            return operation(this.context);
        }
        const manager = getDatabaseManager();
        if (!manager) {
            throw new QueryError(`No database connection provided for model '${this.modelClass.modelName}'. Call setDatabaseManager() or use .using(context).`);
        }
        const conn = await manager.connection(this.modelClass.metadata.connection);
        try {
            return await operation(conn);
        }
        finally {
            if ('release' in conn && typeof conn.release === 'function') {
                await conn.release();
            }
        }
    }
    async get() {
        return this.executeWithConnection(async (conn) => {
            const { sql, params } = this.toSql();
            const result = await conn.query(sql, params);
            const models = Hydrator.hydrateModels(result.rows, this.modelClass);
            if (this.eagerRelations.length > 0) {
                await EagerLoader.loadRelations(models, this.eagerRelations, this.registry, this.context ?? conn);
            }
            return Object.freeze(models);
        });
    }
    async first() {
        const results = await this.limit(1).get();
        return results[0] ?? null;
    }
    async find(id) {
        return this.where(this.modelClass.metadata.primaryKey, id).first();
    }
    async findOrFail(id) {
        const found = await this.find(id);
        if (!found) {
            throw new ModelNotFoundError(this.modelClass.modelName, id);
        }
        return found;
    }
    async count(column) {
        return this.executeWithConnection(async (conn) => {
            const col = column ? this.modelClass.metadata.fieldToColumn(column) : undefined;
            const { sql, params } = this.compiler.compileCount({
                table: this.ast.table,
                column: col,
                where: this.ast.where,
            });
            const result = await conn.query(sql, params);
            const firstRow = result.rows[0];
            if (!firstRow)
                return 0;
            const rawVal = firstRow['aggregate'] ?? Object.values(firstRow)[0];
            return Number(rawVal ?? 0);
        });
    }
    async exists() {
        return this.executeWithConnection(async (conn) => {
            const { sql, params } = this.compiler.compileExists({
                table: this.ast.table,
                where: this.ast.where,
            });
            const result = await conn.query(sql, params);
            return result.rows.length > 0;
        });
    }
    async paginate(options) {
        const page = Math.max(1, options.page);
        const pageSize = Math.max(1, options.pageSize);
        const total = await this.count();
        const items = await this.clone()
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .get();
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async *cursor(batchSize = 100) {
        const size = Math.max(1, batchSize);
        let currentOffset = this.ast.offset ?? 0;
        while (true) {
            const batch = await this.clone().limit(size).offset(currentOffset).get();
            if (batch.length === 0) {
                break;
            }
            for (const item of batch) {
                yield item;
            }
            if (batch.length < size) {
                break;
            }
            currentOffset += size;
        }
    }
    async update(values) {
        return this.executeWithConnection(async (conn) => {
            const mappedValues = {};
            for (const [key, val] of Object.entries(values)) {
                const col = this.modelClass.metadata.fieldToColumn(key);
                mappedValues[col] = val;
            }
            if (this.modelClass.metadata.timestamps.enabled) {
                const updatedCol = this.modelClass.metadata.fieldToColumn(this.modelClass.metadata.timestamps.updatedAt);
                if (!(updatedCol in mappedValues)) {
                    mappedValues[updatedCol] = new Date();
                }
            }
            const { sql, params } = this.compiler.compileUpdate({
                table: this.ast.table,
                values: mappedValues,
                where: this.ast.where,
            });
            const result = await conn.query(sql, params);
            return result.rowCount ?? 0;
        });
    }
    async delete(options) {
        const isSoftDelete = this.modelClass.metadata.softDelete.enabled && !options?.force;
        if (isSoftDelete) {
            const deletedAtCol = this.modelClass.metadata.fieldToColumn(this.modelClass.metadata.softDelete.deletedAt);
            return this.update({ [deletedAtCol]: new Date() });
        }
        return this.executeWithConnection(async (conn) => {
            const { sql, params } = this.compiler.compileDelete({
                table: this.ast.table,
                where: this.ast.where,
            });
            const result = await conn.query(sql, params);
            return result.rowCount ?? 0;
        });
    }
}
//# sourceMappingURL=query.js.map