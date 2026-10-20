// Offline policy decisions consume only the public projection below, never a kernel or RunState.
const freeze = value => {
 if (value && typeof value === 'object') {
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
 }
 return value;
};
const rank = ['ember', 'steady', 'echo', 'pardon', 'inherit', 'crackedEdge'];
const base = {
 mode: 'story', qualified: false, strategy: 'balanced', gift: 'ember',
 traits: true, trade: true, upgrade: true, repair: true, reserve: true, events: true,
 rank, forbidTraits: [], modifications: ['windbox', 'wideMouth'],
 mainRisk: 320, crackedRisk: 180, spareMode: 'safe', spareClicks: 3, spareRisk: 0,
 routePreference: 'intact', recipePreference: 'recommended', fixedClicks: null,
};
const profile = (id, knobs = {}) => ({ ...base, id, ...knobs });
export const PROFILES = freeze([
 profile('balanced-steady', { gift: 'steady', rank: ['steady', 'ember', 'echo', 'pardon', 'inherit', 'crackedEdge'] }),
 profile('balanced-ember'),
 profile('low-hammer', { strategy: 'low' }),
 profile('burst-first', { strategy: 'burst', recipePreference: 'guard', mainRisk: 480, crackedRisk: 320, spareMode: 'burst', spareClicks: 14, spareRisk: 320 }),
 profile('cracked-commission', { strategy: 'cracked', gift: 'steady', rank: ['steady', 'crackedEdge', 'ember', 'echo', 'pardon', 'inherit'], routePreference: 'cracked', crackedRisk: 320 }),
 profile('old-first', { modifications: ['warmRack', 'wideMouth'] }),
 profile('new-only', { reserve: false }),
 ...[3, 6, 7, 10].map(fixedClicks => profile(`fixed-${fixedClicks}`, { strategy: 'fixed', fixedClicks })),
 ...['reserve', 'upgrade', 'traits', 'repair'].map(flag => profile(`without-${flag === 'upgrade' ? 'upgrades' : flag}`, { [flag]: false })),
 profile('without-optional-growth', { traits: false, trade: false, upgrade: false, events: false }),
 profile('decline-events', { events: false }),
 profile('warm-wide', { modifications: ['warmRack', 'wideMouth'] }),
 profile('wind-warm', { modifications: ['windbox', 'warmRack'] }),
 profile('prefer-inherit', { rank: ['inherit', ...rank.filter(id => id !== 'inherit')], spareMode: 'risky', spareClicks: 10, spareRisk: 600 }),
 profile('risky-no-inherit', { forbidTraits: ['inherit'], spareMode: 'risky', spareClicks: 10, spareRisk: 600 }),
 profile('prefer-crackedEdge', { rank: ['crackedEdge', ...rank.filter(id => id !== 'crackedEdge')], spareMode: 'cracked', spareClicks: 10, spareRisk: 600 }),
 profile('cracked-no-edge', { forbidTraits: ['crackedEdge'], spareMode: 'cracked', spareClicks: 10, spareRisk: 600 }),
 profile('duplicate', { probe: 'duplicate' }),
 profile('reload', { probe: 'reload' }),
 ...['raw', 'scrap', 'blind'].map(strategy => profile(strategy, { strategy, traits: false, trade: false, upgrade: false, repair: false, reserve: false, events: false })),
 profile('qualified-story', { qualified: true }),
 profile('qualified-challenge', { mode: 'challenge', qualified: true }),
]);

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] === null || ['string', 'number', 'boolean'].includes(typeof value?.[key])).map(key => [key, value[key]]));
const route = value => pick(value, ['id', 'count', 'value', 'recipe', 'crack', 'age', 'maxHits', 'minLevel', 'minBursts', 'description']);
const blade = value => pick(value, ['id', 'slot', 'suppliedDay', 'recipe', 'status', 'base', 'value', 'peak', 'level', 'cracked', 'hits', 'charge', 'successes', 'normalGreats', 'bursts', 'finalizedDay', 'commissionId']);
const progress = value => ({
 ...pick(value, ['commissionId', 'complete', 'routeId']),
 pieceIds: [...(value?.pieceIds ?? [])],
 routes: (value?.routes ?? []).map(item => ({ ...pick(item, ['id', 'required', 'count', 'complete']), pieceIds: [...(item.pieceIds ?? [])] })),
});
const commission = value => value ? {
 ...pick(value, ['id', 'title', 'customer', 'name', 'request', 'success', 'failure', 'scene', 'outcome']),
 routes: (value.routes ?? []).map(route),
 ...(value.progress ? { progress: progress(value.progress) } : {}),
} : null;
const trait = value => pick(value, ['id', 'name', 'text', 'used']);
const buffs = value => pick(value, ['supplyPct', 'loan', 'shelter']);

