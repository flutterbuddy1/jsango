import { describe, it, expect } from 'vitest';
import { AdminRegistry } from '../public/registry.js';
import { AdminResource } from '../public/resource.js';
import { AdminPage } from '../public/pages.js';
import { AdminRegistrationError } from '../public/errors.js';

describe('AdminRegistry', () => {
  it('registers resources and pages, rejecting duplicate IDs', () => {
    const registry = new AdminRegistry();

    const resource1 = new AdminResource({
      id: 'products',
      modelName: 'Product',
      label: 'Product',
    });

    registry.register(resource1);
    expect(registry.hasResource('products')).toBe(true);
    expect(registry.getResource('Product')?.id).toBe('products');

    expect(() => {
      registry.register(resource1);
    }).toThrow(AdminRegistrationError);

    const page = new AdminPage({
      id: 'analytics',
      path: '/analytics',
      label: 'Analytics Dashboard',
    });

    registry.registerPage(page);
    expect(registry.getPage('analytics')?.label).toBe('Analytics Dashboard');

    expect(() => {
      registry.registerPage(page);
    }).toThrow(AdminRegistrationError);
  });

  it('unregisters resources cleanly', () => {
    const registry = new AdminRegistry();
    const resource = new AdminResource({ id: 'tags', modelName: 'Tag' });

    registry.register(resource);
    expect(registry.hasResource('tags')).toBe(true);

    const removed = registry.unregister('tags');
    expect(removed).toBe(true);
    expect(registry.hasResource('tags')).toBe(false);
  });
});
