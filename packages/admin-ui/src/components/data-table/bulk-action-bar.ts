/**
 * Floating bottom Bulk Action Bar for multi-selected records
 */

import type { AdminResourceSchema } from '@jsango/admin-core';

export interface BulkActionBarProps {
  readonly schema: AdminResourceSchema;
  readonly selectedCount: number;
  readonly onExecuteAction?: ((actionId: string) => void) | undefined;
  readonly onClearSelection?: (() => void) | undefined;
  readonly onDeleteSelected?: (() => void) | undefined;
}

export function renderBulkActionBar(props: BulkActionBarProps): string {
  const { schema, selectedCount } = props;
  if (selectedCount === 0) return '';

  const bulkActions = schema.bulkActions ?? [];
  const actionOptionsHtml = bulkActions
    .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`)
    .join('\n');

  return `
    <div class="admin-bulk-action-bar fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border rounded-xl shadow-2xl px-5 py-3 flex items-center space-x-4 animate-in slide-in-from-bottom-5">
      <div class="flex items-center space-x-2 text-xs font-semibold text-foreground">
        <span class="bg-primary text-primary-foreground px-2 py-0.5 rounded-full">${selectedCount}</span>
        <span>${selectedCount === 1 ? 'record' : 'records'} selected</span>
      </div>

      <div class="h-4 w-px bg-border"></div>

      <div class="flex items-center space-x-2">
        ${
          bulkActions.length > 0
            ? `
          <select class="admin-bulk-action-select bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none font-medium">
            <option value="">Select Bulk Action...</option>
            ${actionOptionsHtml}
          </select>
          <button
            type="button"
            class="admin-bulk-action-apply px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            Apply
          </button>
        `
            : ''
        }

        <button
          type="button"
          class="admin-bulk-delete px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition flex items-center space-x-1"
        >
          <span>🗑</span>
          <span>Delete (${selectedCount})</span>
        </button>

        <button
          type="button"
          class="admin-bulk-clear text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 transition"
        >
          Deselect All
        </button>
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
