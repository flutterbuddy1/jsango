import type { OpenApiSchema } from './types.js';
export declare class SchemaBuilder {
    static string(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static number(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static integer(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static boolean(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static uuid(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static dateTime(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static date(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static email(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static binary(options?: Partial<OpenApiSchema>): OpenApiSchema;
    static array(items: OpenApiSchema, options?: Partial<OpenApiSchema>): OpenApiSchema;
    static object(properties: Record<string, OpenApiSchema>, required?: readonly string[], options?: Partial<OpenApiSchema>): OpenApiSchema;
    static enum(values: readonly unknown[], options?: Partial<OpenApiSchema>): OpenApiSchema;
    static ref(schemaName: string): OpenApiSchema;
    /**
     * Reusable error response schema matching framework's JsangoError / HTTP error format.
     */
    static errorResponse(): OpenApiSchema;
    /**
     * Reusable validation error response schema matching @jsango/validation format.
     */
    static validationErrorResponse(): OpenApiSchema;
    /**
     * Standard paginated response schema.
     */
    static paginated(itemSchema: OpenApiSchema): OpenApiSchema;
}
//# sourceMappingURL=schema-builder.d.ts.map