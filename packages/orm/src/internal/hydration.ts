import type { ModelMetadata } from '../public/metadata.js';
import type { Model } from '../public/model.js';
import type { ModelStatic } from '../public/types.js';

export class Hydrator {
  public static hydrateRow(
    rawRow: Record<string, unknown>,
    metadata: ModelMetadata
  ): Record<string, unknown> {
    const attributes: Record<string, unknown> = {};

    for (const [colName, val] of Object.entries(rawRow)) {
      const fieldName = metadata.columnToField(colName);
      const fieldMeta = metadata.getField(fieldName);

      if (!fieldMeta || val === null || val === undefined) {
        attributes[fieldName] = val ?? null;
        continue;
      }

      switch (fieldMeta.type) {
        case 'dateTime':
        case 'date':
        case 'time':
          if (val instanceof Date) {
            attributes[fieldName] = val;
          } else if (typeof val === 'string' || typeof val === 'number') {
            attributes[fieldName] = new Date(val);
          } else {
            attributes[fieldName] = val;
          }
          break;

        case 'boolean':
          if (typeof val === 'boolean') {
            attributes[fieldName] = val;
          } else if (typeof val === 'number') {
            attributes[fieldName] = val !== 0;
          } else if (typeof val === 'string') {
            attributes[fieldName] = val === 'true' || val === '1' || val === 't';
          } else {
            attributes[fieldName] = Boolean(val);
          }
          break;

        case 'integer':
        case 'float':
        case 'decimal':
          if (typeof val === 'number') {
            attributes[fieldName] = val;
          } else if (typeof val === 'string') {
            const num = Number(val);
            attributes[fieldName] = Number.isNaN(num) ? val : num;
          } else {
            attributes[fieldName] = val;
          }
          break;

        case 'bigint':
          if (typeof val === 'bigint') {
            attributes[fieldName] = val;
          } else if (typeof val === 'number' || typeof val === 'string') {
            try {
              attributes[fieldName] = BigInt(val);
            } catch {
              attributes[fieldName] = val;
            }
          } else {
            attributes[fieldName] = val;
          }
          break;

        case 'json':
          if (typeof val === 'string') {
            try {
              attributes[fieldName] = JSON.parse(val);
            } catch {
              attributes[fieldName] = val;
            }
          } else {
            attributes[fieldName] = val;
          }
          break;

        default:
          attributes[fieldName] = val;
          break;
      }
    }

    return attributes;
  }

  public static hydrateModel<TModel extends Model>(
    rawRow: Record<string, unknown>,
    modelClass: ModelStatic<TModel>
  ): TModel {
    const attributes = this.hydrateRow(rawRow, modelClass.metadata);
    return new modelClass(attributes, false);
  }

  public static hydrateModels<TModel extends Model>(
    rawRows: readonly Record<string, unknown>[],
    modelClass: ModelStatic<TModel>
  ): readonly TModel[] {
    return rawRows.map((row) => this.hydrateModel(row, modelClass));
  }
}
