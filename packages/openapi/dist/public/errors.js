import { JsangoError } from '@jsango/core';
export class OpenApiError extends JsangoError {
    constructor(message, code = 'ERR_OPENAPI_GENERAL', meta) {
        super({ code, message, metadata: meta });
        this.name = 'OpenApiError';
    }
}
export class DuplicateOperationIdError extends OpenApiError {
    constructor(operationId, pathA, methodA, pathB, methodB) {
        super(`Duplicate operationId "${operationId}" detected across ${methodA} ${pathA} and ${methodB} ${pathB}.`, 'ERR_OPENAPI_DUPLICATE_OPERATION_ID', {
            operationId,
            first: { path: pathA, method: methodA },
            second: { path: pathB, method: methodB },
        });
        this.name = 'DuplicateOperationIdError';
    }
}
export class ConflictingSchemaError extends OpenApiError {
    constructor(name, reason) {
        super(`Incompatible schema definition registered for component schema "${name}": ${reason}`, 'ERR_OPENAPI_CONFLICTING_SCHEMA', { schemaName: name, reason });
        this.name = 'ConflictingSchemaError';
    }
}
export class InvalidOpenApiDocumentError extends OpenApiError {
    validationErrors;
    constructor(errors) {
        super(`OpenAPI Document validation failed:\n - ${errors.join('\n - ')}`, 'ERR_OPENAPI_INVALID_DOCUMENT', { errors });
        this.name = 'InvalidOpenApiDocumentError';
        this.validationErrors = errors;
    }
}
//# sourceMappingURL=errors.js.map