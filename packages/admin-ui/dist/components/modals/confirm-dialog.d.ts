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
export declare function renderConfirmDialog(options: ConfirmDialogOptions): string;
export interface DeleteConfirmOptions {
    readonly resourceLabel: string;
    readonly recordId?: string | number | undefined;
    readonly count?: number | undefined;
    readonly isPermanent?: boolean | undefined;
    readonly onConfirm: () => void | Promise<void>;
    readonly onCancel?: (() => void) | undefined;
}
export declare function renderDeleteConfirmModal(options: DeleteConfirmOptions): string;
//# sourceMappingURL=confirm-dialog.d.ts.map