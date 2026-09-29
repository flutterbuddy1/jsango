import type {
  SelectAst,
  InsertAst,
  UpdateAst,
  DeleteAst,
  CountAst,
  ExistsAst,
  WhereConditionNode,
} from './ast.js';
import type { CompiledQuery, QueryContext } from '../public/types.js';
import { QueryError } from '../public/errors.js';

export interface SqlCompilerOptions {
  readonly placeholderType?: 'question' | 'dollar';
  readonly quoteIdentifiers?: boolean;
  /** Identifier quote character: `"` (standard, Postgres, SQLite) or backtick (MySQL). */
  readonly quoteChar?: '"' | '`' | undefined;
  /** Dialect name, used for LIMIT/OFFSET and ILIKE differences. */
  readonly dialect?: string | undefined;
  /** Whether INSERT ... RETURNING may be emitted. */
  readonly supportsReturning?: boolean | undefined;
}

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const ALLOWED_OPERATORS = new Set([
  '=',
  '!=',
  '<>',
  '>',
  '>=',
  '<',
  '<=',
  'LIKE',
  'NOT LIKE',
  'ILIKE',
  'NOT ILIKE',
]);

export class SqlCompiler {
  private readonly placeholderType: 'question' | 'dollar';
  private readonly quoteIdentifiers: boolean;
  private readonly quoteChar: '"' | '`';
  public readonly dialect: string;
  public readonly supportsReturning: boolean;

  constructor(options?: SqlCompilerOptions) {
    this.placeholderType = options?.placeholderType ?? 'question';
    this.quoteIdentifiers = options?.quoteIdentifiers ?? true;
    this.dialect = options?.dialect ?? 'generic';
    this.quoteChar = options?.quoteChar ?? (this.dialect === 'mysql' ? '`' : '"');
    this.supportsReturning = options?.supportsReturning ?? false;
  }

  /**
   * Builds a compiler matching the dialect of a connection or transaction. Placeholders are
   * always emitted as `?`; the connection rewrites them for drivers that use `$1` style.
   */
  public static forContext(context: QueryContext | undefined): SqlCompiler {
    const dialect = context?.dialect;
    if (!dialect) {
      return new SqlCompiler();
    }
    return new SqlCompiler({
      dialect: dialect.name,
      quoteChar: dialect.quoteChar,
      supportsReturning: dialect.supportsReturning,
    });
  }

  public escapeIdentifier(identifier: string): string {
    if (identifier === '*') {
      return '*';
    }

    // Support compound identifiers like "table.column"
    if (identifier.includes('.')) {
      return identifier
        .split('.')
        .map((part) => this.escapeIdentifier(part))
        .join('.');
    }

    if (!IDENTIFIER_REGEX.test(identifier)) {
      throw new QueryError(`Invalid SQL identifier: '${identifier}'`);
    }

    if (this.quoteIdentifiers) {
      const q = this.quoteChar;
      return `${q}${identifier.split(q).join(q + q)}${q}`;
    }
    return identifier;
  }

  private createPlaceholder(paramIndex: number): string {
    if (this.placeholderType === 'dollar') {
      return `$${paramIndex}`;
    }
    return '?';
  }

