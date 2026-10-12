import type { Agent } from '../agents/agent.js';
import type { AgentContext, LlmMessage } from '../types.js';
import { durationMs, resample } from './audio.js';
import { sentences } from './chunker.js';
import { AsyncQueue } from './queue.js';
import { EnergyVad, type VadOptions } from './vad.js';
import type {
  RealtimeAdapter,
  RealtimeConnection,
  RealtimeEvent,
  Stt,
  Tts,
  TurnLatency,
  VoiceEvent,
  VoiceUsage,
} from './types.js';

export interface VoiceOptions {
  /** Speech-to-text (pipeline mode, with `tts`). The LLM is the agent's own provider. */
  stt?: Stt | undefined;
  /** Text-to-speech (pipeline mode, with `stt`). */
  tts?: Tts | undefined;
  /** Speech-to-speech provider instead of stt + LLM + tts. */
  realtime?: RealtimeAdapter | undefined;
  /** Silence detection for pipeline mode. */
  vad?: VadOptions | undefined;
  /** Tool rounds per user turn. Default 10. */
  maxSteps?: number | undefined;
  /** Hard limit on one session. Default 10 minutes. */
  maxSessionMs?: number | undefined;
}

/** Where a session's output goes: a browser socket, a phone call, a test. */
export interface VoiceOutput {
  /** Agent audio, PCM16 mono at the session's `outputRate`. */
  audio(pcm: Int16Array): void;
  event(event: VoiceEvent): void;
  /** Stop playing whatever is buffered: the user is talking over the agent. */
  clear(): void;
  close(reason: string): void;
}

export interface VoiceSessionInit {
  context: AgentContext;
  /** Sample rate of audio given to `audio()`. */
  inputRate: number;
  /** Sample rate `output.audio()` must receive. */
  outputRate: number;
  output: VoiceOutput;
}

interface Turn {
  readonly input: string;
  readonly abort: AbortController;
  readonly endedAt: number; // the user stopped talking
  latency: TurnLatency;
  /** What was turned into audio, sentence by sentence, with each sentence's audio length. */
  spoken: Array<{ text: string; ms: number }>;
  firstAudioAt?: number | undefined;
  finished: boolean;
}

/**
 * One voice conversation with an agent, independent of transport. Pipeline mode (`stt` + `tts`)
 * works with any LLM provider; realtime mode (`realtime`) uses a speech-to-speech provider.
 * Either way the agent's instructions, tools, permissions and memory are the ones `run()` uses.
 */
export class VoiceSession {
  private readonly abort = new AbortController();
  private readonly agent: Agent;
  private readonly options: VoiceOptions;
  private readonly init: VoiceSessionInit;
  private readonly limit: ReturnType<typeof setTimeout>;
  private closed = false;

  // pipeline mode
  private readonly vad: EnergyVad;
  private sttAudio: AsyncQueue<Int16Array> | undefined;
  private utterance: Int16Array[] = [];
  private preroll: Int16Array[] = [];
  private pending = '';
  private userEndedAt: number | undefined;
  private finalTimer: ReturnType<typeof setTimeout> | undefined;
  private turn: Turn | undefined;
  private playbackEndsAt = 0;

  // realtime mode
  private conn: RealtimeConnection | undefined;
  private currentResponse: string | undefined;
  private readonly dropped = new Set<string>();
  private readonly toolCalls = new Map<
    string,
    Array<{ callId: string; name: string; arguments: string }>
  >();
  private toolRounds = 0;
  private realtimeFirstAudio: number | undefined;
  private realtimeUser = '';

  constructor(agent: Agent, options: VoiceOptions, init: VoiceSessionInit) {
    if (!options.realtime && !(options.stt && options.tts)) {
      throw new Error(
        'Voice needs either { stt, tts } (any LLM) or { realtime } (speech-to-speech).'
      );
    }
    if (options.stt && !options.stt.transcribe && !options.stt.stream) {
      throw new Error(
        `Speech-to-text '${options.stt.name}' implements neither transcribe nor stream.`
      );
    }
    if (options.tts && !options.tts.synthesize && !options.tts.stream) {
      throw new Error(
        `Text-to-speech '${options.tts.name}' implements neither synthesize nor stream.`
      );
    }
    this.agent = agent;
    this.options = options;
    this.init = init;
    this.vad = new EnergyVad(options.vad);
    this.limit = setTimeout(
      () => {
        this.emit({ type: 'error', error: 'Session time limit reached' });
        this.close('Session time limit');
      },
      options.maxSessionMs ?? 10 * 60_000
    );
  }

