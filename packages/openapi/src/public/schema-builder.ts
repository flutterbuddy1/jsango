import type { OpenApiSchema } from './types.js';

export class SchemaBuilder {
  public static string(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'string', ...options };
  }

  public static number(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'number', ...options };
  }

  public static integer(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'integer', ...options };
  }

  public static boolean(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'boolean', ...options };
  }

  public static uuid(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'string', format: 'uuid', ...options };
  }

  public static dateTime(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'string', format: 'date-time', ...options };
  }

  public static date(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'string', format: 'date', ...options };
  }

  public static email(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'string', format: 'email', ...options };
  }

  public static binary(options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'string', format: 'binary', ...options };
  }

  public static array(items: OpenApiSchema, options: Partial<OpenApiSchema> = {}): OpenApiSchema {
    return { type: 'array', items, ...options };
  }

  public static object(
    properties: Record<string, OpenApiSchema>,
    required: readonly string[] = [],
    options: Partial<OpenApiSchema> = {}
  ): OpenApiSchema {
    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
      ...options,
    };
  }

  public static enum(
    values: readonly unknown[],
    options: Partial<OpenApiSchema> = {}
  ): OpenApiSchema {
    const type = typeof values[0] === 'number' ? 'number' : 'string';
    return { type, enum: values, ...options };
  }

  public static ref(schemaName: string): OpenApiSchema {
    return { $ref: `#/components/schemas/${schemaName}` };
  }

  /**
   * Reusable error response schema matching framework's DjangoJsError / HTTP error format.
   */
  public static errorResponse(): OpenApiSchema {
    return {
      type: 'object',
      required: ['ok', 'error'],
      properties: {
        ok: { type: 'boolean', example: false },
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string', example: 'ERR_NOT_FOUND' },
            message: { type: 'string', example: 'Resource not found' },
            meta: { type: 'object', additionalProperties: true },
          },
        },
      },
    };
  }

  /**
   * Reusable validation error response schema matching @django-js/validation format.
   */
  public static validationErrorResponse(): OpenApiSchema {
    return {
      type: 'object',
      required: ['ok', 'error'],
      properties: {
        ok: { type: 'boolean', example: false },
        error: {
          type: 'object',
          required: ['code', 'message', 'errors'],
          properties: {
            code: { type: 'string', example: 'ERR_VALIDATION' },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                required: ['field', 'message'],
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address format' },
                  code: { type: 'string', example: 'invalid_email' },
                },
              },
            },
          },
        },
      },
    };
  }

  /**
   * Standard paginated response schema.
   */
  public static paginated(itemSchema: OpenApiSchema): OpenApiSchema {
    return {
      type: 'object',
      required: ['items', 'total', 'page', 'pageSize', 'totalPages'],
      properties: {
        items: { type: 'array', items: itemSchema },
        total: { type: 'integer', minimum: 0 },
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1 },
        totalPages: { type: 'integer', minimum: 0 },
      },
    };
  }
}
