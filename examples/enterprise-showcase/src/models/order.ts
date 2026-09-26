import { defineModel, fields } from '@jsango/orm';

export const Order = defineModel({
  name: 'Order',
  table: 'orders',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    orderNumber: fields.string({ unique: true }),
    customerEmail: fields.string(),
    totalAmount: fields.float({ default: 0 }),
    status: fields.string({ default: 'pending' }),
    itemCount: fields.integer({ default: 1 }),
    createdAt: fields.string({ default: () => new Date().toISOString() }),
  },
});
