// V12.0《锤下求生 · 护炉远行》典藏版确定性规则引擎（零Emoji · 清晰推演 · 乘胜追击 · 飞剑嵌灯）
import {
  BLADE_ARCHETYPES,
  BLADE_ZONES,
  CHAPTER_INFO,
  CHOICES_DATA,
  COMPANIONS,
  DESTINY_PERKS,
  DIFFICULTY_MODES,
  HEAT_SPEED_MODES,
  NODES_DATA,
  QUENCH_TRAITS,
  RELICS_POOL,
  RELIC_SYNERGIES,
  SWORD_COMPENDIUM,
  SWORD_STANCES,
  TRIAL_CHAPTERS,
} from './v8-data.mjs';

export const V8_STORAGE_KEY = 'sword_led_v12_save_v1';
export const V8_COMPENDIUM_KEY = 'sword_led_v8_compendium_v2';

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 123456789;
}

function nextRng(rngState) {
  let t = (rngState + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const val = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value: val, next: (rngState + 0x6d2b79f5) >>> 0 };
}

export function hasRelic(state, relicId) {
  return Boolean(state?.relics?.includes(relicId));
}

export function getActiveSynergies(state) {
  const usable = (state?.weapons || []).filter((w) => isWeaponUsable(w));
  return RELIC_SYNERGIES.filter((syn) => syn.check(state, usable));
}

export function hasSynergy(state, synId) {
  return getActiveSynergies(state).some((x) => x.id === synId);
}

export function resolveWeaponZoneArt(w) {
  const zh = w?.zoneHits || { tip: 0, spine: 0, guard: 0 };
  if (zh.tip >= 2 && zh.tip >= zh.spine && zh.tip >= zh.guard) return 'tip';
  if (zh.spine >= 2 && zh.spine >= zh.guard) return 'spine';
  if (zh.guard >= 2) return 'guard';
  if (w?.archetype === 'dao') return 'spine';
  if (w?.archetype === 'cleaver') return 'guard';
  return 'tip';
}

export function evaluateBladeCompendiumIds(weapon) {
  if (!weapon || weapon.source !== 'forged') return [];
  return SWORD_COMPENDIUM.filter((item) => item.match(weapon)).map((item) => item.id);
}

export function getCompendiumTitleForBlade(weapon) {
  const ids = evaluateBladeCompendiumIds(weapon);
  if (!ids.length) return null;
  const best = SWORD_COMPENDIUM.find((x) => x.id === ids[ids.length - 1]);
  return best ? best.name : null;
}

export function createInitialState(
  seed = '护炉-2026',
  perk = 'hundred_refinements',
  skipTitle = false,
  difficulty = 'standard',
  compendiumCount = 0
) {
  const perkInfo = DESTINY_PERKS.find((p) => p.id === perk) || DESTINY_PERKS[0];
  const lampMax = perk === 'eternal_wick' ? 9 : 8;
  const startLamp = perk === 'eternal_wick' ? 8 : 7;
  const compendiumCoinBonus = compendiumCount >= 4 ? 1 : 0;
  const startCoins = (perk === 'vanguard_edge' ? 4 : 2) + compendiumCoinBonus;

  const oldSword = {
    id: 'du-old-sword',
    name: '杜伯旧剑',
    compendiumTitle: null,
    archetype: 'jian',
    quench: null,
    source: 'inherited',
    madeInChapter: 1,
    status: 'sealed',
    owner: 'player',
    strength: 3,
    sealedStrength: 3,
    hits: 3,
    perfectHits: 0,
    stars: 0,
    zoneHits: { tip: 1, spine: 0, guard: 2 },
    artZone: 'guard',
    cracked: false,
    fissureMarked: false,
    technique: null,
  };

  const base = {
    version: 'v12-classic-masterpiece',
    seed,
    rng: hashSeed(seed),
    perk,
    difficulty: difficulty === 'master' ? 'master' : 'standard',
    screen: skipTitle ? 'play' : 'title', // 'title' | 'play'
    compendiumCount,
    chapter: 1,
    node: 1,
    phase: 'prepare', // 'prepare' | 'forging' | 'encounter' | 'relicDraft' | 'choice' | 'failed' | 'ending'
    choice: null,
    pendingChoiceAfterRelic: null,
    relicOptions: [],
    relics: perkInfo.starterRelic ? [perkInfo.starterRelic] : ['relic_cauldron'],
    lamp: startLamp,
    lampMax,
    coins: startCoins,
    blanks: 3,
    charge: 1,
    qi: perk === 'vanguard_edge' ? 2 : 1,
    qiMax: 5,
    stance: 'balanced',
    hearthTriggeredChapter: 0,
    weapons: [oldSword],
    handId: 'du-old-sword',
    reserveId: null,
    forgeId: null,
    weaponSerial: 1,
    tool: null,
    upgradeUsed: false,
    retries: { 1: 0, 2: 0, 3: 0 },
    flags: {
      escortFirst: null,
      ferrymanSaved: null,
      crossingHeld: false,
      northSaved: false,
      southSaved: false,
      firstStation: null,
      ferryAssistUsed: false,
      ring: null,
      oldDecision: null,
      donatedToAlan: null,
      shelterSword: null,
      carrier: null,
      coreOwner: 'party',
    },
    stats: {
      totalForged: 0,
      perfectStrikes: 0,
      totalHammerHits: 0,
      staggerBreaks: 0,
      perfectParries: 0,
      swordArtsUsed: 0,
      dualUltimates: 0,
      enemiesDefeated: 0,
      quickSwaps: 0,
      companionAssists: 0,
      flawlessRounds: 0,
    },
    encounter: null,
    completedNodes: [],
    logs: ['带着小炉车与唯一灯芯踏入暗谷。先打一柄新剑，为同行人开路。'],
    failure: null,
    ending: null,
    checkpoint: null,
  };
  base.checkpoint = clonePlayable(base);
  return base;
}

function clonePlayable(state) {
  const copy = JSON.parse(JSON.stringify(state));
  delete copy.checkpoint;
  return copy;
}

function pushLog(state, msg) {
  state.logs.unshift(msg);
  if (state.logs.length > 20) state.logs.length = 20;
}

export function getWeapon(state, id) {
  if (!id) return null;
  return state.weapons.find((w) => w.id === id) || null;
}

export function isWeaponUsable(w) {
  return Boolean(w && w.status === 'sealed' && w.owner === 'player' && w.strength > 0);
}

export function isFinalEligible(w) {
  if (!w || !isWeaponUsable(w) || w.source !== 'forged') return false;
  return w.fissureMarked ? w.strength >= 1 : w.strength >= 3;
}

export function getDualUltCost(state) {
  return hasRelic(state, 'relic_meteor') ? 3 : 4;
}

export function canCastDualUlt(state) {
  const e = state.encounter;
  const h = getWeapon(state, state.handId);
  const r = getWeapon(state, state.reserveId);
  const cost = getDualUltCost(state);
  return Boolean(state.phase === 'encounter' && e && !e.dualUltUsed && isWeaponUsable(h) && isWeaponUsable(r) && state.qi >= cost);
}

export function getWeaponSwordArt(w) {
  if (!w) return BLADE_ZONES.tip;
  const z = w.artZone || resolveWeaponZoneArt(w);
  return BLADE_ZONES[z] || BLADE_ZONES.tip;
}

export function getSecretEndingStatus(state) {
  const benevolenceMet = Boolean(
    state.flags.ferrymanSaved && state.flags.northSaved && state.flags.southSaved && state.flags.ring === 'left'
  );
  const usableForged = [getWeapon(state, state.handId), getWeapon(state, state.reserveId)].filter(
    (w) => w && isWeaponUsable(w) && w.source === 'forged'
  );
  const maxForgedStrength = usableForged.reduce((m, w) => Math.max(m, w.strength), 0);
  const divineBladeMet = maxForgedStrength >= 6;
  const lampMet = state.lamp >= 5;
  const hand = getWeapon(state, state.handId);
  const canIgniteCelestial = Boolean(
    benevolenceMet && lampMet && hand && isWeaponUsable(hand) && hand.source === 'forged' && hand.strength >= 6
  );
  return { benevolenceMet, divineBladeMet, maxForgedStrength, lampMet, canIgniteCelestial };
}

export function formatWeaponTitle(w) {
  if (!w) return '空剑位';
  if (w.source === 'inherited') return w.name;
  if (w.compendiumTitle) return w.compendiumTitle;
  const q = w.quench ? QUENCH_TRAITS[w.quench]?.short || '' : '';
  const a = BLADE_ARCHETYPES[w.archetype]?.name || '玄铁长剑';
  return q ? `${q}·${a}` : a;
}

export function isCompanionUpgraded(state, cid) {
  if (cid === 'alan') return Boolean(state.flags.escortFirst);
  if (cid === 'he') return Boolean(state.flags.northSaved || state.flags.southSaved);
  if (cid === 'du') return Boolean(state.flags.oldDecision !== null || state.upgradeUsed);
  return false;
}

export function getCutRequirement(state, cutTarget) {
  const hand = getWeapon(state, state.handId);
  const jianDiscount = hand && hand.archetype === 'jian' ? 1 : 0;
  if (cutTarget === 'bridge-rope') return Math.max(2, 3 - jianDiscount);
  if (cutTarget === 'south-rope') return Math.max(3, 4 - jianDiscount);
  return Math.max(3, 4 - jianDiscount);
}

export function rollRelicDraftOptions(state, count = 3) {
  const pool = RELICS_POOL.filter((r) => !state.relics.includes(r.id));
  const out = [];
  let rng = state.rng;
  const mutable = [...pool];
  while (out.length < count && mutable.length > 0) {
    const r = nextRng(rng);
    rng = r.next;
    const idx = Math.floor(r.value * mutable.length) % mutable.length;
    out.push(mutable[idx].id);
    mutable.splice(idx, 1);
  }
  state.rng = rng;
  return out;
}

export function getEncounterSpec(state, encId) {
  const m = state.difficulty === 'master';
  const hp = (v) => (m ? Math.ceil(v * 1.25) : v);

  switch (encId) {
    case 'n1':
      return {
        roundLimit: 3,
        environment: [0, 0, 0],
        targets: [
          {
            id: 'wood-guard',
            name: '巡路木卫',
            role: 'threat',
            artKey: 'enemy_wood',
            health: hp(6),
            maxHealth: hp(6),
            armor: 1,
            pressures: m ? [2, 3, 3] : [2, 2, 3],
            intent: '拦在暗谷路口，举木盾逼退炉光',
          },
        ],
      };
    case 'n2':
      return {
        roundLimit: 3,
        environment: [1, 1, 2],
        targets: [
          {
            id: 'bridge-latch',
            name: '断桥铁闩',
            role: 'mechanism',
            artKey: 'enemy_winch',
            health: hp(6),
            maxHealth: hp(6),
            armor: 1,
            pressures: [0, 0, 0],
            intent: '锁死吊桥绞盘（剑够利亦可直接切索过桥）',
          },
        ],
      };
    case 'n3-main':
      return {
        roundLimit: 3,
        environment: [0, 1, 1],
        targets: [
          {
            id: 'charger',
            name: '冲阵重卫',
            role: 'threat',
            artKey: 'enemy_charger',
            health: hp(7),
            maxHealth: hp(7),
            armor: 2,
            pressures: [3, 3, 4],
            intent: '正面披甲蓄力冲撞炉车',
          },
          {
            id: 'flanker',
            name: '绕行袭影',
            role: 'threat',
            artKey: 'enemy_flanker',
            health: hp(5),
            maxHealth: hp(5),
            armor: 0,
            pressures: [2, 2, 3],
            intent: '借夜雾从侧翼偷袭灯罩',
          },
        ],
      };
    case 'n3-extra':
      return {
        roundLimit: 2,
        environment: [1, 1],
        targets: [
          {
            id: 'rammer',
            name: '撞桩重卫',
            role: 'threat',
            artKey: 'enemy_charger',
            health: hp(9),
            maxHealth: hp(9),
            armor: 2,
            pressures: [4, 4],
            intent: '抱重木猛撞渡口灯桩（撑过两轮或将其击破）',
          },
        ],
      };
    case 'n5-north':
      return {
        roundLimit: 2,
        environment: [2, 2],
        targets: [
          {
            id: 'north-latch',
            name: '北驿冰闩',
            role: 'mechanism',
            artKey: 'enemy_winch',
            health: hp(7),
            maxHealth: hp(7),
            armor: 2,
            pressures: [0, 0],
            intent: '冻死北驿大门，破闩即可救出巡守',
          },
          {
            id: 'north-guard',
            name: '封门寒卫',
            role: 'threat',
            artKey: 'enemy_flanker',
            health: hp(5),
            maxHealth: hp(5),
            armor: 1,
            pressures: [2, 3],
            intent: '在暴雪中阻挠救援',
          },
        ],
      };
    case 'n5-south':
      return {
        roundLimit: 2,
        environment: [2, 2],
        targets: [
          {
            id: 'south-latch',
            name: '南驿吊索铁扣',
            role: 'mechanism',
            artKey: 'enemy_winch',
            health: hp(7),
            maxHealth: hp(7),
            armor: 1,
            pressures: [0, 0],
            intent: '悬索封门（完好名剑可直接一剑切索）',
          },
        ],
      };
    case 'n6':
      return {
        roundLimit: 3,
        environment: [3, 3, 4],
        targets: [
          {
            id: 'roof-lock',
            name: '避难炉失控顶锁',
            role: 'mechanism',
            artKey: 'enemy_shelter',
            health: hp(10),
            maxHealth: hp(10),
            armor: 2,
            pressures: [0, 0, 0],
            intent: '危梁将塌（可强行破锁，或献出一柄 ≥3 强度的剑撑住危梁）',
          },
        ],
      };
    case 'n7':
      return {
        roundLimit: 3,
        environment: [2, 2, 3],
        targets: [
          {
            id: 'main-rock',
            name: '寒岭崩岩',
            role: 'threat',
            artKey: 'enemy_rock',
            health: hp(9),
            maxHealth: hp(9),
            armor: 2,
            pressures: [3, 4, 4],
            intent: '携万钧冰雪滚落压迫炉车',
          },
          {
            id: 'loose-rock',
            name: '侧坡飞石',
            role: 'threat',
            artKey: 'enemy_rock',
            health: hp(5),
            maxHealth: hp(5),
            armor: 1,
            pressures: [2, 2, 3],
            intent: '从山脊侧翼砸向同行队伍',
          },
        ],
      };
    case 'n8':
      return {
        roundLimit: 3,
        environment: [2, 3, 3],
        targets: [
          {
            id: 'pass-latch',
            name: '山口封路铁闸',
            role: 'mechanism',
            artKey: 'enemy_drive',
            health: hp(9),
            maxHealth: hp(9),
            armor: 2,
            pressures: [0, 0, 0],
            intent: '通往母灯台的最后石门（可破闸、切索或借昔日侧路接应）',
          },
        ],
      };
    case 'n9':
      return {
        roundLimit: 5,
        environment: [3, 3, 4, 4, 5],
        targets: [
          {
            id: 'drive-lock',
            name: '母灯传动锁',
            role: 'mechanism',
            artKey: 'enemy_drive',
            health: hp(8),
            maxHealth: hp(8),
            armor: 2,
            pressures: [0, 0, 0, 0, 0],
            intent: '第①步：先斩断传动锁，方可触及后方逆转巨轮',
          },
          {
            id: 'reverse-wheel',
            name: '逆转巨轮',
            role: 'threat',
            artKey: 'enemy_wheel',
            requiresDestroyed: 'drive-lock',
            health: hp(10),
            maxHealth: hp(10),
            armor: 2,
            pressures: [3, 3, 4, 4, 5],
            intent: '第②步：倒转狂卷暴雪，须将其耐久打归零停轮',
          },
        ],
      };
    default:
      return { roundLimit: 3, environment: [0], targets: [] };
  }
}

