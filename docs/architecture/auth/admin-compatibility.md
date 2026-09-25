# Admin Compatibility & Multi-Tenancy Foundation

## 1. Preparation for Phase 13 Admin

Phase 10 provides the exact security foundation required by Phase 13 Admin:

1. **ModelMetadata Compatibility**: `PolicyRegistry` recognizes ORM models via `ModelMetadata.name`, enabling object-level admin permissions (`can(identity, 'change', post)`).
2. **Bulk Authorization**: `AuthorizationManager.authorizeMany()` evaluates batch permissions on multiple selected records without multiple redundant middleware roundtrips.
3. **Auditable Decisions**: `AuthorizationDecision` captures structured metadata (`reason`, `policy`, `metadata`) suitable for audit trail persistence in Phase 13.
4. **Field-Level Foundation**: Policy actions can be specialized (e.g. `view.email`, `change.salary`) using namespaced strings or custom policy methods.

## 2. Multi-Tenancy Foundation

Multi-tenancy concerns are supported via:

- `Identity.tenantId?: string`: Stores the principal's home tenant or active workspace.
- `AuthContext.tenantId?: string`: Allows policies to verify tenant isolation boundaries (`resource.tenantId === context.tenantId`) without global state.
