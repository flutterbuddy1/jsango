export interface RoleDefinition {
  readonly name: string;
  readonly permissions: readonly string[];
  readonly description?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export class RoleRegistry {
  private readonly roles = new Map<string, RoleDefinition>();

  public register(role: RoleDefinition): this {
    if (this.roles.has(role.name)) {
      throw new Error(`Role "${role.name}" is already registered.`);
    }
    this.roles.set(
      role.name,
      Object.freeze({
        ...role,
        permissions: Object.freeze([...role.permissions]),
      })
    );
    return this;
  }

  public registerMany(roles: readonly RoleDefinition[]): this {
    for (const role of roles) {
      this.register(role);
    }
    return this;
  }

  public get(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  public has(name: string): boolean {
    return this.roles.has(name);
  }

  public getPermissionsForRole(roleName: string): readonly string[] {
    const role = this.roles.get(roleName);
    return role ? role.permissions : [];
  }

  public getPermissionsForRoles(roleNames: readonly string[]): readonly string[] {
    const permissionsSet = new Set<string>();
    for (const roleName of roleNames) {
      const permissions = this.getPermissionsForRole(roleName);
      for (const p of permissions) {
        permissionsSet.add(p);
      }
    }
    return Object.freeze(Array.from(permissionsSet));
  }

  public getAll(): readonly RoleDefinition[] {
    return Object.freeze(Array.from(this.roles.values()));
  }
}
