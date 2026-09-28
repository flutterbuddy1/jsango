import { HttpResponse, HttpStatus } from '@jsango/http';
/**
 * Parses the standard admin list query parameters from an HTTP request.
 */
export function parseListQuery(req) {
    const qs = req.query;
    const page = parseInt(qs.get('page') ?? '1', 10);
    const pageSize = parseInt(qs.get('pageSize') ?? '0', 10);
    const search = qs.get('search') ?? undefined;
    const sort = qs.get('sort') ?? undefined;
    const rawDir = qs.get('sortDirection');
    const sortDirection = rawDir === 'asc' || rawDir === 'desc' ? rawDir : undefined;
    // Collect filter_* params into a Record
    const filters = {};
    for (const [key, value] of qs.entries()) {
        if (key.startsWith('filter_')) {
            filters[key.slice(7)] = value;
        }
    }
    return {
        page: isNaN(page) || page < 1 ? 1 : page,
        pageSize: isNaN(pageSize) || pageSize < 1 ? undefined : pageSize,
        search,
        sort,
        sortDirection,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
    };
}
/**
 * Returns a standard Admin JSON success response.
 */
export function sendJson(data, status = HttpStatus.OK) {
    return HttpResponse.json({ ok: true, data }, { status });
}
/**
 * Returns a standard Admin JSON error response.
 * Never exposes stack traces or raw error internals in production.
 */
export function sendError(status, code, message, meta) {
    return HttpResponse.json({ ok: false, error: { code, message, ...(meta ? { meta } : {}) } }, { status });
}
/**
 * Extracts the requesting actor's IP address from standard headers.
 */
export function extractIpAddress(req) {
    return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        undefined);
}
//# sourceMappingURL=http-helpers.js.map