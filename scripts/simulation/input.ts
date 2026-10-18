import type { RandomStream } from '../../src/core/index.js';
import { hashUtf8, nextRandom } from '../../src/core/random.js';
import { PROFILES } from './model.js';
import type { Skill } from './model.js';

const UNIT = 65536;

export function createInputModel(seed: string, skill: Skill, slow: boolean) {
  let stream: RandomStream = { state: hashUtf8(`sim-input-v1|${seed}`), draws: 0 };
  const uint16 = () => {
    const draw = nextRandom(stream); stream = draw.stream;
    return Math.floor(draw.value * 4294967296) >>> 16;
  };
  return {
    sample(period: number): { mark: number; activeUnits: number } {
      const periodMs = slow ? period * 1.5 : period;
      const lapse = uint16() / UNIT;
      const lapsePosition = uint16();
      let centered = -393210; // 12 * mean of uniform integer [0, 65535].
      for (let index = 0; index < 12; index++) centered += uint16();
      const profile = PROFILES[skill];
      const holdUnits = Math.max(0, lapse < profile.lapse ? lapsePosition * periodMs / 2
        : periodMs * UNIT / 4 + profile.sigmaMs * centered);
      const total = periodMs * UNIT;
      const phase = holdUnits % total;
      const triangle = Math.min(phase, total - phase);
      const mark = Math.floor((triangle * 20000 + total / 2) / total);
      return { mark, activeUnits: holdUnits + 450 * UNIT };
    },
    draws: () => stream.draws,
  };
}
