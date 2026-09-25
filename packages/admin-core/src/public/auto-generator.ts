import type { ModelMetadata, FieldType } from '@django-js/orm';
import type { AdminFieldConfig, AdminFieldType } from './types.js';
import { isSensitiveFieldName } from './fields.js';
import { AdminResource } from './resource.js';

export class AutoResourceGenerator {
  /**
   * Automatically derives a complete AdminResource configuration from ORM ModelMetadata.
   */
  public static generateFromModel(metadata: ModelMetadata): AdminResource {
    const fields: AdminFieldConfig[] = [];
    const searchFields: string[] = [];

    // 1. Process regular columns
    for (const [name, fieldMeta] of metadata.fields) {
      const fieldType = this.mapOrmTypeToAdminType(fieldMeta.type, name);
      const isSensitive = isSensitiveFieldName(name);
      const isSearchable = (fieldType === 'text' || fieldType === 'email') && !isSensitive;

      if (isSearchable) {
        searchFields.push(name);
      }

      fields.push({
        name,
        type: fieldType,
        label: undefined, // Will be formatted by AdminField
        required:
          !fieldMeta.nullable && !fieldMeta.primaryKey && fieldMeta.defaultValue === undefined,
        readonly: fieldMeta.primaryKey || name === 'createdAt' || name === 'updatedAt',
        sensitive: isSensitive,
        hidden: isSensitive,
        sortable: fieldType !== 'json',
        searchable: isSearchable,
        filterable: fieldType === 'enum' || fieldType === 'boolean' || fieldType === 'date',
      });
    }

    // 2. Process relations
    for (const [relName, relMeta] of metadata.relations) {
      fields.push({
        name: relName,
        type: 'relation',
        relationTarget:
          typeof relMeta['targetResolver'] === 'string' ? relMeta['targetResolver'] : undefined,
        relationType: relMeta.type,
        readonly: true,
        sortable: false,
        searchable: false,
        filterable: relMeta.type === 'belongsTo',
      });
    }

    return new AdminResource({
      id: metadata.name.toLowerCase(),
      modelName: metadata.name,
      primaryKey: metadata.primaryKey,
      modelMetadata: metadata,
      fields,
      searchFields,
      canSoftDelete: metadata.softDelete.enabled,
    });
  }

  private static mapOrmTypeToAdminType(ormType: FieldType, name: string): AdminFieldType {
    if (isSensitiveFieldName(name)) {
      return 'password';
    }

    if (/email/i.test(name)) return 'email';
    if (/url|website/i.test(name)) return 'url';

    switch (ormType) {
      case 'string':
        return 'text';
      case 'text':
        return 'textarea';
      case 'integer':
      case 'bigint':
      case 'float':
      case 'decimal':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'dateTime':
        return 'datetime';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      case 'json':
        return 'json';
      case 'uuid':
        return 'uuid';
      case 'binary':
        return 'file';
      default:
        return 'text';
    }
  }
}
