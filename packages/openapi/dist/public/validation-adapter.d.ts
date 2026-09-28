import type { OpenApiSchema } from './types.js';
export interface ValidationSchemaDescriptor {
    readonly type?: string | undefined;
    readonly format?: string | undefined;
    readonly required?: readonly string[] | boolean | undefined;
    readonly properties?: Record<string, ValidationSchemaDescriptor> | undefined;
    readonly items?: ValidationSchemaDescriptor | undefined;
    readonly enum?: readonly unknown[] | undefined;
    readonly minimum?: number | undefined;
    readonly maximum?: number | undefined;
    readonly minLength?: number | undefined;
    readonly maxLength?: number | undefined;
    readonly pattern?: string | undefined;
    readonly description?: string | undefined;
    readonly default?: unknown;
    readonly nullable?: boolean | undefined;
}
export declare class ValidationAdapter {
    /**
     * Converts validation descriptor/metadata into a valid OpenApiSchema.
     */
    static toOpenApiSchema(descriptor: ValidationSchemaDescriptor | unknown): OpenApiSchema;
}
//# sourceMappingURL=validation-adapter.d.ts.map