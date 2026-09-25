import type {
  Identity,
  AuthContext,
  AuthorizationDecision,
  PolicyResult,
  IPolicy,
} from '../types.js';
import { AuthDecision } from './decision.js';
import { PermissionRegistry } from './permission.js';
import { RoleRegistry } from './role.js';
import { PolicyRegistry } from './policy.js';
import { ForbiddenError } from '../errors.js';

export interface AuthorizationManagerOptions {
  readonly permissions?: PermissionRegistry | undefined;
  readonly roles?: RoleRegistry | undefined;
  readonly policies?: PolicyRegistry | undefined;
}

export interface AuthorizeOptions {
  readonly throwOnDeny?: boolean | undefined;
  readonly context?: AuthContext | undefined;
  readonly policy?: string | IPolicy | undefined;
}

export class AuthorizationManager {
  public readonly permissions: PermissionRegistry;
  public readonly roles: RoleRegistry;
  public readonly policies: PolicyRegistry;

  public constructor(options: AuthorizationManagerOptions = {}) {
    this.permissions = options.permissions ?? new PermissionRegistry();
    this.roles = options.roles ?? new RoleRegistry();
    this.policies = options.policies ?? new PolicyRegistry();
  }

  /**
   * Evaluates whether an identity can perform an action on an optional resource.
   * Centralizes superuser check, policy resolution, role-to-permission mapping, and fail-closed security.
   */
  public async authorize(
    identity: Identity | undefined,
    action: string,
    resource?: unknown,
    options: AuthorizeOptions = {}
  ): Promise<AuthorizationDecision> {
    // 1. Fail closed on missing identity
    if (!identity) {
      const decision = AuthDecision.deny('Identity is missing or unauthenticated.');
      if (options.throwOnDeny) {
        throw new ForbiddenError(decision.reason);
      }
      return decision;
    }

    // 2. Centralized superuser check (auditable)
    if (identity.isSuperuser) {
      return AuthDecision.allow('Superuser access granted.', 'SuperuserPolicy', {
        isSuperuser: true,
      });
    }

    // 3. Object-level / Resource-level policy evaluation
    if (resource !== undefined && resource !== null) {
      let policy: IPolicy | undefined;
      if (typeof options.policy === 'string') {
        policy =
          this.policies.getByName(options.policy) ?? this.policies.getForTarget(options.policy);
      } else if (options.policy && typeof options.policy === 'object') {
        policy = options.policy;
      } else {
        policy = this.policies.resolvePolicy(resource);
      }
      if (policy) {
        try {
          const result = await policy.can(identity, action, resource, options.context);
          const decision = this.normalizeResult(result, policy.name);
          if (!decision.allowed && options.throwOnDeny) {
            throw new ForbiddenError(
              decision.reason ?? `Access denied by policy "${policy.name}".`
            );
          }
          return decision;
        } catch (error) {
          if (error instanceof ForbiddenError) {
            throw error;
          }
          const decision = AuthDecision.deny(
            `Policy evaluation error: ${error instanceof Error ? error.message : String(error)}`,
            policy.name
          );
          if (options.throwOnDeny) {
            throw new ForbiddenError(decision.reason);
          }
          return decision;
        }
      }

      // If a resource was supplied but no policy was registered for it: FAIL CLOSED
      const decision = AuthDecision.deny(
        `No authorization policy found for resource. Access denied.`,
        undefined,
        { action }
      );
      if (options.throwOnDeny) {
        throw new ForbiddenError(decision.reason);
      }
      return decision;
    }

    // 4. Action / Permission level evaluation (when no specific resource instance is provided)
    // 4a. Check direct identity permissions (supports wildcards)
    if (identity.hasPermission(action)) {
      return AuthDecision.allow(
        `Permission "${action}" granted directly to identity.`,
        'PermissionRegistry',
        {
          permission: action,
        }
      );
    }

    // 4b. Check role-mapped permissions
    if (identity.roles.length > 0) {
      const rolePermissions = this.roles.getPermissionsForRoles(identity.roles);
      if (PermissionRegistry.matches(rolePermissions, action)) {
        return AuthDecision.allow(
          `Permission "${action}" granted via identity roles [${identity.roles.join(', ')}].`,
          'RoleRegistry',
          { permission: action, roles: identity.roles }
        );
      }
    }

    // 4c. Check if a global policy is registered under the action name
    const globalPolicy = this.policies.getByName(action);
    if (globalPolicy) {
      const result = await globalPolicy.can(identity, action, undefined, options.context);
      const decision = this.normalizeResult(result, globalPolicy.name);
      if (!decision.allowed && options.throwOnDeny) {
        throw new ForbiddenError(
          decision.reason ?? `Access denied by policy "${globalPolicy.name}".`
        );
      }
      return decision;
    }

    // 5. Fail-closed default
    const denyDecision = AuthDecision.deny(
      `Access denied: no matching permission, role, or policy allows action "${action}".`
    );
    if (options.throwOnDeny) {
      throw new ForbiddenError(denyDecision.reason);
    }
    return denyDecision;
  }

  /**
   * Helper that returns a boolean indicating whether the action is allowed.
   */
  public async can(
    identity: Identity | undefined,
    action: string,
    resource?: unknown,
    context?: AuthContext
  ): Promise<boolean> {
    const decision = await this.authorize(identity, action, resource, { context });
    return decision.allowed;
  }

  /**
   * Enforces that the action is allowed. Throws ForbiddenError if denied.
   */
  public async enforce(
    identity: Identity | undefined,
    action: string,
    resource?: unknown,
    context?: AuthContext
  ): Promise<AuthorizationDecision> {
    return this.authorize(identity, action, resource, { throwOnDeny: true, context });
  }

  /**
   * Evaluates authorization for multiple resources in bulk (useful for Admin bulk actions).
   */
  public async authorizeMany<T = unknown>(
    identity: Identity | undefined,
    action: string,
    resources: readonly T[],
    options: AuthorizeOptions = {}
  ): Promise<readonly AuthorizationDecision[]> {
    const decisions: AuthorizationDecision[] = [];
    for (const resource of resources) {
      const decision = await this.authorize(identity, action, resource, options);
      decisions.push(decision);
    }
    return Object.freeze(decisions);
  }

  private normalizeResult(result: PolicyResult, policyName: string): AuthorizationDecision {
    if (typeof result === 'boolean') {
      return result
        ? AuthDecision.allow('Policy granted access.', policyName)
        : AuthDecision.deny(`Access denied by policy "${policyName}".`, policyName);
    }
    return result;
  }
}
