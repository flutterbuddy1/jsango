import type { AuthorizationDecision } from '../types.js';

export class AuthDecision implements AuthorizationDecision {
  public readonly allowed: boolean;
  public readonly reason?: string | undefined;
  public readonly policy?: string | undefined;
  public readonly metadata?: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    allowed: boolean,
    reason?: string | undefined,
    policy?: string | undefined,
    metadata?: Readonly<Record<string, unknown>> | undefined
  ) {
    this.allowed = allowed;
    this.reason = reason;
    this.policy = policy;
    this.metadata = metadata ? Object.freeze({ ...metadata }) : undefined;
  }

  public static allow(
    reason?: string,
    policy?: string,
    metadata?: Readonly<Record<string, unknown>>
  ): AuthDecision {
    return new AuthDecision(true, reason, policy, metadata);
  }

  public static deny(
    reason = 'Access denied.',
    policy?: string,
    metadata?: Readonly<Record<string, unknown>>
  ): AuthDecision {
    return new AuthDecision(false, reason, policy, metadata);
  }
}
