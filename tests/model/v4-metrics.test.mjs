import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as sdk from '../../dist/sword-led-v4.js';
import {createMetrics, recordStep, finishRow, summarizeRows} from '../../scripts/v4-model-metrics.mjs';
import {PROFILES, observe, decide} from '../../scripts/v4-model-policy.mjs';

const terminal = state => ['victory', 'return', 'defeat'].includes(state.phase);
const traits = ['steady', 'ember', 'inherit', 'echo', 'crackedEdge', 'pardon'];
const modifications = ['windbox', 'warmRack', 'wideMouth'];
const triggerIds = [...traits, ...modifications, 'loan', 'credit', 'shelter'];
function session(seed = 'v4-pilot-metrics') {
 const made = sdk.createRun({runId: 'metrics-test', seed}); assert(made.ok);
 let state = made.state; const metrics = createMetrics(state);
 return {
  get state() { return state; }, metrics,
  step(action) {
   const before = state, result = sdk.applyCommand(before, {runId: before.runId, expectedRevision: before.revision, action});
   assert(result.ok, `${before.day}/${JSON.stringify(action)}: ${result.error}`);
   recordStep(before, action, result, metrics); state = result.state; return result;
  },
  row(id = 'test', index = 0) {
   const checked = sdk.validateRun(state); assert(checked.ok); assert.deepEqual(checked.state, state);
   return finishRow(state, id, index, metrics);
  },
 };
}
function rawRun(disposition) {
 const run = session(`v4-pilot-metrics-${disposition}`); run.step({type: 'continue'});
 while (!terminal(run.state)) {
  if (run.state.phase === 'summary') { run.step({type: 'advance'}); continue; }
  for (const blade of run.state.blades.filter(blade => blade.status === 'active')) run.step({type: disposition, pieceId: blade.id});
  run.step({type: 'settle'});
 }
 return run;
}
function policyRun(id, seed) {
 const run = session(seed), profile = PROFILES.find(item => item.id === id), memory = {};
 while (!terminal(run.state)) {
  assert(run.state.revision < 1000);
  const view = sdk.getRunView(run.state);
  const quotes = [null, ...view.blades.map(item => item.blade.id)].map(pieceId => ({pieceId, ...sdk.eventQuote(run.state, pieceId ?? undefined)}));
  const action = decide(observe(view, quotes), profile, memory); assert(action); run.step(action);
 }
 return run;
}

test('raw sales and scrap recovery balance independently through an actual three-day defeat', () => {
 const raw = rawRun('deliver').row('raw'), scrap = rawRun('scrap').row('scrap');
 assert.equal(raw.phase, 'defeat'); assert.equal(scrap.phase, 'defeat');
 assert.equal(raw.commands, 15); assert.equal(scrap.commands, 15);
 assert.equal(raw.deliveredCount, 9); assert.equal(raw.commissionedCount, 0);
 assert.equal(raw.sales, 360); assert.equal(raw.recoveredCoins, 0); assert.equal(raw.coins, 360);
 assert.equal(scrap.sales, 0); assert.equal(scrap.recoveredCoins, 90); assert.equal(scrap.coins, 90);
 assert.deepEqual(raw.days.map(day => day.commissionAttempts), [3, 3, 3]);
 assert.deepEqual(scrap.days.map(day => day.commissionAttempts), [0, 0, 0]);
 assert.deepEqual(raw.days.map(day => day.attemptedRecipes), [{light: 3, guard: 0, heavy: 0}, {light: 3, guard: 0, heavy: 0}, {light: 3, guard: 0, heavy: 0}]);
 assert.deepEqual(Object.keys(raw.triggers), triggerIds); assert(Object.values(raw.triggers).every(value => value === 0));
 assert.equal(Object.values(raw.eventStats).reduce((sum, event) => sum + event.offered, 0), 1);
 assert.equal(Object.values(raw.eventStats).reduce((sum, event) => sum + event.declined, 0), 1);
});

