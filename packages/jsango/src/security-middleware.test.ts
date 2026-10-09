import { describe, it, expect } from 'vitest';
import { createApp, cors, securityHeaders, rateLimit, HttpRequest } from './index.js';

const req = (method: string, headers: Record<string, string> = {}) =>
  new HttpRequest({ method: method as 'GET', url: 'http://localhost/api', headers });

describe('cors / securityHeaders / rateLimit', () => {
  it('answers preflight and only allows listed origins', async () => {
    const app = createApp();
    app.use(cors({ origin: ['https://app.example.com'], credentials: true }));
    app.post('/api', () => ({ ok: true }));

    const pre = await app.handle(
      req('OPTIONS', {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      })
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(pre.headers.get('access-control-allow-credentials')).toBe('true');

    const evil = await app.handle(req('POST', { origin: 'https://evil.example' }));
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    expect(() => cors({ origin: '*', credentials: true })).toThrow();
  });

  it('adds safe headers and limits requests', async () => {
    const app = createApp();
    app.use(securityHeaders());
    app.get('/api', rateLimit({ max: 2, key: () => 'client' }), () => ({ ok: true }));
    const first = await app.handle(req('GET'));
    expect(first.headers.get('x-content-type-options')).toBe('nosniff');
    expect(first.headers.get('x-frame-options')).toBe('DENY');
    await app.handle(req('GET'));
    const third = await app.handle(req('GET'));
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBe('60');
  });
});