  private get context(): AgentContext {
    return { ...this.init.context, signal: this.abort.signal };
  }

  private emit(event: VoiceEvent): void {
    if (!this.closed) this.init.output.event(event);
  }

  /** Connects the providers; emits `ready` when audio can flow. */
  public async start(): Promise<void> {
    try {
      if (this.options.realtime) await this.startRealtime(this.options.realtime);
      else this.startPipeline();
    } catch (err) {
      this.emit({ type: 'error', error: `Voice provider failed: ${message(err)}` });
      this.close('Provider failed');
    }
  }

  /** Microphone audio, PCM16 mono at `inputRate`. */
  public audio(pcm: Int16Array): void {
    if (this.closed || pcm.length === 0) return;
    if (this.conn) {
      this.conn.sendAudio(resample(pcm, this.init.inputRate, this.options.realtime!.inputRate));
      return;
    }
    this.pipelineAudio(pcm);
  }

  /** A typed message: interrupts the current reply and answers it. */
  public text(text: string): void {
    if (this.closed || !text.trim()) return;
    if (this.conn) {
      this.interrupt();
      this.toolRounds = 0;
      this.realtimeUser = text;
      this.conn.sendText(text);
      return;
    }
    this.cancelTurn();
    this.respond(text, Date.now());
  }

  /** The user cut the agent off; `heardMs` = how much of the current reply they heard. */
  public interrupt(heardMs?: number): void {
    const heard = typeof heardMs === 'number' && heardMs >= 0 ? heardMs : undefined;
    if (this.conn) {
      if (this.currentResponse) this.dropped.add(this.currentResponse);
      this.conn.interrupt(this.currentResponse, heard);
      this.currentResponse = undefined;
      return;
    }
    this.cancelTurn(heard);
  }

  public close(reason = 'closed'): void {
    if (this.closed) return;
    this.cancelTurn();
    this.closed = true;
    clearTimeout(this.limit);
    clearTimeout(this.finalTimer);
    this.abort.abort();
    this.sttAudio?.end();
    this.conn?.close();
    this.init.output.close(reason);
  }

  // --- pipeline mode -------------------------------------------------------------------------

  private get sttRate(): number {
    return this.options.stt!.sampleRate ?? 16000;
  }

  private startPipeline(): void {
    const stt = this.options.stt!;
    if (stt.stream) {
      this.sttAudio = new AsyncQueue<Int16Array>();
      void (async () => {
        try {
          for await (const r of stt.stream!(this.sttAudio!, {
            sampleRate: this.sttRate,
            signal: this.abort.signal,
          })) {
            if (r.final && r.text.trim()) {
              this.pending = `${this.pending} ${r.text.trim()}`.trim();
            } else if (!r.endOfTurn) continue;
            clearTimeout(this.finalTimer);
            if (!this.pending) continue;
            if (r.endOfTurn || (this.userEndedAt && !this.vad.speaking)) this.endTurn();
            // Neither the provider nor silence detection ended the turn: don't wait forever.
            else this.finalTimer = setTimeout(() => this.endTurn(), 1500);
          }
        } catch (err) {
          if (!this.closed) {
            this.emit({ type: 'error', error: `Speech-to-text failed: ${message(err)}` });
            this.close('Speech-to-text failed');
          }
        }
      })();
    }
    this.emit({ type: 'ready' });
  }

