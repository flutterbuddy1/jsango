export class BasePolicy {
    /**
     * Evaluates if the given action is allowed for this identity and resource.
     * By default, it dispatches to a method named after the action (e.g., `view`, `update`, `delete`).
     * If no matching method exists, it defaults to `false` (fail-closed).
     */
    async can(identity, action, resource, context) {
        const handler = this[action];
        if (typeof handler === 'function') {
            return handler.call(this, identity, resource, context);
        }
        return false;
    }
}
export class PolicyRegistry {
    policiesByName = new Map();
    policiesByTarget = new Map();
    register(policy) {
        this.policiesByName.set(policy.name, policy);
        return this;
    }
    registerFor(target, policy) {
        this.policiesByName.set(policy.name, policy);
        this.policiesByTarget.set(target, policy);
        return this;
    }
    getByName(name) {
        return this.policiesByName.get(name);
    }
    getForTarget(target) {
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
    resolvePolicy(resource) {
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
            const ctor = resource.constructor;
            if (ctor && typeof ctor === 'function') {
                const byCtor = this.policiesByTarget.get(ctor);
                if (byCtor) {
                    return byCtor;
                }
                // Inspect Phase 6 ModelMetadata stable identity
                const meta = ctor.metadata;
                const modelName = meta?.name ?? ctor.modelName;
                if (modelName) {
                    const byModelName = this.policiesByTarget.get(modelName) ?? this.policiesByName.get(modelName);
                    if (byModelName) {
                        return byModelName;
                    }
                }
                // Inspect object type hints ($type, resourceType, modelName)
                const obj = resource;
                const typeHint = (typeof obj['$type'] === 'string' ? obj['$type'] : undefined) ??
                    (typeof obj['resourceType'] === 'string' ? obj['resourceType'] : undefined) ??
                    (typeof obj['modelName'] === 'string' ? obj['modelName'] : undefined);
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
    getAll() {
        return Object.freeze(Array.from(this.policiesByName.values()));
    }
}
//# sourceMappingURL=policy.js.map