// Types & Interfaces
export type {
  Identity,
  IdentityType,
  AuthenticationResult,
  AuthenticationStatus,
  IAuthenticationStrategy,
  AuthContext,
  Session,
  CreateSessionData,
  ISessionStore,
  AuthorizationDecision,
  PolicyResult,
  IPolicy,
  ResourceResolver,
} from './types.js';

// Errors
export {
  type AuthErrorOptions,
  AuthenticationError,
  UnauthenticatedError,
  InvalidCredentialsError,
  TokenExpiredError,
  SessionExpiredError,
  AuthorizationError,
  ForbiddenError,
  PolicyError,
} from './errors.js';

// Identity
export {
  type IdentityOptions,
  BaseIdentity,
  UserIdentity,
  AnonymousIdentity,
  SystemIdentity,
  ServiceAccountIdentity,
} from './identity.js';

// Authentication
export {
  type IPasswordHasher,
  type ScryptOptions,
  ScryptPasswordHasher,
} from './authentication/password.js';

export {
  type JwtAlgorithm,
  type JwtHeader,
  type JwtPayload,
  type JwtSignOptions,
  type JwtVerifyOptions,
  type ITokenRevocationStore,
  MemoryTokenRevocationStore,
  JwtService,
} from './authentication/jwt.js';

export {
  type SessionAuthStrategyOptions,
  MemorySessionStore,
  SessionAuthenticationStrategy,
} from './authentication/session.js';

export {
  type TotpSetupOptions,
  type TotpSecretResult,
  type TotpVerifyOptions,
  TotpService,
  base32Encode,
  base32Decode,
} from './authentication/totp.js';

export {
  type ITokenVerifier,
  type BearerAuthStrategyOptions,
  JwtTokenVerifier,
  BearerTokenAuthenticationStrategy,
} from './authentication/bearer.js';

export {
  type IApiKeyVerifier,
  type ApiKeyAuthStrategyOptions,
  ApiKeyAuthenticationStrategy,
} from './authentication/api-key.js';

export {
  type AuthenticationManagerOptions,
  AuthenticationManager,
} from './authentication/manager.js';

// Authorization
export { AuthDecision } from './authorization/decision.js';

export { type PermissionDefinition, PermissionRegistry } from './authorization/permission.js';

export { type RoleDefinition, RoleRegistry } from './authorization/role.js';

export { BasePolicy, PolicyRegistry } from './authorization/policy.js';

export {
  AndPolicy,
  OrPolicy,
  NotPolicy,
  andPolicy,
  orPolicy,
  notPolicy,
} from './authorization/composite.js';

export {
  type AuthorizationManagerOptions,
  type AuthorizeOptions,
  AuthorizationManager,
} from './authorization/manager.js';

// Context Helpers
export {
  AUTH_CONTEXT_STATE_KEY,
  setAuthContext,
  getAuthContext,
  getIdentity,
  requireIdentity,
} from './context/auth-context.js';

// Middleware
export { type AuthenticateOptions, authenticate } from './middleware/authenticate.js';

export { type AuthorizeMiddlewareOptions, authorize } from './middleware/authorize.js';

// Utilities
export { timingSafeEqualString } from '../internal/timing.js';
export { CryptoUtils } from '../internal/crypto-utils.js';
export { Base64Url } from '../internal/base64url.js';
