import type { AdminResourceOptions, AdminResourceSchema, AdminSortDirection } from './types.js';
import { AdminField } from './fields.js';
import { AdminFilter } from './filters.js';
import { AdminAction, AdminBulkAction } from './actions.js';
export declare class AdminResource {
    readonly id: string;
    readonly modelName: string;
    readonly label: string;
    readonly pluralLabel: string;
    readonly navigationGroup?: string | undefined;
    readonly navigationIcon?: string | undefined;
    readonly navigationOrder?: number | undefined;
    readonly primaryKey: string;
    readonly fields: Map<string, AdminField>;
    readonly listFields: readonly string[];
    readonly detailFields: readonly string[];
    readonly createFields: readonly string[];
    readonly editFields: readonly string[];
    readonly searchFields: readonly string[];
    readonly defaultSortField?: string | undefined;
    readonly defaultSortDirection: AdminSortDirection;
    readonly defaultPageSize: number;
    readonly maxPageSize: number;
    readonly filters: Map<string, AdminFilter>;
    readonly actions: Map<string, AdminAction<unknown, unknown>>;
    readonly bulkActions: Map<string, AdminBulkAction<unknown, unknown>>;
    readonly canSoftDelete: boolean;
    constructor(options: AdminResourceOptions);
    getField(name: string): AdminField | undefined;
    private _cachedSchema?;
    getSchema(): AdminResourceSchema;
}
//# sourceMappingURL=resource.d.ts.map