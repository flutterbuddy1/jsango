import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  VoiceSession,
  mulawDecode,
  mulawEncode,
  type Agent,
  type AgentContext,
  type VoiceOptions,
} from '@jsango/ai';
import { HttpResponse, type RequestContext } from '@jsango/http';
import type { ISimpleWebSocket } from './websocket-wrapper.js';
import type { VoiceRouteEvent } from './voice.js';

/** A phone call reaching the agent. */
export interface PhoneCall {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  /** Your own values from `dial(to, { params })`. */
  params: Record<string, string>;
}

export interface TwilioOptions {
  /** Default `TWILIO_ACCOUNT_SID`. */
  accountSid?: string | undefined;
  /** Default `TWILIO_AUTH_TOKEN`. Used to verify Twilio's webhook signatures. */
  authToken?: string | undefined;
  /** Default caller id for `dial()`: one of your Twilio numbers. */
  from?: string | undefined;
  /** REST API base (tests). Default `https://api.twilio.com`. */
  apiUrl?: string | undefined;
}

export interface TwilioCarrier {
  readonly name: 'twilio';
  readonly options: TwilioOptions;
}

/** Twilio Programmable Voice with bidirectional Media Streams (μ-law 8 kHz). */
export function twilio(options: TwilioOptions = {}): TwilioCarrier {
  return { name: 'twilio', options };
}

export interface PhoneAgentOptions extends VoiceOptions {
  /** The phone carrier, e.g. `twilio()`. */
  carrier: TwilioCarrier;
  /**
   * Your app's public https URL, e.g. `https://voice.example.com`. Needed for `dial()` and behind
   * proxies (it is the URL Twilio signs). Default: taken from the incoming request.
   */
  publicUrl?: string | undefined;
  /** Maps a caller to your user (e.g. by phone number) so memory and insights know who called. */
  identify?:
    ((call: PhoneCall) => AgentContext['user'] | Promise<AgentContext['user']>) | undefined;
  onEvent?:
    ((event: VoiceRouteEvent | { type: 'call.answered'; call: PhoneCall }) => void) | undefined;
}

export interface PhoneLine {
  /** Calls `to` (E.164, e.g. +919876543210) and connects the agent when they answer. */
  dial(
    to: string,
    options?: { from?: string; params?: Record<string, string> }
  ): Promise<{ callSid: string }>;
}

interface Pending {
  call: Omit<PhoneCall, 'callSid'> & { callSid?: string };
  expires: number;
}

const PHONE_RATE = 8000;
const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!
  );

/** Twilio's request signature: HMAC-SHA1 over the URL plus the sorted POST parameters. */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');
  return createHmac('sha1', authToken).update(data).digest('base64');
}

/**
 * Registers the routes of a phone agent: `POST path` (Twilio's "A call comes in" webhook) and the
 * media stream at `path/stream`. Returns `dial()` for outbound calls.
 */
