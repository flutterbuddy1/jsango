import type { MongoCommand } from '@jsango/database';
import type {
  ColumnDefinition,
  ColumnType,
  IndexDefinition,
  TableDefinition,
} from '../public/types.js';
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
  RawSqlOperation,
  RenameColumnOperation,
  RenameTableOperation,
} from '../public/operations.js';
import type { SchemaState } from '../public/state.js';
import { MigrationError } from '../public/errors.js';

/** BSON types accepted for each column type. JS numbers may arrive as int32, int64 or double. */
function bsonTypes(col: ColumnDefinition): string[] | undefined {
  if (col.objectId) return ['objectId', 'string'];
  const map: Partial<Record<ColumnType, string[]>> = {
    string: ['string'],
    text: ['string'],
    uuid: ['string'],
    integer: ['int', 'long', 'double'],
    bigint: ['long', 'int', 'double', 'string'],
    float: ['double', 'int', 'long', 'decimal'],
    decimal: ['double', 'int', 'long', 'decimal'],
    boolean: ['bool'],
    dateTime: ['date'],
    date: ['date'],
    time: ['date'],
    binary: ['binData'],
  };
  return map[col.type];
}

function isPrimaryKey(table: TableDefinition, column: string): boolean {
  const pk = table.primaryKey ?? table.columns.filter((c) => c.primaryKey).map((c) => c.name);
  return pk.length === 1 && pk[0] === column;
}

/** Field name inside documents: the single-column primary key is `_id`. */
function docField(table: TableDefinition | undefined, column: string): string {
  return table && isPrimaryKey(table, column) ? '_id' : column;
}

/**
 * `$jsonSchema` validator enforcing NOT NULL (required) and value types, like a SQL schema.
 * Unknown extra fields are allowed.
 */
export function buildValidator(table: TableDefinition): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const col of table.columns) {
    if (isPrimaryKey(table, col.name)) continue;
    const types = bsonTypes(col);
    const nullable = col.nullable !== false;
    if (types) {
      properties[col.name] = { bsonType: nullable ? [...types, 'null'] : types };
    }
    if (!nullable) required.push(col.name);
  }
  return {
    $jsonSchema: {
      bsonType: 'object',
      ...(required.length > 0 ? { required } : {}),
      properties,
    },
  };
}

function indexCommand(
  table: TableDefinition | undefined,
  tableName: string,
  index: IndexDefinition
): MongoCommand {
  const keys: Record<string, 1> = {};
  for (const c of index.columns) keys[docField(table, c)] = 1;
  let partialFilterExpression: Record<string, unknown> | undefined;
  if (index.unique && table) {
    // SQL allows many NULLs in a unique column; MongoDB would treat them as duplicates.
    // Only index documents where every column holds a non-null value.
    const nullable = index.columns
      .map((c) => table.columns.find((col) => col.name === c))
      .filter(
        (c): c is ColumnDefinition =>
          c !== undefined && c.nullable !== false && !isPrimaryKey(table, c.name)
      );
    if (nullable.length > 0) {
      partialFilterExpression = {};
      for (const col of nullable) {
        const types = bsonTypes(col);
        partialFilterExpression[col.name] = types ? { $type: types } : { $exists: true };
      }
    }
  }
  return {
    op: 'createIndex',
    collection: tableName,
    keys,
    name: index.name,
    unique: index.unique ?? false,
    partialFilterExpression,
  };
}

function withValidator(table: TableDefinition | undefined, name: string): MongoCommand[] {
  if (!table) return [];
  return [
    {
      op: 'collMod',
      collection: name,
      validator: buildValidator(table),
      validationLevel: 'moderate',
      validationAction: 'error',
    },
  ];
}

/**
 * Translates schema operations into MongoDB commands.
 *
 * `before` / `after` are the schema states around the operation (from replaying migrations),
 * needed to regenerate a collection's validator and indexes. Foreign keys have no MongoDB
 * equivalent and are skipped; relations are still resolved by the ORM.
 */