/** Detached deep whitelist. Unknown fields at every supported nesting level are discarded. */
export function observe(view, eventQuotes = []) {
 const next = view.next ? {
  ...pick(view.next, ['day', 'normalBase', 'merchant', 'inheritanceBonus', 'firstBase']),
  commission: commission(view.next.commission),
  reserve: view.next.reserve ? pick(view.next.reserve, ['id', 'value', 'cracked', 'charge']) : null,
 } : null;
 return freeze({
  ...pick(view, ['phase', 'day', 'mode', 'coins', 'seals', 'recommendedRecipe', 'canContinue', 'canSettle', 'canAdvance']),
  commission: commission(view.commission), next,
  recipes: (view.recipes ?? []).map(item => ({ ...pick(item, ['id', 'name', 'success', 'great', 'greatOdds']), cracks: [...(item.cracks ?? [])] })),
  blades: (view.blades ?? []).map(item => ({
   blade: blade(item.blade), ...pick(item, ['reserved', 'recovery', 'willCommission', 'canStrike', 'canChangeRecipe']),
   odds: pick(item.odds, ['burst', 'crack', 'great', 'success', 'afterBurstCrack']),
   assessment: {
    ...pick(item.assessment, ['canDeliver', 'qualifies']),
    routes: (item.assessment?.routes ?? []).map(result => ({ ...pick(result, ['id', 'matches']), missing: [...(result.missing ?? [])] })),
   },
  })),
  traits: (view.traits ?? []).map(trait), modifications: (view.modifications ?? []).map(trait), chapterChoices: (view.chapterChoices ?? []).map(trait),
  growth: view.growth ? {
   ...pick(view.growth, ['supplyBase', 'upgradeCount', 'inheritance', 'crackGuard']),
   dayBuffs: buffs(view.growth.dayBuffs), pending: buffs(view.growth.pending),
  } : null,
  merchant: view.merchant ? {
   ...pick(view.merchant, ['day', 'upgrade', 'repair', 'canUpgrade', 'canRepair']),
   offers: (view.merchant.offers ?? []).map(item => ({ ...trait(item), ...pick(item, ['sold', 'owned']) })),
  } : null,
  gift: pick(view.gift, ['status', 'canClaim']),
  event: view.event ? {
   ...pick(view.event, ['id', 'name', 'request', 'piece', 'result', 'status', 'canDecline']),
   cost: [...(view.event.cost ?? [])],
  } : null,
  eventQuotes: eventQuotes.map(item => pick(item, ['pieceId', 'allowed', 'cost', 'error'])),
 });
}

