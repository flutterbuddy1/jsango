import { describe, it, expect } from 'vitest';
import { AdminResource } from '../public/resource.js';

describe('AdminResource', () => {
  it('creates an AdminResource with custom configuration and schema generation', () => {
    const resource = new AdminResource({
      id: 'articles',
      modelName: 'Article',
      label: 'Article',
      pluralLabel: 'Articles',
      navigationGroup: 'Content',
      fields: [
        { name: 'id', type: 'number', primaryKey: true, readonly: true },
        { name: 'title', type: 'text', required: true, searchable: true, sortable: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'isPublished', type: 'boolean', filterable: true },
      ],
      actions: [{ id: 'publish', label: 'Publish Article', requiresConfirmation: true }],
      bulkActions: [{ id: 'bulkDelete', label: 'Delete Selected', requiresConfirmation: true }],
    });

    expect(resource.id).toBe('articles');
    expect(resource.label).toBe('Article');
    expect(resource.pluralLabel).toBe('Articles');
    expect(resource.navigationGroup).toBe('Content');
    expect(resource.fields.size).toBe(4);
    expect(resource.actions.has('publish')).toBe(true);
    expect(resource.bulkActions.has('bulkDelete')).toBe(true);

    const schema = resource.getSchema();
    expect(schema.id).toBe('articles');
    expect(schema.fields).toHaveLength(4);
    expect(schema.actions[0]?.id).toBe('publish');
    expect(schema.bulkActions[0]?.id).toBe('bulkDelete');
  });
});
