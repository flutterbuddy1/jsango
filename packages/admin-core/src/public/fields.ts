import type { AdminFieldConfig, AdminFieldType, AdminWidgetType } from './types.js';

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /hash/i,
  /private[_-]?key/i,
  /credential/i,
  /auth/i,
];

/**
 * Determines whether a field name corresponds to a sensitive property.
 */
export function isSensitiveFieldName(name: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Represents a configured field in an Admin Resource.
 */
export class AdminField {
  public readonly name: string;
  public readonly type: AdminFieldType;
  public readonly label: string;
  public readonly description?: string | undefined;
  public readonly required: boolean;
  public readonly readonly: boolean;
  public readonly hidden: boolean;
  public readonly sensitive: boolean;
  public readonly sortable: boolean;
  public readonly searchable: boolean;
  public readonly filterable: boolean;
  public readonly widget: AdminWidgetType;
  public readonly enumChoices?:
    readonly { readonly label: string; readonly value: string | number }[] | undefined;
  public readonly relationTarget?: string | undefined;
  public readonly relationType?: 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany' | undefined;
  public readonly computedGetter?: ((item: Record<string, unknown>) => unknown) | undefined;

  constructor(config: AdminFieldConfig) {
    this.name = config.name;
    this.type = config.type ?? (config.computedGetter ? 'computed' : 'text');
    this.label = config.label ?? AdminField.formatLabel(config.name);
    this.description = config.description;
    this.required = config.required ?? false;
    this.readonly = config.readonly ?? (this.type === 'computed' || this.type === 'readonly');
    this.sensitive = config.sensitive ?? isSensitiveFieldName(config.name);
    this.hidden = config.hidden ?? false;
    this.sortable = config.sortable ?? (this.type !== 'computed' && this.type !== 'json');
    this.searchable = config.searchable ?? (this.type === 'text' || this.type === 'email');
    this.filterable =
      config.filterable ??
      (this.type === 'enum' || this.type === 'boolean' || this.type === 'date');
    this.widget = config.widget ?? AdminField.defaultWidgetForType(this.type);
    this.enumChoices = config.enumChoices;
    this.relationTarget = config.relationTarget;
    this.relationType = config.relationType;
    this.computedGetter = config.computedGetter;
  }

  public toJSON(): AdminFieldConfig {
    return {
      name: this.name,
      type: this.type,
      label: this.label,
      description: this.description,
      required: this.required,
      readonly: this.readonly,
      hidden: this.hidden,
      sensitive: this.sensitive,
      sortable: this.sortable,
      searchable: this.searchable,
      filterable: this.filterable,
      widget: this.widget,
      enumChoices: this.enumChoices,
      relationTarget: this.relationTarget,
      relationType: this.relationType,
    };
  }

  public static formatLabel(name: string): string {
    // Converts camelCase or snake_case to Title Case (e.g. "createdAt" -> "Created At", "user_id" -> "User Id")
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .replace(/^\s+/, '')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  public static defaultWidgetForType(type: AdminFieldType): AdminWidgetType {
    switch (type) {
      case 'text':
      case 'email':
      case 'url':
      case 'uuid':
        return 'text-input';
      case 'textarea':
        return 'textarea';
      case 'number':
        return 'number-input';
      case 'boolean':
        return 'checkbox';
      case 'enum':
        return 'select';
      case 'date':
        return 'date-picker';
      case 'datetime':
        return 'datetime-picker';
      case 'relation':
        return 'relation-select';
      case 'file':
        return 'file-upload';
      case 'image':
        return 'image-upload';
      case 'json':
        return 'json-editor';
      case 'password':
        return 'password-input';
      default:
        return 'text-input';
    }
  }
}
