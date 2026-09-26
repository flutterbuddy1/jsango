import { defineModel, fields } from '@jsango/orm';

export const Page = defineModel({
  name: 'Page',
  table: 'pages',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    title: fields.string(),
    description: fields.string({ default: '' }),
    content: fields.string({ default: '' }),
    createdAt: fields.string({ default: () => new Date().toISOString() }),
    updatedAt: fields.string({ default: () => new Date().toISOString() }),
  },
});
