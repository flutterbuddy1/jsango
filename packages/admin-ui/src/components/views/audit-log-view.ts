/**
 * Audit Log View for @jsango/admin-ui
 */

import type { AdminAuditRecord } from '../../types/index.js';
import { renderPageHeader } from '../layout/breadcrumbs.js';
import { formatDateTime, formatRelativeTime } from '../../formatters/index.js';
import { renderDiffViewer } from '../ui/diff-viewer.js';

export interface AuditLogViewProps {
  readonly entries: readonly AdminAuditRecord[];
  readonly total: number;
  readonly isLoading?: boolean | undefined;
  readonly selectedEntryId?: string | undefined;
}

export function renderAuditLogView(props: AuditLogViewProps): string {
  const { entries, total, isLoading, selectedEntryId } = props;

  const headerHtml = renderPageHeader({
    title: 'Audit Logs',
    subtitle: `Security and mutation audit trail (${total} events recorded)`,
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: 'Audit Logs', active: true },
    ],
  });

  if (isLoading) {
    return `
      ${headerHtml}
      <div class="space-y-3">
        <div class="h-16 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-16 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-16 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
      </div>
    `;
  }

  if (entries.length === 0) {
    return `
      ${headerHtml}
      <div class="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        <div class="text-4xl mb-3">📜</div>
        <h3 class="text-sm font-semibold text-foreground">No Audit Events</h3>
        <p class="text-xs text-muted-foreground mt-1">Mutation and administrative events will automatically appear here.</p>
      </div>
    `;
  }

  const entriesHtml = entries
    .map((e) => {
      const isSelected = selectedEntryId === e.id;
      let badgeClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
      if (e.action === 'create')
        badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      if (e.action === 'update')
        badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      if (e.action === 'delete')
        badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
      if (e.action === 'restore')
        badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';

      const diffHtml =
        e.changes && (e.changes.before || e.changes.after)
          ? `
          <div class="mt-3 pt-3 border-t border-border/50">
            ${renderDiffViewer(e.changes.before, e.changes.after)}
          </div>
        `
          : '';

      return `
        <div class="admin-audit-card bg-card border border-border rounded-xl p-4 shadow-sm text-xs ${isSelected ? 'ring-2 ring-primary' : ''}" data-audit-id="${e.id}">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div class="flex items-center space-x-2">
              <span class="px-2 py-0.5 font-semibold uppercase rounded-full text-[10px] ${badgeClass}">${escapeHtml(e.action)}</span>
              <span class="font-bold text-foreground">${escapeHtml(e.resourceId)} #${escapeHtml(String(e.recordId))}</span>
            </div>
            <div class="text-muted-foreground flex items-center space-x-2">
              <span>${formatRelativeTime(e.timestamp)}</span>
              <span>•</span>
              <span title="${formatDateTime(e.timestamp)}">${formatDateTime(e.timestamp)}</span>
            </div>
          </div>

          <div class="flex items-center space-x-4 text-muted-foreground text-[11px]">
            <div>Actor: <span class="font-medium text-foreground">${escapeHtml(e.actorName ?? e.actorId ?? 'Anonymous')}</span></div>
            ${e.ipAddress ? `<div>IP: <span class="font-mono text-foreground">${escapeHtml(e.ipAddress)}</span></div>` : ''}
          </div>

          ${diffHtml}
        </div>
      `;
    })
    .join('\n');

  return `
    ${headerHtml}
    <div class="space-y-4 max-w-4xl">
      ${entriesHtml}
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
