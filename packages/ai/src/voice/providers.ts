import { WebSocket } from 'ws';
import { ProviderError } from '../errors.js';
import { pcmStream, pcmToBytes, wav } from './audio.js';
import { AsyncQueue } from './queue.js';
import type { Stt, SttResult, Tts } from './types.js';

/*
 * Ready-made speech-to-text / text-to-speech adapters. Each one is a few lines of fetch/ws, so
 * any other provider (or a self-hosted model) is just as easy with stt(fn) / tts(fn).
 * OpenAI-compatible servers (faster-whisper-server, Kokoro-FastAPI, LocalAI, ...) work through
 * openaiStt / openaiTts with `baseUrl`.
 */

const env = (name: string) => (typeof process !== 'undefined' ? process.env[name] : undefined);

function requireKey(provider: string, key: string | undefined, envName: string): string {
  if (!key) throw new ProviderError(provider, `${envName} is not set (or pass apiKey).`);
  return key;
}

async function check(provider: string, res: Response): Promise<Response> {
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new ProviderError(provider, `Request failed (${res.status}): ${detail}`);
  }
  return res;
}

export interface OpenAiSttOptions {
  /** Default `OPENAI_API_KEY`. Not needed for local servers. */
  apiKey?: string | undefined;
  /** Default `gpt-transcribe`. Local servers: their model name, e.g. `Systran/faster-whisper-small`. */
  model?: string | undefined;
  /** Default `https://api.openai.com/v1`; any OpenAI-compatible transcription server. */
  baseUrl?: string | undefined;
}

/** OpenAI (or OpenAI-compatible) transcription: one utterance per request. */
export function openaiStt(options: OpenAiSttOptions = {}): Stt {
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  return {
    name: 'openai-stt',
    sampleRate: 16000,
    async transcribe(audio, { sampleRate, signal }) {
      const key = options.baseUrl
        ? (options.apiKey ?? env('OPENAI_API_KEY'))
        : requireKey('openai-stt', options.apiKey ?? env('OPENAI_API_KEY'), 'OPENAI_API_KEY');
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(wav(audio, sampleRate))], { type: 'audio/wav' }), 'speech.wav');
      form.append('model', options.model ?? 'gpt-transcribe');
      const res = await check(
        'openai-stt',
        await fetch(`${baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          body: form,
          signal,
        })
      );
      return String(((await res.json()) as { text?: string }).text ?? '').trim();
    },
  };
}

export interface OpenAiTtsOptions {
  apiKey?: string | undefined;
  /** Default `gpt-4o-mini-tts`. */
  model?: string | undefined;
  /** Default `marin`. */
  voice?: string | undefined;
  /** How to speak, e.g. "Calm and friendly" (gpt-4o-mini-tts). */
  instructions?: string | undefined;
  /** Default `https://api.openai.com/v1`; any OpenAI-compatible speech server (e.g. Kokoro). */
  baseUrl?: string | undefined;
}

/** OpenAI (or OpenAI-compatible) speech: streamed PCM16 24 kHz. */
export function openaiTts(options: OpenAiTtsOptions = {}): Tts {
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  return {
    name: 'openai-tts',
    sampleRate: 24000,
    async *synthesize(text, { signal }) {
      const key = options.baseUrl
        ? (options.apiKey ?? env('OPENAI_API_KEY'))
        : requireKey('openai-tts', options.apiKey ?? env('OPENAI_API_KEY'), 'OPENAI_API_KEY');
      const res = await check(
        'openai-tts',
        await fetch(`${baseUrl}/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify({
            model: options.model ?? 'gpt-4o-mini-tts',
            voice: options.voice ?? 'marin',
            input: text,
            response_format: 'pcm',
            ...(options.instructions ? { instructions: options.instructions } : {}),
          }),
          signal,
        })
      );
      yield* pcmStream(res.body);
    },
  };
}

export interface ElevenLabsOptions {
  /** Default `ELEVENLABS_API_KEY`. */
  apiKey?: string | undefined;
  /** Required: a voice id from your ElevenLabs voice library. */
  voiceId: string;
  /** Default `eleven_flash_v2_5` (lowest latency). */
  model?: string | undefined;
  /** 8000, 16000, 22050, 24000, 32000, 44100, 48000. Default 24000. */
  sampleRate?: number | undefined;
  /** Default `https://api.elevenlabs.io` (regional servers also work). */
  baseUrl?: string | undefined;
}

/** ElevenLabs streaming text-to-speech. */
export function elevenlabs(options: ElevenLabsOptions): Tts {
  const sampleRate = options.sampleRate ?? 24000;
  return {
    name: 'elevenlabs',
    sampleRate,
    async *synthesize(text, { signal }) {
      const key = requireKey(
        'elevenlabs',
        options.apiKey ?? env('ELEVENLABS_API_KEY'),
        'ELEVENLABS_API_KEY'
      );
      const url =
        `${options.baseUrl ?? 'https://api.elevenlabs.io'}/v1/text-to-speech/` +
        `${encodeURIComponent(options.voiceId)}/stream?output_format=pcm_${sampleRate}`;
      const res = await check(
        'elevenlabs',
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
          body: JSON.stringify({ text, model_id: options.model ?? 'eleven_flash_v2_5' }),
          signal,
        })
      );
      yield* pcmStream(res.body);
    },
  };
}

export interface CartesiaOptions {
  /** Default `CARTESIA_API_KEY`. */
  apiKey?: string | undefined;
  /** Required: a Cartesia voice id. */
  voiceId: string;
  /** Default `sonic-3.6`. */
  model?: string | undefined;
  /** e.g. `en`, `hi`. */
  language?: string | undefined;
  /** 8000, 16000, 22050, 24000, 44100, 48000. Default 24000. */
  sampleRate?: number | undefined;
  /** `Cartesia-Version` header. Default `2026-08-14`. */
  version?: string | undefined;
}

/** Cartesia text-to-speech (raw PCM, streamed bytes). */
export function cartesia(options: CartesiaOptions): Tts {
  const sampleRate = options.sampleRate ?? 24000;
  return {
    name: 'cartesia',
    sampleRate,
    async *synthesize(text, { signal }) {
      const key = requireKey(
        'cartesia',
        options.apiKey ?? env('CARTESIA_API_KEY'),
        'CARTESIA_API_KEY'
      );
      const res = await check(
        'cartesia',
        await fetch('https://api.cartesia.ai/tts/bytes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'Cartesia-Version': options.version ?? '2026-08-14',
          },
          body: JSON.stringify({
            model_id: options.model ?? 'sonic-3.6',
            transcript: text,
            voice: { id: options.voiceId },
            output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: sampleRate },
            ...(options.language ? { language: options.language } : {}),
          }),
          signal,
        })
      );
      yield* pcmStream(res.body);
    },
  };
}

