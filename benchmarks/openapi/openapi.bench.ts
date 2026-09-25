import { describe, bench } from 'vitest';
import { Router } from '../../packages/router/src/index.js';
import {
  OpenApiGenerator,
  OpenApiValidator,
  OpenApiFormatter,
  SchemaBuilder,
  ValidationAdapter,
} from '../../packages/openapi/src/index.js';

describe('OpenAPI Benchmarks', () => {
  const router = new Router();
  const testDescriptor = {
    type: 'object',
    properties: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      age: { type: 'integer', minimum: 0 },
      tags: { type: 'array', items: { type: 'string' } },
      isActive: { type: 'boolean' },
    },
  };

  for (let i = 0; i < 50; i++) {
    router.get(`/api/items/${i}`, () => {}, {
      metadata: {
        openapi: {
          summary: `Get item ${i}`,
          tags: ['Items'],
          operationId: `getItem${i}`,
          responses: {
            200: {
              description: 'Successful item retrieval',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Item' },
                },
              },
            },
          },
        },
      },
    });
  }

  const generator = new OpenApiGenerator({
    info: { title: 'Benchmark API', version: '1.0.0' },
  });
  generator.getRegistry().registerSchema(
    'Item',
    SchemaBuilder.object({
      id: SchemaBuilder.string(),
      name: SchemaBuilder.string(),
      age: SchemaBuilder.number(),
    })
  );

  const doc = generator.generate(router);

  describe('SchemaBuilder', () => {
    bench('build object schema', () => {
      SchemaBuilder.object(
        {
          id: SchemaBuilder.string(),
          count: SchemaBuilder.integer(),
          active: SchemaBuilder.boolean(),
        },
        ['id', 'count']
      );
    });

    bench('build pagination schema', () => {
      SchemaBuilder.paginatedResponse(SchemaBuilder.string());
    });
  });

  describe('ValidationAdapter', () => {
    bench('convert validation schema to OpenAPI schema', () => {
      ValidationAdapter.toOpenApiSchema(testDescriptor);
    });
  });

  describe('OpenApiGenerator', () => {
    bench('generate 50-route document', () => {
      generator.generate(router);
    });
  });

  describe('OpenApiValidator', () => {
    bench('validate document', () => {
      OpenApiValidator.validate(doc);
    });
  });

  describe('OpenApiFormatter', () => {
    bench('format to JSON', () => {
      OpenApiFormatter.toJson(doc);
    });

    bench('format to YAML', () => {
      OpenApiFormatter.toYaml(doc);
    });
  });
});