export function getBriefingForecast(state) {
  const mapEnc = { 1: 'n1', 2: 'n2', 3: 'n3-main', 5: 'n5-north', 6: 'n6', 7: 'n7', 8: 'n8', 9: 'n9' };
  const encId = mapEnc[state.node];
  if (!encId) return null;
  const spec = getEncounterSpec(state, encId);
  const hand = getWeapon(state, state.handId) || getWeapon(state, state.forgeId);
  return {
    bladeName: hand ? formatWeaponTitle(hand) : '无可用剑',
    targets: spec.targets.map((t) => {
      const normalDmg = hand && hand.strength > 0 ? Math.max(0, hand.strength - Math.max(0, t.armor - (hand.archetype === 'dao' ? 1 : 0))) : null;
      const guardedDmg = hand && hand.strength > 0 ? hand.strength + 2 + (hand.archetype === 'jian' ? 1 : 0) : null;
      return {
        id: t.id,
        name: t.name,
        artKey: t.artKey,
        health: t.health,
        armor: t.armor,
        normalDmg,
        guardedDmg,
      };
    }),
  };
}

export function createEncounterFor(state, encId) {
  const spec = getEncounterSpec(state, encId);
  const vanguard = state.perk === 'vanguard_edge';
  const divineSyn = hasSynergy(state, 'syn_divine_forge');
  const initBlock = (encId === 'n9' && state.flags.carrier === 'courier' ? 2 : 0) + (state.stance === 'balanced' ? 1 : 0);

  return {
    id: encId,
    round: 1,
    roundLimit: spec.roundLimit,
    actions: 2,
    block: initBlock,
    thorns: 0,
    opening: vanguard,
    openingBonusDmg: vanguard ? 1 : 0,
    guarded: false,
    momentumUsedThisRound: false,
    stanceSwitchedThisRound: false,
    fierceSurgeUsed: false,
    artUsedThisRound: false,
    dualUltUsed: false,
    frostUsed: false,
    hearthUsed: false,
    swapUsedFree: false,
    swapBuff: false,
    companionUsed: false,
    companionUsedThisRound: false,
    usedCompanions: [],
    duTempPower: 0,
    alanSnowShield: hasRelic(state, 'relic_tea') ? 2 : 0,
    braced: false,
    braceAssistUsed: false,
    alanGuard: false,
    reboundClaimed: false,
    followUpUsed: false,
    furnaceTriggered: false,
    routeOpened: false,
    qiStartBonusGiven: divineSyn,
    targets: spec.targets.map((t) => ({ ...t, staggered: false, chilled: 0 })),
    environment: spec.environment,
  };
}

export function getStaggerThreshold(state) {
  return state.difficulty === 'master' ? 4 : 3;
}

export function getTargetRoundPressure(target, round) {
  if (!target || target.health <= 0 || target.staggered || !target.pressures.length) return 0;
  const idx = Math.min(round - 1, target.pressures.length - 1);
  const base = target.pressures[idx] ?? 0;
  return Math.max(0, base - (target.chilled || 0));
}

export function computeStrikePreview(state, weapon, target) {
  const e = state.encounter;
  if (!weapon || !isWeaponUsable(weapon) || !target) return null;

  const fissure = weapon.cracked && weapon.fissureMarked;
  const opening = e ? e.opening : false;
  const ignoresArmor = fissure || opening;
  const zh = weapon.zoneHits || { tip: 0, spine: 0, guard: 0 };

  let pierce = weapon.archetype === 'dao' ? 1 : 0;
  if (zh.tip >= 2 && weapon.artZone !== 'tip') pierce += 1;
  if (hasSynergy(state, 'syn_divine_forge') && weapon.source === 'forged') pierce += 1;

  const effectiveArmor = ignoresArmor ? 0 : Math.max(0, target.armor - pierce);

  let dmg = Math.max(0, weapon.strength - effectiveArmor);
  if (zh.spine >= 2 && weapon.artZone !== 'spine') dmg += 1;
  if (state.stance === 'fierce') dmg += 2;
  if (opening) {
    dmg += 2 + (e ? e.openingBonusDmg : 0);
    if (weapon.archetype === 'jian') dmg += 1;
  }
  if (fissure) {
    dmg += 2 + (hasRelic(state, 'relic_shard') ? 2 : 0);
  }
  if (e && e.swapBuff) {
    dmg += hasRelic(state, 'relic_tongs') ? 2 : 1;
  }
  if (e && e.duTempPower > 0) dmg += e.duTempPower;
  if (weapon.quench === 'blaze' && target.health === target.maxHealth) dmg += 2;
  if (weapon.quench === 'frost' && hasRelic(state, 'relic_gourd')) dmg += 1;
  if (target.armor > 0 && hasRelic(state, 'relic_hammer')) dmg += 2;

  let rawWear = fissure ? (hasRelic(state, 'relic_shard') ? 1 : 2) : 0;
  let strengthAfter = Math.max(0, weapon.strength - rawWear);
  if (fissure && strengthAfter === 0 && hasSynergy(state, 'syn_immortal_fissure')) {
    strengthAfter = 1;
    rawWear = weapon.strength - 1;
  }

  const currentThreat = getTargetRoundPressure(target, e ? e.round : 1);
  const breakNeed = getStaggerThreshold(state);
  const willStagger =
    target.role === 'threat' &&
    !target.staggered &&
    currentThreat >= 2 &&
    (dmg >= breakNeed || (opening && dmg >= breakNeed - 1)) &&
    target.health > dmg;

  return {
    damage: dmg,
    effectiveArmor,
    ignoresArmor,
    wear: rawWear,
    strengthBefore: weapon.strength,
    strengthAfter,
    healthAfter: Math.max(0, target.health - dmg),
    breaksWeapon: strengthAfter === 0,
    willStagger,
    willKill: target.health > 0 && dmg >= target.health,
  };
}

export function computePressureSummary(state) {
  const e = state.encounter;
  if (!e) return { threatPressure: 0, envPressure: 0, fiercePenalty: 0, totalPressure: 0, reduction: 0, block: 0, loss: 0 };
  const threatPressure = e.targets.reduce((acc, t) => acc + getTargetRoundPressure(t, e.round), 0);
  const rawEnv = e.environment.length ? (e.environment[Math.min(e.round - 1, e.environment.length - 1)] ?? 0) : 0;
  const envPressure = Math.max(0, rawEnv - e.alanSnowShield);
  const fiercePenalty = state.stance === 'fierce' && threatPressure + envPressure > 0 ? 1 : 0;
  const totalPressure = threatPressure + envPressure + fiercePenalty;
  const reduction =
    (e.id === 'n3-main' && e.round === 1 && state.flags.escortFirst ? 1 : 0) +
    (e.alanGuard ? 2 : 0) +
    (e.id === 'n9' && state.flags.ring === 'taken' ? 2 : 0);
  const loss = Math.max(0, totalPressure - reduction - e.block);
  return { threatPressure, envPressure, fiercePenalty, totalPressure, reduction, block: e.block, loss };
}

function gainQi(state, amount) {
  state.qi = Math.max(0, Math.min(state.qiMax, (state.qi || 0) + amount));
}

function advanceToNode(state, nextNode) {
  if (hasRelic(state, 'relic_tea') && state.lamp < state.lampMax) {
    state.lamp = Math.min(state.lampMax, state.lamp + 1);
  }
  const nextChapter = Math.ceil(nextNode / 3);
  const chapterChanged = nextChapter !== state.chapter;
  state.chapter = nextChapter;
  state.node = nextNode;
  state.phase = 'prepare';
  state.choice = null;
  state.encounter = null;

  if (chapterChanged) {
    const beforeLamp = state.lamp;
    state.lamp = Math.min(state.lampMax, state.lamp + 3);
    state.blanks = 3;
    state.charge = 1;
    if (nextNode === 4 && isWeaponUsable(getWeapon(state, 'du-old-sword'))) {
      state.choice = 'camp-old-sword';
    }
    pushLog(state, `踏入第${nextChapter}章「${CHAPTER_INFO[nextChapter].name}」，补给铁坯至3、手艺至1，灯火 ${beforeLamp}→${state.lamp}。`);
    state.checkpoint = clonePlayable(state);
  } else {
    pushLog(state, `抵达第${nextNode}站「${NODES_DATA[nextNode].title}」。`);
  }
}

function offerRelicThenChoice(state, nextChoice, nextNodeIfNoChoice = null) {
  const opts = rollRelicDraftOptions(state, 3);
  if (opts.length > 0) {
    state.phase = 'relicDraft';
    state.relicOptions = opts;
    state.pendingChoiceAfterRelic = nextChoice ? { kind: 'choice', choice: nextChoice } : { kind: 'node', node: nextNodeIfNoChoice };
    return;
  }
  if (nextChoice) {
    state.phase = 'choice';
    state.choice = nextChoice;
  } else if (nextNodeIfNoChoice) {
    advanceToNode(state, nextNodeIfNoChoice);
  }
}

function applyThunderSplash(state, excludeId) {
  const e = state.encounter;
  if (!e || !hasSynergy(state, 'syn_thunder_break')) return false;
  let hitAny = false;
  for (const t of e.targets) {
    const blocked = t.requiresDestroyed && e.targets.some((d) => d.id === t.requiresDestroyed && d.health > 0);
    if (t.id !== excludeId && t.health > 0 && !blocked) {
      t.health = Math.max(0, t.health - 3);
      if (t.health === 0) state.stats.enemiesDefeated += 1;
      hitAny = true;
    }
  }
  return hitAny;
}

function checkEncounterResolution(state, endedRound = false) {
  const e = state.encounter;
  if (!e || state.phase !== 'encounter') return null;

  if (state.lamp <= 0) {
    state.phase = 'failed';
    state.failure = { reason: 'light-exhausted', node: state.node, text: '风雪吹熄了最后一缕灯火，车队被迫在暗夜里止步。' };
    pushLog(state, '灯火耗尽。可从本章起点重整一次，或记下这次止步。');
    return 'failed';
  }

  const allCleared = e.targets.every((t) => t.health <= 0);
  const shelterDone = e.id === 'n6' && state.flags.shelterSword !== null;
  const nonFinaleClear = e.id !== 'n9' && (allCleared || e.routeOpened || shelterDone);
  const survivalWin = endedRound && e.round >= e.roundLimit && (e.id === 'n3-main' || e.id === 'n3-extra' || e.id === 'n7');

  if (nonFinaleClear || survivalWin) {
    const id = e.id;
    if (state.tool && state.tool.level === 1) state.tool.stored = 0;
    state.encounter = null;

    switch (id) {
      case 'n1':
        state.coins += 2;
        pushLog(state, '巡路木卫已除，拾得 2 枚铜钱，并在路旁起出一卷古匠遗珍。');
        offerRelicThenChoice(state, 'first-road');
        break;
      case 'n2':
        state.phase = 'choice';
        state.choice = 'bridge-rescue';
        pushLog(state, '断桥已通，急流中传来摆渡人的呼救声。');
        break;
      case 'n3-main':
        state.coins += 3;
        state.phase = 'choice';
        state.choice = 'crossing-extra';
        pushLog(state, '渡口已守住，获得 3 枚铜钱。是否横剑断后迎战撞桩重卫？');
        break;
      case 'n3-extra':
        state.flags.crossingHeld = true;
        state.coins += 3;
        if (!state.completedNodes.includes(3)) state.completedNodes.push(3);
        pushLog(state, '断后大捷，再得 3 枚铜钱与古匠遗珍，且第八站山口侧路已打通。');
        offerRelicThenChoice(state, null, 4);
        break;
      case 'n5-north':
      case 'n5-south':
        if (id === 'n5-north') state.flags.northSaved = true;
        else state.flags.southSaved = true;
        state.coins += 2;
        pushLog(state, `${id === 'n5-north' ? '北驿巡守' : '南驿信使'}脱困，获得 2 枚铜钱，阿禾援手升阶。`);
        if (state.flags.northSaved && state.flags.southSaved) {
          if (!state.completedNodes.includes(5)) state.completedNodes.push(5);
          pushLog(state, '南北双驿同辉，驿卒合力献上雪山遗珍。');
          offerRelicThenChoice(state, null, 6);
        } else {
          state.phase = 'choice';
          state.choice = 'station-second';
        }
        break;
      case 'n6':
        state.phase = 'choice';
        state.choice = 'shelter-ring';
        pushLog(state, '避难炉危梁已稳，请决定恒温环的去留。');
        break;
      case 'n7':
        state.coins += 2;
        if (!state.completedNodes.includes(7)) state.completedNodes.push(7);
        pushLog(state, '穿过寒岭落石口，获得 2 枚铜钱与终章遗珍。');
        offerRelicThenChoice(state, null, 8);
        break;
      case 'n8':
        if (state.flags.carrier === 'courier') state.flags.coreOwner = 'socket';
        if (!state.completedNodes.includes(8)) state.completedNodes.push(8);
        pushLog(state, '山口石门洞开，天枢母灯台就在眼前。');
        advanceToNode(state, 9);
        break;
      default:
        break;
    }
    return 'completed';
  }

  if (endedRound && e.round >= e.roundLimit) {
    state.phase = 'failed';
    state.failure = { reason: 'round-limit', node: state.node, text: '未能在风雪封路前打开通道，炉车被困在了半途。' };
    pushLog(state, '超出轮数限制。可消耗本章一次重整机会回到章初重新部署。');
    return 'failed';
  }

  return null;
}

