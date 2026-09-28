/**
 * Admin API Error representation
 */
export declare class AdminApiError extends Error {
    readonly code: string;
    readonly status: number;
    readonly fieldErrors?: Record<string, string> | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    constructor(options: {
        readonly code: string;
        readonly message: string;
        readonly status: number;
        readonly fieldErrors?: Record<string, string> | undefined;
        readonly metadata?: Record<string, unknown> | undefined;
    });
}
//# sourceMappingURL=errors.d.ts.map