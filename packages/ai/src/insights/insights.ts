import type { MetricRegistry } from '@jsango/observability';
import type { MemoryDatabase } from '../memory/memory.js';
import type { LlmUsage } from '../types.js';
import { observeAi, type AiRecord } from './events.js';
import { MemoryInsightsStore, SqlInsightsStore, type InsightsStore, type Row } from './store.js';

/**
 * USD prices, looked up by `provider:model`, then model, then provider / adapter name:
 * `{ 'gpt-4o-mini': { input: 0.15, output: 0.6 }, deepgram: { perMinute: 0.0043 } }`.
 * `input` / `output` are per 1M tokens; `perMinute` is per minute of audio (speech-to-text: caller
 * audio, text-to-speech: agent audio). Without a price, cost is left empty (never guessed).
 */
export type Prices = Record<string, { input?: number; output?: number; perMinute?: number }>;

export interface InsightsOptions {
  /** Your DatabaseManager (SQL), or any InsightsStore. Default: in-memory (last 10,000 rows). */
  store?: MemoryDatabase | InsightsStore | undefined;
  prices?: Prices | undefined;
  /** Store prompts, answers and call transcripts. Default `false`: only numbers are stored. */
  captureContent?: boolean | undefined;
  /** Delete records older than this. Default 30 days. */
  retentionDays?: number | undefined;
  /** Also update these Prometheus metrics (`MetricRegistry` from jsango). */
  metrics?: MetricRegistry | undefined;
  /** Called when a record can't be stored. Default: a process warning (shown on stderr). */
  onError?: ((err: unknown) => void) | undefined;
}

export interface TimeRange {
  /** Default: 24 hours ago. */
  from?: Date | undefined;
  /** Exclusive. Default: now. */
  to?: Date | undefined;
}

export interface InsightsSummary {
  runs: number;
  failedRuns: number;
  tokens: { input: number; output: number; total: number };
  /** `null` when no prices were given. */
  costUsd: number | null;
  calls: number;
  callMinutes: number;
  interruptions: number;
  /** Voice latency percentiles (ms) from the end of the user's speech. */
  latency: { firstAudioP50: number | null; firstAudioP95: number | null; llmP50: number | null };
  byModel: Array<{ model: string; runs: number; tokens: number; costUsd: number | null }>;
  byAgent: Array<{ agent: string; runs: number; tokens: number; failed: number }>;
}

interface ActiveCall {
  providers: Record<string, string>;
  turns: number;
  interruptions: number;
  input: number;
  output: number;
  costMicros: number;
  priced: boolean;
  firstAudio: number[];
}

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const clip = (s: string | undefined, n = 1000) => (s && s.length > n ? s.slice(0, n) : (s ?? null));

/**
 * Records every agent run and voice call in this process, with cost and latency, and answers
 * the questions a dashboard asks. One per process: `createInsights({ store: db })`.
 */
export class Insights {
  public readonly store: InsightsStore;
  private readonly options: InsightsOptions;
  private readonly unsubscribe: () => void;
  private readonly cleanup: ReturnType<typeof setInterval>;
  private readonly active = new Map<string, ActiveCall>();
  private chain: Promise<void> = Promise.resolve();
  private readonly m?: ReturnType<typeof metricSet> | undefined;

  constructor(options: InsightsOptions = {}) {
    this.options = options;
    const s = options.store;
    this.store = !s ? new MemoryInsightsStore() : 'insert' in s ? s : new SqlInsightsStore(s);
    this.m = options.metrics ? metricSet(options.metrics) : undefined;
    this.unsubscribe = observeAi((record) => this.record(record));
    const days = options.retentionDays ?? 30;
    this.write(() => this.prune(days));
    this.cleanup = setInterval(() => this.write(() => this.prune(days)), DAY / 4);
    this.cleanup.unref?.();
  }

  /** Stops recording (the store keeps its data). */
  public stop(): void {
    this.unsubscribe();
    clearInterval(this.cleanup);
  }

  /** Resolves when every record so far has been written. */
  public flush(): Promise<void> {
    return this.chain;
  }

  private write(fn: () => Promise<void>): void {
    const onError =
      this.options.onError ??
      ((err: unknown) =>
        process.emitWarning(
          `AI insights could not store a record: ${err instanceof Error ? err.message : String(err)}`
        ));
    this.chain = this.chain.then(fn).catch(onError);
  }

