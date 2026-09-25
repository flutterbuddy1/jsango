/**
 * Sidebar navigation component for @jsango/admin-ui
 */

import type { AdminResourceSummary } from '../../types/index.js';
import type { CustomPageSummary } from '../../client/types.js';

export interface SidebarProps {
  readonly resources: readonly AdminResourceSummary[];
  readonly customPages?: readonly CustomPageSummary[] | undefined;
  readonly activePath: string;
  readonly isCollapsed?: boolean | undefined;
  readonly showSystemSection?: boolean | undefined;
  readonly appTitle?: string | undefined;
}

export function renderSidebar(props: SidebarProps): string {
  const {
    resources,
    customPages = [],
    activePath,
    isCollapsed = false,
    appTitle = 'JSango Admin',
  } = props;

  // Group resources by navigationGroup (default to 'Models')
  const groups = new Map<string, AdminResourceSummary[]>();
  for (const r of resources) {
    const grp = r.navigationGroup ?? 'Models';
    const arr = groups.get(grp) ?? [];
    arr.push(r);
    groups.set(grp, arr);
  }

  // Sort resources in each group by navigationOrder
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.navigationOrder ?? 0) - (b.navigationOrder ?? 0));
  }

  const modelSectionsHtml = Array.from(groups.entries())
    .map(([groupName, groupResources]) => {
      const itemsHtml = groupResources
        .map((r) => {
          const path = `/admin/resources/${r.id}`;
          const isActive = activePath.startsWith(path);

          return `
            <a
              href="${path}"
              class="admin-nav-item flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }"
              title="${escapeHtml(r.pluralLabel)}"
            >
              <span class="text-sm shrink-0">${r.navigationIcon ?? '📁'}</span>
              ${!isCollapsed ? `<span class="truncate">${escapeHtml(r.pluralLabel)}</span>` : ''}
            </a>
          `;
        })
        .join('\n');

      return `
        <div class="mb-4">
          ${!isCollapsed ? `<div class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 mb-1.5">${escapeHtml(groupName)}</div>` : ''}
          <div class="space-y-0.5">${itemsHtml}</div>
        </div>
      `;
    })
    .join('\n');

  // Custom pages
  const customPagesHtml =
    customPages.length > 0
      ? `
      <div class="mb-4">
        ${!isCollapsed ? '<div class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 mb-1.5">Custom Pages</div>' : ''}
        <div class="space-y-0.5">
          ${customPages
            .map((p) => {
              const path = `/admin/pages/${p.id}`;
              const isActive = activePath.startsWith(path);
              return `
                <a
                  href="${path}"
                  class="admin-nav-item flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }"
                  title="${escapeHtml(p.label)}"
                >
                  <span class="text-sm shrink-0">${p.navigationIcon ?? '📄'}</span>
                  ${!isCollapsed ? `<span class="truncate">${escapeHtml(p.label)}</span>` : ''}
                </a>
              `;
            })
            .join('\n')}
        </div>
      </div>
    `
      : '';

  return `
    <aside class="admin-sidebar ${isCollapsed ? 'w-16' : 'w-64'} shrink-0 border-r border-border bg-card flex flex-col h-screen transition-all duration-200 select-none">
      <!-- App Header -->
      <div class="p-4 border-b border-border flex items-center justify-between h-14">
        <a href="/admin" class="flex items-center space-x-2.5 overflow-hidden">
          <div class="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
            J
          </div>
          ${!isCollapsed ? `<span class="font-bold text-sm text-foreground tracking-tight truncate">${escapeHtml(appTitle)}</span>` : ''}
        </a>
      </div>

      <!-- Navigation Content -->
      <div class="flex-1 overflow-y-auto p-3 space-y-4">
        <!-- Main Section -->
        <div class="space-y-0.5">
          <a
            href="/admin"
            class="admin-nav-item flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
              activePath === '/admin' || activePath === '/admin/dashboard'
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }"
            title="Dashboard"
          >
            <span class="text-sm shrink-0">📊</span>
            ${!isCollapsed ? '<span class="truncate">Dashboard</span>' : ''}
          </a>
        </div>

        <!-- Dynamic Model/Resource Sections -->
        ${modelSectionsHtml}

        <!-- Custom Pages -->
        ${customPagesHtml}

        <!-- System Section -->
        <div class="mb-4">
          ${!isCollapsed ? '<div class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 mb-1.5">System & Ops</div>' : ''}
          <div class="space-y-0.5">
            <a
              href="/admin/audit"
              class="admin-nav-item flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activePath.startsWith('/admin/audit')
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }"
              title="Audit Logs"
            >
              <span class="text-sm shrink-0">📜</span>
              ${!isCollapsed ? '<span class="truncate">Audit Logs</span>' : ''}
            </a>

            <a
              href="/admin/system/health"
              class="admin-nav-item flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activePath.startsWith('/admin/system/health')
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }"
              title="System Health"
            >
              <span class="text-sm shrink-0">💚</span>
              ${!isCollapsed ? '<span class="truncate">System Health</span>' : ''}
            </a>
          </div>
        </div>
      </div>

      <!-- Footer Collapse Button -->
      <div class="p-3 border-t border-border flex items-center justify-between">
        <button
          type="button"
          class="admin-sidebar-toggle text-xs text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition w-full flex items-center justify-center space-x-2"
          title="${isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
        >
          <span>${isCollapsed ? '→' : '←'}</span>
          ${!isCollapsed ? '<span class="text-[11px]">Collapse</span>' : ''}
        </button>
      </div>
    </aside>
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
