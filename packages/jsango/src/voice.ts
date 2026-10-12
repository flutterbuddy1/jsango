import { WebSocket as WSWebSocket } from 'ws';
import type { Agent, AgentContext } from '@jsango/ai';
import type { ISimpleWebSocket } from './websocket-wrapper.js';
import type { RouteArg } from './application.js';

export interface VoiceAgentOptions {
  /** Route middleware, e.g. `[auth.required()]`. Default: none (public, and voice is expensive). */
  readonly middleware?: readonly RouteArg[];
  /** OpenAI API key. Default: `OPENAI_API_KEY`. Stays on the server. */
  readonly apiKey?: string;
  /** Realtime model. Default `gpt-realtime`. */
  readonly model?: string;
  /** Voice, e.g. `marin`, `cedar`, `alloy`. Default `marin`. */
  readonly voice?: string;
  /** Transcription model for the user's speech, or `false` for none. Default `gpt-4o-mini-transcribe`. */
  readonly transcribe?: string | false;
  /** Tool rounds per user turn before the agent must answer. Default 10. */
  readonly maxSteps?: number;
  /** Hard limit on one session. Default 10 minutes. */
  readonly maxSessionMs?: number;
  /** Every JSON event sent to the client, plus `session.started` / `session.closed` (logs, metrics). */
  readonly onEvent?: (event: VoiceEvent) => void;
  /** Upstream URL (a proxy, or a fake server in tests). Default: OpenAI. */
  readonly url?: string;
}

export type VoiceEvent = { type: string; [key: string]: unknown };

/**
 * One voice session: the client's microphone audio goes to the OpenAI Realtime API through this
 * server, the agent's audio comes back, and tool calls run here with the user's permissions.
 *
 * Client -> server: binary frames of PCM16 mono 24 kHz audio; `{ type: 'text', text }`;
 * `{ type: 'interrupt', playedMs? }` when the user cuts the agent off (playedMs = how much of
 * the current reply was actually heard, so the model's memory matches).
 * Server -> client: binary frames of PCM16 24 kHz audio, and JSON events (see VoiceEvent).
 */
