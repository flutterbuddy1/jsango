import type { OpenApiPaths } from './types.js';
export interface AdminFieldDescriptor {
    readonly name: string;
    readonly type: string;
    readonly label?: string | undefined;
    readonly readonly?: boolean | undefined;
    readonly required?: boolean | undefined;
}
export interface AdminResourceDescriptor {
    readonly id: string;
    readonly label: string;
    readonly pluralLabel?: string | undefined;
    readonly primaryKey?: string | undefined;
    readonly listFields?: readonly string[] | undefined;
    readonly createFields?: readonly string[] | undefined;
    readonly editFields?: readonly string[] | undefined;
    readonly searchFields?: readonly string[] | undefined;
    readonly fields: readonly AdminFieldDescriptor[];
}
export declare class AdminAdapter {
    /**
     * Generates OpenAPI paths for an Admin resource with explicit 'Admin: <Resource>' tagging.
     */
    static generateResourcePaths(resource: AdminResourceDescriptor, prefix?: string): OpenApiPaths;
}
//# sourceMappingURL=admin-adapter.d.ts.map