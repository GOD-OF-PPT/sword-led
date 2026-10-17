import type { RandomStream } from './model.js';

export function hashUtf8(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash;
}

// Mulberry32: Tommy Ettinger's public-domain reference, see THIRD_PARTY_NOTICES.md.
export function nextRandom(stream: RandomStream): { readonly value: number; readonly stream: RandomStream } {
  const state = (stream.state + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(state ^ (state >>> 15), state | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return {
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296,
    stream: { state, draws: stream.draws + 1 },
  };
}

export function seedStream(seed: string, domain: 'stock' | 'strike'): RandomStream {
  return { state: hashUtf8(`${seed}|${domain}`), draws: 0 };
}
