import type { IValidator, ValidationResult, ValidationErrorItem } from './validation.js';

export abstract class BaseSchema<T = unknown> implements IValidator<T> {
  protected isOptional = false;
  protected defaultValue?: T | undefined;

  public optional(): BaseSchema<T | undefined> {
    this.isOptional = true;
    return this as unknown as BaseSchema<T | undefined>;
  }

  public default(val: T): this {
    this.defaultValue = val;
    return this;
  }

  public abstract validate(input: unknown, path?: string): ValidationResult<T>;

  protected success(data: T): ValidationResult<T> {
    return { success: true, data };
  }

  protected failure(errors: ValidationErrorItem[]): ValidationResult<T> {
    return { success: false, errors: Object.freeze(errors) };
  }
}

export class StringSchema extends BaseSchema<string> {
  private minLength?: number;
  private maxLength?: number;
  private isEmail = false;
  private pattern?: RegExp;

  public min(length: number): this {
    this.minLength = length;
    return this;
  }

  public max(length: number): this {
    this.maxLength = length;
    return this;
  }

  public email(): this {
    this.isEmail = true;
    return this;
  }

  public regex(pat: RegExp): this {
    this.pattern = pat;
    return this;
  }

  public validate(input: unknown, path = 'value'): ValidationResult<string> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) {
        return this.success(this.defaultValue);
      }
      if (this.isOptional) {
        return this.success(undefined as unknown as string);
      }
      return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
    }

    if (typeof input !== 'string') {
      return this.failure([
        { field: path, message: `${path} must be a string`, code: 'TYPE_MISMATCH' },
      ]);
    }

    if (this.minLength !== undefined && input.length < this.minLength) {
      return this.failure([
        {
          field: path,
          message: `${path} must be at least ${this.minLength} characters`,
          code: 'MIN_LENGTH',
        },
      ]);
    }

    if (this.maxLength !== undefined && input.length > this.maxLength) {
      return this.failure([
        {
          field: path,
          message: `${path} must be at most ${this.maxLength} characters`,
          code: 'MAX_LENGTH',
        },
      ]);
    }

    if (this.isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        return this.failure([
          { field: path, message: `${path} must be a valid email address`, code: 'INVALID_EMAIL' },
        ]);
      }
    }

    if (this.pattern && !this.pattern.test(input)) {
      return this.failure([
        { field: path, message: `${path} format is invalid`, code: 'INVALID_FORMAT' },
      ]);
    }

    return this.success(input);
  }
}

export class NumberSchema extends BaseSchema<number> {
  private minValue?: number;
  private maxValue?: number;
  private isInteger = false;

  public min(min: number): this {
    this.minValue = min;
    return this;
  }

  public max(max: number): this {
    this.maxValue = max;
    return this;
  }

  public int(): this {
    this.isInteger = true;
    return this;
  }

  public positive(): this {
    this.minValue = 0.000001;
    return this;
  }

  public validate(input: unknown, path = 'value'): ValidationResult<number> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) {
        return this.success(this.defaultValue);
      }
      if (this.isOptional) {
        return this.success(undefined as unknown as number);
      }
      return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
    }

    const num = typeof input === 'number' ? input : Number(input);

    if (isNaN(num)) {
      return this.failure([
        { field: path, message: `${path} must be a valid number`, code: 'TYPE_MISMATCH' },
      ]);
    }

    if (this.isInteger && !Number.isInteger(num)) {
      return this.failure([
        { field: path, message: `${path} must be an integer`, code: 'INVALID_INTEGER' },
      ]);
    }

    if (this.minValue !== undefined && num < this.minValue) {
      return this.failure([
        {
          field: path,
          message: `${path} must be greater than or equal to ${this.minValue}`,
          code: 'MIN_VALUE',
        },
      ]);
    }

    if (this.maxValue !== undefined && num > this.maxValue) {
      return this.failure([
        {
          field: path,
          message: `${path} must be less than or equal to ${this.maxValue}`,
          code: 'MAX_VALUE',
        },
      ]);
    }

    return this.success(num);
  }
}

export class BooleanSchema extends BaseSchema<boolean> {
  public validate(input: unknown, path = 'value'): ValidationResult<boolean> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) {
        return this.success(this.defaultValue);
      }
      if (this.isOptional) {
        return this.success(undefined as unknown as boolean);
      }
      return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
    }

    if (typeof input === 'boolean') {
      return this.success(input);
    }

    if (input === 'true' || input === 1 || input === '1') {
      return this.success(true);
    }
    if (input === 'false' || input === 0 || input === '0') {
      return this.success(false);
    }

    return this.failure([
      { field: path, message: `${path} must be a boolean`, code: 'TYPE_MISMATCH' },
    ]);
  }
}

