# JSango AI Platform — Getting Started

## Introduction

JSango provides a first-class AI development runtime for building intelligent APIs, autonomous AI agents, tool orchestrations, and real-time streaming backends with minimal code.

---

## 1. Quick Example: Simple LLM Generation

```typescript
import { ai } from 'jsango';

// Generate text with default model (or specify model: 'openai:gpt-4o', 'anthropic:claude-3-5-sonnet', 'gemini:gemini-1.5-flash')
const response = await ai.generate({
  prompt: 'Explain the benefits of TypeScript in 3 bullet points.',
  temperature: 0.7,
});

console.log(response.text);
```

---

## 2. Quick Example: Autonomous Agent with Tools

```typescript
import { createApp, agent, tool, string, schema, fields, model } from 'jsango';

// 1. Define Model
export const Product = model('Product', {
  id: fields.id(),
  name: fields.string(),
  price: fields.number(),
  inStock: fields.boolean({ defaultValue: true }),
});

// 2. Define Tool
const findProductTool = tool({
  name: 'find_product',
  description: 'Lookup product details by name',
  input: schema({ name: string().min(2) }),
  execute: async ({ name }) => {
    return Product.where('name', name).first();
  },
});

// 3. Create Agent
export const ShopAssistant = agent({
  name: 'ShopAssistant',
  instructions: 'Assist customers with store inventory and pricing.',
  tools: {
    findProduct: findProductTool,
  },
  memory: 'conversation',
});

// 4. Mount to Application
const app = createApp();

// Automatically creates POST /api/chat, SSE streaming GET /api/chat, and WebSocket /ws/chat!
app.agent('/api/chat', ShopAssistant);
app.wsAgent('/ws/chat', ShopAssistant);

await app.listen(3000);
```
