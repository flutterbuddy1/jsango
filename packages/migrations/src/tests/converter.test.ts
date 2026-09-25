import { describe, it, expect } from 'vitest';
import { defineModel, fields, relations } from '@django-js/orm';
import { ModelSchemaConverter } from '../internal/converter.js';

describe('ModelSchemaConverter', () => {
  it('should convert ORM model metadata into a normalized SchemaSnapshot', () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        username: fields.string({ unique: true, length: 50 }),
        email: fields.string({ unique: true, indexed: true }),
        bio: fields.text({ nullable: true }),
        age: fields.integer({ nullable: true }),
      },
      timestamps: true,
      softDelete: true,
    });

    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        userId: fields.integer(),
        title: fields.string(),
      },
      relations: {
        user: relations.belongsTo('User', { foreignKey: 'userId' }),
      },
    });

    const snapshot = ModelSchemaConverter.convert([User.metadata, Post.metadata]);

    expect(snapshot.hasTable('users')).toBe(true);
    expect(snapshot.hasTable('posts')).toBe(true);

    const userTable = snapshot.getTable('users')!;
    expect(userTable.primaryKey).toEqual(['id']);
    expect(userTable.hasColumn('id')).toBe(true);
    expect(userTable.hasColumn('username')).toBe(true);
    expect(userTable.hasColumn('createdAt')).toBe(true);
    expect(userTable.hasColumn('updatedAt')).toBe(true);
    expect(userTable.hasColumn('deletedAt')).toBe(true);

    const postTable = snapshot.getTable('posts')!;
    expect(postTable.hasColumn('userId')).toBe(true);
    expect(postTable.foreignKeys.length).toBe(1);
    expect(postTable.foreignKeys[0]!.referencedTable).toBe('users');
    expect(postTable.foreignKeys[0]!.columns).toEqual(['userId']);
  });
});
