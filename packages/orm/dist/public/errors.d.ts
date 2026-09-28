import { JsangoError, type JsangoErrorOptions } from '@jsango/core';
export declare class OrmError extends JsangoError {
    constructor(options: JsangoErrorOptions);
}
export declare class ModelNotFoundError extends OrmError {
    readonly modelName: string;
    readonly primaryKey: unknown;
    constructor(modelName: string, primaryKey: unknown);
}
export declare class ModelValidationError extends OrmError {
    readonly modelName: string;
    readonly errors: readonly string[];
    constructor(modelName: string, message: string, errors?: readonly string[]);
}
export declare class RelationError extends OrmError {
    readonly modelName: string;
    readonly relationName: string;
    constructor(modelName: string, relationName: string, message: string);
}
export declare class MetadataError extends OrmError {
    constructor(message: string, metadata?: Record<string, unknown>);
}
export declare class QueryError extends OrmError {
    readonly querySql?: string | undefined;
    constructor(message: string, querySql?: string, cause?: unknown);
}
//# sourceMappingURL=errors.d.ts.map