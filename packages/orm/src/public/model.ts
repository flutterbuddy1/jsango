import type {
  FieldDefinition,
  RelationDefinition,
  ModelDefinitionOptions,
  ModelStatic,
  QueryContext,
  InferModelAttributes,
  InferCreationAttributes,
} from './types.js';
import { ModelMetadata } from './metadata.js';
import { QueryBuilder } from './query.js';
import { engineFor, modelInfo } from '../internal/engine.js';
import { Hydrator } from '../internal/hydration.js';
import { ModelNotFoundError, QueryError } from './errors.js';
import { defaultModelRegistry } from './registry.js';
import { withQueryContext } from './connection.js';

/**
 * Only declared fields (plus timestamp / soft-delete columns) are written to the database, so
 * extra keys in user input (e.g. a request body) never become invalid column names in SQL.
 * Models without declared fields keep the permissive behaviour.
 */
function isPersistedAttribute(meta: ModelMetadata, key: string): boolean {
  if (meta.fields.size === 0) return true;
  if (meta.hasField(key)) return true;
  if (
    meta.timestamps.enabled &&
    (key === meta.timestamps.createdAt || key === meta.timestamps.updatedAt)
  ) {
    return true;
  }
  return meta.softDelete.enabled && key === meta.softDelete.deletedAt;
}

export interface ModelWriteOptions {
  /** Run on this connection or transaction instead of the default/ambient one. */
  readonly connection?: QueryContext | undefined;
}

export class Model {
  public static readonly metadata: ModelMetadata;
  public static readonly modelName: string;
  public static readonly tableName: string;

  protected _attributes: Record<string, unknown> = {};
  protected _originalAttributes: Record<string, unknown> = {};
  protected _isNew = true;
  protected _relations = new Map<string, unknown>();

  constructor(attributes: Record<string, unknown> = {}, isNew = true) {
    this._isNew = isNew;
    this._attributes = { ...attributes };
    if (!isNew) {
      this._originalAttributes = { ...attributes };
    }
  }

  public get isNew(): boolean {
    return this._isNew;
  }

  public get primaryKey(): unknown {
    const meta = (this.constructor as typeof Model).metadata;
    return this._attributes[meta.primaryKey];
  }

