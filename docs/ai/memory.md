# AI Memory in JSango

JSango provides unified short-term and long-term memory management for AI Agents with multi-tenant and user-level isolation.

---

## In-Memory Store

For testing, serverless scripts, or short-lived sessions:

```typescript
import { agent, InMemoryMemoryStore } from 'jsango';

const memory = new InMemoryMemoryStore();

const assistant = agent({
  name: 'ChatAssistant',
  instructions: 'Help users with their questions.',
  memory,
});

// Run with conversation ID
const res1 = await assistant.run({
  input: 'My name is Alice.',
  conversationId: 'session_123',
});

const res2 = await assistant.run({
  input: 'What is my name?',
  conversationId: 'session_123',
});
// res2.text => "Your name is Alice."
```

---

## Scoped User & Tenant Memory

Memory entries can be segmented by `userId`, `tenantId`, and `agentId` to prevent cross-tenant and cross-user data leakage.

```typescript
await memory.append('session_123', {
  role: 'user',
  content: 'Sensitive customer note',
  userId: 'user_456',
  tenantId: 'tenant_789',
});

const history = await memory.get('session_123', {
  userId: 'user_456',
  tenantId: 'tenant_789',
  limit: 20,
});
```

---

## Database Memory Store

For production applications, persist conversation messages into PostgreSQL / MySQL / SQLite using the `DatabaseMemoryStore`:

```typescript
import { DatabaseMemoryStore, agent } from 'jsango';

const dbMemory = new DatabaseMemoryStore();

export const persistentAgent = agent({
  name: 'SupportAgent',
  instructions: 'Production assistant',
  memory: dbMemory,
});
```
