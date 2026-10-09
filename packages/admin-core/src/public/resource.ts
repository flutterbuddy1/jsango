import type { ModelMetadata, FieldType } from '@jsango/orm';
import type {
  AdminFieldConfig,
  AdminFieldType,
  AdminResourceOptions,
  AdminResourceSchema,
  AdminSortDirection,
} from './types.js';
import { AdminField, isSensitiveFieldName } from './fields.js';
import { AdminFilter } from './filters.js';
import { AdminAction, AdminBulkAction } from './actions.js';

export class AdminResource {
  /** The options this resource was created with (used to rebuild it once the model is known). */
  public readonly options: AdminResourceOptions;
  public readonly id: string;
  public readonly modelName: string;
  public readonly label: string;
  public readonly pluralLabel: string;
  public readonly navigationGroup?: string | undefined;
  public readonly navigationIcon?: string | undefined;
  public readonly navigationOrder?: number | undefined;
  public readonly primaryKey: string;

  public readonly fields = new Map<string, AdminField>();
  public readonly listFields: readonly string[];
  public readonly detailFields: readonly string[];
  public readonly createFields: readonly string[];
  public readonly editFields: readonly string[];
  public readonly searchFields: readonly string[];

  public readonly defaultSortField?: string | undefined;
  public readonly defaultSortDirection: AdminSortDirection;
  public readonly defaultPageSize: number;
  public readonly maxPageSize: number;

  public readonly filters = new Map<string, AdminFilter>();
  public readonly actions = new Map<string, AdminAction>();
  public readonly bulkActions = new Map<string, AdminBulkAction>();
  public readonly canSoftDelete: boolean;
  public readonly exactCount: boolean;
  public readonly exportBatchSize: number;

  constructor(options: AdminResourceOptions) {
    this.options = options;
    this.modelName = options.modelName ?? options.modelMetadata?.name ?? options.id ?? 'Unknown';
    this.id = options.id ?? this.modelName.toLowerCase();
    this.label = options.label ?? AdminField.formatLabel(this.modelName);
    this.pluralLabel = options.pluralLabel ?? pluralize(this.label);
    this.navigationGroup = options.navigationGroup;
    this.navigationIcon = options.navigationIcon;
    this.navigationOrder = options.navigationOrder;
    this.primaryKey = options.primaryKey ?? options.modelMetadata?.primaryKey ?? 'id';

    // Fields come from the model; `options.fields` overrides them by name or adds new ones
    // (e.g. computed columns), so customizing one field never loses the others.
    const configs = new Map<string, AdminFieldConfig>();
    if (options.modelMetadata) {
      for (const f of deriveFieldsFromModel(options.modelMetadata)) configs.set(f.name, f);
    }
    for (const f of options.fields ?? []) configs.set(f.name, { ...configs.get(f.name), ...f });
    for (const f of configs.values()) this.fields.set(f.name, new AdminField(f));

    const allFieldNames = [...this.fields.keys()];
    this.listFields =
      options.listFields ??
      allFieldNames.filter((n) => !this.fields.get(n)?.hidden && !this.fields.get(n)?.sensitive);
    this.detailFields =
      options.detailFields ?? allFieldNames.filter((n) => !this.fields.get(n)?.hidden);
    this.createFields =
      options.createFields ??
      allFieldNames.filter(
        (n) => n !== this.primaryKey && !this.fields.get(n)?.readonly && !this.fields.get(n)?.hidden
      );
    this.editFields =
      options.editFields ??
      allFieldNames.filter(
        (n) => n !== this.primaryKey && !this.fields.get(n)?.readonly && !this.fields.get(n)?.hidden
      );
    this.searchFields =
      options.searchFields ?? allFieldNames.filter((n) => this.fields.get(n)?.searchable);

    this.defaultSortField = options.defaultSortField ?? this.primaryKey;
    this.defaultSortDirection = options.defaultSortDirection ?? 'asc';
    this.defaultPageSize = options.defaultPageSize ?? 25;
    this.maxPageSize = options.maxPageSize ?? 100;
    this.canSoftDelete =
      options.canSoftDelete ?? options.modelMetadata?.softDelete.enabled ?? false;
    this.exactCount = options.exactCount ?? true;
    this.exportBatchSize = options.exportBatchSize ?? 1000;

    // Default filters: boolean and choice fields marked filterable.
    const filters =
      options.filters ??
      [...this.fields.values()]
        .filter((f) => f.filterable && (f.type === 'boolean' || f.enumChoices))
        .map((f) => ({
          name: f.name,
          field: f.name,
          type: f.type === 'boolean' ? ('boolean' as const) : ('enum' as const),
          label: f.label,
          choices: f.enumChoices,
        }));
    for (const filter of filters) {
      this.filters.set(filter.name, new AdminFilter(filter));
    }

    if (options.actions) {
      for (const action of options.actions) {
        this.actions.set(action.id, new AdminAction(action));
      }
    }

    if (options.bulkActions) {
      for (const bulkAction of options.bulkActions) {
        this.bulkActions.set(bulkAction.id, new AdminBulkAction(bulkAction));
      }
    }
  }

