/**
 * Formatted JSON Viewer component with syntax highlighting
 */

export function renderJsonViewer(value: unknown): string {
  let formatted: string;
  try {
    formatted =
      typeof value === 'string'
        ? JSON.stringify(JSON.parse(value), null, 2)
        : JSON.stringify(value, null, 2);
  } catch {
    formatted = String(value);
  }

  const escaped = formatted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div class="admin-json-viewer relative group">
      <pre class="bg-slate-900 text-slate-100 dark:bg-slate-950 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-border/40 leading-relaxed max-h-80"><code>${escaped}</code></pre>
      <button
        type="button"
        class="admin-copy-btn absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        data-copy="${encodeURIComponent(formatted)}"
      >
        Copy
      </button>
    </div>
  `.trim();
}
