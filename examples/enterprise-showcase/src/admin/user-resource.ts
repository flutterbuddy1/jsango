import { AdminResource } from '@jsango/admin-core';

export const UserResource = new AdminResource({
  id: 'users',
  modelName: 'User',
  label: 'User Account',
  pluralLabel: 'User Accounts',
  navigationGroup: 'Authentication & Access',
  navigationIcon: 'users',
  navigationOrder: 1,
  primaryKey: 'id',
  fields: [
    { name: 'id', type: 'uuid', readonly: true },
    { name: 'email', type: 'email', required: true, searchable: true },
    { name: 'name', type: 'text', required: true, searchable: true },
    {
      name: 'role',
      type: 'enum',
      required: true,
      enumChoices: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Staff Member', value: 'staff' },
        { label: 'Customer', value: 'customer' },
      ],
    },
    { name: 'isStaff', type: 'boolean', label: 'Staff Status' },
    { name: 'isActive', type: 'boolean', label: 'Active' },
    { name: 'createdAt', type: 'datetime', readonly: true, label: 'Registered At' },
  ],
  listFields: ['id', 'email', 'name', 'role', 'isStaff', 'isActive', 'createdAt'],
  searchFields: ['email', 'name'],
  filters: [
    { name: 'role', type: 'enum', field: 'role' },
    { name: 'isStaff', type: 'boolean', field: 'isStaff' },
    { name: 'isActive', type: 'boolean', field: 'isActive' },
  ],
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
});
