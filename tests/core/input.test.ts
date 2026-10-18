import { describe, expect, it } from 'vitest';
import { StrikeAttempt, timingMarkAt } from '../../src/platform/timing.js';
import type { InputIdentity } from '../../src/platform/timing.js';

const context: InputIdentity = { runId: 'run-a', revision: 4, generation: 2, epoch: 8, pieceId: '1:2', mode: 'standard', periodMs: 1400 };
describe('single timing attempt', () => {
  it.each([1200, 1400, 1600, 1800, 2100, 2400])('uses one frame-independent triangle for period %i', period => {
    expect([0, period / 4, period / 2, period * .75, period, period * 1.25].map(time => timingMarkAt(time, period)))
      .toEqual([0, 5000, 10000, 5000, 0, 5000]);
  });
  it('judges release time even when the last rendered frame was far earlier', () => {
    const attempt = new StrikeAttempt();attempt.start(context, 'pointer:1', 100);
    expect(timingMarkAt(120 - 100, 1400)).not.toBe(5000);
    expect(attempt.release('pointer:1', 450, context)?.timingMark).toBe(5000);
    expect(attempt.release('pointer:1', 450, context)).toBeNull();
  });
  it('rejects repeat/mixed starts and foreign releases without stealing the owner', () => {
    const attempt = new StrikeAttempt();expect(attempt.start(context, 'pointer:1', 0)).toBe(true);
    expect(attempt.start(context, 'key:Space', 10)).toBe(false);
    expect(attempt.release('key:Space', 350, context)).toBeNull();
    expect(attempt.current?.owner).toBe('pointer:1');
    expect(attempt.release('pointer:1', 350, context)?.timingMark).toBe(5000);
  });
  it.each([
    { runId: 'new-run' }, { revision: 5 }, { generation: 3 }, { epoch: 9 },
    { pieceId: '1:3' }, { mode: 'heavy' as const }, { periodMs: 2100 },
  ])('invalidates a changed captured identity: %j', change => {
    const attempt = new StrikeAttempt();attempt.start(context, 'key:Space', 0);
    expect(attempt.release('key:Space', 350, { ...context, ...change })).toBeNull();
    expect(attempt.current).toBeNull();
  });
  it('cancelled inputs, missing contexts and invalid timestamps produce no release', () => {
    const attempt = new StrikeAttempt();expect(attempt.start(null, 'key:Space', 0)).toBe(false);
    expect(attempt.start({ ...context, periodMs: NaN }, 'key:Space', 0)).toBe(false);
    attempt.start(context, 'key:Space', 200);attempt.cancel();
    expect(attempt.release('key:Space', 550, context)).toBeNull();
    attempt.start(context, 'key:Space', 300);
    expect(attempt.release('key:Space', 250, context)).toBeNull();
    expect(attempt.current).toBeNull();
  });
});
