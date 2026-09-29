import type { ModelMetadata } from '../public/metadata.js';

/**
 * Converts a model attribute into the value bound as a SQL parameter.
 * JSON fields are always sent as JSON text so that arrays, strings and objects round-trip
 * identically on PostgreSQL (json/jsonb), MySQL (JSON) and SQLite (TEXT).
 */
export function serializeFieldValue(
  metadata: ModelMetadata,
  field: string,
  value: unknown
): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  const fieldMeta = metadata.getField(field) ?? metadata.getField(metadata.columnToField(field));
  if (fieldMeta?.type === 'json') {
    return JSON.stringify(value);
  }
  return value;
}
