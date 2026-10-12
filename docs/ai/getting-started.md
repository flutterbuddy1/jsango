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
// Public by default: add auth / rate limits with `middleware` (they cost you model tokens).
app.agent('/api/chat', ShopAssistant, { middleware: [auth.required()], maxSteps: 5 });
app.wsAgent('/ws/chat', ShopAssistant, { middleware: [auth.required()] });

await app.listen(3000);
```

---

## 3. Choosing a Provider

Pick the first option that fits:

1. **A built-in provider**: `OpenAiProvider`, `AnthropicProvider`, `GeminiProvider`, `OllamaProvider`,
   `OpenRouterProvider`.
2. **Any OpenAI-compatible API** (Groq, DeepSeek, Together, vLLM, LM Studio...): no code, just
   point `OpenAiProvider` at it.

   ```typescript
   const groq = new OpenAiProvider({
     baseUrl: 'https://api.groq.com/openai/v1',
     apiKey: process.env.GROQ_API_KEY,
   });
   ```

3. **Anything else**: `provider(fn)`. The function gets `messages` (`prompt` / `system` are already
   folded in) and returns the reply text.

   ```typescript
   import { agent, provider } from 'jsango';

   const myProvider = provider(async ({ messages, model, signal }) => {
     const res = await fetch('https://my-model.example.com/chat', {
       method: 'POST',
       headers: { 'content-type': 'application/json' },
       body: JSON.stringify({ model, messages }),
       signal, // stops the call when the client disconnects
     });
     return (await res.json()).text;
   });

   const bot = agent({ name: 'Assistant', instructions: 'You are helpful' }, myProvider);
   app.agent('/chat', bot);
   ```

   - **Tools**: return `{ toolCalls: [{ id, name, arguments }] }` (`arguments` is an object). The
     tool result comes back on the next call as a `{ role: 'tool', toolCallId, name, content }` message
     (`content` is the tool output as JSON).
   - **Usage / cost**: return `{ text, usage: { promptTokens, completionTokens, totalTokens } }`
     (defaults to 0).
   - **RAG**: pass `provider(fn, { embed: async (texts) => vectors })` to use it with `knowledge()`.
   - **Streaming** sends the whole reply as one chunk. For token-by-token streaming, extend
     `BaseLlmProvider` and implement `stream()`.
   - Register it under a name to use `model: 'mine:some-model'`:
     `ai.registerProvider('mine', myProvider)`.