export function phoneRoutes(
  register: {
    post(path: string, handler: (ctx: RequestContext) => unknown): void;
    ws(path: string, handler: (socket: ISimpleWebSocket) => void): void;
  },
  path: string,
  agent: Agent,
  options: PhoneAgentOptions,
  isProduction: boolean
): PhoneLine {
  const t = options.carrier.options;
  const accountSid = () => t.accountSid ?? process.env['TWILIO_ACCOUNT_SID'];
  const authToken = () => t.authToken ?? process.env['TWILIO_AUTH_TOKEN'];
  // One-time tokens: a media stream is only accepted for a call this server just answered or dialed.
  const pending = new Map<string, Pending>();
  const issue = (call: Pending['call'], ttlMs: number) => {
    const now = Date.now();
    for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
    const token = randomBytes(24).toString('base64url');
    pending.set(token, { call, expires: now + ttlMs });
    return token;
  };
  const streamTwiml = (base: string, token: string) => {
    const url = `${base.replace(/^http/, 'ws').replace(/\/$/, '')}${path}/stream`;
    return (
      '<?xml version="1.0" encoding="UTF-8"?><Response><Connect>' +
      `<Stream url="${xml(url)}"><Parameter name="token" value="${xml(token)}"/></Stream>` +
      '</Connect></Response>'
    );
  };

  register.post(path, async (ctx) => {
    const form = (await ctx.request.formData()) as Record<string, string>;
    const token = authToken();
    if (!token) {
      if (isProduction) return new HttpResponse('Phone agent is not configured', { status: 503 });
    } else {
      const url = options.publicUrl
        ? options.publicUrl.replace(/\/$/, '') + ctx.request.url.pathname + ctx.request.url.search
        : ctx.request.url.toString();
      const expected = Buffer.from(twilioSignature(token, url, form));
      const given = Buffer.from(ctx.request.headers.get('x-twilio-signature') ?? '');
      if (expected.length !== given.length || !timingSafeEqual(expected, given))
        return new HttpResponse('Invalid signature', { status: 403 });
    }
    const call = {
      callSid: String(form['CallSid'] ?? ''),
      from: String(form['From'] ?? ''),
      to: String(form['To'] ?? ''),
      direction: 'inbound' as const,
      params: {},
    };
    const base = options.publicUrl ?? `${ctx.request.url.protocol}//${ctx.request.url.host}`;
    return new HttpResponse(streamTwiml(base, issue(call, 60_000)), {
      headers: { 'content-type': 'text/xml' },
    });
  });

  register.ws(`${path}/stream`, (socket) => {
    let session: VoiceSession | undefined;
    let streamSid = '';
    const startedAt = Date.now();
    const report = options.onEvent;
    // Nothing but the start message is accepted before the token is checked.
    const timeout = setTimeout(() => socket.close(1008, 'No start message'), 10_000);

    socket.on('message', async (data: unknown) => {
      const msg = data as { event?: string; start?: any; media?: { payload?: string } };
      if (msg?.event === 'media' && session && msg.media?.payload) {
        return session.audio(mulawDecode(Buffer.from(msg.media.payload, 'base64')));
      }
      if (msg?.event === 'stop') return session?.close('Caller hung up');
      if (msg?.event !== 'start' || session) return;

      clearTimeout(timeout);
      const token = String(msg.start?.customParameters?.token ?? '');
      const entry = pending.get(token);
      pending.delete(token);
      const callSid = String(msg.start?.callSid ?? '');
      if (
        !entry ||
        entry.expires < Date.now() ||
        (entry.call.callSid && entry.call.callSid !== callSid)
      )
        return socket.close(1008, 'Unknown call');
      streamSid = String(msg.start?.streamSid ?? '');
      const call: PhoneCall = { ...entry.call, callSid };
      report?.({ type: 'call.answered', call });

      const user = await options.identify?.(call);
      session = new VoiceSession(agent, options, {
        // With a known user, memory follows the caller across calls; otherwise it lasts one call.
        context: user
          ? { user, tenantId: (user as { tenantId?: string }).tenantId, conversationId: 'phone' }
          : { conversationId: callSid },
        inputRate: PHONE_RATE,
        outputRate: PHONE_RATE,
        output: {
          audio: (pcm) =>
            void socket.send({
              event: 'media',
              streamSid,
              media: { payload: Buffer.from(mulawEncode(pcm)).toString('base64') },
            }),
          event: (event) => report?.(event),
          clear: () => void socket.send({ event: 'clear', streamSid }),
          close: (reason) => {
            report?.({
              type: 'session.closed',
              sessionId: callSid,
              reason,
              durationMs: Date.now() - startedAt,
            });
            socket.close(1000, reason); // ends the stream: Twilio continues the TwiML, i.e. hangs up
          },
        },
      });
      report?.({
        type: 'session.started',
        sessionId: callSid,
        mode: options.realtime ? 'realtime' : 'pipeline',
      });
      await session.start();
    });
    socket.on('close', () => {
      clearTimeout(timeout);
      session?.close('Stream closed');
    });
  });

  return {
    async dial(to, dialOptions = {}) {
      const sid = accountSid();
      const token = authToken();
      const from = dialOptions.from ?? t.from;
      if (!sid || !token)
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required to dial.');
      if (!from) throw new Error('No caller id: pass `from` (one of your Twilio numbers).');
      if (!options.publicUrl)
        throw new Error('`publicUrl` is required to dial (Twilio must reach this server).');
      const call: Pending['call'] = {
        from,
        to,
        direction: 'outbound',
        params: dialOptions.params ?? {},
      };
      const streamToken = issue(call, 120_000); // ringing can take a while
      const res = await fetch(
        `${t.apiUrl ?? 'https://api.twilio.com'}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: from,
            Twiml: streamTwiml(options.publicUrl, streamToken),
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok || !body.sid) {
        pending.delete(streamToken);
        throw new Error(
          `Twilio refused the call (${res.status}): ${body.message ?? 'unknown error'}`
        );
      }
      call.callSid = body.sid;
      return { callSid: body.sid };
    },
  };
}
