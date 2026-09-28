import type { FieldDefinition, RelationDefinition, ModelDefinitionOptions, QueryContext, InferModelAttributes, InferCreationAttributes } from './types.js';
import { ModelMetadata } from './metadata.js';
import { QueryBuilder } from './query.js';
export declare class Model {
    static readonly metadata: ModelMetadata;
    static readonly modelName: string;
    static readonly tableName: string;
    protected _attributes: Record<string, unknown>;
    protected _originalAttributes: Record<string, unknown>;
    protected _isNew: boolean;
    protected _relations: Map<string, unknown>;
    constructor(attributes?: Record<string, unknown>, isNew?: boolean);
    get isNew(): boolean;
    get primaryKey(): unknown;
    getAttributes(): Readonly<Record<string, unknown>>;
    setAttribute<K extends string>(key: K, value: unknown): void;
    get<T = unknown>(field: string): T;
    set(field: string, value: unknown): this;
    isDirty(field?: string): boolean;
    getDirty(): Record<string, unknown>;
    getOriginal(field?: string): unknown;
    getRelation<T = unknown>(relationName: string): T | undefined;
    setRelation(relationName: string, value: unknown): this;
    private executeWithConnection;
    save(options?: {
        connection?: QueryContext;
    }): Promise<this>;
    delete(options?: {
        connection?: QueryContext;
        force?: boolean;
    }): Promise<void>;
    refresh(options?: {
        connection?: QueryContext;
    }): Promise<this>;
    toJSON(): Record<string, unknown>;
}
export type ModelInstance<TFields extends Record<string, FieldDefinition<unknown>>, TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>> = Model & InferModelAttributes<TFields> & {
    [R in keyof TRelations]?: TRelations[R] extends {
        type: 'hasMany' | 'manyToMany';
    } ? readonly Model[] : Model | null;
};
export interface DefinedModelStatic<TFields extends Record<string, FieldDefinition<unknown>>, TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>> {
    new (attributes?: Partial<InferModelAttributes<TFields>>, isNew?: boolean): ModelInstance<TFields, TRelations>;
    readonly modelName: string;
    readonly tableName: string;
    readonly metadata: ModelMetadata;
    query(): QueryBuilder<ModelInstance<TFields, TRelations>>;
    all(): Promise<readonly ModelInstance<TFields, TRelations>[]>;
    find(id: unknown): Promise<ModelInstance<TFields, TRelations> | null>;
    findOrFail(id: unknown): Promise<ModelInstance<TFields, TRelations>>;
    first(): Promise<ModelInstance<TFields, TRelations> | null>;
    where(columnOrConditions: string | Record<string, unknown>, operatorOrValue?: unknown, value?: unknown): QueryBuilder<ModelInstance<TFields, TRelations>>;
    orWhere(columnOrConditions: string | Record<string, unknown>, operatorOrValue?: unknown, value?: unknown): QueryBuilder<ModelInstance<TFields, TRelations>>;
    whereIn(column: string, values: readonly unknown[]): QueryBuilder<ModelInstance<TFields, TRelations>>;
    whereNotIn(column: string, values: readonly unknown[]): QueryBuilder<ModelInstance<TFields, TRelations>>;
    whereNull(column: string): QueryBuilder<ModelInstance<TFields, TRelations>>;
    whereNotNull(column: string): QueryBuilder<ModelInstance<TFields, TRelations>>;
    orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder<ModelInstance<TFields, TRelations>>;
    limit(n: number): QueryBuilder<ModelInstance<TFields, TRelations>>;
    offset(n: number): QueryBuilder<ModelInstance<TFields, TRelations>>;
    count(column?: string): Promise<number>;
    paginate(options: import('./types.js').PaginationOptions): Promise<import('./types.js').PaginationResult<ModelInstance<TFields, TRelations>>>;
    with(...relations: readonly string[]): QueryBuilder<ModelInstance<TFields, TRelations>>;
    create(attributes: InferCreationAttributes<TFields>): Promise<ModelInstance<TFields, TRelations>>;
    bulkCreate(records: readonly InferCreationAttributes<TFields>[]): Promise<readonly ModelInstance<TFields, TRelations>[]>;
}
export declare function defineModel<TFields extends Record<string, FieldDefinition<unknown>>, TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>>(name: string, fields: TFields, options?: Partial<Omit<ModelDefinitionOptions<TFields, TRelations>, 'name' | 'fields'>>): DefinedModelStatic<TFields, TRelations>;
export declare function defineModel<TFields extends Record<string, FieldDefinition<unknown>>, TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>>(options: ModelDefinitionOptions<TFields, TRelations>): DefinedModelStatic<TFields, TRelations>;
export declare const model: typeof defineModel;
//# sourceMappingURL=model.d.ts.map