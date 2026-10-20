import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as sdk from '../../dist/sword-led-v4.js';
import {PROFILES, observe, decide} from '../../scripts/v4-model-policy.mjs';

const expected = ['balanced-steady','balanced-ember','low-hammer','burst-first','cracked-commission','old-first','new-only','fixed-3','fixed-6','fixed-7','fixed-10','without-reserve','without-upgrades','without-traits','without-repair','without-optional-growth','decline-events','warm-wide','wind-warm','prefer-inherit','risky-no-inherit','prefer-crackedEdge','cracked-no-edge','duplicate','reload','raw','scrap','blind','qualified-story','qualified-challenge'];
const profile = id => PROFILES.find(item => item.id === id);
function observation(state) {
 const view = sdk.getRunView(state);
 const quotes = [null, ...view.blades.map(item => item.blade.id)].map(pieceId => ({ pieceId, ...sdk.eventQuote(state, pieceId ?? undefined) }));
 return observe(view, quotes);
}
function play(p, seed, eligibility) {
 const created = sdk.createRun({runId:'policy-small-sample', seed, mode:p.mode, ...(eligibility ? {eligibility} : {})});
 assert(created.ok);
 let state = created.state;
 const memory = {}, actions = [];
 while (!['victory','return','defeat'].includes(state.phase)) {
  assert(actions.length < 1000, `${p.id} finite budget`);
  const view = observation(state), action = decide(view, p, memory);
  assert(action, `${p.id} ${state.day} ${state.phase} needs an action`);
  const result = sdk.applyCommand(state, {runId:state.runId, expectedRevision:state.revision, action});
  assert(result.ok, `${p.id} ${state.day} ${JSON.stringify(action)}: ${result.error}`);
  state = result.state; actions.push(action);
 }
 assert.equal(decide(observation(state), p, memory), null);
 const checked = sdk.validateRun(state); assert(checked.ok); assert.deepEqual(checked.state, state);
 return {state, actions};
}

test('thirty explicit profiles are ordered, deeply frozen and qualified cohorts are separate', () => {
 assert.deepEqual(PROFILES.map(item => item.id), expected);
 assert.equal(new Set(expected).size, 30);
 assert.equal(PROFILES.filter(item => item.qualified).length, 2);
 for (const p of PROFILES) { assert(Object.isFrozen(p)); assert(Object.isFrozen(p.rank)); assert(Object.isFrozen(p.modifications)); }
 assert.throws(() => PROFILES[0].rank.push('secret'));
});

test('public projection is detached and drops nested identity, random streams and replay capabilities', () => {
 const made = sdk.createRun({runId:'hidden-run', seed:'hidden-seed'}); assert(made.ok);
 const source = structuredClone(sdk.getRunView(made.state));
 source.seed = 'secret'; source.runId = 'secret'; source.rng = {forge:{state:7}}; source.journal = ['secret']; source.eventDeck = ['secret'];
 source.collection.works.push({runId:'secret'});
 source.blades[0].blade.seed = 'secret'; source.blades[0].odds.rng = 'secret'; source.next.commission.routes[0].seed = 'secret';
 const publicView = observe(source, [{pieceId:null, allowed:false, cost:0, error:'unavailable', rng:'secret'}]);
 const forbidden = new Set(['seed','runId','rng','journal','eventDeck','collection']);
 function check(value) { if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { assert(!forbidden.has(key), key); check(child); } }
 check(publicView); assert(!JSON.stringify(publicView).includes('secret')); assert(Object.isFrozen(publicView.blades[0].blade));
 source.blades[0].blade.value = 9999; assert.equal(publicView.blades[0].blade.value, 40);
 assert(!Object.isFrozen(source)); assert(!Object.isFrozen(source.blades[0].blade));
});

test('all new-player profiles finish legal bounded small samples and are deterministic', () => {
 const rows = new Map();
 for (const p of PROFILES.filter(item => !item.qualified)) rows.set(p.id, play(p, 'v4-pilot-policy-test-0'));
 for (const id of ['balanced-ember','old-first','fixed-7','raw','blind']) assert.deepEqual(play(profile(id), 'v4-pilot-policy-test-0'), rows.get(id));
 for (const id of ['duplicate','reload']) assert.deepEqual(rows.get(id), rows.get('balanced-ember'));
 for (const id of ['without-traits','without-optional-growth']) assert(!rows.get(id).actions.some(action => ['buy','claimGift'].includes(action.type)));
 for (const id of ['fixed-3','fixed-6','fixed-7','fixed-10']) {
  const p = profile(id);
  for (const piece of rows.get(id).state.blades.filter(item => ['sold','commissioned'].includes(item.status))) {
   assert(piece.hits + piece.bursts === p.fixedClicks || piece.value >= 1_000_000_000 || piece.level >= 99, `${id} must not stop early at a qualifying value or an incompatible route`);
  }
 }
});

