import { AdminResource } from '../resource.js';
import { AdminRegistry } from '../registry.js';
export function createFakeAdminResource(options = {}) {
    return new AdminResource({
        id: options.id ?? 'posts',
        modelName: options.modelName ?? 'Post',
        label: options.label ?? 'Post',
        pluralLabel: options.pluralLabel ?? 'Posts',
        fields: options.fields ?? [
            { name: 'id', type: 'number', required: true, readonly: true, sortable: true },
            { name: 'title', type: 'text', required: true, searchable: true, sortable: true },
            { name: 'content', type: 'textarea' },
            {
                name: 'status',
                type: 'enum',
                filterable: true,
                enumChoices: [
                    { label: 'Draft', value: 'draft' },
                    { label: 'Published', value: 'published' },
                ],
            },
            { name: 'createdAt', type: 'datetime', readonly: true, sortable: true },
        ],
        searchFields: options.searchFields ?? ['title'],
        ...options,
    });
}
export class FakeAdminRegistry extends AdminRegistry {
}
//# sourceMappingURL=fake.js.map