import type { Identity, AuthContext, PolicyResult, IPolicy } from '../types.js';
export declare class AndPolicy<TResource = unknown> implements IPolicy<TResource> {
    readonly name: string;
    private readonly policies;
    constructor(...policies: readonly IPolicy<TResource>[]);
    can(identity: Identity, action: string, resource?: TResource, context?: AuthContext): Promise<PolicyResult>;
}
export declare class OrPolicy<TResource = unknown> implements IPolicy<TResource> {
    readonly name: string;
    private readonly policies;
    constructor(...policies: readonly IPolicy<TResource>[]);
    can(identity: Identity, action: string, resource?: TResource, context?: AuthContext): Promise<PolicyResult>;
}
export declare class NotPolicy<TResource = unknown> implements IPolicy<TResource> {
    readonly name: string;
    private readonly policy;
    constructor(policy: IPolicy<TResource>);
    can(identity: Identity, action: string, resource?: TResource, context?: AuthContext): Promise<PolicyResult>;
}
export declare function andPolicy<TResource = unknown>(...policies: readonly IPolicy<TResource>[]): IPolicy<TResource>;
export declare function orPolicy<TResource = unknown>(...policies: readonly IPolicy<TResource>[]): IPolicy<TResource>;
export declare function notPolicy<TResource = unknown>(policy: IPolicy<TResource>): IPolicy<TResource>;
//# sourceMappingURL=composite.d.ts.map