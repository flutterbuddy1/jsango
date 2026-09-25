/**
 * Metadata-driven Form Field Renderer for @jsango/admin-ui
 */

import type { AdminFieldConfig } from '@jsango/admin-core';

export interface FieldRendererProps {
  readonly field: AdminFieldConfig;
  readonly value: unknown;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export function renderFormField(props: FieldRendererProps): string {
  const { field, value, error, disabled } = props;
  const isRequired = field.required === true;
  const isReadonly = field.readonly === true || disabled === true;
  const fieldId = `field_${field.name}`;

  let inputControlHtml = '';

  if (field.type === 'textarea') {
    inputControlHtml = `
      <textarea
        id="${fieldId}"
        name="${escapeHtml(field.name)}"
        rows="4"
        ${isReadonly ? 'readonly' : ''}
        ${isRequired ? 'required' : ''}
        class="admin-textarea w-full bg-card border ${error ? 'border-rose-500 ring-1 ring-rose-500' : 'border-border'} rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition"
        placeholder="${escapeHtml(field.description ?? '')}"
      >${value !== undefined && value !== null ? escapeHtml(String(value)) : ''}</textarea>
    `;
  } else if (field.type === 'boolean') {
    const isChecked = value === true || value === 'true';
    inputControlHtml = `
      <div class="flex items-center space-x-2 pt-1">
        <input
          type="checkbox"
          id="${fieldId}"
          name="${escapeHtml(field.name)}"
          ${isChecked ? 'checked' : ''}
          ${isReadonly ? 'disabled' : ''}
          class="admin-checkbox rounded border-border text-primary focus:ring-primary h-4 w-4"
        />
        <label for="${fieldId}" class="text-xs text-muted-foreground">Enable / Active</label>
      </div>
    `;
  } else if (field.type === 'enum' && field.enumChoices) {
    const optionsHtml = field.enumChoices
      .map(
        (c) =>
          `<option value="${escapeHtml(String(c.value))}" ${String(value) === String(c.value) ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
      )
      .join('\n');

    inputControlHtml = `
      <select
        id="${fieldId}"
        name="${escapeHtml(field.name)}"
        ${isReadonly ? 'disabled' : ''}
        ${isRequired ? 'required' : ''}
        class="admin-select w-full bg-card border ${error ? 'border-rose-500 ring-1 ring-rose-500' : 'border-border'} rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition"
      >
        <option value="">Select option...</option>
        ${optionsHtml}
      </select>
    `;
  } else if (field.type === 'json') {
    let jsonStr = '';
    if (value !== undefined && value !== null) {
      jsonStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }
    inputControlHtml = `
      <textarea
        id="${fieldId}"
        name="${escapeHtml(field.name)}"
        rows="5"
        ${isReadonly ? 'readonly' : ''}
        class="admin-json-input font-mono w-full bg-card border ${error ? 'border-rose-500 ring-1 ring-rose-500' : 'border-border'} rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition"
        placeholder="{}"
      >${escapeHtml(jsonStr)}</textarea>
    `;
  } else {
    // Default text, number, date, datetime, password, email, url
    let inputType = 'text';
    if (field.type === 'number') inputType = 'number';
    if (field.type === 'date') inputType = 'date';
    if (field.type === 'datetime') inputType = 'datetime-local';
    if (field.type === 'password' || field.sensitive) inputType = 'password';
    if (field.type === 'email') inputType = 'email';
    if (field.type === 'url') inputType = 'url';

    inputControlHtml = `
      <input
        type="${inputType}"
        id="${fieldId}"
        name="${escapeHtml(field.name)}"
        value="${value !== undefined && value !== null ? escapeHtml(String(value)) : ''}"
        ${isReadonly ? 'readonly' : ''}
        ${isRequired ? 'required' : ''}
        placeholder="${escapeHtml(field.description ?? '')}"
        class="admin-input w-full bg-card border ${error ? 'border-rose-500 ring-1 ring-rose-500' : 'border-border'} rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition"
      />
    `;
  }

  return `
    <div class="admin-form-field mb-4">
      <div class="flex items-center justify-between mb-1.5">
        <label for="${fieldId}" class="block text-xs font-semibold text-foreground/90">
          ${escapeHtml(field.label ?? field.name)}
          ${isRequired ? '<span class="text-rose-500 ml-0.5">*</span>' : ''}
        </label>
        ${field.description ? `<span class="text-[11px] text-muted-foreground">${escapeHtml(field.description)}</span>` : ''}
      </div>
      ${inputControlHtml}
      ${error ? `<div class="admin-field-error text-xs text-rose-500 font-medium mt-1">${escapeHtml(error)}</div>` : ''}
    </div>
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
