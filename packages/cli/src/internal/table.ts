export interface TableOptions {
  readonly border?: boolean | undefined;
  readonly maxColumnWidth?: number | undefined;
}

export class TableFormatter {
  public static format(
    headers: readonly string[],
    rows: readonly (readonly unknown[])[],
    options: TableOptions = {}
  ): string {
    if (headers.length === 0) {
      return '';
    }

    const maxColWidth = options.maxColumnWidth ?? 60;
    const numCols = headers.length;

    // Convert all cells to strings
    const strHeaders = headers.map((h) => String(h));
    const strRows = rows.map((row) => {
      const formattedRow: string[] = [];
      for (let i = 0; i < numCols; i++) {
        const val = row[i];
        formattedRow.push(val === undefined || val === null ? '' : String(val));
      }
      return formattedRow;
    });

    // Compute column widths
    const colWidths: number[] = strHeaders.map((h) => Math.min(h.length, maxColWidth));

    for (const row of strRows) {
      for (let i = 0; i < numCols; i++) {
        const cell = row[i]!;
        if (cell.length > colWidths[i]!) {
          colWidths[i] = Math.min(cell.length, maxColWidth);
        }
      }
    }

    const pad = (str: string, width: number): string => {
      if (str.length > width) {
        return str.slice(0, Math.max(0, width - 3)) + '...';
      }
      return str + ' '.repeat(width - str.length);
    };

    const lines: string[] = [];

    // Header line
    const headerLine = strHeaders.map((h, i) => pad(h, colWidths[i]!)).join('   ');
    lines.push(headerLine);

    // Separator line
    const separatorLine = colWidths.map((w) => '-'.repeat(w)).join('   ');
    lines.push(separatorLine);

    // Data rows
    for (const row of strRows) {
      const line = row.map((cell, i) => pad(cell, colWidths[i]!)).join('   ');
      lines.push(line);
    }

    return lines.join('\n');
  }
}
