# Testing AI Agents & Zero-Cost Fixtures

`FakeLlmProvider` lets you test agents, tool calls and workflows deterministically, with no
API calls and no cost.

---

## Deterministic Testing with FakeLlmProvider

Responses are consumed in order: each `respond()` / `respondWithTool()` answers one model call.

```typescript
import { describe, it, expect } from 'vitest';
import { FakeLlmProvider, agent, tool, object, string } from 'jsango';

describe('Customer Support Agent', () => {
  it('calls lookupOrder tool and answers user', async () => {
    const fake = new FakeLlmProvider()
      .respondWithTool('lookupOrder', { orderId: 'ord_999' }) // 1st call: use the tool
      .respond('Order ord_999 has been shipped and is in transit.'); // 2nd call: final answer

    let toolExecuted = false;
    const lookupOrder = tool({
      name: 'lookupOrder',
      description: 'Lookup order status',
      schema: object({ orderId: string() }),
      execute: async ({ orderId }: { orderId: string }) => {
        toolExecuted = true;
        return { orderId, status: 'in_transit' };
      },
    });

    const testAgent = agent({
      name: 'SupportAgent',
      instructions: 'Assist users with orders',
      provider: fake,
      tools: { lookupOrder },
    });

    const result = await testAgent.run({ input: 'Where is my order ord_999?' });

    expect(toolExecuted).toBe(true);
    expect(result.text).toContain('Order ord_999 has been shipped');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('lookupOrder');
    expect(fake.callHistory).toHaveLength(2); // every prompt the model received
  });
});
```

`respond()` also accepts a rule with `match` (string, RegExp or function of the request) to
answer specific prompts, plus `setDefaultResponse()` for everything else.

---

## Running AI Evaluations

`evaluate(name, cases, target)` runs each case against an agent (or any
`(input) => Promise<string>` function) and scores it:

```typescript
import { evaluate } from 'jsango';

const report = await evaluate(
  'Refund agent',
  [
    { input: 'Please cancel order 123', expectedTools: ['cancelOrder'] },
    { input: 'What is your return policy?', expected: /30 days/ },
    { input: 'Hi', expected: (res) => res.text.length > 0, maxDurationMs: 2000 },
  ],
  supportAgent
);

console.log(report.passed, report.score, report.errors);
// passed: every case passed; score: % of passing cases (0-100); errors: failure reasons
```
