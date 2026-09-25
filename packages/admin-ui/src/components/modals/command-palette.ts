/**
 * Command Palette (Cmd+K / Ctrl+K) for fast navigation and actions.
 */

import type { AdminResourceSummary } from '../../types/index.js';

export interface CommandItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly group: 'Navigation' | 'Resources' | 'System' | 'Theme';
  readonly icon?: string | undefined;
  readonly shortcut?: string | undefined;
  readonly onSelect: () => void;
}

export function buildDefaultCommands(options: {
  readonly resources: readonly AdminResourceSummary[];
  readonly onNavigate: (route: string) => void;
  readonly onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
}): readonly CommandItem[] {
  const items: CommandItem[] = [];

  // Main Navigation
  items.push(
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      subtitle: 'System overview & metrics',
      group: 'Navigation',
      icon: '📊',
      shortcut: 'G D',
      onSelect: () => options.onNavigate('/admin'),
    },
    {
      id: 'nav-audit',
      title: 'Audit Logs',
      subtitle: 'View security & mutation audit trail',
      group: 'Navigation',
      icon: '📜',
      shortcut: 'G A',
      onSelect: () => options.onNavigate('/admin/audit'),
    },
    {
      id: 'nav-health',
      title: 'System Health',
      subtitle: 'Database, cache, and service status',
      group: 'System',
      icon: '💚',
      onSelect: () => options.onNavigate('/admin/system/health'),
    },
    {
      id: 'theme-light',
      title: 'Light Theme',
      subtitle: 'Switch to light color mode',
      group: 'Theme',
      icon: '☀️',
      onSelect: () => options.onSetTheme('light'),
    },
    {
      id: 'theme-dark',
      title: 'Dark Theme',
      subtitle: 'Switch to dark color mode',
      group: 'Theme',
      icon: '🌙',
      onSelect: () => options.onSetTheme('dark'),
    },
    {
      id: 'theme-system',
      title: 'System Theme',
      subtitle: 'Match system preference',
      group: 'Theme',
      icon: '💻',
      onSelect: () => options.onSetTheme('system'),
    }
  );

  // Resources
  for (const r of options.resources) {
    items.push({
      id: `resource-${r.id}`,
      title: r.pluralLabel,
      subtitle: `Manage ${r.pluralLabel.toLowerCase()}`,
      group: 'Resources',
      icon: r.navigationIcon ?? '📁',
      onSelect: () => options.onNavigate(`/admin/resources/${r.id}`),
    });
  }

  return items;
}

export function renderCommandPalette(items: readonly CommandItem[], searchQuery = ''): string {
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? items.filter(
        (it) =>
          it.title.toLowerCase().includes(query) ||
          (it.subtitle && it.subtitle.toLowerCase().includes(query)) ||
          it.group.toLowerCase().includes(query)
      )
    : items;

  // Group by section
  const groups = new Map<string, CommandItem[]>();
  for (const it of filtered) {
    const arr = groups.get(it.group) ?? [];
    arr.push(it);
    groups.set(it.group, arr);
  }

  const groupHtml = Array.from(groups.entries())
    .map(([groupName, groupItems]) => {
      const itemsHtml = groupItems
        .map(
          (it) => `
          <button
            type="button"
            class="admin-command-item w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-muted text-foreground transition text-left"
            data-command-id="${it.id}"
          >
            <div class="flex items-center space-x-3">
              <span class="text-base">${it.icon ?? '•'}</span>
              <div>
                <div class="font-medium">${escapeHtml(it.title)}</div>
                ${it.subtitle ? `<div class="text-xs text-muted-foreground">${escapeHtml(it.subtitle)}</div>` : ''}
              </div>
            </div>
            ${it.shortcut ? `<kbd class="text-xs bg-muted px-2 py-0.5 rounded border border-border font-mono text-muted-foreground">${it.shortcut}</kbd>` : ''}
          </button>
        `
        )
        .join('\n');

      return `
        <div class="mb-4">
          <div class="text-xs font-semibold uppercase text-muted-foreground px-3 mb-1.5">${groupName}</div>
          <div class="space-y-0.5">${itemsHtml}</div>
        </div>
      `;
    })
    .join('\n');

  return `
    <div class="admin-command-palette-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 p-4" role="dialog" aria-modal="true">
      <div class="admin-command-palette-content bg-card border border-border rounded-xl shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95">
        <div class="p-4 border-b border-border flex items-center space-x-3">
          <span class="text-muted-foreground">🔍</span>
          <input
            type="text"
            class="admin-command-input w-full bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
            placeholder="Type a command or search resources... (Esc to close)"
            value="${escapeHtml(searchQuery)}"
            autofocus
          />
        </div>
        <div class="p-3 max-h-96 overflow-y-auto">
          ${filtered.length > 0 ? groupHtml : '<div class="p-8 text-center text-sm text-muted-foreground">No commands found.</div>'}
        </div>
        <div class="bg-muted/40 px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div class="flex items-center space-x-2">
            <span>Navigation: <kbd class="font-mono bg-card px-1.5 py-0.5 rounded border">↑</kbd> <kbd class="font-mono bg-card px-1.5 py-0.5 rounded border">↓</kbd></span>
            <span>Select: <kbd class="font-mono bg-card px-1.5 py-0.5 rounded border">↵</kbd></span>
          </div>
          <span>Close: <kbd class="font-mono bg-card px-1.5 py-0.5 rounded border">Esc</kbd></span>
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
