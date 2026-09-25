import { describe, it, expect } from 'vitest';
import { DiagnosticsProvider, createDiagnosticsHandler } from '../public/diagnostics.js';
import { HttpRequest, RequestContext, HttpResponse } from '@jsango/http';

describe('Diagnostics Subsystem', () => {
  it('collects runtime information, memory, and component statuses', async () => {
    const provider = new DiagnosticsProvider();
    provider.registerComponent('database', () => ({
      status: 'ready',
      details: { activeConnections: 5 },
    }));

    const info = await provider.getDiagnostics();

    expect(info.runtime.name).toBeDefined();
    expect(info.memory.heapUsedMb).toBeGreaterThan(0);
    expect(info.components['database']?.status).toBe('ready');
    expect(info.components['database']?.details?.['activeConnections']).toBe(5);
  });

  describe('createDiagnosticsHandler', () => {
    it('rejects unauthorized requests with 403 Forbidden', async () => {
      const provider = new DiagnosticsProvider();
      const handler = createDiagnosticsHandler(provider, { isAuthorized: () => false });

      const req = new HttpRequest({ method: 'GET', url: 'http://localhost/diagnostics' });
      const ctx = new RequestContext({ request: req });

      const response = (await handler(ctx)) as HttpResponse;
      expect(response.statusCode).toBe(403);
    });

    it('returns diagnostic payload for authorized requests', async () => {
      const provider = new DiagnosticsProvider();
      const handler = createDiagnosticsHandler(provider, { isAuthorized: () => true });

      const req = new HttpRequest({ method: 'GET', url: 'http://localhost/diagnostics' });
      const ctx = new RequestContext({ request: req });

      const response = (await handler(ctx)) as HttpResponse;
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body as string);
      expect(body.runtime).toBeDefined();
      expect(body.memory).toBeDefined();
    });
  });
});
