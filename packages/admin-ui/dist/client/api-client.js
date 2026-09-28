import { AdminApiError } from './errors.js';
export class AdminApiClient {
    baseUrl;
    getAuthToken;
    onUnauthorized;
    fetchFn;
    constructor(options = {}) {
        this.baseUrl = options.baseUrl ?? '/admin/api/v1';
        this.getAuthToken = options.getAuthToken;
        this.onUnauthorized = options.onUnauthorized;
        this.fetchFn =
            options.fetchFn ??
                (typeof fetch !== 'undefined'
                    ? fetch
                    : (async () => {
                        throw new Error('fetch is not available in the current environment.');
                    }));
    }
    async request(path, init = {}) {
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
        let response;
        try {
            response = await this.fetchFn(url, {
                ...init,
                headers,
            });
        }
        catch (err) {
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
            return null;
        }
        let json;
        try {
            json = (await response.json());
        }
        catch {
            if (!response.ok) {
                throw new AdminApiError({
                    code: 'ERR_HTTP',
                    message: `HTTP error ${response.status}: ${response.statusText}`,
                    status: response.status,
                });
            }
            return null;
        }
        if (!response.ok) {
            const errorObj = json['error'] ?? json;
            const code = typeof errorObj['code'] === 'string' ? errorObj['code'] : `ERR_HTTP_${response.status}`;
            const message = typeof errorObj['message'] === 'string' ? errorObj['message'] : 'An error occurred.';
            const fieldErrors = errorObj['fieldErrors'];
            const metadata = errorObj['metadata'];
            throw new AdminApiError({
                code,
                message,
                status: response.status,
                fieldErrors,
                metadata,
            });
        }
        return json;
    }
    // ----------------------------------------------------------------
    // Authentication & Identity
    // ----------------------------------------------------------------
    async getAuthMe() {
        return this.request('/auth/me');
    }
    // ----------------------------------------------------------------
    // Resources & Schema
    // ----------------------------------------------------------------
    async listResources() {
        const res = await this.request('/resources');
        return res.resources;
    }
    async getResourceSchema(resourceId) {
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}/schema`);
        return res.schema;
    }
    // ----------------------------------------------------------------
    // CRUD Operations
    // ----------------------------------------------------------------
    async listRecords(resourceId, query = {}) {
        const params = new URLSearchParams();
        if (query.page)
            params.set('page', String(query.page));
        if (query.pageSize)
            params.set('pageSize', String(query.pageSize));
        if (query.search)
            params.set('search', query.search);
        if (query.sort)
            params.set('sort', query.sort);
        if (query.sortDirection)
            params.set('sortDirection', query.sortDirection);
        if (query.filters) {
            for (const [k, v] of Object.entries(query.filters)) {
                if (v !== undefined && v !== null && v !== '') {
                    params.set(`filter[${k}]`, String(v));
                }
            }
        }
        const qs = params.toString();
        const path = `/resources/${encodeURIComponent(resourceId)}${qs ? `?${qs}` : ''}`;
        return this.request(path);
    }
    async getRecord(resourceId, id) {
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}`);
        return res.item;
    }
    async createRecord(resourceId, data) {
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return res.item;
    }
    async updateRecord(resourceId, id, data) {
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        return res.item;
    }
    async deleteRecord(resourceId, id) {
        await this.request(`/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}`, {
            method: 'DELETE',
        });
    }
    async restoreRecord(resourceId, id) {
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}/restore`, {
            method: 'POST',
        });
        return res.item;
    }
    async executeAction(resourceId, id, actionId, input) {
        const init = { method: 'POST' };
        if (input !== undefined) {
            init.body = JSON.stringify(input);
        }
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}/${encodeURIComponent(String(id))}/actions/${encodeURIComponent(actionId)}`, init);
        return res.result;
    }
    async executeBulkAction(resourceId, actionId, ids, input) {
        const res = await this.request(`/resources/${encodeURIComponent(resourceId)}/bulk/${encodeURIComponent(actionId)}`, {
            method: 'POST',
            body: JSON.stringify({ ids, input }),
        });
        return res.result;
    }
    // ----------------------------------------------------------------
    // Dashboard & Custom Pages
    // ----------------------------------------------------------------
    async getDashboard() {
        return this.request('/dashboard');
    }
    async listPages() {
        const res = await this.request('/pages');
        return res.pages;
    }
    async getPage(pageId) {
        const res = await this.request(`/pages/${encodeURIComponent(pageId)}`);
        return res.page;
    }
    // ----------------------------------------------------------------
    // Audit Logs
    // ----------------------------------------------------------------
    async getAuditLogs(options = {}) {
        const params = new URLSearchParams();
        if (options.resourceId)
            params.set('resourceId', options.resourceId);
        if (options.action)
            params.set('action', options.action);
        if (options.actorId)
            params.set('actorId', options.actorId);
        if (options.limit)
            params.set('limit', String(options.limit));
        if (options.offset)
            params.set('offset', String(options.offset));
        const qs = params.toString();
        return this.request(`/audit${qs ? `?${qs}` : ''}`);
    }
    // ----------------------------------------------------------------
    // System Health
    // ----------------------------------------------------------------
    async getSystemHealth() {
        const res = await this.request('/system/health');
        return res.health;
    }
}
//# sourceMappingURL=api-client.js.map