# AI Memory in JSango

An agent with `memory` remembers the conversation between `run()` calls. History is stored per
**tenant + user + conversation**, so two users never see each other's messages, even if they
use the same `conversationId`.

---

## In-Memory Store

For tests, scripts and single-process apps:

```typescript
import { agent, InMemoryMemoryStore } from 'jsango';

const assistant = agent({
  name: 'ChatAssistant',
  instructions: 'Help users with their questions.',
  memory: new InMemoryMemoryStore(50), // keeps the last 50 messages per conversation
});

await assistant.run({
  input: 'My name is Alice.',
  context: { conversationId: 'session_123', user: { id: 'user_456' }, tenantId: 'acme' },
});

const res = await assistant.run({
  input: 'What is my name?',
  context: { conversationId: 'session_123', user: { id: 'user_456' }, tenantId: 'acme' },
});
// res.text => "Your name is Alice."
```

`memory: true` is shorthand for a new `InMemoryMemoryStore`. Without a `conversationId`, each
user (and tenant) gets a single `default` conversation.

---

## Database Memory Store

To keep conversations across restarts and multiple servers, store them in your database
(PostgreSQL, MySQL, SQLite or MongoDB). The `ai_memory` table (or collection) is created on
first use.

```typescript
import { DatabaseMemoryStore, agent } from 'jsango';
import { db } from './database.js'; // your DatabaseManager

export const persistentAgent = agent({
  name: 'SupportAgent',
  instructions: 'Production assistant',
  memory: new DatabaseMemoryStore({ connection: db, maxMessages: 100 }),
});
```

Options: `connection` (required), `tableName` (default `ai_memory`), and `maxMessages`
(default 100; the oldest messages are dropped first).

---

## Custom Stores

Any object with `get(key)`, `set(key, messages)` and `clear(key)` works as `memory`, for example
a Redis-backed store:

```typescript
import type { MemoryStore, LlmMessage } from 'jsango';

class RedisMemory implements MemoryStore {
  constructor(private readonly redis: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<unknown>; del(k: string): Promise<unknown> }) {}
  async get(key: string): Promise<LlmMessage[]> {
    return JSON.parse((await this.redis.get(`mem:${key}`)) ?? '[]');
  }
  async set(key: string, messages: LlmMessage[]): Promise<void> {
    await this.redis.set(`mem:${key}`, JSON.stringify(messages));
  }
  async clear(key: string): Promise<void> {
    await this.redis.del(`mem:${key}`);
  }
}
```
