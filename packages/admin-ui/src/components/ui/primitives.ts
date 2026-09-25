/**
 * UI Component Primitives for @jsango/admin-ui
 */

export interface ButtonProps {
  readonly label?: string | undefined;
  readonly variant?:
    'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | undefined;
  readonly size?: 'sm' | 'md' | 'lg' | 'icon' | undefined;
  readonly icon?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly loading?: boolean | undefined;
  readonly type?: 'button' | 'submit' | 'reset' | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly ariaLabel?: string | undefined;
}

export function renderButton(props: ButtonProps): string {
  const variant = props.variant ?? 'secondary';
  const size = props.size ?? 'md';
  const disabled = props.disabled || props.loading;

  return `
    <button
      type="${props.type ?? 'button'}"
      class="admin-btn admin-btn-${variant} admin-btn-${size} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}"
      ${disabled ? 'disabled' : ''}
      ${props.ariaLabel ? `aria-label="${props.ariaLabel}"` : ''}
    >
      ${props.loading ? '<span class="admin-spinner animate-spin mr-1.5">⟳</span>' : ''}
      ${props.icon ? `<span class="admin-btn-icon mr-1.5">${props.icon}</span>` : ''}
      ${props.label ? `<span>${props.label}</span>` : ''}
    </button>
  `.trim();
}

export interface BadgeProps {
  readonly label: string | number;
  readonly variant?:
    'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | undefined;
  readonly size?: 'sm' | 'md' | undefined;
}

export function renderBadge(props: BadgeProps): string {
  const variant = props.variant ?? 'default';
  const size = props.size ?? 'md';

  return `
    <span class="admin-badge admin-badge-${variant} admin-badge-${size}">
      ${props.label}
    </span>
  `.trim();
}

export interface InputProps {
  readonly id?: string | undefined;
  readonly name: string;
  readonly type?: string | undefined;
  readonly value?: string | number | undefined;
  readonly placeholder?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly readonly?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly error?: string | undefined;
}

export function renderInput(props: InputProps): string {
  return `
    <input
      id="${props.id ?? props.name}"
      name="${props.name}"
      type="${props.type ?? 'text'}"
      value="${props.value !== undefined ? String(props.value) : ''}"
      placeholder="${props.placeholder ?? ''}"
      ${props.disabled ? 'disabled' : ''}
      ${props.readonly ? 'readonly' : ''}
      ${props.required ? 'required' : ''}
      class="admin-input ${props.error ? 'admin-input-error' : ''}"
    />
    ${props.error ? `<div class="admin-field-error text-xs text-red-500 mt-1">${props.error}</div>` : ''}
  `.trim();
}

export interface AlertProps {
  readonly type: 'info' | 'success' | 'warning' | 'error';
  readonly title?: string | undefined;
  readonly message: string;
}

export function renderAlert(props: AlertProps): string {
  return `
    <div class="admin-alert admin-alert-${props.type} p-4 rounded-md border text-sm" role="alert">
      ${props.title ? `<div class="font-semibold mb-1">${props.title}</div>` : ''}
      <div>${props.message}</div>
    </div>
  `.trim();
}

export interface SkeletonProps {
  readonly type?: 'line' | 'card' | 'table' | 'avatar' | undefined;
  readonly count?: number | undefined;
}

export function renderSkeleton(props: SkeletonProps): string {
  const count = props.count ?? 1;
  const items: string[] = [];

  for (let i = 0; i < count; i++) {
    if (props.type === 'card') {
      items.push(
        '<div class="admin-skeleton admin-skeleton-card h-32 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse"></div>'
      );
    } else if (props.type === 'avatar') {
      items.push(
        '<div class="admin-skeleton admin-skeleton-avatar h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"></div>'
      );
    } else {
      items.push(
        '<div class="admin-skeleton admin-skeleton-line h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse my-2"></div>'
      );
    }
  }

  return items.join('\n');
}
