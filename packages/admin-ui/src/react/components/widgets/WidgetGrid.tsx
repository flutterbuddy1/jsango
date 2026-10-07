import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext.js';

export interface WidgetMeta {
  id: string;
  type: 'metric' | 'table' | 'chart' | 'activity' | 'custom';
  title: string;
  description?: string;
  width: 'full' | 'half' | 'third' | 'quarter';
  refreshIntervalSeconds?: number;
  chartType?: 'line' | 'bar';
}

const SPAN: Record<WidgetMeta['width'], number> = { full: 12, half: 6, third: 4, quarter: 3 };
const muted = 'var(--chakra-colors-fg-muted)';

/**
 * Renders the widgets served at `${basePath}` (the dashboard or a custom page). Every widget
 * loads its own data, so a slow query never blocks the rest of the page.
 */
export const WidgetGrid: React.FC<{ basePath: string; widgets: WidgetMeta[] }> = ({ basePath, widgets }) => (
  <div className="widget-grid">
    <style>{`
      .widget-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
      .widget-grid > * { min-width: 0; }
      @media (max-width: 1100px) { .widget-grid > [data-span="3"] { grid-column: span 6 !important; } .widget-grid > [data-span="4"] { grid-column: span 6 !important; } }
      @media (max-width: 720px) { .widget-grid > * { grid-column: span 12 !important; } }
    `}</style>
    {widgets.map((w) => (
      <Widget key={w.id} meta={w} url={`${basePath}/widgets/${encodeURIComponent(w.id)}`} />
    ))}
  </div>
);

const Widget: React.FC<{ meta: WidgetMeta; url: string }> = ({ meta, url }) => {
  const { fetchApi } = useAdmin();
  const [data, setData] = useState<any>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchApi<{ data: unknown }>(url);
      setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetchApi, url]);

  useEffect(() => {
    load();
    if (!meta.refreshIntervalSeconds) return undefined;
    const timer = setInterval(load, Math.max(5, meta.refreshIntervalSeconds) * 1000);
    return () => clearInterval(timer);
  }, [load, meta.refreshIntervalSeconds]);

  const span = SPAN[meta.width] ?? 6;
  return (
    <section className="chakra-card" data-span={span} style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: muted }}>{meta.title}</h3>
          {meta.description && <div style={{ fontSize: '0.75rem', color: muted }}>{meta.description}</div>}
        </div>
        <button type="button" className="chakra-button ghost" style={{ padding: 4 }} onClick={load} aria-label={`Refresh ${meta.title}`} disabled={loading}>
          <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </header>
      {error ? (
        <div style={{ fontSize: '0.8125rem', color: '#e34948' }}>{error}</div>
      ) : data === undefined ? (
        <div style={{ fontSize: '0.8125rem', color: muted }}>Loading…</div>
      ) : meta.type === 'metric' ? (
        <Metric value={data} />
      ) : meta.type === 'table' ? (
        <Table data={data} />
      ) : meta.type === 'chart' ? (
        <Chart data={data} type={meta.chartType ?? 'line'} title={meta.title} />
      ) : meta.type === 'activity' ? (
        <Activity items={data} />
      ) : (
        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', margin: 0 }}>{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
      )}
    </section>
  );
};

const formatNumber = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : String(v ?? '—'));

const Metric: React.FC<{ value: any }> = ({ value }) => {
  const v = value !== null && typeof value === 'object' ? value : { value };
  const trend = v.trend ?? (v.change > 0 ? 'up' : v.change < 0 ? 'down' : 'neutral');
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <div>
      <div style={{ fontSize: 'clamp(1.2rem, 5.5vw, 1.75rem)', fontWeight: 800, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{formatNumber(v.value)}</div>
      {(v.change !== undefined || v.hint) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: muted, marginTop: 4 }}>
          {v.change !== undefined && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--chakra-colors-fg-default)' }}>
              <Icon style={{ width: 13, height: 13 }} aria-hidden />
              {v.change > 0 ? '+' : ''}
              {v.change}%
            </span>
          )}
          {v.hint && <span>{v.hint}</span>}
        </div>
      )}
    </div>
  );
};

