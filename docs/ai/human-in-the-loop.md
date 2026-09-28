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

When an agent invokes an approval-gated tool:
1. The tool execution is intercepted.
2. The agent status transitions to `paused` or emits a `human.approval_required` event.
3. An `ApprovalRequiredError` or pending approval payload is returned with the tool name and arguments.

```typescript
import { agent, isApprovalRequiredError } from 'jsango';

const supportAgent = agent({
  name: 'SupportAgent',
  instructions: 'Handle billing queries.',
  tools: { refundTool },
});

try {
  const result = await supportAgent.run({
    input: 'Please refund $50 for invoice inv_123',
  });
} catch (err) {
  if (isApprovalRequiredError(err)) {
    console.log(`Approval required for tool: ${err.toolName}`);
    console.log(`Arguments:`, err.toolArgs);
    
    // Resume after administrator review:
    // await supportAgent.resume(err.runId, { approved: true });
  }
}
```
