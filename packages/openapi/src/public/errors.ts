import { DjangoJsError } from '@django-js/core';

export class OpenApiError extends DjangoJsError {
  constructor(message: string, code = 'ERR_OPENAPI_GENERAL', meta?: Record<string, unknown>) {
    super({ code, message, metadata: meta });
    this.name = 'OpenApiError';
  }
}

export class DuplicateOperationIdError extends OpenApiError {
  constructor(operationId: string, pathA: string, methodA: string, pathB: string, methodB: string) {
    super(
      `Duplicate operationId "${operationId}" detected across ${methodA} ${pathA} and ${methodB} ${pathB}.`,
      'ERR_OPENAPI_DUPLICATE_OPERATION_ID',
      {
        operationId,
        first: { path: pathA, method: methodA },
        second: { path: pathB, method: methodB },
      }
    );
    this.name = 'DuplicateOperationIdError';
  }
}

export class ConflictingSchemaError extends OpenApiError {
  constructor(name: string, reason: string) {
    super(
      `Incompatible schema definition registered for component schema "${name}": ${reason}`,
      'ERR_OPENAPI_CONFLICTING_SCHEMA',
      { schemaName: name, reason }
    );
    this.name = 'ConflictingSchemaError';
  }
}

export class InvalidOpenApiDocumentError extends OpenApiError {
  public readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super(
      `OpenAPI Document validation failed:\n - ${errors.join('\n - ')}`,
      'ERR_OPENAPI_INVALID_DOCUMENT',
      { errors }
    );
    this.name = 'InvalidOpenApiDocumentError';
    this.validationErrors = errors;
  }
}
