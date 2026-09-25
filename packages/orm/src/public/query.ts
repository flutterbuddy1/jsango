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
import type { SelectAst, WhereConditionNode, OrderByNode } from '../internal/ast.js';
import { SqlCompiler } from '../internal/compiler.js';
import { Hydrator } from '../internal/hydration.js';
import { EagerLoader } from '../internal/eager-loader.js';
import { ModelNotFoundError, QueryError } from './errors.js';
import { defaultModelRegistry, type ModelRegistry } from './registry.js';
import { getDatabaseManager } from './connection.js';

export interface QueryBuilderOptions {
  readonly compiler?: SqlCompiler | undefined;
  readonly registry?: ModelRegistry | undefined;
  readonly context?: QueryContext | undefined;
  readonly eagerRelations?: readonly string[] | undefined;
}

export class QueryBuilder<TModel extends Model = Model> {
  private readonly modelClass: ModelStatic<TModel>;
  private readonly ast: SelectAst;
  private readonly compiler: SqlCompiler;
  private readonly registry: ModelRegistry;
  private readonly context?: QueryContext | undefined;
  private readonly eagerRelations: readonly string[];

  constructor(modelClass: ModelStatic<TModel>, ast?: SelectAst, options?: QueryBuilderOptions) {
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

  public clone(
    modifiedAst?: Partial<SelectAst>,
    modifiedOptions?: Partial<QueryBuilderOptions>
  ): QueryBuilder<TModel> {
    const newAst: SelectAst = {
      table: modifiedAst?.table ?? this.ast.table,
      columns: modifiedAst?.columns ?? [...this.ast.columns],
      where: modifiedAst?.where ?? [...this.ast.where],
      orderBy: modifiedAst?.orderBy ?? [...this.ast.orderBy],
      limit: modifiedAst && 'limit' in modifiedAst ? modifiedAst.limit : this.ast.limit,
      offset: modifiedAst && 'offset' in modifiedAst ? modifiedAst.offset : this.ast.offset,
      joins: modifiedAst?.joins ?? (this.ast.joins ? [...this.ast.joins] : undefined),
    };

    return new QueryBuilder<TModel>(this.modelClass, newAst, {
      compiler: modifiedOptions?.compiler ?? this.compiler,
      registry: modifiedOptions?.registry ?? this.registry,
      context:
        modifiedOptions && 'context' in modifiedOptions ? modifiedOptions.context : this.context,
      eagerRelations:
        modifiedOptions && 'eagerRelations' in modifiedOptions
          ? modifiedOptions.eagerRelations
          : this.eagerRelations,
    });
  }

  public select(...columns: readonly string[]): QueryBuilder<TModel> {
    const mapped = columns.map((col) => this.modelClass.metadata.fieldToColumn(col));
    return this.clone({ columns: mapped });
  }

  public where(
    columnOrConditions: string | Record<string, unknown>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    return this.addWhere('AND', columnOrConditions, operatorOrValue, value);
  }

  public orWhere(
    columnOrConditions: string | Record<string, unknown>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
    return this.addWhere('OR', columnOrConditions, operatorOrValue, value);
  }

  private addWhere(
    boolean: 'AND' | 'OR',
    columnOrConditions: string | Record<string, unknown>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): QueryBuilder<TModel> {
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
        } else {
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
    } else {
      // 2 arguments: where(column, value)
      if (operatorOrValue === null) {
        newWhere.push({
          type: 'null',
          column,
          operator: 'IS NULL',
          boolean,
        });
      } else {
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

  public whereIn(column: string, values: readonly unknown[]): QueryBuilder<TModel> {
    const col = this.modelClass.metadata.fieldToColumn(column);
    const newWhere: WhereConditionNode[] = [
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

  public whereNotIn(column: string, values: readonly unknown[]): QueryBuilder<TModel> {
    const col = this.modelClass.metadata.fieldToColumn(column);
    const newWhere: WhereConditionNode[] = [
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

  public whereNull(column: string): QueryBuilder<TModel> {
    const col = this.modelClass.metadata.fieldToColumn(column);
    const newWhere: WhereConditionNode[] = [
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

  public whereNotNull(column: string): QueryBuilder<TModel> {
    const col = this.modelClass.metadata.fieldToColumn(column);
    const newWhere: WhereConditionNode[] = [
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

  public orderBy(column: string, direction: OrderDirection = 'ASC'): QueryBuilder<TModel> {
    const col = this.modelClass.metadata.fieldToColumn(column);
    const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const newOrder: OrderByNode[] = [...this.ast.orderBy, { column: col, direction: dir }];
    return this.clone({ orderBy: newOrder });
  }

  public limit(n: number): QueryBuilder<TModel> {
    return this.clone({ limit: n });
  }

  public offset(n: number): QueryBuilder<TModel> {
    return this.clone({ offset: n });
  }

  public with(...relations: readonly string[]): QueryBuilder<TModel> {
    const set = new Set([...this.eagerRelations, ...relations]);
    return this.clone(undefined, { eagerRelations: [...set] });
  }

  public using(context: QueryContext): QueryBuilder<TModel> {
    return this.clone(undefined, { context });
  }

  public toSql(): CompiledQuery {
    return this.compiler.compileSelect(this.ast);
  }

  private async executeWithConnection<T>(
    operation: (conn: QueryContext) => Promise<T>
  ): Promise<T> {
    if (this.context) {
      return operation(this.context);
    }
    const manager = getDatabaseManager();
    if (!manager) {
      throw new QueryError(
        `No database connection provided for model '${this.modelClass.modelName}'. Call setDatabaseManager() or use .using(context).`
      );
    }
    const conn = await manager.connection(this.modelClass.metadata.connection);
    try {
      return await operation(conn);
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  }

  public async get(): Promise<readonly TModel[]> {
    return this.executeWithConnection(async (conn) => {
      const { sql, params } = this.toSql();
      const result = await conn.query<Record<string, unknown>>(sql, params);

      const models = Hydrator.hydrateModels(result.rows, this.modelClass);

      if (this.eagerRelations.length > 0) {
        await EagerLoader.loadRelations(
          models,
          this.eagerRelations,
          this.registry,
          this.context ?? conn
        );
      }

      return Object.freeze(models);
    });
  }

  public async first(): Promise<TModel | null> {
    const results = await this.limit(1).get();
    return results[0] ?? null;
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

  public async count(column?: string): Promise<number> {
    return this.executeWithConnection(async (conn) => {
      const col = column ? this.modelClass.metadata.fieldToColumn(column) : undefined;
      const { sql, params } = this.compiler.compileCount({
        table: this.ast.table,
        column: col,
        where: this.ast.where,
      });
      const result = await conn.query<Record<string, unknown>>(sql, params);
      const firstRow = result.rows[0];
      if (!firstRow) return 0;
      const rawVal = firstRow['aggregate'] ?? Object.values(firstRow)[0];
      return Number(rawVal ?? 0);
    });
  }

  public async exists(): Promise<boolean> {
    return this.executeWithConnection(async (conn) => {
      const { sql, params } = this.compiler.compileExists({
        table: this.ast.table,
        where: this.ast.where,
      });
      const result = await conn.query<Record<string, unknown>>(sql, params);
      return result.rows.length > 0;
    });
  }

  public async paginate(options: PaginationOptions): Promise<PaginationResult<TModel>> {
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

  public async update(values: Record<string, unknown>): Promise<number> {
    return this.executeWithConnection(async (conn) => {
      const mappedValues: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(values)) {
        const col = this.modelClass.metadata.fieldToColumn(key);
        mappedValues[col] = val;
      }

      if (this.modelClass.metadata.timestamps.enabled) {
        const updatedCol = this.modelClass.metadata.fieldToColumn(
          this.modelClass.metadata.timestamps.updatedAt
        );
        if (!(updatedCol in mappedValues)) {
          mappedValues[updatedCol] = new Date();
        }
      }

      const { sql, params } = this.compiler.compileUpdate({
        table: this.ast.table,
        values: mappedValues,
        where: this.ast.where,
      });

      const result = await conn.query<Record<string, unknown>>(sql, params);
      return result.rowCount ?? 0;
    });
  }

  public async delete(options?: { force?: boolean }): Promise<number> {
    const isSoftDelete = this.modelClass.metadata.softDelete.enabled && !options?.force;

    if (isSoftDelete) {
      const deletedAtCol = this.modelClass.metadata.fieldToColumn(
        this.modelClass.metadata.softDelete.deletedAt
      );
      return this.update({ [deletedAtCol]: new Date() });
    }

    return this.executeWithConnection(async (conn) => {
      const { sql, params } = this.compiler.compileDelete({
        table: this.ast.table,
        where: this.ast.where,
      });

      const result = await conn.query<Record<string, unknown>>(sql, params);
      return result.rowCount ?? 0;
    });
  }
}
