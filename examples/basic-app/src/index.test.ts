import { describe, it, expect, afterAll } from 'vitest';
import { createApplication } from './index.js';
import { HttpRequest } from '@django-js/http';

describe('Basic App Example with Database', () => {
  const { app, db } = createApplication();

  afterAll(async () => {
    await db.close();
  });

  it('should serve root route with timing and request ID headers', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/',
      headers: { host: 'localhost:3000' },
    });

    const res = await app.handle(req);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('Welcome to Nexora!');
    expect(res.headers.get('x-response-time')).toBeDefined();
    expect(res.headers.get('x-request-id')).toBe('req-1');
  });

  it('should query database from route handler', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/users/1',
      headers: { host: 'localhost:3000' },
    });

    const res = await app.handle(req);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string);
    expect(data.id).toBe(1);
    expect(data.name).toBe('Alice Smith');
    expect(data.email).toBe('alice@example.com');
  });

  it('should execute database transactions from route handler', async () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/audit-event',
      headers: { host: 'localhost:3000' },
    });

    const res = await app.handle(req);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string);
    expect(data.status).toBe('recorded');
  });

  it('should enforce api key middleware on secured route', async () => {
    const unauthReq = new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/secure-data',
      headers: { host: 'localhost:3000' },
    });
    const unauthRes = await app.handle(unauthReq);
    expect(JSON.parse(unauthRes.body as string)).toEqual({ error: 'Invalid API key' });

    const authReq = new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/secure-data',
      headers: { host: 'localhost:3000', 'x-api-key': 'secret-key-123' },
    });
    const authRes = await app.handle(authReq);
    expect(JSON.parse(authRes.body as string)).toEqual({ secretPayload: 'CLASSIFIED' });
  });
});
