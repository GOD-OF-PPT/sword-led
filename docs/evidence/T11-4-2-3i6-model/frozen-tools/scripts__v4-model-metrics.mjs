import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {COMMISSIONS} from '../dist/sword-led-v4.js';

const TRAITS = ['steady', 'ember', 'inherit', 'echo', 'crackedEdge', 'pardon'];
const MODIFICATIONS = ['windbox', 'warmRack', 'wideMouth'];
const EVENT_IDS = ['donation', 'loan', 'salvage', 'credit', 'shelter', 'rest'];
const TRIGGERS = [...TRAITS, ...MODIFICATIONS, 'loan', 'credit', 'shelter'];
const RECIPES = ['light', 'guard', 'heavy'];
const TERMINAL = ['victory', 'return', 'defeat'];
const STATUS = ['active', 'commissioned', 'sold', 'recycled', 'broken', 'traded', 'donated', 'bartered'];
const COSTS = {3: {upgrade: 180, repair: 150}, 6: {upgrade: 700, repair: 350}, 9: {upgrade: 1600, repair: 800}};
const NUMBERS = ['strikes', 'normalHits', 'burstActions', 'internalHits', 'cracks', 'broken', 'upgrades', 'repairs', 'reserves', 'retrieves', 'deliveredCount', 'commissionedCount', 'sales', 'recoveredCoins', 'giftCoins', 'eventIncome', 'spentCoins', 'tradeValue'];
const TOTAL_FIELDS = ['commands', 'strikes', 'normalHits', 'burstActions', 'bursts', 'internalHits', 'cracks', 'broken', 'upgrades', 'repairs', 'reserves', 'retrieves', 'deliveredCount', 'commissionedCount', 'sales', 'recoveredCoins', 'giftCoins', 'eventIncome', 'spentCoins', 'tradeValue', 'atCap'];
const counters = keys => Object.fromEntries(keys.map(key => [key, 0]));
const copy = value => structuredClone(value);
const chapter = day => day <= 4 ? 0 : day <= 8 ? 1 : 2;
const recovery = blade => Math.floor(blade.base / 4);
const percent = (value, rate) => Math.min(1_000_000_000, Math.floor(value * rate / 100));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const eventCost = (id, day) => id === 'loan' ? 60 : id === 'credit' ? [90, 180, 360][chapter(day)] : id === 'shelter' ? 80 : 0;
const dayCounts = () => ({strikes: 0, normalHits: 0, burstActions: 0, internalHits: 0, cracks: 0, broken: 0, commissionAttempts: 0, attemptedRecipes: counters(RECIPES)});

function integer(value, label) {
 assert(Number.isSafeInteger(value) && value >= 0, `Expected a nonnegative safe integer: ${label}`);
}

function stateInvariant(state) {
 assert.equal(state.rulesVersion, 'forge-v4');
 integer(state.revision, 'revision');
 assert.equal(state.journal.length, state.revision);
 integer(state.coins, 'coins'); integer(state.seals, 'seals');
 assert(state.seals <= 3 && state.day >= 1 && state.day <= 12);
 assert.equal(state.blades.length, state.day * 3);
 assert.equal(new Set(state.blades.map(blade => blade.id)).size, state.blades.length);
 assert(state.blades.filter(blade => blade.status === 'active').length <= 4);
 assert(state.reserveId === null || state.blades.some(blade => blade.id === state.reserveId && blade.status === 'active'));
 assert(state.traits.length <= 3 && new Set(state.traits).size === state.traits.length && state.traits.every(id => TRAITS.includes(id)));
 assert(state.modifications.length <= 2 && new Set(state.modifications).size === state.modifications.length && state.modifications.every(id => MODIFICATIONS.includes(id)));
 for (const blade of state.blades) {
  assert.equal(blade.id, `d${blade.suppliedDay}-${blade.slot}`);
  assert(blade.suppliedDay >= 1 && blade.suppliedDay <= state.day && blade.slot >= 1 && blade.slot <= 3);
  assert(STATUS.includes(blade.status) && RECIPES.includes(blade.recipe));
  for (const key of ['base', 'value', 'peak', 'level', 'hits', 'charge', 'successes', 'normalGreats', 'bursts']) integer(blade[key], `blade.${key}`);
  assert(blade.value <= 1_000_000_000 && blade.peak <= 1_000_000_000 && blade.peak >= blade.value && blade.level <= 99 && blade.charge <= 6);
  if (blade.status === 'active') assert.equal(blade.finalizedDay, null);
  else assert(Number.isInteger(blade.finalizedDay) && blade.finalizedDay >= blade.suppliedDay && blade.finalizedDay <= state.day);
  if (blade.status === 'commissioned') assert(COMMISSIONS.some(item => item.id === blade.commissionId));
  else assert.equal(blade.commissionId, null);
 }
}

