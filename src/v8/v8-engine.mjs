// V8.2 Competition Core Engine: Dual Difficulty Curves, 12-Blade Compendium, Secret Celestial Ending & Tactical Combat
import {
  BLADE_ARCHETYPES,
  CHAPTER_INFO,
  CHOICES_DATA,
  COMPANIONS,
  DESTINY_PERKS,
  DIFFICULTY_MODES,
  HEAT_SPEED_MODES,
  NODES_DATA,
  QUENCH_TRAITS,
  SWORD_COMPENDIUM,
} from './v8-data.mjs';

export const V8_STORAGE_KEY = 'sword_led_v8_save_v1';
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

export function evaluateBladeCompendiumIds(weapon) {
  if (!weapon || weapon.source !== 'forged') return [];
  const matched = [];
  for (const entry of SWORD_COMPENDIUM) {
    if (entry.id !== 'special_celestial' && entry.match(weapon)) {
      matched.push(entry.id);
    }
  }
  return matched;
}

export function getCompendiumTitleForBlade(weapon) {
  if (!weapon || weapon.source !== 'forged') return null;
  if (!weapon.cracked && weapon.perfectHits >= 3 && (weapon.sealedStrength || weapon.strength) >= 6) {
    return '天工无瑕剑';
  }
  if (weapon.fissureMarked && (weapon.sealedStrength || weapon.strength) >= 6) {
    return '裂星惊鸿刃';
  }
  const regular = SWORD_COMPENDIUM.find((e) => !e.id.startsWith('special_') && e.match(weapon));
  return regular ? regular.name : null;
}

export function createInitialState(
  seed = '薪火-2026',
  perk = 'hundred_refinements',
  skipPrologue = false,
  difficulty = 'standard',
  compendiumCount = 0
) {
  const lampMax = perk === 'eternal_wick' ? 9 : 8;
  const startLamp = perk === 'eternal_wick' ? 7 : 6;
  const compendiumCoinBonus = compendiumCount >= 6 ? 1 : 0;
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
    cracked: false,
    fissureMarked: false,
    technique: null,
  };

  const base = {
    version: 'v8-competition',
    seed,
    rng: hashSeed(seed),
    perk,
    difficulty: difficulty === 'master' ? 'master' : 'standard',
    prologueSeen: skipPrologue,
    chapter: 1,
    node: 1,
    phase: 'prepare',
    choice: null,
    lamp: startLamp,
    lampMax,
    coins: startCoins,
    blanks: 3,
    charge: 1,
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
      enemiesDefeated: 0,
      quickSwaps: 0,
      companionAssists: 0,
      flawlessRounds: 0,
    },
    encounter: null,
    completedNodes: [],
    logs: [
      `【立誓启程 · ${difficulty === 'master' ? '宗师试炼' : '寻常行旅'}】山口母灯熄灭，推起小炉车护送唯一灯芯上山${
        compendiumCoinBonus ? '（名剑图鉴加持：初始铜钱+1）' : ''
      }。`,
    ],
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
  return !!w && w.owner === 'player' && w.status === 'sealed' && w.strength > 0;
}

export function isFinalEligible(w) {
  if (!isWeaponUsable(w) || w.source !== 'forged') return false;
  return !w.cracked ? w.strength >= 3 : w.fissureMarked && w.strength >= 1;
}

export function getSecretEndingStatus(state) {
  const benevolenceMet = Boolean(
    state.flags.ferrymanSaved && state.flags.northSaved && state.flags.southSaved && state.flags.ring === 'left'
  );
  const hand = getWeapon(state, state.handId);
  const reserve = getWeapon(state, state.reserveId);
  const anyMasterSword = [hand, reserve].some((w) => isFinalEligible(w) && w.strength >= 6);
  const handMasterSword = isFinalEligible(hand) && hand.strength >= 6;
  const flameMet = state.lamp >= 5;
  const metCount = (benevolenceMet ? 1 : 0) + (anyMasterSword ? 1 : 0) + (flameMet ? 1 : 0);
  return {
    benevolenceMet,
    anyMasterSword,
    handMasterSword,
    flameMet,
    metCount,
    canIgniteCelestial: benevolenceMet && handMasterSword && flameMet,
  };
}

export function formatWeaponTitle(w) {
  if (!w) return '空剑位';
  if (w.source === 'inherited') return '杜伯旧剑';
  if (w.compendiumTitle) return w.compendiumTitle;
  const arch = BLADE_ARCHETYPES[w.archetype] || BLADE_ARCHETYPES.jian;
  const q = w.quench && QUENCH_TRAITS[w.quench] ? `${QUENCH_TRAITS[w.quench].short}·` : '';
  const prefix = w.fissureMarked ? '崩纹' : w.technique === 'steady' ? '定线' : w.perfectHits >= 3 ? '神锻' : '';
  const shortArch = arch.id === 'dao' ? '重刀' : arch.id === 'cleaver' ? '阔刃' : '长剑';
  return `${q}${prefix}${shortArch}`;
}

export function isCompanionUpgraded(state, cid) {
  if (cid === 'alan') return state.flags.escortFirst === true || state.flags.crossingHeld;
  if (cid === 'he') return state.flags.northSaved || state.flags.southSaved;
  if (cid === 'du') return state.flags.oldDecision !== null || state.upgradeUsed;
  return false;
}

export function getCutRequirement(state, cutTarget) {
  const base = cutTarget === 'bridge-rope' ? 3 : 4;
  const hand = getWeapon(state, state.handId);
  const discount = hand && hand.archetype === 'jian' ? 1 : 0;
  return Math.max(2, base - discount);
}

// Finely tuned Chapter 1 -> Chapter 3 Monster & Mechanism Curves (Standard vs Master)
export function getEncounterSpec(state, encId) {
  const master = state.difficulty === 'master';
  const mk = (id, name, hp, armor, pressures, artKey, requiresDestroyed = null) => ({
    id,
    name,
    health: hp,
    maxHealth: hp,
    armor,
    pressures,
    role: pressures.length > 0 ? 'threat' : 'mechanism',
    artKey,
    requiresDestroyed,
    staggered: false,
    struckOnce: false,
  });

  switch (encId) {
    case 'n1':
      return {
        targets: [mk('wood-guard', '巡路木卫', master ? 8 : 6, master ? 2 : 1, master ? [2, 3, 4] : [2, 2, 3], 'enemy_wood')],
        environment: [],
        roundLimit: 3,
      };
    case 'n2':
      return {
        targets: [mk('bridge-latch', '断桥铁闩', master ? 7 : 5, 2, [], 'enemy_winch')],
        environment: master ? [2, 3, 4] : [2, 2, 3],
        roundLimit: 3,
      };
    case 'n3-main':
      return {
        targets: [
          mk('charger', '重甲冲阵者', master ? 7 : 6, master ? 2 : 1, master ? [3, 0, 4] : [3, 0, 3], 'enemy_charger'),
          mk('flanker', '鸦面绕行者', master ? 5 : 4, master ? 1 : 0, master ? [0, 3, 4] : [0, 3, 3], 'enemy_flanker'),
        ],
        environment: [],
        roundLimit: 3,
      };
    case 'n3-extra':
      return {
        targets: [mk('rammer', '狂暴撞桩重卫', master ? 10 : 8, 2, [master ? 5 : 4], 'enemy_charger')],
        environment: [],
        roundLimit: 1,
      };
    case 'n5-north': {
      const first = state.flags.firstStation === 'north';
      return {
        targets: [mk('north-latch', '北驿冰封门闩', master ? 7 : 6, master ? 2 : 1, [], 'enemy_winch')],
        environment: first ? [2, 2] : master ? [3, 3] : [2, 3],
        roundLimit: 2,
      };
    }
    case 'n5-south': {
      const first = state.flags.firstStation === 'south';
      return {
        targets: [mk('south-latch', '南驿铁索障锁', master ? 8 : 6, 2, [], 'enemy_winch')],
        environment: first ? [2, 2] : master ? [3, 3] : [2, 3],
        roundLimit: 2,
      };
    }
    case 'n6':
      return {
        targets: [mk('roof-lock', '避难炉失控顶锁', master ? 12 : 10, master ? 3 : 2, [], 'enemy_shelter')],
        environment: master ? [4, 4, 5] : [3, 4, 4],
        roundLimit: 3,
      };
    case 'n7': {
      const loose = mk('loose-rock', '散落滚石', master ? 5 : 4, 0, master ? [2, 2, 3] : [1, 2, 2], 'enemy_rock');
      if (state.flags.northSaved && state.flags.ring === 'left') {
        loose.health = 0;
      }
      return {
        targets: [mk('main-rock', '雪崩主落石', master ? 10 : 8, 2, master ? [3, 4, 5] : [3, 3, 4], 'enemy_rock'), loose],
        environment: [],
        roundLimit: 3,
      };
    }
    case 'n8':
      return {
        targets: [mk('relay-latch', '山口巨石铁闩', master ? 10 : 8, 2, [], 'enemy_winch')],
        environment: master ? [3, 3, 4] : [2, 3, 3],
        roundLimit: 3,
      };
    case 'n9':
      return {
        targets: [
          mk('drive-lock', '逆转传动锁', master ? 5 : 4, master ? 1 : 0, [], 'enemy_drive'),
          mk('reverse-wheel', '母灯逆转巨轮', master ? 13 : 10, 2, [], 'enemy_wheel', 'drive-lock'),
        ],
        environment: master ? [3, 4, 5, 6, 6] : [2, 3, 4, 5, 5],
        roundLimit: 5,
      };
    default:
      return { targets: [], environment: [], roundLimit: 3 };
  }
}

