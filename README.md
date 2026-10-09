<p align="center">
  <img src="images/logo.png" alt="JSango Logo" width="180" />
</p>

<h1 align="center">JSango</h1>

<p align="center">
  <strong>Production-grade, batteries-included TypeScript backend framework.</strong><br>
  <em>"Powerful Internally, Simple Externally"</em>
</p>

<p align="center">
<a href="https://www.producthunt.com/products/jsango/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-jsango" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1330206&theme=light" alt="JSango - The&#0032;simplest&#0032;way&#0032;to&#0032;build&#0032;your&#0032;next&#0032;backend | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.6.0-green.svg" alt="Version: 1.6.0" /></a>
  <a href="tsconfig.base.json"><img src="https://img.shields.io/badge/TypeScript-Strict%205.8-blue.svg" alt="TypeScript: Strict" /></a>
  <a href="https://flutterbuddy1.github.io/jsango/"><img src="https://img.shields.io/badge/Docs-Landing%20Page-6366f1.svg" alt="Documentation Site" /></a>
</p>

---

## Why JSango?

JSango combines convention over configuration, developer ergonomics and built-in batteries with modern TypeScript type safety, a modular package architecture, and the high-throughput performance of contemporary JavaScript runtimes.

- **One Single Dependency**: Install `jsango` and get HTTP routing, WebSockets, ORM, Validation, Auth, Admin UI, OpenAPI, Queue, and Events out of the box.
- **Zero Boilerplate**: Write handlers that directly return objects, strings, streams, or promises. Automatic JSON serialization.
- **Type-Safe Validation**: Define schemas once with fluent builders (`string()`, `number()`, `email()`).
- **Intuitive ORM**: Expressive declarative models with static query helpers (`User.where('active', true).get()`, `User.find(id)`).
- **Built-in WebSockets**: Broadcast to rooms and manage real-time sockets with simple, ergonomic APIs.
- **Auto Admin & OpenAPI**: Instant OpenAPI documentation (`app.openapi()`) and metadata-driven Admin UI (`app.admin()`).
- **Fast, measured**: 3.0–3.6× the throughput of Express and 82–96% of Fastify's on the same endpoints ([benchmarks/compare](benchmarks/compare), `pnpm bench:compare`).

---

## 5-Minute Quick Start

### 1. Scaffold a New Project

```bash
npx jsango new my-app
cd my-app
npm install
npm run makemigrations   # create the first migration from src/models
npm run migrate          # apply it (SQLite by default, no database server needed)
npm run dev              # http://127.0.0.1:3000
```

### 2. Hello World in 6 Lines

```typescript
import { createApp } from 'jsango';

const app = createApp();

app.get('/hello', () => ({ message: 'Hello from JSango!' }));

await app.listen(3000);
```

---

## Building with AI assistants

