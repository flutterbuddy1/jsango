import type { Identity, AuthContext, PolicyResult, IPolicy } from '../types.js';
export declare abstract class BasePolicy<TResource = unknown> implements IPolicy<TResource> {
    abstract readonly name: string;
    /**
     * Evaluates if the given action is allowed for this identity and resource.
     * By default, it dispatches to a method named after the action (e.g., `view`, `update`, `delete`).
     * If no matching method exists, it defaults to `false` (fail-closed).
     */
    can(identity: Identity, action: string, resource?: TResource, context?: AuthContext): Promise<PolicyResult>;
}
export type TargetConstructor = (new (...args: unknown[]) => unknown) | (abstract new (...args: unknown[]) => unknown) | ((...args: unknown[]) => unknown);
export declare class PolicyRegistry {
    private readonly policiesByName;
    private readonly policiesByTarget;
    register(policy: IPolicy): this;
    registerFor(target: string | TargetConstructor, policy: IPolicy): this;
    getByName(name: string): IPolicy | undefined;
    getForTarget(target: string | TargetConstructor): IPolicy | undefined;
    /**
     * Resolves a policy for a resource instance or model constructor/name.
     * Inspects:
     * 1. Exact target match in registered targets
     * 2. Constructor match in registered targets
     * 3. ModelMetadata name (`constructor.metadata.name` or `constructor.modelName`)
     * 4. String name match
     */
    resolvePolicy(resource: unknown): IPolicy | undefined;
    getAll(): readonly IPolicy[];
}
//# sourceMappingURL=policy.d.ts.map