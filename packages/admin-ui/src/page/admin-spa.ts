/**
 * Chakra UI v3 Admin Single-Page App (SPA) Engine
 * React-Powered, 100% Mobile-Friendly, Enterprise-Grade Django Admin equivalent.
 * @package @jsango/admin-ui
 */

import { HttpResponse, type RequestContext } from '@jsango/http';
import { ADMIN_APP_BUNDLE_JS } from './bundle-content.js';

export interface AdminSpaOptions {
  /**
   * Browser page title and header branding title.
   * @default 'JSango Administration'
   */
  readonly title?: string | undefined;

  /**
   * Base REST API prefix where @jsango/admin-server is mounted.
   * @default '/api/admin'
   */
  readonly apiPrefix?: string | undefined;

  /**
   * Base API path where resources and admin endpoints live.
   * @default '/admin/api/v1'
   */
  readonly apiBasePath?: string | undefined;

  /**
   * Default theme mode ('light', 'dark', or 'system').
   * @default 'dark'
   */
  readonly defaultTheme?: 'light' | 'dark' | 'system' | undefined;

  /**
   * Subtitle displayed under the brand title.
   * @default 'Enterprise Admin Control'
   */
  readonly brandSubtitle?: string | undefined;

  /**
   * Link to the public site/store.
   * @default '/'
   */
  readonly siteUrl?: string | undefined;

  /**
   * Custom CSS styles to inject into the head.
   */
  readonly customCss?: string | undefined;

  /**
   * Enable ⌘K / Ctrl+K quick command palette navigation.
   * @default true
   */
  readonly enableCommandPalette?: boolean | undefined;

  /**
   * Enable 2FA / TOTP Authenticator security center.
   * @default true
   */
  readonly enableTwoFactor?: boolean | undefined;
}

/**
 * Escapes raw strings for safe HTML rendering.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates the complete, self-contained Chakra UI v3 Admin SPA HTML shell.
 */