export function startVoiceSession(
  socket: ISimpleWebSocket,
  agent: Agent,
  options: VoiceAgentOptions,
  isProduction: boolean
): void {
  const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
  const model = options.model ?? 'gpt-realtime';
  const maxSteps = options.maxSteps ?? 10;
  const context: AgentContext = {
    user: socket.user,
    tenantId: socket.user?.tenantId,
    conversationId: socket.id,
    requestId: `voice_${socket.id}`,
  };
  const startedAt = Date.now();

  const emit = (event: VoiceEvent) => {
    options.onEvent?.(event);
    void socket.send(event);
  };
  const fail = (error: string, detail?: string) => {
    emit({ type: 'error', error: isProduction || !detail ? error : `${error}: ${detail}` });
    socket.close(1011, error);
  };

  if (!apiKey) return fail('Voice is not configured', 'OPENAI_API_KEY is not set');

  const upstream = new WSWebSocket(
    options.url ?? `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const send = (event: Record<string, unknown>) => {
    if (upstream.readyState === WSWebSocket.OPEN) upstream.send(JSON.stringify(event));
  };

  // Reply state: audio from a reply the user interrupted is dropped, never played or acted on.
  let currentResponse: string | undefined;
  let currentItem: string | undefined;
  const dropped = new Set<string>();
  let toolRounds = 0;
  let speechEndedAt: number | undefined;
  let firstAudioMs: number | undefined;
  let closed = false;

  const close = (reason: string) => {
    if (closed) return;
    closed = true;
    clearTimeout(limit);
    upstream.close();
    socket.close(1000, reason);
    options.onEvent?.({ type: 'session.closed', reason, durationMs: Date.now() - startedAt });
  };
  const limit = setTimeout(
    () => {
      emit({ type: 'error', error: 'Session time limit reached' });
      close('Session time limit');
    },
    options.maxSessionMs ?? 10 * 60_000
  );

  upstream.on('open', async () => {
    const instructions = await agent.instructionsFor(context);
    send({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions,
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            turn_detection: { type: 'semantic_vad' },
            ...(options.transcribe === false
              ? {}
              : { transcription: { model: options.transcribe ?? 'gpt-4o-mini-transcribe' } }),
          },
          output: { format: { type: 'audio/pcm', rate: 24000 }, voice: options.voice ?? 'marin' },
        },
        tools: agent.getTools().map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.inputSchema ?? { type: 'object', properties: {} },
        })),
        tool_choice: 'auto',
      },
    });
    options.onEvent?.({ type: 'session.started', model });
    emit({ type: 'ready' });
  });

  upstream.on('message', (raw) => {
    let event: any;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }
    void onUpstream(event);
  });
  upstream.on('error', (err) => {
    if (!closed) fail('Voice provider connection failed', err.message);
  });
  upstream.on('close', () => {
    if (!closed) {
      emit({ type: 'error', error: 'Voice provider closed the session' });
      close('Provider closed');
    }
  });

  // Also called after `speech.started` (the provider already cancelled the reply), so the
  // truncation still happens: the model should only remember what the user actually heard.
  const interrupt = (playedMs?: number) => {
    if (currentResponse) {
      dropped.add(currentResponse);
      send({ type: 'response.cancel' });
      currentResponse = undefined;
    }
    if (currentItem && typeof playedMs === 'number' && playedMs >= 0) {
      send({
        type: 'conversation.item.truncate',
        item_id: currentItem,
        content_index: 0,
        audio_end_ms: Math.floor(playedMs),
      });
    }
    currentItem = undefined;
  };

  async function onUpstream(event: any): Promise<void> {
    switch (event.type) {
      case 'response.created':
        currentResponse = event.response?.id;
        firstAudioMs = undefined;
        return;
      case 'response.output_audio.delta': {
        if (dropped.has(event.response_id)) return;
        currentItem = event.item_id;
        if (firstAudioMs === undefined && speechEndedAt !== undefined)
          firstAudioMs = Date.now() - speechEndedAt;
        await socket.send(Buffer.from(event.delta, 'base64'));
        return;
      }
      case 'response.output_audio_transcript.delta':
        if (!dropped.has(event.response_id))
          emit({ type: 'transcript.delta', role: 'assistant', text: event.delta });
        return;
      case 'response.output_audio_transcript.done':
        if (!dropped.has(event.response_id))
          emit({ type: 'transcript', role: 'assistant', text: event.transcript });
        return;
      case 'conversation.item.input_audio_transcription.completed':
        emit({ type: 'transcript', role: 'user', text: event.transcript });
        return;
      case 'input_audio_buffer.speech_started':
        // The provider cancels its reply itself; the client must stop playback now.
        if (currentResponse) dropped.add(currentResponse);
        currentResponse = undefined;
        toolRounds = 0;
        emit({ type: 'speech.started' });
        return;
      case 'input_audio_buffer.speech_stopped':
        speechEndedAt = Date.now();
        return;
      case 'response.done':
        return onResponseDone(event.response);
      case 'error':
        // e.g. cancelling a reply that already finished: harmless, just report it.
        emit({
          type: 'error',
          error: isProduction ? 'Voice provider error' : event.error?.message,
        });
        return;
    }
  }

  async function onResponseDone(response: any): Promise<void> {
    const id = response?.id;
    if (currentResponse === id) currentResponse = undefined;
    emit({
      type: 'response.done',
      status: response?.status,
      usage: response?.usage,
      firstAudioMs,
    });
    // A cancelled or interrupted reply's tool calls are stale: never run them.
    if (response?.status !== 'completed' || dropped.has(id)) return;
    const calls = (response.output ?? []).filter((o: any) => o.type === 'function_call');
    if (calls.length === 0) return;
    if (++toolRounds > maxSteps) {
      emit({ type: 'error', error: 'Too many tool calls in one turn' });
      return;
    }
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        // invalid JSON from the model: the tool's own validation reports it
      }
      emit({ type: 'tool.started', name: call.name });
      const result = await agent.callTool(call.name, args, context);
      const output = result.approvalRequired
        ? { error: 'This action needs human approval and cannot run from a voice session.' }
        : (result.output ?? { error: result.error });
      emit({
        type: result.error || result.approvalRequired ? 'tool.failed' : 'tool.completed',
        name: call.name,
        durationMs: result.durationMs,
      });
      if (closed) return;
      send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(output),
        },
      });
    }
    send({ type: 'response.create' });
  }

  socket.on('message', (data: unknown) => {
    if (Buffer.isBuffer(data)) {
      // PCM16: two bytes per sample.
      if (data.length === 0 || data.length % 2 !== 0)
        return emit({ type: 'error', error: 'Audio must be PCM16 mono 24 kHz' });
      return send({ type: 'input_audio_buffer.append', audio: data.toString('base64') });
    }
    const msg = data as { type?: string; text?: unknown; playedMs?: unknown };
    if (msg?.type === 'interrupt') return interrupt(Number(msg.playedMs ?? NaN));
    if (msg?.type === 'text' && typeof msg.text === 'string' && msg.text.length > 0) {
      if (msg.text.length > 10_000) return emit({ type: 'error', error: 'Text is too long' });
      interrupt();
      toolRounds = 0;
      send({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: msg.text }] },
      });
      return send({ type: 'response.create' });
    }
    emit({ type: 'error', error: 'Unknown message' });
  });
  socket.on('close', () => close('Client closed'));
}
