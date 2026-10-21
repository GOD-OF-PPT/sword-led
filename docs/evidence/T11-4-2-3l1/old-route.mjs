import * as sdk from '../../dist/sword-led-v5.js';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const witness = JSON.parse(await readFile('tmp/T11-4-2-3l1/journeys/victory.json', 'utf8'));
let state = witness.observations.find(o => o.label === 'day-5-start').state;
assert(sdk.validateRun(state).ok);
assert(sdk.getRunView(state).commission.request.includes('此前'));
const before = state, old = state.blades.find(b => b.id === state.reserveId);
assert(old && old.suppliedDay < state.day && old.value >= 420);
assert.equal(state.blades.filter(b => b.suppliedDay === 5).length, 2);
function step(action) {
  const result = sdk.applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action });
  assert(result.ok); state = result.state; return result;
}
step({ type: 'reserve', pieceId: old.id });
const quote = sdk.deliveryQuote(state, old); assert(quote.allowed && quote.matched); assert.equal(quote.threshold, 420); assert.equal(quote.baseFeeDelta, 250);
const delivered = step({ type: 'deliver', pieceId: old.id });
assert.equal(sdk.commissionProgress(state).routeId, 'old'); assert(sdk.validateRun(state).ok);
const after = state;
// Rebuild the actual chapter-summary prefix; projections do not mutate a save.
const created = sdk.createRun({ runId: before.runId, seed: before.seed, mode: before.mode, eligibility: before.initialEligibility }); assert(created.ok); state = created.state;
for (const action of before.journal) {
  if (action.type === 'advance' && state.day === 4) break;
  step(action);
}
assert.equal(state.day, 4); assert.equal(state.phase, 'summary');
const view = sdk.getRunView(state), projected = view.next;
assert(projected && projected.newCount === 2 && projected.oldCount === 1 && projected.totalCount === 3);
assert(projected.commission.request.includes('此前'));
assert(projected.reserve.assessment.qualifies); assert.equal(projected.reserve.value, old.value);
assert.equal(projected.reserve.value, Math.floor(state.blades.find(b => b.id === state.reserveId).value * 115 / 100));
assert(sdk.validateRun(state).ok);
await writeFile('tmp/T11-4-2-3l1/old-route.json', JSON.stringify({ ok: true, states: { before, after, chapterSummary: state }, quote, deliveredEvents: delivered.events, next: projected }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, route: 'old', baseFee: quote.baseFeeDelta, warmRackValue: old.value, newBlanks: 2, acceptedCommands: 2, savedObservations: 3 }));
