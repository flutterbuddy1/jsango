import type {
  ColumnDefinition,
  ColumnType,
  ForeignKeyAction,
  ForeignKeyDefinition,
  IndexDefinition,
  SchemaSnapshotData,
  TableDefinition,
  UniqueConstraintDefinition,
} from './types.js';

export class ColumnSchema {
  public readonly name: string;
  public readonly type: ColumnType;
  public readonly nullable: boolean;
  public readonly primaryKey: boolean;
  public readonly autoIncrement: boolean;
  public readonly unique: boolean;
  public readonly defaultValue: unknown;
  public readonly length?: number | undefined;
  public readonly precision?: number | undefined;
  public readonly scale?: number | undefined;
  public readonly comment?: string | undefined;

  public constructor(def: ColumnDefinition) {
    this.name = def.name;
    this.type = def.type;
    this.nullable = def.nullable ?? false;
    this.primaryKey = def.primaryKey ?? false;
    this.autoIncrement = def.autoIncrement ?? false;
    this.unique = def.unique ?? false;
    this.defaultValue = def.defaultValue;
    this.length = def.length;
    this.precision = def.precision;
    this.scale = def.scale;
    this.comment = def.comment;
    Object.freeze(this);
  }

  public equals(other: ColumnSchema): boolean {
    return (
      this.name === other.name &&
      this.type === other.type &&
      this.nullable === other.nullable &&
      this.primaryKey === other.primaryKey &&
      this.autoIncrement === other.autoIncrement &&
      this.unique === other.unique &&
      this.defaultValue === other.defaultValue &&
      this.length === other.length &&
      this.precision === other.precision &&
      this.scale === other.scale
    );
  }

  public toJSON(): ColumnDefinition {
    return {
      name: this.name,
      type: this.type,
      nullable: this.nullable,
      primaryKey: this.primaryKey,
      autoIncrement: this.autoIncrement,
      unique: this.unique,
      defaultValue: this.defaultValue,
      length: this.length,
      precision: this.precision,
      scale: this.scale,
      comment: this.comment,
    };
  }
}

export class IndexSchema {
  public readonly name: string;
  public readonly columns: readonly string[];
  public readonly unique: boolean;

  public constructor(def: IndexDefinition) {
    this.name = def.name;
    this.columns = Object.freeze([...def.columns]);
    this.unique = def.unique ?? false;
    Object.freeze(this);
  }

  public equals(other: IndexSchema): boolean {
    if (this.name !== other.name || this.unique !== other.unique) {
      return false;
    }
    if (this.columns.length !== other.columns.length) {
      return false;
    }
    return this.columns.every((col, i) => col === other.columns[i]);
  }

  public toJSON(): IndexDefinition {
    return {
      name: this.name,
      columns: [...this.columns],
      unique: this.unique,
    };
  }
}

export class ForeignKeySchema {
  public readonly name: string;
  public readonly columns: readonly string[];
  public readonly referencedTable: string;
  public readonly referencedColumns: readonly string[];
  public readonly onDelete: ForeignKeyAction;
  public readonly onUpdate: ForeignKeyAction;

  public constructor(def: ForeignKeyDefinition) {
    this.name = def.name;
    this.columns = Object.freeze([...def.columns]);
    this.referencedTable = def.referencedTable;
    this.referencedColumns = Object.freeze([...def.referencedColumns]);
    this.onDelete = def.onDelete ?? 'NO ACTION';
    this.onUpdate = def.onUpdate ?? 'NO ACTION';
    Object.freeze(this);
  }

  public equals(other: ForeignKeySchema): boolean {
    if (
      this.name !== other.name ||
      this.referencedTable !== other.referencedTable ||
      this.onDelete !== other.onDelete ||
      this.onUpdate !== other.onUpdate
    ) {
      return false;
    }
    if (this.columns.length !== other.columns.length) {
      return false;
    }
    if (this.referencedColumns.length !== other.referencedColumns.length) {
      return false;
    }
    return (
      this.columns.every((c, i) => c === other.columns[i]) &&
      this.referencedColumns.every((rc, i) => rc === other.referencedColumns[i])
    );
  }

  public toJSON(): ForeignKeyDefinition {
    return {
      name: this.name,
      columns: [...this.columns],
      referencedTable: this.referencedTable,
      referencedColumns: [...this.referencedColumns],
      onDelete: this.onDelete,
      onUpdate: this.onUpdate,
    };
  }
}