  private async prune(days: number): Promise<void> {
    const before = iso(Date.now() - days * DAY);
    for (const table of ['runs', 'calls', 'turns'] as const)
      await this.store.deleteBefore(table, before);
  }

  private price(...keys: Array<string | undefined>) {
    const prices = this.options.prices ?? {};
    for (const k of keys) if (k && prices[k]) return prices[k];
    return undefined;
  }

  /** Cost of tokens in micro-dollars, or undefined without a price. */
  private tokenCost(usage: Partial<LlmUsage> | undefined, ...keys: Array<string | undefined>) {
    const p = this.price(...keys);
    if (!p || !usage) return undefined;
    return Math.round(
      (usage.promptTokens ?? 0) * (p.input ?? 0) + (usage.completionTokens ?? 0) * (p.output ?? 0)
    ); // per-1M price x tokens = micro-dollars
  }

  private record(r: AiRecord): void {
    const content = this.options.captureContent === true;
    const m = this.m;
    switch (r.type) {
      case 'run': {
        const cost = this.tokenCost(
          r.usage,
          r.model && `${r.provider}:${r.model}`,
          r.model,
          r.provider
        );
        const call = r.callId ? this.active.get(r.callId) : undefined;
        if (call) {
          call.input += r.usage.promptTokens;
          call.output += r.usage.completionTokens;
          if (cost !== undefined) {
            call.costMicros += cost;
            call.priced = true;
          }
        }
        const model = r.model ?? r.provider;
        m?.runs.inc(1, { agent: r.agent, status: r.status });
        m?.tokens.inc(r.usage.promptTokens, { model, direction: 'input' });
        m?.tokens.inc(r.usage.completionTokens, { model, direction: 'output' });
        if (cost !== undefined) m?.cost.inc(cost / 1e6, { model });
        m?.duration.observe(r.durationMs / 1000, { agent: r.agent });
        return this.write(() =>
          this.store.insert('runs', {
            id: r.id,
            at: iso(r.at),
            agent: r.agent,
            provider: r.provider,
            model: r.model ?? null,
            channel: r.channel,
            call_id: r.callId ?? null,
            user_id: r.userId ?? null,
            tenant_id: r.tenantId ?? null,
            status: r.status,
            input_tokens: r.usage.promptTokens,
            output_tokens: r.usage.completionTokens,
            total_tokens: r.usage.totalTokens,
            cost_micros: cost ?? null,
            duration_ms: r.durationMs,
            tool_calls: r.toolCalls,
            error: clip(r.error),
            input: content ? r.input : null,
            output: content ? r.output : null,
          })
        );
      }
      case 'call.started':
        this.active.set(r.id, {
          providers: r.providers,
          turns: 0,
          interruptions: 0,
          input: 0,
          output: 0,
          costMicros: 0,
          priced: false,
          firstAudio: [],
        });
        m?.activeCalls.inc();
        return this.write(() =>
          this.store.insert('calls', {
            id: r.id,
            started_at: iso(r.at),
            agent: r.agent,
            mode: r.mode,
            providers: JSON.stringify(r.providers),
            user_id: r.userId ?? null,
            tenant_id: r.tenantId ?? null,
            status: 'active',
          })
        );
      case 'turn': {
        const call = this.active.get(r.callId);
        if (call) {
          call.turns++;
          if (r.status === 'interrupted' || r.status === 'cancelled') call.interruptions++;
          if (r.latency.firstAudioMs !== undefined) call.firstAudio.push(r.latency.firstAudioMs);
          if (r.usage) {
            // speech-to-speech: the provider's own tokens
            call.input += r.usage.promptTokens ?? 0;
            call.output += r.usage.completionTokens ?? 0;
            const cost = this.tokenCost(r.usage, call.providers['realtime']);
            if (cost !== undefined) {
              call.costMicros += cost;
              call.priced = true;
            }
          }
        }
        if (r.status === 'interrupted' || r.status === 'cancelled') m?.interruptions.inc();
        if (r.latency.firstAudioMs !== undefined)
          m?.firstAudio.observe(r.latency.firstAudioMs / 1000);
        return this.write(() =>
          this.store.insert('turns', {
            id: `${r.callId}:${r.at}:${Math.random().toString(36).slice(2, 7)}`,
            call_id: r.callId,
            at: iso(r.at),
            status: r.status,
            stt_ms: r.latency.sttMs ?? null,
            llm_ms: r.latency.llmMs ?? null,
            first_audio_ms: r.latency.firstAudioMs ?? null,
            total_tokens: r.usage?.totalTokens ?? null,
          })
        );
      }
      case 'call.ended': {
        const call = this.active.get(r.id);
        this.active.delete(r.id);
        m?.activeCalls.dec();
        let cost = call?.priced ? call.costMicros : undefined;
        for (const [kind, ms] of [
          ['stt', r.audioInMs],
          ['tts', r.audioOutMs],
        ] as const) {
          const perMinute = this.price(call?.providers[kind])?.perMinute;
          if (perMinute !== undefined)
            cost = (cost ?? 0) + Math.round((ms / 60_000) * perMinute * 1e6);
        }
        const fa = call?.firstAudio ?? [];
        return this.write(() =>
          this.store.update('calls', r.id, {
            ended_at: iso(r.at),
            status: 'ended',
            reason: clip(r.reason),
            duration_ms: r.durationMs,
            turns: call?.turns ?? 0,
            interruptions: call?.interruptions ?? 0,
            input_tokens: call?.input ?? 0,
            output_tokens: call?.output ?? 0,
            cost_micros: cost ?? null,
            audio_in_ms: r.audioInMs,
            audio_out_ms: r.audioOutMs,
            first_audio_ms: fa.length
              ? Math.round(fa.reduce((a, b) => a + b, 0) / fa.length)
              : null,
            transcript: content ? JSON.stringify(r.transcript) : null,
          })
        );
      }
    }
  }

