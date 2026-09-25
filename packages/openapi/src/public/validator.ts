import type { OpenApiDocument } from './types.js';
import { InvalidOpenApiDocumentError } from './errors.js';

export class OpenApiValidator {
  /**
   * Validates an OpenApiDocument.
   * Returns an array of validation error messages (empty if valid).
   */
  public static validate(doc: OpenApiDocument): string[] {
    const errors: string[] = [];

    if (!doc.openapi) {
      errors.push('Missing required top-level "openapi" version string.');
    }

    if (!doc.info) {
      errors.push('Missing required top-level "info" object.');
    } else {
      if (!doc.info.title) errors.push('Missing required "info.title".');
      if (!doc.info.version) errors.push('Missing required "info.version".');
    }

    if (!doc.paths || typeof doc.paths !== 'object') {
      errors.push('Missing required top-level "paths" object.');
      return errors;
    }

    const operationIds = new Set<string>();

    for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
      if (!pathKey.startsWith('/')) {
        errors.push(`Path "${pathKey}" must start with a forward slash "/".`);
      }

      // Extract path parameter names from `{param}`
      const pathParamMatches = Array.from(pathKey.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map(
        (m) => m[1]
      );

      const methods = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'options',
        'head',
        'trace',
      ] as const;
      for (const method of methods) {
        const op = pathItem[method];
        if (!op) continue;

        if (op.operationId) {
          if (operationIds.has(op.operationId)) {
            errors.push(
              `Duplicate operationId "${op.operationId}" found in ${method.toUpperCase()} ${pathKey}.`
            );
          }
          operationIds.add(op.operationId);
        }

        if (!op.responses || Object.keys(op.responses).length === 0) {
          errors.push(
            `Operation ${method.toUpperCase()} ${pathKey} must define at least one response in "responses".`
          );
        }

        // Verify required path parameters
        const opParams = [...(pathItem.parameters ?? []), ...(op.parameters ?? [])];
        for (const paramName of pathParamMatches) {
          const found = opParams.find((p) => p.in === 'path' && p.name === paramName);
          if (!found) {
            errors.push(
              `Path "${pathKey}" defines parameter "{${paramName}}" but operation ${method.toUpperCase()} does not define a matching path parameter.`
            );
          } else if (!found.required) {
            errors.push(
              `Path parameter "${paramName}" in ${method.toUpperCase()} ${pathKey} must have "required: true".`
            );
          }
        }
      }
    }

    // Verify component $ref references
    const availableSchemas = new Set(Object.keys(doc.components?.schemas ?? {}));
    this.validateRefs(doc, availableSchemas, errors);

    return errors;
  }

  /**
   * Asserts that an OpenApiDocument is valid, throwing InvalidOpenApiDocumentError if not.
   */
  public static assertValid(doc: OpenApiDocument): void {
    const errors = this.validate(doc);
    if (errors.length > 0) {
      throw new InvalidOpenApiDocumentError(errors);
    }
  }

  private static validateRefs(obj: unknown, availableSchemas: Set<string>, errors: string[]): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.validateRefs(item, availableSchemas, errors);
      }
      return;
    }

    const record = obj as Record<string, unknown>;
    if (typeof record['$ref'] === 'string') {
      const ref = record['$ref'];
      const prefix = '#/components/schemas/';
      if (ref.startsWith(prefix)) {
        const schemaName = ref.slice(prefix.length);
        if (!availableSchemas.has(schemaName)) {
          errors.push(`Unresolved component schema reference: "${ref}".`);
        }
      }
    }

    for (const value of Object.values(record)) {
      this.validateRefs(value, availableSchemas, errors);
    }
  }
}
