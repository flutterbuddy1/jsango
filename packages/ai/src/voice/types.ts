import type { ToolDefinition, LlmMessage, LlmUsage } from '../types.js';

/** One speech-to-text result. `final` text is committed; partial text may still change. */
export interface SttResult {
  text: string;
  final: boolean;
  /** The provider detected the end of the user's turn (better than silence detection). */
  endOfTurn?: boolean | undefined;
}

/**
 * Speech-to-text. Implement `transcribe` (one utterance in, text out; the session cuts
 * utterances with its voice activity detection) or `stream` (live audio in, results out).
 */
export interface Stt {
  readonly name: string;
  /** Sample rate the provider wants. Audio is resampled to it. Default 16000. */
  readonly sampleRate?: number | undefined;
  transcribe?(
    audio: Int16Array,
    options: { sampleRate: number; signal: AbortSignal }
  ): Promise<string>;
  stream?(
    audio: AsyncIterable<Int16Array>,
    options: { sampleRate: number; signal: AbortSignal }
  ): AsyncIterable<SttResult>;
}

/**
 * Text-to-speech, PCM16 mono out. Implement `synthesize` (one sentence in, audio out; called per
 * sentence as the answer streams) or `stream` (a stream of text in, for providers with
 * streaming-input sockets).
 */
export interface Tts {
  readonly name: string;
  /** Sample rate of the audio this produces. */
  readonly sampleRate: number;
  synthesize?(
    text: string,
    options: { signal: AbortSignal }
  ): AsyncIterable<Int16Array> | Promise<Int16Array>;
  stream?(text: AsyncIterable<string>, options: { signal: AbortSignal }): AsyncIterable<Int16Array>;
}

/** Speech-to-speech providers (OpenAI Realtime, Gemini Live, ...). */
export interface RealtimeAdapter {
  readonly name: string;
  /** PCM16 rate for both directions. */
  readonly sampleRate: number;
  connect(options: {
    instructions: string;
    tools: ToolDefinition[];
    /** Earlier turns (text) to continue the conversation. */
    history: LlmMessage[];
    signal: AbortSignal;
  }): Promise<RealtimeConnection>;
}

export interface RealtimeConnection {
  sendAudio(pcm: Int16Array): void;
  sendText(text: string): void;
  /** Stop the current reply; `heardMs` = how much of it the user heard. */
  interrupt(responseId: string | undefined, heardMs?: number): void;
  toolResult(callId: string, output: unknown): void;
  /** Continue after tool results. */
  respond(): void;
  close(): void;
  readonly events: AsyncIterable<RealtimeEvent>;
}

export type RealtimeEvent =
  | { type: 'ready' }
  | { type: 'response.started'; responseId: string }
  | { type: 'audio'; responseId: string; itemId?: string | undefined; pcm: Int16Array }
  | { type: 'transcript.delta'; responseId: string; text: string }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; responseId?: string }
  | { type: 'speech.started' }
  | { type: 'speech.stopped' }
  | { type: 'tool.call'; responseId: string; callId: string; name: string; arguments: string }
  | {
      type: 'response.done';
      responseId: string;
      status: 'completed' | 'cancelled' | 'failed' | string;
      usage?: VoiceUsage | undefined;
    }
  | { type: 'error'; error: string; fatal?: boolean };

export interface VoiceUsage extends Partial<LlmUsage> {
  /** Provider-reported audio tokens or seconds, when available. */
  audioInput?: number | undefined;
  audioOutput?: number | undefined;
}

/** Per-turn latency, in milliseconds from the end of the user's speech. */
export interface TurnLatency {
  /** Final transcript ready. */
  sttMs?: number | undefined;
  /** First LLM token. */
  llmMs?: number | undefined;
  /** First audio byte sent to the caller. The number users feel. */
  firstAudioMs?: number | undefined;
}

/** Events a voice session sends to the client and to `onEvent`. */
export type VoiceEvent =
  | { type: 'ready' }
  | { type: 'speech.started' }
  | { type: 'transcript.delta'; role: 'assistant'; text: string }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; interrupted?: boolean }
  | { type: 'tool.started'; name: string }
  | { type: 'tool.completed' | 'tool.failed'; name: string; durationMs: number }
  | {
      type: 'response.done';
      status: string;
      usage?: VoiceUsage | undefined;
      latency: TurnLatency;
    }
  | { type: 'error'; error: string };

/**
 * A speech-to-text from one function: an utterance (PCM16) in, text out.
 *
 *   const whisper = stt(async (audio, { sampleRate }) => myWhisper(wav(audio, sampleRate)));
 */
export function stt(
  transcribe: NonNullable<Stt['transcribe']>,
  options: { name?: string; sampleRate?: number } = {}
): Stt {
  return { name: options.name ?? 'custom', sampleRate: options.sampleRate ?? 16000, transcribe };
}

/**
 * A text-to-speech from one function: a sentence in, PCM16 audio out (all at once, or as an
 * async iterable of chunks for lower latency).
 *
 *   const piper = tts(async (text) => myPiper(text), { sampleRate: 22050 });
 */
export function tts(
  synthesize: NonNullable<Tts['synthesize']>,
  options: { sampleRate: number; name?: string }
): Tts {
  return { name: options.name ?? 'custom', sampleRate: options.sampleRate, synthesize };
}
