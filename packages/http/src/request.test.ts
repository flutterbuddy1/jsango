import { describe, it, expect } from 'vitest';
import { HttpRequest } from './public/request.js';

describe('HttpRequest', () => {
  it('should initialize request with URL, method, query, and headers', () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'https://api.example.com/v1/users?active=true',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-1234',
        cookie: 'session=token_abc',
      },
      params: { id: '99' },
    });

    expect(req.method).toBe('POST');
    expect(req.url.origin).toBe('https://api.example.com');
    expect(req.pathname).toBe('/v1/users');
    expect(req.query.get('active')).toBe('true');
    expect(req.contentType).toBe('application/json');
    expect(req.requestId).toBe('req-1234');
    expect(req.cookies['session']).toBe('token_abc');
    expect(req.params['id']).toBe('99');
  });

  it('should auto-generate requestId if not provided', () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/ping',
    });

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
  });

  it('should parse content-length correctly', () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'http://localhost/upload',
      headers: { 'content-length': '1024' },
    });

    expect(req.contentLength).toBe(1024);
  });

  it('should handle body proxy methods', async () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'http://localhost/api',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ping: 'pong' }),
    });

    const parsed = await req.json<{ ping: string }>();
    expect(parsed.ping).toBe('pong');
  });
});