  // --- queries (what dashboards and admin widgets use) ---------------------------------------

  private range(r: TimeRange = {}) {
    // the end is exclusive: a default of "now" must still include records stamped this instant
    const to = r.to ?? new Date(Date.now() + 1000);
    const from = r.from ?? new Date(to.getTime() - DAY);
    return { since: from.toISOString(), until: to.toISOString() };
  }

  // ponytail: aggregates in JS over the range's rows; move to SQL GROUP BY past ~1M rows per range.
  public async summary(range?: TimeRange): Promise<InsightsSummary> {
    await this.flush();
    const q = this.range(range);
    const [runs, calls, turns] = await Promise.all([
      this.store.select('runs', q),
      this.store.select('calls', q),
      this.store.select('turns', q),
    ]);
    const n = (v: unknown) => Number(v ?? 0);
    const priced =
      runs.some((r) => r['cost_micros'] !== null) || calls.some((c) => c['cost_micros'] !== null);
    // A call's cost includes its LLM runs (pipeline) or the provider's tokens (realtime), so
    // voice runs are counted through their call, not twice.
    const costMicros =
      runs.reduce((s, r) => s + (r['channel'] === 'voice' ? 0 : n(r['cost_micros'])), 0) +
      calls.reduce((s, c) => s + n(c['cost_micros']), 0);
    // Tokens: every LLM run, plus speech-to-speech calls (which have no runs).
    const realtime = calls.filter((c) => c['mode'] === 'realtime');
    const input =
      runs.reduce((s, r) => s + n(r['input_tokens']), 0) +
      realtime.reduce((s, c) => s + n(c['input_tokens']), 0);
    const output =
      runs.reduce((s, r) => s + n(r['output_tokens']), 0) +
      realtime.reduce((s, c) => s + n(c['output_tokens']), 0);
    const byKey = (key: 'model' | 'agent') => {
      const map = new Map<string, Row[]>();
      for (const r of runs) {
        const k = String(r[key] ?? r['provider'] ?? 'unknown');
        map.set(k, [...(map.get(k) ?? []), r]);
      }
      return [...map];
    };
    const first = turns
      .map((t) => t['first_audio_ms'])
      .filter((v): v is number => typeof v === 'number');
    const llm = turns.map((t) => t['llm_ms']).filter((v): v is number => typeof v === 'number');
    return {
      runs: runs.length,
      failedRuns: runs.filter((r) => r['status'] === 'failed').length,
      tokens: { input, output, total: input + output },
      // pipeline speech cost is in calls, its LLM cost in runs; realtime cost only in calls
      costUsd: priced ? costMicros / 1e6 : null,
      calls: calls.length,
      callMinutes:
        Math.round((calls.reduce((s, c) => s + n(c['duration_ms']), 0) / 60_000) * 10) / 10,
      interruptions: calls.reduce((s, c) => s + n(c['interruptions']), 0),
      latency: {
        firstAudioP50: percentile(first, 50),
        firstAudioP95: percentile(first, 95),
        llmP50: percentile(llm, 50),
      },
      byModel: byKey('model').map(([model, rows]) => ({
        model,
        runs: rows.length,
        tokens: rows.reduce((s, r) => s + n(r['total_tokens']), 0),
        costUsd: rows.some((r) => r['cost_micros'] !== null)
          ? rows.reduce((s, r) => s + n(r['cost_micros']), 0) / 1e6
          : null,
      })),
      byAgent: byKey('agent').map(([agent, rows]) => ({
        agent,
        runs: rows.length,
        tokens: rows.reduce((s, r) => s + n(r['total_tokens']), 0),
        failed: rows.filter((r) => r['status'] === 'failed').length,
      })),
    };
  }

