# ADR-027: OpenAPI 3.1 Architecture and Generation Pipeline

## Status

Accepted

## Context

A production-grade backend framework requires an automated, deterministic mechanism to generate OpenAPI specifications without resorting to brittle AST parsing, runtime reflection over private controller methods, or heavyweight third-party dependencies.

## Decision

1. Implement `@django-js/openapi` using standard OpenAPI 3.1.0 specification primitives with backward compatibility for OpenAPI 3.0.3 structures.
2. Rely strictly on explicit route metadata (`Route.metadata.openapi`), validation schemas, ORM metadata, and Admin resource definitions.
3. Guarantee deterministic document generation by sorting paths, HTTP methods, tags, parameters, and component schemas alphabetically.
4. Provide structured conflict detection (`DuplicateOperationIdError`, `ConflictingSchemaError`) to prevent silent overwrites.
5. Provide a zero-dependency YAML and JSON formatter.
6. Isolate administrative routes from public OpenAPI specs by default via `includeAdmin: false`.

## Consequences

- Clean, decoupled spec generation from router metadata.
- Reproducible OpenAPI documents suitable for CI diffing and client code generation.
- No performance impact on the HTTP request hot path.
