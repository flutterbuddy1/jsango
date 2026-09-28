# AI Agents in JSango

## Agent Architecture

Agents in JSango are autonomous execution units that combine:
- **System Instructions**: Define persona, capabilities, and boundaries.
- **Tools**: Allow the agent to interact with databases, external APIs, and internal services.
- **Memory**: Context persistence across multiple conversation turns.
- **Guardrails**: Execution limits, cost controls, and content filtering.

---

## Defining an Agent

```typescript
import { agent, tool } from 'jsango';

export const SupportAgent = agent({
  name: 'SupportAgent',
  model: 'openai:gpt-4o',
  instructions: `
    You are a tier-1 customer support representative.
    Answer questions politely and look up account details when asked.
  `,
  tools: {
    getAccount: tool({
      name: 'get_account',
      description: 'Fetch customer account details by ID',
      execute: async ({ accountId }) => ({ id: accountId, plan: 'Enterprise', status: 'Active' }),
    }),
  },
  memory: 'conversation',
  maxSteps: 8,
  temperature: 0.2,
});
```

---

## Running and Streaming

### Programmatic Execution
```typescript
const result = await SupportAgent.run({
  input: 'What plan is account 100 on?',
  context: { conversationId: 'conv_456' },
});

console.log(result.text);
console.log('Tool Calls:', result.toolCalls);
console.log('Total Tokens:', result.usage.totalTokens);
```

### Event Streaming
```typescript
for await (const event of SupportAgent.stream({ input: 'Where is order 123?' })) {
  if (event.type === 'message.delta') {
    process.stdout.write(event.data.text);
  } else if (event.type === 'tool.started') {
    console.log(`\nInvoking tool: ${event.data.toolName}`);
  }
}
```