export function createEncounterFor(state, encId) {
  const spec = getEncounterSpec(state, encId);
  const vanguard = state.perk === 'vanguard_edge';
  return {
    id: encId,
    round: 1,
    roundLimit: spec.roundLimit,
    actions: 2,
    block: encId === 'n9' && state.flags.carrier === 'courier' ? 2 : 0,
    opening: vanguard,
    openingBonusDmg: vanguard ? 1 : 0,
    guarded: false,
    frostUsed: false,
    hearthUsed: false,
    swapUsedFree: false,
    swapBuff: false,
    companionUsed: false,
    duTempPower: 0,
    alanSnowShield: 0,
    braced: false,
    braceAssistUsed: false,
    alanGuard: false,
    reboundClaimed: false,
    followUpUsed: false,
    furnaceTriggered: false,
    routeOpened: false,
    targets: spec.targets,
    environment: spec.environment,
  };
}

export function getStaggerThreshold(state) {
  return state.difficulty === 'master' ? 4 : 3;
}

export function computeStrikePreview(state, weapon, target) {
  const e = state.encounter;
  if (!weapon || !isWeaponUsable(weapon) || !target) return null;

  const fissure = weapon.cracked && weapon.fissureMarked;
  const opening = e ? e.opening : false;
  const ignoresArmor = fissure || opening;
  const daoPierce = weapon.archetype === 'dao' ? 1 : 0;
  const effectiveArmor = ignoresArmor ? 0 : Math.max(0, target.armor - daoPierce);

  let dmg = Math.max(0, weapon.strength - effectiveArmor);
  if (opening) {
    dmg += 2 + (e ? e.openingBonusDmg : 0);
    if (weapon.archetype === 'jian') dmg += 1;
  }
  if (fissure) dmg += 2;
  if (e && e.swapBuff) dmg += 1;
  if (e && e.duTempPower > 0) dmg += e.duTempPower;
  if (weapon.quench === 'blaze' && target.health === target.maxHealth) dmg += 2;

  const wear = fissure ? Math.min(weapon.strength, 2) : 0;
  const strengthAfter = Math.max(0, weapon.strength - wear);
  const currentThreat = getTargetRoundPressure(target, e ? e.round : 1);
  const breakNeed = getStaggerThreshold(state);
  const willStagger =
    target.role === 'threat' &&
    !target.staggered &&
    currentThreat >= 3 &&
    (dmg >= breakNeed || (opening && dmg >= breakNeed - 1)) &&
    target.health > dmg;

  return {
    damage: dmg,
    effectiveArmor,
    ignoresArmor,
    wear,
    strengthBefore: weapon.strength,
    strengthAfter,
    healthAfter: Math.max(0, target.health - dmg),
    breaksWeapon: strengthAfter === 0,
    willStagger,
    willKill: target.health > 0 && dmg >= target.health,
  };
}

export function getTargetRoundPressure(target, round) {
  if (!target || target.health <= 0 || target.staggered || !target.pressures.length) return 0;
  const idx = Math.min(round - 1, target.pressures.length - 1);
  return target.pressures[idx] ?? 0;
}

export function computePressureSummary(state) {
  const e = state.encounter;
  if (!e) return { threatPressure: 0, envPressure: 0, totalPressure: 0, reduction: 0, block: 0, loss: 0 };
  const threatPressure = e.targets.reduce((acc, t) => acc + getTargetRoundPressure(t, e.round), 0);
  const rawEnv = e.environment.length ? (e.environment[Math.min(e.round - 1, e.environment.length - 1)] ?? 0) : 0;
  const envPressure = Math.max(0, rawEnv - e.alanSnowShield);
  const totalPressure = threatPressure + envPressure;
  const reduction =
    (e.id === 'n3-main' && e.round === 1 && state.flags.escortFirst ? 1 : 0) +
    (e.alanGuard ? 2 : 0) +
    (e.id === 'n9' && state.flags.ring === 'taken' ? 2 : 0);
  const loss = Math.max(0, totalPressure - reduction - e.block);
  return { threatPressure, envPressure, totalPressure, reduction, block: e.block, loss };
}

function advanceToNode(state, nextNode) {
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
    pushLog(state, `【进入第${nextChapter}章 · ${CHAPTER_INFO[nextChapter].name}】补给铁坯至3、技火至1，灯火 ${beforeLamp}→${state.lamp}。`);
    state.checkpoint = clonePlayable(state);
  } else {
    pushLog(state, `【抵达第${nextNode}站 · ${NODES_DATA[nextNode].title}】${NODES_DATA[nextNode].mission}`);
  }
}

function checkEncounterResolution(state, endedRound = false) {
  const e = state.encounter;
  if (!e || state.phase !== 'encounter') return null;

  if (state.lamp <= 0) {
    state.phase = 'failed';
    state.failure = { reason: 'light-exhausted', node: state.node, text: '风雪吹熄了最后一缕灯火，队伍被迫在暗夜中止步。' };
    pushLog(state, '【灯火耗尽】可从本章起点重整旗鼓，或记下这次止步。');
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
        state.phase = 'choice';
        state.choice = 'first-road';
        pushLog(state, '【巡路打通】获得 +2 铜钱！请在河谷岔路作出抉择。');
        break;
      case 'n2':
        state.phase = 'choice';
        state.choice = 'bridge-rescue';
        pushLog(state, '【断桥通行】急流边传来呼救，请抉择先救摆渡人还是商货。');
        break;
      case 'n3-main':
        state.coins += 3;
        state.phase = 'choice';
        state.choice = 'crossing-extra';
        pushLog(state, '【渡口守住】获得 +3 铜钱！主力已过河，是否横剑断后加守一轮？');
        break;
      case 'n3-extra':
        state.flags.crossingHeld = true;
        state.coins += 3;
        if (!state.completedNodes.includes(3)) state.completedNodes.push(3);
        pushLog(state, '【断后大捷】击退撞桩重卫！获得 +3 铜钱，阿岚协战升阶，第8站山口侧路已打通！');
        advanceToNode(state, 4);
        break;
      case 'n5-north':
      case 'n5-south':
        if (id === 'n5-north') state.flags.northSaved = true;
        else state.flags.southSaved = true;
        state.coins += 2;
        pushLog(state, `【${id === 'n5-north' ? '北驿巡守' : '南驿信使'}脱困】获得 +2 铜钱，阿禾协战升阶！`);
        if (state.flags.northSaved && state.flags.southSaved) {
          if (!state.completedNodes.includes(5)) state.completedNodes.push(5);
          advanceToNode(state, 6);
        } else {
          state.phase = 'choice';
          state.choice = 'station-second';
        }
        break;
      case 'n6':
        state.phase = 'choice';
        state.choice = 'shelter-ring';
        pushLog(state, '【炉梁稳固】避难炉转危为安，请决定恒温环的去留。');
        break;
      case 'n7':
        state.coins += 2;
        if (!state.completedNodes.includes(7)) state.completedNodes.push(7);
        pushLog(state, '【穿过落石口】获得 +2 铜钱！前方即是山口石阶。');
        advanceToNode(state, 8);
        break;
      case 'n8':
        if (state.flags.carrier === 'courier') state.flags.coreOwner = 'socket';
        if (!state.completedNodes.includes(8)) state.completedNodes.push(8);
        pushLog(state, '【山口洞开】绝顶母灯台就在眼前！');
        advanceToNode(state, 9);
        break;
      default:
        break;
    }
    return 'completed';
  }

  if (endedRound && e.round >= e.roundLimit) {
    state.phase = 'failed';
    state.failure = { reason: 'round-limit', node: state.node, text: '未能在风雪封路前破开阻碍，炉车被困在半途。' };
    pushLog(state, '【超出轮限】可消耗本章重整机会回到章初重新部署。');
    return 'failed';
  }

  return null;
}

