# @jsango/observability

> Structured logging, bounded Prometheus-style metrics, monotonic distributed tracing, and health check registries.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/observability
```

## Usage

```typescript
import { MetricRegistry, StructuredLogger, Tracer, HealthRegistry } from '@jsango/observability';

const logger = new StructuredLogger({ minLevel: 'info', context: { service: 'api' } });
logger.info('server started', { port: 3000, password: 'hidden' }); // sensitive keys are redacted

const metrics = new MetricRegistry();
const requests = metrics.counter('http_requests_total', 'Total HTTP requests', [
  'method',
  'status',
]);
requests.inc(1, { method: 'GET', status: '200' });
console.log(metrics.toPrometheus());

const tracer = new Tracer();
const span = tracer.startSpan('db.query');
span.setAttribute('db.table', 'users');
span.end();

const health = new HealthRegistry();
health.register('database', async () => true, { timeoutMs: 2000, critical: true });
const overall = await health.checkAll();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
