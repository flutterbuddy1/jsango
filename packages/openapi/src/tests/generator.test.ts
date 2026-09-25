import { describe, it, expect, beforeEach } from 'vitest';
import { Router } from '@jsango/router';
import { HttpResponse } from '@jsango/http';
import { OpenApiGenerator } from '../public/generator.js';
import { OpenApiRegistry } from '../public/registry.js';
import { SchemaBuilder } from '../public/schema-builder.js';
import { DuplicateOperationIdError } from '../public/errors.js';

describe('OpenApiGenerator', () => {
  let router: Router;
  let registry: OpenApiRegistry;
  let generator: OpenApiGenerator;

  beforeEach(() => {
    router = new Router();
    registry = new OpenApiRegistry();
    generator = new OpenApiGenerator({
      info: { title: 'Test API', version: '1.0.0', description: 'Test API description' },
      registry,
    });
  });

  it('generates a valid empty OpenAPI document when router has no routes', () => {
    const doc = generator.generate(router);

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Test API');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.paths).toEqual({});
  });

  it('derives paths and methods from registered routes', () => {
    router.get('/users', () => HttpResponse.json([]));
    router.post('/users', () => HttpResponse.json({}, { status: 201 }));
    router.get('/users/:id<number>', () => HttpResponse.json({}));

    const doc = generator.generate(router);

    expect(doc.paths['/users']).toBeDefined();
    expect(doc.paths['/users']!.get).toBeDefined();
    expect(doc.paths['/users']!.post).toBeDefined();
    expect(doc.paths['/users/{id}']).toBeDefined();
    expect(doc.paths['/users/{id}']!.get).toBeDefined();

    // Check path parameter
    const params = doc.paths['/users/{id}']!.get!.parameters;
    expect(params).toHaveLength(1);
    expect(params![0]!.name).toBe('id');
    expect(params![0]!.in).toBe('path');
    expect(params![0]!.required).toBe(true);
    expect(params![0]!.schema?.type).toBe('integer');
  });

  it('respects route metadata for operationId, summary, description, and tags', () => {
    router.get('/products', () => HttpResponse.json([]), {
      metadata: {
        openapi: {
          operationId: 'listProducts',
          summary: 'List all products',
          description: 'Returns all available products in store',
          tags: ['Products'],
          responses: {
            '200': {
              description: 'Product list',
              content: {
                'application/json': {
                  schema: SchemaBuilder.array(SchemaBuilder.object({ id: SchemaBuilder.string() })),
                },
              },
            },
          },
        },
      },
    });

    const doc = generator.generate(router);
    const op = doc.paths['/products']!.get!;

    expect(op.operationId).toBe('listProducts');
    expect(op.summary).toBe('List all products');
    expect(op.description).toBe('Returns all available products in store');
    expect(op.tags).toEqual(['Products']);
    expect(op.responses['200']!.description).toBe('Product list');
  });

  it('detects duplicate operation IDs across different routes', () => {
    router.get('/a', () => HttpResponse.empty(), {
      metadata: { openapi: { operationId: 'duplicateOp' } },
    });
    router.get('/b', () => HttpResponse.empty(), {
      metadata: { openapi: { operationId: 'duplicateOp' } },
    });

    expect(() => generator.generate(router)).toThrow(DuplicateOperationIdError);
  });

  it('skips routes marked with hidden or excludeFromOpenApi', () => {
    router.get('/public', () => HttpResponse.empty());
    router.get('/internal-secret', () => HttpResponse.empty(), {
      metadata: { openapi: { hidden: true } },
    });
    router.get('/private-debug', () => HttpResponse.empty(), {
      metadata: { openapi: { excludeFromOpenApi: true } },
    });

    const doc = generator.generate(router);

    expect(doc.paths['/public']).toBeDefined();
    expect(doc.paths['/internal-secret']).toBeUndefined();
    expect(doc.paths['/private-debug']).toBeUndefined();
  });

  it('excludes admin routes by default unless includeAdmin is true', () => {
    router.get('/api/v1/posts', () => HttpResponse.empty());
    router.get('/admin/api/v1/posts', () => HttpResponse.empty());

    const defaultDoc = generator.generate(router);
    expect(defaultDoc.paths['/api/v1/posts']).toBeDefined();
    expect(defaultDoc.paths['/admin/api/v1/posts']).toBeUndefined();

    const adminGenerator = new OpenApiGenerator({
      info: { title: 'Admin API', version: '1.0.0' },
      includeAdmin: true,
    });
    const adminDoc = adminGenerator.generate(router);
    expect(adminDoc.paths['/admin/api/v1/posts']).toBeDefined();
  });

  it('applies registry route overrides correctly', () => {
    router.get('/overridden', () => HttpResponse.empty());

    registry.registerRouteOverride('GET', '/overridden', {
      summary: 'Explicit Override Summary',
      tags: ['OverriddenTag'],
    });

    const doc = generator.generate(router);
    const op = doc.paths['/overridden']!.get!;

    expect(op.summary).toBe('Explicit Override Summary');
    expect(op.tags).toEqual(['OverriddenTag']);
  });

  it('generates deterministic output with sorted paths and tags', () => {
    router.get('/zebra', () => HttpResponse.empty());
    router.get('/apple', () => HttpResponse.empty());
    router.get('/banana', () => HttpResponse.empty());

    registry.registerTag({ name: 'ZebraTag' });
    registry.registerTag({ name: 'AppleTag' });

    const doc = generator.generate(router);

    expect(Object.keys(doc.paths)).toEqual(['/apple', '/banana', '/zebra']);
    expect(doc.tags?.map((t) => t.name)).toEqual(['AppleTag', 'ZebraTag']);
  });
});