  public getAttributes(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this._attributes });
  }

  public setAttribute<K extends string>(key: K, value: unknown): void {
    this._attributes[key] = value;
  }

  public get<T = unknown>(field: string): T {
    return this._attributes[field] as T;
  }

  public set(field: string, value: unknown): this {
    this._attributes[field] = value;
    return this;
  }

  public isDirty(field?: string): boolean {
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

  public getDirty(): Record<string, unknown> {
    if (this._isNew) {
      return { ...this._attributes };
    }
    const dirty: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(this._attributes)) {
      if (val !== this._originalAttributes[key]) {
        dirty[key] = val;
      }
    }
    return dirty;
  }

  public getOriginal(field?: string): unknown {
    if (field !== undefined) {
      return this._originalAttributes[field];
    }
    return Object.freeze({ ...this._originalAttributes });
  }

  public getRelation<T = unknown>(relationName: string): T | undefined {
    return this._relations.get(relationName) as T | undefined;
  }

  public setRelation(relationName: string, value: unknown): this {
    this._relations.set(relationName, value);
    return this;
  }

  private async executeWithConnection<T>(
    explicit: QueryContext | undefined,
    fn: (conn: QueryContext) => Promise<T>
  ): Promise<T> {
    const meta = (this.constructor as typeof Model).metadata;
    return withQueryContext(explicit, meta.connection, fn);
  }

  /** Merges a row returned by the database (RETURNING) into the model's attributes. */
  private absorbReturnedRow(row: Record<string, unknown> | undefined): void {
    if (!row) return;
    const meta = (this.constructor as typeof Model).metadata;
    const hydrated = Hydrator.hydrateRow(row, meta);
    for (const [key, val] of Object.entries(hydrated)) {
      if (val !== undefined) {
        this._attributes[key] = val;
      }
    }
  }

  public async save(options?: ModelWriteOptions): Promise<this> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
      const engine = engineFor(conn);
      const info = modelInfo(meta);

      if (this._isNew) {
        // 1. Apply defaults for any missing fields
        for (const [fieldName, fieldMeta] of meta.fields.entries()) {
          if (this._attributes[fieldName] === undefined && fieldMeta.defaultValue !== undefined) {
            this._attributes[fieldName] =
              typeof fieldMeta.defaultValue === 'function'
                ? (fieldMeta.defaultValue as () => unknown)()
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
        const cols: string[] = [];
        const rowValues: unknown[] = [];

        for (const [fieldName, val] of Object.entries(this._attributes)) {
          if (val !== undefined && isPersistedAttribute(meta, fieldName)) {
            cols.push(meta.fieldToColumn(fieldName));
            rowValues.push(engine.serialize(meta, fieldName, val));
          }
        }

        if (cols.length === 0) {
          throw new QueryError(
            `Cannot insert '${meta.name}' without any values. Set at least one field before saving.`
          );
        }

        const result = await engine.insert(
          conn,
          { table: meta.table, columns: cols, rows: [rowValues], returning: ['*'] },
          info
        );

        // Prefer the row returned by RETURNING (includes DB defaults and generated keys);
        // fall back to the driver's last insert id (MySQL).
        const pkMeta = meta.getField(meta.primaryKey);
        const pkColumn = meta.fieldToColumn(meta.primaryKey);
        if (result.rows.length > 0 && result.rows[0]![pkColumn] !== undefined) {
          this.absorbReturnedRow(result.rows[0]);
        } else if (
          pkMeta?.autoIncrement &&
          result.lastInsertId !== undefined &&
          this._attributes[meta.primaryKey] === undefined
        ) {
          this._attributes[meta.primaryKey] = result.lastInsertId;
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
      const updateValues: Record<string, unknown> = {};
      for (const [fieldName, val] of Object.entries(dirty)) {
        if (!isPersistedAttribute(meta, fieldName)) continue;
        updateValues[meta.fieldToColumn(fieldName)] = engine.serialize(meta, fieldName, val);
      }
      if (Object.keys(updateValues).length === 0) {
        this._originalAttributes = { ...this._attributes };
        return this;
      }

      const pkCol = meta.fieldToColumn(meta.primaryKey);
      const pkVal = this._originalAttributes[meta.primaryKey] ?? this._attributes[meta.primaryKey];

      await engine.update(
        conn,
        {
          table: meta.table,
          values: updateValues,
          where: [
            { type: 'comparison', column: pkCol, operator: '=', value: pkVal, boolean: 'AND' },
          ],
        },
        info
      );
      this._originalAttributes = { ...this._attributes };
      return this;
    });
  }

  public async delete(options?: ModelWriteOptions & { force?: boolean }): Promise<void> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
      const pkCol = meta.fieldToColumn(meta.primaryKey);
      const pkVal = this.primaryKey;

      if (pkVal === undefined || pkVal === null) {
        throw new QueryError(`Cannot delete model '${meta.name}' without a primary key.`);
      }

      if (meta.softDelete.enabled && !options?.force) {
        this._attributes[meta.softDelete.deletedAt] = new Date();
        await this.save({ connection: conn });
        return;
      }

      await engineFor(conn).delete(
        conn,
        {
          table: meta.table,
          where: [
            { type: 'comparison', column: pkCol, operator: '=', value: pkVal, boolean: 'AND' },
          ],
        },
        modelInfo(meta)
      );
    });
  }

  /** Restores a soft-deleted model (clears `deletedAt`). */
  public async restore(options?: ModelWriteOptions): Promise<this> {
    const meta = (this.constructor as typeof Model).metadata;
    if (!meta.softDelete.enabled) {
      throw new QueryError(`Model '${meta.name}' does not use soft deletes.`);
    }
    this._attributes[meta.softDelete.deletedAt] = null;
    return this.save(options);
  }

  /**
   * Atomically adds `amount` to a column in the database (no read-modify-write race) and updates
   * this instance: `await post.increment('views')`.
   */
  public async increment(field: string, amount = 1, options?: ModelWriteOptions): Promise<this> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
      const pkVal = this.primaryKey;
      if (pkVal === undefined || pkVal === null) {
        throw new QueryError(`Cannot increment '${meta.name}.${field}' before the model is saved.`);
      }
      const values: Record<string, unknown> = {};
      if (meta.timestamps.enabled) {
        const now = new Date();
        values[meta.fieldToColumn(meta.timestamps.updatedAt)] = now;
        this._attributes[meta.timestamps.updatedAt] = now;
      }
      await engineFor(conn).update(
        conn,
        {
          table: meta.table,
          values,
          increments: { [meta.fieldToColumn(field)]: amount },
          where: [
            {
              type: 'comparison',
              column: meta.fieldToColumn(meta.primaryKey),
              operator: '=',
              value: pkVal,
              boolean: 'AND',
            },
          ],
        },
        modelInfo(meta)
      );
      const current = Number(this._attributes[field] ?? 0);
      this._attributes[field] = current + amount;
      this._originalAttributes = { ...this._originalAttributes, ...this._attributes };
      return this;
    });
  }

  public async decrement(field: string, amount = 1, options?: ModelWriteOptions): Promise<this> {
    return this.increment(field, -amount, options);
  }

  public async refresh(options?: ModelWriteOptions): Promise<this> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
      const pkVal = this.primaryKey;

      if (pkVal === undefined || pkVal === null) {
        throw new QueryError(`Cannot refresh model '${meta.name}' without a primary key.`);
      }

      const modelClass = this.constructor as unknown as ModelStatic;
      const fresh = await modelClass.query().withTrashed().using(conn).find(pkVal);

      if (!fresh) {
        throw new ModelNotFoundError(meta.name, pkVal);
      }

      this._attributes = { ...fresh.getAttributes() };
      this._originalAttributes = { ...this._attributes };
      this._isNew = false;
      return this;
    });
  }

  public toJSON(): Record<string, unknown> {
    const json: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(this._attributes)) {
      if (val instanceof Date) {
        json[key] = val.toISOString();
      } else {
        json[key] = val;
      }
    }

    for (const [relName, relVal] of this._relations.entries()) {
      if (Array.isArray(relVal)) {
        json[relName] = relVal.map((item) =>
          item && typeof item === 'object' && 'toJSON' in item ? item.toJSON() : item
        );
      } else if (relVal && typeof relVal === 'object' && 'toJSON' in relVal) {
        json[relName] = (relVal as { toJSON(): unknown }).toJSON();
      } else {
        json[relName] = relVal;
      }
    }

    return json;
  }
}

