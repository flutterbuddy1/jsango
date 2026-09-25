import { describe, it, expect, vi } from 'vitest';
import { AdminApiClient } from '../client/api-client.js';
import { AdminApiError } from '../client/errors.js';

describe('AdminApiClient', () => {
  it('sends authorized requests with Bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ resources: [{ id: 'users', label: 'User', pluralLabel: 'Users' }] }),
    });

    const client = new AdminApiClient({
      baseUrl: '/api/admin',
      getAuthToken: () => 'test-jwt-token',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const resources = await client.listResources();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.id).toBe('users');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/resources');
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token');
  });

  it('triggers onUnauthorized callback on 401 response', async () => {
    const onUnauthorized = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: { code: 'ERR_ADMIN_UNAUTHORIZED', message: 'Not authenticated' },
      }),
    });

    const client = new AdminApiClient({
      onUnauthorized,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getAuthMe()).rejects.toThrow(AdminApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('handles CRUD operations, pagination, search, and bulk actions', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/resources/posts/schema')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema: {
              id: 'posts',
              label: 'Post',
              pluralLabel: 'Posts',
              primaryKey: 'id',
              fields: [{ name: 'id' }, { name: 'title' }],
              listFields: ['id', 'title'],
              detailFields: ['id', 'title'],
              createFields: ['title'],
              editFields: ['title'],
              searchFields: ['title'],
              defaultSortDirection: 'desc',
              defaultPageSize: 20,
              maxPageSize: 100,
              filters: [],
              actions: [],
              bulkActions: [{ id: 'publish', label: 'Publish' }],
              canSoftDelete: true,
            },
          }),
        };
      }

      if (url.includes('/resources/posts?') || url.endsWith('/resources/posts')) {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ item: { id: 101, title: 'New Post' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 1, title: 'First Post' }],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          }),
        };
      }

      if (url.includes('/resources/posts/1')) {
        if (init?.method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ item: { id: 1, title: 'Updated Post' } }),
          };
        }
        if (init?.method === 'DELETE') {
          return {
            ok: true,
            status: 204,
            json: async () => null,
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ item: { id: 1, title: 'First Post' } }),
        };
      }

      if (url.includes('/resources/posts/bulk/publish')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { count: 2, published: true } }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    const client = new AdminApiClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const schema = await client.getResourceSchema('posts');
    expect(schema.id).toBe('posts');

    const list = await client.listRecords('posts', { page: 1, search: 'First' });
    expect(list.items).toHaveLength(1);

    const created = await client.createRecord('posts', { title: 'New Post' });
    expect(created['title']).toBe('New Post');

    const item = await client.getRecord('posts', 1);
    expect(item['title']).toBe('First Post');

    const updated = await client.updateRecord('posts', 1, { title: 'Updated Post' });
    expect(updated['title']).toBe('Updated Post');

    await client.deleteRecord('posts', 1);

    const bulkRes = await client.executeBulkAction('posts', 'publish', [1, 2]);
    expect((bulkRes as Record<string, unknown>)['count']).toBe(2);
  });
});
