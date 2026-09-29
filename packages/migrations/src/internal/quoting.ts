import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';

/**
 * Framework-owned SQL (migration history and lock tables) is written with standard double-quoted
 * identifiers and no double-quoted string literals. For MySQL connections, whose identifier
 * quote is the backtick, the quotes are swapped.
 */
export function adaptIdentifierQuotes(
  connection: IDatabaseConnection | IDatabaseTransaction,
  sql: string
): string {
  return connection.dialect?.quoteChar === '`' ? sql.replace(/"/g, '`') : sql;
}
