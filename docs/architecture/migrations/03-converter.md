# Model to Schema Converter

The `ModelSchemaConverter` bridges `@django-js/orm` model metadata with the migration schema model.

## Conversion Pipeline

1. **Model Indexing**: Map model names to database table names.
2. **Field Translation**: Convert each `FieldMetadata` into a canonical `ColumnDefinition`.
3. **Timestamps & Soft Deletes**: Inject automatic `createdAt`, `updatedAt`, and `deletedAt` columns based on model configuration.
4. **Relational Constraints**: Resolve `belongsTo` relations to `ForeignKeyDefinition` links.
5. **Snapshot Assembly**: Wrap converted tables in a `SchemaSnapshot`.
