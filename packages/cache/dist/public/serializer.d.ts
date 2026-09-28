export interface ICacheSerializer {
    serialize<T = unknown>(value: T): string;
    deserialize<T = unknown>(raw: string): T;
}
export interface SafeSerializerOptions {
    readonly maxValueBytes?: number | undefined;
}
/**
 * Production-grade safe cache serializer.
 * Supports:
 * - Primitives (strings, numbers, booleans, null)
 * - Plain objects & arrays
 * - Explicit typed wrappers for Date and BigInt
 * - Defenses: Prototype pollution sanitization, bounded byte size, zero arbitrary code execution.
 */
export declare class SafeCacheSerializer implements ICacheSerializer {
    private readonly maxValueBytes;
    constructor(options?: SafeSerializerOptions);
    serialize<T = unknown>(value: T): string;
    deserialize<T = unknown>(raw: string): T;
}
//# sourceMappingURL=serializer.d.ts.map