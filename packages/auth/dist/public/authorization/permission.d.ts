export interface PermissionDefinition {
    readonly name: string;
    readonly description?: string | undefined;
    readonly category?: string | undefined;
    readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
export declare class PermissionRegistry {
    private readonly permissions;
    register(permission: PermissionDefinition): this;
    registerMany(permissions: readonly PermissionDefinition[]): this;
    get(name: string): PermissionDefinition | undefined;
    has(name: string): boolean;
    getAll(): readonly PermissionDefinition[];
    /**
     * Deterministically test if any granted permission matches the requested permission.
     * Supports exact match, superuser wildcard '*', and namespace wildcards (e.g. 'users.*' matches 'users.read').
     */
    static matches(grantedPermissions: readonly string[], requestedPermission: string): boolean;
}
//# sourceMappingURL=permission.d.ts.map