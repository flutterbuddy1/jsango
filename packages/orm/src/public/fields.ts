import type { FieldDefinition, FieldOptions } from './types.js';

type CustomFieldOptions<T> = Omit<FieldOptions<T>, 'type'> & {
  readonly defaultValue?: T | (() => T) | undefined;
  readonly maxLength?: number | undefined;
};

function createField<T>(
  type: FieldOptions['type'],
  options?: CustomFieldOptions<T>
): FieldDefinition<T> {
  const { defaultValue, maxLength, ...rest } = options ?? {};
  return {
    type,
    default: defaultValue ?? options?.default,
    length: maxLength ?? options?.length,
    maxLength: maxLength ?? options?.length,
    ...rest,
  };
}

let objectIdCounter = Math.floor(Math.random() * 0xffffff);
const processUnique = Array.from({ length: 5 }, () => Math.floor(Math.random() * 256));

/** Generates a MongoDB-compatible ObjectId hex string (timestamp + random + counter). */
export function generateObjectId(): string {
  const bytes: number[] = [];
  const seconds = Math.floor(Date.now() / 1000);
  bytes.push((seconds >>> 24) & 0xff, (seconds >>> 16) & 0xff, (seconds >>> 8) & 0xff, seconds & 0xff);
  bytes.push(...processUnique);
  objectIdCounter = (objectIdCounter + 1) % 0xffffff;
  bytes.push((objectIdCounter >>> 16) & 0xff, (objectIdCounter >>> 8) & 0xff, objectIdCounter & 0xff);
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const fields = {
  id<T = number>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('integer', {
      primaryKey: true,
      autoIncrement: true,
      ...options,
    });
  },

  string<T = string>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('string', options);
  },

  number<T = number>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('float', options);
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

  /**
   * A 24-character ObjectId string. On MongoDB it is stored as a native ObjectId (use it for the
   * primary key and for references to other documents); on SQL databases it is a VARCHAR(24).
   * As a primary key a new id is generated automatically.
   */
  objectId<T = string>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    const isPk = options?.primaryKey === true;
    return createField<T>('string', {
      maxLength: 24,
      ...(isPk ? { defaultValue: (() => generateObjectId()) as unknown as () => T } : {}),
      ...options,
      options: { ...(options?.options ?? {}), objectId: true },
    });
  },

  uuid<T = string>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('uuid', options);
  },

  binary<T = Uint8Array>(options?: CustomFieldOptions<T>): FieldDefinition<T> {
    return createField<T>('binary', options);
  },
} as const;
