import { defineModel, fields } from '@jsango/orm';

export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    email: fields.string({ unique: true }),
    name: fields.string(),
    role: fields.string({ default: 'customer' }),
    isStaff: fields.boolean({ default: false }),
    isActive: fields.boolean({ default: true }),
    createdAt: fields.string({ default: () => new Date().toISOString() }),
  },
});
