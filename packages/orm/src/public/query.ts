import type {
  WhereOperator,
  OrderDirection,
  PaginationOptions,
  PaginationResult,
  CompiledQuery,
  QueryContext,
  ModelStatic,
} from './types.js';
import type { Model } from './model.js';
import type {
  AggregateFunction,
  GroupAggregate,
  HavingNode,
  OrderByNode,
  SelectAst,
  WhereConditionNode,
} from '../internal/ast.js';
import { SqlCompiler } from '../internal/compiler.js';
import { Hydrator } from '../internal/hydration.js';
import { EagerLoader } from '../internal/eager-loader.js';
import { engineFor, modelInfo, type QueryEngine } from '../internal/engine.js';
import { ModelNotFoundError, QueryError } from './errors.js';
import { defaultModelRegistry, type ModelRegistry } from './registry.js';
import { withQueryContext } from './connection.js';

/** How soft-deleted rows are treated: excluded (default), included, or the only rows returned. */
export type TrashedMode = 'exclude' | 'include' | 'only';

export interface QueryBuilderOptions {
  readonly compiler?: SqlCompiler | undefined;
  readonly registry?: ModelRegistry | undefined;
  readonly context?: QueryContext | undefined;
  readonly eagerRelations?: readonly string[] | undefined;
  readonly trashed?: TrashedMode | undefined;
}

/** Callback form of where()/orWhere() used to build a parenthesized group. */
export type WhereGroupCallback<TModel extends Model> = (query: QueryBuilder<TModel>) => QueryBuilder<TModel>;

/** Aggregates for groupBy(): `{ total: ['sum', 'amount'], orders: ['count'] }`. */
export type GroupAggregates = Readonly<
  Record<string, readonly [AggregateFunction] | readonly [AggregateFunction, string]>
>;

export interface GroupByOptions {
  readonly having?: readonly (readonly [string, HavingNode['operator'], number])[] | undefined;
  readonly orderBy?: readonly (readonly [string, OrderDirection])[] | undefined;
  readonly limit?: number | undefined;
}

export class QueryBuilder<TModel extends Model = Model> {
  private readonly modelClass: ModelStatic<TModel>;
  private readonly ast: SelectAst;
  private readonly explicitCompiler: SqlCompiler | undefined;
  private readonly registry: ModelRegistry;
  private readonly context?: QueryContext | undefined;
  private readonly eagerRelations: readonly string[];
  private readonly trashed: TrashedMode;

  constructor(modelClass: ModelStatic<TModel>, ast?: SelectAst, options?: QueryBuilderOptions) {
    this.modelClass = modelClass;
    this.ast = ast ?? {
      table: modelClass.tableName,
      columns: [],
      where: [],
      orderBy: [],
    };
    this.explicitCompiler = options?.compiler;
    this.registry = options?.registry ?? defaultModelRegistry;
    this.context = options?.context;
    this.trashed = options?.trashed ?? 'exclude';
    this.eagerRelations = options?.eagerRelations
      ? Object.freeze([...options.eagerRelations])
      : Object.freeze([]);
  }

  public clone(
    modifiedAst?: Partial<SelectAst>,
    modifiedOptions?: Partial<QueryBuilderOptions>
  ): QueryBuilder<TModel> {
    const has = (key: keyof SelectAst) => modifiedAst !== undefined && key in modifiedAst;
    const newAst: SelectAst = {
      table: modifiedAst?.table ?? this.ast.table,
      columns: modifiedAst?.columns ?? [...this.ast.columns],
      where: modifiedAst?.where ?? [...this.ast.where],
      orderBy: modifiedAst?.orderBy ?? [...this.ast.orderBy],
      limit: has('limit') ? modifiedAst!.limit : this.ast.limit,
      offset: has('offset') ? modifiedAst!.offset : this.ast.offset,
      joins: modifiedAst?.joins ?? (this.ast.joins ? [...this.ast.joins] : undefined),
      distinct: has('distinct') ? modifiedAst!.distinct : this.ast.distinct,
      lock: has('lock') ? modifiedAst!.lock : this.ast.lock,
    };

    return new QueryBuilder<TModel>(this.modelClass, newAst, {
      compiler: modifiedOptions?.compiler ?? this.explicitCompiler,
      trashed: modifiedOptions?.trashed ?? this.trashed,
      registry: modifiedOptions?.registry ?? this.registry,
      context:
        modifiedOptions && 'context' in modifiedOptions ? modifiedOptions.context : this.context,
      eagerRelations:
        modifiedOptions && 'eagerRelations' in modifiedOptions
          ? modifiedOptions.eagerRelations
          : this.eagerRelations,
    });
  }

