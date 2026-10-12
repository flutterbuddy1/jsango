import { resample, wav } from './audio.js';

const RATE = 16000;

/**
 * One mono recording of a call: the caller's audio as it arrives, the agent's audio where it
 * plays. Audio cut by a barge-in is cut from the recording too.
 * ponytail: held in memory (~2 MB per minute), bounded by the session time limit.
 */
export class CallRecorder {
  private readonly startedAt = Date.now();
  private readonly input: Int16Array[] = [];
  private inputLength = 0;
  private output: Array<{ start: number; pcm: Int16Array }> = [];
  private cursor = 0;

  private now(): number {
    return Math.round(((Date.now() - this.startedAt) / 1000) * RATE);
  }

  public caller(pcm: Int16Array, rate: number): void {
    const p = resample(pcm, rate, RATE);
    this.input.push(p);
    this.inputLength += p.length;
  }

  /** Agent audio is sent faster than it plays: queue it after what is already playing. */
  public agent(pcm: Int16Array, rate: number): void {
    const p = resample(pcm, rate, RATE);
    const start = Math.max(this.now(), this.cursor);
    this.output.push({ start, pcm: p });
    this.cursor = start + p.length;
  }

  /** Playback was stopped: whatever was queued after now was never heard. */
  public cut(): void {
    const now = this.now();
    this.output = this.output
      .filter((s) => s.start < now)
      .map((s) =>
        s.start + s.pcm.length > now ? { start: s.start, pcm: s.pcm.subarray(0, now - s.start) } : s
      );
    this.cursor = now;
  }

  public toWav(): Buffer {
    const end = Math.max(this.inputLength, ...this.output.map((s) => s.start + s.pcm.length), 0);
    const mix = new Int32Array(end);
    let at = 0;
    for (const p of this.input) {
      for (let i = 0; i < p.length; i++) mix[at + i]! += p[i]!;
      at += p.length;
    }
    for (const s of this.output)
      for (let i = 0; i < s.pcm.length; i++) mix[s.start + i]! += s.pcm[i]!;
    const out = new Int16Array(end);
    for (let i = 0; i < end; i++) out[i] = Math.max(-32768, Math.min(32767, mix[i]!));
    return wav(out, RATE);
  }
}
