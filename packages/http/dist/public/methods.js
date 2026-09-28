export const HTTP_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
    'TRACE',
    'CONNECT',
];
export function isHttpMethod(value) {
    return HTTP_METHODS.includes(value.toUpperCase());
}
//# sourceMappingURL=methods.js.map