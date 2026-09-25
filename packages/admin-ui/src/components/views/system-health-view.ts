/**
 * System Health & Diagnostics View for @jsango/admin-ui
 */

import type { AdminSystemHealth } from '../../types/index.js';
import { renderPageHeader } from '../layout/breadcrumbs.js';
import { formatBytes } from '../../formatters/index.js';

export interface SystemHealthViewProps {
  readonly health?: AdminSystemHealth | undefined;
  readonly isLoading?: boolean | undefined;
}

export function renderSystemHealthView(props: SystemHealthViewProps): string {
  const { health, isLoading } = props;

  const headerHtml = renderPageHeader({
    title: 'System Health',
    subtitle: 'Runtime diagnostics, memory meters, and service statuses',
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: 'System Health', active: true },
    ],
  });

  if (isLoading || !health) {
    return `
      ${headerHtml}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
      </div>
    `;
  }

  const statusColor =
    health.status === 'healthy'
      ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
      : health.status === 'degraded'
        ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900'
        : 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900';

  const uptimeHours = (health.uptime / 3600).toFixed(1);

  const servicesHtml = health.services
    ? Object.entries(health.services)
        .map(([name, svc]) => {
          const isUp = svc.status === 'up';
          return `
            <div class="p-4 flex items-center justify-between">
              <div class="flex items-center space-x-2.5">
                <span class="h-2.5 w-2.5 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                <span class="font-semibold text-foreground capitalize">${escapeHtml(name)}</span>
              </div>
              <div class="text-xs font-mono uppercase ${isUp ? 'text-emerald-500' : 'text-rose-500'} font-bold">
                ${escapeHtml(svc.status)}
              </div>
            </div>
          `;
        })
        .join('\n')
    : '<div class="p-4 text-xs text-muted-foreground">No specific subsystems registered</div>';

  return `
    ${headerHtml}

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="p-5 rounded-xl border ${statusColor} shadow-sm">
        <div class="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">Overall Status</div>
        <div class="text-2xl font-bold capitalize">${escapeHtml(health.status)}</div>
      </div>

      <div class="p-5 rounded-xl border border-border bg-card shadow-sm">
        <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Process Uptime</div>
        <div class="text-2xl font-bold text-foreground">${uptimeHours} hrs</div>
      </div>

      <div class="p-5 rounded-xl border border-border bg-card shadow-sm">
        <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Node Environment</div>
        <div class="text-2xl font-bold text-foreground font-mono text-base">${escapeHtml(health.nodeVersion ?? 'Node.js')}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Subsystems Card -->
      <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border text-xs">
        <div class="bg-muted/40 px-5 py-3 font-semibold text-muted-foreground uppercase tracking-wider">
          Subsystems & Services
        </div>
        ${servicesHtml}
      </div>

      <!-- Memory Card -->
      <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-5 text-xs">
        <div class="font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Process Memory
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-border/50 pb-2">
            <span class="text-muted-foreground">Heap Used</span>
            <span class="font-mono font-bold text-foreground">${formatBytes(health.memory?.heapUsed)}</span>
          </div>
          <div class="flex items-center justify-between border-b border-border/50 pb-2">
            <span class="text-muted-foreground">Heap Total</span>
            <span class="font-mono font-bold text-foreground">${formatBytes(health.memory?.heapTotal)}</span>
          </div>
          <div class="flex items-center justify-between pb-2">
            <span class="text-muted-foreground">Resident Set Size (RSS)</span>
            <span class="font-mono font-bold text-foreground">${formatBytes(health.memory?.rss)}</span>
          </div>
        </div>
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