function checkSupply(state, before) {
 const base = Math.floor([40, 80, 160][chapter(state.day)] * 3 ** state.upgradeCount / 2 ** state.upgradeCount * (before?.pending.supplyPct ?? 100) / 100);
 assert.equal(state.supplyBase, base);
 const bonus = before ? Math.min(base * 4, before.inheritance) : 0;
 const supplied = state.blades.filter(blade => blade.suppliedDay === state.day);
 assert.equal(supplied.length, 3);
 for (let slot = 1; slot <= 3; slot++) {
  const blade = supplied.find(item => item.slot === slot);
  assert(blade); assert.equal(blade.base, base + (slot === 1 ? bonus : 0));
  assert.equal(blade.value, blade.base); assert.equal(blade.peak, blade.base);
  assert.equal(blade.status, 'active'); assert.equal(blade.cracked, false);
  for (const key of ['hits', 'level', 'charge', 'bursts', 'successes', 'normalGreats']) assert.equal(blade[key], 0);
 }
}

function matches(blade, route, day) {
 return blade.value >= route.value && (!route.recipe || blade.recipe === route.recipe)
  && (!route.crack || blade.cracked === (route.crack === 'cracked'))
  && (!route.age || (route.age === 'old' ? blade.suppliedDay < day : blade.suppliedDay === day))
  && (route.maxHits === undefined || blade.hits <= route.maxHits)
  && (route.minLevel === undefined || blade.level >= route.minLevel)
  && (route.minBursts === undefined || blade.bursts >= route.minBursts);
}

function progress(state) {
 const commission = COMMISSIONS[state.commissionOrder[state.day - 1] - 1]; assert(commission);
 const delivered = new Map(state.journal.flatMap((action, index) => action.type === 'deliver' ? [[action.pieceId, index]] : []));
 const blades = state.blades.filter(blade => blade.status === 'commissioned' && blade.finalizedDay === state.day && blade.commissionId === commission.id)
  .sort((a, b) => delivered.get(a.id) - delivered.get(b.id));
 for (const route of commission.routes) {
  const ids = blades.filter(blade => matches(blade, route, state.day)).map(blade => blade.id);
  if (ids.length >= route.count) return {commission, complete: true, routeId: route.id, pieceIds: ids.slice(0, route.count)};
 }
 return {commission, complete: false, routeId: null, pieceIds: []};
}

function observeOffer(state, metrics) {
 if (state.phase !== 'workshop' || state.eventStatus !== 'available' || !state.eventId || metrics.offered.has(state.day)) return;
 const stats = metrics.eventStats[state.eventId]; assert(stats);
 metrics.offered.add(state.day); stats.offered++;
 if (state.coins < eventCost(state.eventId, state.day)) stats.unaffordable++;
}

/** Start only from a fresh, formally created run; restored sessions retain the same accumulator. */
export function createMetrics(initialState) {
 stateInvariant(initialState); assert.equal(initialState.phase, 'opening'); assert.equal(initialState.revision, 0);
 assert.equal(initialState.day, 1); assert.equal(initialState.coins, 0); assert.equal(initialState.seals, 3); checkSupply(initialState);
 return {
  numbers: counters(NUMBERS), triggers: counters(TRIGGERS), days: [],
  eventStats: Object.fromEntries(EVENT_IDS.map(id => [id, {offered: 0, accepted: 0, declined: 0, unaffordable: 0, consumed: 0, coins: 0}])),
  dayCounts: dayCounts(), attempted: new Set(), offered: new Set(), capped: new Set(), state: initialState,
 };
}

