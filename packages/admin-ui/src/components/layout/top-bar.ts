/**
 * Top Bar Header component for @jsango/admin-ui
 */

import type { AdminUserIdentity, ThemeMode } from '../../types/index.js';

export interface TopBarProps {
  readonly user?: AdminUserIdentity | undefined;
  readonly themeMode: ThemeMode;
  readonly onOpenCommandPalette?: (() => void) | undefined;
  readonly onToggleTheme?: (() => void) | undefined;
  readonly onLogout?: (() => void) | undefined;
}

export function renderTopBar(props: TopBarProps): string {
  const { user, themeMode } = props;

  const themeIcon = themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '💻';

  return `
    <header class="admin-topbar h-14 border-b border-border bg-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      <!-- Left: Mobile Menu Trigger & Search Shortcut -->
      <div class="flex items-center space-x-3">
        <button
          type="button"
          class="admin-mobile-menu-toggle md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>

        <button
          type="button"
          class="admin-command-palette-trigger flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs text-muted-foreground transition w-56 sm:w-64"
        >
          <span>🔍</span>
          <span class="truncate">Search resources, ops...</span>
          <kbd class="ml-auto text-[10px] bg-card px-1.5 py-0.5 rounded border border-border font-mono">⌘K</kbd>
        </button>
      </div>

      <!-- Right: Actions & User Menu -->
      <div class="flex items-center space-x-3">
        <!-- Theme Toggle -->
        <button
          type="button"
          class="admin-theme-toggle p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition text-sm"
          title="Switch theme (Current: ${themeMode})"
          aria-label="Switch theme"
        >
          ${themeIcon}
        </button>

        <!-- User Menu -->
        ${
          user
            ? `
          <div class="admin-user-menu relative flex items-center space-x-2.5 pl-3 border-l border-border">
            <div class="h-7 w-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs">
              ${escapeHtml(user.username.slice(0, 2).toUpperCase())}
            </div>
            <div class="hidden sm:block text-left">
              <div class="text-xs font-semibold text-foreground leading-tight">${escapeHtml(user.username)}</div>
              <div class="text-[10px] text-muted-foreground">${user.isSuperuser ? 'Superadmin' : user.roles.join(', ') || 'Staff'}</div>
            </div>
            <button
              type="button"
              class="admin-logout-btn ml-2 text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title="Sign out"
            >
              Logout
            </button>
          </div>
        `
            : ''
        }
      </div>
    </header>
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
