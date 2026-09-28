import type { RelationDefinition, ModelStatic } from './types.js';
export interface BelongsToOptions {
    readonly foreignKey: string;
    readonly localKey?: string | undefined;
    readonly inverseRelation?: string | undefined;
    readonly options?: Readonly<Record<string, unknown>> | undefined;
}
export interface HasOneOptions {
    readonly foreignKey: string;
    readonly localKey?: string | undefined;
    readonly inverseRelation?: string | undefined;
    readonly options?: Readonly<Record<string, unknown>> | undefined;
}
export interface HasManyOptions {
    readonly foreignKey: string;
    readonly localKey?: string | undefined;
    readonly inverseRelation?: string | undefined;
    readonly options?: Readonly<Record<string, unknown>> | undefined;
}
export interface ManyToManyOptions {
    readonly through: (() => ModelStatic | string) | string;
    readonly foreignKey: string;
    readonly localKey?: string | undefined;
    readonly pivotForeignKey?: string | undefined;
    readonly pivotTargetKey?: string | undefined;
    readonly inverseRelation?: string | undefined;
    readonly options?: Readonly<Record<string, unknown>> | undefined;
}
export declare const relations: {
    readonly belongsTo: (target: (() => ModelStatic | string) | string, options: BelongsToOptions) => RelationDefinition;
    readonly hasOne: (target: (() => ModelStatic | string) | string, options: HasOneOptions) => RelationDefinition;
    readonly hasMany: (target: (() => ModelStatic | string) | string, options: HasManyOptions) => RelationDefinition;
    readonly manyToMany: (target: (() => ModelStatic | string) | string, options: ManyToManyOptions) => RelationDefinition;
};
//# sourceMappingURL=relations.d.ts.map