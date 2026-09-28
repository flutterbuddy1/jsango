/**
 * Top Bar Header component for @jsango/admin-ui
 */
import type { AdminUserIdentity, ThemeMode } from '../../types/index.js';
export interface TopBarProps {
    readonly user?: AdminUserIdentity | undefined;
    readonly themeMode: ThemeMode;
    readonly onOpenCommandPalette?: (() => void) | undefined;
    readonly onToggleTheme?: (() => void) | undefined;
    readonly onLogout?: (() => void) | undefined;
}
export declare function renderTopBar(props: TopBarProps): string;
//# sourceMappingURL=top-bar.d.ts.map