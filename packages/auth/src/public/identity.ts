import type { Identity, IdentityType } from './types.js';

export interface IdentityOptions {
  readonly id: string;
  readonly type?: IdentityType | undefined;
  readonly isAuthenticated?: boolean | undefined;
  readonly isSuperuser?: boolean | undefined;
  readonly roles?: readonly string[] | undefined;
  readonly permissions?: readonly string[] | undefined;
  readonly tenantId?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export abstract class BaseIdentity implements Identity {
  public readonly id: string;
  public readonly type: IdentityType;
  public readonly isAuthenticated: boolean;
  public readonly isSuperuser: boolean;
  public readonly roles: readonly string[];
  public readonly permissions: readonly string[];
  public readonly tenantId?: string | undefined;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: IdentityOptions) {
    this.id = options.id;
    this.type = options.type ?? 'user';
    this.isAuthenticated = options.isAuthenticated ?? false;
    this.isSuperuser = options.isSuperuser ?? false;
    this.roles = Object.freeze([...(options.roles ?? [])]);
    this.permissions = Object.freeze([...(options.permissions ?? [])]);
    this.tenantId = options.tenantId;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }

  public hasRole(role: string): boolean {
    if (this.isSuperuser) {
      return true;
    }
    return this.roles.includes(role);
  }

  public hasPermission(permission: string): boolean {
    if (this.isSuperuser) {
      return true;
    }
    if (this.permissions.includes('*')) {
      return true;
    }
    if (this.permissions.includes(permission)) {
      return true;
    }

    // Wildcard matching: e.g. "users.*" matches "users.read"
    const dotIndex = permission.indexOf('.');
    if (dotIndex !== -1) {
      const namespace = permission.slice(0, dotIndex);
      if (this.permissions.includes(`${namespace}.*`)) {
        return true;
      }
    }

    return false;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      isAuthenticated: this.isAuthenticated,
      isSuperuser: this.isSuperuser,
      roles: this.roles,
      permissions: this.permissions,
      tenantId: this.tenantId,
      metadata: this.metadata,
    };
  }
}

export class UserIdentity extends BaseIdentity {
  public constructor(
    options: Omit<IdentityOptions, 'isAuthenticated' | 'type'> & { type?: IdentityType }
  ) {
    super({
      ...options,
      type: options.type ?? 'user',
      isAuthenticated: true,
    });
  }
}

export class AnonymousIdentity extends BaseIdentity {
  public constructor() {
    super({
      id: 'anonymous',
      type: 'anonymous',
      isAuthenticated: false,
      isSuperuser: false,
      roles: [],
      permissions: [],
    });
  }
}

export class SystemIdentity extends BaseIdentity {
  public constructor(
    options: Partial<Omit<IdentityOptions, 'id' | 'type' | 'isAuthenticated' | 'isSuperuser'>> = {}
  ) {
    super({
      ...options,
      id: 'system',
      type: 'system',
      isAuthenticated: true,
      isSuperuser: true,
      roles: ['system'],
      permissions: ['*'],
    });
  }
}

export class ServiceAccountIdentity extends BaseIdentity {
  public constructor(options: Omit<IdentityOptions, 'isAuthenticated' | 'type'>) {
    super({
      ...options,
      type: 'service_account',
      isAuthenticated: true,
    });
  }
}
