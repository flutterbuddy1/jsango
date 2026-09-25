import type {
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  TableDefinition,
  UniqueConstraintDefinition,
} from './types.js';

export abstract class MigrationOperation {
  public abstract readonly type: string;
  public abstract readonly isDestructive: boolean;
  public abstract readonly isReversible: boolean;
  public readonly destructiveReason?: string | undefined;

  public abstract getReverse(): MigrationOperation | null;
  public abstract toJSON(): Record<string, unknown>;
}

export class CreateTableOperation extends MigrationOperation {
  public readonly type = 'create_table';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly table: TableDefinition;

  public constructor(table: TableDefinition) {
    super();
    this.table = table;
    Object.freeze(this);
  }

  public getReverse(): DropTableOperation {
    return new DropTableOperation(this.table.name, this.table);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, table: this.table };
  }
}

export class DropTableOperation extends MigrationOperation {
  public readonly type = 'drop_table';
  public readonly isDestructive = true;
  public readonly destructiveReason =
    'Dropping a table permanently destroys all data stored within it.';
  public readonly isReversible: boolean;
  public readonly tableName: string;
  public readonly previousTable?: TableDefinition | undefined;

  public constructor(tableName: string, previousTable?: TableDefinition) {
    super();
    this.tableName = tableName;
    this.previousTable = previousTable;
    this.isReversible = previousTable !== undefined;
    Object.freeze(this);
  }

  public getReverse(): CreateTableOperation | null {
    if (!this.previousTable) {
      return null;
    }
    return new CreateTableOperation(this.previousTable);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, tableName: this.tableName, previousTable: this.previousTable };
  }
}

export class AddColumnOperation extends MigrationOperation {
  public readonly type = 'add_column';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly tableName: string;
  public readonly column: ColumnDefinition;

  public constructor(tableName: string, column: ColumnDefinition) {
    super();
    this.tableName = tableName;
    this.column = column;
    Object.freeze(this);
  }

  public getReverse(): DropColumnOperation {
    return new DropColumnOperation(this.tableName, this.column.name, this.column);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, tableName: this.tableName, column: this.column };
  }
}

export class DropColumnOperation extends MigrationOperation {
  public readonly type = 'drop_column';
  public readonly isDestructive = true;
  public readonly destructiveReason =
    'Dropping a column permanently destroys all data stored in that column.';
  public readonly isReversible: boolean;
  public readonly tableName: string;
  public readonly columnName: string;
  public readonly previousColumn?: ColumnDefinition | undefined;

  public constructor(tableName: string, columnName: string, previousColumn?: ColumnDefinition) {
    super();
    this.tableName = tableName;
    this.columnName = columnName;
    this.previousColumn = previousColumn;
    this.isReversible = previousColumn !== undefined;
    Object.freeze(this);
  }

  public getReverse(): AddColumnOperation | null {
    if (!this.previousColumn) {
      return null;
    }
    return new AddColumnOperation(this.tableName, this.previousColumn);
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      tableName: this.tableName,
      columnName: this.columnName,
      previousColumn: this.previousColumn,
    };
  }
}

export class AlterColumnOperation extends MigrationOperation {
  public readonly type = 'alter_column';
  public readonly isDestructive: boolean;
  public override readonly destructiveReason?: string | undefined;
  public readonly isReversible = true;
  public readonly tableName: string;
  public readonly column: ColumnDefinition;
  public readonly previousColumn: ColumnDefinition;