/** Accounts for an Accepted command from pre-command values, independently of event monetary amounts. */
export function recordStep(before, action, result, metrics) {
 assert(result?.ok === true, `Rejected model command: ${result?.error ?? 'missing result'}`);
 assert.deepEqual(before, metrics.state, 'Missing, repeated, or reordered metrics step');
 assert(!TERMINAL.includes(before.phase), 'A terminal run cannot continue');
 const after = result.state, numbers = metrics.numbers, day = metrics.dayCounts;
 assert.equal(after.runId, before.runId); assert.equal(after.seed, before.seed); assert.equal(after.mode, before.mode);
 assert.deepEqual(after.initialEligibility, before.initialEligibility); assert.deepEqual(after.commissionOrder, before.commissionOrder);
 assert.equal(after.revision, before.revision + 1); assert.equal(after.journal.length, before.journal.length + 1);
 assert.deepEqual(after.journal.at(-1), action); assert.deepEqual(after.journal.slice(0, -1), before.journal);
 const blade = 'pieceId' in action ? before.blades.find(item => item.id === action.pieceId) : undefined;
 const changedBlade = blade ? after.blades.find(item => item.id === blade.id) : undefined;
 let income = 0, expense = 0, sales = 0, recovered = 0;
 if (['strike', 'deliver'].includes(action.type)) {
  assert(blade && blade.status === 'active' && blade.id !== before.reserveId);
  if (!progress(before).complete && !metrics.attempted.has(blade.id)) {
   metrics.attempted.add(blade.id); day.commissionAttempts++; day.attemptedRecipes[blade.recipe]++;
  }
 }
 if (action.type === 'deliver') {
  const prior = progress(before), matched = !prior.complete && prior.commission.routes.some(route => matches(blade, route, before.day));
  income += blade.value; sales += blade.value; numbers.sales += blade.value; numbers.deliveredCount++;
  numbers.commissionedCount += Number(matched);
  assert.equal(changedBlade.status, matched ? 'commissioned' : 'sold');
  assert.equal(changedBlade.commissionId, matched ? prior.commission.id : null); assert.equal(changedBlade.finalizedDay, before.day);
 }
 if (action.type === 'strike') {
  numbers.strikes++; day.strikes++;
  const strikes = result.events.filter(event => event.type === 'Strike'); assert.equal(strikes.length, 1);
  const strike = strikes[0]; assert.equal(strike.pieceId, blade.id); assert.equal(strike.burst, blade.charge === 6);
  assert(strike.hits.length >= 1 && strike.hits.length <= 4);
  if (strike.burst) { numbers.burstActions++; day.burstActions++; }
  else { numbers.normalHits++; day.normalHits++; assert.equal(strike.hits.length, 1); }
  numbers.internalHits += strike.hits.length; day.internalHits += strike.hits.length;
  assert.equal(strike.hits[0].before, blade.value); assert.equal(strike.hits.at(-1).after, changedBlade.value);
  for (const [index, hit] of strike.hits.entries()) {
   if (index) assert.equal(hit.before, strike.hits[index - 1].after);
   assert(['success', 'great', 'crack', 'broken'].includes(hit.result));
   if (hit.result === 'crack') { numbers.cracks++; day.cracks++; }
   if (hit.result === 'broken') { numbers.broken++; day.broken++; }
   for (const trigger of hit.triggers) {
    assert(TRIGGERS.includes(trigger)); metrics.triggers[trigger]++;
    if (['loan', 'credit', 'shelter'].includes(trigger)) metrics.eventStats[trigger].consumed++;
   }
  }
  assert.equal(changedBlade.hits, blade.hits + Number(!strike.burst));
  assert.equal(changedBlade.bursts, blade.bursts + Number(strike.burst));
  if (changedBlade.status === 'broken') { recovered += recovery(blade); assert.equal(strike.hits.at(-1).result, 'broken'); }
 }
 if (action.type === 'scrap') { assert(blade); recovered += recovery(blade); assert.equal(changedBlade.status, 'recycled'); }
 if (action.type === 'buy') { assert(blade); numbers.tradeValue += blade.value; assert.equal(changedBlade.status, 'traded'); }
 if (action.type === 'reserve') {
  if (before.reserveId === action.pieceId) numbers.retrieves++; else numbers.reserves++;
  assert.equal(after.reserveId, before.reserveId === action.pieceId ? null : action.pieceId);
 }
 if (action.type === 'claimGift' && action.traitId === null) {
  assert(before.traits.includes('steady') && before.traits.includes('ember'));
  income += 40; numbers.giftCoins += 40;
 }
 if (action.type === 'upgrade' || action.type === 'repair') {
  assert(COSTS[before.day]); expense += COSTS[before.day][action.type];
  numbers[action.type === 'upgrade' ? 'upgrades' : 'repairs']++;
 }
 const records = after.eventHistory.slice(before.eventHistory.length);
 assert(records.length <= 1); assert.deepEqual(after.eventHistory.slice(0, before.eventHistory.length), before.eventHistory);
 const resolvesEvent = action.type === 'chooseEvent' || action.type === 'settle' && before.eventStatus === 'available';
 assert.equal(records.length, Number(resolvesEvent));
 if (resolvesEvent) {
  const id = before.eventId, stats = metrics.eventStats[id], record = records[0]; assert(stats);
  const accepted = action.type === 'chooseEvent' && action.choice === 'accept';
  assert.equal(record.id, id); assert.equal(record.day, before.day); assert.equal(record.choice, accepted ? 'accept' : 'decline');
  const cost = accepted ? eventCost(id, before.day) : 0, proceeds = accepted && id === 'salvage' ? 160 : 0;
  assert.equal(record.coins, proceeds - cost); assert.equal(record.pieceId, accepted ? action.pieceId ?? null : null);
  stats[accepted ? 'accepted' : 'declined']++; stats.coins += proceeds - cost;
  income += proceeds; expense += cost; numbers.eventIncome += proceeds;
  if (accepted && id === 'salvage') { stats.consumed++; assert.equal(changedBlade.status, 'bartered'); }
  if (accepted && id === 'donation') assert.equal(changedBlade.status, 'donated');
 }
 if (action.type === 'settle') {
  const prior = progress(before), remaining = before.blades.filter(item => item.status === 'active' && item.id !== before.reserveId);
  const amount = remaining.reduce((sum, item) => sum + recovery(item), 0); recovered += amount;
  const protectedMiss = !prior.complete && before.traits.includes('pardon') && !before.pardonUsed;
  const sealsAfter = before.seals - Number(!prior.complete && !protectedMiss);
  const expected = {day: before.day, commissionId: prior.commission.id, met: prior.complete, routeId: prior.routeId, pieceIds: prior.pieceIds,
   sales: before.daySales, recovered: before.dayRecovered + amount, recoveredIds: remaining.map(item => item.id), reserveId: before.reserveId,
   sealsBefore: before.seals, sealsAfter, protected: protectedMiss, modification: null};
  assert.deepEqual(after.history.at(-1), expected); assert.equal(after.history.length, before.history.length + 1); assert.equal(after.seals, sealsAfter);
  for (const item of remaining) assert.equal(after.blades.find(value => value.id === item.id).status, 'recycled');
  const completed = after.history.filter(record => record.met).length;
  const victory = completed >= 10 && [4, 8, 12].every(date => after.history.some(record => record.day === date && record.met));
  assert.equal(after.phase, sealsAfter === 0 ? 'defeat' : before.day === 12 ? (victory ? 'victory' : 'return') : [4, 8].includes(before.day) ? 'chapter' : 'summary');
  if (protectedMiss) metrics.triggers.pardon++;
  metrics.days.push({...copy(expected), coins: after.coins, supplyBase: after.supplyBase, ...copy(day)});
 } else if (action.type === 'chooseModification') {
  assert.equal(metrics.days.at(-1)?.day, before.day); metrics.days.at(-1).modification = action.modification;
 } else assert.deepEqual(after.history, before.history);
 if (action.type === 'advance') {
  assert.equal(after.day, before.day + 1); checkSupply(after, before); assert.equal(after.inheritance, 0);
  assert.deepEqual(after.dayBuffs, before.pending); assert.deepEqual(after.pending, {supplyPct: 100, loan: false, shelter: false});
  if (before.pending.supplyPct === 120) metrics.eventStats.donation.consumed++;
  if (before.reserveId) {
   const old = before.blades.find(item => item.id === before.reserveId), kept = after.blades.find(item => item.id === before.reserveId);
   const expected = before.modifications.includes('warmRack') ? percent(old.value, 115) : old.value;
   assert.equal(kept.value, expected); assert.equal(kept.cracked, old.cracked); assert.equal(kept.charge, old.charge); assert.equal(kept.base, old.base);
   if (kept.value > old.value) metrics.triggers.warmRack++;
  }
  metrics.dayCounts = dayCounts(); metrics.attempted = new Set();
 } else { assert.equal(after.day, before.day); assert.equal(after.supplyBase, before.supplyBase); }
 income += recovered; numbers.recoveredCoins += recovered; numbers.spentCoins += expense;
 assert.equal(after.coins, before.coins + income - expense, 'Independent pre-command coin ledger differs');
 assert.equal(after.daySales, action.type === 'advance' ? 0 : before.daySales + sales);
 assert.equal(after.dayRecovered, action.type === 'advance' ? 0 : before.dayRecovered + recovered);
 if (!['settle', 'repair'].includes(action.type)) assert.equal(after.seals, before.seals);
 if (action.type === 'repair') assert.equal(after.seals, before.seals + 1);
 for (const old of before.blades) {
  const current = after.blades.find(item => item.id === old.id); assert(current);
  if (old.status !== 'active') assert.deepEqual(current, old, 'Finalized piece changed or was spent twice');
  else {
   for (const key of ['id', 'slot', 'suppliedDay', 'base']) assert.equal(current[key], old[key], `Immutable blade supply identity changed: ${key}`);
   if (action.type === 'strike' && old.id === blade?.id) {
    assert.equal(current.recipe, old.recipe); assert(['active', 'broken'].includes(current.status));
    assert.equal(current.finalizedDay, current.status === 'broken' ? before.day : null); assert.equal(current.commissionId, null);
   } else if (action.type === 'setRecipe' && old.id === blade?.id) assert.deepEqual(current, {...old, recipe: action.recipe});
   else if (action.type === 'deliver' && old.id === blade?.id) assert.deepEqual(current, {...old, status: current.status, finalizedDay: before.day, commissionId: current.commissionId});
   else if (['scrap', 'buy'].includes(action.type) && old.id === blade?.id) assert.deepEqual(current, {...old, status: action.type === 'scrap' ? 'recycled' : 'traded', finalizedDay: before.day});
   else if (action.type === 'chooseEvent' && action.choice === 'accept' && old.id === blade?.id) assert.deepEqual(current, {...old, status: before.eventId === 'donation' ? 'donated' : 'bartered', finalizedDay: before.day});
   else if (action.type === 'settle' && old.id !== before.reserveId) assert.deepEqual(current, {...old, status: 'recycled', finalizedDay: before.day});
   else if (action.type === 'advance' && old.id === before.reserveId) {
    const value = before.modifications.includes('warmRack') ? percent(old.value, 115) : old.value;
    assert.deepEqual(current, {...old, value, peak: Math.max(old.peak, value)});
   } else assert.deepEqual(current, old, 'Unrelated active piece changed');
  }
 }
 stateInvariant(after);
 for (const item of after.blades) if (item.peak >= 1_000_000_000 || item.level >= 99) metrics.capped.add(item.id);
 observeOffer(after, metrics); metrics.state = after;
}

