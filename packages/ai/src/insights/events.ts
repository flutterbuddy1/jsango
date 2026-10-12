import type { LlmUsage } from '../types.js';
import type { TurnLatency, VoiceUsage } from '../voice/types.js';

/** What agents and voice sessions report. Content (input, output, transcript) is always
 * reported here; whether it is stored is the listener's decision (insights: off by default). */
export type AiRecord =
  | {
      type: 'run';
      id: string;
      at: number;
      agent: string;
      provider: string;
      model?: string | undefined;
      channel: 'text' | 'voice';
      callId?: string | undefined;
      userId?: string | undefined;
      tenantId?: string | undefined;
      conversationId?: string | undefined;
      status: 'completed' | 'paused' | 'cancelled' | 'failed';
      usage: LlmUsage;
      durationMs: number;
      toolCalls: number;
      error?: string | undefined;
      input: string;
      output: string;
    }
  | {
      type: 'call.started';
      id: string;
      at: number;
      agent: string;
      mode: 'pipeline' | 'realtime';
      /** Adapter names, e.g. { stt: 'deepgram', tts: 'cartesia' } or { realtime: 'openai-realtime' }. */
      providers: Record<string, string>;
      userId?: string | undefined;
      tenantId?: string | undefined;
    }
  | {
      type: 'turn';
      callId: string;
      at: number;
      status: string;
      latency: TurnLatency;
      usage?: VoiceUsage | undefined;
    }
  | {
      type: 'call.ended';
      id: string;
      at: number;
      reason: string;
      durationMs: number;
      audioInMs: number;
      audioOutMs: number;
      transcript: Array<{
        role: 'user' | 'assistant';
        text: string;
        interrupted?: boolean | undefined;
      }>;
    };

const listeners = new Set<(record: AiRecord) => void>();

/** Listen to every agent run and voice call in this process. Returns an unsubscribe function. */
export function observeAi(listener: (record: AiRecord) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @internal */
export function reportAi(record: AiRecord): void {
  for (const listener of listeners) {
    try {
      listener(record);
    } catch {
      // observability must never break a run
    }
  }
}

/** @internal */
export const hasAiObservers = (): boolean => listeners.size > 0;

/** @internal The user id behind an agent context's `user` (object with id, or a plain id). */
export function userIdOf(user: unknown): string | undefined {
  const id = user && typeof user === 'object' ? (user as { id?: unknown }).id : user;
  return id === undefined || id === null ? undefined : String(id);
}