export class DateSchema extends BaseSchema<Date> {
  public validate(input: unknown, path = 'value'): ValidationResult<Date> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) {
        return this.success(this.defaultValue);
      }
      if (this.isOptional) {
        return this.success(undefined as unknown as Date);
      }
      return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
    }

    const date = input instanceof Date ? input : new Date(String(input));

    if (isNaN(date.getTime())) {
      return this.failure([
        { field: path, message: `${path} must be a valid date`, code: 'INVALID_DATE' },
      ]);
    }

    return this.success(date);
  }
}

export class ArraySchema<T> extends BaseSchema<readonly T[]> {
  constructor(private readonly itemSchema: BaseSchema<T>) {
    super();
  }

  private minItems?: number;
  private maxItems?: number;

  public min(n: number): this {
    this.minItems = n;
    return this;
  }

  public max(n: number): this {
    this.maxItems = n;
    return this;
  }

  public validate(input: unknown, path = 'array'): ValidationResult<readonly T[]> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) {
        return this.success(this.defaultValue);
      }
      if (this.isOptional) {
        return this.success(undefined as unknown as readonly T[]);
      }
      return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
    }

    if (!Array.isArray(input)) {
      return this.failure([
        { field: path, message: `${path} must be an array`, code: 'TYPE_MISMATCH' },
      ]);
    }

    if (this.minItems !== undefined && input.length < this.minItems) {
      return this.failure([
        {
          field: path,
          message: `${path} must contain at least ${this.minItems} items`,
          code: 'MIN_ITEMS',
        },
      ]);
    }

    if (this.maxItems !== undefined && input.length > this.maxItems) {
      return this.failure([
        {
          field: path,
          message: `${path} must contain at most ${this.maxItems} items`,
          code: 'MAX_ITEMS',
        },
      ]);
    }

    const errors: ValidationErrorItem[] = [];
    const validItems: T[] = [];

    for (let i = 0; i < input.length; i++) {
      const result = this.itemSchema.validate(input[i], `${path}[${i}]`);
      if (result.success) {
        validItems.push(result.data);
      } else {
        errors.push(...result.errors);
      }
    }

    if (errors.length > 0) {
      return this.failure(errors);
    }

    return this.success(Object.freeze(validItems));
  }
}

export type InferSchema<T> = T extends BaseSchema<infer R> ? R : never;

export type ShapeDefinition = Record<string, BaseSchema<any>>;

export type InferShape<T extends ShapeDefinition> = {
  [K in keyof T]: InferSchema<T[K]>;
};

export class ObjectSchema<TShape extends ShapeDefinition> extends BaseSchema<InferShape<TShape>> {
  constructor(public readonly shape: TShape) {
    super();
  }

  public validate(input: unknown, path = ''): ValidationResult<InferShape<TShape>> {
    if (input === undefined || input === null) {
      if (this.defaultValue !== undefined) {
        return this.success(this.defaultValue);
      }
      if (this.isOptional) {
        return this.success(undefined as unknown as InferShape<TShape>);
      }
      const field = path || 'value';
      return this.failure([{ field, message: `${field} is required`, code: 'REQUIRED' }]);
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      const field = path || 'value';
      return this.failure([
        { field, message: `${field} must be an object`, code: 'TYPE_MISMATCH' },
      ]);
    }

    const record = input as Record<string, unknown>;
    const errors: ValidationErrorItem[] = [];
    const sanitized: Record<string, unknown> = {};

    for (const [key, schema] of Object.entries(this.shape)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const res = schema.validate(record[key], fieldPath);
      if (res.success) {
        if (res.data !== undefined) {
          sanitized[key] = res.data;
        }
      } else {
        errors.push(...res.errors);
      }
    }

    if (errors.length > 0) {
      return this.failure(errors);
    }

    return this.success(sanitized as InferShape<TShape>);
  }
}

// Fluent helper constructors
export function string(): StringSchema {
  return new StringSchema();
}

export function number(): NumberSchema {
  return new NumberSchema();
}

export function boolean(): BooleanSchema {
  return new BooleanSchema();
}

export function date(): DateSchema {
  return new DateSchema();
}

export function email(): StringSchema {
  return new StringSchema().email();
}

export function array<T>(itemSchema: BaseSchema<T>): ArraySchema<T> {
  return new ArraySchema(itemSchema);
}

export function object<TShape extends ShapeDefinition>(shape: TShape): ObjectSchema<TShape> {
  return new ObjectSchema(shape);
}

export function schema<TShape extends ShapeDefinition>(shape: TShape): ObjectSchema<TShape> {
  return new ObjectSchema(shape);
}
