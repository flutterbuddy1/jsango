import type { FieldType, RelationType, IndexDefinition, ModelDefinitionOptions, ModelStatic } from './types.js';
export declare class FieldMetadata {
    readonly name: string;
    readonly type: FieldType;
    readonly columnName: string;
    readonly nullable: boolean;
    readonly primaryKey: boolean;
    readonly autoIncrement: boolean;
    readonly unique: boolean;
    readonly indexed: boolean;
    readonly defaultValue: unknown;
    readonly length?: number | undefined;
    readonly precision?: number | undefined;
    readonly scale?: number | undefined;
    readonly comment?: string | undefined;
    readonly options: Readonly<Record<string, unknown>>;
    constructor(name: string, config: {
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
    });
    toJSON(): Record<string, unknown>;
}
export declare class RelationMetadata {
    readonly name: string;
    readonly type: RelationType;
    readonly sourceModel: string;
    readonly foreignKey: string;
    readonly localKey: string;
    readonly pivotForeignKey?: string | undefined;
    readonly pivotTargetKey?: string | undefined;
    readonly inverseRelation?: string | undefined;
    readonly options: Readonly<Record<string, unknown>>;
    private readonly targetResolver;
    private readonly throughResolver?;
    private static readonly targetCache;
    private static readonly throughCache;
    constructor(name: string, sourceModel: string, config: {
        readonly type: RelationType;
        readonly target: (() => ModelStatic | string) | string;
        readonly foreignKey: string;
        readonly localKey?: string | undefined;
        readonly through?: (() => ModelStatic | string) | string | undefined;
        readonly pivotForeignKey?: string | undefined;
        readonly pivotTargetKey?: string | undefined;
        readonly inverseRelation?: string | undefined;
        readonly options?: Readonly<Record<string, unknown>> | undefined;
    });
    resolveTarget(registryLookup?: (name: string) => ModelStatic | undefined): ModelStatic;
    resolveThrough(registryLookup?: (name: string) => ModelStatic | undefined): ModelStatic | undefined;
    toJSON(): Record<string, unknown>;
}
export declare class IndexMetadata {
    readonly name?: string | undefined;
    readonly columns: readonly string[];
    readonly unique: boolean;
    constructor(def: IndexDefinition);
    toJSON(): Record<string, unknown>;
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
export declare class ModelMetadata {
    readonly name: string;
    readonly table: string;
    readonly connection: string;
    readonly primaryKey: string;
    readonly fields: ReadonlyMap<string, FieldMetadata>;
    readonly relations: ReadonlyMap<string, RelationMetadata>;
    readonly timestamps: TimestampsMetadata;
    readonly softDelete: SoftDeleteMetadata;
    readonly indexes: readonly IndexMetadata[];
    readonly options: Readonly<Record<string, unknown>>;
    private readonly columnToFieldMap;
    private readonly fieldToColumnMap;
    constructor(options: ModelDefinitionOptions);
    getField(name: string): FieldMetadata | undefined;
    getRelation(name: string): RelationMetadata | undefined;
    hasField(name: string): boolean;
    hasRelation(name: string): boolean;
    columnToField(column: string): string;
    fieldToColumn(field: string): string;
    toJSON(): Record<string, unknown>;
}
//# sourceMappingURL=metadata.d.ts.map