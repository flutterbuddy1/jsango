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
import { SqlCompiler } from '../internal/compiler.js';
import { Hydrator } from '../internal/hydration.js';
import { ModelNotFoundError, QueryError } from './errors.js';
import { defaultModelRegistry } from './registry.js';
import { getDatabaseManager } from './connection.js';

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
    if (explicit) {
      return fn(explicit);
    }
    const meta = (this.constructor as typeof Model).metadata;
    const manager = getDatabaseManager();
    if (!manager) {
      throw new QueryError(
        `No database connection provided for model '${meta.name}'. Pass connection via options or configure via setDatabaseManager().`
      );
    }
    const conn = await manager.connection(meta.connection);
    try {
      return await fn(conn);
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  }

  public async save(options?: { connection?: QueryContext }): Promise<this> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
      const compiler = new SqlCompiler();

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

        const result = await conn.query<Record<string, unknown>>(sql, params);

        // Assign auto-generated primary key if returned
        const pkMeta = meta.getField(meta.primaryKey);
        if (pkMeta?.autoIncrement && result.lastInsertId !== undefined) {
          this._attributes[meta.primaryKey] = result.lastInsertId;
        } else if (result.rows.length > 0 && result.rows[0]![meta.primaryKey] !== undefined) {
          this._attributes[meta.primaryKey] = result.rows[0]![meta.primaryKey];
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

      await conn.query<Record<string, unknown>>(sql, params);
      this._originalAttributes = { ...this._attributes };
      return this;
    });
  }

  public async delete(options?: { connection?: QueryContext; force?: boolean }): Promise<void> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
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

  public async refresh(options?: { connection?: QueryContext }): Promise<this> {
    return this.executeWithConnection(options?.connection, async (conn) => {
      const meta = (this.constructor as typeof Model).metadata;
      const pkVal = this.primaryKey;

      if (pkVal === undefined || pkVal === null) {
        throw new QueryError(`Cannot refresh model '${meta.name}' without a primary key.`);
      }

      const modelClass = this.constructor as unknown as ModelStatic;
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
  find(id: unknown): Promise<ModelInstance<TFields, TRelations> | null>;
  findOrFail(id: unknown): Promise<ModelInstance<TFields, TRelations>>;
  create(attributes: InferCreationAttributes<TFields>): Promise<ModelInstance<TFields, TRelations>>;
  bulkCreate(
    records: readonly InferCreationAttributes<TFields>[]
  ): Promise<readonly ModelInstance<TFields, TRelations>[]>;
}

export function defineModel<
  TFields extends Record<string, FieldDefinition<unknown>>,
  TRelations extends Record<string, RelationDefinition> = Record<string, RelationDefinition>,
>(options: ModelDefinitionOptions<TFields, TRelations>): DefinedModelStatic<TFields, TRelations> {
  const metadata = new ModelMetadata(options);

  class DefinedModel extends Model {
    public static override readonly metadata: ModelMetadata = metadata;
    public static override readonly modelName: string = options.name;
    public static override readonly tableName: string = options.table;

    public static query(): QueryBuilder<Model> {
      return new QueryBuilder(this as unknown as ModelStatic);
    }

    public static async find(id: unknown): Promise<Model | null> {
      return this.query().find(id);
    }

    public static async findOrFail(id: unknown): Promise<Model> {
      return this.query().findOrFail(id);
    }

    public static async create(attributes: Record<string, unknown>): Promise<Model> {
      const instance = new this(attributes, true);
      await instance.save();
      return instance;
    }

    public static async bulkCreate(
      records: readonly Record<string, unknown>[]
    ): Promise<readonly Model[]> {
      if (records.length === 0) {
        return Object.freeze([]);
      }

      const compiler = new SqlCompiler();
      const manager = getDatabaseManager();
      if (!manager) {
        throw new QueryError(
          `No database connection provided for model '${this.modelName}'. Call setDatabaseManager().`
        );
      }
      const conn = await manager.connection(this.metadata.connection);
      try {
        // Normalize columns
        const first = records[0]!;
        const cols = Object.keys(first).map((key) => this.metadata.fieldToColumn(key));
        const rows: unknown[][] = [];

        for (const rec of records) {
          const rowVals: unknown[] = [];
          for (const key of Object.keys(first)) {
            let val = rec[key];
            const fieldMeta = this.metadata.getField(key);
            if (val === undefined && fieldMeta?.defaultValue !== undefined) {
              val =
                typeof fieldMeta.defaultValue === 'function'
                  ? (fieldMeta.defaultValue as () => unknown)()
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

        const result = await conn.query<Record<string, unknown>>(sql, params);

        // If returned rows exist, hydrate them. Otherwise instantiate with input records.
        if (result.rows.length > 0) {
          return Hydrator.hydrateModels(result.rows, this as unknown as ModelStatic);
        }

        return Object.freeze(records.map((r) => new this(r, false)));
      } finally {
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
