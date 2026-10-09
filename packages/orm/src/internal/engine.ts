import type { MongoCommand } from '@jsango/database';
import type { QueryContext } from '../public/types.js';
import type { ModelMetadata } from '../public/metadata.js';
import { QueryError } from '../public/errors.js';
import { SqlCompiler } from './compiler.js';
import type {
  AggregateAst,
  CountAst,
  DeleteAst,
  ExistsAst,
  GroupAst,
  InsertAst,
  SelectAst,
  UpdateAst,
  WhereConditionNode,
} from './ast.js';

/** Per-model facts an engine needs to translate queries. */
export interface EngineModelInfo {
  /** Primary key column name (stored as `_id` on MongoDB). */
  readonly primaryKey: string;
  /** Columns holding ObjectId references on MongoDB (`fields.objectId()` and the primary key). */
  readonly objectIdColumns: ReadonlySet<string>;
}

export interface InsertResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
  readonly lastInsertId?: unknown;
}

/**
 * Executes ORM query ASTs against one kind of database. The query builder and models only talk
 * to this interface, so every model feature works the same on SQL databases and MongoDB.
 */
export interface QueryEngine {
  readonly kind: 'sql' | 'mongo';
  select(
    ctx: QueryContext,
    ast: SelectAst,
    info: EngineModelInfo
  ): Promise<readonly Record<string, unknown>[]>;
  count(ctx: QueryContext, ast: CountAst, info: EngineModelInfo): Promise<number>;
  exists(ctx: QueryContext, ast: ExistsAst, info: EngineModelInfo): Promise<boolean>;
  aggregate(ctx: QueryContext, ast: AggregateAst, info: EngineModelInfo): Promise<number | null>;
  group(
    ctx: QueryContext,
    ast: GroupAst,
    info: EngineModelInfo
  ): Promise<readonly Record<string, unknown>[]>;
  insert(ctx: QueryContext, ast: InsertAst, info: EngineModelInfo): Promise<InsertResult>;
  update(ctx: QueryContext, ast: UpdateAst, info: EngineModelInfo): Promise<number>;
  delete(ctx: QueryContext, ast: DeleteAst, info: EngineModelInfo): Promise<number>;
  /** Converts a model attribute into the value sent to the database. */
  serialize(metadata: ModelMetadata, field: string, value: unknown): unknown;
}

export function isMongoContext(ctx: QueryContext | undefined): boolean {
  if (!ctx) return false;
  const name = ctx.dialect?.name ?? (ctx as { driverName?: string }).driverName;
  return name === 'mongodb' && typeof (ctx as { execute?: unknown }).execute === 'function';
}

