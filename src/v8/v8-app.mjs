import { packageUrl, packageCssUrls } from '../security/package-url.mjs';
import { sanitizeHtml } from '../security/sanitize-html.mjs';
// V12.0《锤下求生 · 护炉远行》典藏大成版 — 840px 四阶飞剑与 690px 巨锤物理演出 · 楷书宣纸视觉 · 单焦点火印引路
import { BGM_TRACKS, createV8Audio } from './v8-audio.mjs';
import {
  BLADE_ARCHETYPES,
  BLADE_ZONES,
  CHAPTER_INFO,
  CHOICES_DATA,
  COMPANIONS,
  DESTINY_PERKS,
  DIFFICULTY_MODES,
  HAMMER_ATLAS_META,
  HEAT_SPEED_MODES,
  NODES_DATA,
  QUENCH_TRAITS,
  RELICS_POOL,
  RELIC_SYNERGIES,
  SWORD_ATLAS_META,
  SWORD_COMPENDIUM,
  SWORD_STANCES,
  TRIAL_CHAPTERS,
} from './v8-data.mjs';
import {
  V8_COMPENDIUM_KEY,
  V8_STORAGE_KEY,
  buildPresetState,
  canCastDualUlt,
  computeGuidedStep,
  computePressureSummary,
  computeStrikePreview,
  createInitialState,
  dispatchAction,
  formatWeaponTitle,
  getActiveSynergies,
  getBriefingForecast,
  getCutRequirement,
  getDualUltCost,
  getSecretEndingStatus,
  getTargetRoundPressure,
  getWeapon,
  getWeaponSwordArt,
  hasRelic,
  isCompanionUpgraded,
  isFinalEligible,
  isWeaponUsable,
} from './v8-engine.mjs';

function safeGetStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key, val) {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function loadCompendiumMap() {
  try {
    const raw = safeGetStorage(V8_COMPENDIUM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCompendiumMap(map) {
  safeSetStorage(V8_COMPENDIUM_KEY, JSON.stringify(map));
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function ease(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function stageOfWeapon(w) {
  if (!w) return 0;
  if (w.status !== 'forging' && w.sealedStrength !== null) return 3;
  return w.hits === 0 ? 0 : w.hits === 1 ? 1 : w.hits <= 3 ? 2 : 3;
}

export function mountV8App(rootEl, artMap = {}, options = {}) {
  const audio = createV8Audio();
  let compendiumMap = loadCompendiumMap();
  const countCompendium = () => Object.keys(compendiumMap).length;

  let savedRunExists = false;
  let state = (() => {
    try {
      const raw = safeGetStorage(V8_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 'v12-classic-masterpiece' && parsed.node && parsed.weapons) {
          savedRunExists = true;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return createInitialState('护炉-2026', 'hundred_refinements', false, 'standard', countCompendium());
  })();

  // Title selection state
  let titleDiff = state.difficulty || 'standard';
  let titlePerk = state.perk || 'hundred_refinements';

  // Interactive Forge & Combat State
  let activeForgePart = 'tip';
  let aimXRatio = 0.62;
  let heatSpeedMode = 'normal';
  let heatPhase = 0.25;
  let heatPos = 50;
  let autoParry = false;
  let toastTimer = null;

  // Active Parry QTE State
  const parryState = {
    active: false,
    startedAt: 0,
    duration: 920,
    progress: 0,
    hasMirror: false,
  };

  // Preload Sword Atlas & Sprites
  const swordAtlasImg = new Image();
  let swordAtlasReady = false;
  if (artMap.sword_stages_atlas) {
    swordAtlasImg.onload = () => {
      swordAtlasReady = true;
    };
    swordAtlasImg.src = packageUrl(artMap.sword_stages_atlas);
  }
  const stampCanvas = document.createElement('canvas');

  const artUrl = (k) => artMap[k] || '';

  // Playback Motion & Particle State (faithful to presentation-v7 scene7 + enhanced ribbons)
  let activeAnim = null; // { mode, start, duration, contactAt, weapon, prevWeapon, targetPt, forgeX, recipient, relighting, cutRope, staggered }
  let hitstopUntil = 0;
  const particles = [];
  const steamPuffs = [];

  // Build Root Shell (preserving core IDs)
  rootEl.innerHTML = sanitizeHtml(`
    <div id="v8-root">
      <div id="v8-backdrop"></div>

      <header id="v8-topbar">
        <div class="c12-promise">
          <div id="v8-ch-badge">第一章 · 夜渡河谷</div>
          <strong id="v8-station-title">巡夜引火</strong>
          <div id="c12-mission-text" class="c12-mission-line"></div>
          <button id="v8-stepper" title="点击展开九站灯路与真结局契机长卷"></button>
        </div>

        <div class="c12-top-right">
          <div class="c12-vitals-bar">
            <span id="v8-lamp-pill"></span>
            <span id="v8-res-pill"></span>
          </div>
          <div class="c12-menu-strip">
            <button id="v8-comp-btn" class="c12-quiet-btn">试锋选关</button>
            <button id="v9-book-btn" class="c12-quiet-btn">百炼剑谱 <span id="v9-book-count">0/12</span></button>
            <button id="v9-relic-btn" class="c12-quiet-btn">护炉遗珍 <span id="v9-relic-count">0</span></button>
            <button id="v8-compass-btn" class="c12-quiet-btn">九站灯路</button>
            <button id="v9-audio-btn" class="c12-quiet-btn">音律</button>
            <button id="v8-mute-btn" class="c12-quiet-btn">有声</button>
            ${options.showClassicLink ? `<a href="./campaign.html" class="c12-quiet-btn" style="text-decoration:none;">原版卷</a>` : ''}
          </div>
        </div>
      </header>

      <main id="v8-stage">
        <canvas id="v8-canvas"></canvas>
        <div id="v8-stage-body"></div>
        <div id="c12-floats"></div>
      </main>

      <footer id="v8-deck">
        <aside id="v8-col-rack"></aside>
        <nav id="v8-col-assist"></nav>
        <nav id="v8-col-cmd"></nav>
      </footer>

      <div id="v8-toast"></div>

      <div id="v8-modal-wrap" role="dialog" aria-modal="true">
        <div class="v8-modal-card">
          <div class="v8-modal-header">
            <div id="v8-modal-title">卷轴</div>
            <button id="v8-modal-close">返回 (Esc)</button>
          </div>
          <div id="v8-modal-body"></div>
        </div>
      </div>
    </div>
  `);

  const elTopbar = rootEl.querySelector('#v8-topbar');
  const elChBadge = rootEl.querySelector('#v8-ch-badge');
  const elStationTitle = rootEl.querySelector('#v8-station-title');
  const elMissionText = rootEl.querySelector('#c12-mission-text');
  const elStepper = rootEl.querySelector('#v8-stepper');
  const elLampPill = rootEl.querySelector('#v8-lamp-pill');
  const elResPill = rootEl.querySelector('#v8-res-pill');
  const elBookCount = rootEl.querySelector('#v9-book-count');
  const elRelicCount = rootEl.querySelector('#v9-relic-count');
  const elMuteBtn = rootEl.querySelector('#v8-mute-btn');
  const elBackdrop = rootEl.querySelector('#v8-backdrop');
  const elStage = rootEl.querySelector('#v8-stage');
  const elCanvas = rootEl.querySelector('#v8-canvas');
  const elStageBody = rootEl.querySelector('#v8-stage-body');
  const elFloats = rootEl.querySelector('#c12-floats');
  const elDeck = rootEl.querySelector('#v8-deck');
  const elRack = rootEl.querySelector('#v8-col-rack');
  const elAssist = rootEl.querySelector('#v8-col-assist');
  const elCmd = rootEl.querySelector('#v8-col-cmd');
  const elToast = rootEl.querySelector('#v8-toast');
  const elModalWrap = rootEl.querySelector('#v8-modal-wrap');
  const elModalTitle = rootEl.querySelector('#v8-modal-title');
  const elModalBody = rootEl.querySelector('#v8-modal-body');

  const ctx = elCanvas.getContext('2d');
  let stageW = 1280;
  let stageH = 720;
  let dpr = 1;

  function resizeCanvas() {
    const r = elStage.getBoundingClientRect();
    stageW = Math.max(320, r.width || 1280);
    stageH = Math.max(280, r.height || 720);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    elCanvas.width = Math.round(stageW * dpr);
    elCanvas.height = Math.round(stageH * dpr);
    positionHammerDom();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  rootEl.addEventListener(
    'pointerdown',
    () => {
      audio.unlock();
      syncAudioMood();
    },
    { passive: true }
  );

  function syncAudioMood() {
    if (state.phase === 'ending') audio.setMood('ending');
    else if (state.phase === 'forging') audio.setMood('forge');
    else if (state.chapter === 3) audio.setMood('ch3');
    else if (state.chapter === 2) audio.setMood('ch2');
    else audio.setMood('ch1');
  }

  function showNotice(title, copy) {
    if (!title && !copy) return;
    elToast.innerHTML = sanitizeHtml(`${title ? `<strong>${title}</strong>` : ''}<span>${copy || ''}</span>`);
    elToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove('show'), 4200);
  }

  function spawnFloatLabel(x, y, mainText, subText = '', color = '#fff0b9') {
    const div = document.createElement('div');
    div.className = 'c12-float-label';
    div.style.left = `${Math.max(80, Math.min(stageW - 80, x))}px`;
    div.style.top = `${Math.max(90, Math.min(stageH - 110, y))}px`;
    div.style.color = color;
    div.innerHTML = sanitizeHtml(`<strong>${mainText}</strong>${subText ? `<small style="display:block;font-size:12.5px;opacity:0.9;">${subText}</small>` : ''}`);
    elFloats.appendChild(div);
    setTimeout(() => div.remove(), 820);
  }

  function spawnSparks(x, y, count = 22, kind = 'hammer') {
    for (let i = 0; i < count && particles.length < 150; i++) {
      const ang = -Math.PI + (i / Math.max(1, count - 1)) * Math.PI + (Math.random() - 0.5) * 0.35;
      const spd = (kind === 'heavy' ? 85 : 55) + Math.random() * (kind === 'heavy' ? 180 : 120);
      const col =
        kind === 'frost'
          ? '#b8e6f2'
          : kind === 'guard'
          ? '#bfe8de'
          : i % 3 === 0
          ? '#f4bb67'
          : '#fff3bd';
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        size: kind === 'heavy' ? 2.5 + (i % 3) : 1.6 + (i % 2),
        angle: Math.random() * Math.PI,
        life: 0.28 + Math.random() * 0.28,
        color: col,
      });
    }
  }

  function spawnSteam(x, y) {
    for (let i = 0; i < 28; i++) {
      steamPuffs.push({
        x: x + (Math.random() - 0.5) * 220,
        y: y + (Math.random() - 0.5) * 30,
        vy: -55 - Math.random() * 75,
        r: 14 + Math.random() * 24,
        life: 0,
        maxLife: 0.78 + Math.random() * 0.4,
      });
    }
  }

  // ==================== 840px / 700px SWORD GEOMETRY & HAMMER PLACEMENT ====================
  function computeSwordPose(weapon, forForging) {
    const stg = stageOfWeapon(weapon);
    const f = SWORD_ATLAS_META.frames[stg];
    const factor = stageW < 820 ? (forForging ? 0.74 : 0.6) : forForging ? 0.58 : 0.50;
    const w = Math.min(stageW * factor, forForging ? 840 : 680);
    const h = (w * f.height) / f.width;
    return {
      left: forForging ? (stageW - w) * 0.5 : stageW * 0.065,
      axisY: stageH * (forForging ? 0.58 : 0.77),
      width: w,
      height: h,
      angle: forForging ? 0 : -0.11,
      frame: f,
    };
  }

  function positionHammerDom() {
    const hImg = elStageBody.querySelector('#v8-hammer-img');
    if (!hImg || state.phase !== 'forging') return;
    const fw = getWeapon(state, state.forgeId);
    const pose = computeSwordPose(fw, true);
    const zoneCenter = activeForgePart === 'guard' ? 0.35 : activeForgePart === 'spine' ? 0.60 : 0.85;
    const xPx = pose.left + pose.width * zoneCenter;
    const yPx = pose.axisY;
    const hammerW = Math.min(620, Math.max(260, stageW * 0.48));
    hImg.style.width = `${hammerW}px`;
    hImg.style.left = `${xPx - hammerW * HAMMER_ATLAS_META.faceXRatio}px`;
    hImg.style.top = `${yPx - hammerW * HAMMER_ATLAS_META.faceYRatio}px`;
    aimXRatio = xPx / Math.max(1, stageW);
  }

  function getSweetSpotBounds() {
    const compBonus = Math.min(8, Math.floor(countCompendium() / 2) * 1.4);
    const perkMult = state.perk === 'hundred_refinements' ? 1.35 : 1.0;
    const halfSweet = 10.5 * perkMult + compBonus * 0.5;
    return { sweetMin: 50 - halfSweet, sweetMax: 50 + halfSweet };
  }

  function currentHeatZone() {
    if (heatSpeedMode === 'auto') return 'perfect';
    const b = getSweetSpotBounds();
    return heatPos >= b.sweetMin && heatPos <= b.sweetMax ? 'perfect' : 'good';
  }

  function recordCompendiumUnlocks(list) {
    if (!list || !list.length) return;
    let unlockedName = null;
    for (const item of list) {
      const prev = compendiumMap[item.id];
      if (!prev || item.strength > (prev.maxStrength || 0)) {
        compendiumMap[item.id] = { unlockedAt: Date.now(), maxStrength: item.strength, chapter: item.chapter };
        unlockedName = SWORD_COMPENDIUM.find((x) => x.id === item.id)?.name || unlockedName;
      }
    }
    if (unlockedName) {
      saveCompendiumMap(compendiumMap);
      state.compendiumCount = countCompendium();
      audio.sfx('compendium');
      showNotice('名剑入谱', `《铸剑百炼录》收录新剑：【${unlockedName}】`);
    }
  }

  function saveState() {
    if (state.screen === 'play') {
      savedRunExists = true;
      safeSetStorage(V8_STORAGE_KEY, JSON.stringify(state));
    }
  }

  function findTargetScreenCenter(targetId) {
    const el = targetId ? elStageBody.querySelector(`[data-target-id="${targetId}"]`) : elStageBody.querySelector('[data-target-id]');
    if (el) {
      const r = el.getBoundingClientRect();
      const sr = elStage.getBoundingClientRect();
      return { x: r.left - sr.left + r.width * 0.5, y: r.top - sr.top + r.height * 0.42 };
    }
    return { x: stageW * 0.64, y: stageH * 0.46 };
  }

  function getWorldAnchor(recipient) {
    if (recipient === 'shelter') return { x: stageW * 0.56, y: stageH * 0.49, angle: -1.18 };
    if (recipient === 'alan') return { x: stageW * 0.82, y: stageH * 0.64, angle: -1.38 };
    return { x: stageW * 0.64, y: stageH * 0.48, angle: -1.28 };
  }

  // ==================== ACTION DISPATCHER WITH FLYING-SWORD & HAMMER PLAYBACK ====================
  function act(action) {
    audio.unlock();
    const beforeWeapon =
      state.phase === 'forging' ? getWeapon(state, state.forgeId) : getWeapon(state, state.handId);
    const beforeReserve = getWeapon(state, state.reserveId);
    const targetPtBefore = action.targetId ? findTargetScreenCenter(action.targetId) : findTargetScreenCenter(null);

    const res = dispatchAction(state, action);
    if (!res.ok) {
      audio.sfx('damage');
      showNotice('尚不可行', res.reason);
      return false;
    }

    state = res.state;
    state.compendiumCount = countCompendium();
    saveState();
    syncAudioMood();

    const fx = res.fx || {};
    if (fx.sound) audio.sfx(fx.sound);
    if (fx.title || fx.toast) showNotice(fx.title, fx.toast);
    if (fx.unlockedCompendium?.length) recordCompendiumUnlocks(fx.unlockedCompendium);

    // Launch Scene7 Physical Sword / Hammer Motion
    const now = performance.now();
    if (fx.motion === 'forge') {
      const hImg = elStageBody.querySelector('#v8-hammer-img');
      if (hImg && typeof hImg.animate === 'function') {
        hImg.animate(
          [{ transform: 'rotate(8deg)' }, { transform: 'rotate(0deg)', offset: 0.25 }, { transform: `rotate(${fx.great ? 22 : 16}deg)`, offset: 0.68 }, { transform: 'rotate(8deg)' }],
          { duration: 240, easing: 'ease-out' }
        );
      }
      const fxX = aimXRatio * stageW;
      const fxY = stageH * 0.58;
      hitstopUntil = now + (fx.great ? 55 : 28);
      spawnSparks(fxX, fxY, fx.great ? 30 : 18, fx.great ? 'heavy' : 'hammer');
      spawnFloatLabel(
        fxX,
        fxY - 58,
        fx.broken ? '铁坯崩断' : fx.cracked ? '刃生首裂' : fx.title || `强度 ${fx.afterStrength}`,
        fx.toast || '',
        fx.broken || fx.cracked ? '#f4c1ae' : '#ffe49e'
      );
      activeAnim = { mode: 'forge', start: now, duration: 360, contactAt: 40, forgeX: fxX, weapon: getWeapon(state, state.forgeId) || beforeWeapon };
    } else if (fx.motion === 'seal') {
      const sealedW = getWeapon(state, fx.weaponId);
      spawnSteam(stageW * 0.5, stageH * 0.6);
      activeAnim = { mode: 'seal', start: now, duration: 540, contactAt: 260, weapon: sealedW, slot: fx.slot };
    } else if (fx.motion === 'strike') {
      const usedW = getWeapon(state, fx.weaponId) || beforeWeapon;
      hitstopUntil = now + (fx.staggered || fx.momentum ? 68 : 42);
      spawnSparks(targetPtBefore.x, targetPtBefore.y, fx.staggered ? 32 : 20, fx.staggered ? 'heavy' : 'hammer');
      spawnFloatLabel(
        targetPtBefore.x,
        targetPtBefore.y - 54,
        fx.cutRope ? '一剑断索' : `−${fx.damage} 伤害`,
        fx.toast || '',
        fx.momentum ? '#ffe59e' : '#fff0b9'
      );
      activeAnim = {
        mode: 'strike',
        start: now,
        duration: 560,
        contactAt: 210,
        weapon: usedW,
        targetPt: targetPtBefore,
        artId: fx.artId || null,
      };
    } else if (fx.motion === 'dualUlt') {
      hitstopUntil = now + 88;
      const pt = { x: stageW * 0.62, y: stageH * 0.46 };
      spawnSparks(pt.x, pt.y, 44, 'heavy');
      spawnFloatLabel(pt.x, pt.y - 60, `双剑合璧 −${fx.damage}`, '双锋齐出 · 护势 +3', '#ffe59e');
      activeAnim = {
        mode: 'dualUlt',
        start: now,
        duration: 680,
        contactAt: 260,
        weapon: beforeWeapon,
        prevWeapon: beforeReserve,
        targetPt: pt,
      };
    } else if (fx.motion === 'guard') {
      spawnSparks(stageW * 0.34, stageH * 0.68, 16, 'guard');
      activeAnim = { mode: 'guard', start: now, duration: 480, contactAt: 200, weapon: getWeapon(state, state.handId) };
    } else if (fx.motion === 'donate') {
      const donatedW = getWeapon(state, fx.weaponId) || beforeWeapon;
      activeAnim = {
        mode: 'donate',
        start: now,
        duration: fx.relighting ? 1150 : 680,
        contactAt: 360,
        weapon: donatedW,
        recipient: fx.recipient || 'lamp',
        relighting: Boolean(fx.relighting),
      };
    } else if (fx.motion === 'pressure') {
      spawnFloatLabel(
        stageW * 0.24,
        stageH * 0.64,
        fx.parry === 'perfect' ? '毫巅迎锋' : fx.loss > 0 ? `灯火 −${fx.loss}` : '灯火无损',
        `${fx.beforeLamp} → ${fx.afterLamp}`,
        fx.loss > 0 ? '#f6b19b' : '#bfe8de'
      );
      activeAnim = { mode: 'pressure', start: now, duration: 560, contactAt: 220, loss: fx.loss };
    }

    renderAll();
    return true;
  }

  function strikeBladeZone(part) {
    if (state.phase !== 'forging') return;
    activeForgePart = part;
    positionHammerDom();
    act({ type: 'hammer', zone: currentHeatZone(), part });
  }

  function initiateEndRound() {
    if (state.phase !== 'encounter' || !state.encounter || parryState.active) return;
    const p = computePressureSummary(state);
    if (p.totalPressure <= 0 || autoParry) {
      act({ type: 'endRound', parryGrade: autoParry && p.totalPressure > 0 ? 'auto' : 'none' });
      return;
    }
    parryState.active = true;
    parryState.startedAt = performance.now();
    parryState.progress = 0;
    parryState.hasMirror = hasRelic(state, 'relic_mirror');
    audio.sfx('hover');
    renderAll();
  }

  function resolveParryNow() {
    if (!parryState.active) return;
    const diff = Math.abs(parryState.progress - 0.72);
    const perfWin = parryState.hasMirror ? 0.17 : 0.12;
    const goodWin = 0.25;
    parryState.active = false;
    const grade = diff <= perfWin ? 'perfect' : diff <= goodWin ? 'good' : 'none';
    act({ type: 'endRound', parryGrade: grade });
  }

  // ==================== BACKDROP RESOLUTION ====================
  function resolveBackdropKey() {
    if (state.screen === 'title') return 'bg_road';
    if (state.phase === 'ending' && state.ending) {
      if (state.ending.kind === 'celestial_relit') return 'bg_end_celestial';
      if (state.ending.kind === 'relit') return 'bg_end_relit';
      if (state.ending.kind === 'homeward') return 'bg_end_home';
      return 'bg_end_embers';
    }
    if (state.phase === 'forging') return 'bg_forge';
    const n = state.node;
    if (n === 1) return 'bg_road';
    if (n === 2) return state.completedNodes.includes(2) ? 'bg_bridge_lit' : 'bg_bridge_dark';
    if (n === 3) return 'bg_bridge_lit';
    if (n === 4) return 'bg_winter';
    if (n === 5) return state.flags.northSaved || state.flags.southSaved ? 'bg_twin_lit' : 'bg_twin_dark';
    if (n === 6 || n === 7 || n === 8) return 'bg_snow_pass';
    return 'bg_mother_gate';
  }

  // ==================== RENDER UI LAYERS ====================
  function renderTopHud() {
    const bgUrl = artUrl(resolveBackdropKey());
    if (bgUrl) elBackdrop.style.backgroundImage = packageCssUrls(`url("${bgUrl}")`);

    const hideHud = state.screen === 'title' || state.phase === 'ending';
    elTopbar.style.display = hideHud ? 'none' : 'flex';
    elDeck.style.display = hideHud ? 'none' : 'block';
    if (hideHud) return;

    const chInfo = CHAPTER_INFO[state.chapter] || CHAPTER_INFO[1];
    const nodeInfo = NODES_DATA[state.node] || NODES_DATA[1];
    elChBadge.textContent = `第${state.chapter}章 · ${chInfo.name}（${DIFFICULTY_MODES[state.difficulty]?.name || '寻常行旅'}）`;
    elStationTitle.textContent = `第${state.node}站 · ${nodeInfo.title}`;
    elMissionText.textContent = nodeInfo.mission;

    // Labeled 9-Lantern Mainline Track
    let stepHtml = '';
    for (let i = 1; i <= 9; i++) {
      const done = state.completedNodes.includes(i);
      const current = state.node === i;
      stepHtml += `
        <span class="c12-lantern-node ${done ? 'done' : ''} ${current ? 'current' : ''}">
          <i class="c12-lantern-wick"></i>
          <span class="c12-lantern-name">${NODES_DATA[i].short}</span>
        </span>
      `;
    }
    elStepper.innerHTML = sanitizeHtml(stepHtml);

    // Hand-drawn CSS Flame-Wicks
    let wickHtml = '';
    for (let i = 0; i < state.lampMax; i++) {
      wickHtml += `<i class="c12-wick-drop ${i < state.lamp ? 'lit' : ''}"></i>`;
    }
    wickHtml += `<strong style="margin-left:5px;">${state.lamp}/${state.lampMax}</strong>`;
    elLampPill.innerHTML = sanitizeHtml(wickHtml);

    elResPill.textContent = `铁坯 ${state.blanks} · 手艺 ${state.charge} · ${state.coins}钱`;
    elBookCount.textContent = `${countCompendium()}/12`;
    elRelicCount.textContent = `${state.relics.length}`;
    elMuteBtn.textContent = audio.isMuted() ? '静音' : '有声';
  }

  function renderCompanionHtml(guide) {
    if (state.phase === 'forging' || state.phase === 'ending' || state.screen === 'title') return '';
    const cid = guide?.speaker || NODES_DATA[state.node]?.speaker || 'du';
    const comp = COMPANIONS[cid] || COMPANIONS.du;
    const line = guide?.line || NODES_DATA[state.node]?.line || '';
    const fullImg = artUrl(cid === 'alan' ? 'comp_alan' : cid === 'he' ? 'comp_he' : 'comp_du');

    return `
      <div class="c12-companion">
        <div class="c12-speech">
          <b>${comp.name} · 引路</b>
          <span>${line}</span>
        </div>
        <div class="c12-companion-figure" style="background-image:url('${fullImg}');background-size:contain;background-position:bottom center;"></div>
      </div>
    `;
  }

  function renderStageAndDeck() {
    // 1. Open-Road Title Screen
    if (state.screen === 'title') {
      elStageBody.innerHTML = sanitizeHtml(`
        <section class="c12-title-screen">
          <div class="c12-title-box">
            <div class="c12-kicker">锤下求生 · 以剑开路，护灯上山</div>
            <h1>护炉远行</h1>
            <div class="c12-subtitle">剑是你亲手打的。路，要和他们一起走完。</div>
            <p class="c12-story-lead">
              山口天枢母灯熄了，十二盏山路长灯正一盏盏暗下去。<br/>
              推着小炉车走过<strong>三章九站</strong>，用随车铁坯<strong>锻出一柄合格名剑（强度≥3）嵌入山巅母灯</strong>；若沿途救起摆渡人、南北双驿与雪谷妇孺，更可引动万家灯火共鸣。
            </p>

            <div style="display:flex;gap:8px;margin-top:16px;">
              ${Object.values(DIFFICULTY_MODES)
                .map(
                  (d) => `
                  <button class="c12-quiet-btn" data-title-diff="${d.id}" style="${
                    titleDiff === d.id ? 'border-color:#efc080;background:rgba(48,66,58,0.92);color:#ffe4a8;' : ''
                  }">${d.name} · ${d.badge}</button>`
                )
                .join('')}
            </div>

            <div class="c12-perk-strip">
              ${DESTINY_PERKS.map(
                (p) => `
                <button class="c12-perk-card ${titlePerk === p.id ? 'active' : ''}" data-title-perk="${p.id}">
                  <div style="color:#f5deb0;font:700 17px/1.3 var(--c12-display);">${p.name}</div>
                  <div style="color:#bfd4b7;font-size:11.5px;margin:2px 0;">${p.badge}</div>
                  <div style="color:#cfd2c2;font-size:12px;line-height:1.45;">${p.summary}</div>
                </button>`
              ).join('')}
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:22px;">
              <button id="c12-start-btn" class="c12-btn is-primary" style="min-width:210px;min-height:56px;font-size:22px;">
                推起炉车 · 踏上灯路
              </button>
              ${
                savedRunExists
                  ? `<button id="c12-continue-btn" class="c12-btn" style="min-width:170px;min-height:56px;font-size:20px;">
                      继续第${state.node}站行旅
                    </button>`
                  : ''
              }
              <button id="c12-trials-btn" class="c12-btn" style="min-height:56px;font-size:19px;">
                试锋残卷 · 选关直达
              </button>
            </div>
          </div>
        </section>
      `);

      elStageBody.querySelectorAll('[data-title-diff]').forEach((b) =>
        b.addEventListener('click', () => {
          titleDiff = b.getAttribute('data-title-diff');
          audio.sfx('click');
          renderStageAndDeck();
        })
      );
      elStageBody.querySelectorAll('[data-title-perk]').forEach((b) =>
        b.addEventListener('click', () => {
          titlePerk = b.getAttribute('data-title-perk');
          audio.sfx('click');
          renderStageAndDeck();
        })
      );
      elStageBody.querySelector('#c12-start-btn')?.addEventListener('click', () => {
        act({ type: 'enterPlay', perk: titlePerk, difficulty: titleDiff });
      });
      elStageBody.querySelector('#c12-continue-btn')?.addEventListener('click', () => {
        act({ type: 'enterPlay' });
      });
      elStageBody.querySelector('#c12-trials-btn')?.addEventListener('click', openTrialsModal);
      return;
    }

    // 2. Ending Screen
    if (state.phase === 'ending' && state.ending) {
      const ed = state.ending;
      elStageBody.innerHTML = sanitizeHtml(`
        <section class="c12-ending">
          <div class="c12-kicker">护炉远行终章 · ${ed.stoppedAt} · 评定【${ed.grade}】</div>
          <h1>${ed.title}</h1>
          <p style="max-width:680px;margin-top:12px;font-size:16.5px;line-height:1.8;color:#e6e4d0;">${ed.summary}</p>

          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;">
            ${ed.axes
              .map(
                (ax) => `
                <div style="padding:6px 14px;background:rgba(11,32,42,0.82);border-left:2px solid #d6b273;">
                  <div style="font-size:12px;color:#c9cdb9;">${ax.label}</div>
                  <strong style="font:700 22px/1.3 var(--c12-display);color:#ffe2a6;">${ax.value}</strong>
                </div>`
              )
              .join('')}
          </div>

          <div class="c12-epilogue-grid">
            ${ed.epilogues
              .map(
                (ep) => `
                <article class="c12-epilogue-card">
                  <img src="${artUrl(ep.art)}" alt="${ep.name}" style="float:left;width:54px;height:54px;border-radius:50%;object-fit:cover;margin:2px 10px 4px 0;border:1px solid #d6b273;" />
                  <strong style="color:#edcb90;font:700 20px/1.3 var(--c12-display);">${ep.name}</strong>
                  <p style="margin:5px 0 0;font-size:14px;line-height:1.6;">${ep.line}</p>
                </article>`
              )
              .join('')}
          </div>

          <div style="display:flex;gap:12px;margin-top:8px;">
            <button id="v9-new-standard" class="c12-btn is-primary">再走一趟灯路（寻常行旅）</button>
            <button id="v9-new-master" class="c12-btn">挑战宗师问剑</button>
            <button id="c12-ending-road" class="c12-btn">回看九站因果</button>
          </div>
        </section>
      `);
      elStageBody.querySelector('#v9-new-standard')?.addEventListener('click', () => {
        state = createInitialState(`护炉-${Date.now()}`, state.perk, true, 'standard', countCompendium());
        saveState();
        renderAll();
      });
      elStageBody.querySelector('#v9-new-master')?.addEventListener('click', () => {
        state = createInitialState(`护炉-${Date.now()}`, state.perk, true, 'master', countCompendium());
        saveState();
        renderAll();
      });
      elStageBody.querySelector('#c12-ending-road')?.addEventListener('click', openCausalModal);
      return;
    }

    const guide = computeGuidedStep(state);
    const focusKey = guide?.focusKey || '';

    // 3. Render Bottom-Left Sword Rack + Stance & Qi Seals
    const hand = getWeapon(state, state.handId);
    const reserve = getWeapon(state, state.reserveId);
    const renderRackSlot = (w, slotKind) => {
      const isHand = slotKind === 'hand';
      const guided = !isHand && focusKey === 'slot-reserve';
      if (!w || !isWeaponUsable(w)) {
        return `
          <button class="c12-rack-slot ${isHand ? 'is-hand' : ''}" disabled>
            <small style="color:#b7c5b2;font:13px/1.3 var(--c12-display);">${isHand ? '手中' : '备用'}</small>
            <span style="height:36px;"></span>
            <b style="font:16px/1.3 var(--c12-display);color:#9aa8a0;">空剑位</b>
          </button>
        `;
      }
      const f = SWORD_ATLAS_META.frames[3];
      const scale = 108 / f.width;
      const artInfo = getWeaponSwordArt(w);
      return `
        <button class="c12-rack-slot ${isHand ? 'is-hand' : ''} ${guided ? 'c12-btn is-guided' : ''}"
                data-rack-slot="${slotKind}"
                title="${w.name}（强度${w.strength} · 剑技《${artInfo.artName}》）${isHand ? '' : ' · 点击换至手中'}">
          <small style="color:${isHand ? '#e9ce96' : '#b7c5b2'};font:13px/1.3 var(--c12-display);">
            ${isHand ? '手中' : '备用 · 点此换剑'}
          </small>
          <span class="c12-mini-blade" style="height:${f.height * scale}px;background-image:url('${artUrl(
        'sword_stages_atlas'
      )}');background-size:${SWORD_ATLAS_META.width * scale}px ${SWORD_ATLAS_META.height * scale}px;background-position:${
        -f.x * scale
      }px ${-f.y * scale}px;"></span>
          <b style="font:700 16px/1.3 var(--c12-display);color:#f0deb4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">
            ${w.name} · ${w.strength}
          </b>
          <small style="font-size:11.5px;color:#c3ceb9;">${w.source === 'inherited' ? '旧剑' : `《${artInfo.artName}》`}</small>
        </button>
      `;
    };

    elRack.innerHTML = sanitizeHtml(`
      <div class="c12-rack-row">
        ${renderRackSlot(hand, 'hand')}
        ${renderRackSlot(reserve, 'reserve')}
      </div>
      <div class="c12-stance-bar">
        <span style="color:#e7cfa0;font:14px/1.2 var(--c12-display);">剑意 ${'◆'.repeat(state.qi)}${'◇'.repeat(
      Math.max(0, state.qiMax - state.qi)
    )}</span>
        <span style="opacity:0.35;">|</span>
        ${Object.values(SWORD_STANCES)
          .map(
            (st) => `
            <button class="c12-stance-pill ${state.stance === st.id ? 'active' : ''}" data-stance="${st.id}" title="${st.name}：${st.desc}">
              ${st.short}
            </button>`
          )
          .join('')}
      </div>
    `);

    elRack.querySelectorAll('[data-rack-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        const sk = b.getAttribute('data-rack-slot');
        if (sk === 'reserve') act({ type: 'swapSlots' });
        else openWeaponDetailModal(hand);
      })
    );
    elRack.querySelectorAll('[data-stance]').forEach((b) =>
      b.addEventListener('click', () => act({ type: 'switchStance', stance: b.getAttribute('data-stance') }))
    );

    // 4. Forging Stage & Controls
    if (state.phase === 'forging') {
      const w = getWeapon(state, state.forgeId);
      if (!w) return;
      const zh = w.zoneHits || { tip: 0, spine: 0, guard: 0 };
      const curArt = getWeaponSwordArt(w);
      const bounds = getSweetSpotBounds();
      const canSeal = w.hits >= 1 && w.strength >= 1;

      elStageBody.innerHTML = sanitizeHtml(`
        <div class="c12-forge-zones">
          ${['guard', 'spine', 'tip']
            .map((zk) => {
              const z = BLADE_ZONES[zk];
              const cnt = zh[zk] || 0;
              const unlocked = cnt >= 2;
              return `
                <button type="button" class="c12-blade-zone ${activeForgePart === zk ? 'active' : ''} ${
                unlocked ? 'unlocked' : ''
              }" data-zone-hit="${zk}" ${w.hits >= 6 ? 'disabled' : ''} title="${z.artDesc}">
                  <span class="c12-zone-title">${z.name} [${z.keyHint}]</span>
                  <span class="c12-zone-art-hint">${
                    unlocked ? `已悟《${z.artName}》` : `已敲 ${cnt}/2 · 悟《${z.artName}》`
                  }</span>
                </button>
              `;
            })
            .join('')}
        </div>

        <img id="v8-hammer-img" src="${artUrl('hammer_hd') || artUrl('hammer')}" alt="" />

        <div class="c12-forge-readout">
          <div style="display:flex;align-items:baseline;justify-content:center;gap:14px;flex-wrap:wrap;">
            <strong style="color:#f9dca6;font:700 26px/1.25 var(--c12-display);">当前强度 ${w.strength}</strong>
            <span>已锻 ${w.hits}/6 锤 · ${
        w.hits < 3 ? '前三锤安全无裂' : w.cracked ? '刃有首裂（再裂即断）' : '第四锤起有生裂风险'
      } · 预备剑技《${curArt.artName}》</span>
          </div>
          <div class="c12-heat-track">
            <div class="c12-heat-sweet" style="left:${bounds.sweetMin}%;width:${bounds.sweetMax - bounds.sweetMin}%;"></div>
            <div id="v8-heat-cursor" style="left:${heatPos}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:#d6ceB4;margin-top:4px;">
            <span id="v9-heat-zone-label">游标滑入中央金带落锤，攒星额外暴击 +1 强度</span>
            <span style="display:flex;gap:5px;">
              ${Object.values(HEAT_SPEED_MODES)
                .map(
                  (m) => `
                  <button class="c12-stance-pill ${heatSpeedMode === m.id ? 'active' : ''}" data-heat-mode="${m.id}">
                    ${m.label}
                  </button>`
                )
                .join('')}
            </span>
          </div>
        </div>
      `);

      positionHammerDom();

      elStageBody.querySelectorAll('[data-zone-hit]').forEach((btn) => {
        const zk = btn.getAttribute('data-zone-hit');
        btn.addEventListener('pointerenter', () => {
          activeForgePart = zk;
          positionHammerDom();
        });
        btn.addEventListener('click', () => strikeBladeZone(zk));
      });
      elStageBody.querySelectorAll('[data-heat-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          heatSpeedMode = b.getAttribute('data-heat-mode') || 'normal';
          if (heatSpeedMode === 'auto') heatPos = 50;
          renderStageAndDeck();
        })
      );

      // Left-Mid: Archetype Switch (when hits===0) + Forge Techniques (steady / fissure)
      elAssist.innerHTML = sanitizeHtml(`
        ${
          w.hits === 0
            ? `
            <small class="c12-side-group-label">落锤前可选剑坯器型</small>
            ${Object.values(BLADE_ARCHETYPES)
              .map(
                (a) => `
                <button class="c12-btn c12-side-btn ${w.archetype === a.id ? 'is-primary' : ''}" data-arch="${a.id}">
                  <span>${a.name}</span>
                  <span class="c12-sub">${a.trait}</span>
                </button>`
              )
              .join('')}
          `
            : ''
        }
        <small class="c12-side-group-label">匠师手艺（余 ${state.charge} 次）</small>
        <button id="v9-tech-steady" class="c12-btn c12-side-btn" ${state.charge <= 0 || w.hits >= 6 ? 'disabled' : ''}>
          <span>用定线固刃</span>
          <span class="c12-sub">强度 +1 · 抚平首裂不磨损</span>
        </button>
        <button id="v9-tech-fissure" class="c12-btn c12-side-btn" ${
          state.charge <= 0 || w.hits >= 6 || w.fissureMarked ? 'disabled' : ''
        }>
          <span>刻入崩纹</span>
          <span class="c12-sub">强度暴涨 +${w.cracked ? 2 : 3} · 出剑无视护甲</span>
        </button>
      `);

      elAssist.querySelectorAll('[data-arch]').forEach((b) =>
        b.addEventListener('click', () => act({ type: 'changeArchetype', archetype: b.getAttribute('data-arch') }))
      );
      elAssist.querySelector('#v9-tech-steady')?.addEventListener('click', () => act({ type: 'forgeTech', kind: 'steady' }));
      elAssist.querySelector('#v9-tech-fissure')?.addEventListener('click', () => act({ type: 'forgeTech', kind: 'fissure' }));

      // Bottom-Center: 3 Quench Sealing Methods
      elCmd.innerHTML = sanitizeHtml(`
        ${Object.values(QUENCH_TRAITS)
          .map(
            (q) => `
            <button class="c12-btn ${canSeal && q.id === 'blaze' ? 'is-primary' : ''} ${
              canSeal && focusKey === `seal-${q.id}` ? 'is-guided' : ''
            }" data-seal-quench="${q.id}" ${!canSeal ? 'disabled' : ''}>
              <span>收锻 · ${q.name}</span>
              <span class="c12-sub">${q.desc}</span>
            </button>`
          )
          .join('')}
        <button id="c12-discard-forge" class="c12-quiet-btn" style="align-self:center;">放下此坯</button>
      `);

      elCmd.querySelectorAll('[data-seal-quench]').forEach((b) =>
        b.addEventListener('click', () => {
          const q = b.getAttribute('data-seal-quench');
          const slot = !state.handId ? 'hand' : !state.reserveId ? 'reserve' : 'hand';
          act({ type: 'sealForge', quench: q, slot });
        })
      );
      elCmd.querySelector('#c12-discard-forge')?.addEventListener('click', () => act({ type: 'discardForge' }));
      return;
    }

    // 5. Relic Draft / Causal Choice / Failed Scrolls (Xuan-Paper Centered Interrupt)
    if (state.phase === 'relicDraft') {
      const activeWords = state.weapons.filter((w) => isWeaponUsable(w));
      elAssist.innerHTML = '';
      elCmd.innerHTML = '';
      elStageBody.innerHTML = sanitizeHtml(`
        <div class="c12-paper-choice">
          <small style="color:#6d5839;font:15px/1.3 var(--c12-display);">路旁古匣 · 择一件护炉遗珍随车同行</small>
          <h2>古匠遗珍三选一</h2>
          <p style="margin:4px 0 10px;color:#5a4d38;font-size:14px;">遗珍与特定剑铭或其他遗珍呼应时，将自动激发【炉火共鸣】。</p>
          ${state.relicOptions
            .map((rid) => {
              const r = RELICS_POOL.find((x) => x.id === rid);
              if (!r) return '';
              const sim = { ...state, relics: [...state.relics, rid] };
              const newSyns = RELIC_SYNERGIES.filter((s) => !s.check(state, activeWords) && s.check(sim, activeWords));
              return `
                <button class="c12-paper-option" data-pick-relic="${r.id}" style="display:flex;align-items:center;gap:14px;">
                  <img src="${artUrl(r.artKey)}" alt="${r.name}" style="width:52px;height:52px;object-fit:contain;flex-shrink:0;" />
                  <div>
                    <strong>${r.name} · ${r.tag}</strong>
                    <p>${r.desc}</p>
                    ${
                      newSyns.length
                        ? `<small style="font-weight:700;color:#8c431f;">立即激发炉火共鸣：【${newSyns
                            .map((s) => s.name)
                            .join('、')}】</small>`
                        : ''
                    }
                  </div>
                </button>
              `;
            })
            .join('')}
        </div>
        ${renderCompanionHtml(guide)}
      `);
      elStageBody.querySelectorAll('[data-pick-relic]').forEach((b) =>
        b.addEventListener('click', () => act({ type: 'pickRelic', relicId: b.getAttribute('data-pick-relic') }))
      );
      return;
    }

    const activeChoiceKey =
      state.phase === 'choice' ? state.choice : state.node === 4 && state.choice === 'camp-old-sword' ? 'camp-old-sword' : null;
    if (activeChoiceKey && CHOICES_DATA[activeChoiceKey]) {
      const cData = CHOICES_DATA[activeChoiceKey];
      elAssist.innerHTML = '';
      elCmd.innerHTML = '';
      elStageBody.innerHTML = sanitizeHtml(`
        <div class="c12-paper-choice">
          <small style="color:#6d5839;font:15px/1.3 var(--c12-display);">同行人在等你拿主意</small>
          <h2>${cData.title}</h2>
          <p style="margin:4px 0 10px;color:#5a4d38;font-size:14.5px;">${cData.prompt}</p>
          ${cData.options
            .map(
              (opt) => `
              <button class="c12-paper-option" data-choose="${opt.id}">
                <strong>${opt.label}</strong>
                <p>${opt.immediate}</p>
                <small>${opt.causal}</small>
              </button>`
            )
            .join('')}
        </div>
        ${renderCompanionHtml(guide)}
      `);
      elStageBody.querySelectorAll('[data-choose]').forEach((b) =>
        b.addEventListener('click', () => act({ type: 'choose', choice: b.getAttribute('data-choose') }))
      );
      return;
    }

    if (state.phase === 'failed') {
      const canRetry = state.retries[state.chapter] < 1;
      elAssist.innerHTML = '';
      elCmd.innerHTML = '';
      elStageBody.innerHTML = sanitizeHtml(`
        <div class="c12-paper-choice">
          <small style="color:#6d5839;font:15px/1.3 var(--c12-display);">止步于 ${NODES_DATA[state.node].title}</small>
          <h2>先把这口火记住</h2>
          <p style="margin:4px 0 12px;color:#5a4d38;font-size:15px;">${state.failure?.text || '风雪封路，车队暂且止步。'}</p>
          <button id="v9-retry-ch" class="c12-paper-option" ${!canRetry ? 'disabled' : ''}>
            <strong>回到第${state.chapter}章起点重整旗鼓（本章余 ${canRetry ? 1 : 0} 次）</strong>
            <p>恢复进入本章时的灯火、铁坯与兵刃状态，重新部署这一程。</p>
          </button>
          <button id="v9-accept-end" class="c12-paper-option">
            <strong>记下这次止步 · 查看终章结语</strong>
            <p>收起行囊，审阅此行留下的因果回响。</p>
          </button>
        </div>
      `);
      elStageBody.querySelector('#v9-retry-ch')?.addEventListener('click', () => act({ type: 'retryChapter' }));
      elStageBody.querySelector('#v9-accept-end')?.addEventListener('click', () => act({ type: 'acceptFailure' }));
      return;
    }

    // 6. Prepare Phase (Open Road + Clear Enemy Forecast + Primary Verb)
    if (state.phase === 'prepare') {
      const forecast = getBriefingForecast(state);
      elAssist.innerHTML = '';

      elStageBody.innerHTML = sanitizeHtml(`
        ${
          forecast
            ? `
          <div class="c12-briefing">
            <div class="c12-briefing-head">前路探报 · 对照手中剑备战</div>
            <div class="c12-briefing-list">
              ${forecast.targets
                .map(
                  (t) => `
                  <div class="c12-briefing-item">
                    <img src="${artUrl(t.artKey)}" alt="${t.name}" />
                    <div>
                      <b style="color:#f4d59e;font:700 20px/1.3 var(--c12-display);">${t.name}</b>
                      <small style="display:block;color:#c9d2c0;">耐久 ${t.health} · 护甲 ${t.armor}</small>
                      <div style="margin-top:3px;font-size:13px;color:#f3e5c7;">
                        ${
                          t.normalDmg === null
                            ? '手中尚无可用剑'
                            : `${forecast.bladeName}：直斩 ${t.normalDmg} 伤 / 架剑后 ${t.guardedDmg} 伤`
                        }
                      </div>
                    </div>
                  </div>`
                )
                .join('')}
            </div>
            <small style="display:block;margin-top:8px;color:#bfd4b7;">${NODES_DATA[state.node].causalPromise}</small>
          </div>
        `
            : ''
        }
        ${renderCompanionHtml(guide)}
      `);

      const firstForge = state.node === 1 && !state.weapons.some((w) => w.source === 'forged' && w.status === 'sealed');
      const needEmerg = state.node === 9 && state.blanks <= 0 && state.lamp > 1 && ![hand, reserve].some((w) => isFinalEligible(w));

      elCmd.innerHTML = sanitizeHtml(`
        <button id="c12-begin-forge" class="c12-btn ${focusKey === 'btn-begin-forge' ? 'is-primary is-guided' : ''}" ${
        state.blanks <= 0 ? 'disabled' : ''
      }>
          <span>${firstForge ? '为这趟路，打一柄剑' : `随车炉台 · 开炉铸剑（余${state.blanks}坯）`}</span>
          <span class="c12-sub">亲手锻打四阶横剑 · 领悟独门剑技</span>
        </button>

        ${
          needEmerg
            ? `<button id="v9-emerg-blank" class="c12-btn ${focusKey === 'btn-emerg-blank' ? 'is-primary is-guided' : ''}">
                <span>拆炉车护板化铁坯</span>
                <span class="c12-sub">耗 1 点灯火换取应急铁坯</span>
              </button>`
            : ''
        }

        <button id="v9-depart-btn" class="c12-btn ${focusKey === 'btn-depart' ? 'is-primary is-guided' : ''}">
          <span>${state.node === 9 ? '登顶 · 去修复母灯' : '推车前行 · 迎向此程'}</span>
          <span class="c12-sub">${NODES_DATA[state.node].title}（空格）</span>
        </button>

        ${
          [1, 4, 7].includes(state.node)
            ? `<button id="c12-camp-shop-btn" class="c12-btn">
                <span>炉边修整</span>
                <span class="c12-sub">添煤暖灯 · 购坯 · 升阶奇器</span>
              </button>`
            : ''
        }
      `);

      elCmd.querySelector('#c12-begin-forge')?.addEventListener('click', () => act({ type: 'beginForge', archetype: 'jian' }));
      elCmd.querySelector('#v9-emerg-blank')?.addEventListener('click', () => act({ type: 'emergencyBlank' }));
      elCmd.querySelector('#v9-depart-btn')?.addEventListener('click', () => act({ type: 'depart' }));
      elCmd.querySelector('#c12-camp-shop-btn')?.addEventListener('click', openShopModal);
      return;
    }

    // 7. Encounter Phase (Frameless Road Targets + Flying Sword + Companion Assists + Clean Actions)
    if (state.phase === 'encounter' && state.encounter) {
      const e = state.encounter;
      const p = computePressureSummary(state);
      const multiple = e.targets.length > 1;

      elStageBody.innerHTML = sanitizeHtml(`
        <div class="c12-turn-banner">
          <strong>第 ${e.round}/${e.roundLimit} 轮</strong>
          <span>行动 ${'◆'.repeat(e.actions)}${'◇'.repeat(Math.max(0, 2 - e.actions))}</span>
          <span>敌压 ${p.totalPressure} − 减免 ${p.reduction} − 护势 ${p.block} ＝
            <b style="color:${p.loss > 0 ? '#f6b19b' : '#bfd4b7'};">${
        p.loss > 0 ? `结束损灯 −${p.loss}` : '本轮灯火无损'
      }</b>
          </span>
          <button id="v9-toggle-autoparry" class="c12-stance-pill active" style="pointer-events:auto;">
            迎锋：${autoParry ? '自动稳守' : '手动格挡'}
          </button>
        </div>

        ${
          parryState.active
            ? `<div id="v9-parry-click" class="c12-parry-prompt">
                敌锋临近 · 待青金光环合拢至剑脊时按下【空格】或点击此处 —— 毫巅迎锋！
              </div>`
            : ''
        }

        ${e.targets
          .map((t, idx) => {
            const xPct = multiple ? (idx === 0 ? 50 : 68) : 60;
            const yPct = t.role === 'threat' ? (multiple ? (idx % 2 === 0 ? 50 : 55) : 51) : 45;
            const dead = t.health <= 0;
            const dep = t.requiresDestroyed ? e.targets.find((d) => d.id === t.requiresDestroyed) : null;
            const blocked = Boolean(dep && dep.health > 0);
            const preview = !dead && !blocked && hand && isWeaponUsable(hand) ? computeStrikePreview(state, hand, t) : null;
            const roundP = getTargetRoundPressure(t, e.round);
            const isGuidedTarget = focusKey === `target-${t.id}` && !dead && !blocked;

            return `
              <button type="button" class="c12-target ${isGuidedTarget ? 'is-guided-target' : ''}"
                      data-target-id="${t.id}" data-kind="${t.id}" data-dead="${dead}"
                      ${dead || blocked || parryState.active ? 'disabled' : ''}
                      style="left:${xPct}%;top:${yPct}%;">
                <span class="c12-target-art">
                  <img src="${artUrl(t.artKey)}" alt="${t.name}" />
                </span>
                <span class="c12-target-caption">
                  <b>${t.name}${t.armor > 0 ? ` · 甲${t.armor}` : ''}</b>
                  <span style="font-size:13px;color:#eddfbc;">${dead ? '已击破' : `耐久 ${t.health} / ${t.maxHealth}`}</span>
                  <span class="c12-hp-bar">
                    <span class="c12-hp-fill" style="width:${Math.round((t.health / Math.max(1, t.maxHealth)) * 100)}%;"></span>
                  </span>
                  <small style="display:block;color:${roundP >= 3 ? '#f4b59d' : '#d6d4c4'};">
                    ${
                      dead
                        ? '道路已开'
                        : blocked
                        ? `需先斩断「${dep.name}」`
                        : t.staggered
                        ? '已破势断招（本轮 0 压力）'
                        : t.role === 'threat'
                        ? `本轮袭灯压力 ${roundP}`
                        : t.intent
                    }
                  </small>
                  ${
                    preview && e.actions > 0
                      ? `<span class="c12-target-preview">
                          点此出剑 −${preview.damage}${
                          preview.willKill
                            ? e.momentumUsedThisRound
                              ? ' · 击破'
                              : ' · 击破并返1行动'
                            : preview.willStagger
                            ? e.momentumUsedThisRound
                              ? ' · 破势'
                              : ' · 破势并返1行动'
                            : ''
                        }
                        </span>`
                      : ''
                  }
                </span>
              </button>
            `;
          })
          .join('')}

        ${renderCompanionHtml(guide)}
      `);

      elStageBody.querySelector('#v9-toggle-autoparry')?.addEventListener('click', () => {
        autoParry = !autoParry;
        audio.sfx('click');
        renderStageAndDeck();
      });
      elStageBody.querySelector('#v9-parry-click')?.addEventListener('pointerdown', resolveParryNow);
      elStageBody.querySelectorAll('[data-target-id]').forEach((node) =>
        node.addEventListener('click', () => {
          const tid = node.getAttribute('data-target-id');
          act({ type: 'strike', targetId: tid });
        })
      );

      // Left-Mid: Station Mechanisms + Zero-Cost Companion Assists + Tool
      const hasScroll = hasRelic(state, 'relic_scroll');
      let sideHtml = '';

      // Node-specific mechanisms
      if (['n2', 'n5-south', 'n8'].includes(e.id)) {
        const cutId = e.id === 'n2' ? 'bridge-rope' : e.id === 'n5-south' ? 'south-rope' : 'relay-rope';
        const req = getCutRequirement(state, cutId);
        const okCut = e.actions >= 1 && hand && isWeaponUsable(hand) && !hand.cracked && hand.strength >= req;
        sideHtml += `
          <small class="c12-side-group-label">这段路的巧法</small>
          <button class="c12-btn c12-side-btn ${okCut && focusKey === 'mech-cut' ? 'is-primary is-guided' : ''}" data-mech="cut" ${
          !okCut ? 'disabled' : ''
        }>
            <span>利刃切索 · 1行动</span>
            <span class="c12-sub">需完好强度≥${req} · 零磨损开路</span>
          </button>`;
      }
      if (['n5-north', 'n5-south'].includes(e.id) && state.flags.ferrymanSaved && !state.flags.ferryAssistUsed) {
        sideHtml += `
          <button class="c12-btn c12-side-btn ${focusKey === 'mech-ferryAssist' ? 'is-primary is-guided' : ''}" data-mech="ferryAssist">
            <span>摆渡人牵索 · 不占行动</span>
            <span class="c12-sub">昔日恩情 · 直接拉开驿门</span>
          </button>`;
      }
      if (e.id === 'n8' && (state.flags.crossingHeld || (state.flags.southSaved && state.flags.ring === 'left'))) {
        sideHtml += `
          <button class="c12-btn c12-side-btn ${e.actions >= 1 && focusKey === 'mech-useSideRoute' ? 'is-primary is-guided' : ''}" data-mech="useSideRoute" ${
          e.actions < 1 ? 'disabled' : ''
        }>
            <span>侧路引索直通 · 1行动</span>
            <span class="c12-sub">昔日因果 · 免战直抵母灯台</span>
          </button>`;
      }
      if (e.id === 'n6') {
        const oldW = getWeapon(state, 'du-old-sword');
        const donor =
          (oldW && isWeaponUsable(oldW) && oldW.strength >= 3 ? oldW : null) ||
          [reserve, hand].find((w) => w && isWeaponUsable(w) && w.strength >= 3);
        sideHtml += `
          <small class="c12-side-group-label">避难炉救人巧法</small>
          <button class="c12-btn c12-side-btn ${donor && e.actions >= 1 && focusKey === 'mech-donateShelter' ? 'is-primary is-guided' : ''}"
                  data-donate-shelter="${donor ? donor.id : ''}" ${!donor || e.actions < 1 ? 'disabled' : ''}>
            <span>留剑撑危梁 · 1行动</span>
            <span class="c12-sub">${donor ? `献出「${donor.name}」稳住屋顶` : '需强度≥3的剑'}</span>
          </button>`;
      }
      if (e.id === 'n7' && !e.alanGuard) {
        const okAlan = reserve && isWeaponUsable(reserve) && reserve.strength >= 3 && e.actions >= 1;
        sideHtml += `
          <button class="c12-btn c12-side-btn" data-mech="donateAlan" ${!okAlan ? 'disabled' : ''}>
            <span>交备用剑给阿岚 · 1行动</span>
            <span class="c12-sub">本战每轮落石压力 −2</span>
          </button>`;
      }
      if (e.id === 'n9') {
        const driveDead = e.targets.some((t) => t.id === 'drive-lock' && t.health === 0);
        const wheelDead = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
        const secret = getSecretEndingStatus(state);
        sideHtml += `<small class="c12-side-group-label">修复母灯 · 依序落定</small>`;
        if (state.flags.coreOwner !== 'socket') {
          sideHtml += `
            <button class="c12-btn c12-side-btn ${focusKey === 'mech-placeCore' ? 'is-primary is-guided' : ''}"
                    data-mech="placeCore" ${e.actions < 1 ? 'disabled' : ''}>
              <span>安放唯一灯芯 · 1行动</span>
              <span class="c12-sub">将灯芯放入母灯座</span>
            </button>`;
        }
        if (wheelDead && state.flags.carrier === 'player' && !e.braced && !e.braceAssistUsed) {
          sideHtml += `
            <button class="c12-btn c12-side-btn ${focusKey === 'mech-assistBrace' ? 'is-primary is-guided' : ''}" data-mech="assistBrace">
              <span>阿禾扶稳母灯 · 不占行动</span>
              <span class="c12-sub">亲自携芯回馈 · 锁死底座</span>
            </button>`;
        }
        const canIgniteNow = driveDead && wheelDead && state.flags.coreOwner === 'socket' && e.braced && isFinalEligible(hand) && e.actions >= 1;
        sideHtml += `
          <button class="c12-btn c12-side-btn ${canIgniteNow && focusKey === 'mech-ignite' ? 'is-primary is-guided' : ''}"
                  data-mech="${secret.canIgniteCelestial ? 'celestialIgnite' : 'ignite'}" ${!canIgniteNow ? 'disabled' : ''}>
            <span>${secret.canIgniteCelestial ? '万家薪火 · 剑魄归宗' : '嵌剑入母灯 · 复明山路'}</span>
            <span class="c12-sub">${
              !driveDead
                ? '待完成：先斩传动锁'
                : !wheelDead
                ? '待完成：停下逆转巨轮'
                : state.flags.coreOwner !== 'socket'
                ? '待完成：安放唯一灯芯'
                : !e.braced
                ? '待完成：架稳母灯底座'
                : !isFinalEligible(hand)
                ? '请将自铸合格剑换至手中'
                : e.actions < 1
                ? '结束本轮恢复行动后即可嵌剑'
                : `献出「${hand.name}」点亮十二长灯`
            }</span>
          </button>`;
      }

      if (state.tool?.kind === 'rebound' && state.tool.stored > 0 && !e.followUpUsed) {
        sideHtml += `
          <button id="v9-followup-btn" class="c12-btn c12-side-btn is-primary">
            <span>回锋追斩 −${state.tool.stored} · 不占行动</span>
            <span class="c12-sub">回锋齿溢出余威</span>
          </button>`;
      }
      if (state.tool?.kind === 'furnace' && state.charge > 0 && hand && hand.strength < (hand.sealedStrength || hand.strength)) {
        sideHtml += `
          <button id="v9-temper-btn" class="c12-btn c12-side-btn" ${e.actions < 1 ? 'disabled' : ''}>
            <span>崩炉续火 · 1行动</span>
            <span class="c12-sub">修复手中剑磨损强度</span>
          </button>`;
      }

      // Companion Zero-Cost Assist Buttons
      sideHtml += `<small class="c12-side-group-label">同行援手 · 不占行动</small>`;
      for (const cid of ['alan', 'he', 'du']) {
        const c = COMPANIONS[cid];
        const up = isCompanionUpgraded(state, cid);
        const disabled =
          (!hasScroll && e.companionUsed) || (hasScroll && (e.usedCompanions.includes(cid) || e.companionUsedThisRound));
        const isG = focusKey === `comp-${cid}` && !disabled;
        sideHtml += `
          <button class="c12-btn c12-side-btn ${isG ? 'is-primary is-guided' : ''}" data-comp="${cid}" ${
          disabled ? 'disabled' : ''
        }>
            <span>${c.name} · ${c.skillName}${up ? '（升阶）' : ''}</span>
            <span class="c12-sub">${up ? c.upgradedDesc : c.baseDesc}</span>
          </button>
        `;
      }

      elAssist.innerHTML = sanitizeHtml(sideHtml);
      elAssist.querySelectorAll('[data-mech]').forEach((b) =>
        b.addEventListener('click', () => act({ type: 'mechanism', kind: b.getAttribute('data-mech') }))
      );
      elAssist.querySelectorAll('[data-donate-shelter]').forEach((b) =>
        b.addEventListener('click', () =>
          act({ type: 'mechanism', kind: 'donateShelter', weaponId: b.getAttribute('data-donate-shelter') })
        )
      );
      elAssist.querySelector('#v9-followup-btn')?.addEventListener('click', () => act({ type: 'followUp' }));
      elAssist.querySelector('#v9-temper-btn')?.addEventListener('click', () => act({ type: 'temper' }));
      elAssist.querySelectorAll('[data-comp]').forEach((b) =>
        b.addEventListener('click', () => act({ type: 'companionAssist', companionId: b.getAttribute('data-comp') }))
      );

      // Bottom-Center: Guard + 0-Action Sword Art + Dual-Blade Ultimate + End Round
      const artInfo = hand && isWeaponUsable(hand) ? getWeaponSwordArt(hand) : null;
      const canArt = Boolean(artInfo && state.qi >= artInfo.artCost && !e.artUsedThisRound);
      const ultReady = canCastDualUlt(state);
      const ultCost = getDualUltCost(state);
      const wheelStopped = e.id === 'n9' && e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);

      elCmd.innerHTML = sanitizeHtml(`
        <button id="v9-guard-btn" class="c12-btn ${focusKey === 'btn-guard' ? 'is-primary is-guided' : ''}" ${
        e.actions < 1 || e.guarded || parryState.active ? 'disabled' : ''
      }>
          <span>${wheelStopped ? '架稳母灯 · 1行动' : '架剑蓄破 · 1行动'}</span>
          <span class="c12-sub">${wheelStopped ? '锁固母灯底座并添护势' : '护势 +3 · 下一剑无视护甲并 +2 伤'}</span>
        </button>

        <button id="v9-art-btn" class="c12-btn ${canArt && focusKey === 'btn-art' ? 'is-primary is-guided' : ''}" ${
        !canArt || parryState.active ? 'disabled' : ''
      } title="${artInfo ? artInfo.artDesc : ''}">
          <span>剑技《${artInfo ? artInfo.artName : '未佩剑'}》</span>
          <span class="c12-sub">不占行动 · 耗 ${artInfo ? artInfo.artCost : 2} 点剑意</span>
        </button>

        ${
          reserve && isWeaponUsable(reserve)
            ? `<button id="v9-ult-btn" class="c12-btn ${ultReady && focusKey === 'btn-ult' ? 'is-primary is-guided' : ''}" ${
                !ultReady || parryState.active ? 'disabled' : ''
              }>
                <span>双剑合璧</span>
                <span class="c12-sub">不占行动 · 需 ${ultCost} 点剑意横扫全场</span>
              </button>`
            : ''
        }

        <button id="v9-end-round-btn" class="c12-btn ${
          focusKey === 'btn-end' ? 'is-primary is-guided' : ''
        }" ${parryState.active ? 'disabled' : ''}>
          <span>${e.actions === 0 ? '结束本轮 · 迎敌结算' : '提前结束本轮'}</span>
          <span class="c12-sub">${p.loss > 0 ? `预计灯火 −${p.loss}（可迎锋减伤）` : '护势充足 · 本轮灯火无损'}</span>
        </button>
      `);

      elCmd.querySelector('#v9-guard-btn')?.addEventListener('click', () => act({ type: 'guard' }));
      elCmd.querySelector('#v9-art-btn')?.addEventListener('click', () => act({ type: 'useSwordArt' }));
      elCmd.querySelector('#v9-ult-btn')?.addEventListener('click', () => act({ type: 'useDualUltimate' }));
      elCmd.querySelector('#v9-end-round-btn')?.addEventListener('click', initiateEndRound);
    }
  }

  function renderAll() {
    renderTopHud();
    renderStageAndDeck();
  }

  // ==================== 60FPS CANVAS PAINT: 840px SWORD, FLYING ARCS, EMBEDDED BLADES & SPARKS ====================
  function decorateBladeSurface(ink, f, w, now) {
    const start = f.width * f.bodyStart;
    const end = f.width * f.bodyEnd;
    const axis = f.height * f.axisY;

    // Quench elemental luster along the blade edge
    if (w.quench) {
      const qCol =
        w.quench === 'frost'
          ? 'rgba(168, 224, 240, 0.24)'
          : w.quench === 'blaze'
          ? 'rgba(245, 148, 72, 0.24)'
          : 'rgba(240, 208, 138, 0.22)';
      ink.fillStyle = qCol;
      ink.fillRect(start, 0, end - start, f.height);
    }

    // Golden spine line for 定线固刃 (steady)
    if (w.technique === 'steady') {
      ink.strokeStyle = 'rgba(255, 228, 166, 0.78)';
      ink.lineWidth = f.height * 0.028;
      ink.beginPath();
      ink.moveTo(start, axis - f.height * 0.11);
      ink.lineTo(end - f.width * 0.08, axis - f.height * 0.09);
      ink.lineTo(end, axis);
      ink.stroke();
    }

    // Molten lightning vein for 刻入崩纹 (fissureMarked)
    if (w.fissureMarked) {
      ink.lineJoin = 'round';
      ink.lineCap = 'round';
      ink.beginPath();
      for (let i = 0; i <= 11; i++) {
        const px = start + ((end - start) * i) / 11;
        const py = axis + (i % 2 ? 1 : -1) * f.height * (i % 3 === 0 ? 0.16 : 0.06);
        if (i === 0) ink.moveTo(px, py);
        else ink.lineTo(px, py);
      }
      ink.strokeStyle = '#713d29';
      ink.lineWidth = f.height * 0.055;
      ink.stroke();
      ink.strokeStyle = '#ef9b50';
      ink.lineWidth = f.height * 0.024;
      ink.stroke();
      ink.strokeStyle = '#ffe5a8';
      ink.lineWidth = f.height * 0.01;
      ink.stroke();
    } else if (w.cracked) {
      const cx = start + (end - start) * 0.68;
      ink.strokeStyle = '#1e2f35';
      ink.lineWidth = f.height * 0.045;
      ink.beginPath();
      ink.moveTo(cx, 0);
      ink.lineTo(cx - f.width * 0.018, axis * 0.65);
      ink.lineTo(cx + f.width * 0.01, f.height);
      ink.stroke();
    }

    // Live hammer-contact molten heat bloom
    if (activeAnim?.mode === 'forge' && now - activeAnim.start < 340) {
      const heat = Math.max(0, 1 - (now - activeAnim.start) / 340);
      const pose = computeSwordPose(w, true);
      const localX = ((activeAnim.forgeX - pose.left) / Math.max(1, pose.width)) * f.width;
      const r = f.width * 0.13;
      const g = ink.createRadialGradient(localX, f.height * 0.5, 2, localX, f.height * 0.5, r);
      g.addColorStop(0, `rgba(255, 242, 190, ${heat * 0.85})`);
      g.addColorStop(0.3, `rgba(255, 158, 69, ${heat * 0.62})`);
      g.addColorStop(1, 'rgba(226, 108, 37, 0)');
      ink.fillStyle = g;
      ink.fillRect(localX - r, 0, r * 2, f.height);
    }
  }

  function paintSingleSword(w, forForging, now, settledRecipient = null, customTransform = null) {
    if (!ctx || !w) return;
    const pose = computeSwordPose(w, forForging);
    const f = pose.frame;
    let pivotX = pose.left + pose.width * 0.10;
    let pivotY = pose.axisY;
    let angle = pose.angle;
    let drawW = pose.width;
    let drawH = pose.height;
    let alpha = 1;

    if (settledRecipient) {
      const anc = getWorldAnchor(settledRecipient);
      pivotX = anc.x;
      pivotY = anc.y;
      angle = anc.angle;
      drawW = stageW * (settledRecipient === 'shelter' ? 0.28 : 0.21);
      drawH = (drawW * f.height) / f.width;
      alpha = 0.92;
    } else if (customTransform) {
      pivotX = customTransform.x;
      pivotY = customTransform.y;
      angle = customTransform.angle;
      alpha = customTransform.alpha ?? 1;
      if (customTransform.width) {
        drawW = customTransform.width;
        drawH = (drawW * f.height) / f.width;
      }
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);
    ctx.translate(-drawW * 0.10, -f.axisY * drawH);

    stampCanvas.width = f.width;
    stampCanvas.height = f.height;
    const ink = stampCanvas.getContext('2d');
    if (ink) {
      ink.clearRect(0, 0, f.width, f.height);
      if (swordAtlasReady) {
        ink.drawImage(swordAtlasImg, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
      } else {
        ink.fillStyle = '#8fa6a8';
        ink.fillRect(f.width * 0.1, f.height * 0.35, f.width * 0.85, f.height * 0.3);
      }
      ink.save();
      ink.globalCompositeOperation = 'source-atop';
      decorateBladeSurface(ink, f, w, now);
      ink.restore();

      ctx.shadowColor = forForging ? 'rgba(237, 180, 101, 0.35)' : 'rgba(2, 8, 13, 0.8)';
      ctx.shadowBlur = forForging ? 16 : 9;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(stampCanvas, 0, 0, drawW, drawH);
    }
    ctx.restore();
  }

  let rafId = 0;
  let lastNow = performance.now();

  function tick(now) {
    const rawDt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const frozen = now < hitstopUntil;
    const dt = frozen ? rawDt * 0.08 : rawDt;
    const tSec = now * 0.001;

    // Smooth Sine-Damped Heat Gauge in Forging
    if (state.phase === 'forging') {
      const spd = HEAT_SPEED_MODES[heatSpeedMode]?.baseSpeed ?? 0.45;
      if (spd === 0) {
        heatPos = 50;
      } else {
        heatPhase = (heatPhase + rawDt * spd) % 1;
        heatPos = 50 + 45 * Math.sin(heatPhase * Math.PI * 2);
      }
      const curEl = elStageBody.querySelector('#v8-heat-cursor');
      if (curEl) curEl.style.left = `${heatPos}%`;
      const lblEl = elStageBody.querySelector('#v9-heat-zone-label');
      if (lblEl) {
        const isGold = currentHeatZone() === 'perfect';
        lblEl.textContent = isGold
          ? '正值金焰极温 —— 此时点击剑面落锤可攒星暴击！'
          : '常火稳锻区 —— 点击剑面稳升 1 点强度';
        lblEl.style.color = isGold ? '#ffe39e' : '#d0ceb8';
      }
    }

    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, stageW, stageH);

      // 1. Subtle Ambient Snow / Warm Furnace Glow
      if (state.screen === 'play') {
        if (state.chapter >= 2 && state.phase !== 'forging' && state.phase !== 'ending') {
          ctx.save();
          ctx.fillStyle = '#d9e9e7';
          for (let i = 0; i < 24; i++) {
            const sx = stageW * ((i * 0.173 + tSec * 0.015) % 1);
            const sy = stageH * ((i * 0.237 + tSec * (0.024 + (i % 3) * 0.006)) % 1);
            ctx.globalAlpha = 0.14 + (i % 4) * 0.05;
            ctx.beginPath();
            ctx.arc(sx, sy, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        if (state.phase === 'forging' || state.node === 4 || state.node === 6) {
          const gx = stageW * 0.32;
          const gy = stageH * 0.72;
          const gr = stageH * 0.28;
          const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
          glow.addColorStop(0, `rgba(244, 153, 63, ${0.11 + Math.sin(tSec * 1.8) * 0.025})`);
          glow.addColorStop(1, 'rgba(240, 154, 60, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
        }
      }

      // 2. Render Donated Swords Embedded in the World (Shelter Beam / Alan / Mother Lamp)
      if (state.screen === 'play') {
        for (const w of state.weapons) {
          if (
            w.status === 'donated' &&
            activeAnim?.weapon?.id !== w.id &&
            ((w.owner === 'shelter' && state.node === 6) ||
              (w.owner === 'alan' && state.node === 7) ||
              (w.owner === 'lamp' && (state.node === 9 || state.phase === 'ending')))
          ) {
            paintSingleSword(w, false, now, w.owner);
          }
        }
      }

      // 3. Render Active Blade & Physical Motion Playback (Strike / DualUlt / Seal / Donate / Guard)
      if (activeAnim && now - activeAnim.start >= activeAnim.duration) {
        activeAnim = null;
      }

      if (state.screen === 'play' && state.phase !== 'ending') {
        const liveBlade =
          state.phase === 'forging' ? getWeapon(state, state.forgeId) : getWeapon(state, state.handId);

        if (activeAnim) {
          const elapsed = now - activeAnim.start;
          const prog = Math.min(1, elapsed / activeAnim.duration);
          const tContact = Math.min(1, elapsed / Math.max(1, activeAnim.contactAt));
          const afterContact = Math.max(0, elapsed - activeAnim.contactAt);
          const returnT =
            elapsed > activeAnim.contactAt
              ? Math.min(1, afterContact / Math.max(1, activeAnim.duration - activeAnim.contactAt))
              : 0;

          if (activeAnim.mode === 'forge' && liveBlade) {
            const vib = afterContact > 0 ? Math.sin(returnT * Math.PI * 4) * (1 - returnT) * 3 : 0;
            const pose = computeSwordPose(liveBlade, true);
            paintSingleSword(liveBlade, true, now, null, {
              x: pose.left + pose.width * 0.10,
              y: pose.axisY + vib,
              angle: 0,
            });
          } else if (activeAnim.mode === 'seal' && activeAnim.weapon) {
            const pose = computeSwordPose(activeAnim.weapon, true);
            const destX = stageW * (activeAnim.slot === 'hand' ? 0.06 : 0.16);
            const destY = stageH * 0.88;
            const amt = ease(prog);
            paintSingleSword(activeAnim.weapon, true, now, null, {
              x: lerp(pose.left + pose.width * 0.10, destX, amt),
              y: lerp(pose.axisY, destY, amt),
              angle: lerp(0, -0.05, amt),
              width: lerp(pose.width, 120, amt),
              alpha: 1 - Math.max(0, (prog - 0.7) / 0.3),
            });
          } else if (activeAnim.mode === 'strike' && activeAnim.weapon) {
            const pose = computeSwordPose(activeAnim.weapon, false);
            const baseX = pose.left + pose.width * 0.10;
            const baseY = pose.axisY;
            const tp = activeAnim.targetPt || { x: stageW * 0.62, y: stageH * 0.46 };
            const contactAng = -0.42;
            const metalReach = pose.width * 0.62;
            const tx = tp.x - Math.cos(contactAng) * metalReach;
            const ty = tp.y - Math.sin(contactAng) * metalReach;

            let curX, curY, curAng;
            if (elapsed <= activeAnim.contactAt) {
              const ap = ease(tContact);
              curX = lerp(baseX, tx, ap);
              curY = lerp(baseY, ty, ap);
              curAng = tContact < 0.45 ? lerp(pose.angle, -1.12, tContact / 0.45) : lerp(-1.12, contactAng, (tContact - 0.45) / 0.55);
            } else {
              const rp = ease(returnT);
              curX = lerp(tx, baseX, rp);
              curY = lerp(ty, baseY, rp);
              curAng = lerp(contactAng, pose.angle, rp);
            }
            paintSingleSword(activeAnim.weapon, false, now, null, { x: curX, y: curY, angle: curAng });

            // Sweeping Ink-Gold Crescent Arc at Contact!
            if (afterContact > 0 && afterContact < 280) {
              const a = 1 - afterContact / 280;
              ctx.save();
              ctx.globalAlpha = a;
              ctx.strokeStyle = activeAnim.artId === 'pierce_cloud' ? '#bfe8f5' : '#fff0bf';
              ctx.shadowColor = '#eecf83';
              ctx.shadowBlur = 22;
              ctx.lineWidth = activeAnim.artId ? 7 : 4;
              ctx.beginPath();
              ctx.ellipse(tp.x - 6, tp.y - 4, Math.min(stageW * 0.18, 175), stageH * 0.12, -0.48, -1.75, 1.15);
              ctx.stroke();
              ctx.restore();
            }
          } else if (activeAnim.mode === 'dualUlt' && activeAnim.weapon) {
            const tp = activeAnim.targetPt || { x: stageW * 0.62, y: stageH * 0.46 };
            const s = Math.sin(prog * Math.PI);
            paintSingleSword(activeAnim.weapon, false, now, null, {
              x: lerp(stageW * 0.12, tp.x - 160, s),
              y: lerp(stageH * 0.78, tp.y + 40, s),
              angle: -0.55,
            });
            if (activeAnim.prevWeapon) {
              paintSingleSword(activeAnim.prevWeapon, false, now, null, {
                x: lerp(stageW * 0.18, tp.x - 140, s),
                y: lerp(stageH * 0.30, tp.y - 40, s),
                angle: 0.48,
              });
            }
            ctx.save();
            ctx.globalAlpha = s * 0.85;
            ctx.strokeStyle = '#ffe5a3';
            ctx.shadowColor = '#f5be62';
            ctx.shadowBlur = 24;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(tp.x - 190, tp.y - 120);
            ctx.lineTo(tp.x + 190, tp.y + 120);
            ctx.moveTo(tp.x - 190, tp.y + 120);
            ctx.lineTo(tp.x + 190, tp.y - 120);
            ctx.stroke();
            ctx.restore();
          } else if (activeAnim.mode === 'donate' && activeAnim.weapon) {
            const pose = computeSwordPose(activeAnim.weapon, false);
            const anc = getWorldAnchor(activeAnim.recipient);
            const amt = ease(tContact);
            paintSingleSword(activeAnim.weapon, false, now, null, {
              x: lerp(pose.left + pose.width * 0.10, anc.x, amt),
              y: lerp(pose.axisY, anc.y, amt),
              angle: lerp(pose.angle, anc.angle, amt),
              width: lerp(pose.width, stageW * 0.22, amt),
            });
            if (activeAnim.relighting && afterContact > 0) {
              ctx.save();
              ctx.globalAlpha = Math.sin(returnT * Math.PI) * 0.72;
              ctx.strokeStyle = '#ffe2a3';
              ctx.shadowColor = '#f5cb79';
              ctx.shadowBlur = 24;
              ctx.lineWidth = 2.5;
              for (let i = 0; i < 7; i++) {
                ctx.beginPath();
                ctx.moveTo(anc.x, anc.y);
                ctx.quadraticCurveTo(
                  stageW * (0.48 - i * 0.035),
                  stageH * (0.34 + i * 0.025),
                  lerp(anc.x, stageW * (0.12 + i * 0.08), returnT),
                  lerp(anc.y, stageH * (0.90 - i * 0.025), returnT)
                );
                ctx.stroke();
              }
              ctx.restore();
            }
          } else if (activeAnim.mode === 'guard' && liveBlade) {
            const pose = computeSwordPose(liveBlade, false);
            const s = Math.sin(prog * Math.PI);
            paintSingleSword(liveBlade, false, now, null, {
              x: pose.left + pose.width * 0.10,
              y: pose.axisY - s * 24,
              angle: lerp(pose.angle, -0.82, s),
            });
            ctx.save();
            ctx.globalAlpha = s * 0.78;
            ctx.strokeStyle = '#b4dedb';
            ctx.shadowColor = '#91cacd';
            ctx.shadowBlur = 18;
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.ellipse(stageW * 0.37, stageH * 0.72, stageW * 0.19, stageH * 0.26, -0.15, -2.85, -0.28);
            ctx.stroke();
            ctx.restore();
          } else if (liveBlade) {
            paintSingleSword(liveBlade, state.phase === 'forging', now);
          }
        } else if (liveBlade) {
          paintSingleSword(liveBlade, state.phase === 'forging', now);
        }
      }

      // 4. Active Parry Jade-Gold Shrinking Ring
      if (parryState.active) {
        const elapsed = now - parryState.startedAt;
        parryState.progress = Math.min(1, elapsed / parryState.duration);
        if (parryState.progress >= 1) {
          parryState.active = false;
          act({ type: 'endRound', parryGrade: 'none' });
        } else {
          const px = stageW * 0.34;
          const py = stageH * 0.66;
          const sweetR = 48;
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, sweetR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(242, 205, 132, 0.85)';
          ctx.lineWidth = parryState.hasMirror ? 18 : 12;
          ctx.stroke();

          const curR = 148 - parryState.progress * 138;
          const inSweet = Math.abs(parryState.progress - 0.72) <= (parryState.hasMirror ? 0.17 : 0.12);
          ctx.beginPath();
          ctx.arc(px, py, Math.max(8, curR), 0, Math.PI * 2);
          ctx.strokeStyle = inSweet ? '#fff9e6' : '#a8d8cf';
          ctx.lineWidth = inSweet ? 5 : 3;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 5. Steam Puffs & Forge/Slash Sparks
      for (let i = steamPuffs.length - 1; i >= 0; i--) {
        const st = steamPuffs[i];
        st.life += rawDt;
        if (st.life >= st.maxLife) {
          steamPuffs.splice(i, 1);
          continue;
        }
        st.y += st.vy * rawDt;
        const k = 1 - st.life / st.maxLife;
        ctx.save();
        ctx.globalAlpha = k * 0.45;
        ctx.fillStyle = '#dcebed';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * (1.3 - k * 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 195 * dt;
        p.angle += dt * 3;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 3.2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size * 1.9);
        ctx.restore();
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  // ==================== XUAN-PAPER MODALS ====================
  function openModal(title, html) {
    elModalTitle.textContent = title;
    elModalBody.innerHTML = sanitizeHtml(html);
    elModalWrap.classList.add('open');
  }

  function closeModal() {
    elModalWrap.classList.remove('open');
  }

  elModalWrap.querySelector('#v8-modal-close')?.addEventListener('click', closeModal);
  elModalWrap.addEventListener('click', (e) => {
    if (e.target === elModalWrap) closeModal();
  });

  function openWeaponDetailModal(w) {
    if (!w) return;
    const art = getWeaponSwordArt(w);
    openModal(
      w.name,
      `
      <p><strong>当前强度 ${w.strength}</strong>（收锻强度 ${w.sealedStrength ?? w.strength}） · ${
        w.source === 'inherited' ? '杜伯所借旧剑（母灯最后需你亲手锻造的名剑）' : `开刃剑技《${art.artName}》`
      }</p>
      <p style="color:#5c4d36;">${w.source === 'inherited' ? '旧剑可用来开路、架剑，亦可在第六站避难炉留剑撑住危梁。' : art.artDesc}</p>
      `
    );
  }

  function openShopModal() {
    openModal(
      `杜伯炉摊 · 营地修整（手头 ${state.coins} 枚铜钱）`,
      `
      <div style="display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:1px solid rgba(147,119,78,0.35);">
        <img src="${artUrl('head_du')}" alt="杜伯" style="width:68px;height:68px;border-radius:50%;object-fit:cover;border:1px solid #8c7044;" />
        <div style="font:18px/1.6 var(--c12-display);color:#523e27;">
          趁背风歇脚，把炉火添旺、铁坯备齐，后半程风雪再急也不慌。
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px;">
        <button class="c12-paper-option" data-shop-buy="coal" ${state.coins < 2 || state.lamp >= state.lampMax ? 'disabled' : ''}>
          <strong>添煤暖炉 · 2钱</strong>
          <p>恢复 ${state.perk === 'eternal_wick' ? 4 : 3} 点琉璃灯火（当前 ${state.lamp}/${state.lampMax}）。</p>
        </button>
        <button class="c12-paper-option" data-shop-buy="blank" ${state.coins < 2 || state.blanks >= 4 ? 'disabled' : ''}>
          <strong>添置新铁坯 · 2钱</strong>
          <p>随车多备一枚铁坯（当前 ${state.blanks} 枚）。</p>
        </button>
        <button class="c12-paper-option" data-shop-buy="upgrade" ${
          !state.tool || state.tool.level === 2 || state.upgradeUsed || state.coins < 4 ? 'disabled' : ''
        }>
          <strong>升阶随车奇器 · 4钱</strong>
          <p>${state.tool ? '将奇器升至二阶，并令杜伯援手升阶。' : '第二站桥头取得奇器后可在此升阶。'}</p>
        </button>
      </div>
      `
    );
    elModalBody.querySelectorAll('[data-shop-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        if (act({ type: 'shop', item: b.getAttribute('data-shop-buy') })) openShopModal();
      })
    );
  }

  function openTrialsModal() {
    openModal(
      '试锋残卷 · 选关直达与新起行旅',
      `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <span>可直接切入任意代表战局试剑，或回到山路口重新择定天命出发：</span>
        <button id="v9-reopen-prologue" class="c12-paper-option" style="width:auto;margin:0;padding:7px 16px;">
          <strong>回到山路口 · 重新择命启程</strong>
        </button>
      </div>
      ${TRIAL_CHAPTERS.map(
        (t) => `
        <button class="c12-paper-option" data-load-preset="${t.id}">
          <strong>${t.title}（${t.badge}）</strong>
          <p>${t.desc}</p>
        </button>`
      ).join('')}
      `
    );
    elModalBody.querySelector('#v9-reopen-prologue')?.addEventListener('click', () => {
      closeModal();
      state.screen = 'title';
      renderAll();
    });
    elModalBody.querySelectorAll('[data-load-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        const pid = b.getAttribute('data-load-preset');
        parryState.active = false;
        state = buildPresetState(pid, countCompendium());
        saveState();
        syncAudioMood();
        closeModal();
        renderAll();
      })
    );
  }

  function openCompendiumModal() {
    const n = countCompendium();
    const sweetBonus = Math.min(8, Math.floor(n / 2) * 1.4).toFixed(1);
    openModal(
      `铸剑百炼录（已收录 ${n}/12 柄传世名剑）`,
      `
      <p style="margin-top:0;color:#5c4a32;">跨局永久加成：当前炉温金焰甜区额外拓宽 <strong>+${sweetBonus}%</strong>${
        n >= 4 ? '，开局额外多带 1 枚铜钱（已生效）' : '（收录满4柄再享开局+1铜钱）'
      }。</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
        ${SWORD_COMPENDIUM.map((it) => {
          const rec = compendiumMap[it.id];
          return `
            <div style="padding:10px 12px;border:1px solid rgba(136,116,72,0.48);background:${
              rec ? 'rgba(255,248,228,0.65)' : 'rgba(220,202,168,0.4)'
            };opacity:${rec ? 1 : 0.68};">
              <strong style="font:700 18px/1.3 var(--c12-display);color:#3d2f1f;">${it.name} · ${
            rec ? `已录（最高${rec.maxStrength}强）` : '待铸'
          }</strong>
              <small style="display:block;color:#7a5235;">${it.tier} · ${it.condition}</small>
              <p style="margin:4px 0 0;font-size:13.5px;color:#554835;">${it.poem}</p>
            </div>
          `;
        }).join('')}
      </div>
      `
    );
  }

  function openRelicModal() {
    const syns = getActiveSynergies(state);
    openModal(
      `随车护炉遗珍（${state.relics.length}/9）与炉火共鸣（${syns.length}/6）`,
      `
      <h3 style="margin:0 0 8px;font:700 20px/1.3 var(--c12-display);color:#4d3824;">六大炉火共鸣</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:9px;margin-bottom:16px;">
        ${RELIC_SYNERGIES.map((s) => {
          const on = syns.some((x) => x.id === s.id);
          return `
            <div style="padding:9px 11px;border:1px solid ${on ? '#8c5a2b' : 'rgba(136,116,72,0.4)'};background:${
            on ? 'rgba(255,244,214,0.82)' : 'rgba(232,214,180,0.4)'
          };">
              <strong style="font:700 17px/1.3 var(--c12-display);color:#3e2e1e;">${s.name}${on ? '（已生效）' : ''}</strong>
              <p style="margin:3px 0 0;font-size:13px;">${s.desc}</p>
            </div>
          `;
        }).join('')}
      </div>
      <h3 style="margin:0 0 8px;font:700 20px/1.3 var(--c12-display);color:#4d3824;">九件古匠遗珍</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:9px;">
        ${RELICS_POOL.map((r) => {
          const owned = state.relics.includes(r.id);
          return `
            <div style="display:flex;gap:10px;padding:9px 11px;border:1px solid rgba(136,116,72,0.45);opacity:${
              owned ? 1 : 0.62
            };background:${owned ? 'rgba(255,248,228,0.7)' : 'transparent'};">
              <img src="${artUrl(r.artKey)}" alt="${r.name}" style="width:40px;height:40px;object-fit:contain;" />
              <div>
                <strong style="font:700 17px/1.3 var(--c12-display);">${r.name}${owned ? ' · 已随车' : ''}</strong>
                <p style="margin:2px 0 0;font-size:13px;">${r.desc}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      `
    );
  }

  function openCausalModal() {
    const secret = getSecretEndingStatus(state);
    openModal(
      '九站灯路长卷与真结局契机',
      `
      <div style="padding:11px 14px;border:1px solid #9c7c4c;background:rgba(255,246,222,0.72);margin-bottom:14px;">
        <strong style="font:700 19px/1.3 var(--c12-display);color:#4a3520;">主线终极誓约与【万家薪火】真结局进度</strong>
        <p style="margin:4px 0 0;font-size:14px;">
          · 仁心全救（第二站救摆渡人 + 第五站救南北双驿 + 第六站留恒温环暖孤炉）：<strong>${
            secret.benevolenceMet ? '已圆满达成' : '尚在途中'
          }</strong><br/>
          · 自铸名剑（嵌入母灯的亲手锻造名剑强度 ≥ 6）：<strong>${
            secret.divineBladeMet ? '已备妥' : `当前最高 ${secret.maxForgedStrength} 强`
          }</strong><br/>
          · 护灯余温（复明时琉璃灯火 ≥ 5）：<strong>${secret.lampMet ? '充沛' : `当前 ${state.lamp} 点`}</strong>
        </p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        ${Object.values(NODES_DATA)
          .map((nd) => {
            const done = state.completedNodes.includes(nd.node);
            const cur = state.node === nd.node;
            return `
              <div style="padding:8px 11px;border-left:3px solid ${
                cur ? '#b77c35' : done ? '#6f8865' : '#9c8a6b'
              };background:rgba(255,255,255,0.28);">
                <strong style="font:700 17px/1.3 var(--c12-display);">第${nd.node}站 · ${nd.title}${
              cur ? '（当前）' : done ? '（已过）' : ''
            }</strong>
                <div style="font-size:13px;color:#5a4b35;">${nd.mission}</div>
              </div>
            `;
          })
          .join('')}
      </div>
      ${
        state.phase !== 'ending' && state.lamp > 0
          ? `<button id="v9-evac-btn" class="c12-paper-option">
              <strong>收拢余火 · 护着同行人折返山下（达成「保人归途」结局）</strong>
            </button>`
          : ''
      }
      `
    );
    elModalBody.querySelector('#v9-evac-btn')?.addEventListener('click', () => {
      closeModal();
      act({ type: 'evacuate' });
    });
  }

  function openAudioModal() {
    const curManual = audio.getManualTrack();
    openModal(
      '国风五声雅乐与锻铁音效',
      `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
        <label>
          <span>背景雅乐音量：<strong id="v8-bgm-val">${Math.round(audio.getBgmVolume() * 100)}%</strong></span>
          <input type="range" id="v8-bgm-slider" min="0" max="100" value="${Math.round(audio.getBgmVolume() * 100)}" style="width:100%;" />
        </label>
        <label>
          <span>锻铁与刀剑音效：<strong id="v8-sfx-val">${Math.round(audio.getSfxVolume() * 100)}%</strong></span>
          <input type="range" id="v8-sfx-slider" min="0" max="100" value="${Math.round(audio.getSfxVolume() * 100)}" style="width:100%;" />
        </label>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;">
        <button class="c12-paper-option" data-bgm-track="auto" style="margin:0;">
          <strong>随章节自动流转${curManual === 'auto' ? '（当前）' : ''}</strong>
        </button>
        ${BGM_TRACKS.map(
          (t) => `
          <button class="c12-paper-option" data-bgm-track="${t.id}" style="margin:0;">
            <strong>${t.title}${curManual === t.id ? '（当前）' : ''}</strong>
            <small>${t.subtitle}</small>
          </button>`
        ).join('')}
      </div>
      `
    );
    elModalBody.querySelector('#v8-bgm-slider')?.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      audio.setBgmVolume(v);
      const lbl = elModalBody.querySelector('#v8-bgm-val');
      if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
    });
    elModalBody.querySelector('#v8-sfx-slider')?.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      audio.setSfxVolume(v);
      audio.sfx('hammer_perfect');
      const lbl = elModalBody.querySelector('#v8-sfx-val');
      if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
    });
    elModalBody.querySelectorAll('[data-bgm-track]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.unlock();
        audio.setManualTrack(b.getAttribute('data-bgm-track'));
        openAudioModal();
      })
    );
  }

  // Bind Top Buttons
  elStepper?.addEventListener('click', openCausalModal);
  rootEl.querySelector('#v8-comp-btn')?.addEventListener('click', openTrialsModal);
  rootEl.querySelector('#v9-book-btn')?.addEventListener('click', openCompendiumModal);
  rootEl.querySelector('#v9-relic-btn')?.addEventListener('click', openRelicModal);
  rootEl.querySelector('#v8-compass-btn')?.addEventListener('click', openCausalModal);
  rootEl.querySelector('#v9-audio-btn')?.addEventListener('click', openAudioModal);
  elMuteBtn?.addEventListener('click', () => {
    audio.toggleMute();
    renderTopHud();
  });

  // Keyboard Shortcuts
  const onKeyDown = (ev) => {
    if (ev.key === 'Escape' && elModalWrap.classList.contains('open')) {
      closeModal();
      return;
    }
    if (elModalWrap.classList.contains('open') || state.screen === 'title') return;

    const k = ev.key.toLowerCase();
    if (parryState.active && (ev.code === 'Space' || k === 'e')) {
      ev.preventDefault();
      resolveParryNow();
      return;
    }

    if (state.phase === 'forging') {
      if (k === 'a') strikeBladeZone('guard');
      else if (k === 's') strikeBladeZone('spine');
      else if (k === 'd') strikeBladeZone('tip');
      else if (ev.code === 'Space' || ev.key === 'Enter') {
        ev.preventDefault();
        strikeBladeZone(activeForgePart);
      }
      return;
    }

    if (state.phase === 'encounter' && state.encounter) {
      if (k === 'q') act({ type: 'swapSlots' });
      else if (k === 'z') act({ type: 'switchStance', stance: 'balanced' });
      else if (k === 'x') act({ type: 'switchStance', stance: 'fierce' });
      else if (k === 'c') act({ type: 'switchStance', stance: 'still' });
      else if (k === 'k') act({ type: 'guard' });
      else if (k === 'f') act({ type: 'useSwordArt' });
      else if (k === 'r') act({ type: 'useDualUltimate' });
      else if (k === 'e') initiateEndRound();
      else if (['1', '2'].includes(k)) {
        const t = state.encounter.targets[Number(k) - 1];
        if (t && t.health > 0) act({ type: 'strike', targetId: t.id });
      }
      return;
    }

    if (state.phase === 'prepare' && ev.code === 'Space') {
      ev.preventDefault();
      act({ type: 'depart' });
    }
  };
  window.addEventListener('keydown', onKeyDown);

  renderAll();
  rafId = requestAnimationFrame(tick);

  return {
    getState: () => state,
    dispatch: act,
    dispose: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      audio.dispose();
    },
  };
}