export function dispatchAction(prevState, action) {
  const s = JSON.parse(JSON.stringify(prevState));
  let fx = { sound: 'click', motion: 'change', toast: null, title: null, tone: 'quiet', unlockedCompendium: [] };

  switch (action.type) {
    case 'enterPlay': {
      s.screen = 'play';
      if (action.difficulty) s.difficulty = action.difficulty === 'master' ? 'master' : 'standard';
      if (action.perk && DESTINY_PERKS.some((p) => p.id === action.perk)) {
        const fresh = createInitialState(s.seed, action.perk, true, s.difficulty, s.compendiumCount);
        return { ok: true, state: fresh, fx: { ...fx, sound: 'bellows', title: '炉火已燃', toast: '带着小炉车与唯一灯芯踏上山路。' } };
      }
      return { ok: true, state: s, fx };
    }

    case 'pickRelic': {
      if (s.phase !== 'relicDraft') return { ok: false, state: prevState, reason: '当前没有待选遗珍。' };
      const rid = action.relicId;
      const rInfo = RELICS_POOL.find((r) => r.id === rid);
      if (rInfo && !s.relics.includes(rid)) {
        const prevSyns = getActiveSynergies(s).map((x) => x.id);
        s.relics.push(rid);
        const newSyns = getActiveSynergies(s).filter((x) => !prevSyns.includes(x.id));
        const synMsg = newSyns.length ? `，并激发炉火共鸣【${newSyns.map((x) => x.name).join('、')}】` : '';
        fx = {
          sound: newSyns.length ? 'compendium' : 'relic',
          motion: 'warm',
          tone: 'reward',
          title: `收纳遗珍 · ${rInfo.name}`,
          toast: `${rInfo.desc}${synMsg}`,
          unlockedCompendium: [],
        };
        pushLog(s, `收纳遗珍「${rInfo.name}」${synMsg}。`);
      }
      const nextStep = s.pendingChoiceAfterRelic;
      s.relicOptions = [];
      s.pendingChoiceAfterRelic = null;
      if (nextStep?.kind === 'choice') {
        s.phase = 'choice';
        s.choice = nextStep.choice;
      } else if (nextStep?.kind === 'node') {
        advanceToNode(s, nextStep.node);
      } else {
        s.phase = 'prepare';
      }
      return { ok: true, state: s, fx };
    }

    case 'beginForge': {
      if (s.phase !== 'prepare' || s.blanks <= 0) {
        return { ok: false, state: prevState, reason: '手头已无铁坯，可在营地杜伯处添置。' };
      }
      const archetype = action.archetype || 'jian';
      const archInfo = BLADE_ARCHETYPES[archetype] || BLADE_ARCHETYPES.jian;
      const id = `w-${++s.weaponSerial}`;
      const startStars = (s.perk === 'hundred_refinements' ? 1 : 0) + (hasRelic(s, 'relic_cauldron') ? 1 : 0);
      s.weapons.push({
        id,
        name: archInfo.name,
        compendiumTitle: null,
        archetype: archInfo.id,
        quench: null,
        source: 'forged',
        madeInChapter: s.chapter,
        status: 'forging',
        owner: 'forge',
        strength: archInfo.baseBonus,
        sealedStrength: null,
        hits: 0,
        perfectHits: 0,
        stars: Math.min(2, startStars),
        cauldronBonusUsed: false,
        zoneHits: { tip: 0, spine: 0, guard: 0 },
        artZone: archInfo.id === 'dao' ? 'spine' : archInfo.id === 'cleaver' ? 'guard' : 'tip',
        cracked: false,
        fissureMarked: false,
        technique: null,
      });
      s.blanks -= 1;
      s.forgeId = id;
      s.phase = 'forging';
      fx = {
        sound: 'bellows',
        motion: 'startForge',
        weaponId: id,
        tone: 'quiet',
        title: `${archInfo.name}上砧`,
        toast: '点击剑格、剑脊或剑尖落锤；同一部位敲满两锤即可悟出独门剑技。',
        unlockedCompendium: [],
      };
      pushLog(s, `开炉上砧打造「${archInfo.name}」。`);
      return { ok: true, state: s, fx };
    }

    case 'changeArchetype': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits > 0) {
        return { ok: false, state: prevState, reason: '落锤开锻后不可更换器型。' };
      }
      const archInfo = BLADE_ARCHETYPES[action.archetype] || BLADE_ARCHETYPES.jian;
      w.archetype = archInfo.id;
      w.name = archInfo.name;
      w.strength = archInfo.baseBonus;
      w.artZone = archInfo.id === 'dao' ? 'spine' : archInfo.id === 'cleaver' ? 'guard' : 'tip';
      fx = { sound: 'swap', motion: 'warm', toast: `改锻器型为「${archInfo.name}」：${archInfo.trait}`, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'hammer': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits >= 6) {
        return { ok: false, state: prevState, reason: '六锤已满，请择一淬火法收剑入鞘。' };
      }
      const zone = action.zone || 'good';
      const part = BLADE_ZONES[action.part] ? action.part : 'spine';
      const beforeStrength = w.strength;
      const safe = w.hits < 3;
      w.hits += 1;
      w.zoneHits = w.zoneHits || { tip: 0, spine: 0, guard: 0 };
      w.zoneHits[part] += 1;
      w.artZone = resolveWeaponZoneArt(w);
      s.stats.totalHammerHits += 1;

      const artMsg = w.zoneHits[part] === 2 ? ` · 领悟剑技《${BLADE_ZONES[part].artName}》` : '';

      if (safe) {
        w.strength += 1;
        let bonus = 0;
        if (zone === 'perfect') {
          w.perfectHits += 1;
          s.stats.perfectStrikes += 1;
          w.stars += 1;
          if (hasRelic(s, 'relic_cauldron') && !w.cauldronBonusUsed) {
            w.cauldronBonusUsed = true;
            w.strength += 1;
            bonus += 1;
          }
          if (w.stars >= 2) {
            w.stars -= 2;
            w.strength += 1;
            bonus += 1;
          }
          fx = {
            sound: 'hammer_perfect',
            motion: 'forge',
            great: true,
            weaponId: w.id,
            part,
            beforeStrength,
            afterStrength: w.strength,
            tone: 'reward',
            title: `金焰好锤 · 强度 ${w.strength}`,
            toast: `落锤【${BLADE_ZONES[part].short}】正中金焰${bonus ? `（星火暴击 +${bonus}）` : ''}${artMsg}`,
            unlockedCompendium: [],
          };
        } else {
          fx = {
            sound: 'hammer_good',
            motion: 'forge',
            great: false,
            weaponId: w.id,
            part,
            beforeStrength,
            afterStrength: w.strength,
            title: `强度 +1`,
            toast: `落锤【${BLADE_ZONES[part].short}】，强度升至 ${w.strength}${artMsg}`,
            unlockedCompendium: [],
          };
        }
        pushLog(s, `第${w.hits}锤锻【${BLADE_ZONES[part].short}】，强度 ${beforeStrength}→${w.strength}${artMsg}。`);
        return { ok: true, state: s, fx };
      }

      // Risky hits 4..6
      let risk = w.cracked ? 0.30 : 0.17;
      if (zone === 'perfect') risk *= 0.38;
      const roll = nextRng(s.rng);
      s.rng = roll.next;

      if (roll.value < risk) {
        if (w.cracked) {
          w.status = 'broken';
          w.owner = 'none';
          s.forgeId = null;
          s.phase = 'prepare';
          fx = {
            sound: 'crack',
            motion: 'forge',
            broken: true,
            weaponId: w.id,
            part,
            tone: 'danger',
            title: '铁坯崩断',
            toast: '裂纹贯通剑身，这枚铁坯碎在了砧上。',
            unlockedCompendium: [],
          };
          pushLog(s, `第${w.hits}锤再裂，剑坯崩断。`);
        } else {
          w.cracked = true;
          if (w.archetype !== 'cleaver') w.strength = Math.max(1, w.strength - 1);
          fx = {
            sound: 'crack',
            motion: 'forge',
            cracked: true,
            weaponId: w.id,
            part,
            beforeStrength,
            afterStrength: w.strength,
            tone: 'danger',
            title: '刃生首裂',
            toast: `剑面添了一道裂纹（当前强度 ${w.strength}）。可即刻淬火收剑，或以手艺抚平、化作崩纹。`,
            unlockedCompendium: [],
          };
          pushLog(s, `第${w.hits}锤刃生首裂，强度 ${w.strength}。`);
        }
      } else {
        w.strength += 1;
        if (zone === 'perfect') {
          w.perfectHits += 1;
          s.stats.perfectStrikes += 1;
          w.stars += 1;
          if (w.stars >= 2) {
            w.stars -= 2;
            w.strength += 1;
          }
        }
        fx = {
          sound: zone === 'perfect' ? 'hammer_perfect' : 'hammer_good',
          motion: 'forge',
          great: zone === 'perfect',
          weaponId: w.id,
          part,
          beforeStrength,
          afterStrength: w.strength,
          tone: 'reward',
          title: `险锤成锋 · 强度 ${w.strength}`,
          toast: `险中求锋未生裂痕，强度升至 ${w.strength}${artMsg}`,
          unlockedCompendium: [],
        };
        pushLog(s, `第${w.hits}锤险中成锋，强度升至 ${w.strength}${artMsg}。`);
      }
      return { ok: true, state: s, fx };
    }

    case 'forgeTech': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits >= 6 || s.charge <= 0) {
        return { ok: false, state: prevState, reason: '手艺次数已用完，或六锤已满。' };
      }
      if (action.kind === 'fissure' && w.fissureMarked) {
        return { ok: false, state: prevState, reason: '这柄剑已刻入崩纹。' };
      }
      const beforeStrength = w.strength;
      w.hits += 1;
      s.charge = 0;
      w.technique = action.kind;
      if (action.kind === 'steady') {
        w.strength += 1;
        const healed = w.cracked && !w.fissureMarked;
        if (healed) w.cracked = false;
        fx = {
          sound: 'hammer_perfect',
          motion: 'forge',
          techKind: 'steady',
          great: true,
          weaponId: w.id,
          beforeStrength,
          afterStrength: w.strength,
          tone: 'reward',
          title: `定线固刃 · 强度 ${w.strength}`,
          toast: healed ? '金线贯脊，抚平了先前裂纹，成器后稳固不损。' : '金线定刃，强度 +1 且稳固不损。',
          unlockedCompendium: [],
        };
      } else {
        const gain = w.cracked ? 2 : 3;
        w.strength += gain;
        w.cracked = true;
        w.fissureMarked = true;
        fx = {
          sound: 'stagger',
          motion: 'forge',
          techKind: 'fissure',
          great: true,
          weaponId: w.id,
          beforeStrength,
          afterStrength: w.strength,
          tone: 'reward',
          title: `刻入崩纹 · 强度 ${w.strength}`,
          toast: `引裂入锋，强度暴涨 +${gain}！出剑无视全部护甲并额外 +2 伤（每斩磨损2）。`,
          unlockedCompendium: [],
        };
      }
      pushLog(s, `${fx.title}。`);
      return { ok: true, state: s, fx };
    }

    case 'sealForge': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits === 0 || w.strength <= 0) {
        return { ok: false, state: prevState, reason: '请至少落下一锤打出强度后再收锻。' };
      }
      const quench = QUENCH_TRAITS[action.quench] ? action.quench : 'blaze';
      let slot = action.slot === 'reserve' ? 'reserve' : 'hand';
      if (slot === 'hand' && s.handId && !s.reserveId) {
        s.reserveId = s.handId;
      } else if (slot === 'reserve' && s.reserveId && !s.handId) {
        s.handId = s.reserveId;
      } else {
        const oldId = slot === 'hand' ? s.handId : s.reserveId;
        const old = getWeapon(s, oldId);
        if (old) {
          old.status = 'discarded';
          old.owner = 'none';
        }
      }

      if (hasRelic(s, 'relic_meteor')) w.strength += 1;
      w.quench = quench;
      w.status = 'sealed';
      w.owner = 'player';
      w.sealedStrength = w.strength;
      w.artZone = resolveWeaponZoneArt(w);
      w.compendiumTitle = getCompendiumTitleForBlade(w);
      w.name = formatWeaponTitle(w);

      if (slot === 'hand') s.handId = w.id;
      else s.reserveId = w.id;
      s.forgeId = null;
      s.phase = 'prepare';
      s.stats.totalForged += 1;
      gainQi(s, 1);

      const artInfo = getWeaponSwordArt(w);
      const unlockedIds = evaluateBladeCompendiumIds(w);
      fx = {
        sound: 'quench',
        motion: 'seal',
        weaponId: w.id,
        slot,
        quench,
        tone: 'reward',
        title: `成器入鞘 · ${w.name}`,
        toast: `强度 ${w.strength} · 剑技《${artInfo.artName}》 · ${QUENCH_TRAITS[quench].name}`,
        unlockedCompendium: unlockedIds.map((id) => ({ id, strength: w.strength, chapter: s.chapter })),
      };
      pushLog(s, `收锻成器：「${w.name}」（强度 ${w.strength} · 剑技《${artInfo.artName}》）。`);
      return { ok: true, state: s, fx };
    }

    case 'discardForge': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w) return { ok: false, state: prevState, reason: '当前不在锻造中。' };
      w.status = 'discarded';
      w.owner = 'none';
      s.forgeId = null;
      s.phase = 'prepare';
      fx = { sound: 'damage', motion: 'discard', weaponId: w.id, toast: '已放下当前在锻剑坯。', unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'switchStance': {
      const nextStance = SWORD_STANCES[action.stance] ? action.stance : 'balanced';
      if (s.stance === nextStance) return { ok: true, state: s, fx };
      const e = s.encounter;
      if (s.phase === 'encounter' && e) {
        if (e.stanceSwitchedThisRound) {
          return { ok: false, state: prevState, reason: '每轮限流转一次剑势。' };
        }
        e.stanceSwitchedThisRound = true;
        s.stance = nextStance;
        let bonusMsg = '';
        if (nextStance === 'fierce' && !e.fierceSurgeUsed) {
          e.fierceSurgeUsed = true;
          e.actions += 1;
          bonusMsg = '，拔刀转势立回 1 次行动';
        } else if (nextStance === 'still') {
          e.block += 2;
          bonusMsg = '，寒潭凝盾立添 2 点护势';
        } else {
          gainQi(s, 1);
          bonusMsg = '，守中归元凝聚 1 点剑意';
        }
        fx = {
          sound: 'swap',
          motion: 'guard',
          title: `剑势 · ${SWORD_STANCES[nextStance].name}`,
          toast: `${SWORD_STANCES[nextStance].desc}${bonusMsg}`,
          unlockedCompendium: [],
        };
        pushLog(s, `流转剑势为「${SWORD_STANCES[nextStance].name}」${bonusMsg}。`);
        return { ok: true, state: s, fx };
      }
      s.stance = nextStance;
      fx = { sound: 'swap', motion: 'warm', toast: `定剑势为「${SWORD_STANCES[nextStance].name}」`, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'swapSlots': {
      if (s.phase !== 'prepare' && s.phase !== 'encounter') {
        return { ok: false, state: prevState, reason: '当前阶段不可换剑。' };
      }
      if (!s.reserveId && !s.handId) return { ok: false, state: prevState, reason: '剑架上没有可换的剑。' };
      const e = s.encounter;
      if (s.phase === 'encounter' && e) {
        const isFree = !e.swapUsedFree;
        if (!isFree && e.actions < 1) {
          return { ok: false, state: prevState, reason: '本战免费换剑已用过，再次换手需 1 次行动。' };
        }
        const prevHand = s.handId;
        s.handId = s.reserveId;
        s.reserveId = prevHand;
        e.braced = false;

        let extraMsg = '';
        if (isFree) {
          e.swapUsedFree = true;
          e.swapBuff = true;
          s.stats.quickSwaps += 1;
          const qiGain = hasRelic(s, 'relic_tongs') ? 2 : 1;
          gainQi(s, qiGain);
          if (hasSynergy(s, 'syn_flash_swap')) {
            const rndTarget = e.targets.find(
              (t) => t.health > 0 && (!t.requiresDestroyed || e.targets.some((d) => d.id === t.requiresDestroyed && d.health === 0))
            );
            if (rndTarget) {
              rndTarget.health = Math.max(0, rndTarget.health - 3);
              if (rndTarget.health === 0) s.stats.enemiesDefeated += 1;
              extraMsg = ` · 电光双刃剑气贯射「${rndTarget.name}」3伤`;
            }
          }
          checkEncounterResolution(s, false);
          fx = {
            sound: 'swap',
            motion: 'equip',
            weaponId: s.handId,
            previousId: prevHand,
            title: '居合换剑 · 不占行动',
            toast: `剑意 +${qiGain}，下一剑伤害提升${extraMsg}`,
            unlockedCompendium: [],
          };
        } else {
          e.actions -= 1;
          fx = { sound: 'swap', motion: 'equip', weaponId: s.handId, previousId: prevHand, toast: '已换手备用兵刃。', unlockedCompendium: [] };
        }
        return { ok: true, state: s, fx };
      }
      const prevHand = s.handId;
      s.handId = s.reserveId;
      s.reserveId = prevHand;
      fx = {
        sound: 'swap',
        motion: 'equip',
        weaponId: s.handId,
        previousId: prevHand,
        toast: `已将「${formatWeaponTitle(getWeapon(s, s.handId))}」换至手中。`,
        unlockedCompendium: [],
      };
      return { ok: true, state: s, fx };
    }

    case 'depart': {
      if (s.phase !== 'prepare') return { ok: false, state: prevState, reason: '请先完成眼前这一步。' };
      if (s.node === 4 && s.choice === 'camp-old-sword') {
        return { ok: false, state: prevState, reason: '请先回应杜伯关于旧剑去留的问话。' };
      }
      if (s.node === 9) {
        const hasEligible = [s.handId, s.reserveId].some((id) => isFinalEligible(getWeapon(s, id)));
        if (!hasEligible) {
          return {
            ok: false,
            state: prevState,
            reason: '母灯需要一柄你亲手打造的合格剑（完好强度≥3，或崩纹强度≥1），请先开炉锻造。',
          };
        }
      }
      if (s.node === 4) {
        if (!s.completedNodes.includes(4)) s.completedNodes.push(4);
        advanceToNode(s, 5);
        fx = { sound: 'assist', motion: 'change', transition: true, title: '踏入风雪双驿', toast: '离开冬炉营地，前方暴雪岔道烟火告急。', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }
      if (s.node === 5) {
        s.phase = 'choice';
        s.choice = 'station-first';
        return { ok: true, state: s, fx: { ...fx, sound: 'scroll' } };
      }
      if (s.node === 8) {
        s.phase = 'choice';
        s.choice = 'relay-carrier';
        return { ok: true, state: s, fx: { ...fx, sound: 'scroll' } };
      }
      const mapEnc = { 1: 'n1', 2: 'n2', 3: 'n3-main', 6: 'n6', 7: 'n7', 9: 'n9' };
      s.encounter = createEncounterFor(s, mapEnc[s.node]);
      if (s.encounter.qiStartBonusGiven) gainQi(s, 1);
      s.phase = 'encounter';
      fx = {
        sound: 'guard',
        motion: 'change',
        transition: true,
        title: NODES_DATA[s.node].title,
        toast: NODES_DATA[s.node].mission,
        unlockedCompendium: [],
      };
      return { ok: true, state: s, fx };
    }

    case 'choose': {
      const cid = action.choice;
      if (s.choice === 'camp-old-sword') {
        if (cid === 'keep-old') {
          s.flags.oldDecision = 'kept';
          s.choice = null;
          pushLog(s, '留住杜伯旧剑随行，杜伯援手升阶。');
        } else if (cid === 'dismantle-old') {
          const old = getWeapon(s, 'du-old-sword');
          if (old) {
            old.status = 'discarded';
            old.owner = 'none';
            if (s.handId === 'du-old-sword') s.handId = s.reserveId;
            if (s.reserveId === 'du-old-sword') s.reserveId = null;
          }
          if (s.tool) s.tool.level = 2;
          s.upgradeUsed = true;
          s.flags.oldDecision = 'dismantled';
          s.choice = null;
          pushLog(s, '拆解旧剑将随车奇器升至二阶，杜伯援手升阶。');
        } else if (cid === 'pay-upgrade') {
          if (s.coins < 4) return { ok: false, state: prevState, reason: '铜钱不足 4 枚，可选择留住旧剑或拆剑升阶。' };
          s.coins -= 4;
          if (s.tool) s.tool.level = 2;
          s.upgradeUsed = true;
          s.flags.oldDecision = 'paid';
          s.choice = null;
          pushLog(s, '出资 4 钱将奇器升至二阶，并留住了杜伯旧剑。');
        }
        return { ok: true, state: s, fx: { ...fx, sound: 'assist', motion: 'warm', toast: '冬炉整备已定，随时可启程前往双驿。' } };
      }

      if (s.phase !== 'choice') return { ok: false, state: prevState, reason: '当前没有待选抉择。' };

      switch (cid) {
        case 'escort':
          s.flags.escortFirst = true;
          if (!s.completedNodes.includes(1)) s.completedNodes.push(1);
          advanceToNode(s, 2);
          break;
        case 'salvage':
          if (s.lamp < 2) return { ok: false, state: prevState, reason: '灯火至少需留 1 点方可回身搜寻。' };
          s.flags.escortFirst = false;
          s.lamp -= 1;
          s.coins += 3;
          if (!s.completedNodes.includes(1)) s.completedNodes.push(1);
          advanceToNode(s, 2);
          break;
        case 'rescue-ferryman':
          s.flags.ferrymanSaved = true;
          s.choice = 'bridge-tool';
          break;
        case 'save-cargo':
          s.flags.ferrymanSaved = false;
          s.coins += 5;
          s.choice = 'bridge-tool';
          break;
        case 'take-rebound':
        case 'take-furnace': {
          const kind = cid === 'take-rebound' ? 'rebound' : 'furnace';
          s.tool = { kind, level: 1, stored: 0 };
          if (!s.completedNodes.includes(2)) s.completedNodes.push(2);
          advanceToNode(s, 3);
          break;
        }
        case 'leave-crossing':
          if (!s.completedNodes.includes(3)) s.completedNodes.push(3);
          advanceToNode(s, 4);
          break;
        case 'hold-crossing':
          s.encounter = createEncounterFor(s, 'n3-extra');
          s.phase = 'encounter';
          s.choice = null;
          break;
        case 'north-first':
        case 'south-first':
          s.flags.firstStation = cid === 'north-first' ? 'north' : 'south';
          s.encounter = createEncounterFor(s, cid === 'north-first' ? 'n5-north' : 'n5-south');
          s.phase = 'encounter';
          s.choice = null;
          break;
        case 'leave-station':
          if (!s.completedNodes.includes(5)) s.completedNodes.push(5);
          advanceToNode(s, 6);
          break;
        case 'continue-station':
          if (!s.flags.ferrymanSaved) {
            if (s.lamp < 2) return { ok: false, state: prevState, reason: '灯火不足以顶风雪赶往另一驿。' };
            s.lamp -= 1;
          }
          s.encounter = createEncounterFor(s, s.flags.northSaved ? 'n5-south' : 'n5-north');
          s.phase = 'encounter';
          s.choice = null;
          break;
        case 'leave-ring':
        case 'take-ring':
          s.flags.ring = cid === 'leave-ring' ? 'left' : 'taken';
          if (!s.completedNodes.includes(6)) s.completedNodes.push(6);
          advanceToNode(s, 7);
          break;
        case 'courier-carries':
        case 'player-carries':
          s.flags.carrier = cid === 'courier-carries' ? 'courier' : 'player';
          s.flags.coreOwner = s.flags.carrier;
          s.encounter = createEncounterFor(s, 'n8');
          s.phase = 'encounter';
          s.choice = null;
          break;
        default:
          break;
      }
      return { ok: true, state: s, fx: { ...fx, sound: 'assist', motion: 'change', transition: true, toast: '心意已决，继续前行。' } };
    }

    case 'strike': {
      const e = s.encounter;
      const hand = getWeapon(s, s.handId);
      if (s.phase !== 'encounter' || !e || e.actions < 1) {
        return { ok: false, state: prevState, reason: '本轮行动已用完，可施展零耗剑技、援手，或点击「结束本轮」。' };
      }
      if (!isWeaponUsable(hand)) {
        return { ok: false, state: prevState, reason: '手中没有可用兵刃，请从左下剑架换上备用剑。' };
      }
      const target = e.targets.find((t) => t.id === action.targetId);
      if (!target || target.health <= 0) return { ok: false, state: prevState, reason: '该目标已被破除。' };
      if (target.requiresDestroyed) {
        const dep = e.targets.find((t) => t.id === target.requiresDestroyed);
        if (dep && dep.health > 0) {
          return { ok: false, state: prevState, reason: `须先斩断前排「${dep.name}」，才能触及「${target.name}」。` };
        }
      }

      const preview = computeStrikePreview(s, hand, target);
      const beforeHp = target.health;
      e.actions -= 1;
      e.braced = false;
      e.opening = false;
      e.openingBonusDmg = 0;
      e.swapBuff = false;

      target.health = preview.healthAfter;
      hand.strength = preview.strengthAfter;
      gainQi(s, s.stance === 'balanced' ? 2 : 1);

      const notes = [];
      let sound = 'slash';
      let staggered = false;

      if (preview.willStagger && target.health > 0) {
        target.staggered = true;
        staggered = true;
        s.stats.staggerBreaks += 1;
        sound = 'stagger';
        notes.push('破势断招');
        if (applyThunderSplash(s, target.id)) notes.push('碎甲惊雷溅射3伤');
      }

      if (target.health === 0) {
        s.stats.enemiesDefeated += 1;
        notes.push('一剑击破');
        if (target.armor > 0 && hasRelic(s, 'relic_hammer')) gainQi(s, 1);
        if (applyThunderSplash(s, target.id)) notes.push('碎甲惊雷溅射3伤');

        if (hand.quench === 'hearth' && !e.hearthUsed) {
          e.hearthUsed = true;
          e.block += 2;
          if (s.hearthTriggeredChapter < s.chapter && s.lamp < s.lampMax) {
            s.hearthTriggeredChapter = s.chapter;
            s.lamp += 1;
            notes.push('暖灰归元护势+2·灯火+1');
          } else {
            notes.push('暖灰归元护势+2');
          }
        }
        if (s.tool) {
          if (s.tool.kind === 'rebound' && !e.reboundClaimed) {
            const rawOverkill = Math.max(0, preview.damage - beforeHp) + (hand.archetype === 'dao' ? 1 : 0);
            if (rawOverkill > 0) {
              s.tool.stored = s.tool.level === 2 ? Math.max(s.tool.stored, rawOverkill) : rawOverkill;
              e.reboundClaimed = true;
              notes.push(`回锋蓄力+${s.tool.stored}`);
            }
          } else if (s.tool.kind === 'furnace' && !e.furnaceTriggered && target.armor > 0) {
            s.charge = 1;
            e.furnaceTriggered = true;
            notes.push('崩炉钉回满手艺');
          }
        }
      }

      // 乘胜追击：每轮首次触发破势断招或击破目标，立即返还 1 次行动与 1 点剑意！
      let momentum = false;
      if ((staggered || target.health === 0) && !e.momentumUsedThisRound) {
        e.momentumUsedThisRound = true;
        e.actions += 1;
        gainQi(s, 1);
        momentum = true;
        notes.push('乘胜追击：返还1次行动');
      }

      if (hand.strength === 0) {
        hand.status = 'broken';
        hand.owner = 'none';
        s.handId = null;
        sound = 'crack';
        notes.push('手中剑力尽崩断');
      }

      checkEncounterResolution(s, false);
      fx = {
        sound,
        motion: 'strike',
        weaponId: hand.id,
        targetId: target.id,
        damage: preview.damage,
        afterHp: target.health,
        staggered,
        momentum,
        tone: momentum ? 'reward' : 'quiet',
        title: `${target.name} −${preview.damage}`,
        toast: notes.length ? notes.join(' · ') : `还余 ${target.health} 耐久`,
        unlockedCompendium: [],
      };
      pushLog(s, `出剑斩「${target.name}」造成 ${preview.damage} 伤害${notes.length ? `（${notes.join('，')}）` : ''}。`);
      return { ok: true, state: s, fx };
    }

    case 'useSwordArt': {
      const e = s.encounter;
      const hand = getWeapon(s, s.handId);
      if (s.phase !== 'encounter' || !e || !isWeaponUsable(hand)) {
        return { ok: false, state: prevState, reason: '需要手中持有可用兵刃。' };
      }
      const artInfo = getWeaponSwordArt(hand);
      if (s.qi < artInfo.artCost) {
        return { ok: false, state: prevState, reason: `剑意不足（需 ${artInfo.artCost} 点剑意，当前 ${s.qi} 点）。` };
      }
      if (e.artUsedThisRound) {
        return { ok: false, state: prevState, reason: '每轮限施展一次开刃剑技。' };
      }

      s.qi -= artInfo.artCost;
      e.artUsedThisRound = true;
      e.braced = false;
      s.stats.swordArtsUsed += 1;
      const stanceDmg = s.stance === 'fierce' ? 2 : 0;

      if (artInfo.artId === 'return_flame') {
        const gain = hand.strength + 3 + (s.stance === 'still' ? 2 : 0);
        e.block += gain;
        e.thorns += 3;
        fx = {
          sound: 'sword_art',
          motion: 'guard',
          weaponId: hand.id,
          tone: 'reward',
          title: `剑技 · 回风守心`,
          toast: `不占行动，立凝 ${gain} 点护势，并布下 3 点反震剑火。`,
          unlockedCompendium: [],
        };
        pushLog(s, `施展《回风守心》：护势 +${gain}，反震 +3。`);
        return { ok: true, state: s, fx };
      }

      const target =
        e.targets.find((t) => t.id === action.targetId && t.health > 0) ||
        e.targets.find((t) => t.health > 0 && (!t.requiresDestroyed || e.targets.some((d) => d.id === t.requiresDestroyed && d.health === 0)));
      if (!target) return { ok: false, state: prevState, reason: '场上没有可命中的目标。' };
      if (target.requiresDestroyed && e.targets.some((d) => d.id === target.requiresDestroyed && d.health > 0)) {
        return { ok: false, state: prevState, reason: '请先破除前排传动锁。' };
      }

      let mainDmg = 0;
      let staggered = false;
      if (artInfo.artId === 'pierce_cloud') {
        mainDmg = hand.strength + 3 + stanceDmg;
        target.health = Math.max(0, target.health - mainDmg);
        if (target.health > 0 && target.role === 'threat' && !target.staggered) {
          target.staggered = true;
          staggered = true;
          s.stats.staggerBreaks += 1;
        }
        if (target.health === 0) s.stats.enemiesDefeated += 1;
        applyThunderSplash(s, target.id);
      } else {
        const effArmor = Math.max(0, target.armor - 1);
        mainDmg = Math.max(2, hand.strength + 3 + stanceDmg - effArmor);
        const splashDmg = Math.max(2, Math.ceil((hand.strength + 2) * 0.5));
        target.health = Math.max(0, target.health - mainDmg);
        if (target.health > 0 && target.role === 'threat' && mainDmg >= getStaggerThreshold(s)) {
          target.staggered = true;
          staggered = true;
          s.stats.staggerBreaks += 1;
        }
        if (target.health === 0) s.stats.enemiesDefeated += 1;
        for (const other of e.targets) {
          const blocked = other.requiresDestroyed && e.targets.some((d) => d.id === other.requiresDestroyed && d.health > 0);
          if (other.id !== target.id && other.health > 0 && !blocked) {
            other.health = Math.max(0, other.health - splashDmg);
            if (other.health === 0) s.stats.enemiesDefeated += 1;
          }
        }
      }

      let momentum = false;
      if ((staggered || target.health === 0) && !e.momentumUsedThisRound) {
        e.momentumUsedThisRound = true;
        e.actions += 1;
        gainQi(s, 1);
        momentum = true;
      }

      checkEncounterResolution(s, false);
      fx = {
        sound: 'sword_art',
        motion: 'strike',
        artId: artInfo.artId,
        weaponId: hand.id,
        targetId: target.id,
        damage: mainDmg,
        staggered,
        momentum,
        tone: 'reward',
        title: `剑技《${artInfo.artName}》 −${mainDmg}`,
        toast: `${staggered ? '触发破势断招 · ' : ''}${momentum ? '乘胜追击返还1次行动' : '零耗剑技贯破敌阵'}`,
        unlockedCompendium: [],
      };
      pushLog(s, `施展《${artInfo.artName}》重创「${target.name}」${mainDmg} 伤。`);
      return { ok: true, state: s, fx };
    }

    case 'useDualUltimate': {
      const e = s.encounter;
      const hand = getWeapon(s, s.handId);
      const reserve = getWeapon(s, s.reserveId);
      const cost = getDualUltCost(s);
      if (!canCastDualUlt(s)) {
        return { ok: false, state: prevState, reason: `需主副双剑皆在架，且聚满 ${cost} 点剑意。` };
      }
      s.qi -= cost;
      e.dualUltUsed = true;
      e.block += 3;
      s.stats.dualUltimates += 1;
      const totalDmg = hand.strength + reserve.strength + 4 + (s.stance === 'fierce' ? 2 : 0);

      for (const t of e.targets) {
        if (t.health <= 0) continue;
        const blocked = t.requiresDestroyed && e.targets.some((d) => d.id === t.requiresDestroyed && d.health > 0);
        if (!blocked) {
          t.health = Math.max(0, t.health - totalDmg);
          if (t.health > 0 && t.role === 'threat') {
            t.staggered = true;
            s.stats.staggerBreaks += 1;
          }
          if (t.health === 0) s.stats.enemiesDefeated += 1;
        }
      }

      checkEncounterResolution(s, false);
      fx = {
        sound: 'dual_ult',
        motion: 'dualUlt',
        weaponId: hand.id,
        targetId: e.targets[0]?.id || null,
        damage: totalDmg,
        tone: 'reward',
        title: `双剑合璧 · 全场 −${totalDmg}`,
        toast: `「${hand.name}」与「${reserve.name}」双锋齐出，并添 3 点护势。`,
        unlockedCompendium: [],
      };
      pushLog(s, `施展【双剑合璧】横扫全场 ${totalDmg} 伤害。`);
      return { ok: true, state: s, fx };
    }

    case 'followUp': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e || !s.tool || s.tool.kind !== 'rebound' || s.tool.stored <= 0 || e.followUpUsed) {
        return { ok: false, state: prevState, reason: '当前没有可用的回锋追斩余力。' };
      }
      const target =
        e.targets.find((t) => t.id === action.targetId && t.health > 0) ||
        e.targets.find((t) => t.health > 0 && (!t.requiresDestroyed || e.targets.some((d) => d.id === t.requiresDestroyed && d.health === 0)));
      if (!target) return { ok: false, state: prevState, reason: '没有可追斩的目标。' };
      const dmg = s.tool.stored;
      s.tool.stored = 0;
      e.followUpUsed = true;
      e.braced = false;
      target.health = Math.max(0, target.health - dmg);
      if (target.health === 0) s.stats.enemiesDefeated += 1;
      gainQi(s, 1);
      checkEncounterResolution(s, false);
      fx = {
        sound: 'slash',
        motion: 'followUp',
        targetId: target.id,
        damage: dmg,
        title: `回锋追斩 −${dmg}`,
        toast: '回锋齿余威不占行动，再斩一记。',
        unlockedCompendium: [],
      };
      return { ok: true, state: s, fx };
    }

    case 'guard': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e || e.actions < 1 || e.guarded) {
        return { ok: false, state: prevState, reason: e?.guarded ? '本轮已经架过剑了。' : '本轮行动已用完。' };
      }
      const hand = getWeapon(s, s.handId);
      const zh = hand?.zoneHits || { tip: 0, spine: 0, guard: 0 };
      e.actions -= 1;
      e.guarded = true;
      e.opening = true;
      let blockGain = 3;
      if (s.stance === 'still') blockGain += 2;
      if (hand && isWeaponUsable(hand) && hand.archetype === 'cleaver') blockGain += 1;
      if (hand && isWeaponUsable(hand) && zh.guard >= 2 && hand.artZone !== 'guard') blockGain += 2;
      if (hand && isWeaponUsable(hand) && hand.quench === 'frost' && !e.frostUsed) {
        e.frostUsed = true;
        blockGain += 2;
        e.openingBonusDmg += 1;
      }
      e.block += blockGain;
      gainQi(s, 1);
      const wheelStopped = e.id === 'n9' && e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
      if (wheelStopped) e.braced = true;

      fx = {
        sound: 'guard',
        motion: 'guard',
        weaponId: s.handId,
        tone: wheelStopped ? 'reward' : 'quiet',
        title: wheelStopped ? '母灯底座已架稳' : `架剑蓄破 · 护势 +${blockGain}`,
        toast: wheelStopped
          ? '底座已稳固（结束回合亦不会松脱），下一步即可嵌剑复明。'
          : `剑意 +1，且下一剑无视护甲并额外 +${2 + e.openingBonusDmg} 伤害。`,
        unlockedCompendium: [],
      };
      pushLog(s, `${fx.title}。`);
      return { ok: true, state: s, fx };
    }

    case 'companionAssist': {
      const e = s.encounter;
      const cid = action.companionId || 'alan';
      const hasScroll = hasRelic(s, 'relic_scroll');
      if (s.phase !== 'encounter' || !e) return { ok: false, state: prevState, reason: '当前不在交锋中。' };
      if (!hasScroll && e.companionUsed) {
        return { ok: false, state: prevState, reason: '每场交锋同行伙伴默认援手一次（得遗珍【山道盟书】可全员轮番相助）。' };
      }
      if (hasScroll && (e.usedCompanions.includes(cid) || e.companionUsedThisRound)) {
        return { ok: false, state: prevState, reason: '该同伴本战已出手，或本轮已唤过同伴。' };
      }

      const upgraded = isCompanionUpgraded(s, cid);
      e.companionUsed = true;
      e.companionUsedThisRound = true;
      e.usedCompanions.push(cid);
      s.stats.companionAssists += 1;

      if (hasScroll) gainQi(s, 1);
      if (hasSynergy(s, 'syn_fellowship')) e.block += 2;

      let title = '';
      let toast = '';
      if (cid === 'alan') {
        const gain = upgraded ? 3 : 2;
        e.block += gain;
        gainQi(s, 1);
        if (upgraded) e.alanSnowShield += 1;
        title = `阿岚 · 巡夜铁壁`;
        toast = `不占行动，立添 ${gain} 点护势与 1 点剑意${upgraded ? '，并抵消 1 点寒压' : ''}。`;
      } else if (cid === 'he') {
        e.opening = true;
        e.openingBonusDmg += upgraded ? 2 : 1;
        if (upgraded) gainQi(s, 1);
        title = `阿禾 · 引灯照隙`;
        toast = `不占行动，照亮敌方甲缝，下一剑无视护甲且伤害 +${2 + e.openingBonusDmg}。`;
      } else {
        e.duTempPower += 2;
        const hand = getWeapon(s, s.handId);
        let repaired = false;
        if (upgraded && hand && isWeaponUsable(hand) && hand.sealedStrength && hand.strength < hand.sealedStrength) {
          hand.strength += 1;
          repaired = true;
        }
        title = `杜伯 · 鼓风炽刃`;
        toast = `不占行动，本轮手中剑斩击伤害 +2${repaired ? '，并修复 1 点磨损强度' : ''}。`;
      }
      pushLog(s, `${title}：${toast}`);
      return { ok: true, state: s, fx: { sound: 'assist', motion: 'warm', title, toast, unlockedCompendium: [] } };
    }

    case 'temper': {
      const hand = getWeapon(s, s.handId);
      if (!s.tool || s.tool.kind !== 'furnace' || !hand || !isWeaponUsable(hand) || s.charge <= 0) {
        return { ok: false, state: prevState, reason: '需要有手艺次数的崩炉钉与已磨损的兵刃。' };
      }
      const clearsCrack = s.tool.level === 2 && hand.cracked && !hand.fissureMarked;
      if (hand.strength >= (hand.sealedStrength || hand.strength) && !clearsCrack) {
        return { ok: false, state: prevState, reason: '手中这柄剑完好无损，无需续炉。' };
      }
      if (s.phase === 'encounter') {
        if (!s.encounter || s.encounter.actions < 1) return { ok: false, state: prevState, reason: '交锋中续炉需 1 次行动。' };
        s.encounter.actions -= 1;
        s.encounter.braced = false;
      }
      const before = hand.strength;
      const rec = s.tool.level === 2 ? 4 : 2;
      hand.strength = Math.min(hand.sealedStrength || hand.strength, hand.strength + rec);
      if (clearsCrack) hand.cracked = false;
      s.charge = 0;
      fx = {
        sound: 'quench',
        motion: 'warm',
        weaponId: hand.id,
        title: '崩炉续火',
        toast: `「${hand.name}」强度由 ${before} 恢复至 ${hand.strength}。`,
        unlockedCompendium: [],
      };
      return { ok: true, state: s, fx };
    }

    case 'emergencyBlank': {
      if (s.node !== 9 || s.phase !== 'prepare' || s.blanks > 0 || s.lamp <= 1) {
        return { ok: false, state: prevState, reason: '仅在山口缺少铁坯且灯火大于 1 时可拆炉车护板应急。' };
      }
      s.lamp -= 1;
      s.blanks += 1;
      s.charge = 1;
      return {
        ok: true,
        state: s,
        fx: { sound: 'hammer_good', motion: 'warm', title: '拆板救急', toast: '杜伯拆下炉车玄铁护板，化作 1 枚应急铁坯与 1 次手艺。', unlockedCompendium: [] },
      };
    }

    case 'mechanism': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e) return { ok: false, state: prevState, reason: '当前不在道路交锋中。' };
      const kind = action.kind;
      const hand = getWeapon(s, s.handId);
      const reserve = getWeapon(s, s.reserveId);

      if (kind === 'cut') {
        const cutId = e.id === 'n2' ? 'bridge-rope' : e.id === 'n5-south' ? 'south-rope' : 'relay-rope';
        const req = getCutRequirement(s, cutId);
        if (e.actions < 1) return { ok: false, state: prevState, reason: '切索需要 1 次行动。' };
        if (!hand || !isWeaponUsable(hand) || hand.cracked || hand.strength < req) {
          return { ok: false, state: prevState, reason: `切索需手中持完好无裂兵刃，且强度至少 ${req}。` };
        }
        e.actions -= 1;
        e.routeOpened = true;
        checkEncounterResolution(s, false);
        return {
          ok: true,
          state: s,
          fx: {
            sound: 'slash',
            motion: 'strike',
            weaponId: hand.id,
            targetId: e.targets[0]?.id || null,
            cutRope: true,
            tone: 'reward',
            title: '利刃切索',
            toast: '一剑挥断拦路吊索，兵刃零磨损直接开路。',
            unlockedCompendium: [],
          },
        };
      }

      if (kind === 'ferryAssist') {
        if (!s.flags.ferrymanSaved || s.flags.ferryAssistUsed) {
          return { ok: false, state: prevState, reason: '摆渡人牵索仅可使用一次。' };
        }
        s.flags.ferryAssistUsed = true;
        e.routeOpened = true;
        checkEncounterResolution(s, false);
        return {
          ok: true,
          state: s,
          fx: { sound: 'assist', motion: 'mechanism', tone: 'reward', title: '摆渡人报恩牵索', toast: '不占行动熟稔解开冰封门索，直接救出驿站同伴。', unlockedCompendium: [] },
        };
      }

      if (kind === 'useSideRoute') {
        const canSide = s.flags.crossingHeld || (s.flags.southSaved && s.flags.ring === 'left');
        if (!canSide || e.actions < 1) return { ok: false, state: prevState, reason: '缺少侧路接应或行动不足。' };
        e.actions -= 1;
        e.routeOpened = true;
        checkEncounterResolution(s, false);
        return {
          ok: true,
          state: s,
          fx: { sound: 'assist', motion: 'mechanism', tone: 'reward', title: '侧路引索接应', toast: '昔日救下的山民从山侧放下引索，免战直通母灯台。', unlockedCompendium: [] },
        };
      }

      if (kind === 'donateShelter') {
        const targetWeapon = getWeapon(s, action.weaponId);
        if (!targetWeapon || !isWeaponUsable(targetWeapon) || targetWeapon.strength < 3 || e.actions < 1) {
          return { ok: false, state: prevState, reason: '需 1 次行动，且献出的剑未断、强度至少 3。' };
        }
        e.actions -= 1;
        targetWeapon.status = 'donated';
        targetWeapon.owner = 'shelter';
        if (s.handId === targetWeapon.id) s.handId = s.reserveId;
        if (s.reserveId === targetWeapon.id) s.reserveId = null;
        s.flags.shelterSword = targetWeapon.id;
        checkEncounterResolution(s, false);
        return {
          ok: true,
          state: s,
          fx: {
            sound: 'stagger',
            motion: 'donate',
            recipient: 'shelter',
            weaponId: targetWeapon.id,
            tone: 'story',
            title: '留剑撑危梁',
            toast: `「${targetWeapon.name}」楔入避难炉横梁，替满屋妇孺撑起了屋顶。`,
            unlockedCompendium: [],
          },
        };
      }

      if (kind === 'donateAlan') {
        if (!reserve || !isWeaponUsable(reserve) || reserve.strength < 3 || e.actions < 1 || e.alanGuard) {
          return { ok: false, state: prevState, reason: '需备用剑强度 ≥ 3 且有 1 次行动。' };
        }
        e.actions -= 1;
        reserve.status = 'donated';
        reserve.owner = 'alan';
        s.reserveId = null;
        s.flags.donatedToAlan = reserve.id;
        e.alanGuard = true;
        return {
          ok: true,
          state: s,
          fx: {
            sound: 'guard',
            motion: 'donate',
            recipient: 'alan',
            weaponId: reserve.id,
            title: '交剑阿岚断后',
            toast: `阿岚接过「${reserve.name}」护住侧翼，每轮总压力减 2。`,
            unlockedCompendium: [],
          },
        };
      }

      if (kind === 'placeCore') {
        if (e.id !== 'n9' || s.flags.coreOwner === 'socket' || e.actions < 1) {
          return { ok: false, state: prevState, reason: '唯一灯芯已在座中，或行动不足。' };
        }
        e.actions -= 1;
        e.braced = false;
        s.flags.coreOwner = 'socket';
        return {
          ok: true,
          state: s,
          fx: { sound: 'assist', motion: 'core', tone: 'story', title: '唯一灯芯入座', toast: '灯芯已安放入母灯核心，停轮后架稳底座即可嵌剑复明。', unlockedCompendium: [] },
        };
      }

      if (kind === 'assistBrace') {
        const wheelDead = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
        if (e.id !== 'n9' || s.flags.carrier !== 'player' || !wheelDead || e.braceAssistUsed) {
          return { ok: false, state: prevState, reason: '需亲自携芯且停下巨轮后，阿禾方可免费扶稳底座。' };
        }
        e.braceAssistUsed = true;
        e.braced = true;
        return {
          ok: true,
          state: s,
          fx: { sound: 'guard', motion: 'guard', tone: 'reward', title: '阿禾扶稳母灯', toast: '不占行动锁死底座，立即点击【嵌剑复明】点亮群山。', unlockedCompendium: [] },
        };
      }

      if (kind === 'ignite' || kind === 'celestialIgnite') {
        const driveDead = e.targets.some((t) => t.id === 'drive-lock' && t.health === 0);
        const wheelDead = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
        if (!driveDead || !wheelDead) return { ok: false, state: prevState, reason: '请先斩断传动锁并停下逆转巨轮。' };
        if (s.flags.coreOwner !== 'socket') return { ok: false, state: prevState, reason: '请先将唯一灯芯放入母灯座。' };
        if (!e.braced) return { ok: false, state: prevState, reason: '请先使用「架稳母灯」或「阿禾扶稳」固定底座。' };
        if (!isFinalEligible(hand)) {
          return { ok: false, state: prevState, reason: '手中须是你亲手打造的合格名剑（完好≥3，或崩纹≥1）。' };
        }
        if (e.actions < 1) return { ok: false, state: prevState, reason: '嵌剑需要 1 次行动（可先结束本轮恢复行动，架稳状态不会解除）。' };

        const secretStatus = getSecretEndingStatus(s);
        const isCelestial = kind === 'celestialIgnite' || secretStatus.canIgniteCelestial;
        if (kind === 'celestialIgnite' && !secretStatus.canIgniteCelestial) {
          return { ok: false, state: prevState, reason: '尚未齐备万家薪火三项契机（仁心全救 + 自铸剑≥6强 + 灯火≥5）。' };
        }

        e.actions -= 1;
        hand.status = 'donated';
        hand.owner = 'lamp';
        s.handId = null;
        if (!s.completedNodes.includes(9)) s.completedNodes.push(9);
        s.phase = 'ending';
        const endingKind = isCelestial ? 'celestial_relit' : 'relit';
        s.ending = buildEndingVerdict(s, endingKind, hand);

        return {
          ok: true,
          state: s,
          fx: {
            sound: 'relit',
            motion: 'donate',
            recipient: 'lamp',
            relighting: true,
            weaponId: hand.id,
            tone: 'reward',
            title: isCelestial ? '万家薪火 · 剑魄归宗' : '剑入母灯 · 十二山灯复明',
            toast: isCelestial ? '山下万家火把与十二长灯同时亮彻云霄！' : '停滞的母灯化作金色灯枢，十二盏山灯依次重燃。',
            unlockedCompendium: isCelestial ? [{ id: 'special_celestial', strength: hand.strength, chapter: 3 }] : [],
          },
        };
      }

      return { ok: false, state: prevState, reason: '未知指令。' };
    }

    case 'endRound': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e) return { ok: false, state: prevState, reason: '当前不在交锋回合中。' };

      const parry = action.parryGrade || 'none';
      let parryBlock = 0;
      let counterDmg = e.thorns || 0;
      const mirror = hasRelic(s, 'relic_mirror');

      if (parry === 'perfect') {
        s.stats.perfectParries += 1;
        parryBlock = 2 + (mirror ? 2 : 0) + (s.stance === 'still' ? 1 : 0);
        counterDmg += 2 + (mirror ? 2 : 0) + (s.stance === 'still' ? 2 : 0);
        gainQi(s, 2);
      } else if (parry === 'good' || parry === 'auto') {
        parryBlock = 1;
        counterDmg += 1;
        gainQi(s, 1);
      }

      e.block += parryBlock;
      let counterNote = '';
      if (counterDmg > 0) {
        const attacker =
          e.targets.find((t) => t.health > 0 && t.role === 'threat' && !t.staggered) ||
          e.targets.find((t) => t.health > 0 && (!t.requiresDestroyed || e.targets.some((d) => d.id === t.requiresDestroyed && d.health === 0)));
        if (attacker) {
          attacker.health = Math.max(0, attacker.health - counterDmg);
          if (attacker.health === 0) s.stats.enemiesDefeated += 1;
          counterNote = ` · 反震「${attacker.name}」${counterDmg}伤`;
        }
        if (parry === 'perfect' && hasSynergy(s, 'syn_mirror_frost')) {
          for (const t of e.targets) {
            if (t.health > 0 && t.role === 'threat') t.chilled = (t.chilled || 0) + 1;
          }
          counterNote += ' · 镜花水月霜冻减压';
        }
      }

      const p = computePressureSummary(s);
      const beforeLamp = s.lamp;
      s.lamp = Math.max(0, s.lamp - p.loss);
      if (p.loss === 0) s.stats.flawlessRounds += 1;

      if (hasRelic(s, 'relic_gourd') && s.reserveId) {
        const rw = getWeapon(s, s.reserveId);
        if (rw && isWeaponUsable(rw) && rw.sealedStrength && rw.strength < rw.sealedStrength) {
          rw.strength += 1;
        }
      }

      const res = checkEncounterResolution(s, true);
      if (!res && s.encounter) {
        const carryBlock = s.stance === 'still' ? Math.floor(Math.max(0, s.encounter.block - (p.totalPressure - p.reduction)) * 0.5) : 0;
        s.encounter.round += 1;
        s.encounter.actions = 2;
        s.encounter.block = carryBlock + (s.stance === 'balanced' ? 1 : 0);
        s.encounter.thorns = 0;
        s.encounter.guarded = false;
        s.encounter.momentumUsedThisRound = false;
        s.encounter.stanceSwitchedThisRound = false;
        s.encounter.artUsedThisRound = false;
        s.encounter.companionUsedThisRound = false;
        s.encounter.duTempPower = 0;
        s.encounter.alanSnowShield = 0;
        for (const t of s.encounter.targets) t.staggered = false;
      }

      fx = {
        sound: parry === 'perfect' ? 'parry_perfect' : p.loss > 0 ? 'damage' : 'guard',
        motion: 'pressure',
        parry,
        loss: p.loss,
        beforeLamp,
        afterLamp: s.lamp,
        tone: p.loss > 0 ? 'danger' : parry === 'perfect' ? 'reward' : 'quiet',
        title: parry === 'perfect' ? '毫巅迎锋' : p.loss > 0 ? `灯火 −${p.loss}` : '灯火守住',
        toast: `${p.loss > 0 ? `风雪侵袭，灯火 ${beforeLamp}→${s.lamp}` : '护势稳固，本轮灯火无损'}${counterNote}`,
        unlockedCompendium: [],
      };
      pushLog(s, `${fx.title}：${fx.toast}。`);
      return { ok: true, state: s, fx };
    }

    case 'shop': {
      if (s.phase !== 'prepare' || ![1, 4, 7].includes(s.node)) {
        return { ok: false, state: prevState, reason: '仅在第一、四、七站营地可炉边修整。' };
      }
      const item = action.item;
      const price = item === 'upgrade' ? 4 : 2;
      if (s.coins < price) return { ok: false, state: prevState, reason: `铜钱不足（需 ${price} 钱，当前 ${s.coins} 钱）。` };

      if (item === 'coal') {
        if (s.lamp >= s.lampMax) return { ok: false, state: prevState, reason: '琉璃灯火已满。' };
        s.coins -= 2;
        const before = s.lamp;
        s.lamp = Math.min(s.lampMax, s.lamp + (s.perk === 'eternal_wick' ? 4 : 3));
        fx = { sound: 'bellows', motion: 'warm', title: '添煤暖炉', toast: `灯火由 ${before} 升至 ${s.lamp}。`, unlockedCompendium: [] };
      } else if (item === 'blank') {
        if (s.blanks >= 4) return { ok: false, state: prevState, reason: '随车铁坯已满。' };
        s.coins -= 2;
        s.blanks += 1;
        fx = { sound: 'hammer_good', motion: 'warm', title: '添置铁坯', toast: `随车可用铁坯增至 ${s.blanks} 枚。`, unlockedCompendium: [] };
      } else if (item === 'upgrade') {
        if (!s.tool || s.tool.level === 2 || s.upgradeUsed) {
          return { ok: false, state: prevState, reason: '尚无奇器或已升至二阶。' };
        }
        s.coins -= 4;
        s.tool.level = 2;
        s.upgradeUsed = true;
        fx = { sound: 'hammer_perfect', motion: 'warm', tone: 'reward', title: '奇器升至二阶', toast: '随车奇器与杜伯援手同步升阶。', unlockedCompendium: [] };
      }
      return { ok: true, state: s, fx };
    }

    case 'retryChapter': {
      if (s.retries[s.chapter] >= 1) return { ok: false, state: prevState, reason: '本章重整机会已用过。' };
      const ch = s.chapter;
      const savedCheckpoint = JSON.parse(JSON.stringify(prevState.checkpoint));
      Object.assign(s, savedCheckpoint);
      s.retries[ch] = 1;
      s.checkpoint = savedCheckpoint;
      return { ok: true, state: s, fx: { sound: 'assist', motion: 'change', transition: true, title: `回到第${ch}章起点`, toast: '重整炉火与铁坯，再走这一程。', unlockedCompendium: [] } };
    }

    case 'evacuate': {
      if (s.lamp <= 0) return { ok: false, state: prevState, reason: '灯火已尽，请重整本章或记下止步。' };
      s.phase = 'ending';
      s.ending = buildEndingVerdict(s, 'homeward', null);
      return { ok: true, state: s, fx: { sound: 'assist', motion: 'change', transition: true, title: '保人归途', toast: '护着余火与同行人平安折返山下。', unlockedCompendium: [] } };
    }

    case 'acceptFailure': {
      s.phase = 'ending';
      s.ending = buildEndingVerdict(s, 'embers', null);
      return { ok: true, state: s, fx: { sound: 'damage', motion: 'change', transition: true, title: '炉火暂熄', toast: '这一程留下的印记已收入卷中。', unlockedCompendium: [] } };
    }

    default:
      return { ok: false, state: prevState, reason: '未知操作。' };
  }
}

