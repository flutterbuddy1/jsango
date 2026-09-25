export type {
  ObservabilityLogLevel,
  RedactionOptions,
  StructuredLogEntry,
  MetricType,
  MetricLabels,
  MetricDefinition,
  CounterValue,
  GaugeValue,
  HistogramBucket,
  HistogramValue,
  MetricSnapshot,
  SpanKind,
  SpanStatusCode,
  SpanStatus,
  SpanContext,
  SpanEvent,
  SpanOptions,
  ISpan,
  TraceSampler,
  ITracer,
  HealthStatus,
  HealthResult,
  HealthCheckFn,
  HealthCheckOptions,
  OverallHealth,
  DiagnosticRuntimeInfo,
  DiagnosticMemoryInfo,
  DiagnosticComponentStatus,
  DiagnosticInfo,
} from './types.js';

export { Redactor } from './redaction.js';
export { CorrelationManager } from './correlation.js';
export { StructuredLogger, type StructuredLoggerOptions, type LogSink } from './logger.js';
export { Counter, Gauge, Histogram, MetricRegistry, DEFAULT_HISTOGRAM_BUCKETS } from './metrics.js';
export { Span, NoopSpan, Tracer, type TracerOptions } from './tracing.js';
export { HealthRegistry, createHealthHandler, type HealthHandlerOptions } from './health.js';
export {
  DiagnosticsProvider,
  createDiagnosticsHandler,
  type DiagnosticsHandlerOptions,
  type ComponentDiagnosticsProvider,
} from './diagnostics.js';
export {
  createHttpInstrumentationMiddleware,
  FrameworkInstrumentation,
  type HttpInstrumentationOptions,
} from './instrumentation.js';