  private pipelineAudio(pcm: Int16Array): void {
    const forStt = resample(pcm, this.init.inputRate, this.sttRate);
    this.sttAudio?.push(forStt);

    const change = this.vad.push(pcm, this.init.inputRate);
    if (!this.options.stt!.stream) {
      // Batch speech-to-text: keep ~300 ms before speech starts so the first word isn't cut.
      if (this.vad.speaking || change === 'stop') this.utterance.push(forStt);
      else {
        this.preroll.push(forStt);
        while (this.preroll.length > 15) this.preroll.shift();
      }
    }

    if (change === 'start') {
      this.userEndedAt = undefined;
      if (!this.options.stt!.stream) this.utterance = [...this.preroll, ...this.utterance];
      this.preroll = [];
      // Barge-in: the agent is talking (or about to), the user wins.
      if (this.turn && !this.turn.finished) this.cancelTurn();
      else if (Date.now() < this.playbackEndsAt) this.init.output.clear();
      this.emit({ type: 'speech.started' });
    } else if (change === 'stop') {
      this.userEndedAt = Date.now();
      if (this.options.stt!.stream) {
        if (this.pending) this.endTurn();
      } else {
        void this.transcribeUtterance(this.userEndedAt);
      }
    }
  }

  private async transcribeUtterance(endedAt: number): Promise<void> {
    const parts = this.utterance;
    this.utterance = [];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const audio = new Int16Array(total);
    let offset = 0;
    for (const p of parts) {
      audio.set(p, offset);
      offset += p.length;
    }
    try {
      const text = await this.options.stt!.transcribe!(audio, {
        sampleRate: this.sttRate,
        signal: this.abort.signal,
      });
      if (this.vad.speaking) {
        // The user kept talking: this becomes the start of a longer turn.
        this.pending = `${this.pending} ${text}`.trim();
        return;
      }
      this.pending = `${this.pending} ${text}`.trim();
      this.endTurn(endedAt);
    } catch (err) {
      if (!this.closed)
        this.emit({ type: 'error', error: `Speech-to-text failed: ${message(err)}` });
    }
  }

  private endTurn(endedAt = this.userEndedAt ?? Date.now()): void {
    clearTimeout(this.finalTimer);
    const text = this.pending.trim();
    this.pending = '';
    this.userEndedAt = undefined;
    if (!text || this.closed) return;
    this.cancelTurn();
    this.respond(text, endedAt);
  }

  private respond(input: string, endedAt: number): void {
    const turn: Turn = {
      input,
      abort: new AbortController(),
      endedAt,
      latency: { sttMs: Date.now() - endedAt },
      spoken: [],
      finished: false,
    };
    this.turn = turn;
    this.emit({ type: 'transcript', role: 'user', text: input });
    void this.runTurn(turn).catch((err: unknown) => {
      if (turn.abort.signal.aborted || this.closed) return;
      turn.finished = true;
      turn.abort.abort(); // stop the LLM too if text-to-speech failed
      this.emit({ type: 'error', error: message(err) });
      this.emit({ type: 'response.done', status: 'failed', latency: turn.latency });
    });
  }