/** Called after the runner's formal full-journal validation of this terminal state. */
export function finishRow(state, profile, index, metrics) {
 assert(TERMINAL.includes(state.phase)); assert.deepEqual(state, metrics.state); stateInvariant(state);
 assert(Number.isInteger(index) && index >= 0 && index < 1000); const id = typeof profile === 'string' ? profile : profile.id; assert(typeof id === 'string' && id);
 assert.equal(state.history.length, state.day); assert.equal(metrics.days.length, state.history.length);
 for (const [dayIndex, record] of state.history.entries()) {
  const measured = metrics.days[dayIndex]; assert.equal(measured.day, dayIndex + 1);
  for (const [key, value] of Object.entries(record)) assert.deepEqual(measured[key], value);
 }
 const numbers = metrics.numbers;
 assert.equal(numbers.sales, state.history.reduce((sum, record) => sum + record.sales, 0));
 assert.equal(numbers.recoveredCoins, state.history.reduce((sum, record) => sum + record.recovered, 0));
 assert.equal(state.coins, numbers.sales + numbers.recoveredCoins + numbers.giftCoins + numbers.eventIncome - numbers.spentCoins);
 assert.equal(numbers.strikes, numbers.normalHits + numbers.burstActions);
 const bursts = state.blades.reduce((sum, blade) => sum + blade.bursts, 0); assert.equal(bursts, numbers.burstActions);
 return {
  profile: id, index, seed: state.seed, mode: state.mode, phase: state.phase, day: state.day, commands: state.revision,
  strikes: numbers.strikes, normalHits: numbers.normalHits, burstActions: numbers.burstActions, bursts, internalHits: numbers.internalHits,
  cracks: numbers.cracks, broken: numbers.broken, upgrades: numbers.upgrades, repairs: numbers.repairs, reserves: numbers.reserves, retrieves: numbers.retrieves,
  deliveredCount: numbers.deliveredCount, commissionedCount: numbers.commissionedCount, sales: numbers.sales, recoveredCoins: numbers.recoveredCoins,
  giftCoins: numbers.giftCoins, eventIncome: numbers.eventIncome, spentCoins: numbers.spentCoins, tradeValue: numbers.tradeValue,
  coins: state.coins, seals: state.seals, met: state.history.filter(record => record.met).length, peak: Math.max(...state.blades.map(blade => blade.peak)),
  atCap: metrics.capped.size, traits: [...state.traits], modifications: [...state.modifications], triggers: copy(metrics.triggers), days: copy(metrics.days),
  eventStats: copy(metrics.eventStats), stateSha256: hash(state),
 };
}

