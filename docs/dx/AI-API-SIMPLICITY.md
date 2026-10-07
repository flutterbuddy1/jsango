# JSango AI Developer Experience & Simplicity Report

## 1. Ergonomic Paradigm: "Progressive Disclosure"

JSango AI APIs are designed around progressive complexity:

- **Level 1 (Simple Generation)**: 1 line of code (`await ai.generate("Hello")`)
- **Level 2 (Agent)**: 4 lines of code (`const bot = agent({ instructions: "..." }); await bot.run("...")`)
- **Level 3 (Tools)**: Direct function mapping or schema-validated `tool(...)`
- **Level 4 (Memory)**: Instant `memory: "conversation"`
- **Level 5 (Workflows)**: Fluent chaining `.step().parallel().branch()`
- **Level 6 (RAG)**: `knowledge('docs').ingest(text); knowledge.retrieve(q)`
- **Level 7 (Human-in-the-loop)**: `requiresApproval: true`
- **Level 8 (MCP & Evals)**: Universal interoperability

---

## 2. Code Comparison & Ergonomics Matrix

### Task 1: Basic Text Generation
```typescript
import { ai } from 'jsango';
const res = await ai.generate('Explain quantum computing');
console.log(res.text);
```
- **Lines of Code**: 3
- **Imports**: 1
- **Boilerplate**: 0%

### Task 2: Autonomous Agent with Tool Calling
```typescript
import { createApp, agent, tool, schema, string, fields, model } from 'jsango';

export const Order = model('Order', { id: fields.id(), status: fields.string() });

const supportAgent = agent({
  name: 'SupportAgent',
  instructions: 'Help customers with order status.',
  tools: {
    getOrder: tool({
      name: 'get_order',
      description: 'Get status of an order',
      input: schema({ orderId: string() }),
      execute: ({ orderId }) => Order.find(orderId),
    }),
  },
  memory: 'conversation',
});

const app = createApp();

// Exposes REST POST /api/support and SSE GET /api/support; wsAgent() adds a WebSocket endpoint
app.agent('/api/support', supportAgent);
app.wsAgent('/ws/support', supportAgent);

await app.listen(3000);
```
- **Lines of Code**: 22
- **Unified Ecosystem**: Model definition, Validation Schema, Agent, Tool, REST, SSE, and WebSocket endpoints created in a single cohesive file!
