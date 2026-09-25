/**
 * Breadcrumbs and Page Header layout components
 */

import type { BreadcrumbItem } from '../../types/index.js';

export function renderBreadcrumbs(items: readonly BreadcrumbItem[]): string {
  if (items.length === 0) return '';

  const linksHtml = items
    .map((it, idx) => {
      const isLast = idx === items.length - 1;
      const separator = isLast ? '' : '<span class="text-muted-foreground/60 text-xs">/</span>';

      if (isLast || !it.href) {
        return `
          <span class="text-foreground font-medium truncate max-w-xs">${escapeHtml(it.label)}</span>
          ${separator}
        `;
      }

      return `
        <a href="${escapeHtml(it.href)}" class="text-muted-foreground hover:text-foreground transition truncate max-w-xs">${escapeHtml(it.label)}</a>
        ${separator}
      `;
    })
    .join('\n');

  return `
    <nav class="admin-breadcrumbs flex items-center space-x-2 text-xs mb-3 select-none" aria-label="Breadcrumb">
      ${linksHtml}
    </nav>
  `.trim();
}

export interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly breadcrumbs?: readonly BreadcrumbItem[] | undefined;
  readonly actionsHtml?: string | undefined;
}

export function renderPageHeader(props: PageHeaderProps): string {
  const breadcrumbsHtml = props.breadcrumbs ? renderBreadcrumbs(props.breadcrumbs) : '';

  return `
    <div class="admin-page-header mb-6 pb-4 border-b border-border">
      ${breadcrumbsHtml}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-foreground">${escapeHtml(props.title)}</h1>
          ${props.subtitle ? `<p class="text-xs text-muted-foreground mt-1">${escapeHtml(props.subtitle)}</p>` : ''}
        </div>
        ${props.actionsHtml ? `<div class="flex items-center space-x-3">${props.actionsHtml}</div>` : ''}
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
