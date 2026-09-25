import type { ColorTokens } from './tokens.js';
import type { ThemeMode } from '../types/index.js';

export interface ThemeState {
  readonly mode: ThemeMode;
  readonly resolvedTheme: 'light' | 'dark';
  readonly tokens: ColorTokens;
}

export type ThemeListener = (state: ThemeState) => void;

export class ThemeManager {
  private currentMode: ThemeMode;
  private readonly listeners = new Set<ThemeListener>();

  constructor(defaultMode: ThemeMode = 'system') {
    this.currentMode = defaultMode;
  }

  public getMode(): ThemeMode {
    return this.currentMode;
  }

  public getResolvedTheme(): 'light' | 'dark' {
    if (this.currentMode === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    return this.currentMode;
  }

  public setMode(mode: ThemeMode): void {
    this.currentMode = mode;
    this.notify();
  }

  public subscribe(listener: ThemeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): ThemeState {
    const resolvedTheme = this.getResolvedTheme();
    // import dynamically or through constant
    return {
      mode: this.currentMode,
      resolvedTheme,
      tokens: resolvedTheme === 'dark' ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS,
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Safe listener execution
      }
    }
  }
}

import { LIGHT_THEME_TOKENS, DARK_THEME_TOKENS } from './tokens.js';
