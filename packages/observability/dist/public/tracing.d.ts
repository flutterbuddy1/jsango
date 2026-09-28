import type { ISpan, ITracer, SpanContext, SpanKind, SpanOptions, SpanStatus, SpanStatusCode, SpanEvent, TraceSampler } from './types.js';
export declare class Span implements ISpan {
    readonly context: SpanContext;
    readonly name: string;
    readonly kind: SpanKind;
    readonly startTime: number;
    endTime?: number | undefined;
    durationMs?: number | undefined;
    status: SpanStatus;
    readonly attributes: Record<string, unknown>;
    readonly events: SpanEvent[];
    constructor(name: string, context: SpanContext, options?: SpanOptions);
    setAttribute(key: string, value: unknown): this;
    setAttributes(attributes: Record<string, unknown>): this;
    setStatus(code: SpanStatusCode, description?: string): this;
    addEvent(name: string, attributes?: Record<string, unknown>): this;
    recordException(exception: unknown): this;
    end(endTime?: number): void;
}
export declare class NoopSpan implements ISpan {
    static readonly INSTANCE: NoopSpan;
    readonly context: SpanContext;
    readonly name = "noop";
    readonly kind: SpanKind;
    readonly startTime = 0;
    readonly status: SpanStatus;
    readonly attributes: {};
    readonly events: readonly SpanEvent[];
    setAttribute(): this;
    setAttributes(): this;
    setStatus(): this;
    addEvent(): this;
    recordException(): this;
    end(): void;
}
export interface TracerOptions {
    readonly enabled?: boolean | undefined;
    readonly sampler?: TraceSampler | undefined;
    readonly sampleRate?: number | undefined;
}
export declare class Tracer implements ITracer {
    private readonly enabled;
    private readonly sampler;
    constructor(options?: TracerOptions);
    startSpan(name: string, options?: SpanOptions): ISpan;
    withSpan<T>(name: string, fn: (span: ISpan) => Promise<T> | T, options?: SpanOptions): Promise<T>;
}
//# sourceMappingURL=tracing.d.ts.map