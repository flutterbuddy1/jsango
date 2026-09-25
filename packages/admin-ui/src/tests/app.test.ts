import { describe, it, expect, vi } from 'vitest';
import { AdminApp } from '../app/admin-app.js';
import { AdminApiClient } from '../client/api-client.js';

describe('AdminApp Orchestrator', () => {
  it('renders application shell and routes', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/resources')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resources: [
              { id: 'users', label: 'User', pluralLabel: 'Users', navigationGroup: 'Accounts' },
            ],
          }),
        };
      }
      if (url.includes('/dashboard')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            widgets: [{ id: 'user_count', type: 'metric', title: 'Active Users' }],
            data: { user_count: 50 },
          }),
        };
      }
      if (url.includes('/pages')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pages: [] }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    const client = new AdminApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const app = new AdminApp({ client, config: { title: 'Test Admin' } });

    app.auth.setUser({
      id: 'usr_admin',
      username: 'root',
      roles: ['admin'],
      permissions: [],
      isSuperuser: true,
    });

    const dashboardHtml = await app.render();
    expect(dashboardHtml).toContain('Test Admin');
    expect(dashboardHtml).toContain('Users');
    expect(dashboardHtml).toContain('Active Users');
    expect(dashboardHtml).toContain('50');

    // Test sidebar toggle
    app.toggleSidebar();
    const collapsedHtml = await app.render();
    expect(collapsedHtml).toContain('admin-sidebar');

    // Test command palette
    app.openCommandPalette();
    app.setCommandPaletteQuery('users');
    const paletteHtml = await app.render();
    expect(paletteHtml).toContain('admin-command-palette');
    expect(paletteHtml).toContain('Users');
  });

  it('renders login view when route is set to login', async () => {
    const app = new AdminApp();
    app.setRoute({ name: 'login' });
    const html = await app.render();
    expect(html).toContain('Sign in to access');
  });
});
