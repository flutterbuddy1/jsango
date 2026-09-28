# Testing AI Agents & Zero-Cost Fixtures

JSango allows you to test complex LLM agents, tool calls, and workflows deterministically with **zero API costs** and sub-millisecond execution times using `FakeLlmProvider`.

---

## Deterministic Testing with FakeLlmProvider

```typescript
import { describe, it, expect } from 'vitest';
import { FakeLlmProvider, agent, tool } from 'jsango';
import { object, string } from '@jsango/validation';

describe('Customer Support Agent', () => {
  it('calls lookupOrder tool and answers user', async () => {
    const fake = new FakeLlmProvider();

    // 1. First model call triggers tool call
    fake.queueToolCall('lookupOrder', { orderId: 'ord_999' });

    // 2. Second model call provides final answer
    fake.queueText('Order ord_999 has been shipped and is in transit.');

    let toolExecuted = false;
    const lookupOrder = tool({
      name: 'lookupOrder',
      description: 'Lookup order status',
      schema: object({ orderId: string() }),
      execute: async ({ orderId }) => {
        toolExecuted = true;
        return { status: 'in_transit', tracking: 'TRK_123' };
      },
    });

    const testAgent = agent({
      name: 'SupportAgent',
      instructions: 'Assist users with orders',
      provider: fake,
      tools: { lookupOrder },
    });

    const result = await testAgent.run({
      input: 'Where is my order ord_999?',
    });

    expect(toolExecuted).toBe(true);
    expect(result.text).toContain('Order ord_999 has been shipped');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe('lookupOrder');
  });
});
```

---

## Running AI Evaluations

JSango includes an evaluation framework to score agent accuracy across test suites:

```typescript
import { evaluate } from 'jsango';

const evalResult = await evaluate({
  name: 'Refund Agent Test Suite',
  agent: supportAgent,
  cases: [
    {
      input: 'Please cancel order 123',
      expectedTools: ['cancelOrder'],
    },
    {
      input: 'What is your return policy?',
      assertions: [
        (res) => res.text.includes('30 days') || 'Policy must mention 30 days',
      ],
    },
  ],
});

console.log(`Passed: ${evalResult.passed}/${evalResult.total}`);
```
