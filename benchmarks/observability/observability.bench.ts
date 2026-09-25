import { describe, bench } from 'vitest';
import {
  MetricRegistry,
  Tracer,
  StructuredLogger,
  Redactor,
  CorrelationManager,
} from '../../packages/observability/src/index.js';

describe('Observability Benchmarks', () => {
  const metricRegistry = new MetricRegistry();
  const counter = metricRegistry.counter('http.requests.total', 'Total HTTP requests', [
    'method',
    'status',
  ]);
  const gauge = metricRegistry.gauge('system.memory.usage', 'System memory usage');
  const histogram = metricRegistry.histogram(
    'http.request.duration',
    'HTTP request duration ms',
    undefined,
    ['route']
  );

  const tracer = new Tracer({ serviceName: 'benchmark-service' });
  const redactor = new Redactor();
  const logger = new StructuredLogger({
    name: 'bench-logger',
    minLevel: 'info',
    redactor,
  });

  const rawObject = {
    userId: 'usr_123',
    email: 'test@example.com',
    password: 'superSecretPassword123!',
    token: 'jwt.token.here',
    nested: {
      secretKey: 'top-secret',
      count: 42,
    },
  };

  describe('Metrics', () => {
    bench('increment counter with labels', () => {
      counter.inc({ method: 'GET', status: '200' });
    });

    bench('set gauge value', () => {
      gauge.set(1024 * 1024 * 50);
    });

    bench('observe histogram with labels', () => {
      histogram.observe(14.5, { route: '/api/v1/users' });
    });

    bench('snapshot metric registry', () => {
      metricRegistry.snapshot();
    });
  });

  describe('Tracing', () => {
    bench('start and end span', () => {
      const span = tracer.startSpan('http.request');
      span.setAttribute('http.method', 'GET');
      span.setAttribute('http.status_code', 200);
      span.end();
    });

    bench('traced execution block', async () => {
      await tracer.trace('db.query', async (span) => {
        span.setAttribute('db.statement', 'SELECT 1');
        return 1;
      });
    });
  });

  describe('Redaction and Correlation', () => {
    bench('redact sensitive object', () => {
      redactor.redact(rawObject);
    });

    bench('generate and validate request ID', () => {
      const reqId = CorrelationManager.generateRequestId();
      CorrelationManager.sanitizeRequestId(reqId);
    });

    bench('parse W3C traceparent', () => {
      CorrelationManager.parseTraceparent(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      );
    });
  });

  describe('Structured Logging', () => {
    bench('log info message with context', () => {
      logger.info('User request completed', {
        requestId: 'req_123',
        userId: 'usr_456',
        durationMs: 12.34,
      });
    });
  });
});