Every `jsango new` project ships an `AGENTS.md` (read by Claude Code, Cursor, Copilot, Codex, ...) that makes AI agents
build with jsango's APIs instead of other libraries and verify their work, plus MCP configs for the `jsango mcp`
server: `get_api` (real signatures from your installed version), `search_docs`, `run_check` (type-check,
migrations, tests, with fix hints) and `report_issue` (drafts a GitHub issue for a jsango bug with secrets removed and
duplicates checked; you review and submit it yourself). No server to host: it runs locally from the npm package. Add all of it to an
existing project with `npx jsango ai:init`. AI assistants can read the docs at
[llms.txt](https://flutterbuddy1.github.io/jsango/llms.txt) / [llms-full.txt](https://flutterbuddy1.github.io/jsango/llms-full.txt).

## Essential Guides

### 1. Simple REST & CRUD APIs

```typescript
import { createApp, model, fields, validate, schema, string, email, notFound } from 'jsango';

// Define ORM Model
export const User = model('User', {
  id: fields.id(),
  name: fields.string(),
  email: fields.string({ unique: true }),
  active: fields.boolean({ defaultValue: true }),
});

const app = createApp();

// Query all users
app.get('/users', async () => {
  return User.all();
});

// Query single user
app.get('/users/:id', async ({ params }) => {
  const user = await User.find(params.id);
  if (!user) throw notFound('User not found');
  return user;
});

// Create user with automatic schema validation
app.post(
  '/users',
  validate({
    body: schema({
      name: string().min(2),
      email: email(),
    }),
  }),
  async ({ body }) => {
    return User.create(body);
  }
);

// Or generate a REST resource in one line (reads public, writes locked: see below)
app.crud('/api/users', User);

await app.listen(3000);
```

#### CRUD resources with `app.crud`

`app.crud(path, Model, options)` adds `GET /path` (paginated, `?search=`, filters), `GET /path/:id`,
`POST /path`, `PUT|PATCH /path/:id` and `DELETE /path/:id`. It is safe by default:

- **Reads are public, writes answer 403** until `access` allows them.
- **Only real columns are written**: the primary key, timestamps, sensitive fields and privilege
  fields (`isAdmin`, `isSuperuser`, `isStaff`, `role(s)`, `permissions`, `emailVerified`) are ignored
  in the body, so no `{"isAdmin": true}` mass assignment. List fields yourself with `writable`.
- **Sensitive fields are never returned**: names with password, secret, token, apiKey or hash;
  `hidden` adds more.

```typescript
import { schema, string, number, badRequest } from 'jsango';

app.crud('/api/products', Product, {
  // 'public' or middleware, for every route or per `read` / `write` / list|detail|create|update|delete
  access: { read: 'public', write: auth.required({ roles: ['admin'] }) },
  searchFields: ['name'], // ?search=phone
  filterFields: ['categoryId'], // ?categoryId=3
  writable: ['name', 'price', 'stock', 'categoryId'], // default: every column but id/timestamps/sensitive
  schema: schema({ name: string().min(2), price: number().min(0) }), // 400 with field errors
});

// Each user only sees and changes their own rows; business logic runs in hooks.
app.crud('/api/addresses', Address, {
  access: auth.required(),
  scope: (query, ctx) => query.where('userId', auth.identity(ctx).id),
  hooks: {
    beforeCreate: (data, ctx) => ({ ...data, userId: auth.identity(ctx).id }),
    beforeDelete: async (address) => {
      if (await Order.where('addressId', address.get('id')).first())
        throw badRequest('Address is in use');
    },
  },
});
```

Hooks (`beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`)
run in one database transaction with the write: throwing in any of them rolls it back. `before*`
hooks may return changed data. With a `scope`, a create or update that would put the record outside
it (e.g. `ownerId` changed to someone else) is refused with 403 and rolled back.

**When not to use `app.crud`:** a write that is a whole business process (placing an order: check
stock, apply a coupon, add tax, charge, send email) belongs in its own route or service. Keep the
reads from `app.crud` and leave out the write it replaces:

```typescript
app.crud('/api/orders', Order, {
  access: auth.required(),
  only: ['list', 'detail'],
  scope: (query, ctx) => query.where('userId', auth.identity(ctx).id),
});
app.post('/api/orders', auth.required(), validate({ body: PlaceOrder }), (ctx) =>
  placeOrder(auth.identity(ctx), ctx.body)
);
```

#### CORS, security headers and rate limits

```typescript
import { createApp, cors, securityHeaders, rateLimit } from 'jsango';

const app = createApp({ trustProxy: true }); // behind nginx / a load balancer: real client IPs

app.use(securityHeaders()); // nosniff, no framing, referrer policy, HSTS on https
app.use(cors({ origin: ['https://app.example.com'], credentials: true })); // browser apps elsewhere
app.use(rateLimit({ max: 300, windowSeconds: 60 })); // per client IP

// Stricter limit on one route (e.g. login); pass `store` to share counts between instances
app.post('/login', rateLimit({ max: 10, windowSeconds: 60 }), loginHandler);
```

### 2. Real-Time WebSockets & Rooms

`app.ws` works like an HTTP route: same paths and params, same middleware (`auth.required()` runs
on the connection request).

```typescript
import { createApp, createAuth } from 'jsango';

const app = createApp();
const auth = createAuth({ secret: process.env.AUTH_SECRET!, users: userLookup });

app.ws('/chat/:room', auth.required(), {
  open(socket) {
    socket.join(socket.params.room); // socket.user is the signed-in user
  },
  message(socket, data) {
    // every message; JSON is parsed for you
  },
  close(socket) {},
});

// Event style: the client sends { "event": "typing", "data": { ... } }
app.ws('/live', (socket) => {
  socket.on('typing', (data) => socket.to('lobby').emit('typing', data)); // everyone else in the room
});

// Push from anywhere (HTTP routes, jobs, events). Signed-in sockets are in `user:<id>`.
app.post('/orders', auth.required(), async (ctx) => {
  const order = await Order.create({ userId: auth.identity(ctx).id });
  await app.to(`user:${auth.identity(ctx).id}`).emit('order.created', order);
  return order;
});

await app.listen(3000);
```

| On the socket                                 | Does                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| `send(data)` / `emit(event, data)`            | Send JSON / send `{ event, data }`                            |
| `join(room)`, `leave(room)`, `rooms`          | Rooms are shared by all routes                                |
| `to(room).send/emit(...)`                     | Everyone in the room except this socket                       |
| `broadcast(data)`                             | Everyone else on the same route                               |
| `on('message' \| 'close' \| 'error' \| name)` | Listen; a custom name receives client `{ event: name, data }` |
| `user`, `params`, `request`, `ctx`, `id`      | Signed-in user, route params, the connection request          |

Secure by default: only pages from your own host may connect (`origins: ['https://app.com']` or
`'*'` to change; apps without an `Origin` header are allowed), messages are limited to 64 KB
(`maxPayload`), dead connections are dropped by a 30s ping, slow clients are disconnected instead
of filling memory, and an error in a handler goes to `error` / the log instead of crashing the
server. `server.close()` closes open sockets.

### 3. Background Jobs, Events & Cache

```typescript
import { events, jobs, cache } from 'jsango';

// 1. Events
events.on<{ id: string; email: string }>('user.registered', async (user) => {
  console.log('Welcome email queued for', user.email);
});
await events.emit('user.registered', { id: '1', email: 'alex@example.com' });

// 2. Background Jobs
jobs.register<{ to: string; subject: string }>('send-email', async ({ to, subject }) => {
  // perform async sending...
});
await jobs.dispatch('send-email', { to: 'alex@example.com', subject: 'Welcome!' });

// 3. Cache with Stampede Protection
const stats = await cache.remember('dashboard.stats', 60, async () => {
  return { activeUsers: 1420, uptime: process.uptime() };
});
```

### 4. Automatic Admin UI & OpenAPI Documentation

```typescript
import { createApp, LocalDiskMediaStorage, S3MediaStorage } from 'jsango';
import { User } from './models/user.js';

const app = createApp();

// Mount OpenAPI 3.1 JSON and Swagger UI (High-contrast dark mode)
app.openapi({
  path: '/openapi.json',
  title: 'My Application API',
  version: '1.0.0',
});

// Mount Instant Admin Dashboard with Model Introspection
app.admin({
  path: '/admin',
  resources: [User, Product, Category],
  // Optional: media library disks (default: ./uploads served at /media)
  media: {
    local: new LocalDiskMediaStorage(),
    s3: new S3MediaStorage({
      bucket: 'assets',
      region: 'ap-south-1',
      accessKeyId: process.env.S3_KEY!,
      secretAccessKey: process.env.S3_SECRET!,
    }),
  },
});

await app.listen(3000);
```

In the admin, `belongsTo` relations become searchable dropdowns with **+ New** and **Edit** buttons
that open the related record's form in a side panel. **Media** (sidebar) uploads, previews and deletes
files on every configured disk (local, S3, Cloudflare R2, MinIO, DigitalOcean Spaces), and `image` /
`file` fields upload there or pick from the library.

### 5. Database, Models & Migrations (PostgreSQL, MySQL, SQLite, MongoDB)

Connect with one environment variable, describe tables as models, and let jsango write the migrations. Change a model, generate a migration, review it, apply it:

```bash
# .env
DATABASE_URL=postgres://app:secret@localhost:5432/myapp   # or mysql://…, sqlite:./db.sqlite3, mongodb://…
```

```typescript
// src/models/post.ts
import { defineModel, fields } from 'jsango';

export const Post = defineModel(
  'Post',
  {
    id: fields.id(),
    title: fields.string({ maxLength: 200 }),
    userId: fields.integer(),
    publishedAt: fields.dateTime({ nullable: true }),
  },
  {
    table: 'posts',
    timestamps: true,
    relations: { author: { type: 'belongsTo', target: 'User', foreignKey: 'userId' } },
  }
);
```

```bash
npx jsango makemigrations   # writes migrations/<timestamp>_create_posts.ts from your models
npx jsango migrate          # applies it (--dry-run prints the SQL)
npx jsango db:status        # checks the connection
```

`jsango new` sets all of this up (`jsango.config.ts`, `src/database.ts`, an example model, SQLite by default). The **[Database Guide](docs/database/README.md)** covers connecting, field types, queries, transactions, hand-written migrations, production deploys and troubleshooting.

---

### 6. Native AI Agents & Tool Calling

Build production-grade AI agents, workflows, and tool execution with single-import simplicity:

```typescript
import { createApp, agent, tool, object, string, number } from 'jsango';

// 1. Define type-safe tools with automatic JSON schema generation
const lookupOrder = tool({
  name: 'lookupOrder',
  description: 'Get order status by order ID',
  schema: object({ orderId: string() }),
  execute: async ({ orderId }) => {
    return await Order.find(orderId);
  },
});

const refundOrder = tool({
  name: 'refundOrder',
  description: 'Issue refund for an order',
  schema: object({ orderId: string(), amount: number() }),
  requiresApproval: true, // Human-in-the-loop approval gate
  execute: async ({ orderId, amount }) => {
    return await PaymentService.refund(orderId, amount);
  },
});

// 2. Create the Agent
const supportAgent = agent({
  name: 'SupportAgent',
  instructions: 'Help customers check orders and handle refund requests.',
  tools: { lookupOrder, refundOrder },
});

// 3. Expose Agent over HTTP & SSE Streaming in 1 line (auth + rate limits via middleware)
const app = createApp();
app.agent('/api/support', supportAgent, { middleware: [auth.required()] });

// 4. Or expose Agent over real-time WebSockets
app.wsAgent('/ws/support', supportAgent, { middleware: [auth.required()] });

await app.listen(3000);
```

`POST /api/support` with `{ input, conversationId? }` answers `{ text, conversationId, toolCalls,
usage, status }`; send the `conversationId` back to continue the conversation. The history and the
system prompt are never returned, anonymous visitors get their own server-issued conversation, input
is capped at 10,000 characters (`maxInputLength`), and a run stops when the client disconnects.

---

## CLI Commands

| Command                                      | Description                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `jsango new <name>`                          | Scaffold a new application (database, example model and migrations included)            |
| `jsango makemigrations`                      | Generate a migration from model changes (`migrate:generate`)                            |
| `jsango migrate`                             | Apply pending migrations (`--dry-run` shows the SQL)                                    |
| `jsango migrate:status` / `migrate:rollback` | Show migration state / undo the last batch                                              |
| `jsango migrate:check`                       | Fail CI when a model change has no migration or migrations are pending                  |
| `jsango db:status`                           | Test the configured database connections                                                |
| `jsango routes`                              | List all registered HTTP and WebSocket routes                                           |
| `jsango make:agent <name>`                   | Generate an AI Agent template                                                           |
| `jsango ai:doctor`                           | Verify configured AI providers and API keys                                             |
| `jsango ai:init`                             | Add or refresh `AGENTS.md`, `CLAUDE.md` and MCP configs so AI coding agents use jsango  |
| `jsango mcp`                                 | MCP server (stdio) for AI agents: `get_api`, `search_docs`, `run_check`, `report_issue` |
| `jsango doctor`                              | Verify environment, dependencies, and configuration                                     |

---

## Monorepo Packages

For advanced customization, internal packages remain independently available:

| Package                                     | Responsibility                                                             |
| :------------------------------------------ | :------------------------------------------------------------------------- |
| [`jsango`](packages/jsango)                 | **Unified high-level developer facade and app coordinator**                |
| [`@jsango/ai`](packages/ai)                 | **AI Agent runtime, provider abstraction, tools, workflows, RAG, and MCP** |
| [`@jsango/core`](packages/core)             | Application lifecycle coordinator and structured error hierarchy           |
| [`@jsango/http`](packages/http)             | HTTP request/response abstractions and streaming body parsers              |
| [`@jsango/router`](packages/router)         | Segment Radix Trie router (>7.7M ops/sec) and parameter constraints        |
| [`@jsango/middleware`](packages/middleware) | Middleware execution pipeline and response normalizers                     |
| [`@jsango/orm`](packages/orm)               | Declarative models, AST query builder, and batch eager loading             |
| [`@jsango/database`](packages/database)     | Multi-connection manager, connection pool, and transactions                |
| [`@jsango/validation`](packages/validation) | Fluent schema validation engine and request middleware                     |
| [`@jsango/websocket`](packages/websocket)   | Real-time WebSocket server, room manager, and heartbeat engine             |
| [`@jsango/admin`](packages/admin)           | Metadata-driven administrative dashboard engine                            |
| [`@jsango/auth`](packages/auth)             | Authentication (JWT, Session, API Key) and policy authorization            |
| [`@jsango/cache`](packages/cache)           | Driver-agnostic caching with stampede protection (`remember`)              |
| [`@jsango/queue`](packages/queue)           | Asynchronous background job queues with exponential retries                |
| [`@jsango/events`](packages/events)         | In-process and distributed asynchronous event bus                          |
| [`@jsango/cli`](packages/cli)               | CLI tooling and project generators                                         |

---

## License

MIT © JSango Authors.
