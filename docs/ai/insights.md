# AI Insights: Usage, Cost, Latency, Calls

One line records every agent run (HTTP, WebSocket, `agent.run()` anywhere) and every voice call:

```typescript
import { createApp } from 'jsango';
import { db } from './database.js'; // your DatabaseManager

const app = createApp();
const insights = app.aiInsights({
  store: db, // PostgreSQL, MySQL or SQLite; omit for in-memory
  prices: {
    'gpt-4o-mini': { input: 0.15, output: 0.6 }, // USD per 1M tokens
    deepgram: { perMinute: 0.0043 }, // USD per audio minute
    'openai-tts': { perMinute: 0.015 },
  },
});
```

Tables `ai_runs`, `ai_calls` and `ai_turns` are created on first use.

## What Is Recorded

| Record                        | Fields                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **run** (each `agent.run()`)  | agent, provider, model, channel (`text` / `voice`), user, tenant, status, input/output tokens, cost, duration, tool calls, error                                   |
| **call** (each voice session) | agent, mode (`pipeline` / `realtime`), providers, user, tenant, duration, turns, interruptions, tokens, cost, caller/agent audio time, average first-audio latency |
| **turn** (each voice reply)   | status (`completed` / `interrupted`), speech-to-text ms, LLM first-token ms, first-audio ms, tokens                                                                |

**Privacy by default.** Prompts, answers and call transcripts are **not** stored. Turn them on
with `captureContent: true`, for example while debugging, and say so in your privacy policy.
Records older than `retentionDays` (default 30) are deleted automatically.

**Cost** comes only from your `prices`, looked up by `provider:model`, then model, then
provider or adapter name (`deepgram`, `openai-tts`, `elevenlabs`, `cartesia`, `openai-stt`,
`openai-realtime`, `gemini-live`, or the `name` you gave `stt()`/`tts()`). Without a price, cost
is left empty. It is never guessed.

## Querying (custom dashboards)

```typescript
await insights.summary({ from: new Date(Date.now() - 7 * 86_400_000) });
// { runs, failedRuns, tokens: { input, output, total }, costUsd, calls, callMinutes,
//   interruptions, latency: { firstAudioP50, firstAudioP95, llmP50 }, byModel, byAgent }

await insights.series({ bucket: 'day' }); // { labels, runs, tokens, calls, costUsd } for charts
await insights.runs({ status: 'failed', limit: 20 }); // recent errors
await insights.calls({ userId: 'u1' }); // a user's calls
await insights.call(callId); // one call: turns (`timeline`) and transcript
```

Expose them through your own routes (with auth), e.g.
`app.get('/api/ai/summary', auth.required(), () => insights.summary())`.

## Prometheus

```typescript
import { MetricRegistry } from 'jsango';

const metrics = new MetricRegistry();
app.aiInsights({ store: db, metrics });
app.get(
  '/metrics',
  () =>
    new HttpResponse(metrics.toPrometheus(), {
      headers: { 'content-type': 'text/plain; version=0.0.4' },
    })
);
```

Metrics: `ai_runs_total{agent,status}`, `ai_tokens_total{model,direction}`,
`ai_cost_usd_total{model}`, `ai_run_duration_seconds{agent}`, `voice_active_calls`,
`voice_first_audio_seconds`, `voice_interruptions_total`.

## Your Own Sink

`observeAi(listener)` receives every record (run, call.started, turn, call.ended), including
content, so you can send them to a data warehouse, a log pipeline or an analytics tool:

```typescript
import { observeAi } from 'jsango';

const stop = observeAi((record) => {
  if (record.type === 'run' && record.status === 'failed') alertSlack(record.error);
});
```

## Limits

- Aggregation runs over the rows in the requested range. That is fine for dashboards over
  days or weeks; for millions of rows per query, query the tables with SQL directly.
- MongoDB is not supported as an insights store yet (memory and SQL are).
- In-memory records are lost on restart and capped at 10,000 rows per table.
