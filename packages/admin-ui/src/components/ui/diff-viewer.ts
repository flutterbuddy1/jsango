/**
 * Diff Viewer component for displaying before/after changes in audit logs.
 */

export interface DiffEntry {
  readonly key: string;
  readonly type: 'added' | 'modified' | 'removed' | 'unchanged';
  readonly oldValue?: unknown | undefined;
  readonly newValue?: unknown | undefined;
}

export function computeObjectDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): readonly DiffEntry[] {
  const b = before ?? {};
  const a = after ?? {};

  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const entries: DiffEntry[] = [];

  for (const key of allKeys) {
    const hasBefore = Object.prototype.hasOwnProperty.call(b, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(a, key);

    if (hasBefore && !hasAfter) {
      entries.push({ key, type: 'removed', oldValue: b[key] });
    } else if (!hasBefore && hasAfter) {
      entries.push({ key, type: 'added', newValue: a[key] });
    } else {
      const bVal = JSON.stringify(b[key]);
      const aVal = JSON.stringify(a[key]);
      if (bVal !== aVal) {
        entries.push({ key, type: 'modified', oldValue: b[key], newValue: a[key] });
      } else {
        entries.push({ key, type: 'unchanged', oldValue: b[key], newValue: a[key] });
      }
    }
  }

  return entries;
}

export function renderDiffViewer(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): string {
  const diffs = computeObjectDiff(before, after);

  if (diffs.length === 0) {
    return '<div class="admin-diff-empty text-xs text-muted-foreground p-3 text-center">No property changes recorded.</div>';
  }

  const rows = diffs.map((d) => {
    let statusBadge = '';
    let valDisplay = '';

    if (d.type === 'added') {
      statusBadge =
        '<span class="px-1.5 py-0.5 text-xs font-mono rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">+ Added</span>';
      valDisplay = `<span class="text-emerald-600 dark:text-emerald-400 font-mono text-xs">${escapeHtml(formatVal(d.newValue))}</span>`;
    } else if (d.type === 'removed') {
      statusBadge =
        '<span class="px-1.5 py-0.5 text-xs font-mono rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">- Removed</span>';
      valDisplay = `<span class="text-rose-600 dark:text-rose-400 font-mono text-xs line-through">${escapeHtml(formatVal(d.oldValue))}</span>`;
    } else if (d.type === 'modified') {
      statusBadge =
        '<span class="px-1.5 py-0.5 text-xs font-mono rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">~ Modified</span>';
      valDisplay = `
        <span class="text-rose-500 font-mono text-xs line-through mr-2">${escapeHtml(formatVal(d.oldValue))}</span>
        <span class="text-muted-foreground text-xs">→</span>
        <span class="text-emerald-500 font-mono text-xs ml-2">${escapeHtml(formatVal(d.newValue))}</span>
      `;
    } else {
      statusBadge =
        '<span class="px-1.5 py-0.5 text-xs font-mono rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Unchanged</span>';
      valDisplay = `<span class="text-muted-foreground font-mono text-xs">${escapeHtml(formatVal(d.newValue))}</span>`;
    }

    return `
      <tr class="border-b border-border/50 text-sm">
        <td class="p-2 font-mono text-xs font-semibold text-foreground/90">${escapeHtml(d.key)}</td>
        <td class="p-2">${statusBadge}</td>
        <td class="p-2">${valDisplay}</td>
      </tr>
    `;
  });

  return `
    <div class="admin-diff-viewer rounded-lg border border-border overflow-hidden bg-card">
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <th class="p-2 font-medium">Field</th>
            <th class="p-2 font-medium">Change</th>
            <th class="p-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('\n')}
        </tbody>
      </table>
    </div>
  `.trim();
}

function formatVal(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
