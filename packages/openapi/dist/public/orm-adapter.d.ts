import type { OpenApiSchema } from './types.js';
export interface ModelFieldDescriptor {
    readonly name: string;
    readonly type: string;
    readonly nullable?: boolean | undefined;
    readonly primaryKey?: boolean | undefined;
    readonly autoIncrement?: boolean | undefined;
    readonly defaultValue?: unknown;
}
export interface ModelMetadataDescriptor {
    readonly name: string;
    readonly tableName?: string | undefined;
    readonly primaryKey?: string | undefined;
    readonly fields: readonly ModelFieldDescriptor[];
}
export declare class OrmAdapter {
    /**
     * Generates a component schema for an ORM model representation.
     */
    static toModelSchema(model: ModelMetadataDescriptor): OpenApiSchema;
    /**
     * Generates a component schema for creating a new record of the model.
     * Auto-incrementing or readonly primary keys are excluded or made optional.
     */
    static toCreateInputSchema(model: ModelMetadataDescriptor): OpenApiSchema;
    private static fieldToSchema;
}
//# sourceMappingURL=orm-adapter.d.ts.map