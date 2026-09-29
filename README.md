<p align="center">
  <img src="images/logo.png" alt="JSango Logo" width="180" />
</p>

<h1 align="center">JSango</h1>

<p align="center">
  <strong>Production-grade, batteries-included TypeScript backend framework.</strong><br>
  <em>"Powerful Internally, Simple Externally"</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.1.1-green.svg" alt="Version: 1.1.1" /></a>
  <a href="tsconfig.base.json"><img src="https://img.shields.io/badge/TypeScript-Strict%205.8-blue.svg" alt="TypeScript: Strict" /></a>
  <a href="https://flutterbuddy1.github.io/jsango/"><img src="https://img.shields.io/badge/Docs-Landing%20Page-6366f1.svg" alt="Documentation Site" /></a>
</p>

---

## Why JSango?

JSango combines the convention-over-configuration philosophy, developer ergonomics, and built-in batteries of Django with modern TypeScript type safety, modular package architecture, and the high-throughput performance of contemporary JavaScript runtimes.

- **One Single Dependency**: Install `jsango` and get HTTP routing, WebSockets, ORM, Validation, Auth, Admin UI, OpenAPI, Queue, and Events out of the box.
- **Zero Boilerplate**: Write handlers that directly return objects, strings, streams, or promises. Automatic JSON serialization.
- **Type-Safe Validation**: Define schemas once with fluent builders (`string()`, `number()`, `email()`).
- **Intuitive ORM**: Expressive declarative models with static query helpers (`User.where('active', true).get()`, `User.find(id)`).
- **Built-in WebSockets**: Broadcast to rooms and manage real-time sockets with simple, ergonomic APIs.
- **Auto Admin & OpenAPI**: Instant OpenAPI documentation (`app.openapi()`) and metadata-driven Admin UI (`app.admin()`).

---

## 5-Minute Quick Start

### 1. Scaffold a New Project

```bash
# Using npx
npx jsango new my-app
cd my-app
pnpm install
pnpm dev
```

### 2. Hello World in 6 Lines

```typescript
import { createApp } from "jsango";

const app = createApp();

app.get("/hello", () => ({ message: "Hello from JSango!" }));

await app.listen(3000);
```

---

## Essential Guides

### 1. Simple REST & CRUD APIs

```typescript
import { createApp, model, fields, validate, schema, string, email, notFound } from "jsango";

// Define ORM Model
export const User = model("User", {
  id: fields.id(),
  name: fields.string(),
  email: fields.string({ unique: true }),
  active: fields.boolean({ defaultValue: true }),
});

const app = createApp();

// Query all users
app.get("/users", async () => {
  return User.all();
});

// Query single user
app.get("/users/:id", async ({ params }) => {
  const user = await User.find(params.id);
  if (!user) throw notFound("User not found");
  return user;
});

// Create user with automatic schema validation
app.post(
  "/users",
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

// Or generate a full CRUD resource in one line:
app.crud("/api/users", User);

await app.listen(3000);
```

### 2. Real-Time WebSockets & Rooms

```typescript
import { createApp } from "jsango";

const app = createApp();

app.ws("/chat", (socket) => {
  // Join a room
  socket.on("join", (room) => {
    socket.join(room);
    socket.to(room).send({ type: "notification", text: `User ${socket.id} joined.` });
  });

  // Broadcast to room
  socket.on("message", ({ room, text }) => {
    socket.to(room).send({ type: "message", from: socket.id, text });
  });
});

await app.listen(3000);
```

### 3. Background Jobs, Events & Cache

```typescript
import { events, jobs, cache } from "jsango";

// 1. Events
events.on("user.registered", async (user) => {
  console.log("Welcome email queued for", user.email);
});
await events.emit("user.registered", { id: "1", email: "alex@example.com" });

// 2. Background Jobs
jobs.define("send-email", async ({ to, subject }) => {
  // perform async sending...
});
await jobs.dispatch("send-email", { to: "alex@example.com", subject: "Welcome!" });

// 3. Cache with Stampede Protection
const stats = await cache.remember("dashboard.stats", 60, async () => {
  return { activeUsers: 1420, uptime: process.uptime() };
});
```

### 4. Automatic Admin UI & OpenAPI Documentation

```typescript
import { createApp } from "jsango";
import { User } from "./models/user.js";

const app = createApp();

// Mount OpenAPI 3.1 JSON and Swagger UI (High-contrast dark mode)
app.openapi({
  path: "/openapi.json",
  title: "My Application API",
  version: "1.0.0",
});

// Mount Instant Admin Dashboard with Model Introspection
app.admin({
  path: "/admin",
  resources: [User],
});

await app.listen(3000);
```