export class UniqueConstraintSchema {
  public readonly name: string;
  public readonly columns: readonly string[];

  public constructor(def: UniqueConstraintDefinition) {
    this.name = def.name;
    this.columns = Object.freeze([...def.columns]);
    Object.freeze(this);
  }

  public equals(other: UniqueConstraintSchema): boolean {
    if (this.name !== other.name || this.columns.length !== other.columns.length) {
      return false;
    }
    return this.columns.every((col, i) => col === other.columns[i]);
  }

  public toJSON(): UniqueConstraintDefinition {
    return {
      name: this.name,
      columns: [...this.columns],
    };
  }
}

export class TableSchema {
  public readonly name: string;
  public readonly columns: ReadonlyMap<string, ColumnSchema>;
  public readonly primaryKey: readonly string[];
  public readonly indexes: readonly IndexSchema[];
  public readonly foreignKeys: readonly ForeignKeySchema[];
  public readonly uniqueConstraints: readonly UniqueConstraintSchema[];
  public readonly comment?: string | undefined;

  public constructor(def: TableDefinition) {
    this.name = def.name;
    const colMap = new Map<string, ColumnSchema>();
    const pkCols: string[] = def.primaryKey ? [...def.primaryKey] : [];

    for (const colDef of def.columns) {
      const col = new ColumnSchema(colDef);
      colMap.set(col.name, col);
      if (col.primaryKey && !pkCols.includes(col.name)) {
        pkCols.push(col.name);
      }
    }

    this.columns = colMap;
    this.primaryKey = Object.freeze(pkCols.sort());
    this.indexes = Object.freeze((def.indexes ?? []).map((i) => new IndexSchema(i)));
    this.foreignKeys = Object.freeze((def.foreignKeys ?? []).map((fk) => new ForeignKeySchema(fk)));
    this.uniqueConstraints = Object.freeze(
      (def.uniqueConstraints ?? []).map((uc) => new UniqueConstraintSchema(uc))
    );
    this.comment = def.comment;
    Object.freeze(this);
  }

  public getColumn(name: string): ColumnSchema | undefined {
    return this.columns.get(name);
  }

  public hasColumn(name: string): boolean {
    return this.columns.has(name);
  }

  public getColumnNames(): readonly string[] {
    return Object.freeze([...this.columns.keys()].sort());
  }

  public toJSON(): TableDefinition {
    return {
      name: this.name,
      columns: [...this.columns.values()].map((c) => c.toJSON()),
      primaryKey: [...this.primaryKey],
      indexes: this.indexes.map((i) => i.toJSON()),
      foreignKeys: this.foreignKeys.map((fk) => fk.toJSON()),
      uniqueConstraints: this.uniqueConstraints.map((uc) => uc.toJSON()),
      comment: this.comment,
    };
  }
}

export class SchemaSnapshot {
  public readonly version: number;
  public readonly createdAt: string;
  public readonly tables: ReadonlyMap<string, TableSchema>;

  public constructor(data?: {
    version?: number;
    createdAt?: string;
    tables?: readonly TableDefinition[] | readonly TableSchema[];
  }) {
    this.version = data?.version ?? 1;
    this.createdAt = data?.createdAt ?? new Date().toISOString();

    const tableMap = new Map<string, TableSchema>();
    if (data?.tables) {
      for (const t of data.tables) {
        if (t instanceof TableSchema) {
          tableMap.set(t.name, t);
        } else {
          const schema = new TableSchema(t);
          tableMap.set(schema.name, schema);
        }
      }
    }

    this.tables = tableMap;
    Object.freeze(this);
  }

  public getTable(name: string): TableSchema | undefined {
    return this.tables.get(name);
  }

  public hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  public getTableNames(): readonly string[] {
    return Object.freeze([...this.tables.keys()].sort());
  }

  public toJSON(): SchemaSnapshotData {
    const sortedTables = [...this.tables.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => t.toJSON());

    return {
      version: this.version,
      createdAt: this.createdAt,
      tables: sortedTables,
    };
  }

  public calculateChecksum(): string {
    const serialized = JSON.stringify(this.toJSON());
    // Simple deterministic hash function for snapshots
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  public static fromJSON(data: SchemaSnapshotData): SchemaSnapshot {
    return new SchemaSnapshot(data);
  }

  public static empty(): SchemaSnapshot {
    return new SchemaSnapshot({ tables: [] });
  }
}
