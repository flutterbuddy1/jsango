/**
 * Breadcrumbs and Page Header layout components
 */
import type { BreadcrumbItem } from '../../types/index.js';
export declare function renderBreadcrumbs(items: readonly BreadcrumbItem[]): string;
export interface PageHeaderProps {
    readonly title: string;
    readonly subtitle?: string | undefined;
    readonly breadcrumbs?: readonly BreadcrumbItem[] | undefined;
    readonly actionsHtml?: string | undefined;
}
export declare function renderPageHeader(props: PageHeaderProps): string;
//# sourceMappingURL=breadcrumbs.d.ts.map