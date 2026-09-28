/**
 * Resource List View for @jsango/admin-ui
 */
import type { AdminResourceSchema, AdminSortDirection } from '@jsango/admin-core';
export interface ResourceListViewProps {
    readonly schema: AdminResourceSchema;
    readonly items: readonly Record<string, unknown>[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
    readonly searchQuery?: string | undefined;
    readonly activeFilters: Record<string, unknown>;
    readonly sortField?: string | undefined;
    readonly sortDirection?: AdminSortDirection | undefined;
    readonly selectedIds?: readonly (string | number)[] | undefined;
    readonly isLoading?: boolean | undefined;
    readonly canCreate?: boolean | undefined;
    readonly canEdit?: boolean | undefined;
    readonly canDelete?: boolean | undefined;
}
export declare function renderResourceListView(props: ResourceListViewProps): string;
//# sourceMappingURL=resource-list-view.d.ts.map