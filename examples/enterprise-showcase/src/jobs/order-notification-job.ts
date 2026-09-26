import type { JobContext } from '@jsango/queue';
import type { OrderCreatedPayload } from '../events/order-created-event.js';

export const ORDER_NOTIFICATION_JOB_TYPE = 'email.order-confirmation';

export async function handleOrderNotificationJob(
  ctx: JobContext<OrderCreatedPayload>
): Promise<{ sent: boolean; recipient: string; orderNumber: string }> {
  const { payload, logger } = ctx;

  logger.info(
    `[Background Job] Processing order confirmation email for ${payload.customerEmail} (Order #${payload.orderNumber}, Total: $${payload.totalAmount})`
  );

  // Simulate transactional email dispatch with progress reporting
  if (ctx.progress) {
    await ctx.progress(50, 'Contacting transactional mail gateway');
  }

  // Simulated processing delay
  await new Promise((resolve) => setTimeout(resolve, 10));

  if (ctx.progress) {
    await ctx.progress(100, 'Confirmation email dispatched');
  }

  return {
    sent: true,
    recipient: payload.customerEmail,
    orderNumber: payload.orderNumber,
  };
}
