# Observability Architecture (`@django-js/observability`)

## Overview

`@django-js/observability` provides framework-wide, vendor-neutral observability primitives for Nexora applications:

- **Structured Logging**: Scoped contexts, log injection protection, and log level filtering.
- **Metrics**: Bounded `Counter`, `Gauge`, and `Histogram` with strict label cardinality limits (protection against DoS and memory leaks).
- **Tracing**: Lightweight `Tracer` and `Span` primitives using monotonic high-resolution timing (`performance.now()`) with context propagation and sampling.
- **Correlation**: Request ID generation, validation, sanitization, and W3C `traceparent` parsing & propagation.
- **Health & Diagnostics**: Separated `liveness` and `readiness` health checks, safe public health endpoints, and authenticated runtime diagnostics.
- **Redaction & PII Protection**: Recursive deep masking of sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`, etc.) with zero in-place mutation of input objects.
- **Framework Hooks & Middleware**: Automated HTTP request/response metrics, duration recording, and correlation header management.

---

## Core Primitives

### 1. Structured Logging

```typescript
import { StructuredLogger } from '@django-js/observability';

const logger = new StructuredLogger({
  name: 'order-service',
  minLevel: 'info',
});

const scopedLogger = logger.withContext({ orderId: 'ord_123', userId: 'usr_456' });
scopedLogger.info('Processing order payment', { amount: 99.95 });
```

### 2. Metrics Registry & Cardinality Protection

```typescript
import { MetricRegistry } from '@django-js/observability';

const metrics = new MetricRegistry({ maxCardinalityPerMetric: 1000 });
const requestCounter = metrics.counter('http.requests.total', 'HTTP request count', [
  'method',
  'status',
]);
requestCounter.inc({ method: 'GET', status: '200' });

const latencyHist = metrics.histogram(
  'http.request.duration',
  'Request latency ms',
  [5, 10, 25, 50, 100, 500]
);
latencyHist.observe(23.4, { route: '/users' });
```

### 3. Tracing & Monotonic Spans

```typescript
import { Tracer } from '@django-js/observability';

const tracer = new Tracer({ serviceName: 'user-api' });

await tracer.trace('user.fetch', async (span) => {
  span.setAttribute('user.id', '123');
  // Monotonic execution timing
});
```

### 4. Health Checks & Diagnostic Handlers

```typescript
import {
  HealthRegistry,
  createHealthHandler,
  DiagnosticsProvider,
  createDiagnosticsHandler,
} from '@django-js/observability';

const health = new HealthRegistry();
health.register('db', async () => checkDbConnection(), { critical: true, timeoutMs: 3000 });

router.get('/health', createHealthHandler(health));
router.get('/health/live', createHealthHandler(health, { checkType: 'liveness' }));
router.get('/health/ready', createHealthHandler(health, { checkType: 'readiness' }));
```

---

## Security & Cardinality Defense

1. **Log Injection Prevention**: Escapes control characters (`\r`, `\n`, `\t`, `\b`, `\f`) in log messages and context strings to ensure line-based log aggregators are not manipulated.
2. **Cardinality Limiting**: Hard-capped label permutations per metric (default 1000). Unbounded inputs (e.g. query strings, email addresses, UUIDs) are rejected or dropped once the threshold is exceeded.
3. **Redaction Engine**: Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`) and object keys are masked before writing to log streams or diagnostic payloads.
4. **Health Response Protection**: Public health endpoints only report status (`healthy`, `degraded`, `unhealthy`); verbose internal error details require authorized diagnostics mode.
