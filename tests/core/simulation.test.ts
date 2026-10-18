import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyCommand, validateRun } from '../../src/core/index.js';
import { gradeOf } from '../../src/core/rules.js';
import { createInputModel } from '../../scripts/simulation/input.js';
import { scenarios } from '../../scripts/simulation/model.js';
import { simulate } from '../../scripts/simulation/runner.js';

function scenario(id: string) {
  const result = scenarios('full').find(candidate => candidate.id === id);
  if (!result) throw new Error(`Scenario missing: ${id}`);
  return result;
}

describe('reproducible complete-run simulation', () => {
  it('has unique coverage of strategies, hammer choices, skill, routes, assistance, and abuse', () => {
    const cases = scenarios('full');
    expect(cases).toHaveLength(53);
    expect(new Set(cases.map(item => item.id)).size).toBe(53);
    expect(scenarios('base')).toHaveLength(36);
    expect(scenarios('abuse')).toHaveLength(5);
  });

  it('uses a deterministic timing error stream; handle width and slower motion improve precision', () => {
    const normal = createInputModel('timing-check', 'medium', false);
    const same = createInputModel('timing-check', 'medium', false);
    const slow = createInputModel('timing-check', 'medium', true);
    let base = 0; let upgraded = 0; let assisted = 0;
    for (let index = 0; index < 2000; index++) {
      const hit = normal.sample(1400);
      expect(hit).toEqual(same.sample(1400));
      expect(hit.mark).toBeGreaterThanOrEqual(0); expect(hit.mark).toBeLessThanOrEqual(10000);
      expect(Number.isInteger(hit.mark)).toBe(true);
      base += Number(gradeOf(hit.mark, 0) === 'precise');
      upgraded += Number(gradeOf(hit.mark, 2) === 'precise');
      assisted += Number(gradeOf(slow.sample(1400).mark, 0) === 'precise');
    }
    expect(upgraded).toBeGreaterThan(base); expect(assisted).toBeGreaterThan(base);
    expect(normal.draws()).toBe(28000);
    const perfect = createInputModel('timing-check', 'perfect', false);
    expect(perfect.sample(1200).mark).toBe(5000);
  });

  it('replays actual accepted commands and rejects terminal inputs', () => {
    const result = simulate(scenario('balanced-adaptive-medium-heat-normal-clean'), 'train-v1-0000');
    expect(result.state.phase).toBe('victory');
    expect(result.state.history).toHaveLength(12);
    expect(result.state.history[11]?.metQuota).toBe(false);
    expect(result.state.seals).toBeGreaterThan(0);
    expect(validateRun(JSON.parse(JSON.stringify(result.state))).ok).toBe(true);
    expect(simulate(scenario('balanced-adaptive-medium-heat-normal-clean'), 'train-v1-0000')).toEqual(result);
    const terminal = applyCommand(result.state, { runId: result.state.runId, expectedRevision: result.state.revision,
      action: { type: 'advanceSummary' } });
    expect(terminal.ok).toBe(false); expect(terminal.state).toBe(result.state);
    expect(result.metrics.stateBytes).toBeLessThan(256 * 1024);
  });

  it('duplicate spam has exactly the clean state and no additional rewards or random draws', () => {
    const clean = simulate(scenario('balanced-adaptive-medium-heat-normal-clean'), 'spam-check');
    const spam = simulate(scenario('balanced-adaptive-medium-heat-normal-spam'), 'spam-check');
    expect(spam.state).toEqual(clean.state);
    expect(spam.metrics.rejected).toBe(spam.metrics.accepted * 5);
    expect(spam.metrics.activeInputSeconds).toBe(clean.metrics.activeInputSeconds);
  });

  it.each(['raw', 'recycle', 'idle'] as const)('%s cannot advance to a free victory', strategy => {
    const spec = scenarios('abuse').find(item => item.strategy === strategy);
    if (!spec) throw new Error('Missing abuse case');
    const result = simulate(spec, 'abuse-check');
    expect(result.metrics.outcome).toBe(strategy === 'idle' ? 'idle' : 'defeat');
    expect(result.metrics.rounds).toBe(strategy === 'idle' ? 0 : 3);
    expect(result.metrics.strikes).toBe(0);
    if (strategy === 'recycle') expect(result.metrics.goldEarned).toBe(0);
    if (strategy === 'idle') expect(result.state.revision).toBe(0);
  });

  it('policy imports visible projection types without state, RNG, validation, or rule internals', () => {
    const source = readFileSync('scripts/simulation/policy.ts', 'utf8');
    expect(source).not.toMatch(/RunState|\.rng|nextRandom|hashUtf8|rules\.js|random\.js|validateRun/);
  });
});
