/**
 * Resource List View for @jsango/admin-ui
 */

import type { AdminResourceSchema, AdminSortDirection } from '@jsango/admin-core';
import { renderPageHeader } from '../layout/breadcrumbs.js';
import { renderFilterBar } from '../data-table/filter-bar.js';
import { renderDataTable } from '../data-table/data-table.js';
import { renderBulkActionBar } from '../data-table/bulk-action-bar.js';

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

export function renderResourceListView(props: ResourceListViewProps): string {
  const { schema, canCreate = true } = props;

  const createButtonHtml = canCreate
    ? `
      <a
        href="/admin/resources/${schema.id}/create"
        class="admin-create-btn inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
      >
        <span>+</span>
        <span>Add ${escapeHtml(schema.label)}</span>
      </a>
    `
    : '';

  const headerHtml = renderPageHeader({
    title: schema.pluralLabel,
    subtitle: `Manage, filter, and inspect ${schema.pluralLabel.toLowerCase()}`,
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: schema.pluralLabel, active: true },
    ],
    actionsHtml: createButtonHtml,
  });

  const filterBarHtml = renderFilterBar({
    schema,
    searchQuery: props.searchQuery,
    activeFilters: props.activeFilters,
  });

  const tableHtml = renderDataTable({
    schema,
    items: props.items,
    total: props.total,
    page: props.page,
    pageSize: props.pageSize,
    totalPages: props.totalPages,
    sortField: props.sortField,
    sortDirection: props.sortDirection,
    selectedIds: props.selectedIds,
    isLoading: props.isLoading,
    canCreate: props.canCreate,
    canEdit: props.canEdit,
    canDelete: props.canDelete,
  });

  const bulkActionBarHtml = renderBulkActionBar({
    schema,
    selectedCount: props.selectedIds ? props.selectedIds.length : 0,
  });

  return `
    ${headerHtml}
    ${filterBarHtml}
    ${tableHtml}
    ${bulkActionBarHtml}
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
