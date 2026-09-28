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
export declare abstract class BaseIdentity implements Identity {
    readonly id: string;
    readonly type: IdentityType;
    readonly isAuthenticated: boolean;
    readonly isSuperuser: boolean;
    readonly roles: readonly string[];
    readonly permissions: readonly string[];
    readonly tenantId?: string | undefined;
    readonly metadata: Readonly<Record<string, unknown>>;
    constructor(options: IdentityOptions);
    hasRole(role: string): boolean;
    hasPermission(permission: string): boolean;
    toJSON(): Record<string, unknown>;
}
export declare class UserIdentity extends BaseIdentity {
    constructor(options: Omit<IdentityOptions, 'isAuthenticated' | 'type'> & {
        type?: IdentityType;
    });
}
export declare class AnonymousIdentity extends BaseIdentity {
    constructor();
}
export declare class SystemIdentity extends BaseIdentity {
    constructor(options?: Partial<Omit<IdentityOptions, 'id' | 'type' | 'isAuthenticated' | 'isSuperuser'>>);
}
export declare class ServiceAccountIdentity extends BaseIdentity {
    constructor(options: Omit<IdentityOptions, 'isAuthenticated' | 'type'>);
}
//# sourceMappingURL=identity.d.ts.map