import type { FieldDefinition, FieldOptions } from './types.js';
type CustomFieldOptions<T> = Omit<FieldOptions<T>, 'type'> & {
    readonly defaultValue?: T | (() => T) | undefined;
    readonly maxLength?: number | undefined;
};
export declare const fields: {
    readonly id: <T = number>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly string: <T = string>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly number: <T = number>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly text: <T = string>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly integer: <T = number>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly bigint: <T = bigint>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly float: <T = number>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly decimal: <T = number>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly boolean: <T = boolean>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly dateTime: <T = Date>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly date: <T = Date>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly time: <T = Date>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly json: <T = unknown>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly uuid: <T = string>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
    readonly binary: <T = Uint8Array<ArrayBufferLike>>(options?: CustomFieldOptions<T>) => FieldDefinition<T>;
};
export {};
//# sourceMappingURL=fields.d.ts.map