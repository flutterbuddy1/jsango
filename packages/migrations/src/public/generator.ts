import type { SchemaDiff } from './diff.js';
import type { MigrationOperation } from './operations.js';

export interface GeneratedMigration {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly content: string;
}

export interface GenerateMigrationOptions {
  readonly timestamp?: string | undefined;
  readonly connection?: string | undefined;
  /** Package the generated file imports from. Defaults to 'jsango'. */
  readonly importFrom?: string | undefined;
}

export class MigrationGenerator {
  /**
   * Generates an empty, hand-written migration with up/down functions using the schema builder.
   */
  public static generateEmpty(
    name: string,
    options?: GenerateMigrationOptions
  ): GeneratedMigration {
    const cleanName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const timestamp = options?.timestamp ?? MigrationGenerator.generateTimestamp();
    const id = `${timestamp}_${cleanName}`;
    const content = `/**
 * Migration: ${id}
 * Created At: ${new Date().toISOString()}
 *
 * Hand-written migration. Use the schema helpers for portable DDL:
 *   ctx.createTable, ctx.dropTable, ctx.addColumn, ctx.dropColumn, ctx.renameColumn,
 *   ctx.addIndex, ctx.addUnique, ctx.addForeignKey
 * or ctx.sql('...') for anything else (data migrations, views, extensions).
 */

import { defineMigration } from '${options?.importFrom ?? 'jsango'}';

export default defineMigration({
  id: '${id}',
  name: '${cleanName}',${options?.connection ? `\n  connection: '${options.connection}',` : ''}
  async up(ctx) {
    // await ctx.createTable('example', (t) => {
    //   t.id();
    //   t.string('title');
    //   t.timestamps();
    // });
  },
  async down(ctx) {
    // await ctx.dropTable('example');
  },
});
`;
    return { id, name: cleanName, fileName: `${id}.ts`, content };
  }

  public static generateTimestamp(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  public static generate(
    name: string,
    diff: SchemaDiff,
    options?: GenerateMigrationOptions
  ): GeneratedMigration {
    const cleanName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const timestamp = options?.timestamp ?? MigrationGenerator.generateTimestamp();
    const id = `${timestamp}_${cleanName}`;
    const fileName = `${id}.ts`;

    const importsSet = new Set<string>(['Migration']);

    for (const op of diff.operations) {
      importsSet.add(op.constructor.name);
    }

    const sortedImports = [...importsSet].sort().join(',\n  ');

    const operationsCode = diff.operations
      .map((op) => MigrationGenerator.formatOperation(op))
      .join(',\n    ');

    const destructiveWarning = diff.hasDestructiveOperations
      ? `\n * WARNING: This migration contains POTENTIALLY DESTRUCTIVE changes:\n${diff.destructiveOperations
          .map((op) => ` *   - [${op.type}] ${op.destructiveReason ?? 'Unknown risk'}`)
          .join('\n')}\n *`
      : '';

    const content = `/**
 * Migration: ${id}
 * Name: ${cleanName}
 * Created At: ${new Date().toISOString()}${destructiveWarning}
 */

import {
  ${sortedImports},
} from '${options?.importFrom ?? 'jsango'}';

export const id = '${id}';
export const name = '${cleanName}';

export default new Migration({
  id,
  name,${options?.connection ? `\n  connection: '${options.connection}',` : ''}
  operations: [
    ${operationsCode}
  ],
});
`;

    return {
      id,
      name: cleanName,
      fileName,
      content,
    };
  }

  private static formatOperation(op: MigrationOperation): string {
    const json = op.toJSON();
    const className = op.constructor.name;

    switch (op.type) {
      case 'create_table': {
        const table = (json as { table: unknown }).table;
        return `new ${className}(${JSON.stringify(table, null, 6).trim()})`;
      }
      case 'drop_table': {
        const cast = json as { tableName: string; previousTable?: unknown };
        return `new ${className}('${cast.tableName}', ${
          cast.previousTable ? JSON.stringify(cast.previousTable, null, 6).trim() : 'undefined'
        })`;
      }
      case 'add_column': {
        const cast = json as { tableName: string; column: unknown };
        return `new ${className}('${cast.tableName}', ${JSON.stringify(cast.column, null, 6).trim()})`;
      }
      case 'drop_column': {
        const cast = json as { tableName: string; columnName: string; previousColumn?: unknown };
        return `new ${className}('${cast.tableName}', '${cast.columnName}', ${
          cast.previousColumn ? JSON.stringify(cast.previousColumn, null, 6).trim() : 'undefined'
        })`;
      }
      case 'alter_column': {
        const cast = json as { tableName: string; column: unknown; previousColumn: unknown };
        return `new ${className}('${cast.tableName}', ${JSON.stringify(cast.column, null, 6).trim()}, ${JSON.stringify(cast.previousColumn, null, 6).trim()})`;
      }
      case 'rename_column': {
        const cast = json as { tableName: string; oldName: string; newName: string };
        return `new ${className}('${cast.tableName}', '${cast.oldName}', '${cast.newName}')`;
      }
      case 'rename_table': {
        const cast = json as { oldName: string; newName: string };
        return `new ${className}('${cast.oldName}', '${cast.newName}')`;
      }
      case 'create_index': {
        const cast = json as { tableName: string; index: unknown };
        return `new ${className}('${cast.tableName}', ${JSON.stringify(cast.index, null, 6).trim()})`;
      }
      case 'drop_index': {
        const cast = json as { tableName: string; indexName: string; previousIndex?: unknown };
        return `new ${className}('${cast.tableName}', '${cast.indexName}', ${
          cast.previousIndex ? JSON.stringify(cast.previousIndex, null, 6).trim() : 'undefined'
        })`;
      }
      case 'create_unique_constraint': {
        const cast = json as { tableName: string; constraint: unknown };
        return `new ${className}('${cast.tableName}', ${JSON.stringify(cast.constraint, null, 6).trim()})`;
      }
      case 'drop_unique_constraint': {
        const cast = json as {
          tableName: string;
          constraintName: string;
          previousConstraint?: unknown;
        };
        return `new ${className}('${cast.tableName}', '${cast.constraintName}', ${
          cast.previousConstraint
            ? JSON.stringify(cast.previousConstraint, null, 6).trim()
            : 'undefined'
        })`;
      }
      case 'add_foreign_key': {
        const cast = json as { tableName: string; foreignKey: unknown };
        return `new ${className}('${cast.tableName}', ${JSON.stringify(cast.foreignKey, null, 6).trim()})`;
      }
      case 'drop_foreign_key': {
        const cast = json as {
          tableName: string;
          foreignKeyName: string;
          previousForeignKey?: unknown;
        };
        return `new ${className}('${cast.tableName}', '${cast.foreignKeyName}', ${
          cast.previousForeignKey
            ? JSON.stringify(cast.previousForeignKey, null, 6).trim()
            : 'undefined'
        })`;
      }
      default:
        return `new ${className}(${JSON.stringify(json, null, 6).trim()})`;
    }
  }
}
