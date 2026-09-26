import { AdminResource } from '@jsango/admin-core';

export const ProductResource = new AdminResource({
  id: 'products',
  modelName: 'Product',
  label: 'Catalog Product',
  pluralLabel: 'Catalog Products',
  navigationGroup: 'Catalog Management',
  navigationIcon: 'box',
  navigationOrder: 2,
  primaryKey: 'id',
  fields: [
    { name: 'id', type: 'uuid', readonly: true },
    { name: 'sku', type: 'text', required: true, label: 'SKU Code', searchable: true },
    { name: 'name', type: 'text', required: true, label: 'Product Title', searchable: true },
    {
      name: 'category',
      type: 'enum',
      required: true,
      enumChoices: [
        { label: 'Electronics', value: 'Electronics' },
        { label: 'Audio', value: 'Audio' },
        { label: 'Accessories', value: 'Accessories' },
        { label: 'Wearables', value: 'Wearables' },
      ],
    },
    { name: 'price', type: 'number', required: true, label: 'Price ($)' },
    { name: 'stock', type: 'number', required: true, label: 'Stock Units' },
    { name: 'isActive', type: 'boolean', label: 'In Catalog' },
    { name: 'createdAt', type: 'datetime', readonly: true, label: 'Created At' },
  ],
  listFields: ['id', 'sku', 'name', 'category', 'price', 'stock', 'isActive'],
  searchFields: ['sku', 'name', 'category'],
  filters: [
    { name: 'category', type: 'enum', field: 'category' },
    { name: 'isActive', type: 'boolean', field: 'isActive' },
  ],
  bulkActions: [
    {
      id: 'bulk-activate',
      label: 'Activate Selected Products',
      requiresConfirmation: true,
    },
    {
      id: 'bulk-deactivate',
      label: 'Deactivate Selected Products',
      requiresConfirmation: true,
    },
  ],
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
});