// ==================== CLEAR ONE-FOCUS GUIDANCE ("只有当前推荐的一步燃起炉火") ====================
export function computeGuidedStep(state) {
  if (!state) return null;
  const hand = getWeapon(state, state.handId);
  const reserve = getWeapon(state, state.reserveId);

  if (state.phase === 'forging') {
    const w = getWeapon(state, state.forgeId);
    if (!w) return null;
    const zh = w.zoneHits || { tip: 0, spine: 0, guard: 0 };
    const hasArt = zh.tip >= 2 || zh.spine >= 2 || zh.guard >= 2;
    if (w.hits === 0) {
      return {
        speaker: 'du',
        line: '移动铁锤到剑尖、剑脊或剑格，看准下方游标滑入中央金火区时点击剑身落第一锤（前三锤必安全无裂）。',
        focusKey: 'forge-blade',
      };
    }
    if (!hasArt && w.hits < 3) {
      const targetPart = zh.tip === 1 ? '剑尖' : zh.spine === 1 ? '剑脊' : '剑格';
      return {
        speaker: 'du',
        line: `再敲一锤【${targetPart}】，即可为这柄新剑悟出零消耗独门剑技。`,
        focusKey: 'forge-blade',
      };
    }
    if (w.hits === 3 && state.charge > 0) {
      return {
        speaker: 'du',
        line: '三记安全锤已满。可点左侧【用定线】稳加1强，或直接点下方【寒泉 / 赤油 / 炉灰】收剑入鞘。',
        focusKey: 'seal-blaze',
      };
    }
    return {
      speaker: 'du',
      line: '剑锋已成！点击下方任一淬火法收剑入鞘（赤脂油淬首击伤害更高，寒泉水淬架剑更稳）。',
      focusKey: 'seal-blaze',
    };
  }

  if (state.phase === 'prepare') {
    if (state.node === 4 && state.choice === 'camp-old-sword') {
      return {
        speaker: 'du',
        line: '先决定老头子这柄旧剑的去留。留着它，到第六站避难炉能替你撑住危梁，保住你的好剑。',
        focusKey: 'choice-card',
      };
    }
    const forgedAny = state.weapons.some((w) => w.source === 'forged' && w.status === 'sealed');
    if (state.node === 1 && !forgedAny && state.blanks > 0) {
      return {
        speaker: 'du',
        line: '出发前先点下方发光的【为这趟路，打一柄剑】，用铁坯亲手锻出一柄带剑技的新剑。',
        focusKey: 'btn-begin-forge',
      };
    }
    if (state.node === 9 && ![hand, reserve].some((w) => isFinalEligible(w))) {
      return {
        speaker: 'du',
        line: '山口母灯只认你亲手打造的合格名剑（强度至少为3），请先开炉铸剑再登顶。',
        focusKey: state.blanks > 0 ? 'btn-begin-forge' : 'btn-emerg-blank',
      };
    }
    return {
      speaker: NODES_DATA[state.node]?.speaker || 'alan',
      line: NODES_DATA[state.node]?.line || '前路已探明，核对手中兵刃后即可点【推车前行】。',
      focusKey: 'btn-depart',
    };
  }

  if (state.phase === 'encounter' && state.encounter) {
    const e = state.encounter;
    if (e.id === 'n9') {
      const d1 = e.targets.some((t) => t.id === 'drive-lock' && t.health === 0);
      const d2 = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
      const d3 = state.flags.coreOwner === 'socket';
      const d4 = e.braced;
      if (!d1 && e.actions > 0) {
        return {
          speaker: 'du',
          line: '第一步：先点击道路上的【母灯传动锁】出剑将其斩断（击破可乘胜追击立返 1 次行动）。',
          focusKey: 'target-drive-lock',
        };
      }
      if (!d2 && e.actions > 0) {
        return {
          speaker: 'du',
          line: '第二步：传动锁已断！点击【逆转巨轮】出剑或施展剑技，将其耐久削归零停下巨轮。',
          focusKey: 'target-reverse-wheel',
        };
      }
      if (!d3 && e.actions > 0) {
        return {
          speaker: 'he',
          line: '第三步：巨轮已停！点击左中发光的【安放唯一灯芯】把灯芯放入母灯座。',
          focusKey: 'mech-placeCore',
        };
      }
      if (!d4) {
        const freeBrace = state.flags.carrier === 'player' && !e.braceAssistUsed;
        if (freeBrace) {
          return {
            speaker: 'he',
            line: '第四步：点击左中【阿禾扶稳母灯】（不占行动）锁住底座！',
            focusKey: 'mech-assistBrace',
          };
        }
        if (e.actions > 0) {
          return {
            speaker: 'he',
            line: '第四步：点击下方【架稳母灯】固定底座！',
            focusKey: 'btn-guard',
          };
        }
      }
      if (!isFinalEligible(hand) && isFinalEligible(reserve)) {
        return {
          speaker: 'du',
          line: '点击左下剑架【备用剑位】将你亲手打造的名剑换到手中，即可嵌剑复明！',
          focusKey: 'slot-reserve',
        };
      }
      if (e.actions > 0) {
        const sec = getSecretEndingStatus(state);
        return {
          speaker: 'du',
          line: sec.canIgniteCelestial
            ? '万家烽火已齐聚山巅！点击左中发光的【万家薪火 · 剑魄归宗】开启真结局！'
            : '最后一步：点击左中发光的【嵌剑入母灯】重燃十二山路长灯！',
          focusKey: 'mech-ignite',
        };
      }
    }

    if (['n5-north', 'n5-south'].includes(e.id) && state.flags.ferrymanSaved && !state.flags.ferryAssistUsed) {
      return {
        speaker: 'he',
        line: '昔日救起的摆渡人就在队中，点击左中【摆渡人牵索】（不占行动）可直接拉开冰封驿门！',
        focusKey: 'mech-ferryAssist',
      };
    }
    if (e.id === 'n8' && (state.flags.crossingHeld || (state.flags.southSaved && state.flags.ring === 'left')) && e.actions > 0) {
      return {
        speaker: 'alan',
        line: '山民已从侧崖放下引索，点击左中【侧路接应】可直接免战登顶母灯台！',
        focusKey: 'mech-useSideRoute',
      };
    }
    if (e.id === 'n6' && e.actions > 0) {
      const oldW = getWeapon(state, 'du-old-sword');
      if (oldW && isWeaponUsable(oldW) && oldW.strength >= 3) {
        return {
          speaker: 'du',
          line: '点击左中【留剑撑梁】用老头子的旧剑撑住屋顶，既救下满屋性命，也留住你亲手打的名剑。',
          focusKey: 'mech-donateShelter',
        };
      }
    }
    if (['n2', 'n5-south', 'n8'].includes(e.id) && e.actions > 0) {
      const cutId = e.id === 'n2' ? 'bridge-rope' : e.id === 'n5-south' ? 'south-rope' : 'relay-rope';
      const req = getCutRequirement(state, cutId);
      if (hand && isWeaponUsable(hand) && !hand.cracked && hand.strength >= req) {
        return {
          speaker: 'alan',
          line: `手中剑完好且锋利（强度≥${req}），点击左中【利刃切索】可一剑断索零磨损过关！`,
          focusKey: 'mech-cut',
        };
      }
    }

    if (canCastDualUlt(state)) {
      return {
        speaker: 'alan',
        line: '双剑在架且剑意充盈，点击下方【双剑合璧】（不占行动）一举重创全场敌方！',
        focusKey: 'btn-ult',
      };
    }

    if (hand && isWeaponUsable(hand) && !e.artUsedThisRound) {
      const art = getWeaponSwordArt(hand);
      if (state.qi >= art.artCost) {
        return {
          speaker: 'du',
          line: `剑意已足，可先施展下方零耗剑技《${art.artName}》，再接普通出剑连斩！`,
          focusKey: 'btn-art',
        };
      }
    }

    const hasScroll = hasRelic(state, 'relic_scroll');
    const canComp = (!hasScroll && !e.companionUsed) || (hasScroll && !e.companionUsedThisRound && e.usedCompanions.length < 3);
    const firstAlive = e.targets.find((t) => t.health > 0 && (!t.requiresDestroyed || e.targets.some((d) => d.id === t.requiresDestroyed && d.health === 0)));
    if (canComp && e.actions > 0 && firstAlive && firstAlive.armor > 0 && !e.opening && (!hasScroll || !e.usedCompanions.includes('he'))) {
      return {
        speaker: 'he',
        line: '敌方披有护甲，先点左中【阿禾 · 引灯照隙】（不占行动），下一剑即可无视护甲重创！',
        focusKey: 'comp-he',
      };
    }

    if (e.actions > 0 && isWeaponUsable(hand) && firstAlive) {
      return {
        speaker: 'alan',
        line: `直接点击道路上的【${firstAlive.name}】飞剑斩击（本轮首次破势或击破将立返 1 次行动）。`,
        focusKey: `target-${firstAlive.id}`,
      };
    }

    if (e.actions > 0 && !isWeaponUsable(hand) && isWeaponUsable(reserve)) {
      return {
        speaker: 'du',
        line: '手中剑已空，点击左下【备用剑位】换剑上阵（每战首次换剑不占行动）。',
        focusKey: 'slot-reserve',
      };
    }

    return {
      speaker: 'alan',
      line: '本轮行动已毕，点击下方发光的【结束本轮】结算风雪（敌袭时按空格可迎锋卸力反震）。',
      focusKey: 'btn-end',
    };
  }

  return null;
}

