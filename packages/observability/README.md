# @django-js/observability

> Structured logging, bounded Prometheus-style metrics, monotonic distributed tracing, and health check registries.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/observability
```

## Usage

```typescript
import { MetricRegistry, StructuredLogger, Tracer, HealthRegistry } from '@django-js/observability';

const metrics = new MetricRegistry();
const counter = metrics.counter('http_requests_total', 'Total HTTP requests');
counter.inc({ method: 'GET', status: '200' });
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
