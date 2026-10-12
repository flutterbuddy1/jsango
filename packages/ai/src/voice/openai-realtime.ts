import { WebSocket } from 'ws';
import { pcmFromBytes, pcmToBytes } from './audio.js';
import { AsyncQueue } from './queue.js';
import type { RealtimeAdapter, RealtimeConnection, RealtimeEvent } from './types.js';

export interface OpenAiRealtimeOptions {
  /** Default: `OPENAI_API_KEY`. Stays on the server. */
  apiKey?: string | undefined;
  /** Default `gpt-realtime`. */
  model?: string | undefined;
  /** `marin`, `cedar`, `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`. Default `marin`. */
  voice?: string | undefined;
  /** Transcribe the user's speech with this model, or `false`. Default `gpt-4o-mini-transcribe`. */
  transcribe?: string | false | undefined;
  /** Upstream WebSocket URL (Azure, a proxy, or a fake server in tests). */
  url?: string | undefined;
  /** REST API base for WebRTC calls. Default `https://api.openai.com/v1`. */
  apiUrl?: string | undefined;
}

/** OpenAI Realtime API (speech-to-speech) over WebSocket, PCM16 24 kHz both ways. */
type ConnectOptions = Parameters<RealtimeAdapter['connect']>[0];

/** OpenAI Realtime API (speech-to-speech) over WebSocket, PCM16 24 kHz both ways; or WebRTC. */
export function openaiRealtime(options: OpenAiRealtimeOptions = {}): RealtimeAdapter {
  const key = () => {
    const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    return apiKey;
  };
  const model = options.model ?? 'gpt-realtime';
  const api = options.apiUrl ?? 'https://api.openai.com/v1';

  /** The session settings, shared by WebSocket and WebRTC (where audio is Opus, not PCM). */
  const session = ({ instructions, tools, history }: ConnectOptions, pcm: boolean) => {
    // Earlier turns go into the instructions as plain text: cheap, and works for any history.
    const past = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    return {
      type: 'realtime',
      instructions: past ? `${instructions}\n\nConversation so far:\n${past}` : instructions,
      audio: {
        input: {
          ...(pcm ? { format: { type: 'audio/pcm', rate: 24000 } } : {}),
          turn_detection: { type: 'semantic_vad' },
          ...(options.transcribe === false
            ? {}
            : { transcription: { model: options.transcribe ?? 'gpt-4o-mini-transcribe' } }),
        },
        output: {
          ...(pcm ? { format: { type: 'audio/pcm', rate: 24000 } } : {}),
          voice: options.voice ?? 'marin',
        },
      },
      tools: tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.inputSchema ?? { type: 'object', properties: {} },
      })),
      tool_choice: 'auto',
    };
  };

  /** Opens the control WebSocket, configures the session and translates its events. */
  const attach = async (
    url: string,
    config: Record<string, unknown>,
    signal: AbortSignal,
    onClose?: () => Promise<void>
  ): Promise<RealtimeConnection> => {
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${key()}` } });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
      ws.once('unexpected-response', (_req, res) =>
        reject(new Error(`OpenAI Realtime refused the connection (HTTP ${res.statusCode})`))
      );
    });
    signal.addEventListener('abort', () => ws.close(), { once: true });

    const send = (event: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
    };
    const events = new AsyncQueue<RealtimeEvent>();
    let lastItem: string | undefined;
    let ready = false;
    send({ type: 'session.update', session: config });

    ws.on('message', (raw) => {
      let e: any;
      try {
        e = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (e.type) {
        case 'session.updated':
          if (!ready) events.push({ type: 'ready' });
          ready = true;
          return;
        case 'response.created':
          return events.push({ type: 'response.started', responseId: e.response?.id });
        case 'response.output_audio.delta':
          lastItem = e.item_id;
          return events.push({
            type: 'audio',
            responseId: e.response_id,
            itemId: e.item_id,
            pcm: pcmFromBytes(Buffer.from(e.delta, 'base64')),
          });
        case 'response.output_audio_transcript.delta':
          return events.push({
            type: 'transcript.delta',
            responseId: e.response_id,
            text: e.delta,
          });
        case 'response.output_audio_transcript.done':
          return events.push({
            type: 'transcript',
            role: 'assistant',
            text: e.transcript,
            responseId: e.response_id,
          });
        case 'conversation.item.input_audio_transcription.completed':
          return events.push({ type: 'transcript', role: 'user', text: e.transcript });
        case 'input_audio_buffer.speech_started':
          return events.push({ type: 'speech.started' });
        case 'input_audio_buffer.speech_stopped':
          return events.push({ type: 'speech.stopped' });
        case 'response.done': {
          const r = e.response ?? {};
          for (const o of r.output ?? []) {
            if (o.type === 'function_call')
              events.push({
                type: 'tool.call',
                responseId: r.id,
                callId: o.call_id,
                name: o.name,
                arguments: o.arguments ?? '',
              });
          }
          const u = r.usage;
          return events.push({
            type: 'response.done',
            responseId: r.id,
            status: r.status,
            usage: u && {
              promptTokens: u.input_tokens,
              completionTokens: u.output_tokens,
              totalTokens: u.total_tokens,
              audioInput: u.input_token_details?.audio_tokens,
              audioOutput: u.output_token_details?.audio_tokens,
            },
          });
        }
        case 'error':
          // e.g. cancelling a reply that already finished: harmless, reported, not fatal
          return events.push({
            type: 'error',
            error: e.error?.message ?? 'OpenAI Realtime error',
          });
      }
    });
    ws.on('error', (err) => events.push({ type: 'error', error: err.message, fatal: true }));
    ws.on('close', () => events.end());

    return {
      events,
      sendAudio: (pcm) =>
        send({ type: 'input_audio_buffer.append', audio: pcmToBytes(pcm).toString('base64') }),
      sendText: (text) => {
        send({
          type: 'conversation.item.create',
          item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
        });
        send({ type: 'response.create' });
      },
      interrupt: (responseId, heardMs) => {
        if (responseId) send({ type: 'response.cancel' });
        // The model should only remember what the user actually heard.
        if (lastItem && heardMs !== undefined)
          send({
            type: 'conversation.item.truncate',
            item_id: lastItem,
            content_index: 0,
            audio_end_ms: Math.floor(heardMs),
          });
        lastItem = undefined;
      },
      toolResult: (callId, output) =>
        send({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
        }),
      respond: () => send({ type: 'response.create' }),
      close: () => {
        void onClose?.().catch(() => undefined);
        ws.close();
      },
    };
  };

  return {
    name: 'openai-realtime',
    inputRate: 24000,
    outputRate: 24000,
    connect: (o) =>
      attach(
        options.url ?? `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        session(o, true),
        o.signal
      ),

    // WebRTC: the browser's audio goes straight to OpenAI (lowest latency, Opus, echo
    // cancellation); this server creates the call with its own key and keeps control of it
    // (tools, transcripts, usage) over a sideband WebSocket. The key never reaches the browser.
    async webrtc(offer, o) {
      const form = new FormData();
      form.set('sdp', offer);
      form.set('session', JSON.stringify({ ...session(o, false), model }));
      const res = await fetch(`${api}/realtime/calls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key()}` },
        body: form,
        signal: o.signal,
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`OpenAI refused the WebRTC call (${res.status}): ${detail}`);
      }
      const answer = await res.text();
      const callId = res.headers.get('location')?.split('/').pop();
      if (!callId) throw new Error('OpenAI did not return a call id');
      const hangup = async () => {
        await fetch(`${api}/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key()}` },
        });
      };
      const sideband = options.url
        ? `${options.url}${options.url.includes('?') ? '&' : '?'}call_id=${encodeURIComponent(callId)}`
        : `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`;
      const connection = await attach(sideband, session(o, false), o.signal, hangup);
      return { answer, callId, connection };
    },
  };
}
