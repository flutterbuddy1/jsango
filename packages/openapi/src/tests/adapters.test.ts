import { describe, it, expect } from 'vitest';
import { ValidationAdapter } from '../public/validation-adapter.js';
import { OrmAdapter } from '../public/orm-adapter.js';
import { AdminAdapter } from '../public/admin-adapter.js';

describe('OpenAPI Adapters', () => {
  describe('ValidationAdapter', () => {
    it('converts validation object schema to OpenApiSchema', () => {
      const descriptor = {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50, required: true },
          age: { type: 'integer', minimum: 18 },
          role: { type: 'string', enum: ['user', 'admin'] },
        },
      };

      const schema = ValidationAdapter.toOpenApiSchema(descriptor);

      expect(schema.type).toBe('object');
      expect(schema.properties?.['username']?.type).toBe('string');
      expect(schema.properties?.['username']?.minLength).toBe(3);
      expect(schema.properties?.['age']?.type).toBe('integer');
      expect(schema.properties?.['role']?.enum).toEqual(['user', 'admin']);
      expect(schema.required).toContain('username');
    });

    it('converts array validation descriptors with items', () => {
      const descriptor = {
        type: 'array',
        items: { type: 'string', format: 'email' },
      };

      const schema = ValidationAdapter.toOpenApiSchema(descriptor);
      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.items?.format).toBe('email');
    });
  });

  describe('OrmAdapter', () => {
    const userModel = {
      name: 'User',
      tableName: 'users',
      primaryKey: 'id',
      fields: [
        { name: 'id', type: 'uuid', primaryKey: true, nullable: false },
        { name: 'name', type: 'string', nullable: false },
        { name: 'email', type: 'email', nullable: false },
        { name: 'age', type: 'integer', nullable: true },
      ],
    };

    it('generates a model representation schema', () => {
      const schema = OrmAdapter.toModelSchema(userModel);

      expect(schema.title).toBe('User');
      expect(schema.type).toBe('object');
      expect(schema.properties?.['id']?.format).toBe('uuid');
      expect(schema.properties?.['email']?.format).toBe('email');
      expect(schema.properties?.['age']?.nullable).toBe(true);
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
      expect(schema.required).not.toContain('age');
    });

    it('generates a create input schema omitting autoIncrement primary keys', () => {
      const autoIncModel = {
        name: 'Article',
        fields: [
          { name: 'id', type: 'number', primaryKey: true, autoIncrement: true, nullable: false },
          { name: 'title', type: 'string', nullable: false },
        ],
      };

      const inputSchema = OrmAdapter.toCreateInputSchema(autoIncModel);
      expect(inputSchema.title).toBe('CreateArticleInput');
      expect(inputSchema.properties?.['id']).toBeUndefined();
      expect(inputSchema.properties?.['title']).toBeDefined();
    });
  });

  describe('AdminAdapter', () => {
    it('generates admin CRUD paths with Admin: <Label> tags', () => {
      const resource = {
        id: 'posts',
        label: 'Post',
        pluralLabel: 'Posts',
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'title', type: 'text' },
        ],
      };

      const paths = AdminAdapter.generateResourcePaths(resource);

      expect(paths['/admin/api/v1/resources/posts']).toBeDefined();
      expect(paths['/admin/api/v1/resources/posts']!.get?.tags).toContain('Admin: Posts');
      expect(paths['/admin/api/v1/resources/posts/{id}']).toBeDefined();
      expect(paths['/admin/api/v1/resources/posts/{id}']!.patch?.summary).toBe('Update Post');
    });
  });
});
