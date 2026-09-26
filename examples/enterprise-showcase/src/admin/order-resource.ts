import { AdminResource } from '@jsango/admin-core';

export const OrderResource = new AdminResource({
  id: 'orders',
  modelName: 'Order',
  label: 'Customer Order',
  pluralLabel: 'Customer Orders',
  navigationGroup: 'Sales & Fulfillment',
  navigationIcon: 'shopping-cart',
  navigationOrder: 3,
  primaryKey: 'id',
  fields: [
    { name: 'id', type: 'uuid', readonly: true },
    { name: 'orderNumber', type: 'text', required: true, label: 'Order #', searchable: true },
    {
      name: 'customerEmail',
      type: 'email',
      required: true,
      label: 'Customer Email',
      searchable: true,
    },
    { name: 'totalAmount', type: 'number', required: true, label: 'Total ($)' },
    {
      name: 'status',
      type: 'enum',
      required: true,
      enumChoices: [
        { label: 'Pending Payment', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'itemCount', type: 'number', label: 'Item Qty' },
    { name: 'createdAt', type: 'datetime', readonly: true, label: 'Order Date' },
  ],
  listFields: [
    'id',
    'orderNumber',
    'customerEmail',
    'totalAmount',
    'status',
    'itemCount',
    'createdAt',
  ],
  searchFields: ['orderNumber', 'customerEmail'],
  filters: [{ name: 'status', type: 'enum', field: 'status' }],
  bulkActions: [
    {
      id: 'mark-paid',
      label: 'Mark as Paid',
    },
    {
      id: 'mark-shipped',
      label: 'Mark as Shipped',
    },
  ],
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
});
