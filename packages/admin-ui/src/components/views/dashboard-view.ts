/**
 * Dashboard View for @jsango/admin-ui
 */

import type { DashboardWidgetConfig } from '@jsango/admin-core';
import { renderPageHeader } from '../layout/breadcrumbs.js';

export interface DashboardViewProps {
  readonly widgets: readonly DashboardWidgetConfig[];
  readonly data: Record<string, unknown>;
  readonly isLoading?: boolean | undefined;
}

export function renderDashboardView(props: DashboardViewProps): string {
  const { widgets, data, isLoading } = props;

  const headerHtml = renderPageHeader({
    title: 'Dashboard',
    subtitle: 'System metrics, operational activity, and overview',
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: 'Dashboard', active: true },
    ],
  });

  if (isLoading) {
    return `
      ${headerHtml}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
        <div class="h-28 rounded-xl bg-card border border-border p-4 animate-pulse"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="h-64 rounded-xl bg-card border border-border p-6 animate-pulse"></div>
        <div class="h-64 rounded-xl bg-card border border-border p-6 animate-pulse"></div>
      </div>
    `;
  }

  if (widgets.length === 0) {
    return `
      ${headerHtml}
      <div class="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        <div class="text-4xl mb-3">📊</div>
        <h3 class="text-sm font-semibold text-foreground">Welcome to Admin Dashboard</h3>
        <p class="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          No dashboard widgets are registered yet. Register MetricWidgets, TableWidgets, or ActivityWidgets in your AdminRegistry to monitor application health and metrics.
        </p>
      </div>
    `;
  }

  const widgetCardsHtml = widgets
    .map((w) => {
      const widgetData = data[w.id];
      const widthClass =
        w.width === 'full'
          ? 'col-span-1 lg:col-span-4'
          : w.width === 'third'
            ? 'col-span-1 lg:col-span-2 xl:col-span-1'
            : 'col-span-1 lg:col-span-2';

      if (w.type === 'metric') {
        let displayVal = '—';
        let trendHtml = '';

        if (typeof widgetData === 'number' || typeof widgetData === 'string') {
          displayVal = String(widgetData);
        } else if (typeof widgetData === 'object' && widgetData !== null) {
          const m = widgetData as Record<string, unknown>;
          displayVal = String(m['value'] ?? '—');
          if (m['change'] !== undefined) {
            const isUp =
              m['trend'] === 'up' || (typeof m['change'] === 'number' && m['change'] >= 0);
            trendHtml = `
              <span class="text-[11px] font-medium ${isUp ? 'text-emerald-500' : 'text-rose-500'} flex items-center space-x-0.5">
                <span>${isUp ? '↑' : '↓'}</span>
                <span>${Math.abs(Number(m['change']))}%</span>
              </span>
            `;
          }
        }

        return `
          <div class="admin-widget bg-card border border-border rounded-xl p-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
            <div class="text-xs font-medium text-muted-foreground mb-2">${escapeHtml(w.title)}</div>
            <div class="flex items-baseline justify-between">
              <div class="text-2xl font-bold tracking-tight text-foreground">${escapeHtml(displayVal)}</div>
              ${trendHtml}
            </div>
          </div>
        `;
      }

      if (w.type === 'activity') {
        const items = Array.isArray(widgetData) ? widgetData : [];
        const itemsHtml =
          items.length > 0
            ? items
                .slice(0, 5)
                .map(
                  (it: Record<string, unknown>) => `
                <div class="flex items-start space-x-3 py-2.5 border-b border-border/50 last:border-0 text-xs">
                  <span class="text-base">${escapeHtml(String(it['icon'] ?? '•'))}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-foreground truncate">${escapeHtml(String(it['title'] ?? ''))}</div>
                    ${it['subtitle'] ? `<div class="text-[11px] text-muted-foreground truncate">${escapeHtml(String(it['subtitle']))}</div>` : ''}
                  </div>
                </div>
              `
                )
                .join('\n')
            : '<div class="text-xs text-muted-foreground p-4 text-center">No recent activity</div>';

        return `
          <div class="admin-widget bg-card border border-border rounded-xl p-5 shadow-sm ${widthClass}">
            <div class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">${escapeHtml(w.title)}</div>
            <div class="divide-y divide-border/40">${itemsHtml}</div>
          </div>
        `;
      }

      // Generic table or custom widget
      return `
        <div class="admin-widget bg-card border border-border rounded-xl p-5 shadow-sm ${widthClass}">
          <div class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">${escapeHtml(w.title)}</div>
          <pre class="bg-muted/40 p-3 rounded-lg text-xs font-mono overflow-x-auto text-foreground/80">${escapeHtml(JSON.stringify(widgetData, null, 2))}</pre>
        </div>
      `;
    })
    .join('\n');

  return `
    ${headerHtml}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      ${widgetCardsHtml}
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
