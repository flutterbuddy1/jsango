/** Audio helpers for voice: PCM16 mono everywhere, converted at the edges. */

/** Bytes (little-endian PCM16) to samples, copying so odd byte offsets are safe. */
export function pcmFromBytes(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length >> 1);
  new Uint8Array(out.buffer).set(bytes.subarray(0, out.length * 2));
  return out;
}

export function pcmToBytes(pcm: Int16Array): Buffer {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
}

// ponytail: linear interpolation is fine for speech; use a polyphase filter if music quality matters.
export function resample(pcm: Int16Array, from: number, to: number): Int16Array {
  if (from === to || pcm.length === 0) return pcm;
  const out = new Int16Array(Math.max(1, Math.round((pcm.length * to) / from)));
  const step = from / to;
  for (let i = 0; i < out.length; i++) {
    const pos = i * step;
    const j = Math.floor(pos);
    const a = pcm[Math.min(j, pcm.length - 1)]!;
    const b = pcm[Math.min(j + 1, pcm.length - 1)]!;
    out[i] = Math.round(a + (b - a) * (pos - j));
  }
  return out;
}

/** Duration of PCM16 mono audio in milliseconds. */
export const durationMs = (samples: number, sampleRate: number): number =>
  (samples / sampleRate) * 1000;

/** G.711 μ-law (phone audio) to PCM16. */
export function mulawDecode(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const u = ~bytes[i]! & 0xff;
    const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
    out[i] = u & 0x80 ? 0x84 - t : t - 0x84;
  }
  return out;
}

/** PCM16 to G.711 μ-law. */
export function mulawEncode(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    let s = pcm[i]!;
    const sign = s < 0 ? 0x80 : 0;
    if (s < 0) s = -s;
    s = Math.min(s, 32635) + 0x84;
    let exp = 7;
    for (let mask = 0x4000; (s & mask) === 0 && exp > 0; mask >>= 1) exp--;
    out[i] = ~(sign | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xff;
  }
  return out;
}

/** A WAV file (for speech-to-text APIs that take files). */
export function wav(pcm: Int16Array, sampleRate: number): Buffer {
  const data = pcmToBytes(pcm);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** PCM16 chunks from a streamed HTTP body, keeping odd bytes for the next chunk. */
export async function* pcmStream(
  body: ReadableStream<Uint8Array> | null
): AsyncGenerator<Int16Array> {
  if (!body) return;
  let carry: Uint8Array | undefined;
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    const bytes = carry ? Buffer.concat([carry, chunk]) : chunk;
    const even = bytes.length - (bytes.length % 2);
    carry = even < bytes.length ? bytes.subarray(even) : undefined;
    if (even > 0) yield pcmFromBytes(bytes.subarray(0, even));
  }
}

/** Root-mean-square level, 0..32768. */
export function rms(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i]! * pcm[i]!;
  return Math.sqrt(sum / pcm.length);
}
