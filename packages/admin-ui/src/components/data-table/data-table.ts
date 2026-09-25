/**
 * Metadata-driven Data Table component for @jsango/admin-ui
 */

import type { AdminResourceSchema, AdminSortDirection, AdminFieldConfig } from '@jsango/admin-core';
import { formatDate, formatDateTime, formatNumber, truncateText } from '../../formatters/index.js';

export interface DataTableProps {
  readonly schema: AdminResourceSchema;
  readonly items: readonly Record<string, unknown>[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly sortField?: string | undefined;
  readonly sortDirection?: AdminSortDirection | undefined;
  readonly selectedIds?: readonly (string | number)[] | undefined;
  readonly isLoading?: boolean | undefined;
  readonly canCreate?: boolean | undefined;
  readonly canEdit?: boolean | undefined;
  readonly canDelete?: boolean | undefined;
}

export function renderDataTable(props: DataTableProps): string {
  const {
    schema,
    items,
    total,
    page,
    pageSize,
    totalPages,
    sortField,
    sortDirection,
    selectedIds = [],
  } = props;

  // Determine list columns from schema
  const fieldMap = new Map<string, AdminFieldConfig>(schema.fields.map((f) => [f.name, f]));
  const displayFieldNames =
    schema.listFields.length > 0 ? schema.listFields : schema.fields.map((f) => f.name).slice(0, 6);
  const columns = displayFieldNames.map((name) => fieldMap.get(name) ?? { name, label: name });

  const allSelected =
    items.length > 0 &&
    items.every((it) => selectedIds.includes(it[schema.primaryKey] as string | number));
  const someSelected = items.some((it) =>
    selectedIds.includes(it[schema.primaryKey] as string | number)
  );

  // Header
  const headersHtml = columns
    .map((col) => {
      const isSorted = sortField === col.name;
      const isSortable = col.sortable !== false;
      const arrow = isSorted ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

      return `
        <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border ${isSortable ? 'cursor-pointer select-none hover:text-foreground' : ''}" data-column="${col.name}">
          <div class="flex items-center space-x-1">
            <span>${escapeHtml(col.label ?? col.name)}</span>
            ${isSortable ? `<span class="text-xs font-bold text-primary">${arrow}</span>` : ''}
          </div>
        </th>
      `;
    })
    .join('\n');

  // Rows
  let bodyHtml: string;

  if (props.isLoading) {
    bodyHtml = `
      <tr>
        <td colspan="${columns.length + 2}" class="p-8 text-center text-muted-foreground">
          <div class="flex items-center justify-center space-x-2">
            <span class="admin-spinner animate-spin">⟳</span>
            <span>Loading records...</span>
          </div>
        </td>
      </tr>
    `;
  } else if (items.length === 0) {
    bodyHtml = `
      <tr>
        <td colspan="${columns.length + 2}" class="p-12 text-center text-muted-foreground">
          <div class="text-3xl mb-2">📦</div>
          <div class="font-medium text-foreground text-sm">No ${escapeHtml(schema.pluralLabel.toLowerCase())} found</div>
          <p class="text-xs text-muted-foreground mt-1">Try changing search filters or create a new record.</p>
        </td>
      </tr>
    `;
  } else {
    bodyHtml = items
      .map((item) => {
        const pkVal = item[schema.primaryKey] as string | number;
        const isSelected = selectedIds.includes(pkVal);

        const cellsHtml = columns
          .map((col) => {
            const rawVal = item[col.name];
            const renderedVal = renderCellValue(rawVal, col);
            return `<td class="px-4 py-3 text-sm text-foreground/90 border-b border-border whitespace-nowrap">${renderedVal}</td>`;
          })
          .join('\n');

        return `
          <tr class="admin-table-row hover:bg-muted/40 transition-colors ${isSelected ? 'bg-primary/5' : ''}" data-id="${pkVal}">
            <td class="px-4 py-3 border-b border-border w-10">
              <input type="checkbox" class="admin-row-select rounded border-border" data-select-id="${pkVal}" ${isSelected ? 'checked' : ''} />
            </td>
            ${cellsHtml}
            <td class="px-4 py-3 border-b border-border text-right w-24 whitespace-nowrap">
              <div class="flex items-center justify-end space-x-2">
                <a href="/admin/resources/${schema.id}/${pkVal}" class="text-xs font-medium text-primary hover:underline" data-action="view">View</a>
                ${props.canEdit !== false ? `<a href="/admin/resources/${schema.id}/${pkVal}/edit" class="text-xs font-medium text-muted-foreground hover:text-foreground" data-action="edit">Edit</a>` : ''}
              </div>
            </td>
          </tr>
        `;
      })
      .join('\n');
  }

  // Pagination bar
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  const paginationHtml = `
    <div class="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
      <div>
        Showing <span class="font-medium text-foreground">${startIdx}</span> to <span class="font-medium text-foreground">${endIdx}</span> of <span class="font-medium text-foreground">${total}</span> results
      </div>
      <div class="flex items-center space-x-2">
        <button
          type="button"
          class="admin-page-prev px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
          ${page <= 1 ? 'disabled' : ''}
          data-page="${page - 1}"
        >
          Previous
        </button>
        <span class="px-2">Page ${page} of ${Math.max(totalPages, 1)}</span>
        <button
          type="button"
          class="admin-page-next px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
          ${page >= totalPages ? 'disabled' : ''}
          data-page="${page + 1}"
        >
          Next
        </button>
      </div>
    </div>
  `;

  return `
    <div class="admin-data-table-container rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 border-b border-border w-10">
                <input type="checkbox" class="admin-select-all rounded border-border" ${allSelected ? 'checked' : ''} ${someSelected && !allSelected ? 'indeterminate' : ''} />
              </th>
              ${headersHtml}
              <th class="px-4 py-3 border-b border-border text-right w-24 text-xs font-semibold uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
      </div>
      ${paginationHtml}
    </div>
  `.trim();
}

function renderCellValue(value: unknown, field: AdminFieldConfig): string {
  if (value === null || value === undefined) {
    return '<span class="text-muted-foreground text-xs">—</span>';
  }

  if (typeof value === 'boolean') {
    return value
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Yes</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">No</span>';
  }

  if (field.type === 'date') {
    return formatDate(value as string);
  }

  if (field.type === 'datetime') {
    return formatDateTime(value as string);
  }

  if (field.type === 'number') {
    return formatNumber(value as number);
  }

  if (field.type === 'email') {
    return `<a href="mailto:${escapeHtml(String(value))}" class="text-primary hover:underline">${escapeHtml(String(value))}</a>`;
  }

  if (field.type === 'url') {
    return `<a href="${escapeHtml(String(value))}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${truncateText(String(value), 30)}</a>`;
  }

  if (field.type === 'json') {
    return `<code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">${truncateText(JSON.stringify(value), 25)}</code>`;
  }

  if (typeof value === 'object') {
    return `<code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">${truncateText(JSON.stringify(value), 25)}</code>`;
  }

  return escapeHtml(truncateText(String(value), 60));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