  public constructor(
    tableName: string,
    column: ColumnDefinition,
    previousColumn: ColumnDefinition
  ) {
    super();
    this.tableName = tableName;
    this.column = column;
    this.previousColumn = previousColumn;

    // Detect destructive alterations
    let destructive = false;
    let reason: string | undefined;

    if (previousColumn.nullable && !column.nullable && column.defaultValue === undefined) {
      destructive = true;
      reason = `Changing column '${column.name}' from nullable to non-nullable without default may fail if nulls exist.`;
    } else if (
      previousColumn.length !== undefined &&
      column.length !== undefined &&
      column.length < previousColumn.length
    ) {
      destructive = true;
      reason = `Shrinking column '${column.name}' length from ${previousColumn.length} to ${column.length} may truncate existing data.`;
    } else if (previousColumn.type !== column.type) {
      destructive = true;
      reason = `Changing column '${column.name}' type from ${previousColumn.type} to ${column.type} may fail or corrupt data.`;
    }

    this.isDestructive = destructive;
    this.destructiveReason = reason;
    Object.freeze(this);
  }

  public getReverse(): AlterColumnOperation {
    return new AlterColumnOperation(this.tableName, this.previousColumn, this.column);
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      tableName: this.tableName,
      column: this.column,
      previousColumn: this.previousColumn,
    };
  }
}

export class RenameColumnOperation extends MigrationOperation {
  public readonly type = 'rename_column';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly tableName: string;
  public readonly oldName: string;
  public readonly newName: string;

  public constructor(tableName: string, oldName: string, newName: string) {
    super();
    this.tableName = tableName;
    this.oldName = oldName;
    this.newName = newName;
    Object.freeze(this);
  }

  public getReverse(): RenameColumnOperation {
    return new RenameColumnOperation(this.tableName, this.newName, this.oldName);
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      tableName: this.tableName,
      oldName: this.oldName,
      newName: this.newName,
    };
  }
}

export class RenameTableOperation extends MigrationOperation {
  public readonly type = 'rename_table';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly oldName: string;
  public readonly newName: string;

  public constructor(oldName: string, newName: string) {
    super();
    this.oldName = oldName;
    this.newName = newName;
    Object.freeze(this);
  }

  public getReverse(): RenameTableOperation {
    return new RenameTableOperation(this.newName, this.oldName);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, oldName: this.oldName, newName: this.newName };
  }
}

export class CreateIndexOperation extends MigrationOperation {
  public readonly type = 'create_index';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly tableName: string;
  public readonly index: IndexDefinition;

  public constructor(tableName: string, index: IndexDefinition) {
    super();
    this.tableName = tableName;
    this.index = index;
    Object.freeze(this);
  }

  public getReverse(): DropIndexOperation {
    return new DropIndexOperation(this.tableName, this.index.name, this.index);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, tableName: this.tableName, index: this.index };
  }
}

export class DropIndexOperation extends MigrationOperation {
  public readonly type = 'drop_index';
  public readonly isDestructive = false;
  public readonly isReversible: boolean;
  public readonly tableName: string;
  public readonly indexName: string;
  public readonly previousIndex?: IndexDefinition | undefined;

  public constructor(tableName: string, indexName: string, previousIndex?: IndexDefinition) {
    super();
    this.tableName = tableName;
    this.indexName = indexName;
    this.previousIndex = previousIndex;
    this.isReversible = previousIndex !== undefined;
    Object.freeze(this);
  }

  public getReverse(): CreateIndexOperation | null {
    if (!this.previousIndex) {
      return null;
    }
    return new CreateIndexOperation(this.tableName, this.previousIndex);
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      tableName: this.tableName,
      indexName: this.indexName,
      previousIndex: this.previousIndex,
    };
  }
}

export class CreateUniqueConstraintOperation extends MigrationOperation {
  public readonly type = 'create_unique_constraint';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly tableName: string;
  public readonly constraint: UniqueConstraintDefinition;

  public constructor(tableName: string, constraint: UniqueConstraintDefinition) {
    super();
    this.tableName = tableName;
    this.constraint = constraint;
    Object.freeze(this);
  }

  public getReverse(): DropUniqueConstraintOperation {
    return new DropUniqueConstraintOperation(this.tableName, this.constraint.name, this.constraint);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, tableName: this.tableName, constraint: this.constraint };
  }
}

