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

For simple tools without complex configuration, you can use the shorthand syntax:

```typescript
import { tool } from 'jsango';
import { object, string } from '@jsango/validation';

export const getWeather = tool(
  'getWeather',
  'Get current weather for a city',
  object({ city: string() }),
  async ({ city }) => {
    return { city, temperature: 22, condition: 'Sunny' };
  }
);
```

---

## Tool Security & Authorization

Tools support built-in authorization checks and execution timeouts:

```typescript
export const deleteUserTool = tool({
  name: 'deleteUser',
  description: 'Delete a user account',
  schema: object({ userId: string() }),
  permissions: ['users.delete', 'admin'],
  timeout: 5000, // 5 second timeout
  execute: async ({ userId }) => {
    await User.delete(userId);
    return { success: true };
  },
});
```

---

## Human Approval for Sensitive Actions

Tools can require explicit human confirmation before execution:

```typescript
export const refundPaymentTool = tool({
  name: 'refundPayment',
  description: 'Issue a monetary refund to a customer',
  schema: object({
    chargeId: string(),
    amount: number(),
  }),
  requiresApproval: true,
  execute: async ({ chargeId, amount }) => {
    return await StripeService.refund(chargeId, amount);
  },
});
```
