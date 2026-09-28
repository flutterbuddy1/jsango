/**
 * Command Palette (Cmd+K / Ctrl+K) for fast navigation and actions.
 */
import type { AdminResourceSummary } from '../../types/index.js';
export interface CommandItem {
    readonly id: string;
    readonly title: string;
    readonly subtitle?: string | undefined;
    readonly group: 'Navigation' | 'Resources' | 'System' | 'Theme';
    readonly icon?: string | undefined;
    readonly shortcut?: string | undefined;
    readonly onSelect: () => void;
}
export declare function buildDefaultCommands(options: {
    readonly resources: readonly AdminResourceSummary[];
    readonly onNavigate: (route: string) => void;
    readonly onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
}): readonly CommandItem[];
export declare function renderCommandPalette(items: readonly CommandItem[], searchQuery?: string): string;
//# sourceMappingURL=command-palette.d.ts.map