/**
 * Metadata-driven Resource Form Component
 */

import type { AdminResourceSchema, AdminFieldConfig } from '@jsango/admin-core';
import { renderFormField } from './field-renderer.js';

export interface ResourceFormProps {
  readonly schema: AdminResourceSchema;
  readonly mode: 'create' | 'edit';
  readonly initialData?: Record<string, unknown> | undefined;
  readonly fieldErrors?: Record<string, string> | undefined;
  readonly isSubmitting?: boolean | undefined;
  readonly generalError?: string | undefined;
}

export function renderResourceForm(props: ResourceFormProps): string {
  const {
    schema,
    mode,
    initialData = {},
    fieldErrors = {},
    isSubmitting = false,
    generalError,
  } = props;

  const fieldNames =
    mode === 'create'
      ? schema.createFields.length > 0
        ? schema.createFields
        : schema.fields.filter((f) => f.name !== schema.primaryKey).map((f) => f.name)
      : schema.editFields.length > 0
        ? schema.editFields
        : schema.fields.filter((f) => f.name !== schema.primaryKey).map((f) => f.name);

  const fieldMap = new Map<string, AdminFieldConfig>(schema.fields.map((f) => [f.name, f]));
  const fields = fieldNames.map((name) => fieldMap.get(name) ?? { name, label: name });

  const fieldsHtml = fields
    .map((field) => {
      return renderFormField({
        field,
        value: initialData[field.name],
        error: fieldErrors[field.name],
        disabled: isSubmitting,
      });
    })
    .join('\n');

  return `
    <form class="admin-resource-form max-w-3xl bg-card border border-border rounded-xl p-6 shadow-sm" method="POST">
      ${
        generalError
          ? `
        <div class="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 text-xs">
          <div class="font-semibold mb-1">Failed to save ${escapeHtml(schema.label.toLowerCase())}</div>
          <div>${escapeHtml(generalError)}</div>
        </div>
      `
          : ''
      }

      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        ${fieldsHtml}
      </div>

      <div class="mt-8 pt-6 border-t border-border flex items-center justify-between">
        <a
          href="/admin/resources/${schema.id}"
          class="admin-form-cancel px-4 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition"
        >
          Cancel
        </a>

        <div class="flex items-center space-x-3">
          <button
            type="submit"
            class="admin-form-submit px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition flex items-center space-x-1.5"
            ${isSubmitting ? 'disabled' : ''}
          >
            ${isSubmitting ? '<span class="admin-spinner animate-spin">⟳</span>' : ''}
            <span>${mode === 'create' ? `Create ${escapeHtml(schema.label)}` : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </form>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
