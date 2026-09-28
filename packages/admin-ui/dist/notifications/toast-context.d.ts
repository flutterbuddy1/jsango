import type { ToastMessage } from '../types/index.js';
export type ToastListener = (toasts: readonly ToastMessage[]) => void;
export declare class ToastManager {
    private toasts;
    private readonly listeners;
    private nextId;
    getToasts(): readonly ToastMessage[];
    show(toast: Omit<ToastMessage, 'id'>): string;
    success(title: string, message?: string): string;
    error(title: string, message?: string): string;
    warning(title: string, message?: string): string;
    info(title: string, message?: string): string;
    dismiss(id: string): void;
    clear(): void;
    subscribe(listener: ToastListener): () => void;
    private notify;
}
//# sourceMappingURL=toast-context.d.ts.map