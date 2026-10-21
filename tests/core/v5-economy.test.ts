import {describe, expect, it} from 'vitest';
import * as api from '../../src/core-v5/index.js';
import type {Action, Blade, RunState} from '../../src/core-v5/index.js';

// Every RunState below comes from Accepted commands. Only the fraction helper
// takes isolated mathematical examples; those are not claimed as saved runs.
function created(seed: string) {
 const result = api.createRun({runId: 'economy-v5', seed});
 if (!result.ok) throw Error(result.error);
 return result.state;
}
function accepted(state: RunState, action: Action) {
 const result = api.applyCommand(state, {runId: state.runId, expectedRevision: state.revision, action});
 if (!result.ok) throw Error(`${state.seed}/${state.day}/${action.type}: ${result.error}`);
 return result;
}
const step = (state: RunState, action: Action) => accepted(state, action).state;
const opened = (seed: string) => step(created(seed), {type: 'continue'});
function piece(state: RunState, id: string): Blade {
 const found = state.blades.find(blade => blade.id === id);
 if (!found) throw Error(`Missing ${id}`);
 return found;
}
function strike(state: RunState, id: string, count: number) {
 for (let n = 0; n < count; n++) state = step(state, {type: 'strike', pieceId: id});
 return state;
}
function rejectUnchanged(state: RunState, action: Action, error: api.ErrorCode) {
 const before = JSON.stringify(state);
 const result = api.applyCommand(state, {runId: state.runId, expectedRevision: state.revision, action});
 expect(result.ok).toBe(false);
 if (!result.ok) expect(result.error).toBe(error);
 expect(result.state).toBe(state);
 expect(result.events).toEqual([]);
 expect(JSON.stringify(state)).toBe(before);
}
function replay(state: RunState) {
 const result = api.validateRun(JSON.parse(JSON.stringify(state)));
 expect(result.ok).toBe(true);
 if (result.ok) expect(result.state).toEqual(state);
}
function firstCommission(seed: string) {
 const ready = strike(opened(seed), 'd1-1', 3);
 expect(api.assessBlade(ready, piece(ready, 'd1-1')).qualifies).toBe(true);
 return {ready, delivered: accepted(ready, {type: 'deliver', pieceId: 'd1-1'})};
}
function merchant(seed: string) {
 let state = firstCommission(seed).delivered.state;
 state = step(step(state, {type: 'settle'}), {type: 'advance'});
 state = step(step(state, {type: 'settle'}), {type: 'advance'});
 expect(state.day).toBe(3);
 return state;
}

