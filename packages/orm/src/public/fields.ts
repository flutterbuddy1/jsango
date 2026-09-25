import type { FieldDefinition, FieldOptions } from './types.js';

type CustomFieldOptions<T> = Omit<FieldOptions<T>, 'type'>;

function createField<T>(
  type: FieldOptions['type'],
  options?: CustomFieldOptions<T>
): FieldDefinition<T> {
  return {
    type,
    ...options,
  };
}

export const fields = {
  string<T = string>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('string', options);
  },

  text<T = string>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('text', options);
  },

  integer<T = number>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('integer', options);
  },

  bigint<T = bigint>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('bigint', options);
  },

  float<T = number>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('float', options);
  },

  decimal<T = number>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('decimal', options);
  },

  boolean<T = boolean>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('boolean', options);
  },

  dateTime<T = Date>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('dateTime', options);
  },

  date<T = Date>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('date', options);
  },

  time<T = Date>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('time', options);
  },

  json<T = unknown>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('json', options);
  },

  uuid<T = string>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('uuid', options);
  },

  binary<T = Uint8Array>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('binary', options);
  },
} as const;
