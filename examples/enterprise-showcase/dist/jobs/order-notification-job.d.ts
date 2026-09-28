import type { JobContext } from '@jsango/queue';
import type { OrderCreatedPayload } from '../events/order-created-event.js';
export declare const ORDER_NOTIFICATION_JOB_TYPE = "email.order-confirmation";
export declare function handleOrderNotificationJob(ctx: JobContext<OrderCreatedPayload>): Promise<{
    sent: boolean;
    recipient: string;
    orderNumber: string;
}>;
//# sourceMappingURL=order-notification-job.d.ts.map