test('normal clicks, burst actions and safe internal hits remain separate on real SDK journeys', () => {
 for (const id of ['balanced-ember', 'old-first', 'burst-first', 'prefer-inherit', 'prefer-crackedEdge']) {
  const run = policyRun(id, 'v4-pilot-metrics-complete'), row = run.row(id);
  assert.equal(row.commands, run.state.journal.length);
  assert.equal(row.strikes, run.state.journal.filter(action => action.type === 'strike').length);
  assert.equal(row.normalHits, run.state.blades.reduce((sum, blade) => sum + blade.hits, 0));
  assert.equal(row.bursts, run.state.blades.reduce((sum, blade) => sum + blade.bursts, 0));
  assert.equal(row.burstActions, row.bursts); assert.equal(row.strikes, row.normalHits + row.burstActions);
  assert(row.internalHits >= row.normalHits + row.burstActions);
  assert.equal(row.sales + row.recoveredCoins + row.giftCoins + row.eventIncome - row.spentCoins, row.coins);
  assert.deepEqual(row.days.map(day => Object.fromEntries(Object.keys(run.state.history[0]).map(key => [key, day[key]]))), run.state.history);
  assert.equal(row.days.reduce((sum, day) => sum + day.normalHits, 0), row.normalHits);
  assert.equal(row.days.reduce((sum, day) => sum + day.internalHits, 0), row.internalHits);
  assert.deepEqual(Object.keys(row.triggers), triggerIds);
  const saved = structuredClone(row); run.metrics.triggers.ember++; run.metrics.days[0].attemptedRecipes.light++;
  assert.deepEqual(row, saved, 'The finished row is detached from accumulator mutation');
 }
});

test('each event is offered at workshop entry, fixed costs and automatic declines are counted exactly once', () => {
 const frontier = JSON.parse(readFileSync(new URL('../fixtures/v4/event-route-seeds.json', import.meta.url), 'utf8')).seeds;
 for (const id of ['donation', 'loan', 'salvage', 'credit', 'shelter', 'rest']) {
  const run = session(frontier[id].seed); run.step({type: 'continue'});
  assert.equal(Object.values(run.metrics.eventStats).reduce((sum, event) => sum + event.offered, 0), 0);
  for (let day = 1; day <= 2; day++) {
   for (const blade of run.state.blades.filter(blade => blade.status === 'active')) {
    run.step({type: id === 'salvage' && day === 2 && blade.slot === 3 ? 'reserve' : 'deliver', pieceId: blade.id});
   }
   run.step({type: 'settle'}); run.step({type: 'advance'});
  }
  assert.equal(run.state.eventId, id); assert.equal(run.metrics.eventStats[id].offered, 1);
  const beforeCoins = run.state.coins;
  const pieceId = id === 'salvage' ? run.state.reserveId : id === 'donation' ? 'd3-1' : undefined;
  run.step({type: 'chooseEvent', choice: 'accept', ...(pieceId ? {pieceId} : {})});
  const cost = id === 'loan' ? 60 : id === 'credit' ? 90 : id === 'shelter' ? 80 : 0;
  assert.equal(run.state.coins, beforeCoins - cost + (id === 'salvage' ? 160 : 0));
  assert.deepEqual(run.metrics.eventStats[id], {offered: 1, accepted: 1, declined: 0, unaffordable: 0, consumed: Number(id === 'salvage'), coins: (id === 'salvage' ? 160 : 0) - cost});
 }
 for (const id of ['credit', 'shelter']) {
  const run = session(frontier[id].seed); run.step({type: 'continue'});
  for (let day = 1; day <= 2; day++) { run.step({type: 'settle'}); run.step({type: 'advance'}); }
  assert.equal(run.state.coins, 60); assert.equal(run.metrics.eventStats[id].unaffordable, 1);
  run.step({type: 'settle'}); const row = run.row();
  assert.equal(row.eventStats[id].declined, 1); assert.equal(row.eventStats[id].offered, 1); assert.equal(row.eventStats[id].accepted, 0);
 }
});