export function modelInfo(metadata: ModelMetadata): EngineModelInfo {
  const objectIdColumns = new Set<string>();
  for (const field of metadata.fields.values()) {
    if (field.options['objectId'] === true) objectIdColumns.add(field.columnName);
  }
  const pk = metadata.fieldToColumn(metadata.primaryKey);
  objectIdColumns.add(pk);
  return { primaryKey: pk, objectIdColumns };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

export class SqlEngine implements QueryEngine {
  public readonly kind = 'sql' as const;
  private readonly explicit: SqlCompiler | undefined;

  public constructor(compiler?: SqlCompiler) {
    this.explicit = compiler;
  }

  private compiler(ctx: QueryContext): SqlCompiler {
    return this.explicit ?? SqlCompiler.forContext(ctx);
  }

  public async select(
    ctx: QueryContext,
    ast: SelectAst
  ): Promise<readonly Record<string, unknown>[]> {
    const { sql, params } = this.compiler(ctx).compileSelect(ast);
    return (await ctx.query<Record<string, unknown>>(sql, params)).rows;
  }

  public async count(ctx: QueryContext, ast: CountAst): Promise<number> {
    const { sql, params } = this.compiler(ctx).compileCount(ast);
    const row = (await ctx.query<Record<string, unknown>>(sql, params)).rows[0];
    if (!row) return 0;
    return Number(row['aggregate'] ?? Object.values(row)[0] ?? 0);
  }

  public async exists(ctx: QueryContext, ast: ExistsAst): Promise<boolean> {
    const { sql, params } = this.compiler(ctx).compileExists(ast);
    return (await ctx.query(sql, params)).rows.length > 0;
  }

  public async aggregate(ctx: QueryContext, ast: AggregateAst): Promise<number | null> {
    const { sql, params } = this.compiler(ctx).compileAggregate(ast);
    const row = (await ctx.query<Record<string, unknown>>(sql, params)).rows[0];
    return numberOrNull(row ? (row['aggregate'] ?? Object.values(row)[0]) : null);
  }

  public async group(
    ctx: QueryContext,
    ast: GroupAst
  ): Promise<readonly Record<string, unknown>[]> {
    const { sql, params } = this.compiler(ctx).compileGroup(ast);
    const rows = (await ctx.query<Record<string, unknown>>(sql, params)).rows;
    // Aggregates come back as strings on PostgreSQL (NUMERIC / BIGINT); normalize to numbers.
    return rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const alias of Object.keys(ast.aggregates)) out[alias] = numberOrNull(row[alias]);
      return out;
    });
  }

  public async insert(ctx: QueryContext, ast: InsertAst): Promise<InsertResult> {
    const { sql, params } = this.compiler(ctx).compileInsert(ast);
    const result = await ctx.query<Record<string, unknown>>(sql, params);
    return { rows: result.rows, rowCount: result.rowCount, lastInsertId: result.lastInsertId };
  }

  public async update(ctx: QueryContext, ast: UpdateAst): Promise<number> {
    const { sql, params } = this.compiler(ctx).compileUpdate(ast);
    return (await ctx.query(sql, params)).rowCount ?? 0;
  }

  public async delete(ctx: QueryContext, ast: DeleteAst): Promise<number> {
    const { sql, params } = this.compiler(ctx).compileDelete(ast);
    return (await ctx.query(sql, params)).rowCount ?? 0;
  }

  /**
   * JSON fields are always sent as JSON text so that arrays, strings and objects round-trip
   * identically on PostgreSQL (json/jsonb), MySQL (JSON) and SQLite (TEXT).
   */
  public serialize(metadata: ModelMetadata, field: string, value: unknown): unknown {
    if (value === undefined || value === null) return value;
    const fieldMeta = metadata.getField(field) ?? metadata.getField(metadata.columnToField(field));
    if (fieldMeta?.type === 'json') return JSON.stringify(value);
    return value;
  }
}

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------

const HEX_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** SQL LIKE pattern -> anchored regular expression (`%` = any run, `_` = one character). */
export function likeToRegex(pattern: string): string {
  let out = '';
  let escaped = false;
  for (const ch of pattern) {
    if (escaped) out += escapeRegex(ch);
    else if (ch === '\\') {
      escaped = true;
      continue;
    } else if (ch === '%') out += '.*';
    else if (ch === '_') out += '.';
    else out += escapeRegex(ch);
    escaped = false;
  }
  // Runs of `%` would make `.*.*.*` (slow backtracking): one is enough.
  return `^${out.replace(/(\.\*)+/g, '.*')}$`;
}

type Filter = Record<string, unknown>;

function isOperatorObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.keys(value).some((k) => k.startsWith('$') && k !== '$oid')
  );
}

export class MongoTranslator {
  private readonly info: EngineModelInfo;

  public constructor(info: EngineModelInfo) {
    this.info = info;
  }

  /** Field name in the document: the primary key is `_id`; `table.column` loses the prefix. */
  public field(column: string): string {
    const name = column.includes('.') ? column.slice(column.lastIndexOf('.') + 1) : column;
    // `where(req.body)` must not be able to inject operators such as `$where` / `$expr`.
    if (name.startsWith('$')) throw new QueryError(`Invalid field name "${name}".`);
    return name === this.info.primaryKey ? '_id' : name;
  }

  /** Wraps ObjectId-shaped strings of id / reference columns in `$oid` markers. */
  public value(column: string, value: unknown): unknown {
    const name = column.includes('.') ? column.slice(column.lastIndexOf('.') + 1) : column;
    if (this.info.objectIdColumns.has(name)) {
      if (typeof value === 'string' && HEX_OBJECT_ID.test(value)) return { $oid: value };
      if (Array.isArray(value)) return value.map((v) => this.value(column, v));
    }
    if (typeof value === 'bigint') {
      return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(value)
        : value.toString();
    }
    return value;
  }