export function renderAdminSpaHtml(options: AdminSpaOptions = {}): string {
  const title = options.title ?? 'JSango Administration';
  const apiBasePath = (options.apiBasePath ?? options.apiPrefix ?? '/admin/api/v1').replace(/\/$/, '');
  const defaultTheme = options.defaultTheme ?? 'dark';
  const brandSubtitle = options.brandSubtitle ?? 'Enterprise Admin Control';
  const siteUrl = options.siteUrl ?? '/';
  const customCss = options.customCss ?? '';
  const enableCommandPalette = options.enableCommandPalette ?? true;
  const enableTwoFactor = options.enableTwoFactor ?? true;

  const clientConfig = {
    title,
    brandSubtitle,
    siteUrl,
    apiBasePath,
    defaultTheme,
    enableCommandPalette,
    enableTwoFactor,
  };

  return `<!DOCTYPE html>
<html lang="en" data-app="jsango-administration" data-theme="${defaultTheme}" class="${defaultTheme === 'light' ? '' : 'dark'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(title)} — Chakra UI v3 Admin</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    /* ==========================================================================
       Chakra UI v3 Design Tokens & Semantic Variables
       ========================================================================== */
    :root {
      --chakra-fonts-heading: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --chakra-fonts-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --chakra-fonts-mono: 'JetBrains Mono', monospace;

      --chakra-radii-xs: 4px;
      --chakra-radii-sm: 6px;
      --chakra-radii-md: 8px;
      --chakra-radii-lg: 12px;
      --chakra-radii-xl: 16px;
      --chakra-radii-2xl: 24px;
      --chakra-radii-full: 9999px;

      --chakra-shadows-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
      --chakra-shadows-sm: 0 2px 4px rgba(0, 0, 0, 0.05);
      --chakra-shadows-md: 0 4px 12px rgba(0, 0, 0, 0.08);
      --chakra-shadows-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      --chakra-shadows-xl: 0 20px 35px -5px rgba(0, 0, 0, 0.25);

      --chakra-colors-teal-500: #0d9488;
      --chakra-colors-teal-600: #0f766e;
      --chakra-colors-teal-700: #115e59;
    }

    [data-theme="light"] {
      --chakra-colors-bg-canvas: #f8fafc;
      --chakra-colors-bg-surface: #ffffff;
      --chakra-colors-bg-panel: #ffffff;
      --chakra-colors-bg-subtle: #f1f5f9;
      --chakra-colors-bg-muted: #e2e8f0;
      --chakra-colors-bg-emphasized: #cbd5e1;

      --chakra-colors-fg-default: #0f172a;
      --chakra-colors-fg-muted: #64748b;
      --chakra-colors-fg-subtle: #94a3b8;
      --chakra-colors-fg-inverted: #ffffff;

      --chakra-colors-border-subtle: #e2e8f0;
      --chakra-colors-border-default: #cbd5e1;
      --chakra-colors-border-emphasized: #94a3b8;

      --chakra-colors-brand-subtle: #ccfbf1;
      --chakra-colors-brand-solid: #0d9488;
      --chakra-colors-brand-fg: #0f766e;

      --chakra-colors-sidebar-bg: #ffffff;
      --chakra-colors-sidebar-border: #e2e8f0;
      --chakra-colors-header-bg: #ffffff;
    }

    [data-theme="dark"] {
      --chakra-colors-bg-canvas: #090d16;
      --chakra-colors-bg-surface: #0f172a;
      --chakra-colors-bg-panel: rgba(15, 23, 42, 0.9);
      --chakra-colors-bg-subtle: #1e293b;
      --chakra-colors-bg-muted: #334155;
      --chakra-colors-bg-emphasized: #475569;

      --chakra-colors-fg-default: #f8fafc;
      --chakra-colors-fg-muted: #94a3b8;
      --chakra-colors-fg-subtle: #64748b;
      --chakra-colors-fg-inverted: #0f172a;

      --chakra-colors-border-subtle: rgba(255, 255, 255, 0.08);
      --chakra-colors-border-default: rgba(255, 255, 255, 0.14);
      --chakra-colors-border-emphasized: rgba(255, 255, 255, 0.25);

      --chakra-colors-brand-subtle: rgba(13, 148, 136, 0.2);
      --chakra-colors-brand-solid: #14b8a6;
      --chakra-colors-brand-fg: #2dd4bf;

      --chakra-colors-sidebar-bg: #0b1120;
      --chakra-colors-sidebar-border: rgba(255, 255, 255, 0.06);
      --chakra-colors-header-bg: #0b1120;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--chakra-fonts-body);
      background-color: var(--chakra-colors-bg-canvas);
      color: var(--chakra-colors-fg-default);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    /* Chakra Button Slot Recipes */
    .chakra-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      font-family: inherit;
      font-weight: 600;
      border-radius: var(--chakra-radii-md);
      transition: all 0.15s ease;
      cursor: pointer;
      border: 1px solid transparent;
      padding: 0.5rem 0.85rem;
      font-size: 0.8125rem;
      text-decoration: none;
      white-space: nowrap;
      user-select: none;
      touch-action: manipulation;
    }
    .chakra-button.solid {
      background: var(--chakra-colors-brand-solid);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(13, 148, 136, 0.25);
    }
    .chakra-button.solid:hover {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }
    .chakra-button.subtle {
      background: var(--chakra-colors-bg-subtle);
      color: var(--chakra-colors-fg-default);
      border-color: var(--chakra-colors-border-subtle);
    }
    .chakra-button.subtle:hover {
      background: var(--chakra-colors-bg-muted);
      border-color: var(--chakra-colors-border-default);
    }
    .chakra-button.outline {
      background: transparent;
      color: var(--chakra-colors-fg-default);
      border-color: var(--chakra-colors-border-default);
    }
    .chakra-button.outline:hover {
      background: var(--chakra-colors-bg-subtle);
      border-color: var(--chakra-colors-border-emphasized);
    }
    .chakra-button.danger {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
    }
    .chakra-button.danger:hover {
      background: #ef4444;
      color: #ffffff;
    }
    .chakra-button.ghost {
      background: transparent;
      color: var(--chakra-colors-fg-muted);
    }
    .chakra-button.ghost:hover {
      background: var(--chakra-colors-bg-subtle);
      color: var(--chakra-colors-fg-default);
    }

    /* Chakra Card Slot Recipes */
    .chakra-card {
      background: var(--chakra-colors-bg-panel);
      border: 1px solid var(--chakra-colors-border-subtle);
      border-radius: var(--chakra-radii-lg);
      padding: 1.25rem;
      box-shadow: var(--chakra-shadows-sm);
      backdrop-filter: blur(12px);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .chakra-card:hover {
      border-color: var(--chakra-colors-border-default);
    }

    /* Chakra Badge Slot Recipes */
    .chakra-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.2rem 0.5rem;
      border-radius: var(--chakra-radii-xs);
    }
    .chakra-badge.teal {
      background: var(--chakra-colors-brand-subtle);
      color: var(--chakra-colors-brand-fg);
    }
    .chakra-badge.gray {
      background: var(--chakra-colors-bg-subtle);
      color: var(--chakra-colors-fg-muted);
    }
    .chakra-badge.purple {
      background: rgba(168, 85, 247, 0.15);
      color: #a855f7;
    }
    .chakra-badge.red {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
    .chakra-badge.blue {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    /* Form Fields */
    .chakra-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 0.875rem;
    }
    .chakra-field label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--chakra-colors-fg-default);
    }
    .chakra-input {
      font-family: inherit;
      width: 100%;
      background: var(--chakra-colors-bg-subtle);
      border: 1px solid var(--chakra-colors-border-default);
      color: var(--chakra-colors-fg-default);
      border-radius: var(--chakra-radii-md);
      padding: 0.55rem 0.75rem;
      font-size: 0.875rem;
      outline: none;
      transition: all 0.15s ease;
    }
    .chakra-input:focus {
      border-color: var(--chakra-colors-brand-solid);
      box-shadow: 0 0 0 1px var(--chakra-colors-brand-solid);
      background: var(--chakra-colors-bg-surface);
    }

    /* Tables */
    .chakra-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.8125rem;
    }
    .chakra-table th {
      padding: 0.75rem 1rem;
      background: var(--chakra-colors-bg-subtle);
      color: var(--chakra-colors-fg-muted);
      font-weight: 700;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--chakra-colors-border-subtle);
      white-space: nowrap;
    }
    .chakra-table td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--chakra-colors-border-subtle);
      color: var(--chakra-colors-fg-default);
      vertical-align: middle;
    }
    .chakra-table tr:hover td {
      background: var(--chakra-colors-bg-subtle);
    }

    /* Layout Structure */
    .admin-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
    }
    .admin-topbar {
      height: 52px;
      background: var(--chakra-colors-header-bg);
      border-bottom: 1px solid var(--chakra-colors-border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .admin-breadcrumbs-bar {
      background: var(--chakra-colors-bg-subtle);
      border-bottom: 1px solid var(--chakra-colors-border-subtle);
      padding: 0.4rem 1.25rem;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .breadcrumbs-trail {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      overflow-x: auto;
      white-space: nowrap;
    }
    .breadcrumbs-trail a {
      color: var(--chakra-colors-brand-fg);
      text-decoration: none;
      font-weight: 600;
    }
    .breadcrumbs-trail span.current {
      color: var(--chakra-colors-fg-muted);
    }
    .admin-body {
      display: flex;
      flex: 1;
      position: relative;
    }
    .admin-sidebar {
      width: 250px;
      background: var(--chakra-colors-sidebar-bg);
      border-right: 1px solid var(--chakra-colors-sidebar-border);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      flex-shrink: 0;
      min-height: calc(100vh - 84px);
    }
    .admin-content {
      flex: 1;
      padding: 1.5rem;
      max-width: 100%;
      overflow-x: hidden;
      min-width: 0;
    }

    .nav-group-heading {
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--chakra-colors-fg-muted);
      margin-bottom: 0.4rem;
      padding-left: 0.5rem;
    }
    .nav-link-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0.65rem;
      border-radius: var(--chakra-radii-md);
      color: var(--chakra-colors-fg-default);
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 600;
      transition: all 0.15s ease;
      margin-bottom: 2px;
    }
    .nav-link-item:hover {
      background: var(--chakra-colors-bg-subtle);
    }
    .nav-link-item.active {
      background: var(--chakra-colors-brand-subtle);
      color: var(--chakra-colors-brand-fg);
      font-weight: 700;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-weight: 800;
      font-size: 0.9375rem;
      color: var(--chakra-colors-fg-default);
    }
    .header-brand-badge {
      width: 26px;
      height: 26px;
      border-radius: var(--chakra-radii-md);
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 800;
      box-shadow: 0 2px 6px rgba(13, 148, 136, 0.4);
    }

    .admin-toast-container {
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 100;
      pointer-events: none;
    }
    .chakra-toast {
      pointer-events: auto;
      background: var(--chakra-colors-bg-surface);
      border: 1px solid var(--chakra-colors-border-default);
      box-shadow: var(--chakra-shadows-lg);
      border-radius: var(--chakra-radii-lg);
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 280px;
      max-width: 420px;
      animation: toastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toastIn {
      from { transform: translateY(12px) scale(0.96); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .admin-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 90;
      padding: 1rem;
    }

    /* Responsive Mobile Drawer */
    .mobile-hamburger-btn { display: none; }
    .admin-sidebar-backdrop { display: none; }

    @media (max-width: 768px) {
      .mobile-hamburger-btn { display: inline-flex; }
      .desktop-only-text { display: none; }
      .admin-sidebar {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 50;
        width: 260px;
        transform: translateX(-100%);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: var(--chakra-shadows-xl);
      }
      .admin-sidebar.mobile-open {
        transform: translateX(0);
      }
      .admin-sidebar-backdrop.active {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(3px);
        z-index: 45;
      }
      .admin-content {
        padding: 1rem 0.75rem;
      }
    }

    ${customCss}
  </style>
</head>
<body>
  <!-- React App Root Container -->
  <div id="root">
    <div style="display: flex; height: 100vh; align-items: center; justify-content: center; font-family: sans-serif; color: var(--chakra-colors-fg-muted);">
      <div style="text-align: center;">
        <div style="font-weight: 700; font-size: 1.125rem; margin-bottom: 6px;">Bootstrapping React Admin Console...</div>
        <div style="font-size: 0.8125rem;">Connecting to JSango Metadata Registry</div>
      </div>
    </div>
  </div>

  <!-- Client-Side Config Initialization -->
  <script>
    window.__JSANGO_ADMIN_CONFIG__ = ${JSON.stringify(clientConfig)};
  </script>

  <!-- Bundled React Application Code -->
  <script>
    ${ADMIN_APP_BUNDLE_JS}
  </script>
</body>
</html>`;
}

/**
 * Creates an HTTP route handler for mounting the React Chakra UI Admin Single-Page App.
 */
export function createAdminUiHandler(
  options: AdminSpaOptions = {}
): (ctx: RequestContext) => HttpResponse {
  const html = renderAdminSpaHtml(options);
  return (_ctx: RequestContext): HttpResponse => {
    return HttpResponse.html(html);
  };
}
