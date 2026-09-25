import type { Identity, AuthContext, PolicyResult, IPolicy } from '../types.js';

export abstract class BasePolicy<TResource = unknown> implements IPolicy<TResource> {
  public abstract readonly name: string;

  /**
   * Evaluates if the given action is allowed for this identity and resource.
   * By default, it dispatches to a method named after the action (e.g., `view`, `update`, `delete`).
   * If no matching method exists, it defaults to `false` (fail-closed).
   */
  public async can(
    identity: Identity,
    action: string,
    resource?: TResource,
    context?: AuthContext
  ): Promise<PolicyResult> {
    const handler = (this as unknown as Record<string, unknown>)[action];
    if (typeof handler === 'function') {
      return handler.call(this, identity, resource, context);
    }
    return false;
  }
}

export type TargetConstructor =
  | (new (...args: unknown[]) => unknown)
  | (abstract new (...args: unknown[]) => unknown)
  | ((...args: unknown[]) => unknown);

export class PolicyRegistry {
  private readonly policiesByName = new Map<string, IPolicy>();
  private readonly policiesByTarget = new Map<unknown, IPolicy>();

  public register(policy: IPolicy): this {
    this.policiesByName.set(policy.name, policy);
    return this;
  }

  public registerFor(target: string | TargetConstructor, policy: IPolicy): this {
    this.policiesByName.set(policy.name, policy);
    this.policiesByTarget.set(target, policy);
    return this;
  }

  public getByName(name: string): IPolicy | undefined {
    return this.policiesByName.get(name);
  }

  public getForTarget(target: string | TargetConstructor): IPolicy | undefined {
    return this.policiesByTarget.get(target);
  }

  /**
   * Resolves a policy for a resource instance or model constructor/name.
   * Inspects:
   * 1. Exact target match in registered targets
   * 2. Constructor match in registered targets
   * 3. ModelMetadata name (`constructor.metadata.name` or `constructor.modelName`)
   * 4. String name match
   */
  public resolvePolicy(resource: unknown): IPolicy | undefined {
    if (resource === undefined || resource === null) {
      return undefined;
    }

    // 1. Direct target match
    const direct = this.policiesByTarget.get(resource);
    if (direct) {
      return direct;
    }

    // 2. If resource is a string name
    if (typeof resource === 'string') {
      const byName = this.policiesByName.get(resource) ?? this.policiesByTarget.get(resource);
      if (byName) {
        return byName;
      }
    }

    // 3. If resource is an object with a constructor
    if (typeof resource === 'object') {
      const ctor = (resource as { constructor?: unknown }).constructor;
      if (ctor && typeof ctor === 'function') {
        const byCtor = this.policiesByTarget.get(ctor);
        if (byCtor) {
          return byCtor;
        }

        // Inspect Phase 6 ModelMetadata stable identity
        const meta = (ctor as { metadata?: { name?: string }; modelName?: string }).metadata;
        const modelName = meta?.name ?? (ctor as { modelName?: string }).modelName;
        if (modelName) {
          const byModelName =
            this.policiesByTarget.get(modelName) ?? this.policiesByName.get(modelName);
          if (byModelName) {
            return byModelName;
          }
        }

        // Inspect object type hints ($type, resourceType, modelName)
        const obj = resource as Record<string, unknown>;
        const typeHint =
          (typeof obj['$type'] === 'string' ? (obj['$type'] as string) : undefined) ??
          (typeof obj['resourceType'] === 'string' ? (obj['resourceType'] as string) : undefined) ??
          (typeof obj['modelName'] === 'string' ? (obj['modelName'] as string) : undefined);
        if (typeHint) {
          const byHint = this.policiesByTarget.get(typeHint) ?? this.policiesByName.get(typeHint);
          if (byHint) {
            return byHint;
          }
        }
      }
    }

    return undefined;
  }

  public getAll(): readonly IPolicy[] {
    return Object.freeze(Array.from(this.policiesByName.values()));
  }
}
