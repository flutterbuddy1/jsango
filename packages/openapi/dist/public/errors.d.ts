import { JsangoError } from '@jsango/core';
export declare class OpenApiError extends JsangoError {
    constructor(message: string, code?: string, meta?: Record<string, unknown>);
}
export declare class DuplicateOperationIdError extends OpenApiError {
    constructor(operationId: string, pathA: string, methodA: string, pathB: string, methodB: string);
}
export declare class ConflictingSchemaError extends OpenApiError {
    constructor(name: string, reason: string);
}
export declare class InvalidOpenApiDocumentError extends OpenApiError {
    readonly validationErrors: readonly string[];
    constructor(errors: readonly string[]);
}
//# sourceMappingURL=errors.d.ts.map