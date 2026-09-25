import type { AdminResourceOptions, AdminResourceSchema, AdminSortDirection } from './types.js';
import { AdminField } from './fields.js';
import { AdminFilter } from './filters.js';
import { AdminAction, AdminBulkAction } from './actions.js';

export class AdminResource {
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

  constructor(options: AdminResourceOptions) {
    this.modelName = options.modelName ?? options.id ?? 'Unknown';
    this.id = options.id ?? this.modelName.toLowerCase();
    this.label = options.label ?? AdminField.formatLabel(this.modelName);
    this.pluralLabel = options.pluralLabel ?? `${this.label}s`;
    this.navigationGroup = options.navigationGroup;
    this.navigationIcon = options.navigationIcon;
    this.navigationOrder = options.navigationOrder;
    this.primaryKey = options.primaryKey ?? 'id';

    if (options.fields) {
      for (const f of options.fields) {
        this.fields.set(f.name, new AdminField(f));
      }
    }

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
    this.canSoftDelete = options.canSoftDelete ?? false;

    if (options.filters) {
      for (const filter of options.filters) {
        this.filters.set(filter.name, new AdminFilter(filter));
      }
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

  public getSchema(): AdminResourceSchema {
    return {
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
    };
  }
}
