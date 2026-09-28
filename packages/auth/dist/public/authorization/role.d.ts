export interface RoleDefinition {
    readonly name: string;
    readonly permissions: readonly string[];
    readonly description?: string | undefined;
    readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
export declare class RoleRegistry {
    private readonly roles;
    register(role: RoleDefinition): this;
    registerMany(roles: readonly RoleDefinition[]): this;
    get(name: string): RoleDefinition | undefined;
    has(name: string): boolean;
    getPermissionsForRole(roleName: string): readonly string[];
    getPermissionsForRoles(roleNames: readonly string[]): readonly string[];
    getAll(): readonly RoleDefinition[];
}
//# sourceMappingURL=role.d.ts.map