import type { HttpRequest, RequestContext } from '@django-js/http';

export type IdentityType = 'user' | 'service_account' | 'api_client' | 'system' | 'anonymous';

export interface Identity {
  readonly id: string;
  readonly type: IdentityType;
  readonly isAuthenticated: boolean;
  readonly isSuperuser: boolean;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly tenantId?: string | undefined;
  readonly metadata: Readonly<Record<string, unknown>>;
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
  toJSON(): Record<string, unknown>;
}

export type AuthenticationStatus =
  | 'authenticated'
  | 'unauthenticated'
  | 'invalid_credentials'
  | 'expired_credentials'
  | 'malformed_credentials';

export interface AuthenticationResult {
  readonly status: AuthenticationStatus;
  readonly identity: Identity;
  readonly strategy?: string | undefined;
  readonly error?: Error | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface IAuthenticationStrategy {
  readonly name: string;
  authenticate(request: HttpRequest, context: RequestContext): Promise<AuthenticationResult>;
}

export interface AuthContext {
  readonly identity: Identity;
  readonly result: AuthenticationResult;
  readonly strategyUsed?: string | undefined;
  readonly tenantId?: string | undefined;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Session {
  readonly id: string;
  readonly identityId: string;
  readonly roles: readonly string[];
  readonly tenantId?: string | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface CreateSessionData {
  readonly identityId: string;
  readonly roles?: readonly string[] | undefined;
  readonly tenantId?: string | undefined;
  readonly ttlMs?: number | undefined;
  readonly data?: Record<string, unknown> | undefined;
}

export interface ISessionStore {
  get(id: string): Promise<Session | undefined>;
  create(data: CreateSessionData): Promise<Session>;
  update(id: string, data: Partial<Session>): Promise<Session | undefined>;
  delete(id: string): Promise<boolean>;
  touch(id: string, ttlMs?: number): Promise<boolean>;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason?: string | undefined;
  readonly policy?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export type PolicyResult = boolean | AuthorizationDecision;

export interface IPolicy<TResource = unknown> {
  readonly name: string;
  can(
    identity: Identity,
    action: string,
    resource?: TResource,
    context?: AuthContext
  ): Promise<PolicyResult> | PolicyResult;
}

export interface ResourceResolver<TResource = unknown> {
  (context: RequestContext): Promise<TResource | undefined> | TResource | undefined;
}
