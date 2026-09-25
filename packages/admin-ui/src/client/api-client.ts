import type { AdminResourceSchema } from '@jsango/admin-core';
import type {
  AdminResourceSummary,
  AdminListQueryState,
  AdminListResponse,
  AdminUserIdentity,
  AdminAuditRecord,
  AdminSystemHealth,
} from '../types/index.js';
import type { AdminApiClientOptions, DashboardResponse, CustomPageSummary } from './types.js';
import { AdminApiError } from './errors.js';

export class AdminApiClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: (() => string | null | Promise<string | null>) | undefined;
  private readonly onUnauthorized?: (() => void) | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: AdminApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/admin/api/v1';
    this.getAuthToken = options.getAuthToken;
    this.onUnauthorized = options.onUnauthorized;
    this.fetchFn =
      options.fetchFn ??
      (typeof fetch !== 'undefined'
        ? fetch
        : ((async () => {
            throw new Error('fetch is not available in the current environment.');
          }) as unknown as typeof fetch));
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(init.headers);

    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        ...init,
        headers,
      });
    } catch (err: unknown) {
      throw new AdminApiError({
        code: 'ERR_NETWORK',
        message: err instanceof Error ? err.message : 'Network error occurred.',
        status: 0,
      });
    }

    if (response.status === 401) {
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    let json: Record<string, unknown>;
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new AdminApiError({
          code: 'ERR_HTTP',
          message: `HTTP error ${response.status}: ${response.statusText}`,
          status: response.status,
        });
      }
      return null as unknown as T;
    }

    if (!response.ok) {
      const errorObj = (json['error'] as Record<string, unknown>) ?? json;
      const code =
        typeof errorObj['code'] === 'string' ? errorObj['code'] : `ERR_HTTP_${response.status}`;
      const message =
        typeof errorObj['message'] === 'string' ? errorObj['message'] : 'An error occurred.';
      const fieldErrors = errorObj['fieldErrors'] as Record<string, string> | undefined;
      const metadata = errorObj['metadata'] as Record<string, unknown> | undefined;

      throw new AdminApiError({
        code,
        message,
        status: response.status,
        fieldErrors,
        metadata,
      });
    }

    return json as unknown as T;
  }

  // ----------------------------------------------------------------
  // Authentication & Identity
  // ----------------------------------------------------------------

  public async getAuthMe(): Promise<{ user: AdminUserIdentity; canAccessAdmin: boolean }> {
    return this.request<{ user: AdminUserIdentity; canAccessAdmin: boolean }>('/auth/me');
  }

  // ----------------------------------------------------------------
  // Resources & Schema
  // ----------------------------------------------------------------

  public async listResources(): Promise<readonly AdminResourceSummary[]> {
    const res = await this.request<{ resources: readonly AdminResourceSummary[] }>('/resources');
    return res.resources;
  }

  public async getResourceSchema(resourceId: string): Promise<AdminResourceSchema> {
    const res = await this.request<{ schema: AdminResourceSchema }>(
      `/resources/${encodeURIComponent(resourceId)}/schema`
    );
    return res.schema;
  }

  // ----------------------------------------------------------------
  // CRUD Operations
  // ----------------------------------------------------------------

  public async listRecords<T = Record<string, unknown>>(
    resourceId: string,
    query: Partial<AdminListQueryState> = {}
  ): Promise<AdminListResponse<T>> {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.search) params.set('search', query.search);
    if (query.sort) params.set('sort', query.sort);
    if (query.sortDirection) params.set('sortDirection', query.sortDirection);

    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) {
        if (v !== undefined && v !== null && v !== '') {
          params.set(`filter[${k}]`, String(v));
        }
      }
    }

    const qs = params.toString();
    const path = `/resources/${encodeURIComponent(resourceId)}${qs ? `?${qs}` : ''}`;
    return this.request<AdminListResponse<T>>(path);
  }

  public async getRecord<T = Record<string, unknown>>(
    resourceId: string,
    id: string | number
  ): Promise<T> {
    const res = await this.request<{ item: T }>(
      `/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}`
    );
    return res.item;
  }

  public async createRecord<T = Record<string, unknown>>(
    resourceId: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const res = await this.request<{ item: T }>(`/resources/${encodeURIComponent(resourceId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.item;
  }

  public async updateRecord<T = Record<string, unknown>>(
    resourceId: string,
    id: string | number,
    data: Record<string, unknown>
  ): Promise<T> {
    const res = await this.request<{ item: T }>(
      `/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
    return res.item;
  }

  public async deleteRecord(resourceId: string, id: string | number): Promise<void> {
    await this.request<void>(
      `/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}`,
      {
        method: 'DELETE',
      }
    );
  }

  public async restoreRecord<T = Record<string, unknown>>(
    resourceId: string,
    id: string | number
  ): Promise<T> {
    const res = await this.request<{ item: T }>(
      `/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}/restore`,
      {
        method: 'POST',
      }
    );
    return res.item;
  }

  public async executeAction<TResult = unknown>(
    resourceId: string,
    id: string | number,
    actionId: string,
    input?: unknown
  ): Promise<TResult> {
    const init: RequestInit = { method: 'POST' };
    if (input !== undefined) {
      init.body = JSON.stringify(input);
    }
    const res = await this.request<{ result: TResult }>(
      `/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}/actions/${encodeURIComponent(actionId)}`,
      init
    );
    return res.result;
  }

  public async executeBulkAction<TResult = unknown>(
    resourceId: string,
    actionId: string,
    ids: readonly (string | number)[],
    input?: unknown
  ): Promise<TResult> {
    const res = await this.request<{ result: TResult }>(
      `/resources/${encodeURIComponent(resourceId)}/bulk/${encodeURIComponent(actionId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ ids, input }),
      }
    );
    return res.result;
  }

  // ----------------------------------------------------------------
  // Dashboard & Custom Pages
  // ----------------------------------------------------------------

  public async getDashboard(): Promise<DashboardResponse> {
    return this.request<DashboardResponse>('/dashboard');
  }

  public async listPages(): Promise<readonly CustomPageSummary[]> {
    const res = await this.request<{ pages: readonly CustomPageSummary[] }>('/pages');
    return res.pages;
  }

  public async getPage(pageId: string): Promise<CustomPageSummary> {
    const res = await this.request<{ page: CustomPageSummary }>(
      `/pages/${encodeURIComponent(pageId)}`
    );
    return res.page;
  }

  // ----------------------------------------------------------------
  // Audit Logs
  // ----------------------------------------------------------------

  public async getAuditLogs(
    options: {
      readonly resourceId?: string | undefined;
      readonly action?: string | undefined;
      readonly actorId?: string | undefined;
      readonly limit?: number | undefined;
      readonly offset?: number | undefined;
    } = {}
  ): Promise<{ entries: readonly AdminAuditRecord[]; total: number }> {
    const params = new URLSearchParams();
    if (options.resourceId) params.set('resourceId', options.resourceId);
    if (options.action) params.set('action', options.action);
    if (options.actorId) params.set('actorId', options.actorId);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const qs = params.toString();
    return this.request<{ entries: readonly AdminAuditRecord[]; total: number }>(
      `/audit${qs ? `?${qs}` : ''}`
    );
  }

  // ----------------------------------------------------------------
  // System Health
  // ----------------------------------------------------------------

  public async getSystemHealth(): Promise<AdminSystemHealth> {
    const res = await this.request<{ health: AdminSystemHealth }>('/system/health');
    return res.health;
  }
}
