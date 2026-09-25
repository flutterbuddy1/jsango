# ADR-019: Authorization Architecture & Fail-Closed Evaluation

## Context

Authorization answers "What is this identity allowed to do?". The system must evaluate permissions, roles, and object-level policies in a predictable, high-performance manner without introducing backdoor bypasses or silent fail-open behaviors.

## Decision

1. **Authorization Manager**:
   - `AuthorizationManager` integrates `PermissionRegistry`, `RoleRegistry`, and `PolicyRegistry`.
   - Produces explicit `AuthorizationDecision` records (`allowed`, `reason`, `policy`, `metadata`).
2. **Centralized Superuser Auditing**:
   - Superuser elevation (`isSuperuser: true`) is handled in exactly one place inside `AuthorizationManager.authorize()`.
   - Produces an auditable decision marked with `SuperuserPolicy` rather than unlogged bypasses.
3. **HTTP Status Code Mapping**:
   - Authentication failure -> 401 Unauthorized (`UnauthenticatedError`).
   - Authorization failure -> 403 Forbidden (`ForbiddenError`).
   - `authorize()` middleware correctly yields 401 if the incoming request was not authenticated.

## Consequences

- Consistent access control across API endpoints, CLI, and future Admin interface.
- Complete auditability for compliance and security monitoring.
