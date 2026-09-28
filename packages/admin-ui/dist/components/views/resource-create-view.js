/**
 * Resource Create View for @jsango/admin-ui
 */
import { renderPageHeader } from '../layout/breadcrumbs.js';
import { renderResourceForm } from '../forms/resource-form.js';
export function renderResourceCreateView(props) {
    const { schema, initialData, fieldErrors, isSubmitting, generalError } = props;
    const headerHtml = renderPageHeader({
        title: `Create ${schema.label}`,
        subtitle: `Add a new record to ${schema.pluralLabel.toLowerCase()}`,
        breadcrumbs: [
            { label: 'Admin', href: '/admin' },
            { label: schema.pluralLabel, href: `/admin/resources/${schema.id}` },
            { label: 'Create', active: true },
        ],
    });
    const formHtml = renderResourceForm({
        schema,
        mode: 'create',
        initialData,
        fieldErrors,
        isSubmitting,
        generalError,
    });
    return `
    ${headerHtml}
    ${formHtml}
  `.trim();
}
//# sourceMappingURL=resource-create-view.js.map