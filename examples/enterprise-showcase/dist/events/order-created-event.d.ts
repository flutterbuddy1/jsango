export interface OrderCreatedPayload {
    readonly orderId: string;
    readonly orderNumber: string;
    readonly customerEmail: string;
    readonly totalAmount: number;
    readonly itemCount: number;
    readonly createdAt: string;
}
export declare const ORDER_CREATED_EVENT = "order.created";
//# sourceMappingURL=order-created-event.d.ts.map