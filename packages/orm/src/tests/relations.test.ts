import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { relations } from '../public/relations.js';
import { createTestDatabase, resetTestState } from './test-utils.js';

describe('ORM Relationships & Eager Loading', () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    resetTestState();
    db = createTestDatabase();
  });

  it('should eager-load hasMany, hasOne, and belongsTo with zero N+1 queries', async () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        name: fields.string(),
      },
      relations: {
        profile: relations.hasOne(() => Profile, { foreignKey: 'userId' }),
        posts: relations.hasMany(() => Post, { foreignKey: 'userId' }),
      },
    });

    const Profile = defineModel({
      name: 'Profile',
      table: 'profiles',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        userId: fields.integer(),
        bio: fields.string(),
      },
      relations: {
        user: relations.belongsTo(() => User, { foreignKey: 'userId' }),
      },
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
        user: relations.belongsTo(() => User, { foreignKey: 'userId' }),
      },
    });

    // Seed data: 3 users, each with 1 profile and 2 posts
    for (let i = 1; i <= 3; i++) {
      await User.create({ name: `User ${i}` });
      await Profile.create({ userId: i, bio: `Bio for user ${i}` });
      await Post.create({ userId: i, title: `Post A of User ${i}` });
      await Post.create({ userId: i, title: `Post B of User ${i}` });
    }

    db.connection.executedQueries.length = 0; // Reset query counter

    // Eager load both profile and posts for all users
    const users = await User.query().with('profile', 'posts').get();

    // Verification of queries: exactly 3 queries executed!
    // 1 for users, 1 for profiles (WHERE userId IN (1, 2, 3)), 1 for posts (WHERE userId IN (1, 2, 3))
    expect(db.connection.executedQueries.length).toBe(3);
    expect(db.connection.executedQueries[0]?.sql).toContain('SELECT * FROM "users"');
    expect(db.connection.executedQueries[1]?.sql).toContain(
      'SELECT * FROM "profiles" WHERE "userId" IN (?, ?, ?)'
    );
    expect(db.connection.executedQueries[2]?.sql).toContain(
      'SELECT * FROM "posts" WHERE "userId" IN (?, ?, ?)'
    );

    expect(users.length).toBe(3);

    // Verify relations populated correctly on model instances
    const user1 = users[0]!;
    expect(user1.name).toBe('User 1');

    const profile1 = user1.profile;
    expect(profile1).toBeDefined();
    expect(profile1?.bio).toBe('Bio for user 1');

    const posts1 = user1.posts;
    expect(posts1).toBeDefined();
    expect(posts1?.length).toBe(2);
    expect(posts1?.map((p: any) => p.title)).toEqual(['Post A of User 1', 'Post B of User 1']);

    // Now test belongsTo relation eager loading from Post -> User
    db.connection.executedQueries.length = 0;
    const postsWithAuthor = await Post.query().with('user').get();
    // 1 query for posts + 1 query for users (WHERE id IN (...))
    expect(db.connection.executedQueries.length).toBe(2);
    expect(postsWithAuthor.length).toBe(6);
    expect(postsWithAuthor[0]?.user).toBeDefined();
    expect(postsWithAuthor[0]?.user?.name).toBe('User 1');
  });

  it('should support manyToMany relations through pivot tables', async () => {
    const Role = defineModel({
      name: 'Role',
      table: 'roles',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        name: fields.string(),
      },
    });

    const UserRole = defineModel({
      name: 'UserRole',
      table: 'user_roles',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        userId: fields.integer(),
        roleId: fields.integer(),
      },
    });

    const Member = defineModel({
      name: 'Member',
      table: 'members',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        name: fields.string(),
      },
      relations: {
        roles: relations.manyToMany(() => Role, {
          through: () => UserRole,
          foreignKey: 'userId',
          pivotForeignKey: 'userId',
          pivotTargetKey: 'roleId',
        }),
      },
    });

    // Seed
    await Member.create({ name: 'Alice' });
    await Role.create({ name: 'Admin' });
    await Role.create({ name: 'Editor' });
    await UserRole.create({ userId: 1, roleId: 1 });
    await UserRole.create({ userId: 1, roleId: 2 });

    const member = (await Member.query().with('roles').get())[0]!;
    expect(member.name).toBe('Alice');
    expect(member.roles?.length).toBe(2);
    expect(member.roles?.map((r: any) => r.name)).toEqual(['Admin', 'Editor']);
  });
});
