import type { IsolationLevel } from './types.js';

export type PlaceholderType = 'dollar' | 'question' | 'named';

/** Well-known SQL dialect names. Custom drivers may report any other string. */
export type DialectName = 'postgres' | 'mysql' | 'sqlite' | 'memory' | 'mongodb';

export interface SqlDialectOptions {
  /** Dialect name, usually the driver name (e.g. 'postgres', 'mysql', 'sqlite'). */
  readonly name?: string | undefined;
  /** Character used to quote identifiers. Defaults to `"` (backtick for MySQL). */
  readonly quoteChar?: '"' | '`' | undefined;
  /** Whether `INSERT ... RETURNING` is supported. */
  readonly supportsReturning?: boolean | undefined;
}

const DIALECT_ALIASES: Readonly<Record<string, string>> = {
  postgresql: 'postgres',
  pg: 'postgres',
  mariadb: 'mysql',
  sqlite3: 'sqlite',
  'better-sqlite3': 'sqlite',
  mongo: 'mongodb',
};

/**
 * Normalizes a driver name or alias (`pg`, `postgresql`, `mariadb`, `sqlite3`) to its
 * canonical dialect name.
 */
export function normalizeDialectName(name: string): string {
  const lower = name.toLowerCase();
  return DIALECT_ALIASES[lower] ?? lower;
}

/**
 * SQL dialect rules shared by the query layer, the ORM and the migration engine:
 * placeholder style, identifier quoting and transaction statements.
 */
export class SqlDialect {
  public readonly name: string;
  public readonly placeholderType: PlaceholderType;
  public readonly quoteChar: '"' | '`';
  public readonly supportsReturning: boolean;

  constructor(placeholderType: PlaceholderType = 'question', options?: SqlDialectOptions) {
    this.placeholderType = placeholderType;
    this.name = normalizeDialectName(options?.name ?? 'generic');
    this.quoteChar = options?.quoteChar ?? (this.name === 'mysql' ? '`' : '"');
    this.supportsReturning = options?.supportsReturning ?? false;
  }

  /**
   * Translates standard positional '?' placeholders to the target driver's placeholder format.
   * Skips quoted string literals and quoted identifiers so '?' inside them is preserved.
   */
  public normalizePlaceholders(sql: string): string {
    if (this.placeholderType !== 'dollar') {
      return sql;
    }

    let paramIndex = 1;
    let quote: string | null = null;
    let result = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]!;

      if (quote) {
        result += char;
        if (char === quote) {
          // Doubled quote inside a literal/identifier is an escape, not a terminator
          if (sql[i + 1] === quote) {
            result += quote;
            i++;
          } else {
            quote = null;
          }
        }
        continue;
      }

      if (char === "'" || char === '"' || char === '`') {
        quote = char;
        result += char;
      } else if (char === '?') {
        result += `$${paramIndex++}`;
      } else {
        result += char;
      }
    }

    return result;
  }

  /**
   * Quotes a table or column identifier safely according to the dialect.
   * Dotted identifiers (`table.column`) are quoted part by part.
   */
  public quoteIdentifier(identifier: string): string {
    if (identifier === '*') {
      return identifier;
    }
    if (
      (identifier.startsWith('"') && identifier.endsWith('"')) ||
      (identifier.startsWith('`') && identifier.endsWith('`'))
    ) {
      return identifier;
    }
    if (identifier.includes('.')) {
      return identifier
        .split('.')
        .map((part) => this.quoteIdentifier(part))
        .join('.');
    }
    const q = this.quoteChar;
    return `${q}${identifier.split(q).join(q + q)}${q}`;
  }

  /**
   * Statements that open a transaction with the requested isolation level.
   */
  public beginTransactionStatements(options?: {
    readonly isolationLevel?: IsolationLevel | undefined;
    readonly readOnly?: boolean | undefined;
  }): string[] {
    const isolation = options?.isolationLevel;
    const readOnly = options?.readOnly === true;

    if (this.name === 'mysql') {
      const statements: string[] = [];
      if (isolation) {
        statements.push(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      }
      statements.push(readOnly ? 'START TRANSACTION READ ONLY' : 'START TRANSACTION');
      return statements;
    }

    if (this.name === 'sqlite') {
      return ['BEGIN'];
    }

    let sql = isolation ? `BEGIN TRANSACTION ISOLATION LEVEL ${isolation}` : 'BEGIN';
    if (readOnly && this.name === 'postgres') {
      sql += isolation ? ' READ ONLY' : ' TRANSACTION READ ONLY';
    }
    return [sql];
  }
}

/**
 * Builds the dialect for a driver from its name and capabilities.
 */
export function createDialect(
  driverName: string,
  capabilities: { readonly placeholderType: PlaceholderType; readonly supportsReturning: boolean }
): SqlDialect {
  return new SqlDialect(capabilities.placeholderType, {
    name: driverName,
    supportsReturning: capabilities.supportsReturning,
  });
}
