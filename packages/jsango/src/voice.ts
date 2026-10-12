import { randomUUID } from 'node:crypto';
import { getIdentity } from '@jsango/auth';
import { BadRequestError, HttpResponse, type RequestContext } from '@jsango/http';
import {
  VoiceSession,
  pcmFromBytes,
  pcmToBytes,
  type Agent,
  type RealtimeAdapter,
  type VoiceEvent,
  type VoiceOptions,
} from '@jsango/ai';
import type { ISimpleWebSocket } from './websocket-wrapper.js';
import type { RouteArg } from './application.js';

export interface VoiceAgentOptions extends VoiceOptions {
  /** Route middleware, e.g. `[auth.required()]`. Default: none (public, and voice is expensive). */
  readonly middleware?: readonly RouteArg[];
  /** Every event sent to the client, plus `session.started` / `session.closed` (logs, metrics). */
  readonly onEvent?: (event: VoiceRouteEvent) => void;
}

export type VoiceRouteEvent =
  | VoiceEvent
  | { type: 'session.started'; sessionId: string; mode: 'pipeline' | 'realtime' }
  | { type: 'session.closed'; sessionId: string; reason: string; durationMs: number };

/** Browser audio: PCM16 mono 24 kHz both ways. */
const BROWSER_RATE = 24000;

/**
 * Browser transport for a VoiceSession.
 *
 * Client -> server: binary frames of PCM16 mono 24 kHz audio; `{ type: 'text', text }`;
 * `{ type: 'interrupt', playedMs? }` when the user cuts the agent off.
 * Server -> client: binary frames of PCM16 mono 24 kHz audio, and JSON VoiceEvents.
 */
export function startVoiceSession(
  socket: ISimpleWebSocket,
  agent: Agent,
  options: VoiceAgentOptions,
  isProduction: boolean
): void {
  const startedAt = Date.now();
  const report = (event: VoiceRouteEvent) => options.onEvent?.(event);
  let session: VoiceSession;
  try {
    session = new VoiceSession(agent, options, {
      context: {
        user: socket.user,
        tenantId: socket.user?.tenantId,
        conversationId: socket.id,
        requestId: `voice_${socket.id}`,
      },
      inputRate: BROWSER_RATE,
      outputRate: BROWSER_RATE,
      output: {
        audio: (pcm) => void socket.send(pcmToBytes(pcm)),
        event: (event) => {
          report(event);
          // Provider details stay in server logs (onEvent) in production.
          const safe =
            event.type === 'error' && isProduction
              ? { type: 'error', error: event.error.split(':')[0] }
              : event;
          void socket.send(safe);
        },
        clear: () => undefined, // the client stops playback on `speech.started`
        close: (reason) => {
          report({
            type: 'session.closed',
            sessionId: socket.id,
            reason,
            durationMs: Date.now() - startedAt,
          });
          socket.close(1000, reason);
        },
      },
    });
  } catch (err) {
    void socket.send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    socket.close(1011, 'Voice is not configured');
    return;
  }

  socket.on('message', (data: unknown) => {
    if (Buffer.isBuffer(data)) {
      if (data.length === 0 || data.length % 2 !== 0)
        return void socket.send({ type: 'error', error: 'Audio must be PCM16 mono 24 kHz' });
      return session.audio(pcmFromBytes(data));
    }
    const msg = data as { type?: string; text?: unknown; playedMs?: unknown };
    if (msg?.type === 'interrupt') return session.interrupt(Number(msg.playedMs ?? NaN));
    if (msg?.type === 'text' && typeof msg.text === 'string' && msg.text.length > 0) {
      if (msg.text.length > 10_000)
        return void socket.send({ type: 'error', error: 'Text is too long' });
      return session.text(msg.text);
    }
    void socket.send({ type: 'error', error: 'Unknown message' });
  });
  socket.on('close', () => session.close('Client closed'));

  report({
    type: 'session.started',
    sessionId: socket.id,
    mode: options.realtime ? 'realtime' : 'pipeline',
  });
  void session.start();
}

export interface WebRtcAgentOptions {
  /** A speech-to-speech adapter that supports WebRTC, e.g. `openaiRealtime()`. */
  readonly realtime: RealtimeAdapter;
  /** Route middleware: use auth. Every accepted offer starts a paid call. */
  readonly middleware?: readonly RouteArg[] | undefined;
  readonly maxSteps?: number | undefined;
  /** Hard limit on one call; the call is hung up. Default 10 minutes. */
  readonly maxSessionMs?: number | undefined;
  readonly onEvent?: ((event: VoiceRouteEvent) => void) | undefined;
}

/**
 * Handles one browser SDP offer: the browser streams audio to the provider over WebRTC, and this
 * server keeps a control connection to the same call for tools, memory and insights.
 */
export async function answerWebRtcOffer(
  ctx: RequestContext,
  agent: Agent,
  options: WebRtcAgentOptions
): Promise<HttpResponse> {
  const offer = await ctx.request.text();
  if (!offer.startsWith('v=0') || offer.length > 64_000)
    throw new BadRequestError(
      'Send the SDP offer as the request body (Content-Type: application/sdp).'
    );
  const identity = getIdentity(ctx);
  const user = identity.isAuthenticated ? identity : undefined;
  const id = randomUUID();
  const startedAt = Date.now();
  let answer: string | undefined;
  const adapter = options.realtime;

  const session = new VoiceSession(
    agent,
    {
      maxSteps: options.maxSteps,
      maxSessionMs: options.maxSessionMs,
      // The call is created with the browser's offer; the session runs on its control connection.
      realtime: {
        ...adapter,
        connect: async (o) => {
          const call = await adapter.webrtc!(offer, o);
          answer = call.answer;
          return call.connection;
        },
      },
    },
    {
      context: {
        user,
        tenantId: user?.tenantId,
        conversationId: user ? 'webrtc' : id,
        requestId: ctx.requestId,
      },
      inputRate: 24000,
      outputRate: 24000,
      output: {
        audio: () => undefined, // audio goes browser <-> provider directly
        event: (event) => options.onEvent?.(event),
        clear: () => undefined,
        close: (reason) =>
          options.onEvent?.({
            type: 'session.closed',
            sessionId: id,
            reason,
            durationMs: Date.now() - startedAt,
          }),
      },
    }
  );
  options.onEvent?.({ type: 'session.started', sessionId: id, mode: 'realtime' });
  await session.start();
  if (answer === undefined)
    return HttpResponse.json({ error: 'Could not start the call.' }, { status: 502 });
  return new HttpResponse(answer, { headers: { 'content-type': 'application/sdp' } });
}
