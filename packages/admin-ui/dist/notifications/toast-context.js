export class ToastManager {
    toasts = [];
    listeners = new Set();
    nextId = 1;
    getToasts() {
        return this.toasts;
    }
    show(toast) {
        const id = `toast-${this.nextId++}-${Date.now()}`;
        const durationMs = toast.durationMs ?? 4000;
        const item = {
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
    success(title, message) {
        return this.show({ type: 'success', title, message });
    }
    error(title, message) {
        return this.show({ type: 'error', title, message, durationMs: 6000 });
    }
    warning(title, message) {
        return this.show({ type: 'warning', title, message });
    }
    info(title, message) {
        return this.show({ type: 'info', title, message });
    }
    dismiss(id) {
        const next = this.toasts.filter((t) => t.id !== id);
        if (next.length !== this.toasts.length) {
            this.toasts = next;
            this.notify();
        }
    }
    clear() {
        if (this.toasts.length > 0) {
            this.toasts = [];
            this.notify();
        }
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    notify() {
        for (const listener of this.listeners) {
            try {
                listener(this.toasts);
            }
            catch {
                // Safe notification
            }
        }
    }
}
//# sourceMappingURL=toast-context.js.map