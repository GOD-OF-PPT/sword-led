import { describe, expect, it } from 'vitest';
import vectors from '../fixtures/mulberry32-vectors.json';
import { hashUtf8, nextRandom, seedStream } from '../../src/core/random.js';

describe('fixed random algorithm', () => {
  it.each(vectors.cases)('matches separately compiled C reference for seed $seed', ({ seed, uint32 }) => {
    let stream = { state: seed, draws: 0 };
    const actual = uint32.map(() => {
      const result = nextRandom(stream);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
      stream = result.stream;
      return result.value * 4294967296;
    });
    expect(actual).toEqual(uint32);
    expect(stream.draws).toBe(5);
  });

  it('uses known FNV-1a vectors and UTF-8 bytes', () => {
    expect(hashUtf8('')).toBe(0x811c9dc5);
    expect(hashUtf8('a')).toBe(0xe40c292c);
    expect(hashUtf8('foobar')).toBe(0xbf9cf968);
    expect(hashUtf8('hello')).toBe(0x4f9f2cab);
    expect(hashUtf8('铁')).not.toBe(hashUtf8('铁|strike'));
  });

  it('keeps zero valid, wraps uint32 and never mutates an input stream', () => {
    const input = Object.freeze({ state: 0xffffffff, draws: 4 });
    const output = nextRandom(input);
    expect(input).toEqual({ state: 0xffffffff, draws: 4 });
    expect(output.stream).toEqual({ state: 1831565812, draws: 5 });
    expect(nextRandom({ state: 0, draws: 0 }).value).toBe(1144304738 / 4294967296);
  });

  it('separates supply and strike streams without a wall clock', () => {
    expect(seedStream('同种子', 'stock')).toEqual(seedStream('同种子', 'stock'));
    expect(seedStream('同种子', 'stock')).not.toEqual(seedStream('同种子', 'strike'));
  });
});
