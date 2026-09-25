import { describe, it, expect } from 'vitest';
import { MetricRegistry, Counter, Gauge, Histogram } from '../public/metrics.js';

describe('Metrics Subsystem', () => {
  describe('Counter', () => {
    it('increments monotonically and supports labels', () => {
      const counter = new Counter({ name: 'http_requests', type: 'counter', description: 'desc' });

      counter.inc();
      counter.inc(2);
      counter.inc(1, { method: 'GET', status: 200 });
      counter.inc(1, { method: 'POST', status: 201 });

      expect(counter.get()).toBe(3);
      expect(counter.get({ method: 'GET', status: 200 })).toBe(1);
      expect(counter.get({ method: 'POST', status: 201 })).toBe(1);
    });

    it('rejects negative increments', () => {
      const counter = new Counter({ name: 'test_counter', type: 'counter', description: 'desc' });
      expect(() => counter.inc(-1)).toThrow(/cannot be incremented by a negative value/);
    });
  });

  describe('Gauge', () => {
    it('supports set, inc, and dec with labels', () => {
      const gauge = new Gauge({ name: 'active_connections', type: 'gauge', description: 'desc' });

      gauge.set(10);
      expect(gauge.get()).toBe(10);

      gauge.inc(5);
      expect(gauge.get()).toBe(15);

      gauge.dec(3);
      expect(gauge.get()).toBe(12);

      gauge.set(5, { pool: 'read' });
      expect(gauge.get({ pool: 'read' })).toBe(5);
    });
  });

  describe('Histogram', () => {
    it('records observations into configured latency buckets', () => {
      const hist = new Histogram({
        name: 'req_duration',
        type: 'histogram',
        description: 'desc',
        buckets: [0.1, 0.5, 1.0],
      });

      hist.observe(0.05); // <= 0.1, <= 0.5, <= 1.0
      hist.observe(0.3); // <= 0.5, <= 1.0
      hist.observe(0.8); // <= 1.0
      hist.observe(2.0); // > 1.0

      const val = hist.get()!;
      expect(val.count).toBe(4);
      expect(val.sum).toBeCloseTo(3.15, 2);
      expect(val.min).toBeCloseTo(0.05, 2);
      expect(val.max).toBeCloseTo(2.0, 2);

      expect(val.buckets[0]!.count).toBe(1); // <= 0.1
      expect(val.buckets[1]!.count).toBe(2); // <= 0.5
      expect(val.buckets[2]!.count).toBe(3); // <= 1.0
    });
  });

  describe('MetricRegistry', () => {
    it('registers and retrieves metrics and creates snapshots', () => {
      const registry = new MetricRegistry();

      const reqCounter = registry.counter('requests_total', 'Total requests');
      const connGauge = registry.gauge('active_conns', 'Active connections');
      const hist = registry.histogram('duration_sec', 'Duration', [0.1, 1.0]);

      reqCounter.inc(5, { path: '/home' });
      connGauge.set(42);
      hist.observe(0.05);

      const snapshot = registry.snapshot();
      expect(snapshot).toHaveLength(3);

      const names = snapshot.map((s) => s.name);
      expect(names).toContain('requests_total');
      expect(names).toContain('active_conns');
      expect(names).toContain('duration_sec');
    });

    it('throws error when registering conflicting metric types under the same name', () => {
      const registry = new MetricRegistry();
      registry.counter('conflicting_name', 'First registration');

      expect(() => registry.gauge('conflicting_name', 'Second registration')).toThrow(
        /is already registered as a counter/
      );
    });
  });
});