  private async runTurn(turn: Turn): Promise<void> {
    const tts = this.options.tts!;
    const signal = turn.abort.signal;
    const tokens = new AsyncQueue<string>();
    let usage: VoiceUsage | undefined;

    const thinking = (async () => {
      try {
        for await (const event of this.agent.stream({
          input: turn.input,
          context: { ...this.context, signal },
          signal,
          maxSteps: this.options.maxSteps,
          saveHistory: false, // saved below, with only what the user actually heard
        })) {
          const data = event.data as Record<string, any>;
          if (event.type === 'message.delta') {
            turn.latency.llmMs ??= Date.now() - turn.endedAt;
            tokens.push(data['text']);
            this.emit({ type: 'transcript.delta', role: 'assistant', text: data['text'] });
          } else if (event.type === 'message.completed') {
            // a reply that also calls tools: its text is spoken, then the tool runs
            tokens.push(' ');
          } else if (event.type === 'tool.started') {
            this.emit({ type: 'tool.started', name: data['toolName'] });
          } else if (event.type === 'tool.completed' || event.type === 'tool.failed') {
            this.emit({
              type: event.type,
              name: data['toolName'],
              durationMs: data['durationMs'] ?? 0,
            });
          } else if (event.type === 'approval.required') {
            tokens.push(' This needs approval in the app before I can do it.');
          } else if (event.type === 'run.completed') {
            usage = data['usage'];
          }
        }
      } finally {
        tokens.end();
      }
    })();
    thinking.catch(() => undefined); // awaited below; this only stops an unhandled rejection

    const speak = (pcm: Int16Array, segment: { text: string; ms: number }) => {
      if (signal.aborted || this.closed) return;
      const out = resample(pcm, tts.sampleRate, this.init.outputRate);
      const ms = durationMs(out.length, this.init.outputRate);
      if (turn.firstAudioAt === undefined) {
        turn.firstAudioAt = Date.now();
        turn.latency.firstAudioMs = turn.firstAudioAt - turn.endedAt;
      }
      if (!turn.spoken.includes(segment)) turn.spoken.push(segment);
      segment.ms += ms;
      this.playbackEndsAt = Math.max(this.playbackEndsAt, Date.now()) + ms;
      this.init.output.audio(out);
    };

    const pieces = sentences(tokens);
    if (tts.stream) {
      // Streaming text-to-speech doesn't say which audio belongs to which sentence: one segment.
      const segment = { text: '', ms: 0 };
      const written = (async function* () {
        for await (const piece of pieces) {
          segment.text = `${segment.text} ${piece}`.trim();
          yield piece;
        }
      })();
      for await (const pcm of tts.stream(written, { signal })) {
        if (signal.aborted) break;
        speak(pcm, segment);
      }
    } else {
      // ponytail: one sentence at a time; prefetch the next sentence if gaps between them show up.
      for await (const piece of pieces) {
        if (signal.aborted) break;
        const segment = { text: piece, ms: 0 };
        const audio = tts.synthesize!(piece, { signal });
        if (audio instanceof Promise) speak(await audio, segment);
        else for await (const pcm of audio) speak(pcm, segment);
      }
    }
    await thinking;
    if (signal.aborted || this.closed) return;

    turn.finished = true;
    const answer = turn.spoken.map((s) => s.text).join(' ');
    await this.agent.remember(this.context, [
      { role: 'user', content: turn.input },
      { role: 'assistant', content: answer || '…' },
    ]);
    this.emit({ type: 'transcript', role: 'assistant', text: answer });
    this.emit({ type: 'response.done', status: 'completed', usage, latency: turn.latency });
  }

  /** Stops the current reply and saves the part the user heard. */
  private cancelTurn(heardMs?: number): void {
    const turn = this.turn;
    this.turn = undefined;
    this.init.output.clear();
    this.playbackEndsAt = 0;
    if (!turn || turn.finished) return;
    turn.finished = true;
    turn.abort.abort();

    const played =
      heardMs ?? (turn.firstAudioAt === undefined ? 0 : Date.now() - turn.firstAudioAt);
    const heard = heardText(turn.spoken, played);
    const history: LlmMessage[] = [
      { role: 'user', content: turn.input },
      { role: 'assistant', content: heard ? `${heard}…` : '…' },
    ];
    void this.agent.remember(this.context, history).catch(() => undefined);
    this.emit({ type: 'transcript', role: 'assistant', text: heard, interrupted: true });
    this.emit({ type: 'response.done', status: 'interrupted', latency: turn.latency });
  }

  // --- realtime mode -------------------------------------------------------------------------

  private async startRealtime(adapter: RealtimeAdapter): Promise<void> {
    const conn = await adapter.connect({
      instructions: await this.agent.instructionsFor(this.context),
      tools: this.agent.getTools(),
      history: await this.agent.history(this.context),
      signal: this.abort.signal,
    });
    if (this.closed) return conn.close();
    this.conn = conn;
    void (async () => {
      try {
        for await (const event of conn.events) await this.onRealtime(event);
      } catch (err) {
        if (!this.closed) this.emit({ type: 'error', error: message(err) });
      }
      if (!this.closed) {
        this.emit({ type: 'error', error: 'Voice provider closed the session' });
        this.close('Provider closed');
      }
    })();
  }

