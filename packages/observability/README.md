# @jsango/observability

> Structured logging, bounded Prometheus-style metrics, monotonic distributed tracing, and health check registries.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/observability
```

## Usage

```typescript
import { MetricRegistry, StructuredLogger, Tracer, HealthRegistry } from '@jsango/observability';

const metrics = new MetricRegistry();
const counter = metrics.counter('http_requests_total', 'Total HTTP requests');
counter.inc({ method: 'GET', status: '200' });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
