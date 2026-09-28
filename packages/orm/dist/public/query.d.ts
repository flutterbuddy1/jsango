import type { WhereOperator, OrderDirection, PaginationOptions, PaginationResult, CompiledQuery, QueryContext, ModelStatic } from './types.js';
import type { Model } from './model.js';
import type { SelectAst } from '../internal/ast.js';
import { SqlCompiler } from '../internal/compiler.js';
import { type ModelRegistry } from './registry.js';
export interface QueryBuilderOptions {
    readonly compiler?: SqlCompiler | undefined;
    readonly registry?: ModelRegistry | undefined;
    readonly context?: QueryContext | undefined;
    readonly eagerRelations?: readonly string[] | undefined;
}
export declare class QueryBuilder<TModel extends Model = Model> {
    private readonly modelClass;
    private readonly ast;
    private readonly compiler;
    private readonly registry;
    private readonly context?;
    private readonly eagerRelations;
    constructor(modelClass: ModelStatic<TModel>, ast?: SelectAst, options?: QueryBuilderOptions);
    clone(modifiedAst?: Partial<SelectAst>, modifiedOptions?: Partial<QueryBuilderOptions>): QueryBuilder<TModel>;
    select(...columns: readonly string[]): QueryBuilder<TModel>;
    where(columnOrConditions: string | Record<string, unknown>, operatorOrValue?: WhereOperator | unknown, value?: unknown): QueryBuilder<TModel>;
    orWhere(columnOrConditions: string | Record<string, unknown>, operatorOrValue?: WhereOperator | unknown, value?: unknown): QueryBuilder<TModel>;
    private addWhere;
    whereIn(column: string, values: readonly unknown[]): QueryBuilder<TModel>;
    whereNotIn(column: string, values: readonly unknown[]): QueryBuilder<TModel>;
    whereNull(column: string): QueryBuilder<TModel>;
    whereNotNull(column: string): QueryBuilder<TModel>;
    orderBy(column: string, direction?: OrderDirection): QueryBuilder<TModel>;
    limit(n: number): QueryBuilder<TModel>;
    offset(n: number): QueryBuilder<TModel>;
    with(...relations: readonly string[]): QueryBuilder<TModel>;
    using(context: QueryContext): QueryBuilder<TModel>;
    toSql(): CompiledQuery;
    private executeWithConnection;
    get(): Promise<readonly TModel[]>;
    first(): Promise<TModel | null>;
    find(id: unknown): Promise<TModel | null>;
    findOrFail(id: unknown): Promise<TModel>;
    count(column?: string): Promise<number>;
    exists(): Promise<boolean>;
    paginate(options: PaginationOptions): Promise<PaginationResult<TModel>>;
    cursor(batchSize?: number): AsyncIterable<TModel>;
    update(values: Record<string, unknown>): Promise<number>;
    delete(options?: {
        force?: boolean;
    }): Promise<number>;
}
//# sourceMappingURL=query.d.ts.map