  private condition(node: WhereConditionNode): Filter {
    switch (node.type) {
      case 'group': {
        const inner = this.where(node.children ?? []);
        return node.operator === 'NOT' ? { $nor: [inner] } : inner;
      }
      case 'raw': {
        if (!node.filter) {
          throw new QueryError(
            'whereRaw() with an SQL string is not supported on MongoDB; pass a filter object instead.'
          );
        }
        return { ...node.filter };
      }
      case 'null':
        return node.operator.toUpperCase() === 'IS NOT NULL'
          ? { [this.field(node.column)]: { $ne: null } }
          : { [this.field(node.column)]: null };
      case 'in': {
        const values = (node.values ?? []).map((v) => this.value(node.column, v));
        return {
          [this.field(node.column)]:
            node.operator.toUpperCase() === 'NOT IN' ? { $nin: values } : { $in: values },
        };
      }
      case 'between': {
        const [low, high] = node.values ?? [];
        const range = { $gte: this.value(node.column, low), $lte: this.value(node.column, high) };
        return {
          [this.field(node.column)]:
            node.operator.toUpperCase() === 'NOT BETWEEN' ? { $not: range } : range,
        };
      }
      case 'comparison':
      default: {
        const field = this.field(node.column);
        const op = node.operator.trim().toUpperCase();
        const v = this.value(node.column, node.value);
        switch (op) {
          case '=':
            // A value like {"$ne": null} from a JSON body must compare as a value, not run as an
            // operator (it would match every document, e.g. on a login lookup).
            return { [field]: isOperatorObject(v) ? { $eq: v } : v };
          case '!=':
          case '<>':
            return { [field]: { $ne: v } };
          case '>':
            return { [field]: { $gt: v } };
          case '>=':
            return { [field]: { $gte: v } };
          case '<':
            return { [field]: { $lt: v } };
          case '<=':
            return { [field]: { $lte: v } };
          case 'LIKE':
          case 'ILIKE':
          case 'NOT LIKE':
          case 'NOT ILIKE': {
            const regex = {
              $regex: likeToRegex(String(node.value ?? '')),
              $options: op.includes('ILIKE') ? 'i' : '',
            };
            return { [field]: op.startsWith('NOT') ? { $not: regex } : regex };
          }
          default:
            throw new QueryError(`Unsupported WHERE operator: '${node.operator}'`);
        }
      }
    }
  }

  /**
   * Flat SQL-style condition lists follow SQL precedence (AND binds tighter than OR):
   * `a AND b OR c` becomes `{ $or: [ { $and: [a, b] }, c ] }`.
   */
  public where(nodes: readonly WhereConditionNode[]): Filter {
    if (nodes.length === 0) return {};
    const groups: Filter[][] = [[]];
    nodes.forEach((node, i) => {
      if (i > 0 && node.boolean === 'OR') groups.push([]);
      groups[groups.length - 1]!.push(this.condition(node));
    });
    const combined = groups.map((g) => (g.length === 1 ? g[0]! : { $and: g }));
    return combined.length === 1 ? combined[0]! : { $or: combined };
  }

  public filter(
    scope: readonly WhereConditionNode[] | undefined,
    where: readonly WhereConditionNode[]
  ): Filter {
    const s = scope && scope.length > 0 ? this.where(scope) : undefined;
    const w = where.length > 0 ? this.where(where) : undefined;
    if (s && w) return { $and: [s, w] };
    return s ?? w ?? {};
  }

  /** Document -> row: `_id` becomes the primary key column. */
  public row(doc: Record<string, unknown>): Record<string, unknown> {
    const { _id, ...rest } = doc;
    return _id === undefined ? rest : { [this.info.primaryKey]: _id, ...rest };
  }
}

export class MongoEngine implements QueryEngine {
  public readonly kind = 'mongo' as const;

  private exec<T = Record<string, unknown>>(ctx: QueryContext, command: MongoCommand) {
    const executor = ctx as QueryContext & {
      execute?: (
        c: MongoCommand
      ) => Promise<{ rows: readonly T[]; rowCount: number; lastInsertId?: unknown }>;
    };
    if (typeof executor.execute !== 'function') {
      throw new QueryError('This connection cannot execute MongoDB commands.');
    }
    return executor.execute(command);
  }