const pieceAction = (type, piece) => ({ type, pieceId: piece.blade.id });
const clicks = piece => piece.blade.hits + piece.blade.bursts;
const cheapest = (a, b) => a.blade.value - b.blade.value || a.blade.id.localeCompare(b.blade.id);
const valuable = (a, b) => -cheapest(a, b);
const owns = (v, id) => v.traits.some(item => item.id === id);
const position = (p, id) => p.rank.indexOf(id) < 0 ? 999 : p.rank.indexOf(id);
function replacement(v, p, id) {
 if (v.traits.length < 3) return {};
 const worst = [...v.traits].sort((a, b) => position(p, b.id) - position(p, a.id))[0];
 return worst && position(p, id) < position(p, worst.id) ? { replaceId: worst.id } : null;
}
function gifted(v, p) {
 if (!p.traits || !v.gift.canClaim) return null;
 const choices = [p.gift, p.gift === 'ember' ? 'steady' : 'ember'].filter(id => !owns(v, id) && !p.forbidTraits.includes(id));
 const id = choices[0];
 if (!id) return owns(v, 'steady') && owns(v, 'ember') ? { type: 'claimGift', traitId: null } : null;
 // A free gift may legally replace the least-preferred slot even if its relative rank is lower.
 const worst = [...v.traits].sort((a, b) => position(p, b.id) - position(p, a.id))[0];
 return { type: 'claimGift', traitId: id, ...(v.traits.length === 3 ? { replaceId: worst.id } : {}) };
}
function merchant(v, p) {
 if (!v.merchant) return null;
 if (p.repair && v.merchant.canRepair) return { type: 'repair' };
 if (p.upgrade && v.merchant.canUpgrade) return { type: 'upgrade' };
 const active = v.blades.filter(item => !item.reserved);
 if (!p.traits || !p.trade || active.length < 3 || v.merchant.offers.some(item => item.sold)) return null;
 const offer = [...v.merchant.offers].filter(item => !item.sold && !item.owned && !p.forbidTraits.includes(item.id)).sort((a, b) => position(p, a.id) - position(p, b.id))[0];
 if (!offer) return null;
 const replace = replacement(v, p, offer.id);
 return replace ? { type: 'buy', traitId: offer.id, pieceId: [...active].sort(cheapest)[0].blade.id, ...replace } : null;
}
function usableRoute(v, piece, condition) {
 const b = piece.blade;
 if (condition.age === 'old' && b.suppliedDay >= v.day || condition.age === 'new' && b.suppliedDay !== v.day) return false;
 if (condition.crack === 'intact' && b.cracked) return false;
 if (condition.recipe && b.recipe !== condition.recipe && (!piece.canChangeRecipe || !v.recipes.some(item => item.id === condition.recipe))) return false;
 if (condition.maxHits !== undefined && b.hits > condition.maxHits) return false;
 if (condition.maxHits !== undefined && b.hits === condition.maxHits && !piece.assessment.qualifies && !piece.odds.burst) return false;
 return true;
}
function chosenRoute(v, p, piece) {
 const routes = v.commission.routes.filter(item => usableRoute(v, piece, item));
 return routes.find(item => item.crack === p.routePreference)
  ?? routes.find(item => item.age === 'old') ?? routes[0] ?? null;
}
function desiredRecipe(v, p, piece, condition, spare = false) {
 if (condition?.recipe) return condition.recipe;
 if (spare && p.spareMode === 'cracked') return 'light';
 if (p.strategy === 'cracked' && condition?.crack === 'cracked') return 'light';
 if (condition?.minBursts && v.recipes.some(item => item.id === 'guard')) return 'guard';
 if (p.recipePreference === 'guard' && v.recipes.some(item => item.id === 'guard')) return 'guard';
 return v.recommendedRecipe;
}
function recipeAction(v, p, piece, condition, spare = false) {
 const recipe = desiredRecipe(v, p, piece, condition, spare);
 return piece.canChangeRecipe && piece.blade.recipe !== recipe && v.recipes.some(item => item.id === recipe)
  ? { type: 'setRecipe', pieceId: piece.blade.id, recipe } : null;
}
function safeToGrow(piece, p, condition = null) {
 if (!piece.canStrike) return false;
 if (p.strategy === 'low' && !piece.odds.burst && piece.blade.hits >= 3) return false;
 if (condition?.maxHits !== undefined && !piece.odds.burst && piece.blade.hits >= condition.maxHits) return false;
 return piece.odds.burst || piece.odds.crack <= (piece.blade.cracked ? p.crackedRisk : p.mainRisk);
}
function eventAction(v, p) {
 if (!v.event || v.event.status !== 'available') return null;
 const decline = { type: 'chooseEvent', choice: 'decline' };
 if (!p.events) return decline;
 let piece;
 if (v.event.piece === 'reserve') {
  piece = v.blades.find(item => item.reserved);
  const needsOld = v.next?.commission.routes.some(item => item.age === 'old');
  if (!piece || piece.blade.value > 160 || needsOld) return decline;
 } else if (v.event.piece === 'active') {
  piece = [...v.blades].filter(item => !item.reserved).sort(cheapest)[0];
  if (!piece) return decline;
 }
 const pieceId = piece?.blade.id ?? null;
 const quote = v.eventQuotes.find(item => item.pieceId === pieceId);
 return quote?.allowed ? { type: 'chooseEvent', choice: 'accept', ...(piece ? { pieceId } : {}) } : decline;
}
function prepareReserve(v, p, memory) {
 if (!p.reserve || !v.next || memory.prepared) return null;
 const condition = v.next.commission.routes.find(item => item.age === 'old');
 if (!condition) { memory.prepared = true; return null; }
 const piece = memory.prepareId ? v.blades.find(item => item.blade.id === memory.prepareId)
  : v.blades.find(item => item.reserved) ?? [...v.blades].sort(valuable)[0];
 if (!piece) { memory.prepared = true; return null; }
 memory.prepareId = piece.blade.id;
 const warmNow = v.modifications.some(item => item.id === 'warmRack');
 const warmAtChapter = [4, 8].includes(v.day) && p.modifications[v.modifications.length] === 'warmRack';
 const projected = piece.reserved && v.next.reserve?.id === piece.blade.id
  ? warmAtChapter && !warmNow ? Math.floor(v.next.reserve.value * 115 / 100) : v.next.reserve.value
  : warmNow || warmAtChapter ? Math.floor(piece.blade.value * 115 / 100) : piece.blade.value;
 if (projected >= condition.value) {
  memory.prepared = true;
  return piece.reserved ? null : pieceAction('reserve', piece);
 }
 if (piece.reserved) return pieceAction('reserve', piece);
 if (p.strategy === 'fixed' ? clicks(piece) >= p.fixedClicks || !piece.canStrike : !safeToGrow(piece, p)) {
  memory.prepared = true;
  return pieceAction('reserve', piece);
 }
 const change = recipeAction(v, { ...p, recipePreference: 'guard' }, piece, condition);
 return change ?? pieceAction('strike', piece);
}

