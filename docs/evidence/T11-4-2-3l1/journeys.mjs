import * as sdk from '../../dist/sword-led-v5.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'tmp/T11-4-2-3l1/journeys'; await mkdir(out, { recursive: true });
const attempts = [];
function runner(seed, runId) {
  const r = sdk.createRun({ runId, seed }); assert(r.ok); let state = r.state;
  const observations = [], payments = []; let income = 0, costs = 0;
  function step(action) {
    const before = state, result = sdk.applyCommand(before, { runId: before.runId, expectedRevision: before.revision, action });
    assert(result.ok, `${before.day}/${action.type}: ${result.error}`); state = result.state;
    const delta = state.coins - before.coins; income += Math.max(0, delta); costs += Math.max(0, -delta);
    assert(state.marketSpent >= 0 && state.marketSpent <= sdk.marketFor(state).budget);
    assert.equal(new Set(state.blades.map(b => b.id)).size, state.blades.length);
    assert.equal(state.coins, income - costs);
    if (action.type === 'deliver') {
      const q = sdk.deliveryQuote(before, before.blades.find(b => b.id === action.pieceId));
      assert.equal(delta, q.amount); assert.equal(state.marketSpent - before.marketSpent, q.marketCost);
      payments.push({ day: before.day, pieceId: action.pieceId, value: q.pieceValue, amount: delta, baseFee: q.baseFeeDelta, bonus: q.qualityBonus, marketRemaining: sdk.marketRemaining(state), routes: sdk.commissionProgress(state).routes });
    }
    return result;
  }
  function observe(label) { observations.push({ label, state }); }
  function finish() { assert(sdk.validateRun(state).ok); assert(income <= 6040); return { state, observations, payments, income, costs }; }
  return { get state() { return state; }, step, observe, finish };
}
function make(seed) {
  const r = runner(seed, 'v5-journey'); r.step({ type: 'continue' });
  for (let day = 1; day <= 12; day++) {
    assert.equal(r.state.day, day); r.observe(`day-${day}-start`);
    const commission = sdk.commissionFor(r.state);
    // Day 11 deliberately uses one new sword before the prepared old sword.
    const ids = sdk.getRunView(r.state).blades.filter(b => !b.reserved).map(b => b.blade.id);
    for (const id of ids) {
      if (sdk.commissionProgress(r.state).complete) break;
      for (let n = 0; n < 40; n++) {
        const b = r.state.blades.find(b => b.id === id);
        if (b.status !== 'active' || sdk.atCap(b)) break;
        if (sdk.assessBlade(r.state, b).qualifies) {
          r.step({ type: 'deliver', pieceId: id }); r.observe(`day-${day}-received-${id}`); break;
        }
        if (commission.routes.every(route => (route.crack === 'intact' && b.cracked) || (route.maxHits !== undefined && b.hits >= route.maxHits))) break;
        r.step({ type: 'strike', pieceId: id });
      }
      if (day === 11 && sdk.commissionProgress(r.state).routes.some(route => route.id === 'two-new' && route.count === 1)) {
        const old = r.state.blades.find(b => b.id === r.state.reserveId);
        assert(old, 'A real old sword is required for this mixed route witness');
        r.step({ type: 'reserve', pieceId: old.id }); assert(sdk.assessBlade(r.state, old).qualifies);
        r.step({ type: 'deliver', pieceId: old.id }); r.observe('day-11-new-then-old-complete'); break;
      }
    }
    if (!sdk.commissionProgress(r.state).complete) return { ok: false, day, ...r.finish() };
    if (r.state.gift === 'available') r.step({ type: 'claimGift', traitId: 'steady' });
    // Prepare an actual spare, with its ordinary risk, for the old-sword commissions.
    if (day === 4 || day === 10) {
      const target = day === 4 ? 420 : 1300;
      for (const item of sdk.getRunView(r.state).blades.filter(b => !b.reserved)) {
        const id = item.blade.id;
        for (let n = 0; n < 40; n++) {
          const b = r.state.blades.find(b => b.id === id);
          if (b.status !== 'active' || sdk.atCap(b) || b.value >= target) break;
          r.step({ type: 'strike', pieceId: id });
        }
        const b = r.state.blades.find(b => b.id === id);
        if (b.status === 'active' && b.value >= target) { r.step({ type: 'reserve', pieceId: id }); r.observe(`day-${day}-prepared-reserve`); break; }
      }
      if (!r.state.reserveId) return { ok: false, day, missingReserve: true, ...r.finish() };
    }
    if (day === 5 && r.state.reserveId) {
      // The old sword was unavailable to forge while reserved; release for genuine handoff.
      // It may remain unused when the new route was completed first; this run records that honestly.
      r.step({ type: 'reserve', pieceId: r.state.reserveId });
    }
    const market = sdk.getRunView(r.state).merchant;
    if (market?.canUpgrade) { r.observe(`day-${day}-merchant-before-upgrade`); r.step({ type: 'upgrade' }); }
    r.step({ type: 'settle' }); r.observe(`day-${day}-settled`);
    if (r.state.phase === 'chapter') r.step({ type: 'chooseModification', modification: day === 4 ? 'warmRack' : 'windbox' });
    if (day < 12) r.step({ type: 'advance' });
  }
  return { ok: r.state.phase === 'victory', ...r.finish() };
}
let selected;
for (let i = 0; i < 16; i++) {
  const seed = `v5-economy-${i}`, attempt = make(seed);
  attempts.push({ seed, ok: attempt.ok, stoppedDay: attempt.state.day, phase: attempt.state.phase, completed: attempt.state.history.filter(h => h.met).length, missingReserve: attempt.missingReserve ?? false, acceptedCommands: attempt.state.journal.length });
  await writeFile(`${out}/attempts.json`, JSON.stringify(attempts, null, 2) + '\n');
  if (attempt.ok) { selected = attempt; break; }
}
assert(selected, 'No complete mixed-route witness within the declared 16-seed bound');
await writeFile(`${out}/victory.json`, JSON.stringify(selected, null, 2) + '\n');
const start12 = selected.observations.find(o => o.label === 'day-12-start').state;
const home = sdk.applyCommand(start12, { runId: start12.runId, expectedRevision: start12.revision, action: { type: 'settle' } });
assert(home.ok && home.state.phase === 'return'); assert(sdk.validateRun(home.state).ok);
await writeFile(`${out}/return.json`, JSON.stringify(home.state, null, 2) + '\n');
const lost = runner('v5-missed-days', 'v5-defeat'); lost.step({ type: 'continue' });
for (let day = 1; day <= 3; day++) { lost.step({ type: 'settle' }); if (day < 3) lost.step({ type: 'advance' }); }
assert.equal(lost.state.phase, 'defeat'); const defeat = lost.finish();
await writeFile(`${out}/defeat.json`, JSON.stringify(defeat, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, attempts: attempts.length, selectedSeed: selected.state.seed, victory: selected.state.history.filter(h => h.met).length, grossIncome: selected.income, costs: selected.costs, wallet: selected.state.coins, states: selected.observations.length + 3, endings: [selected.state.phase, home.state.phase, defeat.state.phase], payments: selected.payments.length }));
