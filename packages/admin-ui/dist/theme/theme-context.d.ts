import type { ColorTokens } from './tokens.js';
import type { ThemeMode } from '../types/index.js';
export interface ThemeState {
    readonly mode: ThemeMode;
    readonly resolvedTheme: 'light' | 'dark';
    readonly tokens: ColorTokens;
}
export type ThemeListener = (state: ThemeState) => void;
export declare class ThemeManager {
    private currentMode;
    private readonly listeners;
    constructor(defaultMode?: ThemeMode);
    getMode(): ThemeMode;
    getResolvedTheme(): 'light' | 'dark';
    setMode(mode: ThemeMode): void;
    subscribe(listener: ThemeListener): () => void;
    getState(): ThemeState;
    private notify;
}
//# sourceMappingURL=theme-context.d.ts.map