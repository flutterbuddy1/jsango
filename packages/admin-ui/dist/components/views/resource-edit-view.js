/**
 * Resource Edit View for @jsango/admin-ui
 */
import { renderPageHeader } from '../layout/breadcrumbs.js';
import { renderResourceForm } from '../forms/resource-form.js';
import { formatRecordTitle } from '../../formatters/index.js';
export function renderResourceEditView(props) {
    const { schema, item, fieldErrors, isSubmitting, generalError } = props;
    const pkVal = item[schema.primaryKey];
    const title = formatRecordTitle(item, schema.primaryKey);
    const headerHtml = renderPageHeader({
        title: `Edit ${schema.label}: ${title}`,
        subtitle: `Update fields for record #${pkVal}`,
        breadcrumbs: [
            { label: 'Admin', href: '/admin' },
            { label: schema.pluralLabel, href: `/admin/resources/${schema.id}` },
            { label: String(title), href: `/admin/resources/${schema.id}/${pkVal}` },
            { label: 'Edit', active: true },
        ],
    });
    const formHtml = renderResourceForm({
        schema,
        mode: 'edit',
        initialData: item,
        fieldErrors,
        isSubmitting,
        generalError,
    });
    return `
    ${headerHtml}
    ${formHtml}
  `.trim();
}
//# sourceMappingURL=resource-edit-view.js.map