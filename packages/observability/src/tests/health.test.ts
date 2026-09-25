import { describe, it, expect } from 'vitest';
import { HealthRegistry, createHealthHandler } from '../public/health.js';
import { HttpRequest, RequestContext, HttpResponse } from '@jsango/http';

describe('Health Subsystem', () => {
  it('aggregates healthy status when all checks pass', async () => {
    const registry = new HealthRegistry();
    registry.register('db', () => true);
    registry.register('cache', () => ({ status: 'healthy', durationMs: 2 }));

    const overall = await registry.checkAll();
    expect(overall.status).toBe('healthy');
    expect(overall.checks['db']?.status).toBe('healthy');
    expect(overall.checks['cache']?.status).toBe('healthy');
  });

  it('marks overall as degraded when non-critical check fails', async () => {
    const registry = new HealthRegistry();
    registry.register('db', () => true, { critical: true });
    registry.register('analytics', () => false, { critical: false });

    const overall = await registry.checkAll();
    expect(overall.status).toBe('degraded');
  });

  it('marks overall as unhealthy when critical check fails', async () => {
    const registry = new HealthRegistry();
    registry.register('db', () => false, { critical: true });
    registry.register('cache', () => true);

    const overall = await registry.checkAll();
    expect(overall.status).toBe('unhealthy');
  });

  it('handles timeout when check exceeds timeoutMs', async () => {
    const registry = new HealthRegistry();
    registry.register('slow_service', () => new Promise((resolve) => setTimeout(resolve, 500)), {
      timeoutMs: 20,
    });

    const result = await registry.check('slow_service');
    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('timed out');
  });

  describe('createHealthHandler', () => {
    it('returns minimal status for unauthenticated public requests', async () => {
      const registry = new HealthRegistry();
      registry.register('db', () => ({
        status: 'healthy',
        durationMs: 1,
        details: { host: 'internal-db.prod' },
      }));

      const handler = createHealthHandler(registry, { isAuthorized: () => false });

      const req = new HttpRequest({ method: 'GET', url: 'http://localhost/health' });
      const ctx = new RequestContext({ request: req });

      const response = (await handler(ctx)) as HttpResponse;
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body as string);
      expect(body.status).toBe('healthy');
      expect(body.checks).toBeUndefined(); // internal details masked!
    });

    it('returns full diagnostic details for authorized requests', async () => {
      const registry = new HealthRegistry();
      registry.register('db', () => ({
        status: 'healthy',
        durationMs: 1,
        details: { host: 'internal-db.prod' },
      }));

      const handler = createHealthHandler(registry, { isAuthorized: () => true });

      const req = new HttpRequest({ method: 'GET', url: 'http://localhost/health' });
      const ctx = new RequestContext({ request: req });

      const response = (await handler(ctx)) as HttpResponse;
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body as string);
      expect(body.status).toBe('healthy');
      expect(body.checks).toBeDefined();
      expect(body.checks.db.details.host).toBe('internal-db.prod');
    });
  });
});
