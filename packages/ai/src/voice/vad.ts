import { durationMs, rms } from './audio.js';

export interface VadOptions {
  /** Silence that ends a turn. Default 500 ms. */
  silenceMs?: number;
  /** Speech needed before it counts (filters clicks and short noises). Default 150 ms. */
  minSpeechMs?: number;
  /** Minimum RMS level for speech (0..32768). Default 500; raised automatically over noise. */
  threshold?: number;
}

/**
 * Energy-based voice activity detection: no model, no dependency, fine for headsets and phone
 * audio.
 * ponytail: energy VAD; plug a model-based one (Silero) in through the same start/stop calls
 * if noisy rooms matter.
 */
export class EnergyVad {
  private readonly silenceMs: number;
  private readonly minSpeechMs: number;
  private readonly threshold: number;
  private noise = 0;
  private speechMs = 0;
  private silentMs = 0;
  public speaking = false;

  constructor(options: VadOptions = {}) {
    this.silenceMs = options.silenceMs ?? 500;
    this.minSpeechMs = options.minSpeechMs ?? 150;
    this.threshold = options.threshold ?? 500;
  }

  /** Feeds one frame; returns 'start' / 'stop' when speech begins or ends. */
  public push(pcm: Int16Array, sampleRate: number): 'start' | 'stop' | undefined {
    const level = rms(pcm);
    const ms = durationMs(pcm.length, sampleRate);
    const isSpeech = level > Math.max(this.threshold, this.noise * 3);
    if (!isSpeech) this.noise = this.noise === 0 ? level : this.noise * 0.95 + level * 0.05;

    if (isSpeech) {
      this.silentMs = 0;
      this.speechMs += ms;
      if (!this.speaking && this.speechMs >= this.minSpeechMs) {
        this.speaking = true;
        return 'start';
      }
    } else {
      if (!this.speaking) this.speechMs = 0;
      this.silentMs += ms;
      if (this.speaking && this.silentMs >= this.silenceMs) {
        this.speaking = false;
        this.speechMs = 0;
        return 'stop';
      }
    }
    return undefined;
  }
}
