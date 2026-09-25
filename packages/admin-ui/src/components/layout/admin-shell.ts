/**
 * Master Admin Shell Layout
 */

import type {
  AdminResourceSummary,
  AdminUserIdentity,
  ThemeMode,
  ToastMessage,
} from '../../types/index.js';
import type { CustomPageSummary } from '../../client/types.js';
import { renderSidebar } from './sidebar.js';
import { renderTopBar } from './top-bar.js';

export interface AdminShellProps {
  readonly resources: readonly AdminResourceSummary[];
  readonly customPages?: readonly CustomPageSummary[] | undefined;
  readonly activePath: string;
  readonly user?: AdminUserIdentity | undefined;
  readonly themeMode: ThemeMode;
  readonly isSidebarCollapsed?: boolean | undefined;
  readonly contentHtml: string;
  readonly toasts?: readonly ToastMessage[] | undefined;
  readonly modalHtml?: string | undefined;
  readonly appTitle?: string | undefined;
}

export function renderAdminShell(props: AdminShellProps): string {
  const sidebarHtml = renderSidebar({
    resources: props.resources,
    customPages: props.customPages,
    activePath: props.activePath,
    isCollapsed: props.isSidebarCollapsed,
    appTitle: props.appTitle,
  });

  const topBarHtml = renderTopBar({
    user: props.user,
    themeMode: props.themeMode,
  });

  const toastsHtml =
    props.toasts && props.toasts.length > 0
      ? `
      <div class="admin-toast-container fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        ${props.toasts
          .map((t) => {
            const borderClass =
              t.type === 'success'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100'
                : t.type === 'error'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100'
                  : t.type === 'warning'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-100'
                    : 'border-blue-500 bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-100';

            return `
              <div class="admin-toast pointer-events-auto p-4 rounded-xl border shadow-lg ${borderClass} flex items-start justify-between space-x-3 text-xs animate-in slide-in-from-right-5" data-toast-id="${t.id}">
                <div>
                  <div class="font-bold mb-0.5">${escapeHtml(t.title)}</div>
                  ${t.message ? `<div class="text-[11px] opacity-90">${escapeHtml(t.message)}</div>` : ''}
                </div>
                <button type="button" class="admin-toast-close opacity-60 hover:opacity-100 text-sm font-bold" data-dismiss-id="${t.id}">×</button>
              </div>
            `;
          })
          .join('\n')}
      </div>
    `
      : '';

  return `
    <div class="admin-app min-h-screen bg-background text-foreground flex overflow-hidden">
      <!-- Sidebar Navigation -->
      ${sidebarHtml}

      <!-- Main Column -->
      <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        ${topBarHtml}

        <!-- Page Content Viewport -->
        <main class="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div class="max-w-7xl mx-auto">
            ${props.contentHtml}
          </div>
        </main>
      </div>

      <!-- Floating Toasts -->
      ${toastsHtml}

      <!-- Active Modals / Command Palette -->
      ${props.modalHtml ?? ''}
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
