import type { ModelMetadata, ModelStatic } from '@django-js/orm';
import { SchemaSnapshot } from '../public/schema.js';
import type {
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  TableDefinition,
  UniqueConstraintDefinition,
} from '../public/types.js';

export class ModelSchemaConverter {
  public static convert(models: readonly ModelMetadata[]): SchemaSnapshot {
    const tables: TableDefinition[] = [];

    // First map model name to table name for foreign key resolution
    const modelNameToTable = new Map<string, string>();
    for (const model of models) {
      modelNameToTable.set(model.name, model.table);
    }

    for (const model of models) {
      const columns: ColumnDefinition[] = [];
      const pkCols: string[] = [];
      const uniqueConstraints: UniqueConstraintDefinition[] = [];
      const indexes: IndexDefinition[] = [];
      const foreignKeys: ForeignKeyDefinition[] = [];

      for (const field of model.fields.values()) {
        const colDef: ColumnDefinition = {
          name: field.columnName,
          type: field.type,
          nullable: field.nullable,
          primaryKey: field.primaryKey,
          autoIncrement: field.autoIncrement,
          unique: field.unique,
          defaultValue: typeof field.defaultValue === 'function' ? undefined : field.defaultValue,
          length: field.length,
          precision: field.precision,
          scale: field.scale,
          comment: field.comment,
        };

        columns.push(colDef);

        if (field.primaryKey) {
          pkCols.push(field.columnName);
        }

        if (field.unique && !field.primaryKey) {
          uniqueConstraints.push({
            name: `uq_${model.table}_${field.columnName}`,
            columns: [field.columnName],
          });
        }

        if (field.indexed && !field.primaryKey && !field.unique) {
          indexes.push({
            name: `idx_${model.table}_${field.columnName}`,
            columns: [field.columnName],
            unique: false,
          });
        }
      }

      // Add timestamps columns if enabled and not already explicitly declared
      if (model.timestamps.enabled) {
        if (!columns.some((c) => c.name === model.timestamps.createdAt)) {
          columns.push({
            name: model.timestamps.createdAt,
            type: 'dateTime',
            nullable: false,
          });
        }
        if (!columns.some((c) => c.name === model.timestamps.updatedAt)) {
          columns.push({
            name: model.timestamps.updatedAt,
            type: 'dateTime',
            nullable: false,
          });
        }
      }

      // Add soft delete column if enabled and not already explicitly declared
      if (model.softDelete.enabled) {
        if (!columns.some((c) => c.name === model.softDelete.deletedAt)) {
          columns.push({
            name: model.softDelete.deletedAt,
            type: 'dateTime',
            nullable: true,
          });
        }
      }

      // Indexes from model metadata
      for (const idx of model.indexes) {
        const idxName = idx.name ?? `idx_${model.table}_${idx.columns.join('_')}`;
        if (!indexes.some((i) => i.name === idxName)) {
          indexes.push({
            name: idxName,
            columns: [...idx.columns],
            unique: idx.unique,
          });
        }
      }

      // Foreign keys from belongsTo relations
      for (const rel of model.relations.values()) {
        if (rel.type === 'belongsTo') {
          let targetTable: string | undefined;
          try {
            const targetModel = rel.resolveTarget((name: string) => {
              const tbl = modelNameToTable.get(name);
              return tbl ? ({ tableName: tbl } as unknown as ModelStatic) : undefined;
            });
            targetTable = targetModel.tableName;
          } catch {
            targetTable = undefined;
          }

          if (targetTable) {
            foreignKeys.push({
              name: `fk_${model.table}_${rel.foreignKey}`,
              columns: [rel.foreignKey],
              referencedTable: targetTable,
              referencedColumns: [rel.localKey],
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            });
          }
        }
      }

      tables.push({
        name: model.table,
        columns,
        primaryKey: pkCols.length > 0 ? pkCols : undefined,
        indexes,
        uniqueConstraints,
        foreignKeys,
      });
    }

    // Deterministic sort of tables by name
    tables.sort((a, b) => a.name.localeCompare(b.name));

    return new SchemaSnapshot({ tables });
  }
}
