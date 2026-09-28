/**
 * Diff Viewer component for displaying before/after changes in audit logs.
 */
export interface DiffEntry {
    readonly key: string;
    readonly type: 'added' | 'modified' | 'removed' | 'unchanged';
    readonly oldValue?: unknown | undefined;
    readonly newValue?: unknown | undefined;
}
export declare function computeObjectDiff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): readonly DiffEntry[];
export declare function renderDiffViewer(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): string;
//# sourceMappingURL=diff-viewer.d.ts.map