import { WebSocket } from 'ws';
import { pcmFromBytes, pcmToBytes } from './audio.js';
import { AsyncQueue } from './queue.js';
import type { RealtimeAdapter, RealtimeConnection, RealtimeEvent, VoiceUsage } from './types.js';

export interface GeminiLiveOptions {
  /** Default `GEMINI_API_KEY` (or `GOOGLE_API_KEY`). Stays on the server. */
  apiKey?: string | undefined;
  /** Required: a Live API model, e.g. the native-audio model listed in Google's docs. */
  model: string;
  /** A prebuilt voice name, e.g. `Puck`, `Kore`. Default: the model's. */
  voice?: string | undefined;
  /** Upstream URL (a proxy, or a fake server in tests). */
  url?: string | undefined;
}

/**
 * Google Gemini Live API (speech-to-speech) over WebSocket: PCM16 16 kHz in, 24 kHz out.
 * Gemini detects turns and interruptions itself; it has no "cancel" or "truncate" call, so an
 * interrupted reply is dropped on our side.
 */
export function geminiLive(options: GeminiLiveOptions): RealtimeAdapter {
  return {
    name: 'gemini-live',
    inputRate: 16000,
    outputRate: 24000,
    async connect({ instructions, tools, history, signal }): Promise<RealtimeConnection> {
      const apiKey =
        options.apiKey ?? process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY'];
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
      const base =
        options.url ??
        'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
      const ws = new WebSocket(`${base}?key=${encodeURIComponent(apiKey)}`);
      await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', reject);
        ws.once('unexpected-response', (_req, res) =>
          reject(new Error(`Gemini Live refused the connection (HTTP ${res.statusCode})`))
        );
      });
      signal.addEventListener('abort', () => ws.close(), { once: true });
      const send = (msg: unknown) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      };

      const past = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      send({
        setup: {
          model: options.model.startsWith('models/') ? options.model : `models/${options.model}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            ...(options.voice
              ? {
                  speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: options.voice } },
                  },
                }
              : {}),
          },
          systemInstruction: {
            parts: [
              { text: past ? `${instructions}\n\nConversation so far:\n${past}` : instructions },
            ],
          },
          ...(tools.length
            ? {
                tools: [
                  {
                    functionDeclarations: tools.map((t) => ({
                      name: t.name,
                      description: t.description,
                      parameters: t.inputSchema ?? { type: 'object', properties: {} },
                    })),
                  },
                ],
              }
            : {}),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      const events = new AsyncQueue<RealtimeEvent>();
      // Gemini has no response ids: number the model's turns.
      let turn = 0;
      let active: string | undefined;
      let userText = '';
      let modelText = '';
      let usage: VoiceUsage | undefined;
      const pendingResults: Array<{ id: string; name: string; response: unknown }> = [];
      const callNames = new Map<string, string>();
      const responseId = () => {
        if (!active) {
          active = `gemini_${++turn}`;
          events.push({ type: 'response.started', responseId: active });
        }
        return active;
      };
      const finish = (status: string) => {
        if (!active) return;
        if (modelText.trim())
          events.push({
            type: 'transcript',
            role: 'assistant',
            text: modelText.trim(),
            responseId: active,
          });
        events.push({ type: 'response.done', responseId: active, status, usage });
        active = undefined;
        modelText = '';
        usage = undefined;
      };

      ws.on('message', (raw) => {
        let m: any;
        try {
          m = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (m.setupComplete) events.push({ type: 'ready' });
        if (m.usageMetadata) {
          usage = {
            promptTokens: m.usageMetadata.promptTokenCount,
            completionTokens: m.usageMetadata.responseTokenCount,
            totalTokens: m.usageMetadata.totalTokenCount,
          };
        }
        const sc = m.serverContent;
        if (sc) {
          if (sc.inputTranscription?.text) userText += sc.inputTranscription.text;
          if (sc.interrupted) {
            // The user talked over the model.
            events.push({ type: 'speech.started' });
            finish('cancelled');
          }
          for (const part of sc.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              if (userText.trim()) {
                events.push({ type: 'transcript', role: 'user', text: userText.trim() });
                userText = '';
                events.push({ type: 'speech.stopped' });
              }
              events.push({
                type: 'audio',
                responseId: responseId(),
                pcm: pcmFromBytes(Buffer.from(part.inlineData.data, 'base64')),
              });
            }
          }
          if (sc.outputTranscription?.text) {
            modelText += sc.outputTranscription.text;
            events.push({
              type: 'transcript.delta',
              responseId: responseId(),
              text: sc.outputTranscription.text,
            });
          }
          if (sc.turnComplete) finish('completed');
        }
        if (m.toolCall?.functionCalls?.length) {
          const id = responseId();
          for (const call of m.toolCall.functionCalls) {
            callNames.set(call.id, call.name);
            events.push({
              type: 'tool.call',
              responseId: id,
              callId: call.id,
              name: call.name,
              arguments: JSON.stringify(call.args ?? {}),
            });
          }
          // Gemini waits for the tool results: this reply is done, the next one follows them.
          finish('completed');
        }
      });
      ws.on('error', (err) => events.push({ type: 'error', error: err.message, fatal: true }));
      ws.on('close', () => events.end());

      return {
        events,
        sendAudio: (pcm) =>
          send({
            realtimeInput: {
              audio: { data: pcmToBytes(pcm).toString('base64'), mimeType: 'audio/pcm;rate=16000' },
            },
          }),
        sendText: (text) => send({ realtimeInput: { text } }),
        // No cancel call: new input interrupts Gemini, and the session drops the old reply.
        interrupt: () => finish('cancelled'),
        toolResult: (callId, output) =>
          pendingResults.push({
            id: callId,
            name: callNames.get(callId) ?? '',
            response: { output },
          }),
        respond: () => {
          send({ toolResponse: { functionResponses: pendingResults.splice(0) } });
        },
        close: () => ws.close(),
      };
    },
  };
}
