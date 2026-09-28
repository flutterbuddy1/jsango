import { SchemaBuilder } from './schema-builder.js';
export class AdminAdapter {
    /**
     * Generates OpenAPI paths for an Admin resource with explicit 'Admin: <Resource>' tagging.
     */
    static generateResourcePaths(resource, prefix = '/admin/api/v1') {
        const paths = {};
        const tag = `Admin: ${resource.pluralLabel ?? resource.label}`;
        const pk = resource.primaryKey ?? 'id';
        const basePath = `${prefix}/resources/${resource.id}`;
        const itemPath = `${basePath}/{${pk}}`;
        const modelSchema = {
            type: 'object',
            properties: Object.fromEntries(resource.fields.map((f) => [f.name, { type: 'string', description: f.label ?? f.name }])),
        };
        const queryParams = [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'sort', in: 'query', schema: { type: 'string' } },
            { name: 'sortDirection', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ];
        // List & Create Path
        paths[basePath] = {
            get: {
                tags: [tag],
                summary: `List ${resource.pluralLabel ?? resource.label}`,
                operationId: `admin_list_${resource.id}`,
                parameters: queryParams,
                responses: {
                    '200': {
                        description: 'Paginated list of records',
                        content: {
                            'application/json': {
                                schema: SchemaBuilder.paginated(modelSchema),
                            },
                        },
                    },
                    '403': { description: 'Forbidden — Staff access required' },
                },
            },
            post: {
                tags: [tag],
                summary: `Create a ${resource.label}`,
                operationId: `admin_create_${resource.id}`,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: modelSchema,
                        },
                    },
                },
                responses: {
                    '201': {
                        description: `${resource.label} created successfully`,
                        content: { 'application/json': { schema: modelSchema } },
                    },
                    '403': { description: 'Forbidden — Create permission required' },
                    '422': { description: 'Validation error' },
                },
            },
        };
        // Detail, Update, Delete Path
        const pkParam = {
            name: pk,
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: `Primary key of the ${resource.label}`,
        };
        paths[itemPath] = {
            get: {
                tags: [tag],
                summary: `Get ${resource.label} by ID`,
                operationId: `admin_get_${resource.id}`,
                parameters: [pkParam],
                responses: {
                    '200': {
                        description: `${resource.label} details`,
                        content: { 'application/json': { schema: modelSchema } },
                    },
                    '404': { description: 'Record not found' },
                },
            },
            patch: {
                tags: [tag],
                summary: `Update ${resource.label}`,
                operationId: `admin_update_${resource.id}`,
                parameters: [pkParam],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': { schema: modelSchema },
                    },
                },
                responses: {
                    '200': {
                        description: `${resource.label} updated successfully`,
                        content: { 'application/json': { schema: modelSchema } },
                    },
                    '404': { description: 'Record not found' },
                    '422': { description: 'Validation error' },
                },
            },
            delete: {
                tags: [tag],
                summary: `Delete ${resource.label}`,
                operationId: `admin_delete_${resource.id}`,
                parameters: [pkParam],
                responses: {
                    '204': { description: `${resource.label} deleted successfully` },
                    '404': { description: 'Record not found' },
                },
            },
        };
        return paths;
    }
}
//# sourceMappingURL=admin-adapter.js.map