  /** Counts per hour or day, for charts. */
  public async series(range?: TimeRange & { bucket?: 'hour' | 'day' | undefined }): Promise<{
    labels: string[];
    runs: number[];
    tokens: number[];
    calls: number[];
    costUsd: number[];
  }> {
    await this.flush();
    const q = this.range(range);
    const size = range?.bucket === 'day' ? DAY : DAY / 24;
    const start = Math.floor(Date.parse(q.since) / size) * size;
    const count = Math.max(1, Math.ceil((Date.parse(q.until) - start) / size));
    const out = {
      labels: Array.from({ length: count }, (_, i) => iso(start + i * size)),
      runs: new Array<number>(count).fill(0),
      tokens: new Array<number>(count).fill(0),
      calls: new Array<number>(count).fill(0),
      costUsd: new Array<number>(count).fill(0),
    };
    const slot = (at: unknown) =>
      Math.min(count - 1, Math.floor((Date.parse(String(at)) - start) / size));
    for (const r of await this.store.select('runs', q)) {
      const i = slot(r['at']);
      out.runs[i]!++;
      out.tokens[i]! += Number(r['total_tokens'] ?? 0);
      if (r['channel'] !== 'voice') out.costUsd[i]! += Number(r['cost_micros'] ?? 0) / 1e6;
    }
    for (const c of await this.store.select('calls', q)) {
      const i = slot(c['started_at']);
      out.calls[i]!++;
      out.costUsd[i]! += Number(c['cost_micros'] ?? 0) / 1e6;
    }
    return out;
  }

  public async runs(
    options: TimeRange & { limit?: number; status?: string; userId?: string } = {}
  ) {
    await this.flush();
    const where: Row = {};
    if (options.status) where['status'] = options.status;
    if (options.userId) where['user_id'] = options.userId;
    return this.store.select('runs', { ...this.range(options), where, limit: options.limit ?? 50 });
  }

  public async calls(options: TimeRange & { limit?: number; userId?: string } = {}) {
    await this.flush();
    const where: Row = options.userId ? { user_id: options.userId } : {};
    return this.store.select('calls', {
      ...this.range(options),
      where,
      limit: options.limit ?? 50,
    });
  }

  /** One call with its turns (`timeline`) and transcript (when content capture is on). */
  public async call(
    id: string,
    range: TimeRange = { from: new Date(Date.now() - 366 * DAY) }
  ): Promise<(Record<string, unknown> & { transcript: unknown; timeline: Row[] }) | undefined> {
    await this.flush();
    const q = this.range(range);
    const [call] = await this.store.select('calls', { ...q, where: { id }, limit: 1 });
    if (!call) return undefined;
    const turns = await this.store.select('turns', { ...q, where: { call_id: id } });
    return {
      ...call,
      transcript: call['transcript'] ? JSON.parse(String(call['transcript'])) : null,
      timeline: turns.reverse(),
    };
  }
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

function metricSet(registry: MetricRegistry) {
  return {
    runs: registry.counter('ai_runs_total', 'Agent runs', ['agent', 'status']),
    tokens: registry.counter('ai_tokens_total', 'LLM tokens', ['model', 'direction']),
    cost: registry.counter('ai_cost_usd_total', 'Estimated LLM cost in USD (from your prices)', [
      'model',
    ]),
    duration: registry.histogram('ai_run_duration_seconds', 'Agent run duration', undefined, [
      'agent',
    ]),
    activeCalls: registry.gauge('voice_active_calls', 'Voice calls in progress'),
    firstAudio: registry.histogram(
      'voice_first_audio_seconds',
      'End of user speech to first agent audio',
      [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5]
    ),
    interruptions: registry.counter('voice_interruptions_total', 'Replies the caller talked over'),
  };
}

/** Starts recording agent runs and voice calls. `insights.stop()` to end. */
export function createInsights(options: InsightsOptions = {}): Insights {
  return new Insights(options);
}
