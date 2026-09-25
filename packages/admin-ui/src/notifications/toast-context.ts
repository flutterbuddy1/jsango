import type { ToastMessage } from '../types/index.js';

export type ToastListener = (toasts: readonly ToastMessage[]) => void;

export class ToastManager {
  private toasts: ToastMessage[] = [];
  private readonly listeners = new Set<ToastListener>();
  private nextId = 1;

  public getToasts(): readonly ToastMessage[] {
    return this.toasts;
  }

  public show(toast: Omit<ToastMessage, 'id'>): string {
    const id = `toast-${this.nextId++}-${Date.now()}`;
    const durationMs = toast.durationMs ?? 4000;
    const item: ToastMessage = {
      ...toast,
      id,
      durationMs,
    };

    this.toasts = [...this.toasts, item];
    this.notify();

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }

    return id;
  }

  public success(title: string, message?: string): string {
    return this.show({ type: 'success', title, message });
  }

  public error(title: string, message?: string): string {
    return this.show({ type: 'error', title, message, durationMs: 6000 });
  }

  public warning(title: string, message?: string): string {
    return this.show({ type: 'warning', title, message });
  }

  public info(title: string, message?: string): string {
    return this.show({ type: 'info', title, message });
  }

  public dismiss(id: string): void {
    const next = this.toasts.filter((t) => t.id !== id);
    if (next.length !== this.toasts.length) {
      this.toasts = next;
      this.notify();
    }
  }

  public clear(): void {
    if (this.toasts.length > 0) {
      this.toasts = [];
      this.notify();
    }
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.toasts);
      } catch {
        // Safe notification
      }
    }
  }
}
