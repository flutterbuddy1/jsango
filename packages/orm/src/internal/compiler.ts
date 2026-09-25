import type {
  SelectAst,
  InsertAst,
  UpdateAst,
  DeleteAst,
  CountAst,
  ExistsAst,
  WhereConditionNode,
} from './ast.js';
import type { CompiledQuery } from '../public/types.js';
import { QueryError } from '../public/errors.js';

export interface SqlCompilerOptions {
  readonly placeholderType?: 'question' | 'dollar';
  readonly quoteIdentifiers?: boolean;
}

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class SqlCompiler {
  private readonly placeholderType: 'question' | 'dollar';
  private readonly quoteIdentifiers: boolean;

  constructor(options?: SqlCompilerOptions) {
    this.placeholderType = options?.placeholderType ?? 'question';
    this.quoteIdentifiers = options?.quoteIdentifiers ?? true;
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
      return `"${identifier.replace(/"/g, '""')}"`;
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

    if (ast.where.length > 0) {
      const {
        sql: whereSql,
        params: whereParams,
        nextCounter,
      } = this.compileWhereClause(ast.where, paramCounter);
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
      paramCounter = nextCounter;
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

    const sql = `INSERT INTO ${this.escapeIdentifier(ast.table)} (${cols}) VALUES ${rowPlaceholders.join(', ')}`;

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

    if (ast.where.length > 0) {
      const { sql: whereSql, params: whereParams } = this.compileWhereClause(
        ast.where,
        paramCounter
      );
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileDelete(ast: DeleteAst): CompiledQuery {
    const params: unknown[] = [];
    let sql = `DELETE FROM ${this.escapeIdentifier(ast.table)}`;

    if (ast.where.length > 0) {
      const { sql: whereSql, params: whereParams } = this.compileWhereClause(ast.where, 1);
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileCount(ast: CountAst): CompiledQuery {
    const params: unknown[] = [];
    const target = ast.column ? this.escapeIdentifier(ast.column) : '*';
    let sql = `SELECT COUNT(${target}) AS "aggregate" FROM ${this.escapeIdentifier(ast.table)}`;

    if (ast.where.length > 0) {
      const { sql: whereSql, params: whereParams } = this.compileWhereClause(ast.where, 1);
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
    }

    return { sql, params: Object.freeze(params) };
  }

  public compileExists(ast: ExistsAst): CompiledQuery {
    const params: unknown[] = [];
    let sql = `SELECT 1 AS "exists_flag" FROM ${this.escapeIdentifier(ast.table)}`;

    if (ast.where.length > 0) {
      const { sql: whereSql, params: whereParams } = this.compileWhereClause(ast.where, 1);
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
    }

    sql += ' LIMIT 1';

    return { sql, params: Object.freeze(params) };
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
        sql += `${prefix}${col} ${cond.operator} ${this.createPlaceholder(paramCounter++)}`;
        params.push(cond.value);
      }
    }

    return { sql, params, nextCounter: paramCounter };
  }
}
