import type { OpenApiDocument } from './types.js';

export class OpenApiFormatter {
  /**
   * Formats the document as JSON string.
   */
  public static toJson(doc: OpenApiDocument, pretty = true): string {
    return JSON.stringify(doc, null, pretty ? 2 : undefined);
  }

  /**
   * Formats the document as a clean YAML string with zero external dependencies.
   */
  public static toYaml(doc: OpenApiDocument): string {
    return this.serializeYamlValue(doc, 0);
  }

  private static serializeYamlValue(value: unknown, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);

    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'string') {
      // Escape or quote strings with special characters or newlines
      if (value.includes('\n')) {
        const lines = value
          .split('\n')
          .map((l) => `${indent}  ${l}`)
          .join('\n');
        return `|\n${lines}`;
      }
      if (
        value === '' ||
        /[:#[\]{},&*?|<>=!%@`]/.test(value) ||
        value === 'true' ||
        value === 'false' ||
        value === 'null' ||
        !isNaN(Number(value))
      ) {
        return JSON.stringify(value);
      }
      return value;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const lines: string[] = [];
      for (const item of value) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const itemYaml = this.serializeYamlValue(item, indentLevel + 1).trimStart();
          lines.push(`${indent}- ${itemYaml}`);
        } else {
          lines.push(`${indent}- ${this.serializeYamlValue(item, indentLevel + 1)}`);
        }
      }
      return lines.join('\n');
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return '{}';

      const lines: string[] = [];
      for (const [k, v] of entries) {
        const key = /[:#[\]{},&*?|<>=!%@`]/.test(k) ? JSON.stringify(k) : k;
        if (
          typeof v === 'object' &&
          v !== null &&
          (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0)
        ) {
          lines.push(`${indent}${key}:\n${this.serializeYamlValue(v, indentLevel + 1)}`);
        } else {
          lines.push(`${indent}${key}: ${this.serializeYamlValue(v, indentLevel + 1)}`);
        }
      }
      return lines.join('\n');
    }

    return String(value);
  }
}
