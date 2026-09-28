import type { IValidator, ValidationResult, ValidationErrorItem } from './validation.js';
export declare abstract class BaseSchema<T = unknown> implements IValidator<T> {
    protected isOptional: boolean;
    protected defaultValue?: T | undefined;
    optional(): BaseSchema<T | undefined>;
    default(val: T): this;
    abstract validate(input: unknown, path?: string): ValidationResult<T>;
    protected success(data: T): ValidationResult<T>;
    protected failure(errors: ValidationErrorItem[]): ValidationResult<T>;
}
export declare class StringSchema extends BaseSchema<string> {
    private minLength?;
    private maxLength?;
    private isEmail;
    private pattern?;
    min(length: number): this;
    max(length: number): this;
    email(): this;
    regex(pat: RegExp): this;
    validate(input: unknown, path?: string): ValidationResult<string>;
}
export declare class NumberSchema extends BaseSchema<number> {
    private minValue?;
    private maxValue?;
    private isInteger;
    min(min: number): this;
    max(max: number): this;
    int(): this;
    positive(): this;
    validate(input: unknown, path?: string): ValidationResult<number>;
}
export declare class BooleanSchema extends BaseSchema<boolean> {
    validate(input: unknown, path?: string): ValidationResult<boolean>;
}
export declare class DateSchema extends BaseSchema<Date> {
    validate(input: unknown, path?: string): ValidationResult<Date>;
}
export declare class ArraySchema<T> extends BaseSchema<readonly T[]> {
    private readonly itemSchema;
    constructor(itemSchema: BaseSchema<T>);
    private minItems?;
    private maxItems?;
    min(n: number): this;
    max(n: number): this;
    validate(input: unknown, path?: string): ValidationResult<readonly T[]>;
}
export type InferSchema<T> = T extends BaseSchema<infer R> ? R : never;
export type ShapeDefinition = Record<string, BaseSchema<any>>;
export type InferShape<T extends ShapeDefinition> = {
    [K in keyof T]: InferSchema<T[K]>;
};
export declare class ObjectSchema<TShape extends ShapeDefinition> extends BaseSchema<InferShape<TShape>> {
    readonly shape: TShape;
    constructor(shape: TShape);
    validate(input: unknown, path?: string): ValidationResult<InferShape<TShape>>;
}
export declare function string(): StringSchema;
export declare function number(): NumberSchema;
export declare function boolean(): BooleanSchema;
export declare function date(): DateSchema;
export declare function email(): StringSchema;
export declare function array<T>(itemSchema: BaseSchema<T>): ArraySchema<T>;
export declare function object<TShape extends ShapeDefinition>(shape: TShape): ObjectSchema<TShape>;
export declare function schema<TShape extends ShapeDefinition>(shape: TShape): ObjectSchema<TShape>;
//# sourceMappingURL=schema.d.ts.map