export function buildEndingVerdict(state, kind, dedicatedBlade) {
  const masterBonus = state.difficulty === 'master' ? 8 : 0;
  const maxStrength = state.weapons.reduce((m, w) => Math.max(m, w.sealedStrength || w.strength || 0), 3);
  const craftScore = Math.min(100, Math.round(maxStrength * 10 + state.stats.perfectStrikes * 6 + state.stats.totalForged * 8 + state.relics.length * 4 + masterBonus));
  const isLit = kind === 'relit' || kind === 'celestial_relit';
  const flameScore =
    kind === 'embers'
      ? Math.min(60, state.completedNodes.length * 7)
      : Math.min(100, Math.round((state.lamp / state.lampMax) * 62 + state.stats.flawlessRounds * 7 + (isLit ? 20 : 0)));

  let bene = 28;
  if (state.flags.escortFirst) bene += 14;
  if (state.flags.ferrymanSaved) bene += 16;
  if (state.flags.northSaved) bene += 14;
  if (state.flags.southSaved) bene += 14;
  if (state.flags.ring === 'left') bene += 14;
  if (state.flags.shelterSword) bene += 8;
  const benevolenceScore = Math.min(100, bene);

  const tacticsScore = Math.min(
    100,
    Math.round(34 + state.stats.staggerBreaks * 10 + state.stats.perfectParries * 12 + state.stats.swordArtsUsed * 9 + state.stats.dualUltimates * 14 + masterBonus)
  );

  const consequences = [];
  if (state.flags.escortFirst) consequences.push('河谷暗夜先护同行人过谷，阿岚一路铁壁相随。');
  if (state.flags.ferrymanSaved) consequences.push('断桥急流拉起摆渡人，风雪双驿得其牵索开门。');
  if (state.flags.crossingHeld) consequences.push('古渡口横剑断后击退重卫，打通了山口接应侧路。');
  if (state.flags.northSaved) consequences.push('北驿巡守脱困，寒山烽烟有人守望。');
  if (state.flags.southSaved) consequences.push('南驿信使获救，山路音讯得以相传。');
  if (state.flags.shelterSword) {
    const sw = getWeapon(state, state.flags.shelterSword);
    consequences.push(`雪谷避难炉危梁之下，「${formatWeaponTitle(sw)}」替一屋妇孺撑起了生路。`);
  }
  if (state.flags.ring === 'left') consequences.push('恒温环留在避难炉中，雪谷孤屋彻夜温暖。');
  else if (state.flags.ring === 'taken') consequences.push('恒温环随炉车登顶，替母灯挡下了绝顶狂飙。');
  if (dedicatedBlade) {
    consequences.push(
      kind === 'celestial_relit'
        ? `神兵「${dedicatedBlade.name}」（强度 ${dedicatedBlade.strength}）引动山下万家灯火共鸣，化作不灭剑魄灯枢，并凝出传世【万家薪火剑】。`
        : `亲手锻打的「${dedicatedBlade.name}」（强度 ${dedicatedBlade.strength}）嵌入母灯，化作十二山路长明灯骨。`
    );
  }

  const causalityScore = Math.min(100, Math.round((state.completedNodes.length / 9) * 55 + consequences.length * 7 + (isLit ? 16 : 0)));
  const avg = Math.round((craftScore + flameScore + benevolenceScore + tacticsScore + causalityScore) / 5);

  const grade =
    kind === 'celestial_relit'
      ? '甲上 · 万家薪火（隐藏真结局）'
      : kind === 'relit' && avg >= 84
      ? '甲等 · 薪火剑圣'
      : kind === 'relit'
      ? '乙上 · 护炉宗师'
      : avg >= 58
      ? '乙等 · 雪线铸师'
      : '丙等 · 守火行者';

  const titles = {
    celestial_relit: '万家薪火 · 剑魄归宗',
    relit: '灯路复明 · 十二山火重燃',
    homeward: '保人归途 · 留得青山薪火',
    embers: '炉火暂熄 · 铁骨犹记来路',
  };

  const summaries = {
    celestial_relit: `当「${dedicatedBlade ? dedicatedBlade.name : '自铸神兵'}」嵌入母灯底座的一瞬，山下古渡口的摆渡人、南北双驿的巡守信使与雪谷避难炉的妇孺同时举起火把。万家愿火顺着十二盏长明路灯逆流登顶，母灯绽开金青双色天光——你的剑魂永镇山巅，而杜伯以母灯余烬为你重铸了一柄【万家薪火剑】随身归乡。`,
    relit: `随着「${dedicatedBlade ? dedicatedBlade.name : '自铸名剑'}」铿然嵌入母灯核心，停滞的巨轮化作金光灯枢，自绝顶向河谷依次点亮十二盏山路长灯。剑是你亲手打的，而同行的人都走到了光里。`,
    homeward: `车队在「${NODES_DATA[state.node].title}」收拢余火（余 ${state.lamp} 点灯火），护着唯一灯芯与已救下的同行人平安折返山下。母灯虽待来日重燃，但每一条性命都已带回。`,
    embers: `寒风吹暗炉火，远行暂止于「${NODES_DATA[state.node].title}」。沿途打出的每一锤火候、救下的每一位同行人，皆已留在山道记忆里。`,
  };

  const smiled = isLit;
  const epilogues = [
    {
      name: '阿岚',
      art: smiled ? 'head_alan_smile' : 'head_alan',
      line:
        kind === 'celestial_relit'
          ? '听见山下的呼声了吗？古渡、双驿、避难炉……你沿途护住的每一簇小火，今夜全都汇成星河照回山顶了。'
          : kind === 'relit'
          ? '从河谷暗夜到绝顶山口，这一路有你的剑开道，没有一个人落在黑夜里。'
          : '先把人护周全了。只要打铁的手还在，这条山路咱们随时能再走一遭。',
    },
    {
      name: '阿禾',
      art: smiled ? 'head_he_smile' : 'head_he',
      line:
        kind === 'celestial_relit'
          ? '双驿的信使把今夜写进护灯歌谣里了。往后走夜路的人抬头看见母灯双辉，都会记起这辆小炉车。'
          : kind === 'relit'
          ? '快看山下！双驿、避难炉、古渡口的灯一盏接一盏全亮了，信使们再也不用摸黑过雪谷了。'
          : '唯一灯芯我贴身收稳了，救出来的人都记着这盏炉车的暖光。',
    },
    {
      name: '杜伯',
      art: smiled ? 'head_du_smile' : 'head_du',
      line:
        kind === 'celestial_relit'
          ? '打了一辈子铁，头一回见万家灯火反哺剑魂。来，这柄母灯余火凝成的【万家薪火剑】，老头子替你记在剑谱第一页。'
          : kind === 'relit'
          ? `好火候。那柄「${dedicatedBlade ? dedicatedBlade.name : '新剑'}」稳稳当当，比老头子年轻时打的剑更配镇守母灯。`
          : '莫急，好铁本就要千锤百炼。歇口气调匀炉风，咱们随时再起炉。',
    },
  ];

  return {
    kind,
    isSecret: kind === 'celestial_relit',
    stoppedAt: NODES_DATA[state.node].title,
    grade,
    title: titles[kind],
    summary: summaries[kind],
    axes: [
      { label: '铸剑火候', value: craftScore },
      { label: '护灯余温', value: flameScore },
      { label: '同行仁心', value: benevolenceScore },
      { label: '破阵锋芒', value: tacticsScore },
      { label: '因果回响', value: causalityScore },
    ],
    epilogues,
    consequences,
  };
}

