import type { ModelMetadata } from '../public/metadata.js';
import type { Model } from '../public/model.js';
import type { ModelStatic } from '../public/types.js';

/** Timestamp and soft-delete columns are datetimes even when not declared as fields. */
function implicitType(metadata: ModelMetadata, fieldName: string): 'dateTime' | undefined {
  if (
    metadata.timestamps.enabled &&
    (fieldName === metadata.timestamps.createdAt || fieldName === metadata.timestamps.updatedAt)
  ) {
    return 'dateTime';
  }
  if (metadata.softDelete.enabled && fieldName === metadata.softDelete.deletedAt) {
    return 'dateTime';
  }
  return undefined;
}

/** Whether `num` prints back as the decimal string `text` (ignoring leading / trailing zeros). */
function numberHoldsExactly(text: string, num: number): boolean {
  let normalized = text
    .trim()
    .replace(/^\+/, '')
    .replace(/^(-?)0+(?=\d)/, '$1');
  if (normalized.includes('.')) normalized = normalized.replace(/0+$/, '').replace(/\.$/, '');
  if (normalized === '-0') normalized = '0';
  return String(num) === normalized;
}

export class Hydrator {
  public static hydrateRow(
    rawRow: Record<string, unknown>,
    metadata: ModelMetadata
  ): Record<string, unknown> {
    const attributes: Record<string, unknown> = {};

    for (const [colName, val] of Object.entries(rawRow)) {
      const fieldName = metadata.columnToField(colName);
      const fieldMeta = metadata.getField(fieldName);
      const type = fieldMeta?.type ?? implicitType(metadata, fieldName);

      if (!type || val === null || val === undefined) {
        attributes[fieldName] = val ?? null;
        continue;
      }

      switch (type) {
        case 'time':
          // A time of day ('09:30:00') is not a Date: `new Date('09:30:00')` is invalid.
          attributes[fieldName] =
            val instanceof Date ? val.toISOString().slice(11, 19) : String(val);
          break;

        case 'date':
          // Calendar dates are kept at UTC midnight. Drivers that return a local-midnight Date
          // (pg) would otherwise shift the day for servers east of UTC.
          if (val instanceof Date) {
            attributes[fieldName] = new Date(
              Date.UTC(val.getFullYear(), val.getMonth(), val.getDate())
            );
          } else {
            attributes[fieldName] = new Date(String(val).slice(0, 10));
          }
          break;

        case 'dateTime':
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
            // A decimal a JS number can't hold exactly (e.g. NUMERIC(20,8)) stays a string, so
            // reading and saving it back never changes the stored value.
            attributes[fieldName] =
              Number.isNaN(num) || (type === 'decimal' && !numberHoldsExactly(val, num))
                ? val
                : num;
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
