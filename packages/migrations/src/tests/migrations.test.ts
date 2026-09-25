import { describe, it, expect } from 'vitest';
import * as Migrations from '../index.js';

describe('@django-js/migrations package', () => {
  it('should export all public classes, types, and functions', () => {
    expect(Migrations.SchemaSnapshot).toBeDefined();
    expect(Migrations.TableSchema).toBeDefined();
    expect(Migrations.ColumnSchema).toBeDefined();
    expect(Migrations.SchemaDiffEngine).toBeDefined();
    expect(Migrations.SchemaDiff).toBeDefined();
    expect(Migrations.MigrationRunner).toBeDefined();
    expect(Migrations.MigrationRegistry).toBeDefined();
    expect(Migrations.MigrationLock).toBeDefined();
    expect(Migrations.MigrationGenerator).toBeDefined();
    expect(Migrations.DriftDetector).toBeDefined();
    expect(Migrations.ModelSchemaConverter).toBeDefined();
    expect(Migrations.SqlMigrationCompiler).toBeDefined();
    expect(Migrations.MigrationStorage).toBeDefined();
  });
});
