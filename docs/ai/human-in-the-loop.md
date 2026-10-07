# Human-in-the-Loop & Approvals in JSango

Sensitive tools (e.g., issuing refunds, executing database migrations, deleting customer accounts, or sending external emails) should never run autonomously without human authorization.

---

## Configuring Tool Approval

Mark any tool with `requiresApproval: true`:

```typescript
import { tool } from 'jsango';
import { object, string, number } from '@jsango/validation';

export const refundTool = tool({
  name: 'issueRefund',
  description: 'Issue refund to customer invoice',
  schema: object({
    invoiceId: string(),
    amount: number(),
  }),
  requiresApproval: true,
  execute: async ({ invoiceId, amount }) => {
    return { status: 'refunded', invoiceId, amount };
  },
});
```

---

## Handling Approval Pauses

When the model calls an approval-gated tool, the agent does **not** run it. `run()` returns
with `status: 'paused'` and an `approvalRequest`, and emits an `approval.required` event:

```typescript
import { agent, ToolExecutor } from 'jsango';
import { refundTool } from './tools/refund.js'; // the tool defined above

const supportAgent = agent({
  name: 'SupportAgent',
  instructions: 'Handle billing queries.',
  tools: { refundTool },
});

const result = await supportAgent.run({ input: 'Please refund $50 for invoice inv_123' });

if (result.status === 'paused' && result.approvalRequest) {
  const { approvalId, toolName, input } = result.approvalRequest;
  // Store it and show it to a reviewer (e.g. in your admin panel)...
  await approvals.save({ approvalId, toolName, input });
}

// Later, once a reviewer approved it, execute the tool explicitly:
const outcome = await ToolExecutor.execute({
  tool: refundTool,
  arguments: approvedRequest.input,
  approvalGranted: true,
  context: { user: reviewer },
});
console.log(outcome.output);
```