  public async select(
    ctx: QueryContext,
    ast: SelectAst,
    info: EngineModelInfo
  ): Promise<readonly Record<string, unknown>[]> {
    const t = new MongoTranslator(info);
    const filter = t.filter(ast.scope, ast.where);
    const sort: Record<string, 1 | -1> = {};
    for (const o of ast.orderBy) sort[t.field(o.column)] = o.direction === 'DESC' ? -1 : 1;

    if (ast.joins && ast.joins.length > 0) {
      throw new QueryError(
        'SQL joins are not supported on MongoDB; use relations with .with() instead.'
      );
    }

    if (ast.distinct && ast.columns.length > 0) {
      const id: Record<string, string> = {};
      for (const c of ast.columns) id[c] = `$${t.field(c)}`;
      const pipeline: Record<string, unknown>[] = [
        { $match: filter },
        { $group: { _id: id } },
        { $replaceRoot: { newRoot: '$_id' } },
      ];
      if (Object.keys(sort).length > 0) pipeline.push({ $sort: sort });
      if (ast.offset) pipeline.push({ $skip: ast.offset });
      if (ast.limit !== undefined) pipeline.push({ $limit: ast.limit });
      return (await this.exec(ctx, { op: 'aggregate', collection: ast.table, pipeline })).rows;
    }

    let projection: Record<string, 0 | 1> | undefined;
    if (ast.columns.length > 0 && !ast.columns.includes('*')) {
      projection = {};
      for (const c of ast.columns) projection[t.field(c)] = 1;
    }

    const result = await this.exec(ctx, {
      op: 'find',
      collection: ast.table,
      filter,
      projection,
      sort,
      skip: ast.offset,
      limit: ast.limit,
    });
    return result.rows.map((d) => t.row(d as Record<string, unknown>));
  }

  public async count(ctx: QueryContext, ast: CountAst, info: EngineModelInfo): Promise<number> {
    const t = new MongoTranslator(info);
    const where = t.filter(ast.scope, ast.where);
    // $and keeps an existing condition on the same field (Object.assign would overwrite it).
    const filter = ast.column ? { $and: [where, { [t.field(ast.column)]: { $ne: null } }] } : where;
    const res = await this.exec<{ count: number }>(ctx, {
      op: 'count',
      collection: ast.table,
      filter,
    });
    return Number(res.rows[0]?.count ?? 0);
  }

  public async exists(ctx: QueryContext, ast: ExistsAst, info: EngineModelInfo): Promise<boolean> {
    const t = new MongoTranslator(info);
    const res = await this.exec(ctx, {
      op: 'find',
      collection: ast.table,
      filter: t.filter(ast.scope, ast.where),
      projection: { _id: 1 },
      limit: 1,
    });
    return res.rows.length > 0;
  }

  public async aggregate(
    ctx: QueryContext,
    ast: AggregateAst,
    info: EngineModelInfo
  ): Promise<number | null> {
    const t = new MongoTranslator(info);
    const filter = t.filter(ast.scope, ast.where);
    if (ast.fn === 'count') {
      return this.count(
        ctx,
        {
          table: ast.table,
          scope: ast.scope,
          where: ast.where,
          column: ast.column === '*' ? undefined : ast.column,
        },
        info
      );
    }
    const res = await this.exec<{ value: unknown }>(ctx, {
      op: 'aggregate',
      collection: ast.table,
      pipeline: [
        { $match: filter },
        { $group: { _id: null, value: { [`$${ast.fn}`]: `$${t.field(ast.column)}` } } },
      ],
    });
    const value = res.rows[0]?.value;
    if (ast.fn === 'sum' && (value === undefined || value === null)) return 0;
    return numberOrNull(value);
  }

