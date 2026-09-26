import { defineModel, fields } from '@jsango/orm';

export const Product = defineModel({
  name: 'Product',
  table: 'products',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    sku: fields.string({ unique: true }),
    name: fields.string(),
    category: fields.string({ default: 'General' }),
    price: fields.float({ default: 0 }),
    stock: fields.integer({ default: 0 }),
    isActive: fields.boolean({ default: true }),
    createdAt: fields.string({ default: () => new Date().toISOString() }),
  },
});
