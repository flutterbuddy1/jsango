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

export function renderFilterBar(props: FilterBarProps): string {
  const { schema, searchQuery = '', activeFilters } = props;
  const filters = schema.filters;

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || searchQuery.length > 0;

  const filterInputsHtml = filters
    .map((f) => {
      const currentVal = activeFilters[f.name];

      if (f.type === 'enum' && f.choices) {
        const optionsHtml = f.choices
          .map(
            (c) =>
              `<option value="${escapeHtml(String(c.value))}" ${String(currentVal) === String(c.value) ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
          )
          .join('\n');

        return `
          <div class="flex items-center space-x-1.5 text-xs">
            <span class="text-muted-foreground font-medium">${escapeHtml(f.label ?? f.name)}:</span>
            <select
              class="admin-filter-select bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground text-xs outline-none hover:bg-muted/50 transition"
              data-filter-name="${escapeHtml(f.name)}"
            >
              <option value="">All</option>
              ${optionsHtml}
            </select>
          </div>
        `;
      }

      if (f.type === 'boolean') {
        return `
          <div class="flex items-center space-x-1.5 text-xs">
            <span class="text-muted-foreground font-medium">${escapeHtml(f.label ?? f.name)}:</span>
            <select
              class="admin-filter-select bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground text-xs outline-none hover:bg-muted/50 transition"
              data-filter-name="${escapeHtml(f.name)}"
            >
              <option value="">All</option>
              <option value="true" ${currentVal === 'true' || currentVal === true ? 'selected' : ''}>Yes</option>
              <option value="false" ${currentVal === 'false' || currentVal === false ? 'selected' : ''}>No</option>
            </select>
          </div>
        `;
      }

      return `
        <div class="flex items-center space-x-1.5 text-xs">
          <span class="text-muted-foreground font-medium">${escapeHtml(f.label ?? f.name)}:</span>
          <input
            type="text"
            class="admin-filter-input bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground text-xs outline-none placeholder:text-muted-foreground hover:bg-muted/50 transition w-32"
            placeholder="Filter..."
            value="${currentVal !== undefined ? escapeHtml(String(currentVal)) : ''}"
            data-filter-name="${escapeHtml(f.name)}"
          />
        </div>
      `;
    })
    .join('\n');

  return `
    <div class="admin-filter-bar flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center space-x-2 flex-1 max-w-md">
        <div class="relative w-full">
          <span class="absolute left-3 top-2.5 text-muted-foreground text-xs">🔍</span>
          <input
            type="text"
            class="admin-search-input w-full pl-8 pr-4 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition"
            placeholder="Search ${escapeHtml(schema.pluralLabel.toLowerCase())}..."
            value="${escapeHtml(searchQuery)}"
          />
        </div>
      </div>
      <div class="flex items-center flex-wrap gap-2">
        ${filterInputsHtml}
        ${
          hasActiveFilters
            ? `
          <button
            type="button"
            class="admin-clear-filters text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
          >
            Clear Filters
          </button>
        `
            : ''
        }
      </div>
    </div>
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
