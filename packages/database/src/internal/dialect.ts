export type PlaceholderType = 'dollar' | 'question' | 'named';

export class SqlDialect {
  public readonly placeholderType: PlaceholderType;

  constructor(placeholderType: PlaceholderType = 'question') {
    this.placeholderType = placeholderType;
  }

  /**
   * Translates standard positional '?' placeholders to the target driver's placeholder format.
   * Accurately skips single-quoted string literals so '?' inside text is preserved.
   */
  public normalizePlaceholders(sql: string): string {
    if (this.placeholderType === 'question') {
      return sql;
    }

    if (this.placeholderType === 'dollar') {
      let paramIndex = 1;
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let result = '';

      for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1];

        if (char === "'" && !inDoubleQuote) {
          // Check for escaped single quote ''
          if (inSingleQuote && nextChar === "'") {
            result += "''";
            i++;
            continue;
          }
          inSingleQuote = !inSingleQuote;
          result += char;
        } else if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
          result += char;
        } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
          result += `$${paramIndex++}`;
        } else {
          result += char;
        }
      }

      return result;
    }

    return sql;
  }

  /**
   * Quotes a table or column identifier safely according to the dialect.
   */
  public quoteIdentifier(identifier: string): string {
    // Avoid double quoting if already quoted
    if (
      (identifier.startsWith('"') && identifier.endsWith('"')) ||
      (identifier.startsWith('`') && identifier.endsWith('`'))
    ) {
      return identifier;
    }

    if (this.placeholderType === 'dollar') {
      // PostgreSQL standard
      return `"${identifier.replace(/"/g, '""')}"`;
    }

    // Default standard SQL / SQLite
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
