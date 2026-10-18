import { beforeAll, describe, expect, it } from 'vitest';
import { getRunView, validateRun } from '../../src/core/index.js';
import type { ProductId, RunState } from '../../src/core/index.js';
import { act, newRun, send } from './helpers';
import { firstMerchant, secondMerchant } from './scenarios';

let merchant: RunState;
beforeAll(() => { merchant = firstMerchant(); });

describe('real merchant transactions', () => {
  it('reaches a funded merchant using legitimate commands, with a replay-valid journal', () => {
    expect(merchant).toMatchObject({ round: 3, phase: 'merchant', coins: 784, scrap: 22, seals: 2 });
    expect(merchant.journal).toHaveLength(97);
    expect(validateRun(merchant)).toEqual({ ok: true, state: merchant });
    expect(getRunView(merchant).merchant.offers.map(offer => [offer.productId, offer.price, offer.availability.allowed]))
      .toEqual([
        ['handle', { coins: 100, scrap: 3 }, true], ['bellows', { coins: 120, scrap: 4 }, true],
        ['anvil', { coins: 160, scrap: 6 }, true], ['repair', { coins: 240, scrap: 6 }, true],
      ]);
  });

  const products: readonly [ProductId, number, number][] = [['handle', 100, 3], ['bellows', 120, 4], ['anvil', 160, 6], ['repair', 240, 6]];
  it.each(products)('buys %s once, spends both currencies atomically and never draws randomness', (productId, coins, scrap) => {
    const result = send(merchant, { type: 'buy', productId });
    expect(result.ok).toBe(true);
    expect([result.state.coins, result.state.scrap]).toEqual([784 - coins, 22 - scrap]);
    expect(result.state.rng).toEqual(merchant.rng);
    expect(result.state.pieces).toEqual(merchant.pieces);
    expect(result.state.coal).toBe(merchant.coal);
    expect(result.state.purchases).toEqual([{ afterRound: 3, product: productId, level: 1, coins, scrap }]);
    expect(result.events).toEqual([{ type: 'PurchaseMade', purchase: result.state.purchases[0] }]);
    expect(result.state.stats).toMatchObject({ coinsSpent: coins, scrapSpent: scrap });
    expect(send(result.state, { type: 'buy', productId })).toMatchObject({ ok: false, state: result.state, error: 'already_purchased' });
    expect(validateRun(result.state).ok).toBe(true);
  });

  it('applies each upgrade to the next workshop and caps repairs at three', () => {
    let state = merchant;
    for (const [productId] of products) state = act(state, { type: 'buy', productId });
    expect(state).toMatchObject({ coins: 164, scrap: 3, seals: 3, upgrades: { handle: 1, bellows: 1, anvil: 1 } });
    const next = act(state, { type: 'leaveMerchant' });
    const view = getRunView(next, { mode: 'standard' });
    expect(next.coal).toBe(2);
    expect(next.pieces).toHaveLength(3);
    expect(view.timingBands.preciseHalfWidth).toBe(800);
    expect(view.selected?.risk[1]?.damageRiskPct).toBe(1);
    expect(validateRun(next).ok).toBe(true);
  });

  it.each([['coins', 'insufficient_coins'], ['scrap', 'insufficient_scrap']] as const)('rejects missing %s with no partial spend', (currency, reason) => {
    // Deliberate local boundary fixture for one transaction; not passed off as a persisted game.
    const short = { ...merchant, [currency]: 0 };
    const result = send(short, { type: 'buy', productId: 'anvil' });
    expect(result).toEqual({ ok: false, state: short, error: reason, events: [] });
    expect(result.state).toBe(short);
  });

  it('refuses full-seal repairs, invalid product names, nonmerchant and terminal trades', () => {
    expect(send({ ...merchant, seals: 3 }, { type: 'buy', productId: 'repair' }))
      .toMatchObject({ ok: false, error: 'repair_not_needed' });
    expect(send(merchant, { type: 'buy', productId: 'toString' })).toMatchObject({ ok: false, error: 'invalid_product' });
    expect(send(newRun(), { type: 'buy', productId: 'handle' })).toMatchObject({ ok: false, error: 'wrong_phase' });
    let failed = newRun();
    for (let round = 0; round < 3; round++) {
      failed = act(failed, { type: 'settleRound', recycleRemaining: true });
      if (round < 2) failed = act(failed, { type: 'advanceSummary' });
    }
    expect(failed.phase).toBe('defeat');
    expect(send(failed, { type: 'buy', productId: 'repair' })).toMatchObject({ ok: false, error: 'wrong_phase' });
    expect(validateRun(failed).ok).toBe(true);
  });

  it.each([['handle', 180, 5], ['bellows', 220, 6], ['anvil', 260, 8]] as const)('prices second-level %s correctly and never creates a third level', (productId, coins, scrap) => {
    let state = merchant;
    for (const [id] of products) state = act(state, { type: 'buy', productId: id });
    state = secondMerchant(state);
    const before = state;
    expect(getRunView(state).merchant.offers.find(offer => offer.productId === productId)?.price).toEqual({ coins, scrap });
    state = act(state, { type: 'buy', productId });
    expect(state.upgrades[productId]).toBe(2);
    expect([before.coins - state.coins, before.scrap - state.scrap]).toEqual([coins, scrap]);
    const later = { ...state, round: 9 };
    expect(send(later, { type: 'buy', productId })).toMatchObject({ ok: false, error: 'max_level' });
    expect(validateRun(state).ok).toBe(true);
  });
});
