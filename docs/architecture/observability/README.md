# Observability Architecture (`@jsango/observability`)

## Overview

`@jsango/observability` provides framework-wide, vendor-neutral observability primitives for JSango applications:

- **Structured Logging**: Scoped contexts, log injection protection, and log level filtering.
- **Metrics**: Bounded `Counter`, `Gauge`, and `Histogram` with strict label cardinality limits (protection against DoS and memory leaks).
- **Tracing**: Lightweight `Tracer` and `Span` primitives using monotonic high-resolution timing (`performance.now()`) with context propagation and sampling.
- **Correlation**: Request ID generation, validation, sanitization, and W3C `traceparent` parsing & propagation.
- **Health & Diagnostics**: A `HealthRegistry` of named checks (critical / non-critical, per-check timeouts), safe public health endpoints, and authenticated runtime diagnostics.
- **Redaction & PII Protection**: Recursive deep masking of sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`, etc.) with zero in-place mutation of input objects.
- **Framework Hooks & Middleware**: Automated HTTP request/response metrics, duration recording, and correlation header management.

---

## Core Primitives

### 1. Structured Logging

```typescript
import { StructuredLogger } from '@jsango/observability';

const logger = new StructuredLogger({
  minLevel: 'info',
  format: 'json',
  context: { service: 'order-service' },
});

const scopedLogger = logger.withContext({ orderId: 'ord_123', userId: 'usr_456' });
scopedLogger.info('Processing order payment', { amount: 99.95 });
```

### 2. Metrics Registry & Cardinality Protection

```typescript
import { MetricRegistry } from '@jsango/observability';

// Argument: max label permutations per metric (default 1000)
const metrics = new MetricRegistry(1000);
const requestCounter = metrics.counter('http.requests.total', 'HTTP request count', [
  'method',
  'status',
]);
// inc(amount = 1, labels = {})
requestCounter.inc(1, { method: 'GET', status: '200' });

// histogram(name, description, buckets?, labelNames?)
const latencyHist = metrics.histogram(
  'http.request.duration',
  'Request latency ms',
  [5, 10, 25, 50, 100, 500],
  ['route']
);
latencyHist.observe(23.4, { route: '/users' });
```

### 3. Tracing & Monotonic Spans

```typescript
import { Tracer } from '@jsango/observability';

const tracer = new Tracer({ sampleRate: 1 });

// withSpan() starts a span, sets status 'ok' (or records the exception) and ends it
await tracer.withSpan('user.fetch', async (span) => {
  span.setAttribute('user.id', '123');
  // Monotonic execution timing
});

// Manual spans
const span = tracer.startSpan('cache.lookup', { kind: 'internal' });
span.end();
```

### 4. Health Checks & Diagnostic Handlers

```typescript
import { Router } from '@jsango/router';
import {
  HealthRegistry,
  createHealthHandler,
  DiagnosticsProvider,
  createDiagnosticsHandler,
} from '@jsango/observability';

const router = new Router();
const isOperator = (ctx) => ctx.request.headers.get('x-ops-token') === process.env.OPS_TOKEN;

// Liveness: process is up (no dependencies)
const liveness = new HealthRegistry();
liveness.register('process', () => true);

// Readiness: dependencies are reachable
const readiness = new HealthRegistry();
readiness.register('db', async () => checkDbConnection(), { critical: true, timeoutMs: 3000 });

router.get('/health/live', createHealthHandler(liveness));
router.get('/health/ready', createHealthHandler(readiness, { isAuthorized: isOperator }));

const diagnostics = new DiagnosticsProvider();
router.get('/diagnostics', createDiagnosticsHandler(diagnostics, { isAuthorized: isOperator }));
```

---

## Security & Cardinality Defense

1. **Log Injection Prevention**: Escapes control characters (`\r`, `\n`, `\t`, `\b`, `\f`) in log messages and context strings to ensure line-based log aggregators are not manipulated.
2. **Cardinality Limiting**: Hard-capped label permutations per metric (default 1000). Unbounded inputs (e.g. query strings, email addresses, UUIDs) are rejected or dropped once the threshold is exceeded.
3. **Redaction Engine**: Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`) and object keys are masked before writing to log streams or diagnostic payloads.
4. **Health Response Protection**: Public health endpoints only report status (`healthy`, `degraded`, `unhealthy`); verbose internal error details require authorized diagnostics mode.
