import { describe, it, expect } from 'vitest';
import type { AdminResourceSchema } from '@jsango/admin-core';
import {
  renderDashboardView,
  renderResourceListView,
  renderResourceDetailView,
  renderResourceCreateView,
  renderResourceEditView,
  renderAuditLogView,
  renderSystemHealthView,
  renderLoginView,
} from '../components/views/index.js';

const mockSchema: AdminResourceSchema = {
  id: 'articles',
  label: 'Article',
  pluralLabel: 'Articles',
  primaryKey: 'id',
  fields: [
    { name: 'id', type: 'number', label: 'ID', sortable: true },
    { name: 'title', type: 'text', label: 'Title', required: true, searchable: true },
    { name: 'published', type: 'boolean', label: 'Published' },
  ],
  listFields: ['id', 'title', 'published'],
  detailFields: ['id', 'title', 'published'],
  createFields: ['title', 'published'],
  editFields: ['title', 'published'],
  searchFields: ['title'],
  defaultSortDirection: 'desc',
  defaultPageSize: 20,
  maxPageSize: 100,
  filters: [{ name: 'published', type: 'boolean', field: 'published', label: 'Published' }],
  actions: [],
  bulkActions: [{ id: 'delete', label: 'Delete Selected', requiresConfirmation: true }],
  canSoftDelete: true,
};

describe('Views Engine', () => {
  it('renders dashboard with metric and activity widgets', () => {
    const html = renderDashboardView({
      widgets: [
        { id: 'total_users', type: 'metric', title: 'Total Users' },
        { id: 'recent_activity', type: 'activity', title: 'Recent Activity' },
      ],
      data: {
        total_users: { value: 1250, change: 12, trend: 'up' },
        recent_activity: [{ id: '1', title: 'User registered', icon: '👤' }],
      },
    });

    expect(html).toContain('Total Users');
    expect(html).toContain('1250');
    expect(html).toContain('Recent Activity');
    expect(html).toContain('User registered');
  });

  it('renders resource list with filter bar, data table, and bulk actions', () => {
    const html = renderResourceListView({
      schema: mockSchema,
      items: [
        { id: 1, title: 'First Article', published: true },
        { id: 2, title: 'Second Article', published: false },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      activeFilters: {},
      selectedIds: [1],
    });

    expect(html).toContain('Articles');
    expect(html).toContain('First Article');
    expect(html).toContain('Second Article');
    expect(html).toContain('record selected');
  });

  it('renders resource detail and edit forms', () => {
    const detailHtml = renderResourceDetailView({
      schema: mockSchema,
      item: { id: 10, title: 'Special Feature', published: true },
    });
    expect(detailHtml).toContain('Article: Special Feature');
    expect(detailHtml).toContain('Special Feature');

    const createHtml = renderResourceCreateView({
      schema: mockSchema,
    });
    expect(createHtml).toContain('Create Article');

    const editHtml = renderResourceEditView({
      schema: mockSchema,
      item: { id: 10, title: 'Special Feature', published: true },
    });
    expect(editHtml).toContain('Edit Article');
    expect(editHtml).toContain('Special Feature');
  });

  it('renders audit logs and system health', () => {
    const auditHtml = renderAuditLogView({
      entries: [
        {
          id: 'aud_1',
          resourceId: 'articles',
          recordId: 10,
          action: 'update',
          actorName: 'admin',
          timestamp: Date.now(),
          changes: { before: { title: 'Old' }, after: { title: 'New' } },
        },
      ],
      total: 1,
    });
    expect(auditHtml).toContain('articles #10');
    expect(auditHtml).toContain('update');

    const healthHtml = renderSystemHealthView({
      health: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 7200,
        memory: { heapUsed: 50000000, heapTotal: 80000000, rss: 100000000 },
        services: { database: { status: 'up' }, cache: { status: 'up' } },
      },
    });
    expect(healthHtml).toContain('healthy');
    expect(healthHtml).toContain('database');
  });

  it('renders login view', () => {
    const loginHtml = renderLoginView({ appTitle: 'Custom Admin' });
    expect(loginHtml).toContain('Custom Admin');
    expect(loginHtml).toContain('Sign In');
  });
});
