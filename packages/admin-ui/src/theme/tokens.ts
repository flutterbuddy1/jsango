/**
 * Theme tokens and semantic CSS variable definitions for @jsango/admin-ui.
 */
export interface ColorTokens {
  readonly background: string;
  readonly foreground: string;
  readonly card: string;
  readonly cardForeground: string;
  readonly popover: string;
  readonly popoverForeground: string;
  readonly primary: string;
  readonly primaryForeground: string;
  readonly secondary: string;
  readonly secondaryForeground: string;
  readonly muted: string;
  readonly mutedForeground: string;
  readonly accent: string;
  readonly accentForeground: string;
  readonly destructive: string;
  readonly destructiveForeground: string;
  readonly success: string;
  readonly successForeground: string;
  readonly warning: string;
  readonly warningForeground: string;
  readonly border: string;
  readonly input: string;
  readonly ring: string;
  readonly sidebarBackground: string;
  readonly sidebarForeground: string;
  readonly sidebarBorder: string;
  readonly sidebarActive: string;
}

export const LIGHT_THEME_TOKENS: ColorTokens = {
  background: '#f8fafc',
  foreground: '#0f172a',
  card: '#ffffff',
  cardForeground: '#0f172a',
  popover: '#ffffff',
  popoverForeground: '#0f172a',
  primary: '#0f172a',
  primaryForeground: '#f8fafc',
  secondary: '#f1f5f9',
  secondaryForeground: '#0f172a',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  accent: '#f1f5f9',
  accentForeground: '#0f172a',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  success: '#10b981',
  successForeground: '#ffffff',
  warning: '#f59e0b',
  warningForeground: '#ffffff',
  border: '#e2e8f0',
  input: '#e2e8f0',
  ring: '#94a3b8',
  sidebarBackground: '#ffffff',
  sidebarForeground: '#334155',
  sidebarBorder: '#e2e8f0',
  sidebarActive: '#f1f5f9',
};

export const DARK_THEME_TOKENS: ColorTokens = {
  background: '#090d16',
  foreground: '#f8fafc',
  card: '#0f172a',
  cardForeground: '#f8fafc',
  popover: '#0f172a',
  popoverForeground: '#f8fafc',
  primary: '#f8fafc',
  primaryForeground: '#0f172a',
  secondary: '#1e293b',
  secondaryForeground: '#f8fafc',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  accent: '#1e293b',
  accentForeground: '#f8fafc',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  success: '#059669',
  successForeground: '#ffffff',
  warning: '#d97706',
  warningForeground: '#ffffff',
  border: '#1e293b',
  input: '#1e293b',
  ring: '#334155',
  sidebarBackground: '#0b1120',
  sidebarForeground: '#cbd5e1',
  sidebarBorder: '#1e293b',
  sidebarActive: '#1e293b',
};

export const SPACING_TOKENS = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const RADIUS_TOKENS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  full: '9999px',
} as const;
