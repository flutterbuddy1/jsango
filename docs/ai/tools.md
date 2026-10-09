# AI Tools in JSango

JSango provides a unified, type-safe tool system integrated with `@jsango/validation`, permission authorization, timeouts, and human-in-the-loop approval.

---

## Defining a Tool

Define tools using the `tool()` builder:

```typescript
import { tool } from 'jsango';
import { object, string, number } from '@jsango/validation';

export const getOrderTool = tool({
  name: 'getOrder',
  description: 'Retrieve order details by order ID',
  schema: object({
    orderId: string(),
  }),
  execute: async ({ orderId }, context) => {
    // context contains user, tenant, and request metadata
    const order = await Order.find(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  },
});
```

---

## Function-Style Shorthand

For simple tools, pass the name, description and function. Parameters are inferred from the
function's destructured argument:

```typescript
import { tool } from 'jsango';

export const getWeather = tool(
  'getWeather',
  'Get current weather for a city',
  async ({ city }: { city: string }) => {
    return { city, temperature: 22, condition: 'Sunny' };
  }
);
```

---

## Tool Security & Authorization

`permissions` are checked against `context.user` of the run: users with `hasPermission()`
(jsango auth identities) or a `permissions: string[]` array. Runs without a user, or users
lacking a permission, get a `ToolError` instead of executing the tool.

```typescript
import { tool, object, string } from 'jsango';

export const deleteUserTool = tool({
  name: 'deleteUser',
  description: 'Delete a user account',
  schema: object({ userId: string() }),
  permissions: ['users.delete'],
  timeoutMs: 5000, // default 30s
  execute: async ({ userId }: { userId: string }) => {
    await User.query().where('id', userId).delete();
    return { success: true };
  },
});

await adminAgent.run({
  input: 'Delete user 42',
  context: { user: { id: 'admin_1', permissions: ['users.delete'] } },
});
```

---

## Argument Validation

Tool arguments come from the model, so a prompt injection can put anything in them. Before
`execute` runs, jsango checks them: with a `schema` (`schema({ ... })`) the arguments are validated
and coerced and unknown keys are dropped; with a plain JSON schema, required keys must be present
and undeclared keys are dropped. Invalid arguments become a tool error the model sees, never a call.

## Human Approval for Sensitive Actions

Tools with `requiresApproval: true` are never executed by the agent itself; the run pauses
instead (see [human-in-the-loop](./human-in-the-loop.md)).

```typescript
import { tool, object, string, number } from 'jsango';

export const refundPaymentTool = tool({
  name: 'refundPayment',
  description: 'Issue a monetary refund to a customer',
  schema: object({ chargeId: string(), amount: number() }),
  requiresApproval: true,
  execute: async ({ chargeId, amount }: { chargeId: string; amount: number }) => {
    return await payments.refund(chargeId, amount);
  },
});
```
