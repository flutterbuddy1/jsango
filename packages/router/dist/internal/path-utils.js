export function normalizePath(path) {
    if (!path || path === '/') {
        return '/';
    }
    // Ensure leading slash
    let normalized = path.startsWith('/') ? path : `/${path}`;
    // Collapse multiple slashes (e.g. //a///b/ -> /a/b/)
    normalized = normalized.replace(/\/+/g, '/');
    // Strip trailing slash if length > 1
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}
export function joinPaths(prefix, path) {
    const normPrefix = normalizePath(prefix);
    const normPath = normalizePath(path);
    if (normPrefix === '/')
        return normPath;
    if (normPath === '/')
        return normPrefix;
    return `${normPrefix}${normPath}`;
}
export function splitSegments(path) {
    const normalized = normalizePath(path);
    if (normalized === '/') {
        return [];
    }
    return normalized.slice(1).split('/');
}
export function safeDecodeParam(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        // If malformed percent encoding occurs, return raw string gracefully
        return value;
    }
}
//# sourceMappingURL=path-utils.js.map