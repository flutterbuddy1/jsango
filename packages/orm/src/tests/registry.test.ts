import { describe, it, expect, beforeEach } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';
import { ModelRegistry } from '../public/registry.js';
import { MetadataError } from '../public/errors.js';
import { resetTestState } from './test-utils.js';

describe('ModelRegistry', () => {
  beforeEach(() => {
    resetTestState();
  });

  it('should register and discover models and metadata', () => {
    const registry = new ModelRegistry();

    const Product = defineModel({
      name: 'Product',
      table: 'products',
      fields: {
        id: fields.integer({ primaryKey: true }),
        name: fields.string(),
      },
    });

    registry.register(Product as any);
    expect(registry.hasModel('Product')).toBe(true);
    expect(registry.getModel('Product')).toBe(Product);
    expect(registry.getAllModels().length).toBe(1);
    expect(registry.getMetadata('Product')?.table).toBe('products');
  });

  it('should prevent registering duplicate model names', () => {
    const registry = new ModelRegistry();

    const Customer1 = defineModel({
      name: 'Customer',
      table: 'customers_v1',
      fields: { id: fields.integer() },
      registry: false,
    });

    const Customer2 = defineModel({
      name: 'Customer',
      table: 'customers_v2',
      fields: { id: fields.integer() },
      registry: false,
    });

    registry.register(Customer1 as any);
    expect(() => registry.register(Customer2 as any)).toThrow(MetadataError);
  });
});