export class DropUniqueConstraintOperation extends MigrationOperation {
  public readonly type = 'drop_unique_constraint';
  public readonly isDestructive = false;
  public readonly isReversible: boolean;
  public readonly tableName: string;
  public readonly constraintName: string;
  public readonly previousConstraint?: UniqueConstraintDefinition | undefined;

  public constructor(
    tableName: string,
    constraintName: string,
    previousConstraint?: UniqueConstraintDefinition
  ) {
    super();
    this.tableName = tableName;
    this.constraintName = constraintName;
    this.previousConstraint = previousConstraint;
    this.isReversible = previousConstraint !== undefined;
    Object.freeze(this);
  }

  public getReverse(): CreateUniqueConstraintOperation | null {
    if (!this.previousConstraint) {
      return null;
    }
    return new CreateUniqueConstraintOperation(this.tableName, this.previousConstraint);
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      tableName: this.tableName,
      constraintName: this.constraintName,
      previousConstraint: this.previousConstraint,
    };
  }
}

export class AddForeignKeyOperation extends MigrationOperation {
  public readonly type = 'add_foreign_key';
  public readonly isDestructive = false;
  public readonly isReversible = true;
  public readonly tableName: string;
  public readonly foreignKey: ForeignKeyDefinition;

  public constructor(tableName: string, foreignKey: ForeignKeyDefinition) {
    super();
    this.tableName = tableName;
    this.foreignKey = foreignKey;
    Object.freeze(this);
  }

  public getReverse(): DropForeignKeyOperation {
    return new DropForeignKeyOperation(this.tableName, this.foreignKey.name, this.foreignKey);
  }

  public toJSON(): Record<string, unknown> {
    return { type: this.type, tableName: this.tableName, foreignKey: this.foreignKey };
  }
}

export class DropForeignKeyOperation extends MigrationOperation {
  public readonly type = 'drop_foreign_key';
  public readonly isDestructive = false;
  public readonly isReversible: boolean;
  public readonly tableName: string;
  public readonly foreignKeyName: string;
  public readonly previousForeignKey?: ForeignKeyDefinition | undefined;

  public constructor(
    tableName: string,
    foreignKeyName: string,
    previousForeignKey?: ForeignKeyDefinition
  ) {
    super();
    this.tableName = tableName;
    this.foreignKeyName = foreignKeyName;
    this.previousForeignKey = previousForeignKey;
    this.isReversible = previousForeignKey !== undefined;
    Object.freeze(this);
  }

  public getReverse(): AddForeignKeyOperation | null {
    if (!this.previousForeignKey) {
      return null;
    }
    return new AddForeignKeyOperation(this.tableName, this.previousForeignKey);
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      tableName: this.tableName,
      foreignKeyName: this.foreignKeyName,
      previousForeignKey: this.previousForeignKey,
    };
  }
}

export class RawSqlOperation extends MigrationOperation {
  public readonly type = 'raw_sql';
  public readonly isDestructive: boolean;
  public override readonly destructiveReason?: string | undefined;
  public readonly isReversible: boolean;
  public readonly upSql: string;
  public readonly downSql?: string | undefined;

  public constructor(options: {
    upSql: string;
    downSql?: string | undefined;
    isDestructive?: boolean | undefined;
    destructiveReason?: string | undefined;
  }) {
    super();
    this.upSql = options.upSql;
    this.downSql = options.downSql;
    this.isDestructive = options.isDestructive ?? false;
    this.destructiveReason = options.destructiveReason;
    this.isReversible = options.downSql !== undefined;
    Object.freeze(this);
  }

  public getReverse(): RawSqlOperation | null {
    if (!this.downSql) {
      return null;
    }
    return new RawSqlOperation({
      upSql: this.downSql,
      downSql: this.upSql,
    });
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      upSql: this.upSql,
      downSql: this.downSql,
      isDestructive: this.isDestructive,
    };
  }
}
