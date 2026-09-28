export declare class CorrelationManager {
    /**
     * Returns a sanitized request ID from an untrusted client header, or generates a fresh UUID.
     */
    static resolveRequestId(rawHeader?: string | undefined): string;
    /**
     * Generates a 32-character hexadecimal trace ID.
     */
    static generateTraceId(): string;
    /**
     * Generates a 16-character hexadecimal span ID.
     */
    static generateSpanId(): string;
    /**
     * Parses standard W3C traceparent header (format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01).
     */
    static parseTraceparent(header?: string | undefined): {
        traceId: string;
        parentSpanId: string;
        sampled: boolean;
    } | undefined;
    /**
     * Formats a W3C traceparent header.
     */
    static formatTraceparent(traceId: string, spanId: string, sampled?: boolean): string;
}
//# sourceMappingURL=correlation.d.ts.map