export function buildPresetState(presetId, compendiumCount = 0) {
  if (presetId === 'preset_ch1_forge') {
    let s = createInitialState('试锋-初炉', 'hundred_refinements', true, 'standard', compendiumCount);
    s.coins = 4;
    s = dispatchAction(s, { type: 'beginForge', archetype: 'jian' }).state;
    return s;
  }
  if (presetId === 'preset_ch1_crossing') {
    const s = createInitialState('试锋-古渡', 'vanguard_edge', true, 'standard', compendiumCount);
    s.node = 3;
    s.chapter = 1;
    s.lamp = 7;
    s.qi = 4;
    s.coins = 5;
    s.relics = ['relic_tongs', 'relic_hammer', 'relic_mirror'];
    s.completedNodes = [1, 2];
    s.flags.escortFirst = true;
    s.flags.ferrymanSaved = true;
    s.tool = { kind: 'rebound', level: 1, stored: 0 };
    s.weapons.push(
      {
        id: 'w-2',
        name: '焚岳破阵刀',
        compendiumTitle: '焚岳破阵刀',
        archetype: 'dao',
        quench: 'blaze',
        source: 'forged',
        madeInChapter: 1,
        status: 'sealed',
        owner: 'player',
        strength: 5,
        sealedStrength: 5,
        hits: 4,
        perfectHits: 3,
        stars: 0,
        zoneHits: { tip: 1, spine: 3, guard: 0 },
        artZone: 'spine',
        cracked: false,
        fissureMarked: false,
        technique: 'steady',
      },
      {
        id: 'w-3',
        name: '霜河定影剑',
        compendiumTitle: '霜河定影剑',
        archetype: 'jian',
        quench: 'frost',
        source: 'forged',
        madeInChapter: 1,
        status: 'sealed',
        owner: 'player',
        strength: 4,
        sealedStrength: 4,
        hits: 3,
        perfectHits: 2,
        stars: 0,
        zoneHits: { tip: 3, spine: 0, guard: 0 },
        artZone: 'tip',
        cracked: false,
        fissureMarked: false,
        technique: null,
      }
    );
    s.handId = 'w-2';
    s.reserveId = 'w-3';
    s.encounter = createEncounterFor(s, 'n3-main');
    s.phase = 'encounter';
    return s;
  }
  if (presetId === 'preset_ch2_shelter') {
    const s = createInitialState('试锋-孤炉', 'eternal_wick', true, 'standard', compendiumCount);
    s.chapter = 2;
    s.node = 6;
    s.lamp = 8;
    s.qi = 3;
    s.coins = 6;
    s.relics = ['relic_mirror', 'relic_gourd', 'relic_scroll', 'relic_tea'];
    s.completedNodes = [1, 2, 3, 4, 5];
    s.flags.escortFirst = true;
    s.flags.ferrymanSaved = true;
    s.flags.northSaved = true;
    s.flags.southSaved = true;
    s.flags.oldDecision = 'paid';
    s.tool = { kind: 'furnace', level: 2, stored: 0 };
    s.upgradeUsed = true;
    s.weapons.push({
      id: 'w-4',
      name: '厚土载火刃',
      compendiumTitle: '厚土载火刃',
      archetype: 'cleaver',
      quench: 'hearth',
      source: 'forged',
      madeInChapter: 2,
      status: 'sealed',
      owner: 'player',
      strength: 6,
      sealedStrength: 6,
      hits: 4,
      perfectHits: 3,
      stars: 0,
      zoneHits: { tip: 0, spine: 2, guard: 2 },
      artZone: 'guard',
      cracked: false,
      fissureMarked: false,
      technique: 'steady',
    });
    s.handId = 'w-4';
    s.reserveId = 'du-old-sword';
    s.encounter = createEncounterFor(s, 'n6');
    s.phase = 'encounter';
    return s;
  }
  if (presetId === 'preset_secret_ending') {
    const s = createInitialState('试锋-万家薪火', 'eternal_wick', true, 'standard', compendiumCount);
    s.chapter = 3;
    s.node = 9;
    s.lamp = 8;
    s.qi = 5;
    s.coins = 7;
    s.relics = ['relic_cauldron', 'relic_meteor', 'relic_mirror', 'relic_scroll', 'relic_tea'];
    s.completedNodes = [1, 2, 3, 4, 5, 6, 7, 8];
    s.flags.escortFirst = true;
    s.flags.ferrymanSaved = true;
    s.flags.crossingHeld = true;
    s.flags.northSaved = true;
    s.flags.southSaved = true;
    s.flags.ring = 'left';
    s.flags.oldDecision = 'paid';
    s.flags.carrier = 'courier';
    s.flags.coreOwner = 'socket';
    s.tool = { kind: 'rebound', level: 2, stored: 4 };
    s.upgradeUsed = true;
    s.weapons.push({
      id: 'w-12',
      name: '天工无瑕剑',
      compendiumTitle: '天工无瑕剑',
      archetype: 'jian',
      quench: 'blaze',
      source: 'forged',
      madeInChapter: 3,
      status: 'sealed',
      owner: 'player',
      strength: 8,
      sealedStrength: 8,
      hits: 5,
      perfectHits: 4,
      stars: 0,
      zoneHits: { tip: 3, spine: 2, guard: 0 },
      artZone: 'tip',
      cracked: false,
      fissureMarked: false,
      technique: 'steady',
    });
    s.handId = 'w-12';
    s.reserveId = 'du-old-sword';
    s.encounter = createEncounterFor(s, 'n9');
    s.encounter.targets[0].health = 0;
    s.encounter.targets[1].health = 4;
    s.phase = 'encounter';
    return s;
  }

  const s = createInitialState('试锋-母灯', 'hundred_refinements', true, 'standard', compendiumCount);
  s.chapter = 3;
  s.node = 9;
  s.lamp = 7;
  s.qi = 4;
  s.coins = 6;
  s.relics = ['relic_cauldron', 'relic_meteor', 'relic_hammer', 'relic_tongs'];
  s.completedNodes = [1, 2, 3, 4, 5, 6, 7, 8];
  s.flags.escortFirst = true;
  s.flags.ferrymanSaved = true;
  s.flags.crossingHeld = true;
  s.flags.northSaved = true;
  s.flags.ring = 'taken';
  s.flags.oldDecision = 'paid';
  s.flags.carrier = 'courier';
  s.flags.coreOwner = 'socket';
  s.tool = { kind: 'rebound', level: 2, stored: 3 };
  s.upgradeUsed = true;
  s.weapons.push({
    id: 'w-9',
    name: '赤霄引灯剑',
    compendiumTitle: '赤霄引灯剑',
    archetype: 'jian',
    quench: 'blaze',
    source: 'forged',
    madeInChapter: 3,
    status: 'sealed',
    owner: 'player',
    strength: 7,
    sealedStrength: 7,
    hits: 4,
    perfectHits: 3,
    stars: 0,
    zoneHits: { tip: 2, spine: 2, guard: 0 },
    artZone: 'tip',
    cracked: false,
    fissureMarked: false,
    technique: 'steady',
  });
  s.handId = 'w-9';
  s.reserveId = 'du-old-sword';
  s.encounter = createEncounterFor(s, 'n9');
  s.phase = 'encounter';
  return s;
}

export {
  BLADE_ARCHETYPES,
  BLADE_ZONES,
  CHAPTER_INFO,
  CHOICES_DATA,
  COMPANIONS,
  DESTINY_PERKS,
  DIFFICULTY_MODES,
  HEAT_SPEED_MODES,
  NODES_DATA,
  QUENCH_TRAITS,
  RELICS_POOL,
  RELIC_SYNERGIES,
  SWORD_COMPENDIUM,
  SWORD_STANCES,
  TRIAL_CHAPTERS,
};
