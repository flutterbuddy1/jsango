import type { ModelMetadata } from '@django-js/orm';

export type AdminFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'email'
  | 'url'
  | 'uuid'
  | 'enum'
  | 'json'
  | 'password'
  | 'file'
  | 'image'
  | 'relation'
  | 'computed'
  | 'readonly';

export type AdminWidgetType =
  | 'text-input'
  | 'textarea'
  | 'number-input'
  | 'checkbox'
  | 'select'
  | 'multi-select'
  | 'date-picker'
  | 'datetime-picker'
  | 'relation-select'
  | 'file-upload'
  | 'image-upload'
  | 'json-editor'
  | 'password-input'
  | 'badge'
  | 'custom';

export type AdminSortDirection = 'asc' | 'desc';

export type AdminPaginationType = 'offset' | 'cursor';

export type AdminFilterType =
  'text' | 'boolean' | 'number-range' | 'date-range' | 'enum' | 'relation' | 'null';

export interface AdminFieldConfig {
  readonly name: string;
  readonly type?: AdminFieldType | undefined;
  readonly label?: string | undefined;
  readonly description?: string | undefined;
  readonly required?: boolean | undefined;
  readonly readonly?: boolean | undefined;
  readonly hidden?: boolean | undefined;
  readonly sensitive?: boolean | undefined;
  readonly sortable?: boolean | undefined;
  readonly searchable?: boolean | undefined;
  readonly filterable?: boolean | undefined;
  readonly widget?: AdminWidgetType | undefined;
  readonly enumChoices?:
    readonly { readonly label: string; readonly value: string | number }[] | undefined;
  readonly relationTarget?: string | undefined;
  readonly relationType?: 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany' | undefined;
  readonly computedGetter?: ((item: Record<string, unknown>) => unknown) | undefined;
}

export interface AdminFilterConfig {
  readonly name: string;
  readonly type: AdminFilterType;
  readonly field: string;
  readonly label?: string | undefined;
  readonly choices?:
    readonly { readonly label: string; readonly value: string | number }[] | undefined;
}

export interface AdminActionConfig<TInput = unknown, TResult = unknown> {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly permission?: string | undefined;
  readonly requiresConfirmation?: boolean | undefined;
  readonly confirmationMessage?: string | undefined;
  readonly inputSchema?: unknown | undefined;
  readonly handler?: (options: {
    readonly item: Record<string, unknown>;
    readonly input?: TInput | undefined;
    readonly actor?: unknown | undefined;
  }) => Promise<TResult> | TResult;
}

export interface AdminBulkActionConfig<TInput = unknown, TResult = unknown> {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly permission?: string | undefined;
  readonly requiresConfirmation?: boolean | undefined;
  readonly confirmationMessage?: string | undefined;
  readonly inputSchema?: unknown | undefined;
  readonly handler?: (options: {
    readonly ids: readonly (string | number)[];
    readonly input?: TInput | undefined;
    readonly actor?: unknown | undefined;
  }) => Promise<TResult> | TResult;
}

export interface AdminResourceOptions {
  readonly id?: string | undefined;
  readonly modelName?: string | undefined;
  readonly label?: string | undefined;
  readonly pluralLabel?: string | undefined;
  readonly navigationGroup?: string | undefined;
  readonly navigationIcon?: string | undefined;
  readonly navigationOrder?: number | undefined;
  readonly primaryKey?: string | undefined;
  readonly modelMetadata?: ModelMetadata | undefined;
  readonly fields?: readonly AdminFieldConfig[] | undefined;
  readonly listFields?: readonly string[] | undefined;
  readonly detailFields?: readonly string[] | undefined;
  readonly createFields?: readonly string[] | undefined;
  readonly editFields?: readonly string[] | undefined;
  readonly searchFields?: readonly string[] | undefined;
  readonly defaultSortField?: string | undefined;
  readonly defaultSortDirection?: AdminSortDirection | undefined;
  readonly defaultPageSize?: number | undefined;
  readonly maxPageSize?: number | undefined;
  readonly filters?: readonly AdminFilterConfig[] | undefined;
  readonly actions?: readonly AdminActionConfig[] | undefined;
  readonly bulkActions?: readonly AdminBulkActionConfig[] | undefined;
  readonly canSoftDelete?: boolean | undefined;
}

export interface AdminResourceSchema {
  readonly id: string;
  readonly label: string;
  readonly pluralLabel: string;
  readonly navigationGroup?: string | undefined;
  readonly navigationIcon?: string | undefined;
  readonly navigationOrder?: number | undefined;
  readonly primaryKey: string;
  readonly fields: readonly AdminFieldConfig[];
  readonly listFields: readonly string[];
  readonly detailFields: readonly string[];
  readonly createFields: readonly string[];
  readonly editFields: readonly string[];
  readonly searchFields: readonly string[];
  readonly defaultSortField?: string | undefined;
  readonly defaultSortDirection: AdminSortDirection;
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  readonly filters: readonly AdminFilterConfig[];
  readonly actions: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly requiresConfirmation: boolean;
    readonly confirmationMessage?: string | undefined;
  }>;
  readonly bulkActions: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly requiresConfirmation: boolean;
    readonly confirmationMessage?: string | undefined;
  }>;
  readonly canSoftDelete: boolean;
}
