import { SchemaSnapshot } from './schema.js';
import type { Migration } from './migration.js';
import type { MigrationDialect } from '../internal/compiler.js';
import type { ColumnDefinition, TableDefinition } from './types.js';
import {
  AddColumnOperation,
  AddForeignKeyOperation,
  AlterColumnOperation,
  CreateIndexOperation,
  CreateTableOperation,
  CreateUniqueConstraintOperation,
  DropColumnOperation,
  DropForeignKeyOperation,
  DropIndexOperation,
  DropTableOperation,
  DropUniqueConstraintOperation,
  type MigrationOperation,
  RenameColumnOperation,
  RenameTableOperation,
} from './operations.js';

type MutableTable = {
  name: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  indexes: NonNullable<TableDefinition['indexes']>[number][];
  foreignKeys: NonNullable<TableDefinition['foreignKeys']>[number][];
  uniqueConstraints: NonNullable<TableDefinition['uniqueConstraints']>[number][];
  comment?: string | undefined;
};

function toMutable(def: TableDefinition): MutableTable {
  const pk = def.primaryKey
    ? [...def.primaryKey]
    : def.columns.filter((c) => c.primaryKey).map((c) => c.name);
  return {
    name: def.name,
    columns: def.columns.map((c) => ({ ...c })),
    primaryKey: pk,
    indexes: [...(def.indexes ?? [])],
    foreignKeys: [...(def.foreignKeys ?? [])],
    uniqueConstraints: [...(def.uniqueConstraints ?? [])],
    comment: def.comment,
  };
}

/**
 * The schema that a sequence of migration operations produces, computed without a database.
 *
 * This is how `jsango migrate:generate` (makemigrations) knows what already exists: it replays
 * the operations of every migration file and diffs the result against the ORM models. Migrations
 * written with `ctx.sql()` only are opaque and do not contribute to the state.
 */
export class SchemaState {
  private readonly tables = new Map<string, MutableTable>();

  public static fromSnapshot(snapshot: SchemaSnapshot): SchemaState {
    const state = new SchemaState();
    for (const table of snapshot.tables.values()) {
      state.tables.set(table.name, toMutable(table.toJSON()));
    }
    return state;
  }

  /**
   * Replays migrations (in order) to compute the schema they produce. Hand-written migrations
   * contribute the operations issued through the ctx schema helpers.
   */
  public static async fromMigrations(
    migrations: readonly Migration[],
    dialect: MigrationDialect = 'memory'
  ): Promise<SchemaState> {
    const state = new SchemaState();
    for (const migration of migrations) {
      for (const op of await migration.collectOperations(dialect)) {
        state.apply(op);
      }
    }
    return state;
  }

  public static fromOperations(operations: readonly MigrationOperation[]): SchemaState {
    const state = new SchemaState();
    for (const op of operations) {
      state.apply(op);
    }
    return state;
  }

  /** Independent copy of this state. */
  public clone(): SchemaState {
    return SchemaState.fromSnapshot(this.toSnapshot());
  }

  public hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  public getTable(name: string): TableDefinition | undefined {
    const table = this.tables.get(name);
    return table ? this.freezeTable(table) : undefined;
  }

  /** Applies one operation. Unknown or raw SQL operations are ignored. */
  public apply(op: MigrationOperation): this {
    if (op instanceof CreateTableOperation) {
      this.tables.set(op.table.name, toMutable(op.table));
    } else if (op instanceof DropTableOperation) {
      this.tables.delete(op.tableName);
    } else if (op instanceof RenameTableOperation) {
      const table = this.tables.get(op.oldName);
      if (table) {
        this.tables.delete(op.oldName);
        table.name = op.newName;
        this.tables.set(op.newName, table);
      }
    } else if (op instanceof AddColumnOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.columns = table.columns.filter((c) => c.name !== op.column.name);
        table.columns.push({ ...op.column });
        if (op.column.primaryKey && !table.primaryKey.includes(op.column.name)) {
          table.primaryKey.push(op.column.name);
        }
      }
    } else if (op instanceof DropColumnOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        const name = op.columnName;
        table.columns = table.columns.filter((c) => c.name !== name);
        table.primaryKey = table.primaryKey.filter((c) => c !== name);
        table.indexes = table.indexes.filter((i) => !i.columns.includes(name));
        table.uniqueConstraints = table.uniqueConstraints.filter((u) => !u.columns.includes(name));
        table.foreignKeys = table.foreignKeys.filter((f) => !f.columns.includes(name));
      }
    } else if (op instanceof AlterColumnOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.columns = table.columns.map((c) =>
          c.name === op.column.name ? { ...op.column } : c
        );
      }
    } else if (op instanceof RenameColumnOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        const rename = (n: string) => (n === op.oldName ? op.newName : n);
        table.columns = table.columns.map((c) =>
          c.name === op.oldName ? { ...c, name: op.newName } : c
        );
        table.primaryKey = table.primaryKey.map(rename);
        table.indexes = table.indexes.map((i) => ({ ...i, columns: i.columns.map(rename) }));
        table.uniqueConstraints = table.uniqueConstraints.map((u) => ({
          ...u,
          columns: u.columns.map(rename),
        }));
        table.foreignKeys = table.foreignKeys.map((f) => ({
          ...f,
          columns: f.columns.map(rename),
        }));
      }
    } else if (op instanceof CreateIndexOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.indexes = [...table.indexes.filter((i) => i.name !== op.index.name), op.index];
      }
    } else if (op instanceof DropIndexOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.indexes = table.indexes.filter((i) => i.name !== op.indexName);
      }
    } else if (op instanceof CreateUniqueConstraintOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.uniqueConstraints = [
          ...table.uniqueConstraints.filter((u) => u.name !== op.constraint.name),
          op.constraint,
        ];
      }
    } else if (op instanceof DropUniqueConstraintOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.uniqueConstraints = table.uniqueConstraints.filter(
          (u) => u.name !== op.constraintName
        );
      }
    } else if (op instanceof AddForeignKeyOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.foreignKeys = [
          ...table.foreignKeys.filter((f) => f.name !== op.foreignKey.name),
          op.foreignKey,
        ];
      }
    } else if (op instanceof DropForeignKeyOperation) {
      const table = this.tables.get(op.tableName);
      if (table) {
        table.foreignKeys = table.foreignKeys.filter((f) => f.name !== op.foreignKeyName);
      }
    }
    return this;
  }

  public toSnapshot(): SchemaSnapshot {
    return new SchemaSnapshot({
      tables: [...this.tables.values()].map((t) => this.freezeTable(t)),
    });
  }

  private freezeTable(table: MutableTable): TableDefinition {
    return {
      name: table.name,
      columns: table.columns.map((c) => ({ ...c })),
      primaryKey: table.primaryKey.length > 0 ? [...table.primaryKey] : undefined,
      indexes: [...table.indexes],
      foreignKeys: [...table.foreignKeys],
      uniqueConstraints: [...table.uniqueConstraints],
      comment: table.comment,
    };
  }
}