test('attempt recipes are recorded at first participation and warm rack/pardon count actual consequences', () => {
 const fixture = JSON.parse(readFileSync(new URL('../fixtures/v4/delayed-gift-route.json', import.meta.url), 'utf8'));
 const run = session(fixture.input.seed);
 for (const action of fixture.actions) run.step(action);
 assert.equal(run.state.day, 7); assert(run.state.modifications.includes('warmRack'));
 assert.equal(run.metrics.triggers.warmRack, 1); assert.equal(run.metrics.triggers.pardon, 1);
 assert.equal(run.metrics.days[5].protected, true);
 const first = session(); first.step({type: 'continue'});
 first.step({type: 'strike', pieceId: 'd1-1'}); first.step({type: 'strike', pieceId: 'd1-1'}); first.step({type: 'deliver', pieceId: 'd1-1'});
 assert.equal(first.metrics.dayCounts.commissionAttempts, 1); assert.deepEqual(first.metrics.dayCounts.attemptedRecipes, {light: 1, guard: 0, heavy: 0});
});

test('independent accounting rejects forged accepted money, supply, disposal, revision and rejected commands', () => {
 const run = session(), action = {type: 'continue'};
 const accepted = sdk.applyCommand(run.state, {runId: run.state.runId, expectedRevision: 0, action}); assert(accepted.ok);
 for (const change of [
  result => { result.state.coins = 123; },
  result => { result.state.blades[0].base = 999; },
  result => { result.state.blades[1].status = 'sold'; result.state.blades[1].finalizedDay = 1; },
  result => { result.state.revision++; },
 ]) {
  const result = structuredClone(accepted); change(result);
  assert.throws(() => recordStep(run.state, action, result, createMetrics(run.state)));
 }
 const rejected = sdk.applyCommand(run.state, {runId: run.state.runId, expectedRevision: 0, action: {type: 'advance'}});
 assert(!rejected.ok); assert.throws(() => recordStep(run.state, {type: 'advance'}, rejected, run.metrics), /Rejected model command/);
 assert.throws(() => finishRow(run.state, 'test', 0, run.metrics));
 run.step(action); assert.throws(() => recordStep(run.state, action, accepted, run.metrics));
});

test('summary reports exact order, lower-index quantiles, zero routes and explicit monetary totals', () => {
 const base = rawRun('deliver').row('one');
 const rows = [5, 1, 4, 2, 3].map((commands, index) => ({...structuredClone(base), index, commands}));
 const other = {...structuredClone(base), profile: 'two'};
 const summary = summarizeRows([...rows, other], [{id: 'two'}, {id: 'one'}]);
 assert.deepEqual(Object.keys(summary), ['two', 'one']);
 assert.deepEqual(summary.one.distributions.commands, {min: 1, p10: 1, p50: 3, p90: 4, max: 5, mean: 3});
 assert.equal(summary.one.totals.commands, 15); assert.equal(summary.one.totals.sales, 1800);
 assert(!('coins' in summary.one.totals)); assert(!('seals' in summary.one.totals)); assert(!('peak' in summary.one.totals));
 assert.equal(summary.one.outcomes.defeat, 5); assert.equal(summary.one.reachedDay12, 0);
 assert.deepEqual(summary.one.missingCritical, {4: 5, 8: 5, 12: 5});
 assert.deepEqual(summary.one.commissions[10], {id: 11, reached: 0, met: 0, routes: {old: 0, 'two-new': 0}});
 assert.deepEqual(Object.keys(summary.one.triggers), triggerIds);
 assert.throws(() => summarizeRows(rows, ['one', 'missing'])); assert.throws(() => summarizeRows(rows, ['one', 'one']));
});
