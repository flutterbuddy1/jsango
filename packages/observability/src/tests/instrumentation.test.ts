import { describe, it, expect } from 'vitest';
import { HttpRequest, HttpResponse, RequestContext } from '@jsango/http';
import { MetricRegistry } from '../public/metrics.js';
import { Tracer } from '../public/tracing.js';
import { StructuredLogger } from '../public/logger.js';
import {
  createHttpInstrumentationMiddleware,
  FrameworkInstrumentation,
} from '../public/instrumentation.js';

describe('Instrumentation', () => {
  it('instruments HTTP requests, increments metrics, and adds correlation headers', async () => {
    const metrics = new MetricRegistry();
    const tracer = new Tracer();
    const logEntries: import('../public/types.js').StructuredLogEntry[] = [];
    const logger = new StructuredLogger({ sink: (e) => logEntries.push(e) });

    const middleware = createHttpInstrumentationMiddleware({
      metrics,
      tracer,
      logger,
    });

    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/api/v1/users',
      headers: { 'x-request-id': 'custom-req-id-123' },
    });
    const ctx = new RequestContext({ request: req });

    await middleware(ctx, async () => {
      ctx.response = HttpResponse.json({ ok: true });
    });

    expect(ctx.response.headers.get('x-request-id')).toBe('custom-req-id-123');
    expect(ctx.response.headers.get('traceparent')).toBeDefined();

    const snapshot = metrics.snapshot();
    const requestsTotal = snapshot.find((s) => s.name === 'http_requests_total');
    expect(requestsTotal).toBeDefined();
    expect(requestsTotal!.values).toHaveLength(1);
    expect(requestsTotal!.values[0]!.labels).toEqual({ method: 'GET', status: '200' });
    expect(requestsTotal!.values[0]!.value).toBe(1);

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].requestId).toBe('custom-req-id-123');
  });

  it('provides framework database, cache, and queue hooks', async () => {
    const metrics = new MetricRegistry();
    const tracer = new Tracer();

    const dbHook = FrameworkInstrumentation.createDatabaseHook(metrics, tracer);
    const dbResult = await dbHook('SELECT', async () => [{ id: 1 }]);
    expect(dbResult).toEqual([{ id: 1 }]);

    const cacheHook = FrameworkInstrumentation.createCacheHook(metrics);
    cacheHook.recordHit('get');
    cacheHook.recordMiss('get');

    const queueHook = FrameworkInstrumentation.createQueueHook(metrics, tracer);
    const jobResult = await queueHook('SendEmailJob', async () => 'sent');
    expect(jobResult).toBe('sent');

    const snapshot = metrics.snapshot();
    expect(snapshot.find((s) => s.name === 'db_queries_total')?.values[0]?.value).toBe(1);
    expect(snapshot.find((s) => s.name === 'cache_hits_total')?.values[0]?.value).toBe(1);
    expect(snapshot.find((s) => s.name === 'queue_jobs_total')?.values[0]?.value).toBe(1);
  });
});
