# ADR-020: Policy Model, Object-Level Access, and Composite Combinators

## Context

CRUD permissions alone cannot address complex business rules (e.g., "users can only edit their own draft articles, but moderators can edit anything"). Object-level permissions require inspecting the specific resource instance.

## Decision

1. **Policy Abstraction**:
   - `IPolicy<TResource>` exposes `can(identity, action, resource, context)`.
   - `BasePolicy<TResource>` provides method-dispatch routing (`view`, `create`, `update`, `delete`).
2. **ModelMetadata Compatibility**:
   - `PolicyRegistry.resolvePolicy()` inspects `resource.constructor.metadata.name` and `modelName`.
   - Enables seamless authorization on Phase 6 ORM model instances without importing the ORM package.
3. **Pure Policies & Combinators**:
   - Policies must be pure decision logic without silent side effects (no database mutations, no email sending).
   - Boolean combinators (`andPolicy`, `orPolicy`, `notPolicy`) enable predictable policy composition.
4. **Bulk Authorization**:
   - `AuthorizationManager.authorizeMany()` provides batch authorization evaluation for multiple records.

## Consequences

- Direct preparation for Phase 13 Admin row-level and object-level permissions.
- Predictable and fast policy evaluation without unexpected side effects.
