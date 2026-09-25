/**
 * Resource Create View for @jsango/admin-ui
 */

import type { AdminResourceSchema } from '@jsango/admin-core';
import { renderPageHeader } from '../layout/breadcrumbs.js';
import { renderResourceForm } from '../forms/resource-form.js';

export interface ResourceCreateViewProps {
  readonly schema: AdminResourceSchema;
  readonly initialData?: Record<string, unknown> | undefined;
  readonly fieldErrors?: Record<string, string> | undefined;
  readonly isSubmitting?: boolean | undefined;
  readonly generalError?: string | undefined;
}

export function renderResourceCreateView(props: ResourceCreateViewProps): string {
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