test('qualified story and challenge use qualification earned by a fully replayed actual victory', async () => {
 const winner = JSON.parse(await readFile(new URL('../../docs/evidence/T11-4-2-3i1/witness-fixed/complete.json', import.meta.url), 'utf8'));
 const checked = sdk.validateRun(winner); assert(checked.ok); assert.deepEqual(checked.state, winner); assert.equal(winner.phase, 'victory');
 const earned = sdk.getCollectionAwards(winner), eligibility = {recipes:earned.recipes, challenge:earned.challenge};
 assert.equal(eligibility.challenge, true);
 for (const id of ['qualified-story','qualified-challenge']) {
  const run = play(profile(id), 'v4-pilot-policy-qualified', eligibility);
  assert.deepEqual(run.state.initialEligibility, eligibility);
  assert.equal(run.state.mode, profile(id).mode);
 }
});

test('gift options follow actual free choices and do not invent the gold alternative', () => {
 const made = sdk.createRun({runId:'gift-test', seed:'v4-pilot-gift'}); assert(made.ok);
 const original = observation(made.state);
 const available = {...original, phase:'workshop', gift:{canClaim:true, status:'available'}};
 assert.deepEqual(decide(available, profile('balanced-ember')), {type:'claimGift', traitId:'ember'});
 assert.deepEqual(decide({...available, traits:[{id:'ember'}]}, profile('balanced-ember')), {type:'claimGift', traitId:'steady'});
 assert.deepEqual(decide({...available, traits:[{id:'ember'},{id:'steady'}]}, profile('balanced-ember')), {type:'claimGift', traitId:null});
 assert.notEqual(decide(available, profile('without-traits')).type, 'claimGift');
});

test('event decisions preserve an expensive old sword and decline unavailable quotes', () => {
 const made = sdk.createRun({runId:'event-test', seed:'v4-pilot-event'}); assert(made.ok);
 const original = observation(made.state), kept = {...original.blades[0], reserved:true, blade:{...original.blades[0].blade, value:500}};
 const v = {...original, phase:'workshop', commission:{...original.commission, progress:{...original.commission.progress, complete:true}}, blades:[kept], gift:{canClaim:false}, event:{id:'salvage', piece:'reserve', status:'available'}, eventQuotes:[{pieceId:kept.blade.id, allowed:true,cost:0,error:null}]};
 assert.deepEqual(decide(v, profile('balanced-ember'), {}), {type:'chooseEvent', choice:'decline'});
 assert.deepEqual(decide({...v, event:{id:'loan',piece:'none',status:'available'}, eventQuotes:[{pieceId:null,allowed:false,cost:60,error:'insufficient_coins'}]}, profile('balanced-ember'), {}), {type:'chooseEvent', choice:'decline'});
});

test('chapter preparation accounts for the planned warm rack and does not over-hammer an adequate old sword', () => {
 const made = sdk.createRun({runId:'warm-plan-test', seed:'v4-pilot-warm-plan'}); assert(made.ok);
 const original = observation(made.state), piece = {...original.blades[0], blade:{...original.blades[0].blade,value:400,hits:3}, canStrike:true, canChangeRecipe:false};
 const nextCommission = {...original.next.commission, routes:[{id:'old',count:1,value:420,age:'old'}]};
 const v = {...original, day:4, phase:'workshop', blades:[piece], gift:{canClaim:false}, commission:{...original.commission,progress:{...original.commission.progress,complete:true}}, next:{...original.next,day:5,commission:nextCommission}, modifications:[]};
 assert.deepEqual(decide(v, profile('old-first'), {}), {type:'reserve',pieceId:piece.blade.id});
 const memory = {};
 const kept = {...v, blades:[{...piece,reserved:true,canStrike:false}], next:{...v.next,reserve:{id:piece.blade.id,value:400,cracked:false,charge:0}}};
 assert.deepEqual(decide(kept, profile('old-first'), memory), {type:'settle'});
 assert.equal(memory.prepared,true);
});
