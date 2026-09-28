/**
 * Formatting utilities for @jsango/admin-ui
 */
export declare function formatDate(value: string | number | Date | null | undefined, locale?: string): string;
export declare function formatDateTime(value: string | number | Date | null | undefined, locale?: string): string;
export declare function formatRelativeTime(value: string | number | Date | null | undefined): string;
export declare function formatNumber(value: number | null | undefined, locale?: string): string;
export declare function formatCurrency(value: number | null | undefined, currency?: string, locale?: string): string;
export declare function formatPercent(value: number | null | undefined, locale?: string): string;
export declare function formatBytes(bytes: number | null | undefined): string;
export declare function truncateText(text: string | null | undefined, maxLength?: number): string;
export declare function formatRecordTitle(record: Record<string, unknown> | null | undefined, primaryKey?: string): string;
//# sourceMappingURL=index.d.ts.map