export class ThemeManager {
    currentMode;
    listeners = new Set();
    constructor(defaultMode = 'system') {
        this.currentMode = defaultMode;
    }
    getMode() {
        return this.currentMode;
    }
    getResolvedTheme() {
        if (this.currentMode === 'system') {
            if (typeof window !== 'undefined' && window.matchMedia) {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return 'light';
        }
        return this.currentMode;
    }
    setMode(mode) {
        this.currentMode = mode;
        this.notify();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    getState() {
        const resolvedTheme = this.getResolvedTheme();
        // import dynamically or through constant
        return {
            mode: this.currentMode,
            resolvedTheme,
            tokens: resolvedTheme === 'dark' ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS,
        };
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            try {
                listener(state);
            }
            catch {
                // Safe listener execution
            }
        }
    }
}
import { LIGHT_THEME_TOKENS, DARK_THEME_TOKENS } from './tokens.js';
//# sourceMappingURL=theme-context.js.map