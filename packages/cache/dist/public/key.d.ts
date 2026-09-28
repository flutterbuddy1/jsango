export interface CacheKeyOptions {
    readonly prefix?: string | undefined;
    readonly application?: string | undefined;
    readonly environment?: string | undefined;
    readonly namespace?: string | undefined;
    readonly maxKeyLength?: number | undefined;
    readonly delimiter?: string | undefined;
}
/**
 * Normalizes, validates, and builds safe namespaced cache keys.
 */
export declare class CacheKeyBuilder {
    readonly application?: string | undefined;
    readonly environment?: string | undefined;
    readonly prefix?: string | undefined;
    readonly namespace?: string | undefined;
    readonly maxKeyLength: number;
    readonly delimiter: string;
    constructor(options?: CacheKeyOptions);
    /**
     * Builds the fully qualified cache key:
     * [app]:[env]:[prefix]:[namespace]:key
     */
    build(key: string): string;
    /**
     * Creates a sub-builder with an additional or nested namespace.
     */
    withNamespace(subNamespace: string): CacheKeyBuilder;
    private sanitizeSegment;
}
//# sourceMappingURL=key.d.ts.map