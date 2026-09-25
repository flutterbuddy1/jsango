import type { OpenApiSchema } from './types.js';

export interface ValidationSchemaDescriptor {
  readonly type?: string | undefined;
  readonly format?: string | undefined;
  readonly required?: readonly string[] | boolean | undefined;
  readonly properties?: Record<string, ValidationSchemaDescriptor> | undefined;
  readonly items?: ValidationSchemaDescriptor | undefined;
  readonly enum?: readonly unknown[] | undefined;
  readonly minimum?: number | undefined;
  readonly maximum?: number | undefined;
  readonly minLength?: number | undefined;
  readonly maxLength?: number | undefined;
  readonly pattern?: string | undefined;
  readonly description?: string | undefined;
  readonly default?: unknown;
  readonly nullable?: boolean | undefined;
}

export class ValidationAdapter {
  /**
   * Converts validation descriptor/metadata into a valid OpenApiSchema.
   */
  public static toOpenApiSchema(descriptor: ValidationSchemaDescriptor | unknown): OpenApiSchema {
    if (!descriptor || typeof descriptor !== 'object') {
      return { type: 'string' };
    }

    const d = descriptor as ValidationSchemaDescriptor;
    const schema: Record<string, unknown> = {};

    if (d.type) schema['type'] = d.type;
    if (d.format) schema['format'] = d.format;
    if (d.description) schema['description'] = d.description;
    if (d.default !== undefined) schema['default'] = d.default;
    if (d.minimum !== undefined) schema['minimum'] = d.minimum;
    if (d.maximum !== undefined) schema['maximum'] = d.maximum;
    if (d.minLength !== undefined) schema['minLength'] = d.minLength;
    if (d.maxLength !== undefined) schema['maxLength'] = d.maxLength;
    if (d.pattern !== undefined) schema['pattern'] = d.pattern;
    if (d.enum !== undefined) schema['enum'] = d.enum;
    if (d.nullable !== undefined) schema['nullable'] = d.nullable;

    if (d.type === 'array' && d.items) {
      schema['items'] = ValidationAdapter.toOpenApiSchema(d.items);
    }

    if (d.properties) {
      const props: Record<string, OpenApiSchema> = {};
      const requiredFields: string[] = [];

      for (const [key, propDescriptor] of Object.entries(d.properties)) {
        props[key] = ValidationAdapter.toOpenApiSchema(propDescriptor);
        if (propDescriptor.required === true) {
          requiredFields.push(key);
        }
      }

      schema['type'] = 'object';
      schema['properties'] = props;

      if (Array.isArray(d.required)) {
        schema['required'] = d.required;
      } else if (requiredFields.length > 0) {
        schema['required'] = requiredFields;
      }
    }

    return schema as OpenApiSchema;
  }
}