  public getField(name: string): AdminField | undefined {
    return this.fields.get(name);
  }

  private _cachedSchema?: AdminResourceSchema | undefined;

  public getSchema(): AdminResourceSchema {
    if (this._cachedSchema) {
      return this._cachedSchema;
    }

    this._cachedSchema = {
      id: this.id,
      label: this.label,
      pluralLabel: this.pluralLabel,
      navigationGroup: this.navigationGroup,
      navigationIcon: this.navigationIcon,
      navigationOrder: this.navigationOrder,
      primaryKey: this.primaryKey,
      fields: [...this.fields.values()].map((f) => f.toJSON()),
      listFields: this.listFields,
      detailFields: this.detailFields,
      createFields: this.createFields,
      editFields: this.editFields,
      searchFields: this.searchFields,
      defaultSortField: this.defaultSortField,
      defaultSortDirection: this.defaultSortDirection,
      defaultPageSize: this.defaultPageSize,
      maxPageSize: this.maxPageSize,
      filters: [...this.filters.values()].map((flt) => flt.toJSON()),
      actions: [...this.actions.values()].map((a) => a.toJSON()),
      bulkActions: [...this.bulkActions.values()].map((ba) => ba.toJSON()),
      canSoftDelete: this.canSoftDelete,
      exactCount: this.exactCount,
    };

    return this._cachedSchema;
  }
}

/** Admin field configs for every column and relation of an ORM model. */
export function deriveFieldsFromModel(metadata: ModelMetadata): AdminFieldConfig[] {
  const fields: AdminFieldConfig[] = [];
  for (const [name, fieldMeta] of metadata.fields) {
    const type = mapOrmTypeToAdminType(fieldMeta.type, name);
    const sensitive = isSensitiveFieldName(name);
    const searchable = (type === 'text' || type === 'email') && !sensitive;
    fields.push({
      name,
      type,
      required:
        !fieldMeta.nullable && !fieldMeta.primaryKey && fieldMeta.defaultValue === undefined,
      readonly: fieldMeta.primaryKey || name === 'createdAt' || name === 'updatedAt',
      sensitive,
      hidden: sensitive,
      sortable: type !== 'json',
      searchable,
      filterable: type === 'enum' || type === 'boolean' || type === 'date',
    });
  }
  for (const [name, rel] of metadata.relations) {
    const relationTarget = relationTargetName(rel['targetResolver']);
    // belongsTo: the foreign key column (e.g. `categoryId`) becomes the editable relation picker.
    const fkIndex =
      rel.type === 'belongsTo' ? fields.findIndex((f) => f.name === rel.foreignKey) : -1;
    if (fkIndex >= 0) {
      fields[fkIndex] = {
        ...fields[fkIndex]!,
        type: 'relation',
        label: fields[fkIndex]!.label ?? AdminField.formatLabel(name),
        relationTarget,
        relationType: 'belongsTo',
        searchable: false,
        filterable: true,
      };
      continue;
    }
    fields.push({
      name,
      type: 'relation',
      relationTarget,
      relationType: rel.type,
      readonly: true,
      sortable: false,
      searchable: false,
      filterable: rel.type === 'belongsTo',
    });
  }
  return fields;
}

function pluralize(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Model name of a relation target given as a name, a model class or a `() => Model` thunk. */
function relationTargetName(target: unknown): string | undefined {
  try {
    const resolved =
      typeof target === 'function' && !('metadata' in target)
        ? (target as () => unknown)()
        : target;
    if (typeof resolved === 'string') return resolved;
    const model = resolved as { metadata?: { name?: string }; name?: string } | undefined;
    return model?.metadata?.name ?? model?.name;
  } catch {
    return undefined; // target not defined yet
  }
}

function mapOrmTypeToAdminType(ormType: FieldType, name: string): AdminFieldType {
  if (isSensitiveFieldName(name)) return 'password';
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
