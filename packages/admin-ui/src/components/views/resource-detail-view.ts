/**
 * Resource Detail View for @jsango/admin-ui
 */

import type { AdminResourceSchema, AdminFieldConfig } from '@jsango/admin-core';
import { renderPageHeader } from '../layout/breadcrumbs.js';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRecordTitle,
} from '../../formatters/index.js';
import { renderJsonViewer } from '../ui/json-viewer.js';

export interface ResourceDetailViewProps {
  readonly schema: AdminResourceSchema;
  readonly item: Record<string, unknown>;
  readonly canEdit?: boolean | undefined;
  readonly canDelete?: boolean | undefined;
  readonly canSoftDelete?: boolean | undefined;
}

export function renderResourceDetailView(props: ResourceDetailViewProps): string {
  const { schema, item, canEdit = true, canDelete = true } = props;
  const pkVal = item[schema.primaryKey] as string | number;
  const title = formatRecordTitle(item, schema.primaryKey);

  const isSoftDeleted = schema.canSoftDelete && Boolean(item['deletedAt']);

  const actionsHtml = `
    <div class="flex items-center space-x-2">
      ${
        isSoftDeleted
          ? `
        <button
          type="button"
          class="admin-detail-restore px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition"
          data-id="${pkVal}"
        >
          Restore
        </button>
      `
          : ''
      }

      ${
        canEdit && !isSoftDeleted
          ? `
        <a
          href="/admin/resources/${schema.id}/${pkVal}/edit"
          class="admin-detail-edit px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
        >
          Edit Record
        </a>
      `
          : ''
      }

      ${
        canDelete
          ? `
        <button
          type="button"
          class="admin-detail-delete px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition"
          data-id="${pkVal}"
        >
          ${isSoftDeleted ? 'Delete Permanently' : 'Delete'}
        </button>
      `
          : ''
      }
    </div>
  `;

  const headerHtml = renderPageHeader({
    title: `${schema.label}: ${title}`,
    subtitle: `Identifier #${pkVal} • Resource ${schema.id}`,
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: schema.pluralLabel, href: `/admin/resources/${schema.id}` },
      { label: String(title), active: true },
    ],
    actionsHtml,
  });

  const detailFieldNames =
    schema.detailFields.length > 0 ? schema.detailFields : schema.fields.map((f) => f.name);
  const fieldMap = new Map<string, AdminFieldConfig>(schema.fields.map((f) => [f.name, f]));
  const fields = detailFieldNames.map((name) => fieldMap.get(name) ?? { name, label: name });

  const fieldCardsHtml = fields
    .map((f) => {
      const val = item[f.name];
      const renderedVal = renderDetailValue(val, f);

      return `
        <div class="p-4 border-b border-border/60 last:border-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-xs">
          <div class="sm:w-1/3">
            <span class="font-semibold text-foreground/90">${escapeHtml(f.label ?? f.name)}</span>
            ${f.description ? `<p class="text-[11px] text-muted-foreground mt-0.5">${escapeHtml(f.description)}</p>` : ''}
          </div>
          <div class="sm:w-2/3 text-foreground font-medium break-words">
            ${renderedVal}
          </div>
        </div>
      `;
    })
    .join('\n');

  return `
    ${headerHtml}
    ${
      isSoftDeleted
        ? `
      <div class="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
        <div>
          <span class="font-bold">⚠️ Soft Deleted Record:</span> This item was marked as deleted and is hidden from standard queries.
        </div>
      </div>
    `
        : ''
    }

    <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border/60 max-w-4xl">
      <div class="bg-muted/40 px-6 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Record Details
      </div>
      <div>
        ${fieldCardsHtml}
      </div>
    </div>
  `.trim();
}

function renderDetailValue(value: unknown, field: AdminFieldConfig): string {
  if (value === null || value === undefined) {
    return '<span class="text-muted-foreground">—</span>';
  }

  if (typeof value === 'boolean') {
    return value
      ? '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">True / Yes</span>'
      : '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">False / No</span>';
  }

  if (field.type === 'date') return formatDate(value as string);
  if (field.type === 'datetime') return formatDateTime(value as string);
  if (field.type === 'number') return formatNumber(value as number);

  if (field.type === 'email') {
    return `<a href="mailto:${escapeHtml(String(value))}" class="text-primary hover:underline">${escapeHtml(String(value))}</a>`;
  }

  if (field.type === 'url') {
    return `<a href="${escapeHtml(String(value))}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${escapeHtml(String(value))}</a>`;
  }

  if (field.type === 'json' || typeof value === 'object') {
    return renderJsonViewer(value);
  }

  return escapeHtml(String(value));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
