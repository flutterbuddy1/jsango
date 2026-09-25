import { describe, it, expect } from 'vitest';
import { Router } from '@jsango/router';
import { HttpRequest, RequestContext, HttpResponse } from '@jsango/http';
import { OpenApiGenerator } from '../public/generator.js';
import { createOpenApiHandler } from '../public/endpoint.js';

describe('OpenAPI Endpoint Handler', () => {
  it('serves OpenAPI specification as JSON', async () => {
    const router = new Router();
    router.get('/items', () => HttpResponse.json([]));

    const generator = new OpenApiGenerator({
      info: { title: 'Item API', version: '2.0.0' },
    });

    const handler = createOpenApiHandler(generator, { router });

    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/openapi.json',
    });
    const ctx = new RequestContext({ request: req });

    const response = (await handler(ctx)) as HttpResponse;
    expect(response.statusCode).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = JSON.parse(response.body as string);
    expect(body.info.title).toBe('Item API');
    expect(body.paths['/items']).toBeDefined();
  });

  it('serves OpenAPI specification as YAML when requested via query param', async () => {
    const router = new Router();
    router.get('/health', () => HttpResponse.empty());

    const generator = new OpenApiGenerator({
      info: { title: 'Health API', version: '1.0.0' },
    });

    const handler = createOpenApiHandler(generator, { router });

    const req = new HttpRequest({
      method: 'GET',
      url: 'http://localhost/openapi?format=yaml',
    });
    const ctx = new RequestContext({ request: req });

    const response = (await handler(ctx)) as HttpResponse;
    expect(response.statusCode).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/yaml');
    expect(typeof response.body).toBe('string');
    expect(response.body as string).toContain('openapi: 3.1.0');
    expect(response.body as string).toContain('title: Health API');
  });
});
