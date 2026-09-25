# ADR-009: ORM Architecture and Model Metadata System

## Status

Accepted

## Context

In `django-js`, the Object-Relational Mapping (ORM) layer must serve as much more than a simple CRUD query generator. It provides the architectural foundation for several planned future phases:

- **Phase 7: Migrations** (deriving schema states, table definitions, column types, constraints, and indexes)
- **Phase 8: Validation** (consuming structural field constraints like lengths, nullability, and types)
- **Phase 13: Admin** (introspecting model schemas, relationships, searchable fields, and column labels without coupling to ORM query internals)
- **Phase 14: OpenAPI & Serialization** (deriving API schemas and serializing model records cleanly)

We needed an ORM architecture that provides:

1. **100% TypeScript compile-time type safety** without requiring complex external code generation or fragile decorators.
2. **First-class, introspectable runtime metadata** that remains deterministic, serializable, and immutable after registration.
3. **High query performance** with immutable query builders and zero N+1 queries during relationship loading.
4. **Complete runtime independence and database independence**, utilizing the database abstraction layer from Phase 5.

## Decision

### 1. Declarative `defineModel()` Model Definition

We evaluated three approaches for model definition:

- _Approach A: Class decorators with experimental TypeScript reflection (`reflect-metadata`)_. Rejected due to poor ESM compatibility, fragile runtime type retention, slow cold starts, and inability to produce inferred types without duplicate manual property definitions.
- _Approach B: Pure external schema file generation (like Prisma)_. Rejected because it introduces external build steps and breaks the single-source-of-truth TypeScript developer experience.
- _Approach C: Declarative `defineModel()` factory_. Selected. The factory accepts a configuration object with typed `fields` and `relations`, compiles an immutable `ModelMetadata` instance, attaches property getters/setters to the model class prototype, and exports a constructor with static query methods (`query()`, `find()`, `create()`, `bulkCreate()`). This provides **complete compile-time type inference** (`InferModelAttributes` and `InferCreationAttributes`) with zero build-time codegen.

### 2. First-Class Model Metadata Architecture

Every model definition generates an immutable `ModelMetadata` schema exposing:

- Table name and connection identity
- Primary key specification
- `FieldMetadata` (type, column name, nullability, unique, indexed, length, precision, scale, defaults, options)
- `RelationMetadata` (relation type, source, target resolver, foreign key, local key, pivot/through options)
- Timestamp configuration (`createdAt`, `updatedAt`)
- Soft-delete configuration (`deletedAt`)
- Index definitions
- Extensible options for future Admin and validation systems

Metadata is sealed with `Object.freeze` and cached relations use static `WeakMap` storage to preserve complete immutability.

### 3. Active Record + Composable QueryBuilder Hybrid

We chose an Active Record + QuerySet hybrid:

- Model instances represent single database rows with change tracking (`isDirty()`, `getDirty()`, `getOriginal()`), `save()`, `delete()`, `refresh()`, and `toJSON()`.
- Un-dirty instances calling `save()` bypass the database entirely, eliminating redundant network hops.
- Complex queries use an immutable `QueryBuilder` with chaining methods (`where()`, `whereIn()`, `orderBy()`, `limit()`, `paginate()`, `cursor()`). Every chained method returns a cloned builder, ensuring query isolation across concurrent request contexts.

### 4. Zero N+1 Eager Loading

Implicit lazy loading via property access is strictly forbidden in `django-js` to prevent hidden database traffic and production degradation.
Relationships are loaded explicitly via `.with('posts', 'profile')`. The `EagerLoader` batches parent IDs into a single `WHERE foreign_key IN (...)` query and attaches resolved child records. Loading relationships across $N$ parent records requires exactly $1 + R$ database queries (where $R$ is the number of relations), completely eliminating N+1 bottlenecks.

### 5. AST-Based SQL Compilation and Security

The query builder compiles to an internal Query AST, which `SqlCompiler` converts into parameterized SQL (`{ sql, params }`). Identifiers are strictly validated against `/^[a-zA-Z_][a-zA-Z0-9_]*$/` and escaped with ANSI quotes, guaranteeing complete protection against SQL injection and identifier manipulation.

### 6. Transaction and Connection Integration

Queries and persistence operations can execute against the default connection, named connection pools, or explicit database transactions using `.using(tx)`. All pool connections acquired during queries are guaranteed to be released back to the pool in `finally` blocks.

## Consequences

- **Positive**: Clean, type-safe API for developers; rich metadata ready for Admin and Migrations; zero N+1 queries; query immutability; strict parameterization.
- **Trade-offs**: Circular model relationships must use arrow resolver functions (`() => TargetModel`), which are evaluated lazily upon first access.
