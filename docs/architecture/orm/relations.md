# Relationships & Eager Loading

## Supported Relationship Types

`@django-js/orm` provides declarative relationship definitions:

1. `relations.belongsTo(target, options)`: Source model holds a foreign key pointing to the target model.
2. `relations.hasOne(target, options)`: Target model holds a foreign key pointing to this model.
3. `relations.hasMany(target, options)`: Target model holds a foreign key pointing to this model, returning an array.
4. `relations.manyToMany(target, options)`: An association resolved through a join/pivot table.

```typescript
export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.integer({ primaryKey: true }),
    name: fields.string(),
  },
  relations: {
    profile: relations.hasOne(() => Profile, { foreignKey: 'userId' }),
    posts: relations.hasMany(() => Post, { foreignKey: 'userId' }),
  },
});

export const Post = defineModel({
  name: 'Post',
  table: 'posts',
  fields: {
    id: fields.integer({ primaryKey: true }),
    userId: fields.integer(),
    title: fields.string(),
  },
  relations: {
    user: relations.belongsTo(() => User, { foreignKey: 'userId' }),
  },
});
```

---

## Zero N+1 Eager Loading

### The N+1 Problem in Traditional ORMs

In traditional ORMs with implicit lazy loading, iterating over 100 users and accessing `user.posts` triggers 1 query for users plus 100 individual queries for each user's posts (101 queries in total).

### The django-js Solution: Batch Eager Loading

In `django-js`, relationships are loaded explicitly via `.with(...)`:

```typescript
const users = await User.query().with('profile', 'posts').get();
```

The `EagerLoader` automatically batches foreign key lookups:

1. **Query 1 (Parent)**:
   ```sql
   SELECT * FROM "users"
   ```
2. **Query 2 (Profiles)**:
   ```sql
   SELECT * FROM "profiles" WHERE "userId" IN (1, 2, 3, ...)
   ```
3. **Query 3 (Posts)**:
   ```sql
   SELECT * FROM "posts" WHERE "userId" IN (1, 2, 3, ...)
   ```

Regardless of whether there are 10, 100, or 1,000 users, **only 3 queries are executed in total**.

---

## Accessing Related Models

Once eager-loaded, related models are accessible directly on model instances:

```typescript
// Property access
const authorPosts = user.posts; // readonly Post[]
const userProfile = user.profile; // Profile | null

// Explicit getter
const author = post.getRelation('user'); // User | null
```

If a relationship was not eager-loaded via `.with()`, property access returns `undefined` and **never triggers an unexpected database query**.
