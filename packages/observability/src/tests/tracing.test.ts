import { describe, it, expect } from 'vitest';
import { Tracer } from '../public/tracing.js';

describe('Tracing Subsystem', () => {
  it('creates and finishes spans with monotonic durations', () => {
    const tracer = new Tracer();
    const span = tracer.startSpan('test_operation');

    expect(span.name).toBe('test_operation');
    expect(span.context.traceId).toHaveLength(32);
    expect(span.context.spanId).toHaveLength(16);
    expect(span.context.sampled).toBe(true);

    span.setAttribute('user.id', '42');
    span.addEvent('data_fetched', { rows: 10 });
    span.setStatus('ok');
    span.end();

    expect(span.durationMs).toBeGreaterThanOrEqual(0);
    expect(span.attributes['user.id']).toBe('42');
    expect(span.events).toHaveLength(1);
    expect(span.events[0]!.name).toBe('data_fetched');
    expect(span.status.code).toBe('ok');
  });

  it('maintains parent-child span hierarchy and propagates traceId', () => {
    const tracer = new Tracer();
    const parentSpan = tracer.startSpan('parent_operation');
    const childSpan = tracer.startSpan('child_operation', { parent: parentSpan });

    expect(childSpan.context.traceId).toBe(parentSpan.context.traceId);
    expect(childSpan.context.parentSpanId).toBe(parentSpan.context.spanId);
    expect(childSpan.context.spanId).not.toBe(parentSpan.context.spanId);

    childSpan.end();
    parentSpan.end();
  });

  it('runs async operations with withSpan() and records exceptions automatically', async () => {
    const tracer = new Tracer();

    let capturedSpan: import('../public/types.js').ISpan | null = null;
    await expect(
      tracer.withSpan('failing_op', (span) => {
        capturedSpan = span;
        throw new Error('Database deadlock');
      })
    ).rejects.toThrow('Database deadlock');

    expect(capturedSpan).toBeDefined();
    expect(capturedSpan!.status.code).toBe('error');
    expect(capturedSpan!.status.description).toBe('Database deadlock');
    expect(capturedSpan!.events.some((e) => e.name === 'exception')).toBe(true);
    expect(capturedSpan!.durationMs).toBeGreaterThanOrEqual(0);
  });
});