export interface DeepgramOptions {
  /** Default `DEEPGRAM_API_KEY`. */
  apiKey?: string | undefined;
  /** Default `nova-3`. */
  model?: string | undefined;
  /** e.g. `en`, `hi`, `multi`. Default: Deepgram's (`en`). */
  language?: string | undefined;
  /** Silence (ms) after which Deepgram marks the end of speech. Default 300. */
  endpointingMs?: number | undefined;
  /** Upstream URL (a proxy, or a fake server in tests). */
  url?: string | undefined;
}

/** Deepgram live transcription: streaming, with its own end-of-turn detection. */
export function deepgram(options: DeepgramOptions = {}): Stt {
  return {
    name: 'deepgram',
    sampleRate: 16000,
    async *stream(audio, { sampleRate, signal }): AsyncGenerator<SttResult> {
      const key = requireKey(
        'deepgram',
        options.apiKey ?? env('DEEPGRAM_API_KEY'),
        'DEEPGRAM_API_KEY'
      );
      const params = new URLSearchParams({
        model: options.model ?? 'nova-3',
        encoding: 'linear16',
        sample_rate: String(sampleRate),
        channels: '1',
        interim_results: 'true',
        endpointing: String(options.endpointingMs ?? 300),
        utterance_end_ms: '1000',
        smart_format: 'true',
      });
      if (options.language) params.set('language', options.language);
      const ws = new WebSocket(`${options.url ?? 'wss://api.deepgram.com/v1/listen'}?${params}`, {
        headers: { Authorization: `Token ${key}` },
      });
      const results = new AsyncQueue<SttResult | Error>();
      ws.on('message', (raw) => {
        let m: any;
        try {
          m = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (m.type === 'Results') {
          const text = m.channel?.alternatives?.[0]?.transcript ?? '';
          if (m.is_final) results.push({ text, final: true, endOfTurn: Boolean(m.speech_final) });
          else if (text) results.push({ text, final: false });
        } else if (m.type === 'UtteranceEnd') {
          results.push({ text: '', final: true, endOfTurn: true });
        }
      });
      ws.on('error', (err) => results.push(new ProviderError('deepgram', err.message)));
      ws.on('unexpected-response', (_req, res) =>
        results.push(new ProviderError('deepgram', `Connection refused (HTTP ${res.statusCode})`))
      );
      ws.on('close', () => results.end());
      signal.addEventListener('abort', () => ws.close(), { once: true });

      void (async () => {
        await new Promise((resolve) => ws.once('open', resolve));
        for await (const pcm of audio) {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(pcmToBytes(pcm));
        }
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }));
      })();

      for await (const r of results) {
        if (r instanceof Error) throw r;
        yield r;
      }
    },
  };
}
