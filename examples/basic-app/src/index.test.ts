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

  it('should eager-load user relations via ORM', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/users/1/posts',
      headers: { host: 'localhost:3000' },
    });

    const res = await app.handle(req);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body as string);
    expect(data.id).toBe(1);
    expect(data.posts).toBeDefined();
    expect(data.posts.length).toBe(2);
    expect(data.posts[0].title).toBe('First Post by Alice');
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

  it('should inspect and run migrations via API endpoints', async () => {
    // 1. Initial status shows 1 pending migration
    const statusReq = new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/migrations/status',
      headers: { host: 'localhost:3000' },
    });
    const statusRes = await app.handle(statusReq);
    expect(statusRes.statusCode).toBe(200);
    const statusData = JSON.parse(statusRes.body as string);
    expect(statusData.pendingCount).toBe(1);
    expect(statusData.isUpToDate).toBe(false);

    // 2. Run migrations
    const runReq = new HttpRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/migrations/run',
      headers: { host: 'localhost:3000' },
    });
    const runRes = await app.handle(runReq);
    expect(runRes.statusCode).toBe(200);
    const runData = JSON.parse(runRes.body as string);
    expect(runData.applied).toEqual(['20260924000000_init_schema']);
    expect(runData.batch).toBe(1);

    // 3. Post-run status shows up to date
    const updatedStatusRes = await app.handle(statusReq);
    const updatedData = JSON.parse(updatedStatusRes.body as string);
    expect(updatedData.appliedCount).toBe(1);
    expect(updatedData.pendingCount).toBe(0);
    expect(updatedData.isUpToDate).toBe(true);
  });

  it('should inspect routes and models via CLI application', async () => {
    const { CliApplication, CliOutput, CommandContext } = await import('@django-js/cli');
    const cliApp = CliApplication.createDefault();
    const routeCmd = cliApp.registry.resolve('route:list')!;

    let outputData = '';
    const output = new CliOutput({
      color: false,
      stdout: {
        write: (str: string) => {
          outputData += str;
        },
      },
    });

    const ctx = new CommandContext({ application: app, output });
    const exitCode = await routeCmd.execute(ctx);
    expect(exitCode).toBe(0);
    expect(outputData).toContain('/api/v1/users/:id<number>');
    expect(outputData).toContain('/audit-event');
  });
});
