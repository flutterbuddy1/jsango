import type {
  FieldType,
  RelationType,
  IndexDefinition,
  ModelDefinitionOptions,
  ModelStatic,
  FieldDefinition,
  RelationDefinition,
} from './types.js';
import { MetadataError } from './errors.js';

export class FieldMetadata {
  public readonly name: string;
  public readonly type: FieldType;
  public readonly columnName: string;
  public readonly nullable: boolean;
  public readonly primaryKey: boolean;
  public readonly autoIncrement: boolean;
  public readonly unique: boolean;
  public readonly indexed: boolean;
  public readonly defaultValue: unknown;
  public readonly length?: number | undefined;
  public readonly precision?: number | undefined;
  public readonly scale?: number | undefined;
  public readonly comment?: string | undefined;
  public readonly options: Readonly<Record<string, unknown>>;

  constructor(
    name: string,
    config: {
      readonly type: FieldType;
      readonly columnName?: string | undefined;
      readonly nullable?: boolean | undefined;
      readonly primaryKey?: boolean | undefined;
      readonly autoIncrement?: boolean | undefined;
      readonly unique?: boolean | undefined;
      readonly indexed?: boolean | undefined;
      readonly default?: unknown;
      readonly length?: number | undefined;
      readonly precision?: number | undefined;
      readonly scale?: number | undefined;
      readonly comment?: string | undefined;
      readonly options?: Readonly<Record<string, unknown>> | undefined;
    }
  ) {
    this.name = name;
    this.type = config.type;
    this.columnName = config.columnName ?? name;
    this.nullable = config.nullable ?? false;
    this.primaryKey = config.primaryKey ?? false;
    this.autoIncrement = config.autoIncrement ?? false;
    this.unique = config.unique ?? false;
    this.indexed = config.indexed ?? false;
    this.defaultValue = config.default;
    this.length = config.length;
    this.precision = config.precision;
    this.scale = config.scale;
    this.comment = config.comment;
    this.options = Object.freeze({ ...(config.options ?? {}) });

    Object.freeze(this);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      columnName: this.columnName,
      nullable: this.nullable,
      primaryKey: this.primaryKey,
      autoIncrement: this.autoIncrement,
      unique: this.unique,
      indexed: this.indexed,
      defaultValue: typeof this.defaultValue === 'function' ? '[Function]' : this.defaultValue,
      length: this.length,
      precision: this.precision,
      scale: this.scale,
      comment: this.comment,
      options: this.options,
    };
  }
}

export class RelationMetadata {
  public readonly name: string;
  public readonly type: RelationType;
  public readonly sourceModel: string;
  public readonly foreignKey: string;
  public readonly localKey: string;
  public readonly pivotForeignKey?: string | undefined;
  public readonly pivotTargetKey?: string | undefined;
  public readonly inverseRelation?: string | undefined;
  public readonly options: Readonly<Record<string, unknown>>;
  private readonly targetResolver: (() => ModelStatic | string) | string;
  private readonly throughResolver?: (() => ModelStatic | string) | string | undefined;
  private static readonly targetCache = new WeakMap<RelationMetadata, ModelStatic>();
  private static readonly throughCache = new WeakMap<RelationMetadata, ModelStatic>();

  constructor(
    name: string,
    sourceModel: string,
    config: {
      readonly type: RelationType;
      readonly target: (() => ModelStatic | string) | string;
      readonly foreignKey: string;
      readonly localKey?: string | undefined;
      readonly through?: (() => ModelStatic | string) | string | undefined;
      readonly pivotForeignKey?: string | undefined;
      readonly pivotTargetKey?: string | undefined;
      readonly inverseRelation?: string | undefined;
      readonly options?: Readonly<Record<string, unknown>> | undefined;
    }
  ) {
    this.name = name;
    this.sourceModel = sourceModel;
    this.type = config.type;
    this.targetResolver = config.target;
    this.foreignKey = config.foreignKey;
    this.localKey = config.localKey ?? 'id';
    this.throughResolver = config.through;
    this.pivotForeignKey = config.pivotForeignKey;
    this.pivotTargetKey = config.pivotTargetKey;
    this.inverseRelation = config.inverseRelation;
    this.options = Object.freeze({ ...(config.options ?? {}) });

    Object.freeze(this);
  }

  public resolveTarget(registryLookup?: (name: string) => ModelStatic | undefined): ModelStatic {
    const cached = RelationMetadata.targetCache.get(this);
    if (cached) {
      return cached;
    }

    const resolved =
      typeof this.targetResolver === 'function' ? this.targetResolver() : this.targetResolver;
    if (typeof resolved === 'function' && 'metadata' in resolved) {
      RelationMetadata.targetCache.set(this, resolved as ModelStatic);
      return resolved as ModelStatic;
    }

    if (typeof resolved === 'string' && registryLookup) {
      const found = registryLookup(resolved);
      if (found) {
        RelationMetadata.targetCache.set(this, found);
        return found;
      }
    }

    throw new MetadataError(
      `Could not resolve target model for relation '${this.sourceModel}.${this.name}'.`
    );
  }

  public resolveThrough(
    registryLookup?: (name: string) => ModelStatic | undefined
  ): ModelStatic | undefined {
    const cached = RelationMetadata.throughCache.get(this);
    if (cached) {
      return cached;
    }
    if (!this.throughResolver) {
      return undefined;
    }

    const resolved =
      typeof this.throughResolver === 'function' ? this.throughResolver() : this.throughResolver;
    if (typeof resolved === 'function' && 'metadata' in resolved) {
      RelationMetadata.throughCache.set(this, resolved as ModelStatic);
      return resolved as ModelStatic;
    }

    if (typeof resolved === 'string' && registryLookup) {
      const found = registryLookup(resolved);
      if (found) {
        RelationMetadata.throughCache.set(this, found);
        return found;
      }
    }

    throw new MetadataError(
      `Could not resolve through model for relation '${this.sourceModel}.${this.name}'.`
    );
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      sourceModel: this.sourceModel,
      foreignKey: this.foreignKey,
      localKey: this.localKey,
      pivotForeignKey: this.pivotForeignKey,
      pivotTargetKey: this.pivotTargetKey,
      inverseRelation: this.inverseRelation,
      options: this.options,
    };
  }
}

