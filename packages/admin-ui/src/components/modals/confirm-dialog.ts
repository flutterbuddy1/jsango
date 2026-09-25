/**
 * Modal & Confirmation dialog helpers for @jsango/admin-ui
 */

export interface ConfirmDialogOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string | undefined;
  readonly cancelLabel?: string | undefined;
  readonly variant?: 'destructive' | 'primary' | undefined;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel?: (() => void) | undefined;
}

export function renderConfirmDialog(options: ConfirmDialogOptions): string {
  const isDestructive = options.variant === 'destructive';
  const confirmBtnClass = isDestructive
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return `
    <div class="admin-modal-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div class="admin-modal-content bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
        <div class="p-6">
          <h3 class="text-lg font-semibold text-foreground mb-2">${escapeHtml(options.title)}</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(options.message)}</p>
        </div>
        <div class="bg-muted/40 px-6 py-4 flex items-center justify-end space-x-3 border-t border-border">
          <button
            type="button"
            class="admin-modal-cancel px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition"
          >
            ${escapeHtml(options.cancelLabel ?? 'Cancel')}
          </button>
          <button
            type="button"
            class="admin-modal-confirm px-4 py-2 text-sm font-medium rounded-lg ${confirmBtnClass} transition"
          >
            ${escapeHtml(options.confirmLabel ?? (isDestructive ? 'Delete' : 'Confirm'))}
          </button>
        </div>
      </div>
    </div>
  `.trim();
}

export interface DeleteConfirmOptions {
  readonly resourceLabel: string;
  readonly recordId?: string | number | undefined;
  readonly count?: number | undefined;
  readonly isPermanent?: boolean | undefined;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel?: (() => void) | undefined;
}

export function renderDeleteConfirmModal(options: DeleteConfirmOptions): string {
  const isBulk = options.count !== undefined && options.count > 1;
  const targetDesc = isBulk
    ? `${options.count} selected ${options.resourceLabel.toLowerCase()} items`
    : `${options.resourceLabel} #${options.recordId}`;

  const title = options.isPermanent
    ? `Permanently Delete ${isBulk ? 'Items' : options.resourceLabel}?`
    : `Delete ${isBulk ? 'Items' : options.resourceLabel}?`;

  const message = options.isPermanent
    ? `Are you sure you want to permanently delete ${targetDesc}? This action cannot be undone.`
    : `Are you sure you want to delete ${targetDesc}?`;

  return renderConfirmDialog({
    title,
    message,
    confirmLabel: options.isPermanent ? 'Delete Permanently' : 'Delete',
    variant: 'destructive',
    onConfirm: options.onConfirm,
    onCancel: options.onCancel,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
