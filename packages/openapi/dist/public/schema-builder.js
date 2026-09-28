export class SchemaBuilder {
    static string(options = {}) {
        return { type: 'string', ...options };
    }
    static number(options = {}) {
        return { type: 'number', ...options };
    }
    static integer(options = {}) {
        return { type: 'integer', ...options };
    }
    static boolean(options = {}) {
        return { type: 'boolean', ...options };
    }
    static uuid(options = {}) {
        return { type: 'string', format: 'uuid', ...options };
    }
    static dateTime(options = {}) {
        return { type: 'string', format: 'date-time', ...options };
    }
    static date(options = {}) {
        return { type: 'string', format: 'date', ...options };
    }
    static email(options = {}) {
        return { type: 'string', format: 'email', ...options };
    }
    static binary(options = {}) {
        return { type: 'string', format: 'binary', ...options };
    }
    static array(items, options = {}) {
        return { type: 'array', items, ...options };
    }
    static object(properties, required = [], options = {}) {
        return {
            type: 'object',
            properties,
            ...(required.length > 0 ? { required } : {}),
            ...options,
        };
    }
    static enum(values, options = {}) {
        const type = typeof values[0] === 'number' ? 'number' : 'string';
        return { type, enum: values, ...options };
    }
    static ref(schemaName) {
        return { $ref: `#/components/schemas/${schemaName}` };
    }
    /**
     * Reusable error response schema matching framework's JsangoError / HTTP error format.
     */
    static errorResponse() {
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
     * Reusable validation error response schema matching @jsango/validation format.
     */
    static validationErrorResponse() {
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
    static paginated(itemSchema) {
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
//# sourceMappingURL=schema-builder.js.map