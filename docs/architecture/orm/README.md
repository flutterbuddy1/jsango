# @django-js/orm — Architectural Documentation

## Overview

`@django-js/orm` is the official Object-Relational Mapping (ORM) and Model Metadata layer for `django-js`.

It provides a production-grade, TypeScript-first abstraction for defining database models, executing composable queries, eager-loading relationships without N+1 query bottlenecks, and managing transactions.

Crucially, `@django-js/orm` exposes a **First-Class Model Metadata System** that serves as the architectural foundation for future framework systems:

- **Phase 7: Migrations** (schema diffing, table generation, and index tracking)
- **Phase 8: Validation** (structural field constraints and type checking)
- **Phase 13: Admin** (introspecting models, fields, and relations without query coupling)
- **Phase 14: OpenAPI & Serialization** (automatic schema generation and clean serialization)

---

## Documentation Index

1. [ORM Architecture](./orm-architecture.md) — Architectural layers, design patterns, and package boundaries.
2. [Model Definition & Instances](./models.md) — Defining models via `defineModel`, instance lifecycle, and dirty tracking.
3. [Model Metadata System](./model-metadata.md) — The immutable metadata schema, field introspection, and Admin extension points.
4. [Field System](./fields.md) — Built-in field types, options, defaults, and column mapping.
5. [Query Builder](./queries.md) — Composable, immutable query chaining, filtering, aggregations, and streaming.
6. [Relationships & Eager Loading](./relations.md) — `belongsTo`, `hasOne`, `hasMany`, and `manyToMany` with batch eager loading.
7. [Transactions & Connections](./transactions.md) — Integrating Phase 5 transactions via `.using(tx)`.
8. [Hydration & Change Tracking](./hydration.md) — Mapping raw database rows to typed instances with change tracking.
9. [Performance & Benchmarks](./performance.md) — Benchmark findings, throughput metrics, and memory efficiency.
10. [Type Safety & Inference](./type-safety.md) — Compile-time inference for attributes, creation options, and queries.
11. [Admin Compatibility](./admin-compatibility.md) — How Phase 13 Admin will consume ORM metadata.
12. [Migration Compatibility](./migration-compatibility.md) — How Phase 7 Migrations will derive schema states.
