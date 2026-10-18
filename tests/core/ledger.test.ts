import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getRunView, validateRun, getRunLedger } from '../../src/core/index.js';
import type { RunState } from '../../src/core/index.js';

function witness(file: string): RunState {
  const raw: unknown = JSON.parse(readFileSync(new URL(`../../docs/evidence/T06/${file}`, import.meta.url), 'utf8'));
  if (!raw || typeof raw !== 'object' || !('state' in raw)) throw new Error('Missing witness');
  const result = validateRun(raw.state);if (!result.ok) throw new Error(result.detail);return result.state;
}
describe('receipts of reachable runs', () => {
  it('accounts for all twelve rounds without awarding a second copy of revenue or scrap', () => {
    const state = witness('verify-v1.medium-victory.json'), before = JSON.stringify(state);
    const receipt = getRunLedger(getRunView(state));
    expect(receipt.rounds).toHaveLength(12);expect(receipt.highestTier).toBe('传世');
    expect(receipt.rounds.reduce((sum, round) => sum + round.delivered, 0)).toBe(state.stats.coinsEarned);
    expect(receipt.rounds.reduce((sum, round) => sum + round.scrap, 0)).toBe(state.stats.scrapEarned);
    expect(receipt.purchases.reduce((sum, purchase) => sum + purchase.coins, 0)).toBe(state.stats.coinsSpent);
    expect(state.stats.coinsEarned - state.stats.coinsSpent).toBe(state.coins);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('keeps broken estimated value separate from delivery revenue and returns only one scrap', () => {
    const state = witness('verify-v1.medium-victory.json');
    const receipt = getRunLedger(getRunView(state)), broken = receipt.rounds.flatMap(round => round.pieces).filter(piece => piece.status === '已破碎');
    expect(broken.length).toBe(state.stats.brokenPieces);expect(broken.length).toBeGreaterThan(0);
    for (const piece of broken) { expect(piece.coins).toBe(0);expect(piece.scrap).toBe(1);expect(piece.lost).toBe(piece.value); }
    expect(receipt.lost).toBe(broken.reduce((sum, piece) => sum + piece.value, 0));
  });
  it('retains all three genuine failed rounds and the last penalty on a terminal contract', () => {
    const state = witness('verify-v1.raw-defeat.json'), receipt = getRunLedger(getRunView(state));
    expect(receipt.rounds).toHaveLength(3);expect(receipt.rounds.at(-1)).toMatchObject({ sealsBefore: 1, sealsAfter: 0, metQuota: false });
    expect(receipt.rounds.flatMap(round => round.pieces)).toHaveLength(9);expect(receipt.purchases).toHaveLength(0);
    expect(receipt.rounds.reduce((sum, round) => sum + round.delivered, 0)).toBe(state.coins);
  });
});