export type ModelInstance<
  TFields extends Record<string, FieldDefinition<unknown>>,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
> = Model &
  InferModelAttributes<TFields> & {
    [R in keyof TRelations]?: TRelations[R] extends { type: 'hasMany' | 'manyToMany' }
      ? readonly Model[]
      : Model | null;
  };

export interface DefinedModelStatic<
  TFields extends Record<string, FieldDefinition<unknown>>,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
> {
  new (
    attributes?: Partial<InferModelAttributes<TFields>>,
    isNew?: boolean
  ): ModelInstance<TFields, TRelations>;
  readonly modelName: string;
  readonly tableName: string;
  readonly metadata: ModelMetadata;
  query(): QueryBuilder<ModelInstance<TFields, TRelations>>;
  all(): Promise<readonly ModelInstance<TFields, TRelations>[]>;
  find(id: unknown): Promise<ModelInstance<TFields, TRelations> | null>;
  findOrFail(id: unknown): Promise<ModelInstance<TFields, TRelations>>;
  first(): Promise<ModelInstance<TFields, TRelations> | null>;
  where(
    columnOrConditions: string | Record<string, unknown>,
    operatorOrValue?: unknown,
    value?: unknown
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  orWhere(
    columnOrConditions: string | Record<string, unknown>,
    operatorOrValue?: unknown,
    value?: unknown
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereIn(
    column: string,
    values: readonly unknown[]
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereNotIn(
    column: string,
    values: readonly unknown[]
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereNull(column: string): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereNotNull(column: string): QueryBuilder<ModelInstance<TFields, TRelations>>;
  orderBy(
    column: string,
    direction?: 'ASC' | 'DESC'
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  limit(n: number): QueryBuilder<ModelInstance<TFields, TRelations>>;
  offset(n: number): QueryBuilder<ModelInstance<TFields, TRelations>>;
  count(column?: string): Promise<number>;
  paginate(
    options: import('./types.js').PaginationOptions
  ): Promise<import('./types.js').PaginationResult<ModelInstance<TFields, TRelations>>>;
  with(...relations: readonly string[]): QueryBuilder<ModelInstance<TFields, TRelations>>;
  withTrashed(): QueryBuilder<ModelInstance<TFields, TRelations>>;
  onlyTrashed(): QueryBuilder<ModelInstance<TFields, TRelations>>;
  select(...columns: readonly string[]): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereNot(
    columnOrConditions: string | Record<string, unknown>,
    operatorOrValue?: unknown,
    value?: unknown
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereBetween(
    column: string,
    range: readonly [unknown, unknown]
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereLike(
    column: string,
    pattern: string,
    options?: { caseSensitive?: boolean }
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  whereRaw(
    sqlOrFilter: string | Record<string, unknown>,
    params?: readonly unknown[]
  ): QueryBuilder<ModelInstance<TFields, TRelations>>;
  latest(column?: string): QueryBuilder<ModelInstance<TFields, TRelations>>;
  oldest(column?: string): QueryBuilder<ModelInstance<TFields, TRelations>>;
  findMany(ids: readonly unknown[]): Promise<readonly ModelInstance<TFields, TRelations>[]>;
  pluck<T = unknown>(column: string): Promise<T[]>;
  exists(): Promise<boolean>;
  sum(column: string): Promise<number>;
  avg(column: string): Promise<number | null>;
  min(column: string): Promise<number | null>;
  max(column: string): Promise<number | null>;
  /** Returns the first row matching `where`, or creates it from `where` + `values`. */
  firstOrCreate(
    where: Partial<InferModelAttributes<TFields>> & Record<string, unknown>,
    values?: Partial<InferModelAttributes<TFields>> & Record<string, unknown>,
    options?: ModelWriteOptions
  ): Promise<ModelInstance<TFields, TRelations>>;
  /** Updates the first row matching `where` with `values`, or creates it. */
  updateOrCreate(
    where: Partial<InferModelAttributes<TFields>> & Record<string, unknown>,
    values: Partial<InferModelAttributes<TFields>> & Record<string, unknown>,
    options?: ModelWriteOptions
  ): Promise<ModelInstance<TFields, TRelations>>;
  create(
    attributes: InferCreationAttributes<TFields>,
    options?: ModelWriteOptions
  ): Promise<ModelInstance<TFields, TRelations>>;
  bulkCreate(
    records: readonly InferCreationAttributes<TFields>[],
    options?: ModelWriteOptions
  ): Promise<readonly ModelInstance<TFields, TRelations>[]>;
}

export function defineModel<
  TFields extends Record<string, FieldDefinition<unknown>>,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
>(
  name: string,
  fields: TFields,
  options?: Partial<Omit<ModelDefinitionOptions<TFields, TRelations>, 'name' | 'fields'>>
): DefinedModelStatic<TFields, TRelations>;
export function defineModel<
  TFields extends Record<string, FieldDefinition<unknown>>,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
>(options: ModelDefinitionOptions<TFields, TRelations>): DefinedModelStatic<TFields, TRelations>;
export function defineModel<
  TFields extends Record<string, FieldDefinition<unknown>>,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
>(
  nameOrOptions: string | ModelDefinitionOptions<TFields, TRelations>,
  fieldsArg?: TFields,
  extraOptions?: Partial<Omit<ModelDefinitionOptions<TFields, TRelations>, 'name' | 'fields'>>
): DefinedModelStatic<TFields, TRelations> {
  const options: ModelDefinitionOptions<TFields, TRelations> =
    typeof nameOrOptions === 'string'
      ? ({
          name: nameOrOptions,
          fields: fieldsArg ?? ({} as TFields),
          ...extraOptions,
        } as unknown as ModelDefinitionOptions<TFields, TRelations>)
      : nameOrOptions;

  const metadata = new ModelMetadata(options as unknown as ModelDefinitionOptions);

  class DefinedModel extends Model {
    public static override readonly metadata: ModelMetadata = metadata;
    public static override readonly modelName: string = options.name;
    public static override readonly tableName: string = metadata.table;

    public static query(): QueryBuilder<Model> {
      return new QueryBuilder(this as unknown as ModelStatic);
    }

    public static async all(): Promise<readonly Model[]> {
      return this.query().get();
    }

    public static async find(id: unknown): Promise<Model | null> {
      return this.query().find(id);
    }

    public static async findOrFail(id: unknown): Promise<Model> {
      return this.query().findOrFail(id);
    }

    public static async first(): Promise<Model | null> {
      return this.query().first();
    }

    public static where(
      columnOrConditions: string | Record<string, unknown>,
      operatorOrValue?: unknown,
      value?: unknown
    ): QueryBuilder<Model> {
      return this.query().where(columnOrConditions as any, operatorOrValue as any, value);
    }

    public static orWhere(
      columnOrConditions: string | Record<string, unknown>,
      operatorOrValue?: unknown,
      value?: unknown
    ): QueryBuilder<Model> {
      return this.query().orWhere(columnOrConditions as any, operatorOrValue as any, value);
    }

    public static whereIn(column: string, values: readonly unknown[]): QueryBuilder<Model> {
      return this.query().whereIn(column, values);
    }

    public static whereNotIn(column: string, values: readonly unknown[]): QueryBuilder<Model> {
      return this.query().whereNotIn(column, values);
    }

    public static whereNull(column: string): QueryBuilder<Model> {
      return this.query().whereNull(column);
    }

    public static whereNotNull(column: string): QueryBuilder<Model> {
      return this.query().whereNotNull(column);
    }

    public static orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder<Model> {
      return this.query().orderBy(column, direction);
    }

    public static limit(n: number): QueryBuilder<Model> {
      return this.query().limit(n);
    }

    public static offset(n: number): QueryBuilder<Model> {
      return this.query().offset(n);
    }

    public static async count(column?: string): Promise<number> {
      return this.query().count(column);
    }

    public static async paginate(
      options: import('./types.js').PaginationOptions
    ): Promise<import('./types.js').PaginationResult<Model>> {
      return this.query().paginate(options);
    }

    public static with(...relations: readonly string[]): QueryBuilder<Model> {
      return this.query().with(...relations);
    }

    public static withTrashed(): QueryBuilder<Model> {
      return this.query().withTrashed();
    }

    public static select(...columns: readonly string[]): QueryBuilder<Model> {
      return this.query().select(...columns);
    }

    public static whereNot(
      columnOrConditions: string | Record<string, unknown>,
      operatorOrValue?: unknown,
      value?: unknown
    ): QueryBuilder<Model> {
      return this.query().whereNot(columnOrConditions, operatorOrValue, value);
    }

    public static whereBetween(
      column: string,
      range: readonly [unknown, unknown]
    ): QueryBuilder<Model> {
      return this.query().whereBetween(column, range);
    }

    public static whereLike(
      column: string,
      pattern: string,
      options?: { caseSensitive?: boolean }
    ): QueryBuilder<Model> {
      return this.query().whereLike(column, pattern, options);
    }

    public static whereRaw(
      sqlOrFilter: string | Record<string, unknown>,
      params?: readonly unknown[]
    ): QueryBuilder<Model> {
      return this.query().whereRaw(sqlOrFilter, params);
    }

    public static latest(column?: string): QueryBuilder<Model> {
      return this.query().latest(column);
    }

    public static oldest(column?: string): QueryBuilder<Model> {
      return this.query().oldest(column);
    }

    public static findMany(ids: readonly unknown[]): Promise<readonly Model[]> {
      return this.query().findMany(ids);
    }

    public static pluck<T = unknown>(column: string): Promise<T[]> {
      return this.query().pluck<T>(column);
    }

    public static exists(): Promise<boolean> {
      return this.query().exists();
    }

    public static sum(column: string): Promise<number> {
      return this.query().sum(column);
    }

    public static avg(column: string): Promise<number | null> {
      return this.query().avg(column);
    }

    public static min(column: string): Promise<number | null> {
      return this.query().min(column);
    }

    public static max(column: string): Promise<number | null> {
      return this.query().max(column);
    }

    public static async firstOrCreate(
      where: Record<string, unknown>,
      values: Record<string, unknown> = {},
      options?: ModelWriteOptions
    ): Promise<Model> {
      const query = options?.connection ? this.query().using(options.connection) : this.query();
      const existing = await query.where(where).first();
      if (existing) return existing;
      return this.create({ ...where, ...values }, options);
    }

    public static async updateOrCreate(
      where: Record<string, unknown>,
      values: Record<string, unknown>,
      options?: ModelWriteOptions
    ): Promise<Model> {
      const query = options?.connection ? this.query().using(options.connection) : this.query();
      const existing = await query.where(where).first();
      if (!existing) return this.create({ ...where, ...values }, options);
      for (const [key, val] of Object.entries(values)) existing.set(key, val);
      await existing.save(options);
      return existing;
    }

    public static onlyTrashed(): QueryBuilder<Model> {
      return this.query().onlyTrashed();
    }

    public static async create(
      attributes: Record<string, unknown>,
      options?: ModelWriteOptions
    ): Promise<Model> {
      const instance = new this(attributes, true);
      await instance.save(options);
      return instance;
    }

    public static async bulkCreate(
      records: readonly Record<string, unknown>[],
      options?: ModelWriteOptions
    ): Promise<readonly Model[]> {
      if (records.length === 0) {
        return Object.freeze([]);
      }

      const meta = this.metadata;
      return withQueryContext(options?.connection, meta.connection, async (conn) => {
        const engine = engineFor(conn);
        const now = new Date();

        // Apply defaults and timestamps, then use the union of keys so every row has every column.
        const prepared = records.map((rec) => {
          const row: Record<string, unknown> = { ...rec };
          for (const [fieldName, fieldMeta] of meta.fields.entries()) {
            if (row[fieldName] === undefined && fieldMeta.defaultValue !== undefined) {
              row[fieldName] =
                typeof fieldMeta.defaultValue === 'function'
                  ? (fieldMeta.defaultValue as () => unknown)()
                  : fieldMeta.defaultValue;
            }
          }
          if (meta.timestamps.enabled) {
            row[meta.timestamps.createdAt] ??= now;
            row[meta.timestamps.updatedAt] ??= now;
          }
          return row;
        });

        const keys = [...new Set(prepared.flatMap((row) => Object.keys(row)))].filter(
          (key) => isPersistedAttribute(meta, key) && prepared.some((row) => row[key] !== undefined)
        );
        const cols = keys.map((key) => meta.fieldToColumn(key));
        const rows = prepared.map((row) =>
          keys.map((key) => engine.serialize(meta, key, row[key] ?? null))
        );

        const result = await engine.insert(
          conn,
          { table: meta.table, columns: cols, rows, returning: ['*'] },
          modelInfo(meta)
        );

        // If returned rows exist, hydrate them. Otherwise instantiate with input records.
        if (result.rows.length === prepared.length) {
          return Object.freeze(
            Hydrator.hydrateModels(result.rows, this as unknown as ModelStatic) as Model[]
          );
        }

        return Object.freeze(prepared.map((r) => new this(r, false)));
      });
    }
  }

  // Define properties on prototype for all fields, plus the implicit timestamp / soft-delete
  // columns so `user.createdAt` works without declaring the field.
  const implicitFields: string[] = [];
  if (metadata.timestamps.enabled) {
    implicitFields.push(metadata.timestamps.createdAt, metadata.timestamps.updatedAt);
  }
  if (metadata.softDelete.enabled) {
    implicitFields.push(metadata.softDelete.deletedAt);
  }
  for (const fieldName of [
    ...Object.keys(options.fields),
    ...implicitFields.filter((f) => !(f in options.fields)),
  ]) {
    Object.defineProperty(DefinedModel.prototype, fieldName, {
      get() {
        return this._attributes[fieldName];
      },
      set(value: unknown) {
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
        set(value: unknown) {
          this._relations.set(relName, value);
        },
        enumerable: true,
        configurable: true,
      });
    }
  }

  if (options.registry !== false) {
    const reg =
      typeof options.registry === 'object' && options.registry !== null
        ? options.registry
        : defaultModelRegistry;
    reg.register(DefinedModel as unknown as ModelStatic);
  }

  return DefinedModel as unknown as DefinedModelStatic<TFields, TRelations>;
}

export const model = defineModel;
