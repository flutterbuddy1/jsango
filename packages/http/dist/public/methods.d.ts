export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT';
export declare const HTTP_METHODS: readonly HttpMethod[];
export declare function isHttpMethod(value: string): value is HttpMethod;
//# sourceMappingURL=methods.d.ts.map