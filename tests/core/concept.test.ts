import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { conceptScenario } from './concept-scenario.js';
import { getRunView, validateRun } from '../../src/core/index.js';

it('reaches the exact B concept state through 102 official commands', () => {
  const state = conceptScenario('concept-v1-4111');
  expect(state).not.toBeNull(); if (!state) throw new Error('Concept is unreachable');
  expect(state).toEqual(JSON.parse(readFileSync('docs/evidence/T06/concept-b-state.json', 'utf8')));
  expect(validateRun(state).ok).toBe(true);
  expect(state.revision).toBe(102);
  expect(state.history.map(summary => summary.delivered)).toEqual([136, 155, 183, 227, 0]);
  const view = getRunView(state, { pieceId: '6:2', mode: 'standard' });
  expect([view.round, view.delivered, view.quota, view.remaining, view.coins, view.scrap, view.coal, view.seals])
    .toEqual([6, 144, 290, 146, 585, 6, 1, 2]);
  expect(view.upgrades).toEqual({ handle: 1, bellows: 0, anvil: 1 });
  expect(view.selected).toMatchObject({ material: 'steel', tier: 3, forgedValue: 83, nextValue: 123,
    progress: 9, nextProgress: 14, integrity: 1, maxIntegrity: 3, heat: 40, stress: 47, recoverableScrap: 5 });
  expect(view.selected?.risk.map(risk => [risk.damageRiskPct, risk.breakRiskPct])).toEqual([[14, 14], [20, 20], [32, 32]]);
  expect(view.pieces[2]).toMatchObject({ material: 'meteorite', progress: 0, status: 'active' });
});
