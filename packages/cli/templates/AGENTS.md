<!-- jsango:start -->

# Working on this project (instructions for AI coding agents)

This is a **jsango** backend: a batteries-included TypeScript framework with routing,
validation, ORM + migrations, auth, an admin panel, jobs, events, cache, WebSockets, OpenAPI and AI agents.
Import everything from `'jsango'`.

## Rules

1. **Use jsango for everything it covers.** Don't add Express, Fastify, Koa, Prisma, TypeORM, Sequelize,
   Mongoose, Knex, Passport, jsonwebtoken, bcrypt, zod/joi, BullMQ, node-cron or socket.io. The table below
   shows the jsango API to use instead.
2. **Only use APIs that exist.** If the `jsango` MCP server is connected (configured in `.mcp.json`,
   `.cursor/mcp.json`, `.vscode/mcp.json`), call `get_api` for exact signatures, `search_docs` for how-to
   and `run_check` before finishing. Otherwise use go-to-definition on the `jsango` import (`node_modules/jsango/dist`
   re-exports the `@jsango/*` packages) or read https://flutterbuddy1.github.io/jsango/llms-full.txt.
   Don't guess method names.
3. **Database changes go through models and migrations**: edit `src/models/*`, run `npx jsango makemigrations`,
   review the generated file, run `npx jsango migrate`. Never edit a migration that has already been applied.
4. **Verify before finishing**: `npx tsc --noEmit` must pass, and so must `npx jsango migrate:check` when models changed
   and the tests (if the project has any).
5. **If jsango is missing something or behaves differently from its docs**, don't patch `node_modules` or
   swap in another library. Write the smallest workaround in this project, tell the user, and offer a
   GitHub issue (see the end of this file).

## Which API to use

| Need                                       | jsango                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP server, routes                        | `createApp()`, `app.get/post/put/patch/delete(path, ...middleware, handler)`, `app.listen(port)`                                                          |
| Request data                               | `ctx.params.id`, `ctx.query.page`, `ctx.body` (the body validated by `validate()`), `await ctx.request.json()` (raw body), `ctx.request.headers.get(...)` |
| REST resource for a model                  | `app.crud('/posts', Post, { access: { write: auth.required() }, schema, scope, hooks })` (see below)                                                      |
| Request validation                         | `validate({ body: schema({ ... }) })` with `string()`, `email()`, `number()`, `boolean()`, `object()`                                                     |
| Errors                                     | `throw notFound('...')`, `badRequest(...)`, `unauthorized(...)`, `forbidden(...)`                                                                         |
| CORS / headers / rate limits               | `app.use(securityHeaders())`, `app.use(cors({ origin: [...] }))`, `rateLimit({ max, windowSeconds })` (global or per route)                               |
| Models / ORM                               | `defineModel(name, { ...fields }, { table, timestamps, softDelete, relations })`, `fields.*`                                                              |
| Queries                                    | `Model.find(id)`, `Model.where(...).first()`, `.query().where().orderBy().paginate({ page, pageSize })`, `create`, `update`, `delete`                     |
| Migrations                                 | `npx jsango makemigrations`, `npx jsango migrate`, `migrate:status`, `migrate:rollback`                                                                   |
| Database connection                        | `src/database.ts` (`DATABASE_URL` in `.env`: postgres, mysql, sqlite, mongodb)                                                                            |
| Auth (JWT, sessions, API keys, OAuth, 2FA) | `createAuth({ secret, users })`, `auth.login`, `auth.required({ roles, permissions })`                                                                    |
| Admin panel                                | `app.admin({ auth, resources: [Model], dashboard: [...], media: { local: new LocalDiskMediaStorage() } })`                                                |
| Background jobs / events / cache           | `jobs.register` + `jobs.dispatch`, `events.on` + `events.emit`, `cache.remember`                                                                          |
| WebSockets                                 | `app.ws('/chat/:room', auth.required(), { open, message, close })`, `socket.join/to/emit`, `app.to('user:<id>').emit(...)`                                |
| API docs                                   | `app.openapi({ path: '/openapi.json' })`                                                                                                                  |
| AI agents and tools                        | `agent({ ... })`, `tool({ ... })`, `app.agent(path, agent, { middleware: [auth.required()] })`                                                            |

## Project layout

```
src/index.ts         createApplication(): routes, admin, openapi; starts the server
src/database.ts      DatabaseManager from .env (SQLite ./db.sqlite3 by default)
src/models/*.ts      one model per file (defineModel)
migrations/          generated migrations: commit them
jsango.config.ts     CLI config (database, models, migrations paths)
```

## Common code

```ts
import { createApp, defineModel, fields, validate, schema, string, notFound } from 'jsango';

export const Post = defineModel(
  'Post',
  {
    id: fields.id(),
    title: fields.string({ maxLength: 200 }),
    body: fields.text({ nullable: true }),
    published: fields.boolean({ defaultValue: false }),
    authorId: fields.integer(),
  },
  { table: 'posts', timestamps: true }
);

const app = createApp();

app.get('/posts', async ({ query }) => {
  const page = Number(query.page ?? 1);
  return Post.query().where('published', true).latest().paginate({ page, pageSize: 20 });
});

app.get('/posts/:id', async ({ params }) => {
  const post = await Post.find(params.id);
  if (!post) throw notFound('Post not found');
  return post;
});

app.post('/posts', validate({ body: schema({ title: string().min(3) }) }), async ({ body }) => {
  return Post.create({ ...body, authorId: 1 });
});
// The routes above are what app.crud('/posts', Post, { ... }) generates; see "REST resources" below.
```

