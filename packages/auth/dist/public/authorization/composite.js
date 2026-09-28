import { AuthDecision } from './decision.js';
function toDecision(result, policyName) {
    if (typeof result === 'boolean') {
        return result
            ? AuthDecision.allow('Policy allowed action.', policyName)
            : AuthDecision.deny(`Access denied by policy "${policyName}".`, policyName);
    }
    return new AuthDecision(result.allowed, result.reason, result.policy ?? policyName, result.metadata);
}
export class AndPolicy {
    name;
    policies;
    constructor(...policies) {
        if (policies.length === 0) {
            throw new Error('AndPolicy requires at least one policy.');
        }
        this.policies = Object.freeze([...policies]);
        this.name = `(${this.policies.map((p) => p.name).join(' AND ')})`;
    }
    async can(identity, action, resource, context) {
        for (const policy of this.policies) {
            const res = await policy.can(identity, action, resource, context);
            const decision = toDecision(res, policy.name);
            if (!decision.allowed) {
                return AuthDecision.deny(decision.reason ?? `Access denied by policy "${policy.name}" in composite AND.`, this.name, decision.metadata);
            }
        }
        return AuthDecision.allow('All composite AND policies satisfied.', this.name);
    }
}
export class OrPolicy {
    name;
    policies;
    constructor(...policies) {
        if (policies.length === 0) {
            throw new Error('OrPolicy requires at least one policy.');
        }
        this.policies = Object.freeze([...policies]);
        this.name = `(${this.policies.map((p) => p.name).join(' OR ')})`;
    }
    async can(identity, action, resource, context) {
        let lastDenial;
        for (const policy of this.policies) {
            const res = await policy.can(identity, action, resource, context);
            const decision = toDecision(res, policy.name);
            if (decision.allowed) {
                return AuthDecision.allow(decision.reason ?? `Access granted by policy "${policy.name}" in composite OR.`, this.name, decision.metadata);
            }
            lastDenial = decision;
        }
        return AuthDecision.deny(lastDenial?.reason ?? 'None of the composite OR policies were satisfied.', this.name, lastDenial?.metadata);
    }
}
export class NotPolicy {
    name;
    policy;
    constructor(policy) {
        this.policy = policy;
        this.name = `(NOT ${policy.name})`;
    }
    async can(identity, action, resource, context) {
        const res = await this.policy.can(identity, action, resource, context);
        const decision = toDecision(res, this.policy.name);
        if (decision.allowed) {
            return AuthDecision.deny(`Access denied by NOT policy inversion of "${this.policy.name}".`, this.name);
        }
        return AuthDecision.allow(`Access allowed by NOT policy inversion of "${this.policy.name}".`, this.name);
    }
}
export function andPolicy(...policies) {
    return new AndPolicy(...policies);
}
export function orPolicy(...policies) {
    return new OrPolicy(...policies);
}
export function notPolicy(policy) {
    return new NotPolicy(policy);
}
//# sourceMappingURL=composite.js.map