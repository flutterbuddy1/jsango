import { AdminResource } from '@jsango/admin-core';

export const PageResource = new AdminResource({
  id: 'pages',

  modelName: 'Page',

  label: 'Page',

  pluralLabel: 'Pages',

  navigationGroup: 'Content Management',

  navigationIcon: 'file-text',

  navigationOrder: 1,

  primaryKey: 'id',

  fields: [
    {
      name: 'id',
      type: 'uuid',
      readonly: true,
    },

    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
      searchable: true,
    },

    {
      name: 'description',
      type: 'textarea',
      required: false,
      label: 'Description',
      searchable: true,
    },

    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: 'Content',
    },

    {
      name: 'createdAt',
      type: 'datetime',
      readonly: true,
      label: 'Created At',
    },

    {
      name: 'updatedAt',
      type: 'datetime',
      readonly: true,
      label: 'Updated At',
    },
  ],

  listFields: ['id', 'title', 'description', 'createdAt', 'updatedAt'],

  searchFields: ['title', 'description', 'content'],

  defaultSortField: 'createdAt',

  defaultSortDirection: 'desc',
});
