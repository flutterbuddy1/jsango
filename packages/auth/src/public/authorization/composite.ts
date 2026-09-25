import type { Identity, AuthContext, PolicyResult, IPolicy } from '../types.js';
import { AuthDecision } from './decision.js';

function toDecision(result: PolicyResult, policyName: string): AuthDecision {
  if (typeof result === 'boolean') {
    return result
      ? AuthDecision.allow('Policy allowed action.', policyName)
      : AuthDecision.deny(`Access denied by policy "${policyName}".`, policyName);
  }
  return new AuthDecision(
    result.allowed,
    result.reason,
    result.policy ?? policyName,
    result.metadata
  );
}

export class AndPolicy<TResource = unknown> implements IPolicy<TResource> {
  public readonly name: string;
  private readonly policies: readonly IPolicy<TResource>[];

  public constructor(...policies: readonly IPolicy<TResource>[]) {
    if (policies.length === 0) {
      throw new Error('AndPolicy requires at least one policy.');
    }
    this.policies = Object.freeze([...policies]);
    this.name = `(${this.policies.map((p) => p.name).join(' AND ')})`;
  }

  public async can(
    identity: Identity,
    action: string,
    resource?: TResource,
    context?: AuthContext
  ): Promise<PolicyResult> {
    for (const policy of this.policies) {
      const res = await policy.can(identity, action, resource, context);
      const decision = toDecision(res, policy.name);
      if (!decision.allowed) {
        return AuthDecision.deny(
          decision.reason ?? `Access denied by policy "${policy.name}" in composite AND.`,
          this.name,
          decision.metadata
        );
      }
    }
    return AuthDecision.allow('All composite AND policies satisfied.', this.name);
  }
}

export class OrPolicy<TResource = unknown> implements IPolicy<TResource> {
  public readonly name: string;
  private readonly policies: readonly IPolicy<TResource>[];

  public constructor(...policies: readonly IPolicy<TResource>[]) {
    if (policies.length === 0) {
      throw new Error('OrPolicy requires at least one policy.');
    }
    this.policies = Object.freeze([...policies]);
    this.name = `(${this.policies.map((p) => p.name).join(' OR ')})`;
  }

  public async can(
    identity: Identity,
    action: string,
    resource?: TResource,
    context?: AuthContext
  ): Promise<PolicyResult> {
    let lastDenial: AuthDecision | undefined;

    for (const policy of this.policies) {
      const res = await policy.can(identity, action, resource, context);
      const decision = toDecision(res, policy.name);
      if (decision.allowed) {
        return AuthDecision.allow(
          decision.reason ?? `Access granted by policy "${policy.name}" in composite OR.`,
          this.name,
          decision.metadata
        );
      }
      lastDenial = decision;
    }

    return AuthDecision.deny(
      lastDenial?.reason ?? 'None of the composite OR policies were satisfied.',
      this.name,
      lastDenial?.metadata
    );
  }
}

export class NotPolicy<TResource = unknown> implements IPolicy<TResource> {
  public readonly name: string;
  private readonly policy: IPolicy<TResource>;

  public constructor(policy: IPolicy<TResource>) {
    this.policy = policy;
    this.name = `(NOT ${policy.name})`;
  }

  public async can(
    identity: Identity,
    action: string,
    resource?: TResource,
    context?: AuthContext
  ): Promise<PolicyResult> {
    const res = await this.policy.can(identity, action, resource, context);
    const decision = toDecision(res, this.policy.name);
    if (decision.allowed) {
      return AuthDecision.deny(
        `Access denied by NOT policy inversion of "${this.policy.name}".`,
        this.name
      );
    }
    return AuthDecision.allow(
      `Access allowed by NOT policy inversion of "${this.policy.name}".`,
      this.name
    );
  }
}

export function andPolicy<TResource = unknown>(
  ...policies: readonly IPolicy<TResource>[]
): IPolicy<TResource> {
  return new AndPolicy(...policies);
}

export function orPolicy<TResource = unknown>(
  ...policies: readonly IPolicy<TResource>[]
): IPolicy<TResource> {
  return new OrPolicy(...policies);
}

export function notPolicy<TResource = unknown>(policy: IPolicy<TResource>): IPolicy<TResource> {
  return new NotPolicy(policy);
}