  private async onRealtime(event: RealtimeEvent): Promise<void> {
    const conn = this.conn!;
    switch (event.type) {
      case 'ready':
        return this.emit({ type: 'ready' });
      case 'response.started':
        this.currentResponse = event.responseId;
        return;
      case 'audio':
        if (this.dropped.has(event.responseId)) return;
        if (this.realtimeFirstAudio === undefined && this.userEndedAt !== undefined)
          this.realtimeFirstAudio = Date.now() - this.userEndedAt;
        return this.init.output.audio(
          resample(event.pcm, this.options.realtime!.outputRate, this.init.outputRate)
        );
      case 'transcript.delta':
        if (!this.dropped.has(event.responseId))
          this.emit({ type: 'transcript.delta', role: 'assistant', text: event.text });
        return;
      case 'transcript':
        if (event.role === 'user') {
          this.realtimeUser = event.text;
          return this.emit({ type: 'transcript', role: 'user', text: event.text });
        }
        if (event.responseId && this.dropped.has(event.responseId)) return;
        this.emit({ type: 'transcript', role: 'assistant', text: event.text });
        if (this.realtimeUser) {
          const user = this.realtimeUser;
          this.realtimeUser = '';
          await this.agent.remember(this.context, [
            { role: 'user', content: user },
            { role: 'assistant', content: event.text },
          ]);
        }
        return;
      case 'speech.started':
        // The provider cancels its own reply; the client must stop playback now.
        if (this.currentResponse) this.dropped.add(this.currentResponse);
        this.currentResponse = undefined;
        this.toolRounds = 0;
        this.init.output.clear();
        return this.emit({ type: 'speech.started' });
      case 'speech.stopped':
        this.userEndedAt = Date.now();
        this.realtimeFirstAudio = undefined;
        return;
      case 'tool.call': {
        const calls = this.toolCalls.get(event.responseId) ?? [];
        calls.push(event);
        this.toolCalls.set(event.responseId, calls);
        return;
      }
      case 'response.done': {
        if (this.currentResponse === event.responseId) this.currentResponse = undefined;
        const calls = this.toolCalls.get(event.responseId) ?? [];
        this.toolCalls.delete(event.responseId);
        this.emit({
          type: 'response.done',
          status: event.status,
          usage: event.usage,
          latency: { firstAudioMs: this.realtimeFirstAudio },
        });
        // A cancelled or interrupted reply's tool calls are stale: never run them.
        if (event.status !== 'completed' || this.dropped.has(event.responseId) || !calls.length)
          return;
        if (++this.toolRounds > (this.options.maxSteps ?? 10)) {
          return this.emit({ type: 'error', error: 'Too many tool calls in one turn' });
        }
        for (const call of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = call.arguments ? JSON.parse(call.arguments) : {};
          } catch {
            // invalid JSON from the model: the tool's own validation reports it
          }
          this.emit({ type: 'tool.started', name: call.name });
          const result = await this.agent.callTool(call.name, args, this.context);
          const output = result.approvalRequired
            ? { error: 'This action needs human approval and cannot run from a voice session.' }
            : (result.output ?? { error: result.error });
          this.emit({
            type: result.error || result.approvalRequired ? 'tool.failed' : 'tool.completed',
            name: call.name,
            durationMs: result.durationMs,
          });
          if (this.closed) return;
          conn.toolResult(call.callId, output);
        }
        conn.respond();
        return;
      }
      case 'error':
        this.emit({ type: 'error', error: event.error });
        if (event.fatal) this.close('Provider error');
        return;
    }
  }
}

/** The sentences played within `playedMs`, the last one cut where playback stopped. */
function heardText(spoken: Array<{ text: string; ms: number }>, playedMs: number): string {
  const parts: string[] = [];
  let at = 0;
  for (const s of spoken) {
    if (at + s.ms <= playedMs) parts.push(s.text);
    else {
      const partial = cutAt(s.text, s.ms > 0 ? (playedMs - at) / s.ms : 0);
      if (partial) parts.push(partial);
      break;
    }
    at += s.ms;
  }
  return parts.join(' ');
}

/** The first `fraction` of `text`, cut at a word boundary. */
function cutAt(text: string, fraction: number): string {
  if (fraction >= 1) return text;
  if (fraction <= 0) return '';
  const end = text.lastIndexOf(' ', Math.round(text.length * fraction));
  return end > 0 ? text.slice(0, end) : '';
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
