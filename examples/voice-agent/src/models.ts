import {
  AnthropicProvider,
  OllamaProvider,
  OpenAiProvider,
  cartesia,
  deepgram,
  elevenlabs,
  geminiLive,
  openaiRealtime,
  openaiStt,
  openaiTts,
  type ILlmProvider,
  type VoiceOptions,
} from 'jsango';

/*
 * Every model is picked from the environment, so the same app runs on any provider.
 * Nothing here is special: swap any line for your own provider(fn), stt(fn) or tts(fn).
 */

const env = (name: string) => process.env[name] || undefined;

/** The LLM that thinks. LLM=openai (default) | anthropic | ollama */
export function llmFromEnv(): ILlmProvider {
  switch (env('LLM') ?? 'openai') {
    case 'anthropic':
      return new AnthropicProvider({ defaultModel: env('LLM_MODEL') });
    case 'ollama':
      return new OllamaProvider({ defaultModel: env('LLM_MODEL') ?? 'llama3.2' });
    default:
      return new OpenAiProvider({ defaultModel: env('LLM_MODEL') ?? 'gpt-4o-mini' });
  }
}

/**
 * How the agent hears and speaks. VOICE=
 *   openai            speech-to-text + your LLM + text-to-speech, all on one OpenAI key (default)
 *   deepgram-cartesia Deepgram (streaming, fast end-of-turn) + Cartesia
 *   elevenlabs        OpenAI speech-to-text + ElevenLabs voice
 *   local             self-hosted, OpenAI-compatible servers (e.g. faster-whisper + Kokoro)
 *   realtime          OpenAI speech-to-speech (also enables WebRTC)
 *   gemini            Gemini Live speech-to-speech
 */
export function voiceFromEnv(): { mode: string; voice: VoiceOptions } {
  const mode = env('VOICE') ?? 'openai';
  switch (mode) {
    case 'deepgram-cartesia':
      return {
        mode,
        voice: { stt: deepgram(), tts: cartesia({ voiceId: required('CARTESIA_VOICE_ID') }) },
      };
    case 'elevenlabs':
      return {
        mode,
        voice: { stt: openaiStt(), tts: elevenlabs({ voiceId: required('ELEVENLABS_VOICE_ID') }) },
      };
    case 'local':
      return {
        mode,
        voice: {
          stt: openaiStt({
            baseUrl: env('LOCAL_STT_URL') ?? 'http://localhost:8000/v1',
            model: env('LOCAL_STT_MODEL') ?? 'Systran/faster-whisper-small',
          }),
          tts: openaiTts({
            baseUrl: env('LOCAL_TTS_URL') ?? 'http://localhost:8880/v1',
            model: env('LOCAL_TTS_MODEL') ?? 'kokoro',
            voice: env('LOCAL_TTS_VOICE') ?? 'af_heart',
          }),
        },
      };
    case 'realtime':
      return { mode, voice: { realtime: openaiRealtime({ voice: env('VOICE_NAME') ?? 'marin' }) } };
    case 'gemini':
      return { mode, voice: { realtime: geminiLive({ model: required('GEMINI_LIVE_MODEL') }) } };
    default:
      return {
        mode: 'openai',
        voice: { stt: openaiStt(), tts: openaiTts({ voice: env('VOICE_NAME') ?? 'marin' }) },
      };
  }
}

function required(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is not set (see .env.example).`);
  return value;
}
