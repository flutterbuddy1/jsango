# Deterministic Schema Diff Engine

The `SchemaDiffEngine` computes the minimal, deterministic sequence of operations needed to transition from a base `SchemaSnapshot` to a target `SchemaSnapshot`.

## Topological Sorting

Operations are ordered to maintain relational integrity:

1. `CreateTableOperation`
2. `AddColumnOperation`
3. `AlterColumnOperation`
4. `CreateUniqueConstraintOperation`
5. `CreateIndexOperation`
6. `AddForeignKeyOperation`
7. `DropForeignKeyOperation`
8. `DropIndexOperation`
9. `DropUniqueConstraintOperation`
10. `DropColumnOperation`
11. `DropTableOperation`

## Reversibility & Inverse Generation

The `SchemaDiff` generates its inverse sequence via `getReverseOperations()`. Inverses reverse the chronological order and negate each operation (`CreateTable` $\to$ `DropTable`, `AddColumn` $\to$ `DropColumn`, etc.).
