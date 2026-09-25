import type { OpenApiSchema } from './types.js';

export interface ModelFieldDescriptor {
  readonly name: string;
  readonly type: string; // 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'json' | etc.
  readonly nullable?: boolean | undefined;
  readonly primaryKey?: boolean | undefined;
  readonly autoIncrement?: boolean | undefined;
  readonly defaultValue?: unknown;
}

export interface ModelMetadataDescriptor {
  readonly name: string;
  readonly tableName?: string | undefined;
  readonly primaryKey?: string | undefined;
  readonly fields: readonly ModelFieldDescriptor[];
}

export class OrmAdapter {
  /**
   * Generates a component schema for an ORM model representation.
   */
  public static toModelSchema(model: ModelMetadataDescriptor): OpenApiSchema {
    const properties: Record<string, OpenApiSchema> = {};
    const required: string[] = [];

    for (const field of model.fields) {
      properties[field.name] = OrmAdapter.fieldToSchema(field);
      if (!field.nullable) {
        required.push(field.name);
      }
    }

    return {
      type: 'object',
      title: model.name,
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  /**
   * Generates a component schema for creating a new record of the model.
   * Auto-incrementing or readonly primary keys are excluded or made optional.
   */
  public static toCreateInputSchema(model: ModelMetadataDescriptor): OpenApiSchema {
    const properties: Record<string, OpenApiSchema> = {};
    const required: string[] = [];

    for (const field of model.fields) {
      if (field.autoIncrement || (field.primaryKey && field.type === 'number')) {
        continue;
      }
      properties[field.name] = OrmAdapter.fieldToSchema(field);
      if (!field.nullable && field.defaultValue === undefined) {
        required.push(field.name);
      }
    }

    return {
      type: 'object',
      title: `Create${model.name}Input`,
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  private static fieldToSchema(field: ModelFieldDescriptor): OpenApiSchema {
    const schema: Record<string, unknown> = {};

    switch (field.type.toLowerCase()) {
      case 'int':
      case 'integer':
      case 'bigint':
      case 'smallint':
        schema['type'] = 'integer';
        break;
      case 'number':
      case 'float':
      case 'double':
      case 'decimal':
        schema['type'] = 'number';
        break;
      case 'boolean':
      case 'bool':
        schema['type'] = 'boolean';
        break;
      case 'date':
        schema['type'] = 'string';
        schema['format'] = 'date';
        break;
      case 'datetime':
      case 'timestamp':
        schema['type'] = 'string';
        schema['format'] = 'date-time';
        break;
      case 'uuid':
        schema['type'] = 'string';
        schema['format'] = 'uuid';
        break;
      case 'email':
        schema['type'] = 'string';
        schema['format'] = 'email';
        break;
      case 'json':
        schema['type'] = 'object';
        schema['additionalProperties'] = true;
        break;
      default:
        schema['type'] = 'string';
        break;
    }

    if (field.nullable) {
      schema['nullable'] = true;
    }
    if (field.defaultValue !== undefined) {
      schema['default'] = field.defaultValue;
    }

    return schema as OpenApiSchema;
  }
}