describe('forge-v5 finite workshop economy', () => {
 it('pays cumulative OR progress once: 125+125 and 300+300, with integer rounding at the end', () => {
  const two = (count: number) => ({routes: [{count, required: 2}]});
  expect([0, 1, 2, 3].map(count => api.cumulativeBaseFee(two(count), 250))).toEqual([0, 125, 250, 250]);
  const alternative = (old: number, fresh: number) => ({routes: [{count: old, required: 1}, {count: fresh, required: 2}]});
  const amounts = [alternative(0, 0), alternative(0, 1), alternative(1, 1)].map(progress => api.cumulativeBaseFee(progress, 600));
  expect(amounts).toEqual([0, 300, 600]);
  expect([amounts[1]! - amounts[0]!, amounts[2]! - amounts[1]!]).toEqual([300, 300]);
  expect(api.cumulativeBaseFee({routes: [{count: 1, required: 3}, {count: 1, required: 2}]}, 100)).toBe(50);
  expect(api.cumulativeBaseFee({routes: [{count: 2, required: 3}]}, 100)).toBe(66);
 });

 it('quotes the first real receipt as wage plus bounded quality, never as the full piece value', () => {
  const {ready, delivered} = firstCommission('v5-receipt');
  const blade = piece(ready, 'd1-1'), bonus = Math.min(Math.floor((blade.value - 100) / 5), 60);
  expect(api.marketFor(ready)).toEqual({baseFee: 100, budget: 60});
  expect(api.deliveryQuote(ready, blade)).toMatchObject({pieceValue: blade.value, matched: true, matchedRouteIds: ['intact'], threshold: 100, baseFeeDelta: 100, qualityBonus: bonus, amount: 100 + bonus, marketCost: bonus, allowed: true, error: null});
  expect(delivered.state.coins - ready.coins).toBe(100 + bonus);
  expect(delivered.state.marketSpent).toBe(bonus);
  expect(delivered.events.find(event => event.type === 'Delivered')).toMatchObject({amount: 100 + bonus, baseFeeDelta: 100, qualityBonus: bonus, pieceValue: blade.value, marketRemaining: 60 - bonus});
  expect(piece(delivered.state, blade.id).status).toBe('commissioned');
  replay(delivered.state);
 });

 it('shares one purse between quality and ordinary sales, rejects a zero sale without a journal entry, and permits explicit zero recovery', () => {
  const {ready, delivered} = firstCommission('v5-purse-0');
  let state = strike(delivered.state, 'd1-2', 4);
  const blade = piece(state, 'd1-2'), remaining = 60 - delivered.state.marketSpent;
  expect(Math.floor(blade.value / 4)).toBeGreaterThanOrEqual(remaining);
  const quote = api.deliveryQuote(state, blade);
  expect(quote).toMatchObject({matched: false, baseFeeDelta: 0, qualityBonus: 0, amount: remaining, marketCost: remaining, allowed: true});
  const beforeSale = state;
  state = step(state, {type: 'deliver', pieceId: blade.id});
  expect(state.coins - beforeSale.coins).toBe(remaining);
  expect(state.coins).toBe(160);
  expect(state.marketSpent).toBe(60);
  expect(api.marketRemaining(state)).toBe(0);
  expect(api.deliveryQuote(state, piece(state, 'd1-3'))).toMatchObject({matched: false, amount: 0, allowed: false, error: 'market_exhausted'});
  rejectUnchanged(state, {type: 'deliver', pieceId: 'd1-3'}, 'market_exhausted');
  const zeroScrap = accepted(state, {type: 'scrap', pieceId: 'd1-3'});
  expect(zeroScrap.state.coins).toBe(state.coins);
  expect(zeroScrap.state.marketSpent).toBe(60);
  expect(piece(zeroScrap.state, 'd1-3').status).toBe('recycled');
  expect(zeroScrap.events.find(event => event.type === 'Disposed')).toMatchObject({amount: 0, marketRemaining: 0});
  const gift = accepted(state, {type: 'claimGift', traitId: 'steady'});
  expect(gift.state.traits).toContain('steady');
  expect(gift.state.coins).toBe(state.coins);
  expect(gift.state.marketSpent).toBe(60);
  const settled = step(state, {type: 'settle'});
  expect(settled.history[0]).toMatchObject({baseFees: 100, marketSpent: 60, recovered: 0, recoveredIds: ['d1-3'], met: true});
  expect(settled.marketSpent).toBe(60);
  const next = step(settled, {type: 'advance'});
  expect(next.marketSpent).toBe(0);
  expect(next.coins).toBe(settled.coins);
  expect(api.marketRemaining(next)).toBe(60);
  for (const branch of [ready, state, zeroScrap.state, gift.state, settled, next]) replay(branch);
 });

 it('uses original base recovery for a real broken sword and debits active recovery and closing leftovers from the same purse', () => {
  let state = step(opened('v5-break'), {type: 'scrap', pieceId: 'd1-3'});
  expect(state.marketSpent).toBe(10);
  let brokenEvent: api.Hit | undefined;
  for (let n = 0; n < 40 && piece(state, 'd1-1').status === 'active'; n++) {
   const result = accepted(state, {type: 'strike', pieceId: 'd1-1'});
   const event = result.events.find(event => event.type === 'Strike');
   if (event?.type === 'Strike') brokenEvent = event.hits.find(hit => hit.result === 'broken') ?? brokenEvent;
   state = result.state;
  }
  expect(piece(state, 'd1-1').status).toBe('broken');
  expect(brokenEvent?.recoveryAmount).toBe(10);
  expect(piece(state, 'd1-1').peak).toBeGreaterThan(40);
  expect(state.marketSpent).toBe(20);
  expect(state.coins).toBe(20);
  const settled = step(state, {type: 'settle'});
  expect(settled.history[0]).toMatchObject({baseFees: 0, recovered: 30, marketSpent: 30, recoveredIds: ['d1-2'], met: false});
  expect(settled.coins).toBe(30);
  expect(settled.marketSpent).toBe(30);
  replay(settled);
 });

 it('carries one original sword plus two new blanks and never replenishes a disposed carry-over slot', () => {
  let state = firstCommission('v5-reserve').delivered.state;
  state = strike(state, 'd1-3', 2);
  state = step(state, {type: 'reserve', pieceId: 'd1-3'});
  const old = piece(state, 'd1-3');
  state = step(step(state, {type: 'settle'}), {type: 'advance'});
  expect(piece(state, old.id)).toEqual(old);
  expect(state.blades.filter(blade => blade.status === 'active')).toHaveLength(3);
  expect(state.blades.filter(blade => blade.suppliedDay === 2)).toHaveLength(2);
  state = step(state, {type: 'reserve', pieceId: old.id});
  expect(state.reserveId).toBeNull();
  state = step(state, {type: 'scrap', pieceId: old.id});
  expect(state.blades.filter(blade => blade.suppliedDay === 2)).toHaveLength(2);
  expect(state.blades.filter(blade => blade.status === 'active')).toHaveLength(2);
  replay(state);
 });

 it('barters only level-three work while the first free gift can be claimed without a worked blade', () => {
  let state = merchant('v5-barter');
  const freeGift = step(state, {type: 'claimGift', traitId: 'steady'});
  expect(freeGift.blades).toEqual(state.blades);
  expect(freeGift.coins).toBe(state.coins);
  state = freeGift;
  const trait = state.shop.find(id => !state.traits.includes(id));
  if (!trait) throw Error('Expected one merchant item outside the free gift');
  expect(api.barterAssessment(state, piece(state, 'd3-1'))).toMatchObject({allowed: false, error: 'blade_unworked'});
  rejectUnchanged(state, {type: 'buy', pieceId: 'd3-1', traitId: trait}, 'blade_unworked');
  state = strike(state, 'd3-1', 1);
  expect(piece(state, 'd3-1').level).toBeLessThan(3);
  rejectUnchanged(state, {type: 'buy', pieceId: 'd3-1', traitId: trait}, 'blade_unworked');
  for (let n = 0; n < 2 && piece(state, 'd3-1').level < 3; n++) state = strike(state, 'd3-1', 1);
  expect(piece(state, 'd3-1').level).toBeGreaterThanOrEqual(3);
  const before = state;
  state = step(state, {type: 'buy', pieceId: 'd3-1', traitId: trait});
  expect(piece(state, 'd3-1').status).toBe('traded');
  expect(state.traits).toContain(trait);
  expect(state.coins).toBe(before.coins);
  expect(state.marketSpent).toBe(before.marketSpent);
  replay(state);
 });

 it('accepts a real unfinished commission after the purse is empty and still pays its base wage', () => {
  let exhausted = merchant('v5-empty-wage-0');
  exhausted = step(exhausted, {type: 'claimGift', traitId: 'steady'});
  exhausted = strike(exhausted, 'd3-1', 6);
  exhausted = step(exhausted, {type: 'deliver', pieceId: 'd3-1'});
  exhausted = strike(exhausted, 'd3-2', 7);
  expect(exhausted.marketSpent).toBe(60);
  expect(api.commissionProgress(exhausted).complete).toBe(false);
  expect(api.deliveryQuote(exhausted, piece(exhausted, 'd3-2'))).toMatchObject({matched: true, allowed: true, error: null, amount: 100, baseFeeDelta: 100, qualityBonus: 0, marketCost: 0});
  const result = accepted(exhausted, {type: 'deliver', pieceId: 'd3-2'});
  expect(result.state.coins - exhausted.coins).toBe(100);
  expect(result.state.marketSpent).toBe(60);
  expect(api.commissionProgress(result.state).complete).toBe(true);
  expect(result.events.find(event => event.type === 'Delivered')).toMatchObject({baseFeeDelta: 100, qualityBonus: 0, marketRemaining: 0});
  replay(result.state);
 });

 it('pays the one-off forty-coin delayed gift compensation independently of the empty purchase purse', () => {
  let exhausted = merchant('v5-delayed-gift-1');
  expect(exhausted.shop).toEqual(expect.arrayContaining(['steady', 'ember']));
  exhausted = strike(exhausted, 'd3-1', 3);
  exhausted = step(exhausted, {type: 'buy', pieceId: 'd3-1', traitId: 'steady'});
  exhausted = strike(exhausted, 'd3-2', 3);
  exhausted = step(exhausted, {type: 'buy', pieceId: 'd3-2', traitId: 'ember'});
  exhausted = strike(exhausted, 'd3-3', 6);
  exhausted = step(exhausted, {type: 'deliver', pieceId: 'd3-3'});
  expect(exhausted.gift).toBe('available');
  expect(exhausted.marketSpent).toBe(60);
  const result = accepted(exhausted, {type: 'claimGift', traitId: null});
  expect(result.state.coins - exhausted.coins).toBe(40);
  expect(result.state.marketSpent).toBe(60);
  expect(result.state.gift).toBe('claimed');
  expect(result.events.find(event => event.type === 'Trait')).toMatchObject({traitId: null, compensation: 40});
  rejectUnchanged(result.state, {type: 'claimGift', traitId: null}, 'unavailable');
  replay(result.state);
 });
});
