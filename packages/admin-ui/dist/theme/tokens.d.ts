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
export declare const LIGHT_THEME_TOKENS: ColorTokens;
export declare const DARK_THEME_TOKENS: ColorTokens;
export declare const SPACING_TOKENS: {
    readonly xs: "4px";
    readonly sm: "8px";
    readonly md: "16px";
    readonly lg: "24px";
    readonly xl: "32px";
    readonly xxl: "48px";
};
export declare const RADIUS_TOKENS: {
    readonly sm: "4px";
    readonly md: "6px";
    readonly lg: "8px";
    readonly full: "9999px";
};
//# sourceMappingURL=tokens.d.ts.map