export function dispatchAction(prevState, action) {
  const s = JSON.parse(JSON.stringify(prevState));
  let fx = { sound: 'click', visual: null, toast: null, unlockedCompendium: [] };

  switch (action.type) {
    case 'dismissPrologue': {
      s.prologueSeen = true;
      fx.sound = 'scroll';
      return { ok: true, state: s, fx };
    }

    case 'setDifficulty': {
      const nextDiff = action.difficulty === 'master' ? 'master' : 'standard';
      s.difficulty = nextDiff;
      fx = {
        sound: 'assist',
        visual: null,
        toast: `已切换难度为【${DIFFICULTY_MODES[nextDiff].name}】（后续遭遇即时生效）`,
        unlockedCompendium: [],
      };
      pushLog(s, fx.toast);
      return { ok: true, state: s, fx };
    }

    case 'beginForge': {
      if (s.phase !== 'prepare' || s.blanks <= 0) {
        return { ok: false, state: prevState, reason: '当前没有可用铁坯，可在营地杜伯处添置。' };
      }
      const archetype = action.archetype || 'jian';
      const archInfo = BLADE_ARCHETYPES[archetype] || BLADE_ARCHETYPES.jian;
      const id = `w-${++s.weaponSerial}`;
      const startStars = s.perk === 'hundred_refinements' ? 1 : 0;
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
        stars: startStars,
        cracked: false,
        fissureMarked: false,
        technique: null,
      });
      s.blanks -= 1;
      s.forgeId = id;
      s.phase = 'forging';
      fx = {
        sound: 'bellows',
        visual: 'startForge',
        toast: `【${archInfo.name}入炉】炉风柔和跟手，瞄准金焰甜区落锤攒星火暴击！`,
        unlockedCompendium: [],
      };
      pushLog(s, `【开炉铸剑】投入1枚铁坯打造「${archInfo.name}」（初始强度 ${archInfo.baseBonus}）。`);
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
      fx = { sound: 'swap', visual: null, toast: `切换器型为【${archInfo.name}】`, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'hammer': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits >= 6) {
        return { ok: false, state: prevState, reason: '已敲满6锤，请淬火收锻！' };
      }
      const zone = action.zone || 'good';
      const safe = w.hits < 3;
      w.hits += 1;
      s.stats.totalHammerHits += 1;

      if (safe) {
        w.strength += 1;
        let bonus = 0;
        if (zone === 'perfect') {
          w.perfectHits += 1;
          s.stats.perfectStrikes += 1;
          w.stars += 1;
          if (w.stars >= 2) {
            w.stars -= 2;
            w.strength += 1;
            bonus = 1;
          }
          fx = {
            sound: 'hammer_perfect',
            visual: 'hammerPerfect',
            toast: bonus ? `🔥 金焰神锻暴击！星火成锋，强度直升至 ${w.strength}！` : `✨ 金焰极温好锤！强度 +1，星火 +1（${w.stars}/2）`,
            unlockedCompendium: [],
          };
          pushLog(s, `第${w.hits}锤【金焰极温】：强度 +${1 + bonus} → ${w.strength}`);
        } else {
          fx = {
            sound: zone === 'good' ? 'hammer_good' : 'hammer_cold',
            visual: 'hammerGood',
            toast: `🔨 稳锤落定，强度升至 ${w.strength}（前3锤零裂纹风险）`,
            unlockedCompendium: [],
          };
          pushLog(s, `第${w.hits}锤【稳火落锤】：强度 +1 → ${w.strength}`);
        }
      } else {
        let risk = w.cracked ? 0.32 : 0.18;
        if (zone === 'perfect') risk *= 0.4;
        else if (zone === 'cold') risk *= 1.15;

        const roll = nextRng(s.rng);
        s.rng = roll.next;
        if (roll.value < risk) {
          if (w.cracked) {
            w.status = 'broken';
            w.owner = 'none';
            s.forgeId = null;
            s.phase = 'prepare';
            fx = { sound: 'crack', visual: 'bladeBroken', toast: '💥 再裂断刃！铁坯承受不住重击碎裂了。', unlockedCompendium: [] };
            pushLog(s, `第${w.hits}锤【断刃】：裂纹贯通，剑坯碎裂。`);
          } else {
            w.cracked = true;
            w.strength = Math.max(1, w.strength - 1);
            fx = {
              sound: 'crack',
              visual: 'bladeCrack',
              toast: `⚡ 刃生首裂（强度 ${w.strength}）！可收锻止损，或刻入「崩纹」化裂为锋！`,
              unlockedCompendium: [],
            };
            pushLog(s, `第${w.hits}锤【首裂】：刃口出现裂纹，强度变为 ${w.strength}。`);
          }
        } else {
          w.strength += 1;
          let bonus = 0;
          if (zone === 'perfect') {
            w.perfectHits += 1;
            s.stats.perfectStrikes += 1;
            w.stars += 1;
            if (w.stars >= 2) {
              w.stars -= 2;
              w.strength += 1;
              bonus = 1;
            }
          }
          fx = {
            sound: zone === 'perfect' ? 'hammer_perfect' : 'hammer_good',
            visual: zone === 'perfect' ? 'hammerPerfect' : 'hammerGood',
            toast: bonus ? `🔥 险中神锻！极温无裂且星火成锋，强度飙至 ${w.strength}！` : `✨ 险锤成锋！强度升至 ${w.strength}`,
            unlockedCompendium: [],
          };
          pushLog(s, `第${w.hits}锤【险中求锋】：成功无裂，强度 → ${w.strength}！`);
        }
      }
      return { ok: true, state: s, fx };
    }

    case 'forgeTech': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits >= 6 || s.charge <= 0) {
        return { ok: false, state: prevState, reason: '技法火种已用完，或已敲满6锤。' };
      }
      if (action.kind === 'fissure' && w.fissureMarked) {
        return { ok: false, state: prevState, reason: '这柄剑已经刻入崩纹。' };
      }
      w.hits += 1;
      s.charge = 0;
      w.technique = action.kind;
      if (action.kind === 'steady') {
        w.strength += 1;
        const healed = w.cracked && !w.fissureMarked;
        if (healed) w.cracked = false;
        fx = {
          sound: 'hammer_perfect',
          visual: 'techSteady',
          toast: `✨【定线固刃】强度升至 ${w.strength}${healed ? '，并抚平了意外裂痕！' : '，稳固不磨损！'}`,
          unlockedCompendium: [],
        };
        pushLog(s, `施展手艺【定线固刃】：强度 → ${w.strength}${healed ? '（抚平首裂）' : ''}。`);
      } else {
        const gain = w.cracked ? 2 : 3;
        w.strength += gain;
        w.cracked = true;
        w.fissureMarked = true;
        fx = {
          sound: 'stagger',
          visual: 'techFissure',
          toast: `⚡【刻入崩纹】强度暴涨 +${gain} 至 ${w.strength}！每斩无视护甲且+2伤（每斩磨损2）`,
          unlockedCompendium: [],
        };
        pushLog(s, `施展手艺【刻入崩纹】：强度暴涨至 ${w.strength}（穿甲爆发刃）！`);
      }
      return { ok: true, state: s, fx };
    }

    case 'sealForge': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w || w.hits === 0 || w.strength <= 0) {
        return { ok: false, state: prevState, reason: '请至少落下一锤打出强度后再淬火收锻。' };
      }
      const slot = action.slot === 'reserve' ? 'reserve' : 'hand';
      const quench = action.quench || 'frost';
      const existingId = slot === 'hand' ? s.handId : s.reserveId;
      const otherEmpty = slot === 'hand' ? !s.reserveId : !s.handId;

      if (existingId && otherEmpty && !action.forceReplace) {
        if (slot === 'hand') s.reserveId = s.handId;
        else s.handId = s.reserveId;
      } else if (existingId) {
        const old = getWeapon(s, existingId);
        if (old) {
          old.status = 'discarded';
          old.owner = 'none';
        }
      }

      w.quench = quench;
      w.status = 'sealed';
      w.owner = 'player';
      w.sealedStrength = w.strength;
      w.compendiumTitle = getCompendiumTitleForBlade(w);
      w.name = formatWeaponTitle(w);

      if (slot === 'hand') s.handId = w.id;
      else s.reserveId = w.id;
      s.forgeId = null;
      s.phase = 'prepare';
      s.stats.totalForged += 1;

      const unlockedIds = evaluateBladeCompendiumIds(w);
      fx = {
        sound: 'quench',
        visual: 'sealQuench',
        toast: `🗡️ 淬火成器！【${w.name}】（强度 ${w.strength}）已收入${slot === 'hand' ? '主手' : '备用'}剑位！`,
        unlockedCompendium: unlockedIds.map((id) => ({ id, strength: w.strength, chapter: s.chapter })),
      };
      pushLog(s, `【名剑入鞘】「${w.name}」（强度 ${w.strength} · ${QUENCH_TRAITS[quench].name}）锻成！`);
      return { ok: true, state: s, fx };
    }

    case 'discardForge': {
      const w = getWeapon(s, s.forgeId);
      if (s.phase !== 'forging' || !w) return { ok: false, state: prevState, reason: '当前不在锻造中。' };
      w.status = 'discarded';
      w.owner = 'none';
      s.forgeId = null;
      s.phase = 'prepare';
      fx = { sound: 'damage', visual: null, toast: '已弃置当前在锻剑坯。', unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'swapSlots': {
      if (s.phase !== 'prepare' && s.phase !== 'encounter') {
        return { ok: false, state: prevState, reason: '当前阶段不可换剑。' };
      }
      if (!s.reserveId && !s.handId) return { ok: false, state: prevState, reason: '没有可切换的兵刃。' };
      const e = s.encounter;
      if (s.phase === 'encounter' && e) {
        const isFree = !e.swapUsedFree;
        if (!isFree && e.actions < 1) {
          return { ok: false, state: prevState, reason: '本场免费易剑已用过，再次换剑需1点行动。' };
        }
        const tmp = s.handId;
        s.handId = s.reserveId;
        s.reserveId = tmp;
        e.braced = false;
        if (isFree) {
          e.swapUsedFree = true;
          e.swapBuff = true;
          s.stats.quickSwaps += 1;
          fx = { sound: 'swap', visual: 'swapSlash', toast: '⚡【居合易剑】0行动瞬切兵刃，下一剑伤害 +1！', unlockedCompendium: [] };
          pushLog(s, `【居合易剑】0行动切换「${formatWeaponTitle(getWeapon(s, s.handId))}」，附带易剑锋芒(+1伤)！`);
        } else {
          e.actions -= 1;
          fx = { sound: 'swap', visual: 'swapSlash', toast: '已花费1行动切换主副手兵刃。', unlockedCompendium: [] };
        }
        return { ok: true, state: s, fx };
      }
      const tmp = s.handId;
      s.handId = s.reserveId;
      s.reserveId = tmp;
      fx = { sound: 'swap', visual: null, toast: `已将【${formatWeaponTitle(getWeapon(s, s.handId))}】换至主手。`, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'emergencyBlank': {
      if (s.node !== 9 || s.phase !== 'prepare' || s.blanks > 0 || s.lamp <= 1) {
        return { ok: false, state: prevState, reason: '仅在山口缺少铁坯且灯火大于1时可拆炉车护板应急。' };
      }
      s.lamp -= 1;
      s.blanks += 1;
      s.charge = 1;
      fx = {
        sound: 'hammer_good',
        visual: null,
        toast: '🔥 杜伯拆下炉车玄铁护板化作1枚应急铁坯与1次技火！快打一柄自铸剑吧！',
        unlockedCompendium: [],
      };
      pushLog(s, '【炉车应急】消耗1点灯火拆下炉车护板，获得1枚铁坯与1次技火！');
      return { ok: true, state: s, fx };
    }

    case 'depart': {
      if (s.phase !== 'prepare') return { ok: false, state: prevState, reason: '请先完成当前步骤。' };
      if (s.node === 4 && s.choice === 'camp-old-sword') {
        return { ok: false, state: prevState, reason: '请先回应杜伯关于旧剑去留的决定。' };
      }
      if (s.node === 9) {
        const hasEligible = [s.handId, s.reserveId].some((id) => isFinalEligible(getWeapon(s, id)));
        if (!hasEligible) {
          return {
            ok: false,
            state: prevState,
            reason: '母灯需要一柄你亲手打造的合格剑（完好强度≥3 或 崩纹强度≥1）！请先开炉铸剑。',
          };
        }
      }
      if (s.node === 4) {
        if (!s.completedNodes.includes(4)) s.completedNodes.push(4);
        advanceToNode(s, 5);
        fx = { sound: 'assist', visual: 'transition', toast: '离开冬炉营地，踏入暴雪双驿！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }
      if (s.node === 5) {
        s.phase = 'choice';
        s.choice = 'station-first';
        fx.sound = 'scroll';
        return { ok: true, state: s, fx };
      }
      if (s.node === 8) {
        s.phase = 'choice';
        s.choice = 'relay-carrier';
        fx.sound = 'scroll';
        return { ok: true, state: s, fx };
      }
      const mapEnc = { 1: 'n1', 2: 'n2', 3: 'n3-main', 6: 'n6', 7: 'n7', 9: 'n9' };
      const encId = mapEnc[s.node];
      s.encounter = createEncounterFor(s, encId);
      s.phase = 'encounter';
      fx = { sound: 'guard', visual: 'enterEncounter', toast: `⚔️ 进入交锋：${NODES_DATA[s.node].title}`, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'choose': {
      const cid = action.choice;
      if (s.choice === 'camp-old-sword') {
        if (cid === 'keep-old') {
          s.flags.oldDecision = 'kept';
          s.choice = null;
          pushLog(s, '【冬炉决定】留住杜伯旧剑，杜伯协战升阶！');
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
          pushLog(s, '【冬炉决定】拆解旧剑将随行奇器升至二阶，杜伯协战升阶！');
        } else if (cid === 'pay-upgrade') {
          if (s.coins < 4) return { ok: false, state: prevState, reason: '铜钱不足4枚，可选择保留旧剑或拆剑升阶。' };
          s.coins -= 4;
          if (s.tool) s.tool.level = 2;
          s.upgradeUsed = true;
          s.flags.oldDecision = 'paid';
          s.choice = null;
          pushLog(s, '【冬炉决定】付4钱将奇器升至二阶并保住杜伯旧剑！');
        }
        fx = { sound: 'assist', visual: null, toast: '已完成冬炉整备抉择！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (s.phase !== 'choice') return { ok: false, state: prevState, reason: '当前没有待选抉择。' };

      switch (cid) {
        case 'escort':
          s.flags.escortFirst = true;
          if (!s.completedNodes.includes(1)) s.completedNodes.push(1);
          pushLog(s, '【因果结下】护送同行人：阿岚协战升阶，且第3站渡口首轮压力-1！');
          advanceToNode(s, 2);
          break;
        case 'salvage':
          if (s.lamp < 2) return { ok: false, state: prevState, reason: '灯火至少需保留1点才可回身搜寻。' };
          s.flags.escortFirst = false;
          s.lamp -= 1;
          s.coins += 3;
          if (!s.completedNodes.includes(1)) s.completedNodes.push(1);
          pushLog(s, '【因果结下】付1灯火搜回沉铁，获得 +3 铜钱！');
          advanceToNode(s, 2);
          break;
        case 'rescue-ferryman':
          s.flags.ferrymanSaved = true;
          s.choice = 'bridge-tool';
          pushLog(s, '【因果结下】救起摆渡人：双驿免赶路灯火且可免费牵索破门1次（真结局仁心契机 1/3）！');
          break;
        case 'save-cargo':
          s.flags.ferrymanSaved = false;
          s.coins += 5;
          s.choice = 'bridge-tool';
          pushLog(s, '【因果结下】捞起沉船商货：获得 +5 铜钱！');
          break;
        case 'take-rebound':
        case 'take-furnace': {
          const kind = cid === 'take-rebound' ? 'rebound' : 'furnace';
          s.tool = { kind, level: 1, stored: 0 };
          if (!s.completedNodes.includes(2)) s.completedNodes.push(2);
          pushLog(s, `【随行奇器】挂载「${kind === 'rebound' ? '回锋齿' : '崩炉钉'}」！`);
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
          pushLog(s, '【横剑断后】迎战精英「狂暴撞桩重卫」！');
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
          pushLog(
            s,
            cid === 'leave-ring'
              ? '【恒温环留炉】避难炉暖火长明，双驿后援全激活（若双驿与摆渡人皆救，真结局仁心圆满）！'
              : '【恒温环随车】终章山口每轮暴雪压力直减2！'
          );
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
      fx = { sound: 'assist', visual: 'choiceMade', toast: '抉择已定，因果留痕。', unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'strike': {
      const e = s.encounter;
      const hand = getWeapon(s, s.handId);
      if (s.phase !== 'encounter' || !e || e.actions < 1) {
        return { ok: false, state: prevState, reason: '本轮行动点已用完，请触发0行动协战/追斩或结束本轮。' };
      }
      if (!isWeaponUsable(hand)) {
        return { ok: false, state: prevState, reason: '主手没有可用兵刃！请按 [Q 易剑] 切换备用剑或架剑防守。' };
      }
      const target = e.targets.find((t) => t.id === action.targetId);
      if (!target || target.health <= 0) {
        return { ok: false, state: prevState, reason: '该目标已被破除。' };
      }
      if (target.requiresDestroyed) {
        const dep = e.targets.find((t) => t.id === target.requiresDestroyed);
        if (dep && dep.health > 0) {
          return { ok: false, state: prevState, reason: `须先斩断「${dep.name}」，才能攻击「${target.name}」！` };
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
      target.struckOnce = true;
      hand.strength = preview.strengthAfter;

      const toastParts = [`斩中「${target.name}」造成 ${preview.damage} 伤害`];
      let sound = 'slash';
      let visual = 'slashHit';

      if (preview.willStagger && target.health > 0) {
        target.staggered = true;
        s.stats.staggerBreaks += 1;
        sound = 'stagger';
        visual = 'staggerBreak';
        toastParts.push('⚡【破势断招】本轮蓄力清零！');
      }

      if (target.health === 0) {
        s.stats.enemiesDefeated += 1;
        toastParts.push('💥 目标击破！');
        if (hand.quench === 'hearth' && !e.hearthUsed) {
          e.hearthUsed = true;
          e.block += 2;
          if (s.hearthTriggeredChapter < s.chapter && s.lamp < s.lampMax) {
            s.hearthTriggeredChapter = s.chapter;
            s.lamp += 1;
            toastParts.push('✨【归元铭】护势+2且温养灯火+1！');
          } else {
            toastParts.push('✨【归元铭】护势+2！');
          }
        }
        if (s.tool) {
          if (s.tool.kind === 'rebound' && !e.reboundClaimed) {
            const rawOverkill = Math.max(0, preview.damage - beforeHp) + (hand.archetype === 'dao' ? 1 : 0);
            if (rawOverkill > 0) {
              s.tool.stored = s.tool.level === 2 ? Math.max(s.tool.stored, rawOverkill) : rawOverkill;
              e.reboundClaimed = true;
              toastParts.push(`🪃 回锋齿蓄入 ${s.tool.stored} 点免费追斩余力！`);
            }
          } else if (s.tool.kind === 'furnace' && !e.furnaceTriggered && target.armor > 0) {
            s.charge = 1;
            e.furnaceTriggered = true;
            toastParts.push('🔥 崩炉钉吸纳甲片火星，技火已充能至1！');
          }
        }
      }

      if (hand.strength === 0) {
        hand.status = 'broken';
        hand.owner = 'none';
        s.handId = null;
        sound = 'crack';
        toastParts.push('⚠ 崩纹燃尽，手中兵刃碎裂！');
      }

      pushLog(s, toastParts.join(' · '));
      checkEncounterResolution(s, false);
      fx = { sound, visual, targetId: target.id, damage: preview.damage, toast: toastParts.join(' '), unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'followUp': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e || !s.tool || s.tool.kind !== 'rebound' || s.tool.stored <= 0 || e.followUpUsed) {
        return { ok: false, state: prevState, reason: '当前没有可用的回锋齿追斩余力。' };
      }
      const target = e.targets.find((t) => t.id === action.targetId && t.health > 0);
      if (!target) return { ok: false, state: prevState, reason: '请选择存活的有效目标追斩。' };
      if (target.requiresDestroyed && e.targets.some((t) => t.id === target.requiresDestroyed && t.health > 0)) {
        return { ok: false, state: prevState, reason: '需先破除前置锁具。' };
      }
      const dmg = s.tool.stored;
      s.tool.stored = 0;
      e.followUpUsed = true;
      e.braced = false;
      const threatNow = getTargetRoundPressure(target, e.round);
      const breakNeed = getStaggerThreshold(s);
      target.health = Math.max(0, target.health - dmg);
      let staggered = false;
      if (target.health > 0 && target.role === 'threat' && !target.staggered && threatNow >= 3 && dmg >= breakNeed) {
        target.staggered = true;
        staggered = true;
        s.stats.staggerBreaks += 1;
      }
      if (target.health === 0) s.stats.enemiesDefeated += 1;
      pushLog(s, `【回锋追斩】0行动打出 ${dmg} 点余力伤害${staggered ? '，并触发破势断招！' : '！'}`);
      checkEncounterResolution(s, false);
      fx = {
        sound: staggered ? 'stagger' : 'slash',
        visual: staggered ? 'staggerBreak' : 'slashHit',
        targetId: target.id,
        damage: dmg,
        toast: `🪃 回锋追斩命中 ${dmg} 伤害${staggered ? ' · 破势断招！' : '！'}`,
        unlockedCompendium: [],
      };
      return { ok: true, state: s, fx };
    }

    case 'guard': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e || e.actions < 1 || e.guarded) {
        return { ok: false, state: prevState, reason: e?.guarded ? '本轮已经架过剑了。' : '行动点不足。' };
      }
      const hand = getWeapon(s, s.handId);
      e.actions -= 1;
      e.guarded = true;
      e.opening = true;
      let blockGain = 3;
      if (hand && isWeaponUsable(hand) && hand.archetype === 'cleaver') blockGain += 1;
      if (hand && isWeaponUsable(hand) && hand.quench === 'frost' && !e.frostUsed) {
        e.frostUsed = true;
        blockGain += 2;
        e.openingBonusDmg += 1;
      }
      e.block += blockGain;
      const wheelStopped = e.id === 'n9' && e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
      if (wheelStopped) e.braced = true;

      fx = {
        sound: 'guard',
        visual: 'guardShield',
        toast: wheelStopped
          ? `🛡【母灯架稳】护势 +${blockGain}！底座已稳，可献剑复明或开启隐藏真结局！`
          : `🛡【架剑蓄破】护势 +${blockGain}，下一斩无视护甲且伤害 +${2 + e.openingBonusDmg}！`,
        unlockedCompendium: [],
      };
      pushLog(s, fx.toast);
      return { ok: true, state: s, fx };
    }

    case 'companionAssist': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e || e.companionUsed) {
        return { ok: false, state: prevState, reason: '每场交锋同行伙伴只能协战一次。' };
      }
      const cid = action.companionId || 'alan';
      const upgraded = isCompanionUpgraded(s, cid);
      e.companionUsed = true;
      s.stats.companionAssists += 1;

      let msg = '';
      if (cid === 'alan') {
        const gain = upgraded ? 3 : 2;
        e.block += gain;
        if (upgraded) e.alanSnowShield += 1;
        msg = `🛡 阿岚【巡夜铁壁】：0行动支援 +${gain} 护势${upgraded ? '，并挡下1点风雪寒压！' : '！'}`;
      } else if (cid === 'he') {
        e.opening = true;
        e.openingBonusDmg += upgraded ? 2 : 1;
        msg = `🏮 阿禾【引灯照隙】：0行动照破甲缝，下一斩无视护甲且伤害额外 +${2 + e.openingBonusDmg}！`;
      } else {
        e.duTempPower += 2;
        const hand = getWeapon(s, s.handId);
        let repaired = false;
        if (upgraded && hand && isWeaponUsable(hand) && hand.sealedStrength && hand.strength < hand.sealedStrength) {
          hand.strength += 1;
          repaired = true;
        }
        msg = `🔥 杜伯【鼓风炽刃】：0行动鼓风，本轮手中剑斩击伤害 +2${repaired ? '，并修复1点磨损强度！' : '！'}`;
      }
      pushLog(s, msg);
      fx = { sound: 'assist', visual: 'companionAssist', toast: msg, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'temper': {
      const hand = getWeapon(s, s.handId);
      if (!s.tool || s.tool.kind !== 'furnace' || !hand || !isWeaponUsable(hand) || s.charge <= 0) {
        return { ok: false, state: prevState, reason: '需要充能的崩炉钉与已磨损的主手兵刃。' };
      }
      const clearsCrack = s.tool.level === 2 && hand.cracked && !hand.fissureMarked;
      if (hand.strength >= (hand.sealedStrength || hand.strength) && !clearsCrack) {
        return { ok: false, state: prevState, reason: '当前主手兵刃完好无损，无需续炉。' };
      }
      if (s.phase === 'encounter') {
        if (!s.encounter || s.encounter.actions < 1) return { ok: false, state: prevState, reason: '战地续炉需消耗1点行动。' };
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
        visual: 'temperGlow',
        toast: `🔥【崩炉钉续炉】「${hand.name}」强度 ${before} → ${hand.strength}${clearsCrack ? '（裂纹愈合）' : ''}！`,
        unlockedCompendium: [],
      };
      pushLog(s, fx.toast);
      return { ok: true, state: s, fx };
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
        if (e.actions < 1) return { ok: false, state: prevState, reason: '切索需要1点行动。' };
        if (!hand || !isWeaponUsable(hand) || hand.cracked || hand.strength < req) {
          return { ok: false, state: prevState, reason: `切索需要主手完好无裂兵刃，且强度至少 ${req}！` };
        }
        e.actions -= 1;
        e.routeOpened = true;
        pushLog(s, `【利刃切索】「${hand.name}」一剑斩断拦索，零磨损直接开路！`);
        checkEncounterResolution(s, false);
        fx = { sound: 'slash', visual: 'slashHit', toast: '⚔️ 利刃切索！兵刃零磨损直接打通道路！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (kind === 'ferryAssist') {
        if (!s.flags.ferrymanSaved || s.flags.ferryAssistUsed) {
          return { ok: false, state: prevState, reason: '摆渡人牵索仅可使用一次。' };
        }
        s.flags.ferryAssistUsed = true;
        e.routeOpened = true;
        pushLog(s, '【摆渡人报恩】0行动熟稔牵索，直接拉开冰封驿门！');
        checkEncounterResolution(s, false);
        fx = { sound: 'assist', visual: 'companionAssist', toast: '🚣 摆渡人牵索破门！0行动直接救出驿站人员！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (kind === 'useSideRoute') {
        const canSide = s.flags.crossingHeld || (s.flags.southSaved && s.flags.ring === 'left');
        if (!canSide || e.actions < 1) return { ok: false, state: prevState, reason: '缺少侧路接应或行动点不足。' };
        e.actions -= 1;
        e.routeOpened = true;
        pushLog(s, '【因果兑现】昔日救下的接应人从山侧放下引索，免战直通母灯台！');
        checkEncounterResolution(s, false);
        fx = { sound: 'assist', visual: 'companionAssist', toast: '🏮 昔日因果兑现！侧路接应直接开启山口！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (kind === 'donateShelter') {
        const targetWeapon = getWeapon(s, action.weaponId);
        if (!targetWeapon || !isWeaponUsable(targetWeapon) || targetWeapon.strength < 3 || e.actions < 1) {
          return { ok: false, state: prevState, reason: '需消耗1行动，且献出的剑未断、强度至少3。' };
        }
        e.actions -= 1;
        targetWeapon.status = 'donated';
        targetWeapon.owner = 'shelter';
        if (s.handId === targetWeapon.id) s.handId = null;
        if (s.reserveId === targetWeapon.id) s.reserveId = null;
        s.flags.shelterSword = targetWeapon.id;
        pushLog(s, `【献剑撑梁】将「${targetWeapon.name}」死死楔入避难炉危梁，保住了满屋性命！`);
        checkEncounterResolution(s, false);
        fx = {
          sound: 'stagger',
          visual: 'guardShield',
          toast: `🗡️ 「${targetWeapon.name}」化作避难炉顶梁柱，危屋稳住了！`,
          unlockedCompendium: [],
        };
        return { ok: true, state: s, fx };
      }

      if (kind === 'donateAlan') {
        if (!reserve || !isWeaponUsable(reserve) || reserve.strength < 3 || e.actions < 1 || e.alanGuard) {
          return { ok: false, state: prevState, reason: '需备用剑强度≥3且有1点行动。' };
        }
        e.actions -= 1;
        reserve.status = 'donated';
        reserve.owner = 'alan';
        s.reserveId = null;
        s.flags.donatedToAlan = reserve.id;
        e.alanGuard = true;
        pushLog(s, `【交剑断后】阿岚接过「${reserve.name}」镇守侧翼，本场每轮落石压力 -2！`);
        fx = { sound: 'guard', visual: 'guardShield', toast: `🛡 阿岚持「${reserve.name}」断后，每轮总压力 -2！`, unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (kind === 'placeCore') {
        if (e.id !== 'n9' || s.flags.coreOwner === 'socket' || e.actions < 1) {
          return { ok: false, state: prevState, reason: '灯芯已在灯座或行动不足。' };
        }
        e.actions -= 1;
        e.braced = false;
        s.flags.coreOwner = 'socket';
        pushLog(s, '【安放灯芯】唯一灯芯已稳稳放入母灯灯座！下一步：停轮后架稳底座！');
        fx = { sound: 'assist', visual: 'temperGlow', toast: '🏮 唯一灯芯已入座！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (kind === 'assistBrace') {
        const wheelDead = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
        if (e.id !== 'n9' || s.flags.carrier !== 'player' || !wheelDead || e.braceAssistUsed) {
          return { ok: false, state: prevState, reason: '需亲自携芯且停下逆转巨轮后，阿禾才可免费扶稳底座。' };
        }
        e.braceAssistUsed = true;
        e.braced = true;
        pushLog(s, '【阿禾扶稳】阿禾扑上前死死扶住母灯底座（0行动已架稳）！快嵌剑复明！');
        fx = { sound: 'guard', visual: 'guardShield', toast: '🤝 阿禾0行动扶稳母灯！立即点击【献剑复明】！', unlockedCompendium: [] };
        return { ok: true, state: s, fx };
      }

      if (kind === 'ignite' || kind === 'celestialIgnite') {
        const driveDead = e.targets.some((t) => t.id === 'drive-lock' && t.health === 0);
        const wheelDead = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
        if (!driveDead || !wheelDead) return { ok: false, state: prevState, reason: '请先斩断传动锁并停下逆转巨轮！' };
        if (s.flags.coreOwner !== 'socket') return { ok: false, state: prevState, reason: '请先将唯一灯芯放入母灯灯座！' };
        if (!e.braced) return { ok: false, state: prevState, reason: '请先使用「架稳母灯」或「阿禾扶稳」固定底座！' };
        if (!isFinalEligible(hand)) {
          return { ok: false, state: prevState, reason: '主手必须是你亲手打造的合格剑（完好≥3 或 崩纹≥1）！若在备用位请先换手再架稳。' };
        }
        if (e.actions < 1) return { ok: false, state: prevState, reason: '嵌剑需要1点行动（结束回合不会解除架稳，可下轮嵌剑）！' };

        const secretStatus = getSecretEndingStatus(s);
        const isCelestial = kind === 'celestialIgnite' || secretStatus.canIgniteCelestial;
        if (kind === 'celestialIgnite' && !secretStatus.canIgniteCelestial) {
          return { ok: false, state: prevState, reason: '尚未同时满足隐藏真结局三项契机（全员仁心获救+主剑强度≥6+灯火≥5）。' };
        }

        e.actions -= 1;
        hand.status = 'donated';
        hand.owner = 'lamp';
        s.handId = null;
        if (!s.completedNodes.includes(9)) s.completedNodes.push(9);
        s.phase = 'ending';
        const endingKind = isCelestial ? 'celestial_relit' : 'relit';
        s.ending = buildEndingVerdict(s, endingKind, hand);

        const unlockedCompendium = isCelestial
          ? [{ id: 'special_celestial', strength: hand.strength, chapter: 3 }]
          : [];

        fx = {
          sound: 'relit',
          visual: isCelestial ? 'celestialFinale' : 'relitFinale',
          toast: isCelestial
            ? '🌟 隐藏真结局达成：【万家薪火 · 剑魄归宗】！十二路灯与山下万家烽火同燃！'
            : '🌕 剑入母灯，十二山路长灯尽数复明！！',
          unlockedCompendium,
        };
        pushLog(s, fx.toast);
        return { ok: true, state: s, fx };
      }

      return { ok: false, state: prevState, reason: '未知机关指令。' };
    }

    case 'endRound': {
      const e = s.encounter;
      if (s.phase !== 'encounter' || !e) return { ok: false, state: prevState, reason: '当前不在交锋回合中。' };
      const p = computePressureSummary(s);
      const beforeLamp = s.lamp;
      s.lamp = Math.max(0, s.lamp - p.loss);
      if (p.loss === 0) s.stats.flawlessRounds += 1;

      pushLog(
        s,
        `【第${e.round}轮结算】总压 ${p.totalPressure} - 援护 ${p.reduction} - 护势 ${p.block} = ${
          p.loss > 0 ? `灯火 -${p.loss}（余 ${s.lamp}）` : '灯火无损 ✓'
        }`
      );

      const res = checkEncounterResolution(s, true);
      if (!res && s.encounter) {
        s.encounter.round += 1;
        s.encounter.actions = 2;
        s.encounter.block = 0;
        s.encounter.guarded = false;
        s.encounter.duTempPower = 0;
        s.encounter.alanSnowShield = 0;
        for (const t of s.encounter.targets) {
          t.staggered = false;
        }
      }
      fx = {
        sound: p.loss > 0 ? 'damage' : 'guard',
        visual: p.loss > 0 ? 'lampHit' : 'guardShield',
        toast: p.loss > 0 ? `❄ 风雪侵袭，灯火 ${beforeLamp} → ${s.lamp}` : '✨ 护势稳固，本轮灯火毫发无损！',
        unlockedCompendium: [],
      };
      return { ok: true, state: s, fx };
    }

    case 'shop': {
      if (s.phase !== 'prepare' || ![1, 4, 7].includes(s.node)) {
        return { ok: false, state: prevState, reason: '仅在第1、4、7站营地整备时可与杜伯交易。' };
      }
      const item = action.item;
      const price = item === 'upgrade' ? 4 : 2;
      if (s.coins < price) return { ok: false, state: prevState, reason: `铜钱不足（需要 ${price} 钱，当前 ${s.coins} 钱）。` };

      if (item === 'coal') {
        if (s.lamp >= s.lampMax) return { ok: false, state: prevState, reason: '琉璃灯火已满，无需添煤。' };
        s.coins -= 2;
        const gain = s.perk === 'eternal_wick' ? 4 : 3;
        const before = s.lamp;
        s.lamp = Math.min(s.lampMax, s.lamp + gain);
        fx = { sound: 'bellows', visual: 'temperGlow', toast: `🔥 添煤暖炉：灯火 ${before} → ${s.lamp}`, unlockedCompendium: [] };
      } else if (item === 'blank') {
        if (s.blanks >= 4) return { ok: false, state: prevState, reason: '随车铁坯已达上限。' };
        s.coins -= 2;
        s.blanks += 1;
        fx = { sound: 'hammer_good', visual: null, toast: `🧱 购入新铁坯（当前可用 ${s.blanks} 枚）`, unlockedCompendium: [] };
      } else if (item === 'upgrade') {
        if (!s.tool || s.tool.level === 2 || s.upgradeUsed) {
          return { ok: false, state: prevState, reason: '尚无奇器或本趟唯一升阶已使用。' };
        }
        s.coins -= 4;
        s.tool.level = 2;
        s.upgradeUsed = true;
        fx = { sound: 'hammer_perfect', visual: 'temperGlow', toast: '⚡ 奇器已升至二阶！同时解锁杜伯协战升阶！', unlockedCompendium: [] };
      } else if (item === 'exchange') {
        if (!s.tool) return { ok: false, state: prevState, reason: '尚未持有奇器。' };
        s.coins -= 2;
        const nextKind = s.tool.kind === 'rebound' ? 'furnace' : 'rebound';
        s.tool = { kind: nextKind, level: s.tool.level, stored: 0 };
        fx = { sound: 'swap', visual: null, toast: `已切换随行奇器为【${nextKind === 'rebound' ? '回锋齿' : '崩炉钉'}】`, unlockedCompendium: [] };
      }
      pushLog(s, fx.toast || '完成炉边交易。');
      return { ok: true, state: s, fx };
    }

    case 'retryChapter': {
      if (s.retries[s.chapter] >= 1) {
        return { ok: false, state: prevState, reason: '本章重整机会已使用过。' };
      }
      const ch = s.chapter;
      const savedCheckpoint = JSON.parse(JSON.stringify(prevState.checkpoint));
      Object.assign(s, savedCheckpoint);
      s.retries[ch] = 1;
      s.checkpoint = savedCheckpoint;
      pushLog(s, `【章初重整】回到第${ch}章起点补给态（本章重整机会已用）。`);
      fx = { sound: 'assist', visual: 'transition', toast: `已回到第${ch}章起点重新整备！`, unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'evacuate': {
      if (s.lamp <= 0) return { ok: false, state: prevState, reason: '灯火耗尽时无法主动撤离，请重整本章或接受炉火暂熄。' };
      s.phase = 'ending';
      s.ending = buildEndingVerdict(s, 'homeward', null);
      fx = { sound: 'assist', visual: 'transition', toast: '带着余火与同行人踏上归途。', unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    case 'acceptFailure': {
      s.phase = 'ending';
      s.ending = buildEndingVerdict(s, 'embers', null);
      fx = { sound: 'damage', visual: 'transition', toast: '炉火暂熄，此行印记已载入卷轴。', unlockedCompendium: [] };
      return { ok: true, state: s, fx };
    }

    default:
      return { ok: false, state: prevState, reason: '未知操作。' };
  }
}

export function buildEndingVerdict(state, kind, dedicatedBlade) {
  const masterBonus = state.difficulty === 'master' ? 8 : 0;
  const maxStrength = state.weapons.reduce((m, w) => Math.max(m, w.sealedStrength || w.strength || 0), 3);
  const craftScore = Math.min(100, Math.round(maxStrength * 11 + state.stats.perfectStrikes * 6 + state.stats.totalForged * 8 + masterBonus));
  const isLit = kind === 'relit' || kind === 'celestial_relit';
  const flameScore =
    kind === 'embers'
      ? Math.min(60, state.completedNodes.length * 7)
      : Math.min(100, Math.round((state.lamp / state.lampMax) * 65 + state.stats.flawlessRounds * 7 + (isLit ? 20 : 0)));

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
    Math.round(
      35 +
        state.stats.staggerBreaks * 13 +
        state.stats.quickSwaps * 8 +
        state.stats.companionAssists * 7 +
        (state.flags.crossingHeld ? 12 : 0) +
        masterBonus
    )
  );

  const causalEchoes = [];
  if (state.flags.escortFirst) causalEchoes.push('河谷暗夜先护同行人，阿岚铁壁守住了渡口风浪。');
  if (state.flags.ferrymanSaved) causalEchoes.push('断桥拉起摆渡人，风雪双驿得其引路牵索。');
  if (state.flags.crossingHeld) causalEchoes.push('渡口横剑死守撞桩重卫，提前打通了山口接应。');
  if (state.flags.northSaved) causalEchoes.push('北驿巡守获救脱困，沿途风雪有人守望。');
  if (state.flags.southSaved) causalEchoes.push('南驿信使重获自由，山路烽火得以相传。');
  if (state.flags.shelterSword) {
    const sw = getWeapon(state, state.flags.shelterSword);
    causalEchoes.push(`避难炉危梁之下，「${formatWeaponTitle(sw)}」替一屋妇孺撑起了生路。`);
  }
  if (state.flags.ring === 'left') causalEchoes.push('恒温环留在避难炉中，雪谷孤屋彻夜温暖。');
  else if (state.flags.ring === 'taken') causalEchoes.push('恒温环随炉车登顶，替母灯挡下了绝顶狂飙。');
  if (dedicatedBlade) {
    causalEchoes.push(
      kind === 'celestial_relit'
        ? `神兵「${dedicatedBlade.name}」（强度 ${dedicatedBlade.strength}）引动山下万家烽火共鸣，化作不灭「剑魄灯枢」，并凝出传世【万家薪火剑】！`
        : `亲手锻打的「${dedicatedBlade.name}」（强度 ${dedicatedBlade.strength}）嵌入母灯，化作十二山路长明灯骨！`
    );
  }

  const causalityScore = Math.min(100, Math.round((state.completedNodes.length / 9) * 55 + causalEchoes.length * 7 + (isLit ? 16 : 0)));
  const avg = Math.round((craftScore + flameScore + benevolenceScore + tacticsScore + causalityScore) / 5);

  const grade =
    kind === 'celestial_relit'
      ? 'EX · 万家薪火剑仙（隐藏真结局）'
      : kind === 'relit' && avg >= 86
      ? 'SSS · 薪火剑圣'
      : kind === 'relit' && avg >= 74
      ? 'S · 护炉宗师'
      : avg >= 62
      ? 'A · 雪线铸师'
      : avg >= 48
      ? 'B · 远行铁匠'
      : 'C · 守火行者';

  const titles = {
    celestial_relit: '万家薪火 · 剑魄归宗（隐藏真结局）',
    relit: '灯路复明 · 十二山火重燃',
    homeward: '保人归途 · 留得青山薪火',
    embers: '炉火暂熄 · 铁骨犹记来路',
  };

  const summaries = {
    celestial_relit: `当「${dedicatedBlade ? dedicatedBlade.name : '天工神兵'}」嵌入母灯的一瞬，山下古渡口的摆渡人、南北双驿的巡守信使与避难炉的百姓同时举起火把！万家愿力顺着十二盏长明路灯逆流登顶，母灯绽开金青双色天光——你的剑魂永镇山巅，而杜伯用余烬为你重铸了一柄【万家薪火剑】随身归乡！`,
    relit: `随着「${dedicatedBlade ? dedicatedBlade.name : '自铸名剑'}」铿然嵌入母灯底座，停滞的巨轮化作金光灯枢，自绝顶向河谷依次点亮十二盏山路长灯。你锻的剑留在了山口，而你护送的人都走到了光里。`,
    homeward: `队伍在「${NODES_DATA[state.node].title}」收拢余火（剩余 ${state.lamp} 点灯火），护着唯一灯芯与已救下的同行人平安折返山下。母灯虽待来日重燃，但每一条鲜活的性命都已带回。`,
    embers: `狂风吹暗炉火，远行暂止于「${NODES_DATA[state.node].title}」。但沿途打出的每一记极温好锤、救出的每一位驿卒信使，皆已镌刻成碑。`,
  };

  const smiled = isLit;
  const epilogues = [
    {
      name: '阿岚',
      art: smiled ? 'head_alan_smile' : 'head_alan',
      line:
        kind === 'celestial_relit'
          ? '听见山下的欢呼了吗？渡口、双驿、避难炉……你救下的每一盏小火，今晚全都汇成银河照回山顶了！'
          : kind === 'relit'
          ? '从河谷暗夜到绝顶山口，这一路有你的剑开道，没有一个人掉进黑暗里。'
          : '先把队伍护好，只要打铁的手还在，这条山路咱们随时能再闯！',
    },
    {
      name: '阿禾',
      art: smiled ? 'head_he_smile' : 'head_he',
      line:
        kind === 'celestial_relit'
          ? '南北双驿的信使把你的名字编进护灯歌谣里啦！以后百年，走夜路的人抬头看见母灯金青双辉都会想起今夜！'
          : kind === 'relit'
          ? '快看山下！双驿、避难炉、古渡口的灯全都亮起来了，信使们以后再也不怕夜雪啦！'
          : '唯一灯芯我贴身收稳了，已经救出来的人永远记着这盏小炉车的暖光。',
    },
    {
      name: '杜伯',
      art: smiled ? 'head_du_smile' : 'head_du',
      line:
        kind === 'celestial_relit'
          ? '打了一辈子铁，头一回见万家灯火反哺剑魂！来，这柄母灯余火凝出的【万家薪火剑】，老头子替你记进名剑谱最高一页！'
          : kind === 'relit'
          ? `好小子，那把「${dedicatedBlade ? dedicatedBlade.name : '新剑'}」火候老道，比老头子当年打的剑更配镇守母灯！`
          : '莫灰心，好铁还要千锤百炼。歇口气调整火候，咱们随时再起炉！',
    },
  ];

  return {
    kind,
    isSecret: kind === 'celestial_relit',
    difficultyName: DIFFICULTY_MODES[state.difficulty]?.name || '寻常行旅',
    title: titles[kind],
    summary: summaries[kind],
    stoppedAt: NODES_DATA[state.node].title,
    grade,
    avgScore: avg,
    axes: [
      { label: '铸剑造诣', value: craftScore },
      { label: '护灯余温', value: flameScore },
      { label: '同行仁心', value: benevolenceScore },
      { label: '破势锋芒', value: tacticsScore },
      { label: '因果圆满', value: causalityScore },
    ],
    dedicatedWeapon: dedicatedBlade
      ? {
          name: dedicatedBlade.name,
          archetypeName: BLADE_ARCHETYPES[dedicatedBlade.archetype]?.name || '玄铁长剑',
          quenchName: QUENCH_TRAITS[dedicatedBlade.quench]?.name || '古法淬火',
          strength: dedicatedBlade.strength,
          sealedStrength: dedicatedBlade.sealedStrength,
          perfectHits: dedicatedBlade.perfectHits,
          chapter: dedicatedBlade.madeInChapter,
          fissure: dedicatedBlade.fissureMarked,
        }
      : null,
    epilogues,
    causalEchoes,
  };
}

export function buildPresetState(presetId) {
  if (presetId === 'preset_ch1_forge') {
    const s = createInitialState('演武-初炉', 'hundred_refinements', true, 'standard', 0);
    s.coins = 4;
    pushLog(s, '【赛事演武 · 初炉试锋】点击「开炉铸剑」体验微调后的柔和炉温游标与12柄名剑图鉴收录！');
    return s;
  }
  if (presetId === 'preset_ch1_crossing') {
    const s = createInitialState('演武-渡口', 'vanguard_edge', true, 'standard', 3);
    s.node = 3;
    s.chapter = 1;
    s.lamp = 7;
    s.coins = 5;
    s.completedNodes = [1, 2];
    s.flags.escortFirst = true;
    s.flags.ferrymanSaved = true;
    s.tool = { kind: 'rebound', level: 1, stored: 0 };
    const dao = {
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
      cracked: false,
      fissureMarked: false,
      technique: 'steady',
    };
    const jian = {
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
      cracked: false,
      fissureMarked: false,
      technique: null,
    };
    s.weapons.push(dao, jian);
    s.handId = 'w-2';
    s.reserveId = 'w-3';
    s.encounter = createEncounterFor(s, 'n3-main');
    s.phase = 'encounter';
    pushLog(s, '【赛事演武 · 渡口双敌】冲阵者正在红光蓄力！试试「破势断招」+「Q键0行动居合易剑」+「回锋追斩」！');
    return s;
  }
  if (presetId === 'preset_ch2_shelter') {
    const s = createInitialState('演武-孤炉', 'eternal_wick', true, 'standard', 3);
    s.chapter = 2;
    s.node = 6;
    s.lamp = 8;
    s.coins = 6;
    s.completedNodes = [1, 2, 3, 4, 5];
    s.flags.escortFirst = true;
    s.flags.ferrymanSaved = true;
    s.flags.northSaved = true;
    s.flags.southSaved = true;
    s.flags.oldDecision = 'paid';
    s.tool = { kind: 'furnace', level: 2, stored: 0 };
    s.upgradeUsed = true;
    const cleaver = {
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
      cracked: false,
      fissureMarked: false,
      technique: 'steady',
    };
    s.weapons.push(cleaver);
    s.handId = 'w-4';
    s.reserveId = 'du-old-sword';
    s.encounter = createEncounterFor(s, 'n6');
    s.phase = 'encounter';
    pushLog(s, '【赛事演武 · 雪线孤炉】用「杜伯旧剑」献剑撑梁并选择「留下恒温环」，即可凑齐隐藏真结局全部仁心条件！');
    return s;
  }
  if (presetId === 'preset_secret_ending') {
    // 1-turn away from triggering Hidden True Ending!
    const s = createInitialState('演武-万家薪火', 'eternal_wick', true, 'standard', 6);
    s.chapter = 3;
    s.node = 9;
    s.lamp = 8;
    s.coins = 7;
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
    s.stats = {
      totalForged: 4,
      perfectStrikes: 10,
      totalHammerHits: 14,
      staggerBreaks: 5,
      enemiesDefeated: 8,
      quickSwaps: 4,
      companionAssists: 5,
      flawlessRounds: 6,
    };
    const divineSword = {
      id: 'w-12',
      name: '天工无瑕剑',
      compendiumTitle: '天工无瑕剑',
      archetype: 'jian',
      quench: 'blaze',
      source: 'forged',
      madeInChapter: 3,
      status: 'sealed',
      owner: 'player',
      strength: 7,
      sealedStrength: 7,
      hits: 5,
      perfectHits: 4,
      stars: 0,
      cracked: false,
      fissureMarked: false,
      technique: 'steady',
    };
    s.weapons.push(divineSword);
    s.handId = 'w-12';
    s.reserveId = 'du-old-sword';
    s.encounter = createEncounterFor(s, 'n9');
    // Pre-damage lock & wheel slightly so player can finish in 1 thrilling combo!
    s.encounter.targets[0].health = 0; // Drive-lock already broken!
    s.encounter.targets[1].health = 4; // Wheel has 4 HP left!
    s.phase = 'encounter';
    pushLog(
      s,
      '【赛事演武 · 隐藏真结局冲刺】三大真结局契机已全满！先用「0行动追斩/挥斩」停下逆转巨轮，再点「架稳母灯」，即可点击【🌟 万家薪火 · 剑魄归宗】！'
    );
    return s;
  }

  // Standard Finale preset
  const s = createInitialState('演武-母灯终战', 'hundred_refinements', true, 'standard', 3);
  s.chapter = 3;
  s.node = 9;
  s.lamp = 7;
  s.coins = 6;
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
  s.stats = {
    totalForged: 3,
    perfectStrikes: 7,
    totalHammerHits: 11,
    staggerBreaks: 4,
    enemiesDefeated: 7,
    quickSwaps: 3,
    companionAssists: 4,
    flawlessRounds: 5,
  };
  const masterSword = {
    id: 'w-9',
    name: '赤霄引灯剑',
    compendiumTitle: '赤霄引灯剑',
    archetype: 'jian',
    quench: 'blaze',
    source: 'forged',
    madeInChapter: 3,
    status: 'sealed',
    owner: 'player',
    strength: 6,
    sealedStrength: 6,
    hits: 4,
    perfectHits: 3,
    stars: 0,
    cracked: false,
    fissureMarked: false,
    technique: 'steady',
  };
  s.weapons.push(masterSword);
  s.handId = 'w-9';
  s.reserveId = 'du-old-sword';
  s.encounter = createEncounterFor(s, 'n9');
  s.phase = 'encounter';
  pushLog(s, '【赛事演武 · 绝顶母灯终战】唯一灯芯已入灯座！依次斩断传动锁 → 停下逆转巨轮 → 架稳母灯 → 献剑复明！');
  return s;
}

export {
  BLADE_ARCHETYPES,
  CHAPTER_INFO,
  CHOICES_DATA,
  COMPANIONS,
  DESTINY_PERKS,
  DIFFICULTY_MODES,
  HEAT_SPEED_MODES,
  NODES_DATA,
  QUENCH_TRAITS,
  SWORD_COMPENDIUM,
};