export class IndexMetadata {
  public readonly name?: string | undefined;
  public readonly columns: readonly string[];
  public readonly unique: boolean;

  constructor(def: IndexDefinition) {
    this.name = def.name;
    this.columns = Object.freeze([...def.columns]);
    this.unique = def.unique ?? false;
    Object.freeze(this);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      columns: this.columns,
      unique: this.unique,
    };
  }
}

export interface TimestampsMetadata {
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SoftDeleteMetadata {
  readonly enabled: boolean;
  readonly deletedAt: string;
}

export class ModelMetadata {
  public readonly name: string;
  public readonly table: string;
  public readonly connection: string;
  public readonly primaryKey: string;
  public readonly fields: ReadonlyMap<string, FieldMetadata>;
  public readonly relations: ReadonlyMap<string, RelationMetadata>;
  public readonly timestamps: TimestampsMetadata;
  public readonly softDelete: SoftDeleteMetadata;
  public readonly indexes: readonly IndexMetadata[];
  public readonly options: Readonly<Record<string, unknown>>;

  private readonly columnToFieldMap: ReadonlyMap<string, string>;
  private readonly fieldToColumnMap: ReadonlyMap<string, string>;

  constructor(options: ModelDefinitionOptions) {
    this.name = options.name;
    this.table = options.table;
    this.connection = options.connection ?? 'default';

    const fieldsMap = new Map<string, FieldMetadata>();
    const colToField = new Map<string, string>();
    const fieldToCol = new Map<string, string>();

    let detectedPk: string | undefined = options.primaryKey;

    for (const [fieldName, fieldDef] of Object.entries(options.fields) as [
      string,
      FieldDefinition<unknown>,
    ][]) {
      const fieldMeta = new FieldMetadata(fieldName, fieldDef);
      fieldsMap.set(fieldName, fieldMeta);
      colToField.set(fieldMeta.columnName, fieldName);
      fieldToCol.set(fieldName, fieldMeta.columnName);

      if (fieldMeta.primaryKey && !detectedPk) {
        detectedPk = fieldName;
      }
    }

    this.primaryKey = detectedPk ?? 'id';
    this.fields = fieldsMap;
    this.columnToFieldMap = colToField;
    this.fieldToColumnMap = fieldToCol;

    const relationsMap = new Map<string, RelationMetadata>();
    if (options.relations) {
      for (const [relName, relDef] of Object.entries(options.relations) as [
        string,
        RelationDefinition,
      ][]) {
        const relMeta = new RelationMetadata(relName, this.name, relDef);
        relationsMap.set(relName, relMeta);
      }
    }
    this.relations = relationsMap;

    // Timestamps configuration
    if (typeof options.timestamps === 'boolean') {
      this.timestamps = Object.freeze({
        enabled: options.timestamps,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      });
    } else if (options.timestamps) {
      this.timestamps = Object.freeze({
        enabled: true,
        createdAt: options.timestamps.createdAt ?? 'createdAt',
        updatedAt: options.timestamps.updatedAt ?? 'updatedAt',
      });
    } else {
      this.timestamps = Object.freeze({
        enabled: false,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      });
    }

    // Soft delete configuration
    if (typeof options.softDelete === 'boolean') {
      this.softDelete = Object.freeze({
        enabled: options.softDelete,
        deletedAt: 'deletedAt',
      });
    } else if (options.softDelete) {
      this.softDelete = Object.freeze({
        enabled: true,
        deletedAt: options.softDelete.deletedAt ?? 'deletedAt',
      });
    } else {
      this.softDelete = Object.freeze({
        enabled: false,
        deletedAt: 'deletedAt',
      });
    }

    this.indexes = Object.freeze((options.indexes ?? []).map((idx) => new IndexMetadata(idx)));

    this.options = Object.freeze({ ...(options.metadata ?? {}) });

    Object.freeze(this);
  }

  public getField(name: string): FieldMetadata | undefined {
    return this.fields.get(name);
  }

  public getRelation(name: string): RelationMetadata | undefined {
    return this.relations.get(name);
  }

  public hasField(name: string): boolean {
    return this.fields.has(name);
  }

  public hasRelation(name: string): boolean {
    return this.relations.has(name);
  }

  public columnToField(column: string): string {
    return this.columnToFieldMap.get(column) ?? column;
  }

  public fieldToColumn(field: string): string {
    return this.fieldToColumnMap.get(field) ?? field;
  }

  public toJSON(): Record<string, unknown> {
    const fieldsObj: Record<string, unknown> = {};
    for (const [name, meta] of this.fields.entries()) {
      fieldsObj[name] = meta.toJSON();
    }

    const relationsObj: Record<string, unknown> = {};
    for (const [name, meta] of this.relations.entries()) {
      relationsObj[name] = meta.toJSON();
    }

    return {
      name: this.name,
      table: this.table,
      connection: this.connection,
      primaryKey: this.primaryKey,
      fields: fieldsObj,
      relations: relationsObj,
      timestamps: this.timestamps,
      softDelete: this.softDelete,
      indexes: this.indexes.map((idx) => idx.toJSON()),
      options: this.options,
    };
  }
}
