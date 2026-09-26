export interface OrderCreatedPayload {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly customerEmail: string;
  readonly totalAmount: number;
  readonly itemCount: number;
  readonly createdAt: string;
}

export const ORDER_CREATED_EVENT = 'order.created';