function distribution(values) {
 const sorted = [...values].sort((a, b) => a - b); assert(sorted.length);
 return {min: sorted[0], p10: sorted[Math.floor((sorted.length - 1) * .1)], p50: sorted[Math.floor((sorted.length - 1) * .5)],
  p90: sorted[Math.floor((sorted.length - 1) * .9)], max: sorted.at(-1), mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length};
}

/** Stable profile order and explicit finite fields prevent accidental aggregation of identities or final balances. */
export function summarizeRows(rows, profiles) {
 assert(Array.isArray(rows) && rows.length > 0 && Array.isArray(profiles) && profiles.length > 0);
 const ids = profiles.map(profile => typeof profile === 'string' ? profile : profile.id);
 assert(ids.every(id => typeof id === 'string' && id)); assert.equal(new Set(ids).size, ids.length);
 assert(rows.every(row => ids.includes(row.profile)), 'A row belongs to an undeclared profile');
 return Object.fromEntries(ids.map(id => {
  const group = rows.filter(row => row.profile === id); assert(group.length, `Missing profile ${id}`);
  return [id, {
   cases: group.length, outcomes: Object.fromEntries(TERMINAL.map(phase => [phase, group.filter(row => row.phase === phase).length])),
   twelveOfTwelve: group.filter(row => row.met === 12).length, reachedDay12: group.filter(row => row.day === 12).length,
   finalBladeMade: group.filter(row => row.days.some(day => day.day === 12 && day.met)).length,
   missingCritical: Object.fromEntries([4, 8, 12].map(day => [day, group.filter(row => !row.days.some(record => record.day === day && record.met)).length])),
   totals: Object.fromEntries(TOTAL_FIELDS.map(key => [key, group.reduce((sum, row) => sum + row[key], 0)])),
   distributions: Object.fromEntries(['commands', 'coins', 'seals', 'peak', 'met'].map(key => [key, distribution(group.map(row => row[key]))])),
   commissions: COMMISSIONS.map(commission => {
    const days = group.flatMap(row => row.days.filter(day => day.commissionId === commission.id));
    return {id: commission.id, reached: days.length, met: days.filter(day => day.met).length,
     routes: Object.fromEntries(commission.routes.map(route => [route.id, days.filter(day => day.met && day.routeId === route.id).length]))};
   }),
   traits: Object.fromEntries(TRAITS.map(trait => [trait, group.filter(row => row.traits.includes(trait)).length])),
   modifications: Object.fromEntries(MODIFICATIONS.map(modification => [modification, group.filter(row => row.modifications.includes(modification)).length])),
   triggers: Object.fromEntries(TRIGGERS.map(trigger => [trigger, group.reduce((sum, row) => sum + row.triggers[trigger], 0)])),
   events: Object.fromEntries(EVENT_IDS.map(event => [event, Object.fromEntries(['offered', 'accepted', 'declined', 'unaffordable', 'consumed', 'coins'].map(key => [key, group.reduce((sum, row) => sum + row.eventStats[event][key], 0)]))])),
  }];
 }));
}
