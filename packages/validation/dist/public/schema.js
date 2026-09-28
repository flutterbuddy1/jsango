export class BaseSchema {
    isOptional = false;
    defaultValue;
    optional() {
        this.isOptional = true;
        return this;
    }
    default(val) {
        this.defaultValue = val;
        return this;
    }
    success(data) {
        return { success: true, data };
    }
    failure(errors) {
        return { success: false, errors: Object.freeze(errors) };
    }
}
export class StringSchema extends BaseSchema {
    minLength;
    maxLength;
    isEmail = false;
    pattern;
    min(length) {
        this.minLength = length;
        return this;
    }
    max(length) {
        this.maxLength = length;
        return this;
    }
    email() {
        this.isEmail = true;
        return this;
    }
    regex(pat) {
        this.pattern = pat;
        return this;
    }
    validate(input, path = 'value') {
        if (input === undefined || input === null) {
            if (this.defaultValue !== undefined) {
                return this.success(this.defaultValue);
            }
            if (this.isOptional) {
                return this.success(undefined);
            }
            return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
        }
        if (typeof input !== 'string') {
            return this.failure([{ field: path, message: `${path} must be a string`, code: 'TYPE_MISMATCH' }]);
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
                return this.failure([{ field: path, message: `${path} must be a valid email address`, code: 'INVALID_EMAIL' }]);
            }
        }
        if (this.pattern && !this.pattern.test(input)) {
            return this.failure([{ field: path, message: `${path} format is invalid`, code: 'INVALID_FORMAT' }]);
        }
        return this.success(input);
    }
}
export class NumberSchema extends BaseSchema {
    minValue;
    maxValue;
    isInteger = false;
    min(min) {
        this.minValue = min;
        return this;
    }
    max(max) {
        this.maxValue = max;
        return this;
    }
    int() {
        this.isInteger = true;
        return this;
    }
    positive() {
        this.minValue = 0.000001;
        return this;
    }
    validate(input, path = 'value') {
        if (input === undefined || input === null) {
            if (this.defaultValue !== undefined) {
                return this.success(this.defaultValue);
            }
            if (this.isOptional) {
                return this.success(undefined);
            }
            return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
        }
        const num = typeof input === 'number' ? input : Number(input);
        if (isNaN(num)) {
            return this.failure([{ field: path, message: `${path} must be a valid number`, code: 'TYPE_MISMATCH' }]);
        }
        if (this.isInteger && !Number.isInteger(num)) {
            return this.failure([{ field: path, message: `${path} must be an integer`, code: 'INVALID_INTEGER' }]);
        }
        if (this.minValue !== undefined && num < this.minValue) {
            return this.failure([{ field: path, message: `${path} must be greater than or equal to ${this.minValue}`, code: 'MIN_VALUE' }]);
        }
        if (this.maxValue !== undefined && num > this.maxValue) {
            return this.failure([{ field: path, message: `${path} must be less than or equal to ${this.maxValue}`, code: 'MAX_VALUE' }]);
        }
        return this.success(num);
    }
}
export class BooleanSchema extends BaseSchema {
    validate(input, path = 'value') {
        if (input === undefined || input === null) {
            if (this.defaultValue !== undefined) {
                return this.success(this.defaultValue);
            }
            if (this.isOptional) {
                return this.success(undefined);
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
        return this.failure([{ field: path, message: `${path} must be a boolean`, code: 'TYPE_MISMATCH' }]);
    }
}
export class DateSchema extends BaseSchema {
    validate(input, path = 'value') {
        if (input === undefined || input === null) {
            if (this.defaultValue !== undefined) {
                return this.success(this.defaultValue);
            }
            if (this.isOptional) {
                return this.success(undefined);
            }
            return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
        }
        const date = input instanceof Date ? input : new Date(String(input));
        if (isNaN(date.getTime())) {
            return this.failure([{ field: path, message: `${path} must be a valid date`, code: 'INVALID_DATE' }]);
        }
        return this.success(date);
    }
}
export class ArraySchema extends BaseSchema {
    itemSchema;
    constructor(itemSchema) {
        super();
        this.itemSchema = itemSchema;
    }
    minItems;
    maxItems;
    min(n) {
        this.minItems = n;
        return this;
    }
    max(n) {
        this.maxItems = n;
        return this;
    }
    validate(input, path = 'array') {
        if (input === undefined || input === null) {
            if (this.defaultValue !== undefined) {
                return this.success(this.defaultValue);
            }
            if (this.isOptional) {
                return this.success(undefined);
            }
            return this.failure([{ field: path, message: `${path} is required`, code: 'REQUIRED' }]);
        }
        if (!Array.isArray(input)) {
            return this.failure([{ field: path, message: `${path} must be an array`, code: 'TYPE_MISMATCH' }]);
        }
        if (this.minItems !== undefined && input.length < this.minItems) {
            return this.failure([{ field: path, message: `${path} must contain at least ${this.minItems} items`, code: 'MIN_ITEMS' }]);
        }
        if (this.maxItems !== undefined && input.length > this.maxItems) {
            return this.failure([{ field: path, message: `${path} must contain at most ${this.maxItems} items`, code: 'MAX_ITEMS' }]);
        }
        const errors = [];
        const validItems = [];
        for (let i = 0; i < input.length; i++) {
            const result = this.itemSchema.validate(input[i], `${path}[${i}]`);
            if (result.success) {
                validItems.push(result.data);
            }
            else {
                errors.push(...result.errors);
            }
        }
        if (errors.length > 0) {
            return this.failure(errors);
        }
        return this.success(Object.freeze(validItems));
    }
}
export class ObjectSchema extends BaseSchema {
    shape;
    constructor(shape) {
        super();
        this.shape = shape;
    }
    validate(input, path = '') {
        if (input === undefined || input === null) {
            if (this.defaultValue !== undefined) {
                return this.success(this.defaultValue);
            }
            if (this.isOptional) {
                return this.success(undefined);
            }
            const field = path || 'value';
            return this.failure([{ field, message: `${field} is required`, code: 'REQUIRED' }]);
        }
        if (typeof input !== 'object' || Array.isArray(input)) {
            const field = path || 'value';
            return this.failure([{ field, message: `${field} must be an object`, code: 'TYPE_MISMATCH' }]);
        }
        const record = input;
        const errors = [];
        const sanitized = {};
        for (const [key, schema] of Object.entries(this.shape)) {
            const fieldPath = path ? `${path}.${key}` : key;
            const res = schema.validate(record[key], fieldPath);
            if (res.success) {
                if (res.data !== undefined) {
                    sanitized[key] = res.data;
                }
            }
            else {
                errors.push(...res.errors);
            }
        }
        if (errors.length > 0) {
            return this.failure(errors);
        }
        return this.success(sanitized);
    }
}
// Fluent helper constructors
export function string() {
    return new StringSchema();
}
export function number() {
    return new NumberSchema();
}
export function boolean() {
    return new BooleanSchema();
}
export function date() {
    return new DateSchema();
}
export function email() {
    return new StringSchema().email();
}
export function array(itemSchema) {
    return new ArraySchema(itemSchema);
}
export function object(shape) {
    return new ObjectSchema(shape);
}
export function schema(shape) {
    return new ObjectSchema(shape);
}
//# sourceMappingURL=schema.js.map