### 5. Multi-Database Drivers (PostgreSQL, MySQL, SQLite, MongoDB)

For installation steps, generated project setup, and current driver limitations, see the [Database Setup Guide](docs/database/README.md).

JSango supports PostgreSQL (`postgres`), MySQL (`mysql`), SQLite (`sqlite`), MongoDB (`mongodb`), and zero-config In-Memory (`memory`):

Database configuration is created in application code and registered with the ORM; a `jsango.config.ts` file is not loaded automatically. See the [Database Setup Guide](docs/database/README.md) for working setup steps and supported drivers.

---

### 6. Native AI Agents & Tool Calling

Build production-grade AI agents, workflows, and tool execution with single-import simplicity:

```typescript
import { createApp, agent, tool, object, string, number } from "jsango";

// 1. Define type-safe tools with automatic JSON schema generation
const lookupOrder = tool({
  name: "lookupOrder",
  description: "Get order status by order ID",
  schema: object({ orderId: string() }),
  execute: async ({ orderId }) => {
    return await Order.find(orderId);
  },
});

const refundOrder = tool({
  name: "refundOrder",
  description: "Issue refund for an order",
  schema: object({ orderId: string(), amount: number() }),
  requiresApproval: true, // Human-in-the-loop approval gate
  execute: async ({ orderId, amount }) => {
    return await PaymentService.refund(orderId, amount);
  },
});

// 2. Create the Agent
const supportAgent = agent({
  name: "SupportAgent",
  instructions: "Help customers check orders and handle refund requests.",
  tools: { lookupOrder, refundOrder },
});

// 3. Expose Agent over HTTP & SSE Streaming in 1 line
const app = createApp();
app.agent("/api/support", supportAgent);

// 4. Or expose Agent over real-time WebSockets
app.wsAgent("/ws/support", supportAgent);

await app.listen(3000);
```

---

## CLI Commands

| Command | Description |
|---|---|
| `jsango new <name>` | Scaffold a fresh, production-ready JSango application |
| `jsango dev` | Start development server with TypeScript compilation |
| `jsango build` | Compile application for production |
| `jsango start` | Run production build |
| `jsango migrate` | Run pending database migrations |
| `jsango routes` | List all registered HTTP and WebSocket routes |
| `jsango make:agent <name>` | Generate an AI Agent template |
| `jsango ai:doctor` | Verify configured AI providers and API keys |
| `jsango doctor` | Verify environment, dependencies, and configuration |

---

## Monorepo Packages

For advanced customization, internal packages remain independently available:

| Package | Responsibility |
|:---|:---|
| [`jsango`](packages/jsango) | **Unified high-level developer facade and app coordinator** |
| [`@jsango/ai`](packages/ai) | **AI Agent runtime, provider abstraction, tools, workflows, RAG, and MCP** |
| [`@jsango/core`](packages/core) | Application lifecycle coordinator and structured error hierarchy |
| [`@jsango/http`](packages/http) | HTTP request/response abstractions and streaming body parsers |
| [`@jsango/router`](packages/router) | Segment Radix Trie router (>7.7M ops/sec) and parameter constraints |
| [`@jsango/middleware`](packages/middleware) | Middleware execution pipeline and response normalizers |
| [`@jsango/orm`](packages/orm) | Declarative models, AST query builder, and batch eager loading |
| [`@jsango/database`](packages/database) | Multi-connection manager, connection pool, and transactions |
| [`@jsango/validation`](packages/validation) | Fluent schema validation engine and request middleware |
| [`@jsango/websocket`](packages/websocket) | Real-time WebSocket server, room manager, and heartbeat engine |
| [`@jsango/admin`](packages/admin) | Metadata-driven administrative dashboard engine |
| [`@jsango/auth`](packages/auth) | Authentication (JWT, Session, API Key) and policy authorization |
| [`@jsango/cache`](packages/cache) | Driver-agnostic caching with stampede protection (`remember`) |
| [`@jsango/queue`](packages/queue) | Asynchronous background job queues with exponential retries |
| [`@jsango/events`](packages/events) | In-process and distributed asynchronous event bus |
| [`@jsango/cli`](packages/cli) | CLI tooling and project generators |

---

## License

MIT © JSango Authors.
