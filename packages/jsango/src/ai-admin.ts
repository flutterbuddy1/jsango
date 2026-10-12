import {
  ActivityWidget,
  AdminPage,
  ChartWidget,
  MetricWidget,
  TableWidget,
  audioCell,
  detailsCell,
  type DashboardWidget,
  type MetricValue,
} from '@jsango/admin-core';
import type { IMediaStorage } from '@jsango/admin-media';
import type { Insights, InsightsSummary, VoiceOptions } from '@jsango/ai';

/** Saves call recordings to admin media storage (local disk, S3, R2, ...). */
export function recordTo(
  storage: IMediaStorage,
  prefix = 'ai-calls'
): NonNullable<VoiceOptions['record']> {
  return async ({ callId, wav }) => {
    const file = await storage.store({
      content: wav,
      originalName: `${callId}.wav`,
      mimeType: 'audio/wav',
      prefix,
    });
    return file.url;
  };
}

export interface AiWidgetOptions {
  /** Who may see AI data. Default `ai.insights.view` (superusers always can). */
  permission?: string | undefined;
}

const HOUR = 3_600_000;
const money = (usd: number) => (usd >= 1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`);
const minutes = (ms: unknown) => `${Math.round(Number(ms ?? 0) / 600) / 100} min`;

/**
 * Admin dashboard widgets for AI usage: put them on the dashboard or a page.
 *
 *   app.admin({ dashboard: aiWidgets(insights) })      // or: pages: [aiAdminPage(insights)]
 */
export function aiWidgets(insights: Insights, options: AiWidgetOptions = {}): DashboardWidget[] {
  const permission = options.permission ?? 'ai.insights.view';
  // Several metric widgets read the same summary: compute it once per few seconds.
  let cached: { at: number; value: Promise<[InsightsSummary, InsightsSummary]> } | undefined;
  const summaries = () => {
    if (!cached || Date.now() - cached.at > 5000) {
      const now = Date.now();
      cached = {
        at: now,
        value: Promise.all([
          insights.summary({ from: new Date(now - 24 * HOUR), to: new Date(now + 1000) }),
          insights.summary({ from: new Date(now - 48 * HOUR), to: new Date(now - 24 * HOUR) }),
        ]),
      };
    }
    return cached.value;
  };
  const compare = (now: number, before: number, hint: string): MetricValue => {
    const change = before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : undefined;
    return {
      value: now,
      change,
      trend: change === undefined || change === 0 ? 'neutral' : change > 0 ? 'up' : 'down',
      hint,
    };
  };
  const common = { permission, refreshIntervalSeconds: 60 };

  return [
    new MetricWidget({
      ...common,
      id: 'ai-runs',
      title: 'AI runs',
      getValue: async () => {
        const [s, p] = await summaries();
        return compare(s.runs, p.runs, 'last 24 h');
      },
    }),
    new MetricWidget({
      ...common,
      id: 'ai-cost',
      title: 'AI cost',
      getValue: async () => {
        const [s, p] = await summaries();
        if (s.costUsd === null) return { value: '—', hint: 'add prices to aiInsights()' };
        const before = p.costUsd ?? 0;
        const change =
          before > 0 ? Math.round(((s.costUsd - before) / before) * 1000) / 10 : undefined;
        return { value: money(s.costUsd), change, hint: 'last 24 h' };
      },
    }),
    new MetricWidget({
      ...common,
      id: 'ai-tokens',
      title: 'Tokens',
      getValue: async () => {
        const [s, p] = await summaries();
        return compare(
          s.tokens.total,
          p.tokens.total,
          `${s.tokens.input} in · ${s.tokens.output} out`
        );
      },
    }),
    new MetricWidget({
      ...common,
      id: 'ai-voice-calls',
      title: 'Voice calls',
      getValue: async () => {
        const [s, p] = await summaries();
        return compare(s.calls, p.calls, `${s.callMinutes} min · ${s.interruptions} interruptions`);
      },
    }),
    new MetricWidget({
      ...common,
      id: 'ai-first-audio',
      title: 'Voice latency (p95)',
      getValue: async () => {
        const [s] = await summaries();
        const { firstAudioP95: p95, firstAudioP50: p50 } = s.latency;
        return p95 === null
          ? { value: '—', hint: 'no calls yet' }
          : { value: `${p95} ms`, hint: `median ${p50} ms` };
      },
    }),
    new MetricWidget({
      ...common,
      id: 'ai-failed-runs',
      title: 'Failed runs',
      getValue: async () => {
        const [s, p] = await summaries();
        return compare(s.failedRuns, p.failedRuns, 'last 24 h');
      },
    }),
    new ChartWidget({
      ...common,
      id: 'ai-usage-chart',
      title: 'AI usage, last 7 days',
      getChartData: async () => {
        const s = await insights.series({
          from: new Date(Date.now() - 7 * 24 * HOUR),
          bucket: 'day',
        });
        return {
          labels: s.labels.map((l) => l.slice(5, 10)),
          datasets: [
            { label: 'Runs', data: s.runs },
            { label: 'Voice calls', data: s.calls },
          ],
        };
      },
    }),
    new ChartWidget({
      ...common,
      id: 'ai-cost-chart',
      title: 'Cost per day (USD)',
      chartType: 'bar',
      getChartData: async () => {
        const s = await insights.series({
          from: new Date(Date.now() - 7 * 24 * HOUR),
          bucket: 'day',
        });
        return {
          labels: s.labels.map((l) => l.slice(5, 10)),
          datasets: [{ label: 'USD', data: s.costUsd.map((c) => Math.round(c * 10_000) / 10_000) }],
        };
      },
    }),
    new TableWidget({
      ...common,
      id: 'ai-recent-calls',
      title: 'Recent voice calls',
      width: 'full',
      getTableData: async () => {
        const calls = await insights.calls({
          from: new Date(Date.now() - 7 * 24 * HOUR),
          limit: 20,
        });
        return {
          headers: [
            'Started',
            'Agent',
            'Mode',
            'Duration',
            'Turns',
            'Interrupted',
            'First audio',
            'Cost',
            'Transcript',
            'Recording',
          ],
          rows: calls.map((c) => {
            const transcript = c['transcript']
              ? (JSON.parse(String(c['transcript'])) as Array<{ role: string; text: string }>)
                  .map((t) => `${t.role === 'user' ? 'Caller' : 'Agent'}: ${t.text}`)
                  .join('\n')
              : null;
            return [
              String(c['started_at']).replace('T', ' ').slice(0, 19),
              c['agent'],
              c['mode'],
              c['status'] === 'active' ? 'in progress' : minutes(c['duration_ms']),
              c['turns'] ?? 0,
              c['interruptions'] ?? 0,
              c['first_audio_ms'] === null ? null : `${c['first_audio_ms']} ms`,
              c['cost_micros'] === null ? null : money(Number(c['cost_micros']) / 1e6),
              transcript ? detailsCell(`${transcript.split('\n').length} lines`, transcript) : null,
              c['recording_url'] ? audioCell(String(c['recording_url'])) : null,
            ];
          }),
        };
      },
    }),
    new TableWidget({
      ...common,
      id: 'ai-models',
      title: 'Usage by model (24 h)',
      getTableData: async () => {
        const [s] = await summaries();
        return {
          headers: ['Model', 'Runs', 'Tokens', 'Cost'],
          rows: s.byModel
            .sort((a, b) => b.tokens - a.tokens)
            .map((m) => [m.model, m.runs, m.tokens, m.costUsd === null ? null : money(m.costUsd)]),
        };
      },
    }),
    new ActivityWidget({
      ...common,
      id: 'ai-errors',
      title: 'Recent AI errors',
      getActivity: async () =>
        (
          await insights.runs({
            status: 'failed',
            from: new Date(Date.now() - 7 * 24 * HOUR),
            limit: 10,
          })
        ).map((r) => ({
          id: String(r['id']),
          title: `${r['agent']}: ${r['error'] ?? 'failed'}`,
          subtitle: String(r['model'] ?? r['provider'] ?? ''),
          timestamp: Date.parse(String(r['at'])),
        })),
    }),
  ];
}

/** An "AI Usage" admin page with every AI widget. */
export function aiAdminPage(insights: Insights, options: AiWidgetOptions = {}): AdminPage {
  return new AdminPage({
    id: 'ai',
    path: '/ai',
    label: 'AI Usage',
    description: 'Agent runs, voice calls, cost and latency',
    navigationIcon: 'chart',
    permission: options.permission ?? 'ai.insights.view',
    widgets: aiWidgets(insights, options),
  });
}