const Table: React.FC<{ data: { headers: string[]; rows: unknown[][] } }> = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className="chakra-table" style={{ width: '100%' }}>
      <thead>
        <tr>{data.headers.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.rows.length === 0 && (
          <tr>
            <td colSpan={data.headers.length} style={{ color: muted }}>No rows</td>
          </tr>
        )}
        {data.rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j}>{cell === null || cell === undefined ? '—' : typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Activity: React.FC<{ items: Array<{ id: string; title: string; subtitle?: string; timestamp: number }> }> = ({ items }) =>
  items.length === 0 ? (
    <div style={{ fontSize: '0.8125rem', color: muted }}>No activity yet.</div>
  ) : (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {items.map((item) => (
        <li key={item.id} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', alignItems: 'baseline' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            {item.title}
            {item.subtitle && <span style={{ color: muted }}> · {item.subtitle}</span>}
          </span>
          <time style={{ fontSize: '0.75rem', color: muted, whiteSpace: 'nowrap' }} dateTime={new Date(item.timestamp).toISOString()}>
            {relative(item.timestamp)}
          </time>
        </li>
      ))}
    </ul>
  );

function relative(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Chart: line or bar, one shared y axis, legend for 2+ series, hover tooltip.
// ---------------------------------------------------------------------------

const H = 220;
const PAD = { top: 10, right: 12, bottom: 26, left: 44 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((m) => m >= v)!;
}

const compact = (n: number) => Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

const Chart: React.FC<{ data: { labels: string[]; datasets: Array<{ label: string; data: number[] }> }; type: 'line' | 'bar'; title: string }> = ({ data, type, title }) => {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so text stays 11px at any card size.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => entry && setW(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const series = data.datasets.slice(0, 8); // 8 categorical slots; fold more into fewer series server-side
  const n = data.labels.length;
  if (n === 0 || series.length === 0) return <div style={{ fontSize: '0.8125rem', color: muted }}>No data</div>;

  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.data.map((v) => Number(v) || 0))));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / n;
  const xOf = (i: number) => PAD.left + band * i + band / 2;
  const yOf = (v: number) => PAD.top + plotH - (Math.max(0, v) / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(n / Math.max(2, Math.floor(plotW / 56)));
  const barGroup = Math.min(band * 0.7, 48);
  const barW = Math.max(2, barGroup / series.length - 2);

  return (
    <div ref={box} style={{ position: 'relative' }}>
      {series.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: muted, marginBottom: 6 }}>
          {series.map((s, i) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: `var(--viz-${i + 1})` }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
       <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={title} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--chakra-colors-border-subtle)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yOf(t) + 4} textAnchor="end" fontSize={11} fill={muted}>{compact(t)}</text>
          </g>
        ))}
        {data.labels.map((label, i) =>
          i % labelEvery === 0 ? (
            <text key={label + i} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={muted}>{label}</text>
          ) : null
        )}
        {hover !== null && <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--chakra-colors-border-emphasized)" strokeWidth={1} />}

        {type === 'bar'
          ? series.map((s, si) =>
              s.data.map((v, i) => {
                const x = xOf(i) - barGroup / 2 + si * (barW + 2);
                const y = yOf(Number(v) || 0);
                const h = PAD.top + plotH - y;
                const r = Math.min(4, barW / 2, h);
                // Rounded top, square base anchored on the baseline.
                return <path key={`${si}-${i}`} d={`M${x},${y + h}V${y + r}q0,-${r} ${r},-${r}h${barW - 2 * r}q${r},0 ${r},${r}V${y + h}Z`} fill={`var(--viz-${si + 1})`} opacity={hover === null || hover === i ? 1 : 0.55} />;
              })
            )
          : series.map((s, si) => (
              <g key={s.label}>
                <path d={s.data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(Number(v) || 0)}`).join('')} fill="none" stroke={`var(--viz-${si + 1})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && s.data[hover] !== undefined && (
                  <circle cx={xOf(hover)} cy={yOf(Number(s.data[hover]) || 0)} r={4} fill={`var(--viz-${si + 1})`} stroke="var(--chakra-colors-bg-surface)" strokeWidth={2} />
                )}
              </g>
            ))}

        {/* Hit targets: one full-height column per x value. */}
        {data.labels.map((_, i) => (
          <rect key={i} x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 0,
            left: `${(xOf(hover) / W) * 100}%`,
            transform: `translateX(${hover > n / 2 ? 'calc(-100% - 10px)' : '10px'})`,
            background: 'var(--chakra-colors-bg-surface)',
            border: '1px solid var(--chakra-colors-border-default)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{data.labels[hover]}</div>
          {series.map((s, si) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--viz-${si + 1})` }} />
              <span style={{ color: muted }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{formatNumber(s.data[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
