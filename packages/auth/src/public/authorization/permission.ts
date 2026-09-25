export interface PermissionDefinition {
  readonly name: string;
  readonly description?: string | undefined;
  readonly category?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export class PermissionRegistry {
  private readonly permissions = new Map<string, PermissionDefinition>();

  public register(permission: PermissionDefinition): this {
    if (this.permissions.has(permission.name)) {
      throw new Error(`Permission "${permission.name}" is already registered.`);
    }
    this.permissions.set(permission.name, Object.freeze({ ...permission }));
    return this;
  }

  public registerMany(permissions: readonly PermissionDefinition[]): this {
    for (const permission of permissions) {
      this.register(permission);
    }
    return this;
  }

  public get(name: string): PermissionDefinition | undefined {
    return this.permissions.get(name);
  }

  public has(name: string): boolean {
    return this.permissions.has(name);
  }

  public getAll(): readonly PermissionDefinition[] {
    return Object.freeze(Array.from(this.permissions.values()));
  }

  /**
   * Deterministically test if any granted permission matches the requested permission.
   * Supports exact match, superuser wildcard '*', and namespace wildcards (e.g. 'users.*' matches 'users.read').
   */
  public static matches(
    grantedPermissions: readonly string[],
    requestedPermission: string
  ): boolean {
    if (grantedPermissions.includes('*')) {
      return true;
    }
    if (grantedPermissions.includes(requestedPermission)) {
      return true;
    }

    const dotIndex = requestedPermission.indexOf('.');
    if (dotIndex !== -1) {
      const namespace = requestedPermission.slice(0, dotIndex);
      if (grantedPermissions.includes(`${namespace}.*`)) {
        return true;
      }
    }

    return false;
  }
}
