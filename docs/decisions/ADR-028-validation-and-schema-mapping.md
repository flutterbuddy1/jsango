# ADR-028: Validation and Schema Mapping to OpenAPI

## Status

Accepted

## Context

Applications define validation schemas (Phase 6/Validation) and ORM models (Phase 4/ORM). Re-declaring schemas for API documentation introduces duplication, drift, and maintenance overhead.

## Decision

1. Introduce `ValidationAdapter` to convert schema descriptors into JSON Schema / OpenAPI 3.1 representations (`string`, `integer`, `number`, `boolean`, `array`, `object`, `enum`, formats, min/max constraints, regex patterns).
2. Introduce `OrmAdapter` to map `ModelMetadata` fields into OpenAPI component schemas, converting SQL data types (UUID, string, integer, float, boolean, json, datetime) to standard OpenAPI types.
3. Introduce `AdminAdapter` to transform Admin resource actions and filter definitions into route operations and query parameter schemas when explicitly requested.
4. Provide reusable schema factories via `SchemaBuilder` for standard error responses (`ErrorResponse`, `ValidationErrorResponse`) and paginated payloads.

## Consequences

- Single source of truth for validation, database models, and API specifications.
- Safe type mapping without exposing private or internal model properties.