  public async group(
    ctx: QueryContext,
    ast: GroupAst,
    info: EngineModelInfo
  ): Promise<readonly Record<string, unknown>[]> {
    const t = new MongoTranslator(info);
    const id: Record<string, string> = {};
    for (const key of ast.groupBy) id[key] = `$${t.field(key)}`;
    const group: Record<string, unknown> = { _id: id };
    const project: Record<string, unknown> = { _id: 0 };
    for (const key of ast.groupBy) project[key] = `$_id.${key}`;
    for (const [alias, agg] of Object.entries(ast.aggregates)) {
      group[alias] =
        agg.fn === 'count'
          ? agg.column
            ? { $sum: { $cond: [{ $ne: [`$${t.field(agg.column)}`, null] }, 1, 0] } }
            : { $sum: 1 }
          : { [`$${agg.fn}`]: `$${t.field(agg.column ?? '')}` };
      project[alias] = 1;
    }
    const pipeline: Record<string, unknown>[] = [
      { $match: t.filter(ast.scope, ast.where) },
      { $group: group },
      { $project: project },
    ];
    if (ast.having && ast.having.length > 0) {
      const ops: Record<string, string> = {
        '=': '$eq',
        '!=': '$ne',
        '>': '$gt',
        '>=': '$gte',
        '<': '$lt',
        '<=': '$lte',
      };
      const match: Record<string, unknown> = {};
      for (const h of ast.having) {
        const op = ops[h.operator];
        if (!op) throw new QueryError(`Unsupported HAVING operator '${h.operator}'.`);
        match[h.alias] = { ...(match[h.alias] as object | undefined), [op]: h.value };
      }
      pipeline.push({ $match: match });
    }
    if (ast.orderBy && ast.orderBy.length > 0) {
      const sort: Record<string, 1 | -1> = {};
      for (const o of ast.orderBy) sort[o.column] = o.direction === 'DESC' ? -1 : 1;
      pipeline.push({ $sort: sort });
    }
    if (ast.limit !== undefined) pipeline.push({ $limit: ast.limit });
    return (await this.exec(ctx, { op: 'aggregate', collection: ast.table, pipeline })).rows;
  }

  public async insert(
    ctx: QueryContext,
    ast: InsertAst,
    info: EngineModelInfo
  ): Promise<InsertResult> {
    const t = new MongoTranslator(info);
    const documents = ast.rows.map((row) => {
      const doc: Record<string, unknown> = {};
      ast.columns.forEach((col, i) => {
        const v = row[i];
        if (v === undefined) return;
        if (col === info.primaryKey && v === null) return; // let MongoDB generate _id
        doc[t.field(col)] = t.value(col, v);
      });
      return doc;
    });
    const result =
      documents.length === 1
        ? await this.exec(ctx, { op: 'insertOne', collection: ast.table, document: documents[0]! })
        : await this.exec(ctx, { op: 'insertMany', collection: ast.table, documents });
    return {
      rows: result.rows.map((d) => t.row(d as Record<string, unknown>)),
      rowCount: result.rowCount,
      lastInsertId: result.lastInsertId,
    };
  }

  public async update(ctx: QueryContext, ast: UpdateAst, info: EngineModelInfo): Promise<number> {
    const t = new MongoTranslator(info);
    const update: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    for (const [col, v] of Object.entries(ast.values)) {
      if (col === info.primaryKey) continue; // _id is immutable
      set[t.field(col)] = t.value(col, v);
    }
    if (Object.keys(set).length > 0) update['$set'] = set;
    if (ast.increments && Object.keys(ast.increments).length > 0) {
      const inc: Record<string, number> = {};
      for (const [col, n] of Object.entries(ast.increments)) inc[t.field(col)] = n;
      update['$inc'] = inc;
    }
    if (Object.keys(update).length === 0) return 0;
    const res = await this.exec(ctx, {
      op: 'updateMany',
      collection: ast.table,
      filter: t.filter(ast.scope, ast.where),
      update,
    });
    return res.rowCount;
  }

  public async delete(ctx: QueryContext, ast: DeleteAst, info: EngineModelInfo): Promise<number> {
    const t = new MongoTranslator(info);
    const res = await this.exec(ctx, {
      op: 'deleteMany',
      collection: ast.table,
      filter: t.filter(ast.scope, ast.where),
    });
    return res.rowCount;
  }

  /** MongoDB stores dates, booleans and JSON natively, so values are sent as-is. */
  public serialize(_metadata: ModelMetadata, _field: string, value: unknown): unknown {
    return value;
  }
}

const MONGO_ENGINE = new MongoEngine();
const SQL_ENGINE = new SqlEngine();

/** Picks the engine for a connection or transaction. */
export function engineFor(ctx: QueryContext | undefined, compiler?: SqlCompiler): QueryEngine {
  if (isMongoContext(ctx)) return MONGO_ENGINE;
  return compiler ? new SqlEngine(compiler) : SQL_ENGINE;
}