/** One legal intent. Memory contains only this policy's observed-day preparation bookkeeping. */
export function decide(v, p, memory = {}) {
 if (['victory', 'return', 'defeat'].includes(v.phase)) return null;
 if (v.phase === 'opening') return { type: 'continue' };
 if (v.phase === 'summary') return { type: 'advance' };
 if (v.phase === 'chapter') {
  const preferred = p.modifications[v.modifications.length];
  const choice = v.chapterChoices.find(item => item.id === preferred) ?? v.chapterChoices[0];
  return { type: 'chooseModification', modification: choice.id };
 }
 if (v.phase !== 'workshop') return null;
 if (memory.day !== v.day) { memory.day = v.day; memory.prepared = false; delete memory.prepareId; }
 const active = v.blades.filter(item => !item.reserved);
 if (['raw', 'scrap', 'blind'].includes(p.strategy)) {
  const piece = active[0];
  if (!piece) return { type: 'settle' };
  return pieceAction(p.strategy === 'scrap' ? 'scrap' : p.strategy === 'blind' && piece.canStrike ? 'strike' : 'deliver', piece);
 }
 const gift = gifted(v, p); if (gift) return gift;
 const shopping = merchant(v, p); if (shopping) return shopping;
 if (!v.commission.progress.complete) {
  const candidates = [...v.blades].sort((a, b) => {
   const old = v.commission.routes.some(item => item.age === 'old');
   return Number(b.assessment.qualifies) - Number(a.assessment.qualifies)
    || (old ? Number(b.reserved) - Number(a.reserved) : Number(a.reserved) - Number(b.reserved)) || a.blade.id.localeCompare(b.blade.id);
  });
  const piece = p.strategy === 'fixed' ? candidates.find(item => !item.reserved) ?? candidates[0] : candidates.find(item => chosenRoute(v, p, item));
  if (piece) {
   if (piece.reserved) return pieceAction('reserve', piece);
   const condition = chosenRoute(v, p, piece) ?? (p.strategy === 'fixed' ? v.commission.routes[0] : null);
   const change = recipeAction(v, p, piece, condition); if (change) return change;
   if (p.strategy === 'fixed') return pieceAction(clicks(piece) >= p.fixedClicks || !piece.canStrike ? 'deliver' : 'strike', piece);
   if (piece.assessment.qualifies) return pieceAction('deliver', piece);
   return pieceAction(safeToGrow(piece, p, condition) ? 'strike' : 'deliver', piece);
  }
  // Ineligible cracked/over-hit pieces cannot regain an intact or short-hammer contract.
  if (active[0]) return pieceAction('deliver', active[0]);
 }
 const event = eventAction(v, p); if (event) return event;
 const preparation = prepareReserve(v, p, memory); if (preparation) return preparation;
 const spare = active[0];
 if (spare) {
  const change = recipeAction(v, p, spare, null, true); if (change) return change;
  if (p.strategy === 'fixed') return pieceAction(clicks(spare) >= p.fixedClicks || !spare.canStrike ? 'deliver' : 'strike', spare);
  const underLimit = clicks(spare) < p.spareClicks;
  const needsBurst = p.spareMode !== 'burst' || spare.blade.bursts === 0;
  const safe = spare.odds.burst || spare.odds.crack <= p.spareRisk;
  return pieceAction(spare.canStrike && underLimit && needsBurst && safe ? 'strike' : 'deliver', spare);
 }
 return { type: 'settle' };
}
