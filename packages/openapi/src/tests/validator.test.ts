import { describe, it, expect } from 'vitest';
import { OpenApiValidator } from '../public/validator.js';
import { InvalidOpenApiDocumentError } from '../public/errors.js';
import type { OpenApiDocument } from '../public/types.js';

describe('OpenApiValidator', () => {
  it('validates a correct document without errors', () => {
    const doc: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Valid API', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            summary: 'Get user',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Success' } },
          },
        },
      },
    };

    const errors = OpenApiValidator.validate(doc);
    expect(errors).toHaveLength(0);
    expect(() => OpenApiValidator.assertValid(doc)).not.toThrow();
  });

  it('detects missing top-level fields', () => {
    const doc = {
      openapi: '',
      info: { title: '', version: '' },
      paths: {},
    } as unknown as OpenApiDocument;

    const errors = OpenApiValidator.validate(doc);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('detects paths not starting with a forward slash', () => {
    const doc: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        'invalid/path': {
          get: {
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    const errors = OpenApiValidator.validate(doc);
    expect(errors.some((e) => e.includes('must start with a forward slash'))).toBe(true);
  });

  it('detects missing required path parameters', () => {
    const doc: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/items/{itemId}': {
          get: {
            // Missing {itemId} parameter definition!
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };

    const errors = OpenApiValidator.validate(doc);
    expect(errors.some((e) => e.includes('does not define a matching path parameter'))).toBe(true);
  });

  it('detects unresolved component schema $ref references', () => {
    const doc: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/NonExistentModel' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          ExistingModel: { type: 'object' },
        },
      },
    };

    const errors = OpenApiValidator.validate(doc);
    expect(errors.some((e) => e.includes('Unresolved component schema reference'))).toBe(true);
    expect(() => OpenApiValidator.assertValid(doc)).toThrow(InvalidOpenApiDocumentError);
  });
});
