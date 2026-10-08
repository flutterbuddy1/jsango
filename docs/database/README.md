# Database Guide: Connections, Models & Migrations

This guide covers everything you need to use a database with jsango: connecting to
PostgreSQL / MySQL / SQLite / MongoDB, defining models, querying, and evolving your schema with
migrations. The same models, queries and migration commands work on all of them.

- [How the pieces fit together](#how-the-pieces-fit-together)
- [Quick start](#quick-start)
- [1. Connecting to a database](#1-connecting-to-a-database)
- [2. `jsango.config.ts`](#2-jsangoconfigts)
- [3. Defining models](#3-defining-models)
- [4. Querying](#4-querying)
- [4a. MongoDB](#4a-mongodb)
- [5. Migrations](#5-migrations)
- [6. Production checklist](#6-production-checklist)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Limitations](#8-limitations)

---

## How the pieces fit together

```
.env ──► src/database.ts ──► DatabaseManager ◄── jsango.config.ts ◄── jsango CLI
            (DATABASE_URL)        │                 (database, models,     (migrate,
                                  │                  migrations paths)      makemigrations)
                                  ▼
               src/models/*.ts  (defineModel)  ──► the ORM runs SQL through the manager
                                  │
                                  ▼
       npx jsango makemigrations ──► migrations/<timestamp>_<name>.ts ──► npx jsango migrate
```

| Piece                        | Role                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| **`DatabaseManager`**        | Owns connection pools. Created once from a config object, e.g. `databaseConfigFromEnv()`. |
| **`setDatabaseManager(db)`** | Makes every model use that manager. Call it once at startup.                              |
| **Models** (`defineModel`)   | Describe tables in TypeScript. They are the **source of truth** for your schema.          |
| **Migration files**          | Versioned, reviewable steps that change the real database to match the models.            |
| **`jsango.config.ts`**       | Tells the CLI where the database, models and migrations are.                              |

The workflow is the same as Django's: **change a model → `makemigrations` → review the file →
`migrate` → commit both.**

---

## Quick start

```bash
npx jsango new my-app
cd my-app
npm install
npm run makemigrations   # creates migrations/<timestamp>_create_users.ts from src/models/user.ts
npm run migrate          # creates the tables
npm run dev              # http://127.0.0.1:3000/users
```

A new project uses SQLite (`./db.sqlite3`) by default, which needs no server and works on
Node.js 22.13+. To switch databases, edit `.env` (see below). Your code stays the same.

---

## 1. Connecting to a database

### Supported databases

| Database                 | `driver`                                | Install in your project                                                        | URL format                                               |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| PostgreSQL 12+           | `postgres` (aliases `postgresql`, `pg`) | `npm install pg`                                                               | `postgres://user:pass@host:5432/db`                      |
| MySQL 8+ / MariaDB 10.5+ | `mysql` (alias `mariadb`)               | `npm install mysql2`                                                           | `mysql://user:pass@host:3306/db`                         |
| SQLite 3.35+             | `sqlite`                                | nothing on Node 22.13+ (`node:sqlite`); otherwise `npm install better-sqlite3` | `sqlite:./db.sqlite3`                                    |
| MongoDB 5+               | `mongodb` (alias `mongo`)               | `npm install mongodb`                                                          | `mongodb://user:pass@host:27017/db` or `mongodb+srv://…` |
| In-memory (tests)        | `memory`                                | nothing                                                                        | —                                                        |

> The client packages are optional peer dependencies: install only the one you use. If it is
> missing, the first query fails with a message telling you exactly what to install.

### Configure with environment variables (recommended)

`databaseConfigFromEnv()` builds the configuration from `.env`:

```bash
# .env — Option A: a single URL (wins if set)
DATABASE_URL=postgres://app:secret@localhost:5432/myapp

# .env — Option B: individual settings (used when DATABASE_URL is empty)
DATABASE_DRIVER=mysql
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=myapp
DATABASE_USER=app
DATABASE_PASSWORD=secret
DATABASE_SSL=            # true / require, no-verify (self-signed), false
DATABASE_POOL_MAX=10
DATABASE_FILE=./db.sqlite3   # SQLite only
```

```ts
// src/database.ts (generated by `jsango new`)
import { DatabaseManager, databaseConfigFromEnv, setDatabaseManager } from 'jsango';

export const db = new DatabaseManager(databaseConfigFromEnv());

export function configureDatabase() {
  setDatabaseManager(db); // all models now use this database
  return db;
}
```

Passwords with special characters must be URL-encoded inside `DATABASE_URL`
(`p@ss` → `p%40ss`), or use the separate `DATABASE_PASSWORD` variable instead.

### Configure in code

```ts
import { DatabaseManager, setDatabaseManager } from 'jsango';

export const db = new DatabaseManager({
  default: 'primary',
  connections: {
    primary: {
      driver: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      database: 'myapp',
      username: 'app',
      password: process.env.DB_PASSWORD,
      ssl: true, // or { rejectUnauthorized: false } for self-signed certificates
      pool: { max: 20, connectionTimeoutMs: 10_000 },
    },
    // `driver` may be omitted when `url` is given; it is inferred from the scheme
    analytics: { url: process.env.ANALYTICS_URL },
    local: { driver: 'sqlite', filename: './data/local.sqlite3' },
  },
});

setDatabaseManager(db);
```

| Connection option                                  | Meaning                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `driver`                                           | `postgres`, `mysql`, `sqlite`, `mongodb`, `memory` (optional if `url` is set)         |
| `url`                                              | Full connection URL                                                                   |
| `host`, `port`, `database`, `username`, `password` | Individual settings                                                                   |
| `filename`                                         | SQLite file path (`:memory:` for an in-memory database)                               |
| `ssl`                                              | `true`, `false`, or a TLS options object                                              |
| `pool`                                             | `{ min, max, acquireTimeoutMs, idleTimeoutMs, connectionTimeoutMs, maxLifetimeMs }`   |
| `options`                                          | Extra options passed to the client (`pg.Pool`, `mysql2.createPool`, `better-sqlite3`) |

Models that don't set `connection` use the **default** connection. Whatever the default is
called, the name `'default'` always resolves to it.

### Verify the connection at startup

```ts
await db.verify(); // throws a descriptive error if it cannot connect
await app.listen(3000);

process.once('SIGTERM', async () => {
  await db.close(); // drain pools on shutdown
  process.exit(0);
});
```

From the terminal:

```bash
npx jsango db:status
```

```
Connection  Driver    Target                          Status      Latency
default     postgres  app@localhost:5432/myapp        ✓ HEALTHY   4ms
```

Connection errors include the target (never the password) and a hint, for example:

```
Failed to connect to PostgreSQL at app@127.0.0.1:5432/myapp: connect ECONNREFUSED 127.0.0.1:5432
Hint: The server refused the connection. Is the database running and listening on this host/port?
```

### Raw SQL

Write SQL with `?` placeholders. They are converted to `$1, $2, …` for PostgreSQL
automatically. (For MongoDB see [section 4a](#4a-mongodb).)

```ts
const { rows } = await db.query('SELECT id, email FROM users WHERE created_at > ?', [since]);

await db.transaction(async (tx) => {
  await tx.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, from]);
  await tx.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, to]);
});
```

---

## 2. `jsango.config.ts`

The CLI (`migrate`, `makemigrations`, `db:status`, …) reads this file from the project root.
It loads `.env` first.

```ts
import { defineConfig } from 'jsango';
import { db } from './src/database.js';

export default defineConfig({
  database: db, // a DatabaseManager, or a config object like { default, connections }
  models: './src/models', // file(s) or folder(s) with defineModel() calls (scanned recursively)
  migrations: './migrations', // where migration files live
});
```

All keys are optional:

| Key          | Default                                                       |
| ------------ | ------------------------------------------------------------- |
| `database`   | built from `DATABASE_URL` / `DATABASE_DRIVER` env vars        |
| `models`     | `./src/models`                                                |
| `migrations` | `./migrations`                                                |
| `envFile`    | `.env` (existing environment variables are never overwritten) |

TypeScript files (the config, models and migrations) are loaded with `tsx`, so no build step is
needed and the usual `./file.js` import style works.

---

## 3. Defining models

```ts
// src/models/user.ts
import { defineModel, fields } from 'jsango';

export const User = defineModel(
  'User',
  {
    id: fields.id(), // auto-increment primary key
    email: fields.string({ maxLength: 255, unique: true }),
    name: fields.string({ maxLength: 120, nullable: true }),
    role: fields.string({ maxLength: 20, defaultValue: 'member', indexed: true }),
    isActive: fields.boolean({ defaultValue: true }),
    settings: fields.json({ nullable: true }),
  },
  {
    table: 'users', // default: lower-cased model name + "s"
    timestamps: true, // adds createdAt / updatedAt, set automatically
    softDelete: false, // true adds deletedAt; delete() then only marks rows
  }
);
```

Fields are **NOT NULL by default**. Use `nullable: true` for optional columns.

### Field types

| Field                                  | PostgreSQL                 | MySQL                            | SQLite                              | JS value                                  |
| -------------------------------------- | -------------------------- | -------------------------------- | ----------------------------------- | ----------------------------------------- |
| `fields.id()`                          | `SERIAL PRIMARY KEY`       | `INT AUTO_INCREMENT PRIMARY KEY` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `number`                                  |
| `fields.string({ maxLength })`         | `VARCHAR(n)` (255)         | `VARCHAR(n)`                     | `VARCHAR(n)`                        | `string`                                  |
| `fields.text()`                        | `TEXT`                     | `LONGTEXT`                       | `TEXT`                              | `string`                                  |
| `fields.integer()`                     | `INTEGER`                  | `INT`                            | `INTEGER`                           | `number`                                  |
| `fields.bigint()`                      | `BIGINT`                   | `BIGINT`                         | `BIGINT`                            | `bigint`                                  |
| `fields.float()` / `number()`          | `DOUBLE PRECISION`         | `DOUBLE`                         | `REAL`                              | `number`                                  |
| `fields.decimal({ precision, scale })` | `NUMERIC(p,s)`             | `DECIMAL(p,s)`                   | `NUMERIC(p,s)`                      | `number`                                  |
| `fields.boolean()`                     | `BOOLEAN`                  | `TINYINT(1)`                     | `INTEGER` (0/1)                     | `boolean`                                 |
| `fields.dateTime()`                    | `TIMESTAMP WITH TIME ZONE` | `DATETIME(3)` (UTC)              | `DATETIME` (ISO text)               | `Date`                                    |
| `fields.date()` / `time()`             | `DATE` / `TIME`            | `DATE` / `TIME`                  | `DATE` / `TIME`                     | `Date`                                    |
| `fields.json()`                        | `JSONB`                    | `JSON`                           | `TEXT`                              | object / array                            |
| `fields.uuid()`                        | `UUID`                     | `CHAR(36)`                       | `VARCHAR(36)`                       | `string`                                  |
| `fields.binary()`                      | `BYTEA`                    | `LONGBLOB`                       | `BLOB`                              | `Uint8Array`                              |
| `fields.objectId()`                    | `VARCHAR(24)`              | `VARCHAR(24)`                    | `VARCHAR(24)`                       | `string` (a native `ObjectId` on MongoDB) |

Values are converted both ways: booleans come back as `true`/`false` on every database, dates as
`Date`, JSON as parsed objects.

### Field options

| Option                        | Effect                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `nullable: true`              | Allows `NULL` (default: NOT NULL)                                                                                     |
| `unique: true`                | Unique constraint `uq_<table>_<column>`                                                                               |
| `indexed: true`               | Index `idx_<table>_<column>`                                                                                          |
| `defaultValue: x`             | Default for new rows; a function (`() => crypto.randomUUID()`) is evaluated by the ORM and isn't stored in the schema |
| `maxLength: n`                | `VARCHAR(n)`                                                                                                          |
| `precision`, `scale`          | For `decimal`                                                                                                         |
| `columnName: 'x'`             | Column name when it differs from the property name                                                                    |
| `primaryKey`, `autoIncrement` | For custom keys, e.g. `fields.uuid({ primaryKey: true, defaultValue: () => crypto.randomUUID() })`                    |

Model options: `table`, `connection` (named connection), `primaryKey`, `timestamps`
(`true` or `{ createdAt: 'created_at', updatedAt: 'updated_at' }`), `softDelete`
(`true` or `{ deletedAt: 'deleted_at' }`), `indexes: [{ columns: ['a', 'b'], unique: true }]`,
`relations`.

### Relations

```ts
export const Post = defineModel(
  'Post',
  {
    id: fields.id(),
    title: fields.string(),
    userId: fields.integer(), // the foreign key column
  },
  {
    table: 'posts',
    timestamps: true,
    relations: {
      // posts.userId -> users.id; creates a FOREIGN KEY in the migration
      author: { type: 'belongsTo', target: 'User', foreignKey: 'userId' },
    },
  }
);

// on User:
//   relations: { posts: { type: 'hasMany', target: 'Post', foreignKey: 'userId' } }
```

| Type                 | Meaning                                                           | `foreignKey` lives on |
| -------------------- | ----------------------------------------------------------------- | --------------------- |
| `belongsTo`          | this row points to one parent                                     | this model            |
| `hasOne` / `hasMany` | children point to this row                                        | the target model      |
| `manyToMany`         | via a pivot model: `through`, `pivotForeignKey`, `pivotTargetKey` | the pivot model       |

`target` can be the model name (`'User'`) or a function (`() => User`), which avoids circular
imports. `belongsTo` foreign keys use `ON DELETE CASCADE`, or `SET NULL` when the field is
nullable. Override it with `options: { onDelete: 'RESTRICT' }`.

---

## 4. Querying

```ts
// Create
const user = await User.create({ email: 'a@example.com', name: 'Ada' });
user.id; // assigned by the database
user.createdAt; // Date

await Post.bulkCreate([
  { title: 'One', userId: user.id },
  { title: 'Two', userId: user.id },
]);

// Read
await User.find(1); // by primary key, or null
await User.findOrFail(1); // throws ModelNotFoundError
await User.where('email', 'a@example.com').first();
await User.where({ role: 'admin', isActive: true }).get();
await User.query()
  .where('createdAt', '>=', since)
  .whereIn('role', ['admin', 'editor'])
  .whereNotNull('name')
  .orWhere('email', 'LIKE', '%@example.com')
  .orderBy('createdAt', 'DESC')
  .limit(20)
  .offset(40)
  .get();

await User.count();
await User.where('isActive', true).exists();
const page = await User.query().orderBy('id').paginate({ page: 2, pageSize: 25 });
// page.items, page.total, page.page, page.pageSize, page.totalPages

for await (const u of User.query().cursor(500)) {
  /* stream large tables in batches */
}

// Update
user.name = 'Ada Lovelace';
await user.save(); // only changed columns are written
await User.where('isActive', false).update({ role: 'inactive' });

// Delete
await user.delete();
await User.where('role', 'spam').delete();
```

Operators: `=`, `!=`, `<>`, `>`, `>=`, `<`, `<=`, `LIKE`, `NOT LIKE`, `ILIKE` (runs as
case-insensitive `LIKE` on MySQL/SQLite), `IN`, `NOT IN`. `where('x', null)` compiles to
`IS NULL`. Any other operator is rejected, so user input can never inject SQL through the
operator argument.

Keys that aren't declared fields are ignored on insert/update. You can pass a request body to
`create()` without it failing on unknown columns. You should still validate input.

### Advanced queries

These work identically on PostgreSQL, MySQL, SQLite and MongoDB:

```ts
// Grouped conditions:  genre = 'fiction' AND (price < 10 OR pages > 500)
await Book.where('genre', 'fiction')
  .where((q) => q.where('price', '<', 10).orWhere('pages', '>', 500))
  .get();

await Book.whereNot('status', 'draft').get();
await Book.whereNot((q) => q.where('genre', 'kids').orWhere('price', 0)).get();
await Book.whereBetween('price', [10, 25]).get(); // also whereNotBetween / orWhereBetween
await Book.whereLike('title', '%guide%').get(); // case-insensitive everywhere
await Book.whereLike('code', 'AB_%', { caseSensitive: true }).get(); // exact case on PostgreSQL / MongoDB
await Book.where('price', 'BETWEEN', [10, 25]).get(); // operator form
await Book.orWhereIn('genre', ['a', 'b']).orWhereNull('pages').get();

// Selection
await Book.select('genre').distinct().orderBy('genre').get();
await Book.orderBy('price').pluck('title'); // ['Tiny Tales', ...]
await Book.where('isbn', isbn).value('title'); // single value or null
await Book.findMany([id1, id2]);
await Book.latest().first(); // newest by createdAt (oldest() too)
await Book.query().firstOrFail();

// Aggregates
await Book.sum('price'); // 0 when nothing matches
await Book.where('genre', 'science').avg('price'); // null when nothing matches
await Book.min('price');
await Book.max('pages');
await Book.count('pages'); // counts non-null values
await Book.where('genre', 'none').doesntExist();

// GROUP BY / HAVING -> plain rows
await Book.query()
  .where('publishedAt', '>=', new Date('2024-01-01'))
  .groupBy(
    ['genre'],
    { total: ['sum', 'price'], books: ['count'], longest: ['max', 'pages'] },
    { having: [['books', '>=', 2]], orderBy: [['total', 'DESC']], limit: 10 }
  );
// [{ genre: 'science', total: 42.5, books: 2, longest: 300 }, ...]

// Atomic counters (no read-modify-write race)
await Author.where('active', true).increment('logins'); // bulk; decrement() too
await post.increment('views', 1); // single model, also updates `post.views`

// Find-or-create / upsert-style helpers
const tag = await Tag.firstOrCreate({ slug: 'news' }, { label: 'News' });
const setting = await Setting.updateOrCreate({ key: 'theme' }, { value: 'dark' });

// Batches
await User.query().chunk(500, async (users, page) => {
  /* ... return false to stop */
});

// Row locks inside a transaction (PostgreSQL / MySQL; no-op on SQLite and MongoDB)
await transaction(async () => {
  const account = await Account.where('id', id).lockForUpdate().first();
  // ...
});

// Soft-delete restore
await Post.onlyTrashed().where('authorId', id).restore();
await post.restore();

// Escape hatch
await User.whereRaw('LOWER(email) = ?', [email]).get(); // SQL databases
await User.whereRaw({ tags: { $all: ['a', 'b'] } }).get(); // MongoDB
```

### Eager loading (no N+1)

```ts
const posts = await Post.query().with('author').orderBy('id', 'DESC').limit(10).get();
posts[0].author.email; // loaded with one extra query for all posts
```

### Soft deletes

With `softDelete: true`, `delete()` sets `deletedAt` and normal queries skip those rows.

```ts
await Post.query().get(); // only rows not soft-deleted
await Post.withTrashed().get(); // everything
await Post.onlyTrashed().get(); // only soft-deleted
await post.delete({ force: true }); // really delete
```

### Transactions

```ts
import { transaction } from 'jsango';

await transaction(async () => {
  const user = await User.create({ email: 'ada@example.com' });
  await Profile.create({ userId: user.id }); // same transaction automatically
  if (!ok) throw new Error('rollback'); // any error rolls everything back
});

// isolation level / specific connection
await transaction(
  async () => {
    /* ... */
  },
  { isolationLevel: 'SERIALIZABLE', connection: 'analytics' }
);
```

Every model call inside the callback, including nested async functions, uses the transaction.
You don't need to pass it around. To use an explicit transaction or connection instead:
`User.query().using(tx)`, `User.create(data, { connection: tx })`, `user.save({ connection: tx })`.

---

## 4a. MongoDB

Models, queries, relations, transactions and migrations all work on MongoDB. Connect it like
any other database:

```bash
npm install mongodb
# .env
DATABASE_URL=mongodb://app:secret@localhost:27017/myapp
# or MongoDB Atlas: mongodb+srv://app:secret@cluster0.xxxxx.mongodb.net/myapp
```

**Model ids.** Documents are keyed by `_id`. jsango maps your model's primary key to `_id`
and exposes it as a 24-character hex string:

```ts
export const Post = defineModel(
  'Post',
  {
    id: fields.objectId({ primaryKey: true }), // a new ObjectId is generated on create
    title: fields.string(),
    authorId: fields.objectId(), // stored as an ObjectId reference
    tags: fields.json({ nullable: true }), // arrays / objects are stored natively
  },
  {
    table: 'posts', // collection name
    timestamps: true,
    relations: { author: { type: 'belongsTo', target: 'Author', foreignKey: 'authorId' } },
  }
);

const post = await Post.create({ title: 'Hello', authorId: author.id });
post.id; // '65f1c2...' (ObjectId as a string)
await Post.find(post.id); // strings are converted to ObjectId in queries
```

Use `fields.objectId()` for primary keys and references if a model must run on MongoDB and SQL
databases (on SQL it becomes `VARCHAR(24)`). `fields.id()` also works on MongoDB, but the ids
are ObjectId strings rather than numbers.

**How queries are translated.** `where` becomes a filter (`$eq`, `$ne`, `$gt`, `$in`,
`$regex` for `LIKE`, `$or`/`$and`/`$nor` for groups, with SQL precedence). `orderBy`,
`limit` and `offset` map to `sort`, `limit` and `skip`. `count` uses `countDocuments`.
Aggregates and `groupBy` run as aggregation pipelines, and `increment` uses `$inc`. `IS NULL`
matches both missing and null fields, like an SQL NULL.

**Transactions** need a **replica set** or a sharded cluster (Atlas always has one). On a
standalone `mongod`, `transaction()` fails with a hint. For local development:

```bash
mongod --replSet rs0 --dbpath ./data   # then, once, in mongosh:  rs.initiate()
```

Migrations don't need transactions and work on standalone servers too.

**Migrations on MongoDB.** `makemigrations` and `migrate` work the same way as on SQL, and
the operations are translated as follows:

| Operation           | MongoDB                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| create table        | `createCollection` with a `$jsonSchema` validator (required fields + types, `validationLevel: moderate`) plus indexes |
| unique / index      | `createIndex` (unique indexes on nullable fields ignore missing values, like SQL NULLs)                               |
| add column          | backfills the default into existing documents, then updates the validator                                             |
| drop column         | relaxes the validator, drops the indexes on it, then `$unset`s the field everywhere                                   |
| rename column       | updates the validator, `$rename`s the field, and rebuilds the indexes on it                                           |
| alter column        | updates the validator                                                                                                 |
| rename / drop table | `renameCollection` / `drop`                                                                                           |
| foreign keys        | skipped (MongoDB has none); relations are still resolved by the ORM                                                   |

Migration history lives in the `jsango_migrations` collection, and the lock in
`jsango_migration_lock`. For data migrations, use `ctx.execute()` (`ctx.sql()` isn't available):

```ts
export default defineMigration({
  id: '20260930130000_backfill_roles',
  async up(ctx) {
    await ctx.execute({
      op: 'updateMany',
      collection: 'users',
      filter: { role: null },
      update: { $set: { role: 'member' } },
    });
    await ctx.execute({
      op: 'createIndex',
      collection: 'users',
      keys: { lastSeenAt: -1 },
      name: 'idx_users_last_seen',
    });
  },
  async down(ctx) {
    await ctx.execute({ op: 'dropIndex', collection: 'users', name: 'idx_users_last_seen' });
  },
});
```

`t.objectIdKey()` and `t.objectId('authorId')` are the table-builder equivalents of the model
fields.

**Native access.** For change streams, GridFS, `$lookup`-heavy pipelines and similar, use the
native driver:

```ts
import type { Db } from 'mongodb';
const mongo = await db.mongo<Db>();
await mongo
  .collection('events')
  .aggregate([{ $match: { type: 'signup' } }])
  .toArray();

// or structured commands through a pooled connection:
const conn = await db.connection();
try {
  const { rows } = await conn.execute({
    op: 'aggregate',
    collection: 'orders',
    pipeline: [{ $match: { status: 'paid' } }],
  });
} finally {
  await conn.release();
}
```

---

## 5. Migrations

### The idea

Your **models describe the schema you want**. **Migrations** are the ordered steps that take a
real database there. jsango writes them for you:

1. `npx jsango makemigrations` replays your existing migration files to work out what the
   database _should_ look like now (this needs no database connection), compares that with your
   models, and writes a new file containing only the difference.
2. `npx jsango migrate` runs the pending files in order and records each one in the
   `jsango_migrations` table, so it never runs twice.

Migration files are code: review them, commit them with the model change, and deploy them.

### Everyday workflow

```bash
# 1. edit src/models/user.ts (e.g. add  age: fields.integer({ nullable: true }))

npx jsango makemigrations            # or: npx jsango migrate:generate add_age_to_users
#   ✔ Created migration migrations/20260930101500_add_age_to_users.ts
#     [+] Add column users.age (integer)

npx jsango migrate --dry-run         # optional: show the exact SQL
npx jsango migrate                   # apply
npx jsango migrate:status            # applied / pending list
```

### What a generated migration looks like

```ts
// migrations/20260930101500_add_age_to_users.ts
import { AddColumnOperation, Migration } from 'jsango';

export const id = '20260930101500_add_age_to_users';
export const name = 'add_age_to_users';

export default new Migration({
  id,
  name,
  operations: [new AddColumnOperation('users', { name: 'age', type: 'integer', nullable: true })],
});
```

Operation-based migrations are **reversible automatically**: `migrate:rollback` runs the
inverse operations in reverse order.

### Commands

| Command                                | What it does                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsango makemigrations [name]`         | Create a migration from model changes (alias of `migrate:generate`). `--dry-run` shows the changes without writing a file; `--empty` creates a blank hand-written migration. |
| `jsango migrate`                       | Apply pending migrations. `--dry-run` prints the SQL; `--target <id>` stops at a migration; `--yes` confirms destructive changes.                                            |
| `jsango migrate:status`                | List applied and pending migrations.                                                                                                                                         |
| `jsango migrate:rollback`              | Undo the last **batch** (everything applied by the last `migrate` run). `--steps 1` undoes just one migration; `--target <id>` undoes everything after `<id>`.               |
| `jsango migrate:check`                 | Exit with an error if models have changes that aren't in a migration, or if migrations are pending. Use it in CI. `--skip-db` compares files only.                           |
| `jsango migrate:reset --yes [--fresh]` | Roll back all migrations; `--fresh` then re-applies them. Refused when `NODE_ENV=production`.                                                                                |
| `jsango db:status`                     | Test every configured connection.                                                                                                                                            |

All of them accept `--connection <name>` for multi-database projects, and `--json` for
machine-readable output.

### Destructive changes

Dropping a table or column, shrinking a column, or changing a column's type can lose data. The
generator marks these operations `[destructive]`, and `migrate` refuses to run them until you
confirm with `--yes`:

```bash
npx jsango migrate --dry-run   # look at what will be dropped
npx jsango migrate --yes
```

> **Renames:** the generator can't tell a rename from "drop the old column + add a new one",
> and dropping loses data. To rename, write the migration by hand with `ctx.renameColumn()`
> (below) instead of generating it.

Adding a **NOT NULL column without a default** to a table that already has rows fails on every
database. The generator warns you about this; make the field `nullable: true`, or give it a
`defaultValue`.

### Hand-written migrations

For renames, data migrations, raw SQL, views or extensions:

```bash
npx jsango makemigrations rename_user_name --empty
```

```ts
import { defineMigration } from 'jsango';

export default defineMigration({
  id: '20260930120000_rename_user_name',
  async up(ctx) {
    await ctx.renameColumn('users', 'name', 'fullName');

    await ctx.createTable('audit_logs', (t) => {
      t.id();
      t.integer('userId').references('users'); // FK -> users.id, ON DELETE CASCADE
      t.string('action', 50).index();
      t.json('payload').nullable();
      t.timestamps();
    });

    // data migration (skipped while makemigrations replays history)
    await ctx.sql("UPDATE users SET role = 'member' WHERE role IS NULL");
  },
  async down(ctx) {
    await ctx.dropTable('audit_logs');
    await ctx.renameColumn('users', 'fullName', 'name');
  },
});
```

Schema helpers on `ctx`: `createTable`, `dropTable`, `renameTable`, `addColumn`, `dropColumn`,
`alterColumn`, `renameColumn`, `addIndex`, `dropIndex`, `addUnique`, `dropUnique`,
`addForeignKey`, `dropForeignKey`, `sql`. Table builder columns: `id`, `bigId`, `string`, `text`,
`integer`, `bigint`, `float`, `decimal`, `boolean`, `dateTime`, `date`, `time`, `json`, `uuid`,
`binary`, `timestamps`, `softDeletes`. Column modifiers: `.nullable()`, `.default(v)`,
`.unique()`, `.index()`, `.primaryKey()`, `.references(table, column?, { onDelete })`.

Use the `ctx` schema helpers rather than `ctx.sql()` for schema changes, because
`makemigrations` can see them when working out the current schema. Changes made through
`ctx.sql()` are invisible to it.

### How each database runs migrations

|                                      | PostgreSQL        | SQLite                                    | MySQL / MariaDB                                    | MongoDB                                          |
| ------------------------------------ | ----------------- | ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Each migration in a transaction      | ✅                | ✅                                        | ❌ DDL auto-commits                                | ❌                                               |
| Failure mid-migration                | fully rolled back | fully rolled back                         | earlier statements stay applied; the error says so | earlier commands stay applied; the error says so |
| `ALTER COLUMN`, add/drop foreign key | native            | table rebuild (automatic, data preserved) | native                                             | validator update; FKs skipped                    |

- **SQLite** can't alter columns or add/drop foreign keys in place. jsango rebuilds the table:
  it creates a copy with the new definition, copies the rows, swaps the tables and recreates
  the indexes. It reads the table's live definition first, so no columns are lost, and runs
  with foreign keys paused plus an integrity check before committing.
- **MySQL** can't roll back DDL. Keep MySQL migrations small (one logical change each) so a
  failure is easy to fix.
- A **migration lock** (`jsango_migration_lock` table) stops two deploys from migrating at the
  same time.

### Team workflow

- File names start with a UTC timestamp, so migrations from different branches sort
  deterministically. After merging, run `npx jsango migrate:check` to see whether the models
  still need a migration.
- Don't edit a migration that has already run in shared environments. Add a new one instead.
- Commit the migration in the same commit as the model change.

### Running migrations in production

Run migrations as a release step before starting the new version:

```bash
npm ci
npx jsango migrate:check --skip-db   # optional: fail the build if a migration is missing
npx jsango migrate                   # applies pending migrations, locked against concurrent runs
npm start
```

The migrations folder and `jsango.config.ts` must be deployed with the app. `tsx` ships with the
CLI, so TypeScript migrations run without a build step.

---

## 6. Production checklist

- [ ] Use PostgreSQL or MySQL. Use SQLite only for single-server apps with modest write traffic.
- [ ] Put credentials in `DATABASE_URL`, not in code. Enable `DATABASE_SSL=true` for managed
      databases.
- [ ] Size the pool (`DATABASE_POOL_MAX`) so that `instances × pool size` stays below the
      server's `max_connections`.
- [ ] Call `await db.verify()` before `listen()` so a bad configuration fails at startup.
- [ ] Call `await db.close()` on `SIGTERM`.
- [ ] Run `npx jsango migrate` in the release pipeline, and `migrate:check` in CI.
- [ ] Back up the database before any migration marked `[destructive]`.
- [ ] Monitor `GET /health/database` (the generated app exposes it).

---

## 7. Troubleshooting

| Message                                                      | Fix                                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `No database is configured for this project`                 | Add `jsango.config.ts` (see [section 2](#2-jsangoconfigts)) or set `DATABASE_URL` in `.env`.                                  |
| `PostgreSQL support requires the 'pg' package`               | `npm install pg` (or `mysql2` / `better-sqlite3` / `mongodb`).                                                                |
| `MongoDB transactions need a replica set`                    | Start `mongod --replSet rs0` and run `rs.initiate()` once, or use Atlas.                                                      |
| `Document failed validation` (MongoDB)                       | A document is missing a required (non-nullable) field or has the wrong type. Make the field `nullable: true` or pass a value. |
| `MongoDB connections do not run SQL`                         | Use models, `conn.execute({...})` or `db.mongo()` instead of `db.query('SELECT ...')`.                                        |
| `SQLite support requires 'better-sqlite3' or Node.js 22.13+` | Upgrade Node.js, or run `npm install better-sqlite3`.                                                                         |
| `ECONNREFUSED`                                               | The database server isn't running, or the host/port is wrong.                                                                 |
| `password authentication failed` / `ER_ACCESS_DENIED_ERROR`  | Wrong user or password. URL-encode special characters in `DATABASE_URL`.                                                      |
| `database "x" does not exist` / `ER_BAD_DB_ERROR`            | Create the database first: `CREATE DATABASE x;`                                                                               |
| `no such table: users` / `relation "users" does not exist`   | You haven't run `npx jsango makemigrations` and `npx jsango migrate` yet.                                                     |
| `Migration run contains destructive changes`                 | Check with `migrate --dry-run`, then run `migrate --yes`.                                                                     |
| `No changes detected` but the table is wrong                 | The table was changed outside migrations. Run `migrate:status`, then fix the table with a hand-written migration.             |
| `Could not acquire migration lock`                           | Another `migrate` is running. A crashed run's lock expires after 15 minutes.                                                  |
| `Model with name 'X' is already registered`                  | Two different models share a name. Model names must be unique.                                                                |

---

## 8. Limitations

- **MongoDB:** raw SQL (`whereRaw('…')`, `db.query('SELECT …')`) isn't available. Use relations (`.with()`), `whereRaw({ …filter })`, `conn.execute()` or `db.mongo()` instead. Savepoints (nested transactions) aren't supported, and the database doesn't enforce foreign keys.
- `whereLike(…, { caseSensitive: true })` is exact-case only on PostgreSQL and MongoDB. SQLite `LIKE` is always case-insensitive for ASCII, and MySQL follows the column collation (case-insensitive by default).
- `makemigrations` doesn't detect renames. Use a hand-written `ctx.renameColumn()` /
  `ctx.renameTable()` migration.
- SQLite table rebuilds keep columns, keys, indexes and unique constraints. `CHECK` constraints
  and triggers written by hand in raw SQL aren't recreated.
- MySQL doesn't return inserted rows, so after `bulkCreate()` on MySQL the returned models have
  no `id`s. `create()` does return the `id`.
- The default table name is the lower-cased model name plus `s` (`Category` → `categorys`). Set
  `table` explicitly for good names.
