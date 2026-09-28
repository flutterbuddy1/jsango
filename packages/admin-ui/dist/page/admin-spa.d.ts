/**
 * Chakra UI v3 Admin Single-Page App (SPA) Engine
 * React-Powered, 100% Mobile-Friendly, Enterprise-Grade Django Admin equivalent.
 * @package @jsango/admin-ui
 */
import { HttpResponse, type RequestContext } from '@jsango/http';
export interface AdminSpaOptions {
    /**
     * Browser page title and header branding title.
     * @default 'JSango Administration'
     */
    readonly title?: string | undefined;
    /**
     * Base REST API prefix where @jsango/admin-server is mounted.
     * @default '/api/admin'
     */
    readonly apiPrefix?: string | undefined;
    /**
     * Base API path where resources and admin endpoints live.
     * @default '/admin/api/v1'
     */
    readonly apiBasePath?: string | undefined;
    /**
     * Default theme mode ('light', 'dark', or 'system').
     * @default 'dark'
     */
    readonly defaultTheme?: 'light' | 'dark' | 'system' | undefined;
    /**
     * Subtitle displayed under the brand title.
     * @default 'Enterprise Admin Control'
     */
    readonly brandSubtitle?: string | undefined;
    /**
     * Link to the public site/store.
     * @default '/'
     */
    readonly siteUrl?: string | undefined;
    /**
     * Custom CSS styles to inject into the head.
     */
    readonly customCss?: string | undefined;
    /**
     * Enable ⌘K / Ctrl+K quick command palette navigation.
     * @default true
     */
    readonly enableCommandPalette?: boolean | undefined;
    /**
     * Enable 2FA / TOTP Authenticator security center.
     * @default true
     */
    readonly enableTwoFactor?: boolean | undefined;
}
/**
 * Generates the complete, self-contained Chakra UI v3 Admin SPA HTML shell.
 */
export declare function renderAdminSpaHtml(options?: AdminSpaOptions): string;
/**
 * Creates an HTTP route handler for mounting the React Chakra UI Admin Single-Page App.
 */
export declare function createAdminUiHandler(options?: AdminSpaOptions): (ctx: RequestContext) => HttpResponse;
//# sourceMappingURL=admin-spa.d.ts.map