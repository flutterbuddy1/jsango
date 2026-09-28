/**
 * Search & Filter Bar component for resources
 */
import type { AdminResourceSchema } from '@jsango/admin-core';
export interface FilterBarProps {
    readonly schema: AdminResourceSchema;
    readonly searchQuery?: string | undefined;
    readonly activeFilters: Record<string, unknown>;
    readonly onSearchChange?: ((search: string) => void) | undefined;
    readonly onFilterChange?: ((key: string, value: unknown) => void) | undefined;
    readonly onClearFilters?: (() => void) | undefined;
}
export declare function renderFilterBar(props: FilterBarProps): string;
//# sourceMappingURL=filter-bar.d.ts.map