  private col(field: string): string {
    return this.modelClass.metadata.fieldToColumn(field);
  }

  private push(node: WhereConditionNode): QueryBuilder<TModel> {
    return this.clone({ where: [...this.ast.where, node] });
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  public select(...columns: readonly string[]): QueryBuilder<TModel> {
    return this.clone({ columns: columns.map((col) => this.col(col)) });
  }

  /** Removes duplicate rows (use together with select()). */
  public distinct(): QueryBuilder<TModel> {
    return this.clone({ distinct: true });
  }

  // -------------------------------------------------------------------------
  // Conditions
  // -------------------------------------------------------------------------

  /**
   * - `where('age', 18)` / `where('age', '>=', 18)` / `where({ role: 'admin', active: true })`
   * - `where((q) => q.where('a', 1).orWhere('b', 2))` for a parenthesized group
   */
  public where(
    columnOrConditions: string | Record<string, unknown> | WhereGroupCallback<TModel>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    return this.addWhere('AND', columnOrConditions, operatorOrValue, value);
  }

  public orWhere(
    columnOrConditions: string | Record<string, unknown> | WhereGroupCallback<TModel>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    return this.addWhere('OR', columnOrConditions, operatorOrValue, value);
  }

  /** Negated condition or group: `whereNot('status', 'banned')`, `whereNot((q) => ...)`. */
  public whereNot(
    columnOrCallback: string | Record<string, unknown> | WhereGroupCallback<TModel>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    const inner = this.freshQuery().addWhere('AND', columnOrCallback, operatorOrValue, value);
    return this.push({ type: 'group', column: '', operator: 'NOT', boolean: 'AND', children: inner.ast.where });
  }

  public orWhereNot(
    columnOrCallback: string | Record<string, unknown> | WhereGroupCallback<TModel>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    const inner = this.freshQuery().addWhere('AND', columnOrCallback, operatorOrValue, value);
    return this.push({ type: 'group', column: '', operator: 'NOT', boolean: 'OR', children: inner.ast.where });
  }

  /** A builder for the same model without conditions, used to build nested groups. */
  private freshQuery(): QueryBuilder<TModel> {
    return new QueryBuilder<TModel>(this.modelClass, undefined, { registry: this.registry });
  }

  private addWhere(
    boolean: 'AND' | 'OR',
    columnOrConditions: string | Record<string, unknown> | WhereGroupCallback<TModel>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    if (typeof columnOrConditions === 'function') {
      const inner = columnOrConditions(this.freshQuery());
      if (!(inner instanceof QueryBuilder)) {
        throw new QueryError('A where() callback must return the query builder it receives.');
      }
      return this.push({ type: 'group', column: '', operator: 'AND', boolean, children: inner.ast.where });
    }

    const newWhere = [...this.ast.where];

    if (typeof columnOrConditions === 'object' && columnOrConditions !== null) {
      const nodes: WhereConditionNode[] = Object.entries(columnOrConditions).map(([key, val]) =>
        val === null
          ? { type: 'null', column: this.col(key), operator: 'IS NULL', boolean: 'AND' }
          : Array.isArray(val)
            ? { type: 'in', column: this.col(key), operator: 'IN', values: [...val], boolean: 'AND' }
            : { type: 'comparison', column: this.col(key), operator: '=', value: val, boolean: 'AND' }
      );
      if (nodes.length === 0) return this;
      if (boolean === 'OR' && nodes.length > 1) {
        return this.push({ type: 'group', column: '', operator: 'AND', boolean, children: nodes });
      }
      nodes[0] = { ...nodes[0]!, boolean };
      return this.clone({ where: [...newWhere, ...nodes] });
    }

    const column = this.col(columnOrConditions);

    if (value !== undefined) {
      const op = String(operatorOrValue).trim().toUpperCase();
      if (value === null && (op === '=' || op === 'IS')) {
        newWhere.push({ type: 'null', column, operator: 'IS NULL', boolean });
      } else if (value === null && (op === '!=' || op === '<>' || op === 'IS NOT')) {
        newWhere.push({ type: 'null', column, operator: 'IS NOT NULL', boolean });
      } else if ((op === 'IN' || op === 'NOT IN') && Array.isArray(value)) {
        newWhere.push({ type: 'in', column, operator: op, values: [...value], boolean });
      } else if ((op === 'BETWEEN' || op === 'NOT BETWEEN') && Array.isArray(value)) {
        newWhere.push({ type: 'between', column, operator: op, values: [value[0], value[1]], boolean });
      } else {
        newWhere.push({ type: 'comparison', column, operator: op, value, boolean });
      }
    } else if (operatorOrValue === null) {
      newWhere.push({ type: 'null', column, operator: 'IS NULL', boolean });
    } else {
      newWhere.push({ type: 'comparison', column, operator: '=', value: operatorOrValue, boolean });
    }

    return this.clone({ where: newWhere });
  }

  public whereIn(column: string, values: readonly unknown[]): QueryBuilder<TModel> {
    return this.push({ type: 'in', column: this.col(column), operator: 'IN', values: [...values], boolean: 'AND' });
  }

  public orWhereIn(column: string, values: readonly unknown[]): QueryBuilder<TModel> {
    return this.push({ type: 'in', column: this.col(column), operator: 'IN', values: [...values], boolean: 'OR' });
  }

  public whereNotIn(column: string, values: readonly unknown[]): QueryBuilder<TModel> {
    return this.push({ type: 'in', column: this.col(column), operator: 'NOT IN', values: [...values], boolean: 'AND' });
  }

  public whereNull(column: string): QueryBuilder<TModel> {
    return this.push({ type: 'null', column: this.col(column), operator: 'IS NULL', boolean: 'AND' });
  }

  public orWhereNull(column: string): QueryBuilder<TModel> {
    return this.push({ type: 'null', column: this.col(column), operator: 'IS NULL', boolean: 'OR' });
  }

  public whereNotNull(column: string): QueryBuilder<TModel> {
    return this.push({ type: 'null', column: this.col(column), operator: 'IS NOT NULL', boolean: 'AND' });
  }

  public orWhereNotNull(column: string): QueryBuilder<TModel> {
    return this.push({ type: 'null', column: this.col(column), operator: 'IS NOT NULL', boolean: 'OR' });
  }

  /** Inclusive range: `whereBetween('price', [10, 20])`. */
  public whereBetween(column: string, range: readonly [unknown, unknown]): QueryBuilder<TModel> {
    return this.push({ type: 'between', column: this.col(column), operator: 'BETWEEN', values: [range[0], range[1]], boolean: 'AND' });
  }

  public orWhereBetween(column: string, range: readonly [unknown, unknown]): QueryBuilder<TModel> {
    return this.push({ type: 'between', column: this.col(column), operator: 'BETWEEN', values: [range[0], range[1]], boolean: 'OR' });
  }

  public whereNotBetween(column: string, range: readonly [unknown, unknown]): QueryBuilder<TModel> {
    return this.push({ type: 'between', column: this.col(column), operator: 'NOT BETWEEN', values: [range[0], range[1]], boolean: 'AND' });
  }

  /**
   * Pattern match with `%` (any run) and `_` (one character). Case-insensitive by default on
   * every database.
   */
  public whereLike(column: string, pattern: string, options?: { caseSensitive?: boolean }): QueryBuilder<TModel> {
    return this.push({
      type: 'comparison',
      column: this.col(column),
      operator: options?.caseSensitive ? 'LIKE' : 'ILIKE',
      value: pattern,
      boolean: 'AND',
    });
  }

  public orWhereLike(column: string, pattern: string, options?: { caseSensitive?: boolean }): QueryBuilder<TModel> {
    return this.push({
      type: 'comparison',
      column: this.col(column),
      operator: options?.caseSensitive ? 'LIKE' : 'ILIKE',
      value: pattern,
      boolean: 'OR',
    });
  }

  /**
   * Escape hatch for conditions the builder cannot express:
   * - SQL databases: `whereRaw('LOWER(email) = ?', [email])` (always use placeholders)
   * - MongoDB: `whereRaw({ tags: { $all: ['a', 'b'] } })`
   */
  public whereRaw(sqlOrFilter: string | Record<string, unknown>, params: readonly unknown[] = []): QueryBuilder<TModel> {
    return this.push(
      typeof sqlOrFilter === 'string'
        ? { type: 'raw', column: '', operator: 'RAW', sql: sqlOrFilter, params: [...params], boolean: 'AND' }
        : { type: 'raw', column: '', operator: 'RAW', filter: { ...sqlOrFilter }, boolean: 'AND' }
    );
  }

  // -------------------------------------------------------------------------
  // Ordering, paging, locking, relations
  // -------------------------------------------------------------------------

  public orderBy(column: string, direction: OrderDirection = 'ASC'): QueryBuilder<TModel> {
    const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const newOrder: OrderByNode[] = [...this.ast.orderBy, { column: this.col(column), direction: dir }];
    return this.clone({ orderBy: newOrder });
  }

  /** Newest first (default column: the model's createdAt timestamp). */
  public latest(column?: string): QueryBuilder<TModel> {
    return this.orderBy(column ?? this.modelClass.metadata.timestamps.createdAt, 'DESC');
  }

  /** Oldest first (default column: the model's createdAt timestamp). */
  public oldest(column?: string): QueryBuilder<TModel> {
    return this.orderBy(column ?? this.modelClass.metadata.timestamps.createdAt, 'ASC');
  }

  public limit(n: number): QueryBuilder<TModel> {
    return this.clone({ limit: n });
  }

  public offset(n: number): QueryBuilder<TModel> {
    return this.clone({ offset: n });
  }

  /** Alias of limit(). */
  public take(n: number): QueryBuilder<TModel> {
    return this.limit(n);
  }

  /** Alias of offset(). */
  public skip(n: number): QueryBuilder<TModel> {
    return this.offset(n);
  }

  /**
   * `SELECT ... FOR UPDATE`: locks the selected rows until the surrounding transaction ends
   * (PostgreSQL / MySQL). No-op on SQLite (which serializes writes) and MongoDB.
   */
  public lockForUpdate(): QueryBuilder<TModel> {
    return this.clone({ lock: 'update' });
  }

  /** `FOR SHARE` / `LOCK IN SHARE MODE` (PostgreSQL / MySQL). */
  public sharedLock(): QueryBuilder<TModel> {
    return this.clone({ lock: 'share' });
  }

  public with(...relations: readonly string[]): QueryBuilder<TModel> {
    const set = new Set([...this.eagerRelations, ...relations]);
    return this.clone(undefined, { eagerRelations: [...set] });
  }

  public using(context: QueryContext): QueryBuilder<TModel> {
    return this.clone(undefined, { context });
  }

  /** Includes soft-deleted rows (models with `softDelete: true`). */
  public withTrashed(): QueryBuilder<TModel> {
    return this.clone(undefined, { trashed: 'include' });
  }

  /** Returns only soft-deleted rows (models with `softDelete: true`). */
  public onlyTrashed(): QueryBuilder<TModel> {
    return this.clone(undefined, { trashed: 'only' });
  }

  /** Implicit soft-delete condition for models with `softDelete: true`. */
  private get softDeleteScope(): readonly WhereConditionNode[] | undefined {
    const meta = this.modelClass.metadata;
    if (!meta.softDelete.enabled || this.trashed === 'include') {
      return undefined;
    }
    return [
      {
        type: 'null',
        column: meta.fieldToColumn(meta.softDelete.deletedAt),
        operator: this.trashed === 'only' ? 'IS NOT NULL' : 'IS NULL',
        boolean: 'AND',
      },
    ];
  }

  /** The SQL this query compiles to (for debugging; SQL databases only). */
  public toSql(): CompiledQuery {
    return (this.explicitCompiler ?? SqlCompiler.forContext(this.context)).compileSelect({
      ...this.ast,
      scope: this.softDeleteScope,
    });
  }

  private engine(conn: QueryContext): QueryEngine {
    return engineFor(conn, this.explicitCompiler);
  }

  private async executeWithConnection<T>(
    operation: (conn: QueryContext, engine: QueryEngine) => Promise<T>
  ): Promise<T> {
    return withQueryContext(this.context, this.modelClass.metadata.connection, (conn) =>
      operation(conn, this.engine(conn))
    );
  }

  // -------------------------------------------------------------------------
  // Retrieval
  // -------------------------------------------------------------------------

  public async get(): Promise<readonly TModel[]> {
    return this.executeWithConnection(async (conn, engine) => {
      const rows = await engine.select(
        conn,
        { ...this.ast, scope: this.softDeleteScope },
        modelInfo(this.modelClass.metadata)
      );

      const models = Hydrator.hydrateModels(rows, this.modelClass);

      if (this.eagerRelations.length > 0) {
        await EagerLoader.loadRelations(models, this.eagerRelations, this.registry, this.context ?? conn);
      }

      return Object.freeze(models);
    });
  }

  public async first(): Promise<TModel | null> {
    const results = await this.limit(1).get();
    return results[0] ?? null;
  }

  public async firstOrFail(): Promise<TModel> {
    const found = await this.first();
    if (!found) {
      throw new ModelNotFoundError(this.modelClass.modelName, '(query)');
    }
    return found;
  }

  public async find(id: unknown): Promise<TModel | null> {
    return this.where(this.modelClass.metadata.primaryKey, id).first();
  }

  public async findOrFail(id: unknown): Promise<TModel> {
    const found = await this.find(id);
    if (!found) {
      throw new ModelNotFoundError(this.modelClass.modelName, id);
    }
    return found;
  }

  /** Models whose primary key is in `ids`. */
  public async findMany(ids: readonly unknown[]): Promise<readonly TModel[]> {
    if (ids.length === 0) return Object.freeze([]);
    return this.whereIn(this.modelClass.metadata.primaryKey, ids).get();
  }

  /** Values of one column: `await User.query().pluck('email')`. */
  public async pluck<T = unknown>(column: string): Promise<T[]> {
    const models = await this.select(column).get();
    return models.map((m) => m.get<T>(column));
  }

  /** Value of one column from the first row, or null. */
  public async value<T = unknown>(column: string): Promise<T | null> {
    const model = await this.select(column).first();
    return model ? (model.get<T>(column) ?? null) : null;
  }

  // -------------------------------------------------------------------------
  // Aggregates
  // -------------------------------------------------------------------------

  public async count(column?: string): Promise<number> {
    return this.executeWithConnection((conn, engine) =>
      engine.count(
        conn,
        {
          table: this.ast.table,
          column: column ? this.col(column) : undefined,
          where: this.ast.where,
          scope: this.softDeleteScope,
        },
        modelInfo(this.modelClass.metadata)
      )
    );
  }

  public async exists(): Promise<boolean> {
    return this.executeWithConnection((conn, engine) =>
      engine.exists(
        conn,
        { table: this.ast.table, where: this.ast.where, scope: this.softDeleteScope },
        modelInfo(this.modelClass.metadata)
      )
    );
  }

  public async doesntExist(): Promise<boolean> {
    return !(await this.exists());
  }

  private aggregate(fn: AggregateFunction, column: string): Promise<number | null> {
    return this.executeWithConnection((conn, engine) =>
      engine.aggregate(
        conn,
        { table: this.ast.table, fn, column: this.col(column), where: this.ast.where, scope: this.softDeleteScope },
        modelInfo(this.modelClass.metadata)
      )
    );
  }

  /** Sum of a column (0 when no rows match). */
  public async sum(column: string): Promise<number> {
    return (await this.aggregate('sum', column)) ?? 0;
  }

  /** Average of a column, or null when no rows match. */
  public avg(column: string): Promise<number | null> {
    return this.aggregate('avg', column);
  }

  public min(column: string): Promise<number | null> {
    return this.aggregate('min', column);
  }

  public max(column: string): Promise<number | null> {
    return this.aggregate('max', column);
  }

  /**
   * Grouped aggregates, returned as plain rows (not models):
   *
   * ```ts
   * await Order.query()
   *   .where('status', 'paid')
   *   .groupBy(['customerId'], { total: ['sum', 'amount'], orders: ['count'] },
   *            { having: [['total', '>', 100]], orderBy: [['total', 'DESC']], limit: 10 });
   * // [{ customerId: 7, total: 420, orders: 3 }, ...]
   * ```
   */
  public async groupBy(
    columns: readonly string[],
    aggregates: GroupAggregates,
    options?: GroupByOptions
  ): Promise<Record<string, unknown>[]> {
    const meta = this.modelClass.metadata;
    const aggs: Record<string, GroupAggregate> = {};
    for (const [alias, spec] of Object.entries(aggregates)) {
      const [fn, column] = spec;
      aggs[alias] = { fn, column: column ? this.col(column) : undefined };
    }
    const groupColumns = columns.map((c) => this.col(c));
    const orderBy: OrderByNode[] = (options?.orderBy ?? []).map(([column, dir]) => ({
      column: column in aggs ? column : this.col(column),
      direction: String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    }));

    const rows = await this.executeWithConnection((conn, engine) =>
      engine.group(
        conn,
        {
          table: this.ast.table,
          groupBy: groupColumns,
          aggregates: aggs,
          where: this.ast.where,
          scope: this.softDeleteScope,
          having: (options?.having ?? []).map(([alias, operator, value]) => ({ alias, operator, value })),
          orderBy,
          limit: options?.limit,
        },
        modelInfo(meta)
      )
    );

    // Present group keys with field names (not column names).
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) out[meta.columnToField(key)] = value;
      return out;
    });
  }

  // -------------------------------------------------------------------------
  // Paging & iteration
  // -------------------------------------------------------------------------

  public async paginate(options: PaginationOptions): Promise<PaginationResult<TModel>> {
    const page = Math.max(1, Math.floor(options.page));
    const pageSize = Math.max(1, Math.floor(options.pageSize));

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

  public async *cursor(batchSize = 100): AsyncIterable<TModel> {
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

  /**
   * Processes matching rows in batches. Return `false` from the callback to stop early.
   * Add an orderBy() for a stable order (the primary key is used when none is set).
   */
  public async chunk(
    size: number,
    callback: (models: readonly TModel[], page: number) => Promise<unknown> | unknown
  ): Promise<void> {
    const ordered = this.ast.orderBy.length > 0 ? this : this.orderBy(this.modelClass.metadata.primaryKey);
    let page = 1;
    for (;;) {
      const batch = await ordered.clone().limit(size).offset((page - 1) * size).get();
      if (batch.length === 0) return;
      if ((await callback(batch, page)) === false) return;
      if (batch.length < size) return;
      page++;
    }
  }

  // -------------------------------------------------------------------------
  // Bulk writes
  // -------------------------------------------------------------------------

  public async update(values: Record<string, unknown>): Promise<number> {
    return this.runUpdate(values, undefined);
  }

  /** Atomically adds `amount` to a column on every matching row. Returns the affected count. */
  public async increment(column: string, amount = 1, extra: Record<string, unknown> = {}): Promise<number> {
    return this.runUpdate(extra, { [column]: amount });
  }

  public async decrement(column: string, amount = 1, extra: Record<string, unknown> = {}): Promise<number> {
    return this.runUpdate(extra, { [column]: -amount });
  }

  private async runUpdate(
    values: Record<string, unknown>,
    increments: Record<string, number> | undefined
  ): Promise<number> {
    const meta = this.modelClass.metadata;
    return this.executeWithConnection(async (conn, engine) => {
      const mappedValues: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(values)) {
        mappedValues[this.col(key)] = engine.serialize(meta, key, val);
      }

      if (meta.timestamps.enabled) {
        const updatedCol = this.col(meta.timestamps.updatedAt);
        if (!(updatedCol in mappedValues)) {
          mappedValues[updatedCol] = new Date();
        }
      }

      const mappedIncrements: Record<string, number> = {};
      for (const [key, n] of Object.entries(increments ?? {})) mappedIncrements[this.col(key)] = n;

      return engine.update(
        conn,
        {
          table: this.ast.table,
          values: mappedValues,
          increments: mappedIncrements,
          where: this.ast.where,
          scope: this.softDeleteScope,
        },
        modelInfo(meta)
      );
    });
  }

  public async delete(options?: { force?: boolean }): Promise<number> {
    const meta = this.modelClass.metadata;
    const isSoftDelete = meta.softDelete.enabled && !options?.force;

    if (isSoftDelete) {
      return this.update({ [meta.softDelete.deletedAt]: new Date() });
    }

    return this.executeWithConnection((conn, engine) =>
      engine.delete(
        conn,
        { table: this.ast.table, where: this.ast.where, scope: this.softDeleteScope },
        modelInfo(meta)
      )
    );
  }

  /** Clears `deletedAt` on matching soft-deleted rows. */
  public async restore(): Promise<number> {
    const meta = this.modelClass.metadata;
    if (!meta.softDelete.enabled) {
      throw new QueryError(`Model '${meta.name}' does not use soft deletes.`);
    }
    return this.onlyTrashed().update({ [meta.softDelete.deletedAt]: null });
  }
}
