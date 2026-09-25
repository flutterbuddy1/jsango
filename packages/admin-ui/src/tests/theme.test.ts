import { describe, it, expect, vi } from 'vitest';
import { ThemeManager } from '../theme/theme-context.js';
import { LIGHT_THEME_TOKENS, DARK_THEME_TOKENS } from '../theme/tokens.js';

describe('ThemeManager', () => {
  it('manages theme modes and token resolutions', () => {
    const theme = new ThemeManager('light');
    expect(theme.getMode()).toBe('light');
    expect(theme.getResolvedTheme()).toBe('light');
    expect(theme.getState().tokens.background).toBe(LIGHT_THEME_TOKENS.background);

    theme.setMode('dark');
    expect(theme.getMode()).toBe('dark');
    expect(theme.getResolvedTheme()).toBe('dark');
    expect(theme.getState().tokens.background).toBe(DARK_THEME_TOKENS.background);
  });

  it('notifies subscribers on theme change', () => {
    const theme = new ThemeManager('light');
    const listener = vi.fn();
    const unsubscribe = theme.subscribe(listener);

    theme.setMode('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dark', resolvedTheme: 'dark' })
    );

    unsubscribe();
    theme.setMode('light');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
