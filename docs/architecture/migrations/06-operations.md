# Migration Operations AST

Migration operations represent atomic, serializable, and reversible schema modifications.

## Concrete Operations

- `CreateTableOperation`
- `DropTableOperation`
- `AddColumnOperation`
- `DropColumnOperation`
- `AlterColumnOperation`
- `CreateIndexOperation`
- `DropIndexOperation`
- `AddForeignKeyOperation`
- `DropForeignKeyOperation`
- `CreateUniqueConstraintOperation`
- `DropUniqueConstraintOperation`
- `RenameTableOperation`
- `RenameColumnOperation`
- `RawSqlOperation`

## Destructive Changes

Operations like `DropTableOperation`, `DropColumnOperation`, and narrowing `AlterColumnOperation` mark `isDestructive = true`. The runner rejects them unless explicit approval (`allowDestructive: true`) is provided.