export function compileMongoOperation(
  op: MigrationOperation,
  before: SchemaState,
  after: SchemaState
): MongoCommand[] {
  if (op instanceof CreateTableOperation) {
    const table = op.table;
    const commands: MongoCommand[] = [
      {
        op: 'createCollection',
        collection: table.name,
        validator: buildValidator(table),
        validationLevel: 'moderate',
        validationAction: 'error',
      },
    ];
    for (const uc of table.uniqueConstraints ?? []) {
      commands.push(
        indexCommand(table, table.name, { name: uc.name, columns: uc.columns, unique: true })
      );
    }
    for (const idx of table.indexes ?? []) {
      commands.push(indexCommand(table, table.name, idx));
    }
    return commands;
  }

  if (op instanceof DropTableOperation) {
    return [{ op: 'dropCollection', collection: op.tableName }];
  }

  if (op instanceof RenameTableOperation) {
    return [{ op: 'renameCollection', collection: op.oldName, to: op.newName }];
  }

  if (op instanceof AddColumnOperation) {
    const commands: MongoCommand[] = [];
    if (op.column.defaultValue !== undefined && op.column.defaultValue !== null) {
      // Backfill existing documents, like a SQL column DEFAULT does.
      commands.push({
        op: 'updateMany',
        collection: op.tableName,
        filter: { [op.column.name]: { $exists: false } },
        update: { $set: { [op.column.name]: op.column.defaultValue } },
      });
    }
    commands.push(...withValidator(after.getTable(op.tableName), op.tableName));
    return commands;
  }

  if (op instanceof DropColumnOperation) {
    const table = before.getTable(op.tableName);
    // Relax the validator first: the old one still requires the column being removed.
    const commands: MongoCommand[] = [...withValidator(after.getTable(op.tableName), op.tableName)];
    for (const idx of [...(table?.indexes ?? []), ...(table?.uniqueConstraints ?? [])]) {
      if (idx.columns.includes(op.columnName)) {
        commands.push({ op: 'dropIndex', collection: op.tableName, name: idx.name });
      }
    }
    commands.push({
      op: 'updateMany',
      collection: op.tableName,
      filter: { [op.columnName]: { $exists: true } },
      update: { $unset: { [op.columnName]: '' } },
    });
    return commands;
  }

  if (op instanceof AlterColumnOperation) {
    return withValidator(after.getTable(op.tableName), op.tableName);
  }

  if (op instanceof RenameColumnOperation) {
    const oldTable = before.getTable(op.tableName);
    const newTable = after.getTable(op.tableName);
    // New validator first ('moderate' does not block updates to documents that do not match it
    // yet), then move the data.
    const commands: MongoCommand[] = [...withValidator(newTable, op.tableName)];
    const affected = [
      ...(oldTable?.indexes ?? []),
      ...(oldTable?.uniqueConstraints ?? []).map((u) => ({ ...u, unique: true })),
    ].filter((idx) => idx.columns.includes(op.oldName));
    for (const idx of affected)
      commands.push({ op: 'dropIndex', collection: op.tableName, name: idx.name });
    commands.push({
      op: 'updateMany',
      collection: op.tableName,
      filter: { [op.oldName]: { $exists: true } },
      update: { $rename: { [op.oldName]: op.newName } },
    });
    for (const idx of affected) {
      commands.push(
        indexCommand(newTable, op.tableName, {
          ...idx,
          columns: idx.columns.map((c) => (c === op.oldName ? op.newName : c)),
        })
      );
    }
    return commands;
  }

  if (op instanceof CreateIndexOperation) {
    return [indexCommand(after.getTable(op.tableName), op.tableName, op.index)];
  }

  if (op instanceof CreateUniqueConstraintOperation) {
    return [
      indexCommand(after.getTable(op.tableName), op.tableName, {
        name: op.constraint.name,
        columns: op.constraint.columns,
        unique: true,
      }),
    ];
  }

  if (op instanceof DropIndexOperation) {
    return [{ op: 'dropIndex', collection: op.tableName, name: op.indexName }];
  }

  if (op instanceof DropUniqueConstraintOperation) {
    return [{ op: 'dropIndex', collection: op.tableName, name: op.constraintName }];
  }

  if (op instanceof AddForeignKeyOperation || op instanceof DropForeignKeyOperation) {
    return [];
  }

  if (op instanceof RawSqlOperation) {
    throw new MigrationError({
      message:
        'Raw SQL migrations cannot run on MongoDB. Use ctx.execute({ op: ..., collection: ... }) in a hand-written migration instead.',
    });
  }

  throw new MigrationError({
    message: `Unsupported migration operation type '${op.type}' for MongoDB.`,
  });
}
