import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';
import type { Model } from './model.js';
import type { QueryBuilder } from './query.js';
import type { ModelMetadata } from './metadata.js';
import type { ModelRegistry } from './registry.js';

export type FieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'dateTime'
  | 'date'
  | 'time'
  | 'json'
  | 'uuid'
  | 'binary';

export type RelationType = 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany';

export interface FieldOptions<T = unknown> {
  readonly type: FieldType;
  readonly nullable?: boolean | undefined;
  readonly primaryKey?: boolean | undefined;
  readonly autoIncrement?: boolean | undefined;
  readonly unique?: boolean | undefined;
  readonly indexed?: boolean | undefined;
  readonly default?: T | (() => T) | undefined;
  readonly columnName?: string | undefined;
  readonly length?: number | undefined;
  readonly precision?: number | undefined;
  readonly scale?: number | undefined;
  readonly comment?: string | undefined;
  readonly options?: Readonly<Record<string, unknown>> | undefined;
}

export type FieldDefinition<T = unknown> = FieldOptions<T>;

export interface RelationOptions {
  readonly type: RelationType;
  readonly target: (() => ModelStatic | string) | string;
  readonly foreignKey: string;
  readonly localKey?: string | undefined;
  readonly through?: (() => ModelStatic | string) | string | undefined;
  readonly pivotForeignKey?: string | undefined;
  readonly pivotTargetKey?: string | undefined;
  readonly inverseRelation?: string | undefined;
  readonly options?: Readonly<Record<string, unknown>> | undefined;
}

export type RelationDefinition = RelationOptions;

export interface IndexDefinition {
  readonly name?: string | undefined;
  readonly columns: readonly string[];
  readonly unique?: boolean | undefined;
}

export interface TimestampsConfig {
  readonly createdAt?: string | undefined;
  readonly updatedAt?: string | undefined;
}

export interface SoftDeleteConfig {
  readonly deletedAt?: string | undefined;
}

export interface ModelDefinitionOptions<
  TFields extends Record<string, FieldDefinition<unknown>> = Record<
    string,
    FieldDefinition<unknown>
  >,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
> {
  readonly name: string;
  readonly table: string;
  readonly connection?: string | undefined;
  readonly primaryKey?: string | undefined;
  readonly fields: TFields;
  readonly relations?: TRelations | undefined;
  readonly timestamps?: boolean | TimestampsConfig | undefined;
  readonly softDelete?: boolean | SoftDeleteConfig | undefined;
  readonly indexes?: readonly IndexDefinition[] | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly registry?: boolean | ModelRegistry | undefined;
}

export type WhereOperator =
  | '='
  | '!='
  | '<>'
  | '>'
  | '>='
  | '<'
  | '<='
  | 'LIKE'
  | 'ILIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL';

export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginationResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface CompiledQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export type QueryContext = IDatabaseConnection | IDatabaseTransaction;

export type InferScalarFieldType<TType extends FieldType> = TType extends 'string' | 'text' | 'uuid'
  ? string
  : TType extends 'integer' | 'float' | 'decimal'
    ? number
    : TType extends 'bigint'
      ? bigint
      : TType extends 'boolean'
        ? boolean
        : TType extends 'dateTime' | 'date' | 'time'
          ? Date
          : TType extends 'json'
            ? Record<string, unknown> | unknown[] | string | number | boolean | null
            : TType extends 'binary'
              ? Uint8Array
              : unknown;

export type InferFieldType<F> =
  F extends FieldDefinition<infer TExplicit>
    ? [TExplicit] extends [never]
      ? F['nullable'] extends true
        ? InferScalarFieldType<F['type']> | null
        : InferScalarFieldType<F['type']>
      : [unknown] extends [TExplicit]
        ? F['nullable'] extends true
          ? InferScalarFieldType<F['type']> | null
          : InferScalarFieldType<F['type']>
        : F['nullable'] extends true
          ? TExplicit | null
          : TExplicit
    : unknown;

export type InferModelAttributes<TFields extends Record<string, FieldDefinition<unknown>>> = {
  [K in keyof TFields]: InferFieldType<TFields[K]>;
};

type OptionalPropertyNames<TFields extends Record<string, FieldDefinition<unknown>>> = {
  [K in keyof TFields]: TFields[K] extends { default: unknown }
    ? K
    : TFields[K] extends { autoIncrement: true }
      ? K
      : TFields[K] extends { nullable: true }
        ? K
        : never;
}[keyof TFields];

type RequiredPropertyNames<TFields extends Record<string, FieldDefinition<unknown>>> = Exclude<
  keyof TFields,
  OptionalPropertyNames<TFields>
>;

export type InferCreationAttributes<TFields extends Record<string, FieldDefinition<unknown>>> = {
  [K in RequiredPropertyNames<TFields>]: InferFieldType<TFields[K]>;
} & {
  [K in OptionalPropertyNames<TFields>]?: InferFieldType<TFields[K]> | undefined;
};

export interface ModelStatic<TModel extends Model = Model> {
  new (attributes?: Record<string, unknown>, isNew?: boolean): TModel;
  readonly modelName: string;
  readonly tableName: string;
  readonly metadata: ModelMetadata;
  query(): QueryBuilder<TModel>;
  find(id: unknown): Promise<TModel | null>;
  findOrFail(id: unknown): Promise<TModel>;
  create(attributes: Record<string, unknown>): Promise<TModel>;
  bulkCreate(records: readonly Record<string, unknown>[]): Promise<readonly TModel[]>;
}