  public compileSelect(ast: SelectAst): CompiledQuery {
    const params: unknown[] = [];
    let paramCounter = 1;

    const cols =
      ast.columns.length === 0 ? '*' : ast.columns.map((c) => this.escapeIdentifier(c)).join(', ');

    let sql = `SELECT ${cols} FROM ${this.escapeIdentifier(ast.table)}`;

    if (ast.joins && ast.joins.length > 0) {
      for (const join of ast.joins) {
        const joinTable = this.escapeIdentifier(join.table);
        const left = this.escapeIdentifier(join.on.leftColumn);
        const right = this.escapeIdentifier(join.on.rightColumn);
        sql += ` ${join.type} JOIN ${joinTable} ON ${left} = ${right}`;
      }
    }

    {
      const built = this.buildWhere(ast.scope, ast.where, paramCounter);
      if (built) {
        sql += ` WHERE ${built.sql}`;
        params.push(...built.params);
        paramCounter = built.nextCounter;
      }
    }

    if (ast.orderBy.length > 0) {
      const orderParts = ast.orderBy.map(
        (o) => `${this.escapeIdentifier(o.column)} ${o.direction}`
      );
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    if (typeof ast.limit === 'number') {
      if (!Number.isInteger(ast.limit) || ast.limit < 0) {
        throw new QueryError(`Invalid LIMIT value: ${ast.limit}`);
      }
      sql += ` LIMIT ${ast.limit}`;
    }

    if (typeof ast.offset === 'number') {
      if (!Number.isInteger(ast.offset) || ast.offset < 0) {
        throw new QueryError(`Invalid OFFSET value: ${ast.offset}`);
      }
      if (typeof ast.limit !== 'number') {
        // MySQL and SQLite do not accept OFFSET without LIMIT.
        if (this.dialect === 'mysql') sql += ' LIMIT 18446744073709551615';
        else if (this.dialect === 'sqlite') sql += ' LIMIT -1';
      }
      sql += ` OFFSET ${ast.offset}`;
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileInsert(ast: InsertAst): CompiledQuery {
    if (ast.columns.length === 0 || ast.rows.length === 0) {
      throw new QueryError('INSERT query requires at least one column and one row.');
    }

    const params: unknown[] = [];
    let paramCounter = 1;

    const cols = ast.columns.map((c) => this.escapeIdentifier(c)).join(', ');
    const rowPlaceholders: string[] = [];

    for (const row of ast.rows) {
      const placeholders: string[] = [];
      for (const val of row) {
        placeholders.push(this.createPlaceholder(paramCounter++));
        params.push(val);
      }
      rowPlaceholders.push(`(${placeholders.join(', ')})`);
    }

    let sql = `INSERT INTO ${this.escapeIdentifier(ast.table)} (${cols}) VALUES ${rowPlaceholders.join(', ')}`;

    if (ast.returning && ast.returning.length > 0 && this.supportsReturning) {
      sql += ` RETURNING ${ast.returning.map((c) => this.escapeIdentifier(c)).join(', ')}`;
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileUpdate(ast: UpdateAst): CompiledQuery {
    const keys = Object.keys(ast.values);
    if (keys.length === 0) {
      throw new QueryError('UPDATE query requires at least one field to update.');
    }

    const params: unknown[] = [];
    let paramCounter = 1;

    const setClauses: string[] = [];
    for (const key of keys) {
      setClauses.push(`${this.escapeIdentifier(key)} = ${this.createPlaceholder(paramCounter++)}`);
      params.push(ast.values[key]);
    }

    let sql = `UPDATE ${this.escapeIdentifier(ast.table)} SET ${setClauses.join(', ')}`;

    const built = this.buildWhere(ast.scope, ast.where, paramCounter);
    if (built) {
      sql += ` WHERE ${built.sql}`;
      params.push(...built.params);
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileDelete(ast: DeleteAst): CompiledQuery {
    const params: unknown[] = [];
    let sql = `DELETE FROM ${this.escapeIdentifier(ast.table)}`;

    const built = this.buildWhere(ast.scope, ast.where, 1);
    if (built) {
      sql += ` WHERE ${built.sql}`;
      params.push(...built.params);
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileCount(ast: CountAst): CompiledQuery {
    const params: unknown[] = [];
    const target = ast.column ? this.escapeIdentifier(ast.column) : '*';
    let sql = `SELECT COUNT(${target}) AS ${this.escapeIdentifier('aggregate')} FROM ${this.escapeIdentifier(ast.table)}`;

    const built = this.buildWhere(ast.scope, ast.where, 1);
    if (built) {
      sql += ` WHERE ${built.sql}`;
      params.push(...built.params);
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileExists(ast: ExistsAst): CompiledQuery {
    const params: unknown[] = [];
    let sql = `SELECT 1 AS ${this.escapeIdentifier('exists_flag')} FROM ${this.escapeIdentifier(ast.table)}`;

    const built = this.buildWhere(ast.scope, ast.where, 1);
    if (built) {
      sql += ` WHERE ${built.sql}`;
      params.push(...built.params);
    }

    sql += ' LIMIT 1';

    return { sql, params: Object.freeze(params) };
  }

  /**
   * Combines scope conditions with user conditions as `scope AND (user)` so that OR conditions
   * written by the user can never bypass the scope.
   */
  private buildWhere(
    scope: readonly WhereConditionNode[] | undefined,
    where: readonly WhereConditionNode[],
    initialCounter: number
  ): { sql: string; params: unknown[]; nextCounter: number } | undefined {
    const hasScope = scope !== undefined && scope.length > 0;
    if (!hasScope && where.length === 0) return undefined;
    if (!hasScope) return this.compileWhereClause(where, initialCounter);

    const scoped = this.compileWhereClause(scope, initialCounter);
    if (where.length === 0) return scoped;

    const user = this.compileWhereClause(where, scoped.nextCounter);
    const needsParens = where.some((c) => c.boolean === 'OR');
    return {
      sql: `${scoped.sql} AND ${needsParens ? `(${user.sql})` : user.sql}`,
      params: [...scoped.params, ...user.params],
      nextCounter: user.nextCounter,
    };
  }

  private normalizeOperator(operator: string): string {
    const upper = operator.trim().toUpperCase();
    if (!ALLOWED_OPERATORS.has(upper)) {
      throw new QueryError(`Unsupported WHERE operator: '${operator}'`);
    }
    // ILIKE is PostgreSQL-only; LIKE is case-insensitive by default in SQLite and MySQL.
    if (this.dialect !== 'postgres' && (upper === 'ILIKE' || upper === 'NOT ILIKE')) {
      return upper.replace('ILIKE', 'LIKE');
    }
    return upper;
  }

  private compileWhereClause(
    conditions: readonly WhereConditionNode[],
    initialCounter: number
  ): { sql: string; params: unknown[]; nextCounter: number } {
    const params: unknown[] = [];
    let paramCounter = initialCounter;
    let sql = '';

    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i]!;
      const prefix = i === 0 ? '' : ` ${cond.boolean} `;
      const col = this.escapeIdentifier(cond.column);

      if (cond.type === 'null') {
        sql += `${prefix}${col} ${cond.operator}`;
      } else if (cond.type === 'in') {
        const vals = cond.values ?? [];
        if (vals.length === 0) {
          // Empty IN condition evaluates to false (or true for NOT IN)
          sql += cond.operator === 'IN' ? `${prefix}1 = 0` : `${prefix}1 = 1`;
        } else {
          const placeholders = vals.map(() => this.createPlaceholder(paramCounter++));
          sql += `${prefix}${col} ${cond.operator} (${placeholders.join(', ')})`;
          params.push(...vals);
        }
      } else {
        sql += `${prefix}${col} ${this.normalizeOperator(cond.operator)} ${this.createPlaceholder(paramCounter++)}`;
        params.push(cond.value);
      }
    }

    return { sql, params, nextCounter: paramCounter };
  }
}
