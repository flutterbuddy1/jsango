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

export const relations = {
  belongsTo(
    target: (() => ModelStatic | string) | string,
    options: BelongsToOptions
  ): RelationDefinition {
    return {
      type: 'belongsTo',
      target,
      foreignKey: options.foreignKey,
      localKey: options.localKey ?? 'id',
      inverseRelation: options.inverseRelation,
      options: options.options,
    };
  },

  hasOne(
    target: (() => ModelStatic | string) | string,
    options: HasOneOptions
  ): RelationDefinition {
    return {
      type: 'hasOne',
      target,
      foreignKey: options.foreignKey,
      localKey: options.localKey ?? 'id',
      inverseRelation: options.inverseRelation,
      options: options.options,
    };
  },

  hasMany(
    target: (() => ModelStatic | string) | string,
    options: HasManyOptions
  ): RelationDefinition {
    return {
      type: 'hasMany',
      target,
      foreignKey: options.foreignKey,
      localKey: options.localKey ?? 'id',
      inverseRelation: options.inverseRelation,
      options: options.options,
    };
  },

  manyToMany(
    target: (() => ModelStatic | string) | string,
    options: ManyToManyOptions
  ): RelationDefinition {
    return {
      type: 'manyToMany',
      target,
      through: options.through,
      foreignKey: options.foreignKey,
      localKey: options.localKey ?? 'id',
      pivotForeignKey: options.pivotForeignKey,
      pivotTargetKey: options.pivotTargetKey,
      inverseRelation: options.inverseRelation,
      options: options.options,
    };
  },
} as const;
