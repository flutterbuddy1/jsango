export type ObservabilityLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface RedactionOptions {
  readonly keys?: readonly string[] | undefined;
  readonly pattern?: RegExp | undefined;
  readonly mask?: string | undefined;
}

export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: ObservabilityLogLevel;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>> | undefined;
  readonly requestId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly spanId?: string | undefined;
  readonly module?: string | undefined;
  readonly error?:
    | {
        readonly code?: string | undefined;
        readonly message: string;
        readonly stack?: string | undefined;
      }
    | undefined;
}

// ---------------------------------------------------------------------------
// Metrics Types
// ---------------------------------------------------------------------------

export type MetricType = 'counter' | 'gauge' | 'histogram';

export type MetricLabels = Record<string, string | number | boolean>;

export interface MetricDefinition {
  readonly name: string;
  readonly type: MetricType;
  readonly description: string;
  readonly labelNames?: readonly string[] | undefined;
}

export interface CounterValue {
  readonly labels: MetricLabels;
  readonly value: number;
}

export interface GaugeValue {
  readonly labels: MetricLabels;
  readonly value: number;
}

export interface HistogramBucket {
  readonly le: number; // upper bound
  readonly count: number;
}

export interface HistogramValue {
  readonly labels: MetricLabels;
  readonly count: number;
  readonly sum: number;
  readonly buckets: readonly HistogramBucket[];
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

export interface MetricSnapshot<T = CounterValue | GaugeValue | HistogramValue> {
  readonly name: string;
  readonly type: MetricType;
  readonly description: string;
  readonly values: readonly T[];
}

// ---------------------------------------------------------------------------
// Tracing Types
// ---------------------------------------------------------------------------

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export type SpanStatusCode = 'ok' | 'error' | 'unset';

export interface SpanStatus {
  readonly code: SpanStatusCode;
  readonly description?: string | undefined;
}

export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string | undefined;
  readonly sampled: boolean;
}

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly attributes?: Readonly<Record<string, unknown>> | undefined;
}

export interface SpanOptions {
  readonly parent?: ISpan | SpanContext | undefined;
  readonly kind?: SpanKind | undefined;
  readonly attributes?: Record<string, unknown> | undefined;
  readonly startTime?: number | undefined;
}

export interface ISpan {
  readonly context: SpanContext;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;
  readonly endTime?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly status: SpanStatus;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly events: readonly SpanEvent[];

  setAttribute(key: string, value: unknown): this;
  setAttributes(attributes: Record<string, unknown>): this;
  setStatus(code: SpanStatusCode, description?: string): this;
  addEvent(name: string, attributes?: Record<string, unknown>): this;
  recordException(exception: unknown): this;
  end(endTime?: number): void;
}

export type TraceSampler = (traceId: string, spanName: string) => boolean;

export interface ITracer {
  startSpan(name: string, options?: SpanOptions): ISpan;
  withSpan<T>(name: string, fn: (span: ISpan) => Promise<T> | T, options?: SpanOptions): Promise<T>;
}

// ---------------------------------------------------------------------------
// Health Types
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthResult {
  readonly status: HealthStatus;
  readonly durationMs: number;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
  readonly error?: string | undefined;
}

export type HealthCheckFn = (
  signal?: AbortSignal
) => Promise<HealthResult | boolean> | HealthResult | boolean;

export interface HealthCheckOptions {
  readonly name: string;
  readonly timeoutMs?: number | undefined;
  readonly critical?: boolean | undefined;
}

export interface OverallHealth {
  readonly status: HealthStatus;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly checks: Readonly<Record<string, HealthResult>>;
}

// ---------------------------------------------------------------------------
// Diagnostics Types
// ---------------------------------------------------------------------------

export interface DiagnosticRuntimeInfo {
  readonly name: string;
  readonly version: string;
  readonly platform: string;
  readonly nodeVersion?: string | undefined;
}

export interface DiagnosticMemoryInfo {
  readonly heapUsedMb: number;
  readonly heapTotalMb: number;
  readonly rssMb: number;
  readonly externalMb?: number | undefined;
}

export interface DiagnosticComponentStatus {
  readonly status: 'ready' | 'active' | 'idle' | 'stopped' | 'error';
  readonly details?: Readonly<Record<string, unknown>> | undefined;
}

export interface DiagnosticInfo {
  readonly uptimeSeconds: number;
  readonly timestamp: string;
  readonly runtime: DiagnosticRuntimeInfo;
  readonly memory: DiagnosticMemoryInfo;
  readonly components: Readonly<Record<string, DiagnosticComponentStatus>>;
}
