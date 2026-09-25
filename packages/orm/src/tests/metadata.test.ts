import { describe, it, expect } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { relations } from '../public/relations.js';
import { ModelMetadata } from '../public/metadata.js';

describe('ModelMetadata & FieldMetadata', () => {
  it('should construct complete, immutable model metadata', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        title: fields.string({ length: 255 }),
        content: fields.text({ nullable: true }),
        published: fields.boolean({ default: false }),
        viewCount: fields.integer({ default: 0, columnName: 'view_count' }),
        createdAt: fields.dateTime({ nullable: true, columnName: 'created_at' }),
      },
      indexes: [{ name: 'idx_posts_title', columns: ['title'] }],
      timestamps: true,
      metadata: {
        admin: {
          searchableFields: ['title'],
          listDisplay: ['id', 'title', 'published'],
        },
      },
    });

    const meta = Post.metadata;
    expect(meta).toBeInstanceOf(ModelMetadata);
    expect(meta.name).toBe('Post');
    expect(meta.table).toBe('posts');
    expect(meta.primaryKey).toBe('id');
    expect(meta.connection).toBe('default');

    // Field assertions
    expect(meta.hasField('title')).toBe(true);
    expect(meta.hasField('nonexistent')).toBe(false);

    const titleField = meta.getField('title')!;
    expect(titleField.name).toBe('title');
    expect(titleField.type).toBe('string');
    expect(titleField.columnName).toBe('title');
    expect(titleField.nullable).toBe(false);
    expect(titleField.length).toBe(255);

    const viewCountField = meta.getField('viewCount')!;
    expect(viewCountField.columnName).toBe('view_count');
    expect(viewCountField.defaultValue).toBe(0);

    // Column mapping
    expect(meta.fieldToColumn('viewCount')).toBe('view_count');
    expect(meta.columnToField('view_count')).toBe('viewCount');
    expect(meta.fieldToColumn('title')).toBe('title');

    // Timestamps
    expect(meta.timestamps.enabled).toBe(true);
    expect(meta.timestamps.createdAt).toBe('createdAt');
    expect(meta.timestamps.updatedAt).toBe('updatedAt');

    // Indexes
    expect(meta.indexes.length).toBe(1);
    expect(meta.indexes[0]?.name).toBe('idx_posts_title');
    expect(meta.indexes[0]?.columns).toEqual(['title']);

    // Admin / custom options
    expect(meta.options['admin']).toEqual({
      searchableFields: ['title'],
      listDisplay: ['id', 'title', 'published'],
    });

    // Immutability
    expect(Object.isFrozen(meta)).toBe(true);
    expect(Object.isFrozen(titleField)).toBe(true);
  });

  it('should support serializing metadata to clean JSON for future Admin', () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true }),
        email: fields.string({ unique: true }),
      },
      relations: {
        profile: relations.hasOne(() => User, { foreignKey: 'userId' }),
      },
    });

    const json = User.metadata.toJSON();
    expect(json['name']).toBe('User');
    expect(json['table']).toBe('users');
    expect(json['primaryKey']).toBe('id');
    expect(json['fields']).toBeDefined();
    expect((json['fields'] as any)['email'].type).toBe('string');
    expect((json['relations'] as any)['profile'].type).toBe('hasOne');
  });
});