```ts
import { createApp, createAuth, DatabaseAuthStore, notFound, forbidden } from 'jsango';

export const auth = createAuth({
  secret: process.env.AUTH_SECRET!, // 32+ random characters
  users: {
    findById: (id) => User.find(id),
    findByLogin: (email) => User.where('email', email).first(),
  },
  store: new DatabaseAuthStore({ connection: db }),
});

const app = createApp();
app.post('/auth/login', async (ctx) => {
  const { email, password } = (await ctx.request.json()) as { email: string; password: string };
  return auth.login(email, password, ctx); // { accessToken, refreshToken, expiresIn }
});
app.get('/me', auth.required(), async (ctx) => auth.user(ctx));
app.delete('/posts/:id', auth.required(), async (ctx) => {
  const post = await Post.find(ctx.params.id);
  if (!post) throw notFound('Post not found');
  // Identity ids are strings; integer primary keys need String() to compare.
  const me = auth.identity(ctx);
  if (String(post.authorId) !== me.id && !me.hasRole('admin')) throw forbidden('Not your post');
  await post.delete();
  return { ok: true };
});
app.admin({ auth, resources: [User, Post] }); // admin panel at /admin
```

### REST resources: `app.crud`

Use `app.crud` for any model that needs list / detail / create / update / delete endpoints instead of
writing the five routes by hand. Reads are public and writes answer 403 until `access` allows them;
the primary key, timestamps and sensitive fields are never written from the body nor returned.

```ts
import { schema, string, events } from 'jsango';

app.crud('/posts', Post, {
  access: { read: 'public', write: auth.required() }, // or per route: list, detail, create, update, delete
  searchFields: ['title'],
  filterFields: ['published'],
  schema: schema({ title: string().min(3) }), // validates create, and update with changes applied
  scope: (q, ctx) => q.where('authorId', auth.identity(ctx).id), // users only see/change their rows
  hooks: {
    // run in one transaction with the write; throw badRequest()/forbidden() to cancel
    beforeCreate: (data, ctx) => ({ ...data, authorId: auth.identity(ctx).id }),
    afterCreate: (post) => events.emit('post.created', { id: post.get('id') }),
  },
});
```

Write a custom route instead only when a write is a whole business process (placing an order:
stock, coupons, tax, payment). Keep the reads on `app.crud` with `only: ['list', 'detail']` and add
`app.post('/orders', auth.required(), validate(...), handler)` next to it.

Auth notes:

- Add `AUTH_SECRET=` (32+ random characters, e.g. `openssl rand -base64 48`) to `.env` and `.env.example`.
- Store `passwordHash: await auth.hashPassword(password)` on the user model. Never return user records with
  `passwordHash` from your own routes. The results of `auth.login()`, `auth.refresh()` and `auth.issueTokens()`
  are safe to return: their `user` property is not serialized.
- Roles come from the user's `role` (string) or `roles` (array) field. `isSuperuser: true` grants everything.
- On `auth.optional()` routes, check `auth.identity(ctx).isAuthenticated`. `await auth.user(ctx)` is `null` for anonymous requests.
- Admin panel access needs the `admin` or `staff` role (or `isSuperuser`). Fields whose names contain
  password, hash, secret, token or key (e.g. `passwordHash`) are hidden in the admin automatically.
  For a quick start, `app.admin({ auth: { email, password } })` uses one built-in account instead.

Create the first admin with a small script (e.g. `scripts/create-admin.ts`, run with `npx tsx`):

```ts
import 'dotenv/config';
import { configureDatabase } from '../src/database.js';
import { auth } from '../src/auth.js';
import { User } from '../src/models/user.js';

configureDatabase();
const [email, password] = process.argv.slice(2);
await User.updateOrCreate(
  { email },
  { role: 'admin', passwordHash: await auth.hashPassword(password!) }
);
console.log(`Admin ${email} is ready.`);
```

## Commands

| Command                                                            | Purpose                               |
| ------------------------------------------------------------------ | ------------------------------------- |
| `npm run dev`                                                      | Start with reload                     |
| `npx jsango makemigrations`                                        | Create a migration from model changes |
| `npx jsango migrate` (`--dry-run` shows SQL)                       | Apply migrations                      |
| `npx jsango migrate:status` / `migrate:rollback` / `migrate:check` | Inspect, undo, CI check               |
| `npx jsango db:status`                                             | Test the database connection          |
| `npx jsango make:admin <Model>`                                    | Generate an admin resource            |
| `npx jsango make:agent <Name>`                                     | Generate an AI agent                  |
| `npx jsango routes`                                                | List routes                           |
| `npx jsango doctor`                                                | Check the environment                 |

## Reporting a jsango bug or missing feature

When the problem is in jsango (not in this project's code): if the jsango MCP server is connected, call its
`report_issue` tool. It removes secrets, adds versions, searches for duplicates and returns a draft and a link.
Then show the draft to the user. Without the MCP server:

1. Check the existing issues first: https://github.com/flutterbuddy1/jsango/issues?q=is%3Aissue+YOUR+KEYWORDS
2. Draft a short issue: jsango version (`npx jsango version`), Node.js version, database, a minimal
   reproduction, and the expected vs actual behaviour. **Remove secrets, `.env` values, private code and data.**
3. Show the draft to the user and ask before sending anything. With their OK, give them this link to
   review and submit (URL-encode the title and body):
   `https://github.com/flutterbuddy1/jsango/issues/new?title=<title>&body=<body>&labels=ai-reported`
   Never create issues without the user's explicit approval.

<!-- jsango:end -->
