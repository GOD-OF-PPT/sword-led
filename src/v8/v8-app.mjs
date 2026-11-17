// V8.2 Competition Edition Interactive UI: Damped Heat Gauge, 12-Sword Compendium, Secret Ending & Multi-Track Audio Mixer
import { BGM_TRACKS, createV8Audio } from './v8-audio.mjs';
import { JUDGE_PRESETS } from './v8-data.mjs';
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
  V8_COMPENDIUM_KEY,
  V8_STORAGE_KEY,
  buildPresetState,
  computePressureSummary,
  computeStrikePreview,
  createInitialState,
  dispatchAction,
  formatWeaponTitle,
  getCutRequirement,
  getEncounterSpec,
  getSecretEndingStatus,
  getStaggerThreshold,
  getTargetRoundPressure,
  getWeapon,
  isCompanionUpgraded,
  isFinalEligible,
  isWeaponUsable,
} from './v8-engine.mjs';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mountV8App(root, artMap, options = {}) {
  const audio = createV8Audio();
  const art = (key) => artMap[key] || '';

  let screen = 'title';
  let selectedPerk = 'hundred_refinements';
  let selectedDifficulty = 'standard';
  let selectedQuench = 'frost';
  let heatSpeedMode = 'normal'; // 'calm' | 'normal' | 'brisk' | 'auto'

  let compendium = loadCompendium();
  let state = loadSavedState() || createInitialState('薪火-2026', selectedPerk, false, selectedDifficulty, Object.keys(compendium).length);
  let hasSavedRun = !!loadSavedState();

  // Damped sweet-spot forge gauge cursor (0..1)
  let heatPos = 0.64;
  let heatDir = 1;
  let hammerAnimUntil = 0;
  let toastTimer = null;

  let particles = [];
  let slashes = [];
  let rafId = null;
  let lastTs = performance.now();

  function loadCompendium() {
    try {
      const raw = window.localStorage.getItem(V8_COMPENDIUM_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function saveCompendium(next) {
    compendium = next;
    try {
      window.localStorage.setItem(V8_COMPENDIUM_KEY, JSON.stringify(next));
    } catch (_e) {
      // Ignore storage error
    }
  }

  function recordCompendiumUnlocks(items) {
    if (!items || !items.length) return [];
    const newlyUnlocked = [];
    const next = { ...compendium };
    for (const item of items) {
      const entry = SWORD_COMPENDIUM.find((e) => e.id === item.id);
      if (!entry) continue;
      if (!next[item.id]) {
        newlyUnlocked.push(entry.name);
        next[item.id] = { maxStrength: item.strength || 5, count: 1, chapter: item.chapter || 1 };
      } else {
        next[item.id] = {
          maxStrength: Math.max(next[item.id].maxStrength || 0, item.strength || 0),
          count: (next[item.id].count || 1) + 1,
          chapter: item.chapter || next[item.id].chapter || 1,
        };
      }
    }
    saveCompendium(next);
    return newlyUnlocked;
  }

  function loadSavedState() {
    try {
      const raw = window.localStorage.getItem(V8_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 'v8-competition' && parsed.node >= 1 && parsed.node <= 9) {
        if (!parsed.difficulty) parsed.difficulty = 'standard';
        return parsed;
      }
    } catch (_e) {
      // Ignore
    }
    return null;
  }

  function saveState(next) {
    try {
      window.localStorage.setItem(V8_STORAGE_KEY, JSON.stringify(next));
      hasSavedRun = true;
    } catch (_e) {
      // Ignore
    }
  }

  // Keep every existing ID and button label intact while adding Compendium & Sound Mixer
  root.innerHTML = `
    <div class="v8-root" id="v8-root">
      <header class="v8-topbar" id="v8-topbar">
        <div class="v8-brand-cluster">
          <span class="v8-ch-badge" id="v8-ch-badge">第一章 · 夜渡河谷</span>
          <span class="v8-station-title" id="v8-station-title">1/9 巡夜引火</span>
          <button type="button" class="v8-icon-btn" data-act="open-roadmap" title="查看三章九站因果灯路图与隐藏结局契机">🗺️ 因果灯路</button>
          <button type="button" class="v8-icon-btn is-jade" id="v8-comp-btn" data-act="open-compendium" title="查看跨周目传世名剑图鉴与加成">📖 名剑图鉴</button>
        </div>
        <div class="v8-stepper-wrap">
          <div class="v8-stepper" id="v8-stepper"></div>
          <button type="button" class="v8-compass-btn" id="v8-compass-btn" data-act="pulse-guide">🧭 主线指引</button>
        </div>
        <div class="v8-res-cluster">
          <span class="v8-pill" id="v8-lamp-pill" title="琉璃灯火（归零则止步）"></span>
          <span class="v8-pill" id="v8-res-pill"></span>
          <button type="button" class="v8-icon-btn is-accent" data-act="open-presets" title="比赛评委快速跳关体验各章核心机制与隐藏真结局">⚡ 赛事演武</button>
          <button type="button" class="v8-icon-btn" id="v8-mute-btn" data-act="toggle-audio" title="点击开关声音">🎵 琴音</button>
          <button type="button" class="v8-icon-btn" data-act="open-mixer" title="打开国风五声音律混音与曲目点播台">🎚️ 音律</button>
          <button type="button" class="v8-icon-btn" data-act="open-menu">📜 歇脚</button>
        </div>
      </header>

      <main class="v8-stage" id="v8-stage">
        <div class="v8-backdrop" id="v8-backdrop"></div>
        <canvas id="v8-canvas"></canvas>
        <div class="v8-toast" id="v8-toast" hidden></div>
        <div id="v8-stage-body" style="position:relative;z-index:10;flex:1;display:flex;flex-direction:column;min-height:0;"></div>
      </main>

      <footer class="v8-deck" id="v8-deck" hidden>
        <div class="v8-deck-col" id="v8-col-rack"></div>
        <div class="v8-cmd-center" id="v8-col-cmd"></div>
        <div class="v8-deck-col" id="v8-col-assist"></div>
      </footer>

      <div class="v8-modal-backdrop" id="v8-modal-wrap" hidden>
        <div class="v8-modal">
          <div class="v8-modal-head">
            <h3 id="v8-modal-title">卷轴</h3>
            <button type="button" class="v8-icon-btn" data-act="close-modal">✕ 关闭</button>
          </div>
          <div class="v8-modal-body" id="v8-modal-body"></div>
        </div>
      </div>
    </div>
  `;

  const elRoot = root.querySelector('#v8-root');
  const elTopbar = root.querySelector('#v8-topbar');
  const elChBadge = root.querySelector('#v8-ch-badge');
  const elStationTitle = root.querySelector('#v8-station-title');
  const elCompBtn = root.querySelector('#v8-comp-btn');
  const elStepper = root.querySelector('#v8-stepper');
  const elCompassBtn = root.querySelector('#v8-compass-btn');
  const elLampPill = root.querySelector('#v8-lamp-pill');
  const elResPill = root.querySelector('#v8-res-pill');
  const elMuteBtn = root.querySelector('#v8-mute-btn');
  const elBackdrop = root.querySelector('#v8-backdrop');
  const elCanvas = root.querySelector('#v8-canvas');
  const elToast = root.querySelector('#v8-toast');
  const elStageBody = root.querySelector('#v8-stage-body');
  const elDeck = root.querySelector('#v8-deck');
  const elColRack = root.querySelector('#v8-col-rack');
  const elColCmd = root.querySelector('#v8-col-cmd');
  const elColAssist = root.querySelector('#v8-col-assist');
  const elModalWrap = root.querySelector('#v8-modal-wrap');
  const elModalTitle = root.querySelector('#v8-modal-title');
  const elModalBody = root.querySelector('#v8-modal-body');

  function showToast(msg) {
    if (!msg) return;
    if (toastTimer) clearTimeout(toastTimer);
    elToast.textContent = msg;
    elToast.hidden = false;
    toastTimer = setTimeout(() => {
      elToast.hidden = true;
    }, 3600);
  }

  function openModal(title, html) {
    audio.sfx('scroll');
    elModalTitle.textContent = title;
    elModalBody.innerHTML = html;
    elModalWrap.hidden = false;
  }

  function closeModal() {
    elModalWrap.hidden = true;
  }

  function spawnSparks(nx, ny, count, palette, speedScale = 1) {
    const rect = elCanvas.getBoundingClientRect();
    const cx = nx * rect.width;
    const cy = ny * rect.height;
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI + Math.random() * Math.PI * 2;
      const spd = (60 + Math.random() * 190) * speedScale;
      particles.push({
        kind: 'spark',
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        life: 0.38 + Math.random() * 0.45,
        maxLife: 0.85,
        size: 2 + Math.random() * 3.5,
        color: palette[i % palette.length],
      });
    }
  }

  function spawnSlashArc(nx, ny, color = '#ffe59e') {
    const rect = elCanvas.getBoundingClientRect();
    slashes.push({
      x: nx * rect.width,
      y: ny * rect.height,
      life: 0.28,
      maxLife: 0.28,
      color,
    });
  }

  function triggerShake() {
    elRoot.classList.remove('v8-shake');
    void elRoot.offsetWidth;
    elRoot.classList.add('v8-shake');
  }

  function compendiumBonusWidth() {
    const unlocked = Object.keys(compendium).length;
    return Math.min(0.08, Math.floor(unlocked / 3) * 0.02);
  }

  function sweetBounds() {
    const baseStart = state.perk === 'hundred_refinements' ? 0.54 : 0.57;
    const baseEnd = state.perk === 'hundred_refinements' ? 0.8 : 0.76;
    const extra = compendiumBonusWidth();
    return {
      start: Math.max(0.45, baseStart - extra * 0.5),
      end: Math.min(0.88, baseEnd + extra * 0.5),
    };
  }

  function currentHeatZone() {
    if (heatSpeedMode === 'auto') return 'perfect';
    const b = sweetBounds();
    // Generous ±2.4% grace margin around sweet spot so near-border hits feel great!
    const grace = 0.024;
    if (heatPos >= b.start - grace && heatPos <= b.end + grace) return 'perfect';
    if (heatPos >= 0.24 && heatPos <= 0.89) return 'good';
    return 'cold';
  }

  function computeCompassText() {
    if (state.phase === 'ending') return '已完成远行 · 查阅五维宗师碑文';
    if (state.phase === 'failed') return '点击重整本章或记下止步';
    if (state.phase === 'choice') return '请在卷轴中抉择因果方向 →';
    if (state.phase === 'forging') {
      const fw = getWeapon(state, state.forgeId);
      if (fw && fw.hits < 3) return `瞄准金焰甜区落锤 (${fw.hits}/3 安全锤)`;
      return '选淬火词条并收锻入鞘 →';
    }
    if (state.phase === 'prepare') {
      const hasForged = [state.handId, state.reserveId].some((id) => isFinalEligible(getWeapon(state, id)));
      if (state.node === 1 && state.stats.totalForged === 0) return '第1步：点击【开炉铸剑】打第一把新剑 →';
      if (state.node === 4 && state.choice === 'camp-old-sword') return '先回应杜伯旧剑的去留决定 →';
      if (state.node === 9 && !hasForged) return '⚠ 山口母灯只认自铸剑！请先开炉铸剑 →';
      return `点击【拔剑启程】前往${NODES_DATA[state.node].title} →`;
    }
    if (state.phase === 'encounter' && state.encounter) {
      const e = state.encounter;
      if (e.id === 'n9') {
        const dDone = e.targets.some((t) => t.id === 'drive-lock' && t.health === 0);
        const wDone = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
        if (!dDone) return '母灯①：先斩断【逆转传动锁】';
        if (!wDone) return '母灯②：集火停下【逆转巨轮】';
        if (state.flags.coreOwner !== 'socket') return '母灯③：点击【安放唯一灯芯】';
        if (!e.braced) return '母灯④：点击【架稳母灯】或【阿禾扶稳】';
        const sec = getSecretEndingStatus(state);
        return sec.canIgniteCelestial ? '🌟 契机圆满：点击【万家薪火】开启隐藏真结局！' : '母灯⑤：点击【献剑复明】点亮十二路灯！';
      }
      const need = getStaggerThreshold(state);
      const tele = e.targets.find((t) => t.health > 0 && !t.staggered && getTargetRoundPressure(t, e.round) >= 3);
      if (tele && e.actions > 0) return `优先斩击【${tele.name}】打出≥${need}伤破势断招！`;
      if (e.actions === 0) return '行动已尽：可放0行动协战/追斩，或结束本轮 →';
      return '点击右侧道路目标挥斩，或架剑蓄破 →';
    }
    return '护送灯芯前往山口母灯';
  }

  function getSceneBgKey() {
    if (screen === 'title') return 'bg_road';
    if (state.phase === 'ending' && state.ending) {
      return state.ending.kind === 'relit' || state.ending.kind === 'celestial_relit'
        ? 'bg_end_relit'
        : state.ending.kind === 'homeward'
        ? 'bg_end_home'
        : 'bg_end_embers';
    }
    if (state.phase === 'forging') return 'bg_forge';
    if (state.node === 2) return state.phase === 'choice' ? 'bg_bridge_lit' : 'bg_bridge_dark';
    if (state.node === 5) return state.flags.northSaved || state.flags.southSaved ? 'bg_twin_lit' : 'bg_twin_dark';
    if (state.node === 9) return state.flags.coreOwner === 'socket' ? 'bg_mother_gate' : 'bg_snow_pass';
    return NODES_DATA[state.node]?.bg || 'bg_road';
  }

  function syncAudioMood() {
    if (screen === 'title') {
      audio.setMood('ch1');
    } else if (state.phase === 'ending') {
      audio.setMood('ending');
    } else if (state.phase === 'forging') {
      audio.setMood('forge');
    } else {
      audio.setMood(CHAPTER_INFO[state.chapter]?.mood || 'ch1');
    }
  }

  function applyAct(action) {
    audio.unlock();
    const res = dispatchAction(state, action);
    if (!res.ok) {
      audio.sfx('damage');
      showToast(`⚠ ${res.reason}`);
      return;
    }
    state = res.state;
    saveState(state);

    const fx = res.fx || {};
    const newlyUnlocked = recordCompendiumUnlocks(fx.unlockedCompendium || []);

    if (newlyUnlocked.length > 0) {
      audio.sfx('compendium');
      showToast(
        `📖 名剑图鉴新收录：【${newlyUnlocked.join('、')}】（已点亮 ${Object.keys(compendium).length}/${SWORD_COMPENDIUM.length}）！`
      );
    } else {
      if (fx.sound) audio.sfx(fx.sound);
      if (fx.toast) showToast(fx.toast);
    }

    if (fx.visual === 'hammerPerfect') {
      hammerAnimUntil = performance.now() + 140;
      spawnSparks(0.5, 0.56, 38, ['#fff6c4', '#ffbe4f', '#ff7b29'], 1.25);
      triggerShake();
    } else if (fx.visual === 'hammerGood') {
      hammerAnimUntil = performance.now() + 130;
      spawnSparks(0.5, 0.56, 20, ['#ffe29a', '#f09446'], 0.95);
    } else if (fx.visual === 'bladeCrack' || fx.visual === 'bladeBroken') {
      hammerAnimUntil = performance.now() + 150;
      spawnSparks(0.5, 0.56, 30, ['#ff6f59', '#9eb8bf', '#ffd29d'], 1.15);
      triggerShake();
    } else if (fx.visual === 'techSteady' || fx.visual === 'sealQuench') {
      spawnSparks(0.5, 0.56, 30, ['#9bf5e3', '#fff2be', '#7ed0be'], 1.0);
    } else if (fx.visual === 'techFissure') {
      spawnSparks(0.5, 0.56, 34, ['#ff7747', '#ffd685', '#ff4d3d'], 1.25);
      triggerShake();
    } else if (fx.visual === 'slashHit') {
      spawnSlashArc(0.66, 0.48, '#ffe39e');
      spawnSparks(0.66, 0.48, 22, ['#ffe9ad', '#f0a04b'], 1.0);
    } else if (fx.visual === 'staggerBreak') {
      spawnSlashArc(0.66, 0.48, '#7ed0be');
      spawnSparks(0.66, 0.48, 42, ['#fff7c2', '#7ed0be', '#ff9f45'], 1.35);
      triggerShake();
    } else if (fx.visual === 'guardShield' || fx.visual === 'companionAssist' || fx.visual === 'temperGlow') {
      spawnSparks(0.28, 0.55, 22, ['#9ef5e4', '#ffe4a3'], 0.85);
    } else if (fx.visual === 'lampHit') {
      triggerShake();
    } else if (fx.visual === 'relitFinale' || fx.visual === 'celestialFinale') {
      spawnSparks(0.5, 0.45, fx.visual === 'celestialFinale' ? 95 : 65, ['#fff8cf', '#ffd269', '#7ed0be', '#9ef7ff'], 1.55);
    }

    syncAudioMood();
    render();
  }

  function renderTopbar() {
    elTopbar.hidden = screen === 'title';
    if (screen === 'title') return;

    const ch = CHAPTER_INFO[state.chapter];
    const nd = NODES_DATA[state.node];
    const diffBadge = state.difficulty === 'master' ? ' · 宗师' : '';
    elChBadge.textContent = `第${state.chapter}章 · ${ch.name}${diffBadge}`;
    elStationTitle.textContent = `${state.node}/9 ${nd.title}`;
    elCompBtn.textContent = `📖 名剑图鉴 ${Object.keys(compendium).length}/12`;

    const parts = [];
    for (let n = 1; n <= 9; n++) {
      if (n === 4 || n === 7) parts.push('<span class="v8-step-sep"></span>');
      const st = state.completedNodes.includes(n) ? 'done' : n === state.node ? 'current' : 'todo';
      const info = NODES_DATA[n];
      parts.push(
        `<button type="button" class="v8-step-node" data-act="inspect-node" data-node="${n}" data-status="${st}" title="第${n}站 · ${esc(info.title)}：${esc(info.mission)}">${st === 'done' ? '✓' : n}</button>`
      );
    }
    elStepper.innerHTML = parts.join('');
    elCompassBtn.textContent = `🧭 ${computeCompassText()}`;

    const pips = [];
    for (let i = 0; i < state.lampMax; i++) {
      pips.push(`<i class="v8-lamp-pip ${i < state.lamp ? 'is-lit' : ''}"></i>`);
    }
    elLampPill.innerHTML = `<span>🔥 灯火</span><span class="v8-lamp-pips">${pips.join('')}</span><strong>${state.lamp}/${state.lampMax}</strong>`;
    elResPill.innerHTML = `🪙 <b>${state.coins}</b>钱 · 🧱 坯<b>${state.blanks}</b> · ⚡ 技<b>${state.charge}</b>`;
    elMuteBtn.textContent = audio.isMuted() ? '🔇 静音' : `🎵 琴音·${audio.getTrackTitle().slice(0, 2)}`;
  }

  function renderTitleScreen() {
    const unlockedCount = Object.keys(compendium).length;
    const diffCards = Object.values(DIFFICULTY_MODES)
      .map(
        (d) => `
      <button type="button" class="v8-diff-btn ${selectedDifficulty === d.id ? 'is-selected' : ''}" data-act="select-diff" data-diff="${d.id}">
        <strong>${d.id === 'master' ? '🔥 ' : '🏮 '}${esc(d.name)} <span style="opacity:.75;font-size:11px;">(${esc(d.badge)})</span></strong>
        <small>${esc(d.desc)}</small>
      </button>
    `
      )
      .join('');

    const perkCards = DESTINY_PERKS.map(
      (p) => `
      <button type="button" class="v8-perk-card ${selectedPerk === p.id ? 'is-selected' : ''}" data-act="select-perk" data-perk="${p.id}">
        <strong><span>✦ ${esc(p.name)}</span><span>${esc(p.badge)}</span></strong>
        <small>${esc(p.summary)}</small>
      </button>
    `
    ).join('');

    const classicLink = options.showClassicLink
      ? `<a href="/campaign.html" class="v8-icon-btn" style="text-decoration:none;display:inline-flex;align-items:center;">切回 v1.0 经典版</a>`
      : '';

    elStageBody.innerHTML = `
      <div class="v8-title-screen">
        <div class="v8-title-hero">
          <div class="v8-kicker">锤下求生 · 三章九站铸剑战棋 · V8.2 薪火参赛版</div>
          <h1>护炉远行</h1>
          <p class="v8-title-lead">
            绝顶山口的母灯熄了，十二盏山路长灯正一盏盏暗入风雪。<br>
            推起小炉车观火铸剑，收集十二传世名剑图鉴，沿途救齐众人并携神兵登顶，更可引动山下万家烽火开启隐藏真结局【万家薪火 · 剑魄归宗】！
          </p>
          <div class="v8-feature-tags">
            <span>🔥 四档柔阻尼炉温神锻</span>
            <span>📖 12柄传世名剑图鉴 (${unlockedCount}/12)</span>
            <span>🌟 隐藏真结局【万家薪火】</span>
            <span>🎵 四声部国风五声动态编曲</span>
          </div>
          <div class="v8-title-cta-row">
            <button type="button" class="v8-btn is-primary" data-act="start-new-run">
              <span>🔥 推起炉车 · 立誓启程</span>
              <small>${esc(DIFFICULTY_MODES[selectedDifficulty].name)} · 携所选天命出发</small>
            </button>
            ${
              hasSavedRun
                ? `<button type="button" class="v8-btn" data-act="continue-run">
                    <span>📜 继续上次远行</span>
                    <small>第${state.node}站 · ${esc(NODES_DATA[state.node].title)}（灯火 ${state.lamp}/${state.lampMax}）</small>
                  </button>`
                : ''
            }
            <button type="button" class="v8-btn" data-act="open-compendium">
              <span>📖 传世名剑图鉴 (${unlockedCount}/12)</span>
              <small>查看名剑诗铭与跨周目加成</small>
            </button>
            <button type="button" class="v8-btn" data-act="open-presets">
              <span>⚡ 赛事评委演武台</span>
              <small>含隐藏真结局一键冲刺切片</small>
            </button>
            <button type="button" class="v8-icon-btn" data-act="open-mixer">🎚️ 音律试听台</button>
            ${classicLink}
          </div>
        </div>

        <aside class="v8-perk-panel">
          <h3>⚖️ 选择赛事难度曲线</h3>
          <div class="v8-diff-row">${diffCards}</div>
          <h3>🔥 择一「先天天命炉火」启程</h3>
          ${perkCards}
        </aside>
      </div>
    `;
  }

  function renderPrologueOverlay() {
    elStageBody.innerHTML = `
      <div class="v8-choice-stage">
        <div class="v8-scroll-box">
          <h2>📜 护炉立誓 · 三章远行要诀</h2>
          <p>母灯在绝顶山口熄灭，你们推着唯一灯芯与随行小炉车踏入夜路。出发前只记这三件事：</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">
            <div style="padding:10px;background:rgba(255,255,255,0.58);border-radius:7px;border-left:3px solid #c96428;">
              <strong>① 柔速观火与名剑图鉴</strong>
              <div style="font-size:12.5px;margin-top:4px;color:#4f3c26;">瞄准金焰甜区落锤攒星火暴击（可随时切换柔和慢火），收集 12 柄传世名剑永久拓宽甜区！</div>
            </div>
            <div style="padding:10px;background:rgba(255,255,255,0.58);border-radius:7px;border-left:3px solid #236e5c;">
              <strong>② 破势断招与居合易剑</strong>
              <div style="font-size:12.5px;margin-top:4px;color:#4f3c26;">对红光蓄力敌造成≥${getStaggerThreshold(state)}伤可【破势清零压力】；每战首次按 Q 换剑 0 行动且+1伤！</div>
            </div>
            <div style="padding:10px;background:rgba(255,255,255,0.58);border-radius:7px;border-left:3px solid #8a622e;">
              <strong>③ 隐藏真结局【万家薪火】</strong>
              <div style="font-size:12.5px;margin-top:4px;color:#4f3c26;">救摆渡人+全救双驿+留恒温环，并携≥6强度自铸剑与≥5灯火登顶，即可引动万家烽火共鸣！</div>
            </div>
          </div>
          <button type="button" class="v8-choice-btn" data-act="dismiss-prologue" style="text-align:center;background:#3a2816;color:#ffe6b3;border-color:#d6a456;">
            <strong style="color:#ffe6b3;">🔥 我记住了 · 奏响琴音点亮炉火！</strong>
          </button>
        </div>
      </div>
    `;
  }

  function renderPrepareStage() {
    if (state.choice === 'camp-old-sword') {
      renderChoiceStage();
      return;
    }

    const nd = NODES_DATA[state.node];
    const comp = COMPANIONS[nd.speaker] || COMPANIONS.alan;
    const upgraded = isCompanionUpgraded(state, comp.id);

    const briefEncIds =
      state.node === 4 || state.node === 5
        ? ['n5-north', 'n5-south']
        : [{ 1: 'n1', 2: 'n2', 3: 'n3-main', 6: 'n6', 7: 'n7', 8: 'n8', 9: 'n9' }[state.node]];

    const sampleTargets = briefEncIds
      .flatMap((id) => getEncounterSpec(state, id).targets)
      .filter((t) => t.health > 0);

    const hand = getWeapon(state, state.handId);
    const targetCards = sampleTargets
      .map((t) => {
        const normalHit = hand && isWeaponUsable(hand) ? computePreviewHit(hand, t, false) : null;
        const guardHit = hand && isWeaponUsable(hand) ? computePreviewHit(hand, t, true) : null;
        const peakP = t.pressures.length ? Math.max(...t.pressures) : 0;
        return `
          <div class="v8-scout-target">
            <img src="${art(t.artKey)}" alt="${esc(t.name)}">
            <div>
              <b>${esc(t.name)}</b>
              <small>耐久 ${t.health} · 护甲 ${t.armor}${peakP ? ` · 峰值压力 ${peakP}` : ' · 道路机关'}</small>
              <small style="color:#ffe0a3;">
                ${
                  normalHit !== null
                    ? `主手直斩 <b>${normalHit}</b> 伤 / 架剑破绽斩 <b>${guardHit}</b> 伤`
                    : '⚠ 主手暂无可用兵刃，请换剑或开炉'
                }
              </small>
            </div>
          </div>
        `;
      })
      .join('');

    let campStrip = '';
    if (nd.campAvailable) {
      const coalGain = state.perk === 'eternal_wick' ? 4 : 3;
      campStrip = `
        <div class="v8-inline-shop">
          <span style="color:var(--v8-gold);font-family:var(--v8-serif);font-weight:700;">🏕️ 杜伯炉边摊（余 ${state.coins} 钱）：</span>
          <button type="button" class="v8-icon-btn" data-act="shop" data-item="coal" ${state.coins < 2 || state.lamp >= state.lampMax ? 'disabled' : ''}>🔥 2钱添煤 (+${coalGain}灯火)</button>
          <button type="button" class="v8-icon-btn" data-act="shop" data-item="blank" ${state.coins < 2 || state.blanks >= 4 ? 'disabled' : ''}>🧱 2钱购铁坯</button>
          ${
            state.tool && state.tool.level === 1 && !state.upgradeUsed
              ? `<button type="button" class="v8-icon-btn is-accent" data-act="shop" data-item="upgrade" ${state.coins < 4 ? 'disabled' : ''}>⚡ 4钱升二阶${state.tool.kind === 'rebound' ? '回锋齿' : '崩炉钉'}</button>`
              : ''
          }
          ${
            state.tool
              ? `<button type="button" class="v8-icon-btn" data-act="shop" data-item="exchange" ${state.coins < 2 ? 'disabled' : ''}>🔄 2钱互换奇器</button>`
              : ''
          }
        </div>
      `;
    }

    const noEligibleOn9 =
      state.node === 9 && ![state.handId, state.reserveId].some((id) => isFinalEligible(getWeapon(state, id)));
    const sec = getSecretEndingStatus(state);

    elStageBody.innerHTML = `
      <div class="v8-prepare-view">
        <div class="v8-companion-stage">
          <img class="v8-companion-img" src="${art(comp.fullArt)}" alt="${esc(comp.name)}">
          <div class="v8-speech-card">
            <b>${esc(comp.name)} · ${esc(comp.role)} ${upgraded ? '✦羁绊已升阶' : ''}</b>
            <p>“${esc(nd.line)}”</p>
          </div>
        </div>

        <div class="v8-scout-panel">
          <div class="v8-scout-header">
            <div>
              <small style="color:var(--v8-gold);">${esc(nd.placeTag)} · ${esc(DIFFICULTY_MODES[state.difficulty]?.name || '寻常行旅')}</small>
              <h2>第${state.node}站 · ${esc(nd.title)}</h2>
            </div>
            <span class="v8-ch-badge">${esc(nd.nextHint)}</span>
          </div>
          <p style="margin:0 0 10px;font-size:13.5px;color:#e3e9e2;">${esc(nd.mission)}</p>
          <div class="v8-scout-grid">${targetCards}</div>
          <div class="v8-causal-tip">
            <strong>🔗 本站因果与真结局契机 (${sec.metCount}/3)：</strong>${esc(nd.causalPromise)}
          </div>
          ${
            noEligibleOn9
              ? `<div class="v8-causal-tip" style="border-left-color:var(--v8-crimson);background:rgba(242,109,91,0.16);color:#ffd5ce;">
                  <strong>⚠ 终局献剑提醒：</strong>母灯只接受你<strong>亲手锻造</strong>的合格剑（完好强度≥3 或 崩纹强度≥1）。
                  ${
                    state.blanks > 0
                      ? '你还有未用铁坯，请立即点击下方【开炉铸剑】打造终局名剑！'
                      : `<button type="button" class="v8-icon-btn is-accent" data-act="emergency-blank" style="margin-left:8px;">🔥 拆炉车护板应急取1铁坯 (-1灯火)</button>`
                  }
                </div>`
              : ''
          }
          ${campStrip}
        </div>
      </div>
    `;
  }

  function computePreviewHit(w, t, guarded) {
    const fakeState = {
      ...state,
      encounter: {
        round: 1,
        opening: guarded || state.perk === 'vanguard_edge',
        openingBonusDmg: state.perk === 'vanguard_edge' && !guarded ? 1 : 0,
        swapBuff: false,
        duTempPower: 0,
      },
    };
    const res = computeStrikePreview(fakeState, w, t);
    return res ? res.damage : 0;
  }

  function renderForgeStage() {
    const fw = getWeapon(state, state.forgeId);
    if (!fw) return;

    const bounds = sweetBounds();
    const archInfo = BLADE_ARCHETYPES[fw.archetype] || BLADE_ARCHETYPES.jian;
    const bladeImgKey =
      fw.hits === 0 ? 'stage_0' : fw.hits === 1 ? 'stage_1' : fw.hits === 2 ? 'stage_2' : archInfo.artKey;

    const previewBlade = { ...fw, quench: selectedQuench, sealedStrength: fw.strength };
    const matchedEntry = SWORD_COMPENDIUM.find((e) => e.id !== 'special_celestial' && e.match(previewBlade));
    const alreadyInBook = matchedEntry ? !!compendium[matchedEntry.id] : false;

    const riskText =
      fw.hits >= 6
        ? '六锤已满 · 请立即淬火收锻'
        : fw.hits < 3
        ? `安全锻打期（第 ${fw.hits + 1}/3 锤零裂纹风险）`
        : `险锤期（基础裂率 ${fw.cracked ? '32%再裂' : '18%首裂'} · 金焰甜区裂率减半！）`;

    const speedBtns = Object.values(HEAT_SPEED_MODES)
      .map(
        (m) => `
      <button type="button" class="v8-speed-pill ${heatSpeedMode === m.id ? 'is-active' : ''}" data-act="set-heat-speed" data-speed="${m.id}">
        ${esc(m.label)}
      </button>
    `
      )
      .join('');

    const archSelector =
      fw.hits === 0
        ? `<div class="v8-archetype-bar">
            ${Object.values(BLADE_ARCHETYPES)
              .map(
                (a) => `
              <button type="button" class="v8-arch-pill ${fw.archetype === a.id ? 'is-active' : ''}" data-act="set-archetype" data-arch="${a.id}">
                🗡️ ${esc(a.name)} <span style="opacity:.8;">(${esc(a.passive)})</span>
              </button>
            `
              )
              .join('')}
          </div>`
        : `<div style="font-size:12.5px;color:#ffe2a6;">
            当前器型：<b>${esc(archInfo.name)}</b> · 极温好锤 <b>${fw.perfectHits}</b> 记
            ${
              matchedEntry
                ? ` · 预计成器名剑：<b style="color:var(--v8-jade);">【${esc(matchedEntry.name)}】${alreadyInBook ? '(已入谱)' : '(★新图鉴!)'}</b>`
                : ''
            }
          </div>`;

    const quenchBar = `
      <div class="v8-quench-bar">
        <span style="font-size:12px;color:var(--v8-muted);">收锻淬火铭文：</span>
        ${Object.values(QUENCH_TRAITS)
          .map((q) => {
            const testMatch = SWORD_COMPENDIUM.find((e) => !e.id.startsWith('special_') && e.match({ ...fw, quench: q.id }));
            const isNew = testMatch && !compendium[testMatch.id];
            return `
              <button type="button" class="v8-quench-chip ${selectedQuench === q.id ? 'is-active' : ''}" data-act="select-quench" data-quench="${q.id}" title="${esc(q.desc)}">
                <img src="${art(q.artKey)}" alt="">
                <span>${esc(q.name)}${isNew ? ' <b style="color:#ffd86b;">[新图鉴]</b>' : ''}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;

    elStageBody.innerHTML = `
      <div class="v8-forge-view">
        <div class="v8-heat-hud">
          <div class="v8-heat-top">
            <span>🔥 <b>柔阻尼炉温仪</b> · ${esc(riskText)}</span>
            <span class="v8-speed-pills">
              <span style="color:var(--v8-muted);font-size:11px;">炉风速度：</span>
              ${speedBtns}
            </span>
          </div>
          <div class="v8-heat-track">
            <div class="v8-sweet-zone" style="left:${bounds.start * 100}%;width:${(bounds.end - bounds.start) * 100}%;"></div>
            <div class="v8-heat-cursor" id="v8-heat-cursor" style="left:${(heatSpeedMode === 'auto' ? (bounds.start + bounds.end) * 0.5 : heatPos) * 100}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--v8-muted);margin-top:4px;">
            <span>暗铁偏冷</span>
            <span>橙火稳锻 (+1强度)</span>
            <span style="color:#ffe28a;font-weight:700;">★ 金焰甜区 · 星火 <b style="color:#ffd86b;">${'★'.repeat(fw.stars)}${'☆'.repeat(Math.max(0, 2 - fw.stars))}</b>${compendiumBonusWidth() > 0 ? ` (图鉴拓宽+${Math.round(compendiumBonusWidth() * 100)}%)` : ''}</span>
            <span>赤炭余温</span>
          </div>
        </div>

        ${archSelector}

        <div class="v8-anvil-zone" data-act="anvil-strike" title="点击剑坯或按空格键在金焰甜区落锤！">
          <img class="v8-anvil-blade" src="${art(bladeImgKey)}" alt="在锻剑坯">
          <img class="v8-anvil-hammer ${performance.now() < hammerAnimUntil ? 'is-striking' : ''}" id="v8-hammer-img" src="${art('hammer')}" alt="">
          <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:13px;color:#ffe7b5;background:rgba(6,16,22,0.84);padding:3px 12px;border-radius:999px;border:1px solid rgba(243,200,120,0.4);">
            当前强度 <b style="font-size:17px;color:#ffd86b;">${fw.strength}</b> · 已落锤 <b>${fw.hits}/6</b>
            ${fw.fissureMarked ? ' · ⚡已刻崩纹' : fw.cracked ? ' · ⚠刃有首裂' : ' · ✓刃体完好'}
            （点击剑身或按 Space 落锤）
          </div>
        </div>

        ${quenchBar}
      </div>
    `;
  }

  function renderEncounterStage() {
    const e = state.encounter;
    if (!e) return;
    const p = computePressureSummary(state);
    const hand = getWeapon(state, state.handId);
    const breakNeed = getStaggerThreshold(state);

    let topBanner = '';
    if (e.id === 'n9') {
      const dDone = e.targets.some((t) => t.id === 'drive-lock' && t.health === 0);
      const wDone = e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);
      const cDone = state.flags.coreOwner === 'socket';
      const bDone = e.braced;
      const sec = getSecretEndingStatus(state);
      const steps = [
        { label: '① 斩传动锁', done: dDone, next: !dDone },
        { label: '② 停逆转巨轮', done: wDone, next: dDone && !wDone },
        { label: '③ 纳唯一灯芯', done: cDone, next: wDone && !cDone },
        { label: '④ 架稳母灯座', done: bDone, next: wDone && cDone && !bDone },
        { label: sec.canIgniteCelestial ? '🌟 万家薪火真结局' : '⑤ 嵌自铸名剑', done: false, next: wDone && cDone && bDone },
      ];
      topBanner = `
        <div class="v8-ritual-bar">
          <strong style="color:var(--v8-gold);font-family:var(--v8-serif);margin-right:2px;">母灯五步仪 (第${e.round}/${e.roundLimit}轮)：</strong>
          ${steps
            .map(
              (st) =>
                `<span class="v8-ritual-step ${st.done ? 'is-done' : st.next ? 'is-next' : ''}">${st.done ? '✓ ' : ''}${esc(st.label)}</span>`
            )
            .join('')}
          <span style="margin-left:6px;font-size:11.5px;color:${sec.metCount === 3 ? '#9ef7e5' : '#e0d6be'};">
            [真结局契机 ${sec.metCount}/3]
          </span>
        </div>
      `;
    } else {
      topBanner = `
        <div class="v8-battle-banner">
          <strong style="color:var(--v8-gold);font-family:var(--v8-serif);">第 ${e.round} / ${e.roundLimit} 轮</strong>
          <span>敌袭 <b>${p.threatPressure}</b> + 风雪 <b>${p.envPressure}</b> - 援护 <b>${p.reduction}</b> - 护势 <b>${p.block}</b></span>
          <span style="padding:2px 9px;border-radius:999px;background:${p.loss > 0 ? 'rgba(242,109,91,0.25)' : 'rgba(126,208,190,0.22)'};color:${
        p.loss > 0 ? '#ffc4bc' : '#c8fff2'
      };font-weight:700;">
            ${p.loss > 0 ? `预计结束扣 ${p.loss} 灯火` : '✓ 本轮结束灯火无损'}
          </span>
        </div>
      `;
    }

    const bladeArtKey = hand
      ? hand.source === 'inherited'
        ? 'stage_3'
        : BLADE_ARCHETYPES[hand.archetype]?.artKey || 'blade_jian'
      : 'stage_0';

    const buffs = [];
    if (e.opening) buffs.push(`⚡ 破绽穿甲 (+${2 + e.openingBonusDmg}伤 & 无视护甲)`);
    if (e.swapBuff) buffs.push('🗡️ 居合易剑 (+1伤)');
    if (e.duTempPower > 0) buffs.push(`🔥 杜伯鼓风 (+${e.duTempPower}伤)`);
    if (e.block > 0) buffs.push(`🛡 当前护势 ${e.block}`);
    if (e.braced) buffs.push('🏮 母灯底座已架稳');

    const canFollowUp = state.tool && state.tool.kind === 'rebound' && state.tool.stored > 0 && !e.followUpUsed;

    const targetCards = e.targets
      .map((t) => {
        const dead = t.health <= 0;
        const dep = t.requiresDestroyed ? e.targets.find((x) => x.id === t.requiresDestroyed && x.health > 0) : null;
        const locked = !!dep;
        const curP = getTargetRoundPressure(t, e.round);
        const isTelegraph = !dead && t.role === 'threat' && !t.staggered && curP >= 3;
        const preview = !dead && !locked && hand && isWeaponUsable(hand) ? computeStrikePreview(state, hand, t) : null;

        let intentHtml = '';
        if (dead) {
          intentHtml = `<span class="v8-intent-badge">✓ 已破除</span>`;
        } else if (locked) {
          intentHtml = `<span class="v8-intent-badge is-danger">🔒 需先破除「${esc(dep.name)}」</span>`;
        } else if (t.staggered) {
          intentHtml = `<span class="v8-intent-badge is-stagger">💫 已破势眩晕 · 本轮压力清零！</span>`;
        } else if (isTelegraph) {
          intentHtml = `<span class="v8-intent-badge is-danger">🔥 蓄力 ${curP} 压力 · 单击≥${breakNeed}伤【破势断招】!</span>`;
        } else if (t.role === 'threat') {
          intentHtml = `<span class="v8-intent-badge">本轮施加 ${curP} 点压力</span>`;
        } else {
          intentHtml = `<span class="v8-intent-badge">道路机关锁具</span>`;
        }

        let forecastHtml = '';
        if (!dead && !locked) {
          if (preview && e.actions > 0) {
            forecastHtml = `<div class="v8-strike-forecast">
              ⚔️ 点击挥斩：<b>${preview.damage}</b> 伤 ${preview.willKill ? '· 💥直接击破!' : preview.willStagger ? '· ⚡触发破势断招!' : `(余 ${preview.healthAfter} 血)`}
              ${preview.wear > 0 ? ` · 磨刃-${preview.wear}` : ''}
            </div>`;
          } else if (e.actions === 0) {
            forecastHtml = `<div class="v8-strike-forecast" style="opacity:.7;">本轮行动点已用尽</div>`;
          } else {
            forecastHtml = `<div class="v8-strike-forecast" style="color:#ffbcb3;">主手无可用兵刃（可按Q易剑）</div>`;
          }
        }

        const followBtn =
          !dead && !locked && canFollowUp
            ? `<button type="button" class="v8-icon-btn is-accent" data-act="follow-up" data-target="${t.id}" style="margin-top:6px;width:100%;">
                🪃 0行动回锋追斩 (${state.tool.stored} 伤)
              </button>`
            : '';

        return `
          <div class="v8-target-card ${dead ? 'is-dead' : ''} ${locked ? 'is-locked' : ''} ${isTelegraph ? 'is-telegraph' : ''} ${
          t.staggered ? 'is-staggered' : ''
        }" data-act="strike-target" data-target="${t.id}">
            <img class="v8-target-sprite" src="${art(t.artKey)}" alt="${esc(t.name)}">
            <div class="v8-target-name-row">
              <strong>${esc(t.name)}</strong>
              <span class="v8-armor-pill">🛡 甲${t.armor}</span>
            </div>
            <div class="v8-hp-bar"><div class="v8-hp-fill" style="width:${(t.health / Math.max(1, t.maxHealth)) * 100}%;"></div></div>
            <div style="font-size:12px;color:#e8dfc8;">耐久 <b>${t.health}</b> / ${t.maxHealth}</div>
            ${intentHtml}
            ${forecastHtml}
            ${followBtn}
          </div>
        `;
      })
      .join('');

    elStageBody.innerHTML = `
      <div class="v8-encounter-view">
        ${topBanner}
        <div class="v8-arena-grid">
          <div class="v8-hero-stance ${e.block > 0 ? 'is-guarded' : ''}">
            ${
              hand && isWeaponUsable(hand)
                ? `<img class="v8-hero-blade-img" src="${art(bladeArtKey)}" alt="${esc(hand.name)}">
                   <div style="margin-top:8px;font-family:var(--v8-serif);font-size:17px;color:#ffe3ab;">${esc( formatWeaponTitle(hand) )} · 强度 ${hand.strength}</div>
                   <small style="color:var(--v8-muted);font-size:12px;">${
                     hand.quench ? QUENCH_TRAITS[hand.quench].name : '杜伯传承旧剑'
                   }</small>`
                : `<div style="padding:18px;color:#ffbcb3;font-size:14px;">⚠ 主手空置 · 请点左下 [Q 易剑]</div>`
            }
            <div class="v8-buff-row">
              ${buffs.map((b) => `<span class="v8-buff-tag">${esc(b)}</span>`).join('')}
            </div>
          </div>

          <div class="v8-targets-row">
            ${targetCards}
          </div>
        </div>
      </div>
    `;
  }

  function renderChoiceStage() {
    const cData = CHOICES_DATA[state.choice];
    if (!cData) return;

    const optsHtml = cData.options
      .map(
        (opt) => `
        <button type="button" class="v8-choice-btn" data-act="choose-option" data-choice="${opt.id}">
          <strong>${esc(opt.label)}</strong>
          <div class="v8-choice-meta">
            <span class="v8-tag-imm">即时：${esc(opt.immediate)}</span>
            <span class="v8-tag-causal">因果伏笔：${esc(opt.causal)}</span>
          </div>
        </button>
      `
      )
      .join('');

    elStageBody.innerHTML = `
      <div class="v8-choice-stage">
        <div class="v8-scroll-box">
          <small style="color:#7c582b;font-weight:700;">第${state.node}站 · ${esc(NODES_DATA[state.node].title)} · 因果抉择</small>
          <h2>${esc(cData.title)}</h2>
          <p>${esc(cData.prompt)}</p>
          ${optsHtml}
        </div>
      </div>
    `;
  }

  function renderFailedStage() {
    const canRetry = state.retries[state.chapter] === 0;
    elStageBody.innerHTML = `
      <div class="v8-choice-stage">
        <div class="v8-scroll-box">
          <small style="color:#963d28;font-weight:700;">止步于 第${state.node}站 · ${esc(NODES_DATA[state.node].title)}</small>
          <h2>炉火受阻 · 先把这口火记在心里</h2>
          <p>${esc(state.failure?.text || '风雪太急，队伍暂时受阻。')}</p>
          ${
            canRetry
              ? `<button type="button" class="v8-choice-btn" data-act="retry-chapter">
                  <strong>🔥 从第${state.chapter}章起点重整旗鼓（本章限1次）</strong>
                  <div class="v8-choice-meta"><span class="v8-tag-causal">回到本章补给后状态，重新规划铸剑与战术</span></div>
                </button>`
              : `<p style="color:#8a3b28;font-size:13px;">本章重整机会已用过。</p>`
          }
          <button type="button" class="v8-choice-btn" data-act="accept-failure">
            <strong>📜 接受止步 · 生成本趟远行碑文结算</strong>
            <div class="v8-choice-meta"><span class="v8-tag-imm">保留沿途已救之人与名剑图鉴记录</span></div>
          </button>
        </div>
      </div>
    `;
  }

  function buildRadarSvg(axes, isSecret = false) {
    const cx = 130;
    const cy = 126;
    const rMax = 84;
    const rings = [0.25, 0.5, 0.75, 1.0];
    const angleFor = (idx) => -Math.PI / 2 + (idx * Math.PI * 2) / axes.length;

    const gridPolys = rings
      .map((rk) => {
        const pts = axes
          .map((_, i) => {
            const a = angleFor(i);
            return `${(cx + Math.cos(a) * rMax * rk).toFixed(1)},${(cy + Math.sin(a) * rMax * rk).toFixed(1)}`;
          })
          .join(' ');
        return `<polygon points="${pts}" fill="none" stroke="rgba(214,178,115,0.24)" stroke-width="1"/>`;
      })
      .join('');

    const spokes = axes
      .map((ax, i) => {
        const a = angleFor(i);
        const x2 = cx + Math.cos(a) * rMax;
        const y2 = cy + Math.sin(a) * rMax;
        const lx = cx + Math.cos(a) * (rMax + 26);
        const ly = cy + Math.sin(a) * (rMax + 20);
        return `
          <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(214,178,115,0.25)" stroke-width="1"/>
          <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#fce4b3" font-size="11.5" text-anchor="middle" dominant-baseline="middle">${esc(ax.label)} ${ax.value}</text>
        `;
      })
      .join('');

    const valPts = axes
      .map((ax, i) => {
        const a = angleFor(i);
        const rv = (Math.max(10, ax.value) / 100) * rMax;
        return `${(cx + Math.cos(a) * rv).toFixed(1)},${(cy + Math.sin(a) * rv).toFixed(1)}`;
      })
      .join(' ');

    return `
      <svg viewBox="0 0 260 250" width="100%" style="max-width:290px;display:block;margin:0 auto;">
        ${gridPolys}
        ${spokes}
        <polygon points="${valPts}" fill="${isSecret ? 'rgba(126, 208, 190, 0.36)' : 'rgba(243, 200, 120, 0.32)'}" stroke="${
      isSecret ? '#9ef7e5' : '#ffd875'
    }" stroke-width="2.4"/>
      </svg>
    `;
  }

  function renderEndingStage() {
    const end = state.ending;
    if (!end) return;

    const dw = end.dedicatedWeapon;
    const rubbingHtml = dw
      ? `<div class="v8-rubbing-card">
          <strong style="color:var(--v8-gold);font-family:var(--v8-serif);font-size:16px;">
            🗡️ ${end.isSecret ? '万家共鸣剑魄拓片' : '镇灯名剑拓片'}：【${esc(dw.name)}】
          </strong>
          <div style="font-size:12.5px;color:#e3eadf;margin-top:4px;">
            器型：${esc(dw.archetypeName)} · 淬火：${esc(dw.quenchName)} · 嵌灯强度：<b>${dw.strength}</b>（初成 ${dw.sealedStrength}） · 金焰极温锤：<b>${dw.perfectHits}</b> 记
          </div>
        </div>`
      : '';

    const epiHtml = end.epilogues
      .map(
        (p) => `
        <div class="v8-epi-item">
          <img src="${art(p.art)}" alt="${esc(p.name)}">
          <b style="color:var(--v8-gold);font-family:var(--v8-serif);">${esc(p.name)}</b>
          <div style="margin-top:3px;color:#dce4dd;line-height:1.45;">“${esc(p.line)}”</div>
        </div>
      `
      )
      .join('');

    elStageBody.innerHTML = `
      <div class="v8-ending-view">
        <div class="v8-ending-left ${end.isSecret ? 'is-celestial' : ''}">
          <span class="v8-ch-badge">${esc(end.difficultyName)} · 止于 ${esc(end.stoppedAt)}</span>
          <h1>${esc(end.title)}</h1>
          <p style="font-size:14px;line-height:1.7;color:#e3e8df;margin:0;">${esc(end.summary)}</p>
          ${rubbingHtml}
          <div class="v8-epilogue-grid">${epiHtml}</div>
          <div style="margin-top:12px;font-size:12.5px;color:#c9d9d2;">
            <strong style="color:var(--v8-jade);">🔗 沿途留下的真实因果：</strong>
            <ul style="margin:5px 0 0;padding-left:18px;">
              ${end.causalEchoes.map((line) => `<li>${esc(line)}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="v8-ending-right ${end.isSecret ? 'is-celestial' : ''}" style="text-align:center;">
          <div style="font-size:13px;color:var(--v8-muted);">五维护炉宗师评定 · 已收录名剑 ${Object.keys(compendium).length}/12</div>
          <div style="font-family:var(--v8-serif);font-size:28px;font-weight:700;color:${end.isSecret ? '#9ef7e5' : '#ffe094'};margin:4px 0;">${esc(end.grade)}</div>
          <div style="font-size:12.5px;color:var(--v8-jade);margin-bottom:6px;">综合道韵总评：${end.avgScore} / 100</div>
          ${buildRadarSvg(end.axes, end.isSecret)}
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px;">
            <button type="button" class="v8-btn is-primary" data-act="back-to-title">
              <span>🔥 再启新程（继承名剑图鉴加成）</span>
              <small>尝试其他器型与宗师试炼</small>
            </button>
            <button type="button" class="v8-btn" data-act="open-compendium">
              <span>📖 查阅名剑图鉴 (${Object.keys(compendium).length}/12)</span>
              <small>鉴赏已收录传世神兵</small>
            </button>
            <button type="button" class="v8-btn" data-act="open-presets">
              <span>⚡ 赛事演武跳关</span>
              <small>体验任意章节高潮</small>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderDeck() {
    const hideDeck = screen === 'title' || state.phase === 'ending' || !state.prologueSeen;
    elDeck.hidden = hideDeck;
    if (hideDeck) return;

    const hand = getWeapon(state, state.handId);
    const reserve = getWeapon(state, state.reserveId);
    const anyEligible = [hand, reserve].some((w) => isFinalEligible(w));

    const slotCard = (w, isHand) => {
      const usable = isWeaponUsable(w);
      const elig = isFinalEligible(w);
      const e = state.encounter;
      const freeSwap = state.phase !== 'encounter' || (e && !e.swapUsedFree);
      return `
        <button type="button" class="v8-slot-card ${isHand ? 'is-hand' : ''}" data-act="${isHand ? 'inspect-hand' : 'quick-swap'}" title="${
        isHand ? '点击查看主手剑详情' : '点击或按 Q 切换主副手兵刃'
      }">
          <div class="v8-slot-top">
            <span>${isHand ? '⚔️ 主手 [1]' : `🔄 备用 [Q${freeSwap ? '·0行动' : '·1行动'}]`}</span>
            <span style="color:${elig ? 'var(--v8-jade)' : '#d2b47c'};">${elig ? '🏮可嵌母灯' : usable && w.source === 'inherited' ? '旧剑' : ''}</span>
          </div>
          <span class="v8-slot-name">${esc(usable ? formatWeaponTitle(w) : '空剑位')}</span>
          <div class="v8-slot-meta">
            ${
              usable
                ? `强度 <b>${w.strength}</b>/${w.sealedStrength ?? w.strength} · ${
                    w.fissureMarked ? '⚡崩纹' : w.cracked ? '⚠有裂' : '完好'
                  }`
                : '收锻时可放入新剑'
            }
          </div>
        </button>
      `;
    };

    let toolHtml = '';
    if (state.tool) {
      const isRebound = state.tool.kind === 'rebound';
      const tArt = isRebound ? 'tool_rebound' : 'tool_furnace';
      const tName = `${isRebound ? '回锋齿' : '崩炉钉'}·${state.tool.level === 2 ? '二阶' : '一阶'}`;
      const canTemper =
        !isRebound &&
        state.charge > 0 &&
        hand &&
        isWeaponUsable(hand) &&
        (hand.strength < (hand.sealedStrength || hand.strength) || (state.tool.level === 2 && hand.cracked && !hand.fissureMarked));

      toolHtml = `
        <div class="v8-tool-strip">
          <div style="display:flex;align-items:center;gap:7px;min-width:0;">
            <img src="${art(tArt)}" alt="">
            <div style="min-width:0;">
              <strong style="color:#ffe2a8;display:block;">${esc(tName)}</strong>
              <span style="color:var(--v8-muted);font-size:11px;">
                ${isRebound ? `追斩余力：<b>${state.tool.stored}</b>` : `技火：<b>${state.charge}</b>（破甲杀敌回充）`}
              </span>
            </div>
          </div>
          ${
            canTemper
              ? `<button type="button" class="v8-icon-btn is-accent" data-act="temper-hand">[T] 续炉修剑</button>`
              : `<span style="font-size:11px;color:${anyEligible ? 'var(--v8-jade)' : '#ffbcb3'};">${
                  anyEligible ? '✓母灯剑已备' : '⚠缺自铸剑'
                }</span>`
          }
        </div>
      `;
    } else {
      toolHtml = `
        <div class="v8-tool-strip">
          <span style="color:var(--v8-muted);">📦 随行奇器：第2站断桥领取</span>
          <span style="color:${anyEligible ? 'var(--v8-jade)' : '#ffd29d'};font-weight:600;">
            ${anyEligible ? '🏮 自铸剑已备妥' : '🏮 需打1柄自铸剑'}
          </span>
        </div>
      `;
    }
    elColRack.innerHTML = `<div class="v8-rack-row">${slotCard(hand, true)}${slotCard(reserve, false)}</div>${toolHtml}`;

    renderCenterCommands();

    const e = state.encounter;
    const assistHtml = Object.values(COMPANIONS)
      .map((c) => {
        const up = isCompanionUpgraded(state, c.id);
        const canUse = state.phase === 'encounter' && e && !e.companionUsed;
        return `
          <button type="button" class="v8-assist-btn" data-act="companion-assist" data-comp="${c.id}" ${
          canUse ? '' : 'disabled'
        } title="${esc(up ? c.upgradedDesc : c.baseDesc)}">
            <b>${esc(c.name)}·${esc(c.skillName.slice(2))}</b>
            <span>${up ? '✦升阶·0行动' : '0行动协战'}</span>
          </button>
        `;
      })
      .join('');

    const logsHtml = state.logs
      .slice(0, 5)
      .map((l) => `<div>${esc(l)}</div>`)
      .join('');

    elColAssist.innerHTML = `
      <div class="v8-assist-row">${assistHtml}</div>
      <div class="v8-log-box">${logsHtml}</div>
    `;
  }

  function renderCenterCommands() {
    if (state.phase === 'prepare') {
      const firstForge = state.node === 1 && state.stats.totalForged === 0;
      elColCmd.innerHTML = `
        <div class="v8-ap-row">
          <span>📍 当前阶段：<b>炉车整备</b>（阅读、调音与换剑不耗回合）</span>
        </div>
        <div class="v8-cmd-buttons">
          <button type="button" class="v8-btn ${firstForge ? 'is-primary' : ''}" data-act="begin-forge" ${state.blanks <= 0 ? 'disabled' : ''}>
            <span>🔥 开炉铸剑 [F]</span>
            <small>耗1铁坯（余 ${state.blanks}）· 收集名剑图鉴</small>
          </button>
          <button type="button" class="v8-btn ${!firstForge ? 'is-primary' : ''}" data-act="depart">
            <span>⚔️ ${state.node === 9 ? '登台修复母灯' : '推车拔剑启程'} [Space]</span>
            <small>${esc(NODES_DATA[state.node].title)}</small>
          </button>
        </div>
      `;
      return;
    }

    if (state.phase === 'forging') {
      const fw = getWeapon(state, state.forgeId);
      const canTech = fw && fw.hits < 6 && state.charge > 0;
      const canSeal = fw && fw.hits > 0 && fw.strength > 0;
      elColCmd.innerHTML = `
        <div class="v8-ap-row">
          <span>🔥 瞄准上方<b>金焰甜区</b>落锤 · 技火剩余 <b>${state.charge}</b> 次</span>
        </div>
        <div class="v8-cmd-buttons">
          <button type="button" class="v8-btn is-primary" data-act="anvil-strike" ${!fw || fw.hits >= 6 ? 'disabled' : ''}>
            <span>🔨 观火落锤 [Space]</span>
            <small>${fw && fw.hits < 3 ? '安全锤 +1~2强度' : '险锤冲神兵强度'}</small>
          </button>
          <button type="button" class="v8-btn" data-act="forge-tech" data-kind="steady" ${!canTech ? 'disabled' : ''}>
            <span>✨ 定线固刃 [2]</span>
            <small>耗1技火 · 稳+1强度且修裂</small>
          </button>
          <button type="button" class="v8-btn" data-act="forge-tech" data-kind="fissure" ${!canTech || fw?.fissureMarked ? 'disabled' : ''}>
            <span>⚡ 刻入崩纹 [3]</span>
            <small>耗1技火 · 强度+${fw?.cracked ? 2 : 3} 穿甲刃</small>
          </button>
          <button type="button" class="v8-btn ${fw && fw.hits >= 3 ? 'is-primary' : ''}" data-act="seal-forge" data-slot="hand" ${!canSeal ? 'disabled' : ''}>
            <span>🗡️ 淬火收至主手 [Enter]</span>
            <small>附「${esc(QUENCH_TRAITS[selectedQuench].short)}」剑铭</small>
          </button>
          <button type="button" class="v8-btn" data-act="seal-forge" data-slot="reserve" ${!canSeal ? 'disabled' : ''}>
            <span>📦 收至备用</span>
            <small>留作双剑切换</small>
          </button>
        </div>
      `;
      return;
    }

    if (state.phase === 'encounter' && state.encounter) {
      const e = state.encounter;
      const p = computePressureSummary(state);
      const firstAlive = e.targets.find(
        (t) => t.health > 0 && (!t.requiresDestroyed || e.targets.some((x) => x.id === t.requiresDestroyed && x.health === 0))
      );
      const wheelStopped = e.id === 'n9' && e.targets.some((t) => t.id === 'reverse-wheel' && t.health === 0);

      const mechBtns = [];
      if (e.id === 'n2' || e.id === 'n5-south' || e.id === 'n8') {
        const cutId = e.id === 'n2' ? 'bridge-rope' : e.id === 'n5-south' ? 'south-rope' : 'relay-rope';
        const req = getCutRequirement(state, cutId);
        const hand = getWeapon(state, state.handId);
        const ok = e.actions >= 1 && hand && isWeaponUsable(hand) && !hand.cracked && hand.strength >= req;
        mechBtns.push(`
          <button type="button" class="v8-btn" data-act="mech" data-kind="cut" ${ok ? '' : 'disabled'}>
            <span>✂️ 利刃切索 [3]</span>
            <small>需完好剑≥${req}强度 · 零磨损秒开</small>
          </button>
        `);
      }
      if ((e.id === 'n5-north' || e.id === 'n5-south') && state.flags.ferrymanSaved && !state.flags.ferryAssistUsed) {
        mechBtns.push(`
          <button type="button" class="v8-btn is-primary" data-act="mech" data-kind="ferryAssist">
            <span>🚣 摆渡人牵索 [0行动]</span>
            <small>昔日救人因果 · 直接开门！</small>
          </button>
        `);
      }
      if (e.id === 'n6') {
        const reserve = getWeapon(state, state.reserveId);
        const hand = getWeapon(state, state.handId);
        const bestDonate =
          reserve && isWeaponUsable(reserve) && reserve.strength >= 3
            ? reserve
            : hand && isWeaponUsable(hand) && hand.strength >= 3
            ? hand
            : null;
        mechBtns.push(`
          <button type="button" class="v8-btn" data-act="open-shelter-donate" ${bestDonate && e.actions >= 1 ? '' : 'disabled'}>
            <span>🗡️ 献剑撑梁 [3]</span>
            <small>献强度≥3剑直接过关</small>
          </button>
        `);
      }
      if (e.id === 'n7' && !e.alanGuard) {
        const reserve = getWeapon(state, state.reserveId);
        const ok = reserve && isWeaponUsable(reserve) && reserve.strength >= 3 && e.actions >= 1;
        mechBtns.push(`
          <button type="button" class="v8-btn" data-act="mech" data-kind="donateAlan" ${ok ? '' : 'disabled'}>
            <span>🛡 交备用剑给阿岚</span>
            <small>本场每轮总压力 -2</small>
          </button>
        `);
      }
      if (e.id === 'n8' && (state.flags.crossingHeld || (state.flags.southSaved && state.flags.ring === 'left'))) {
        mechBtns.push(`
          <button type="button" class="v8-btn is-primary" data-act="mech" data-kind="useSideRoute" ${e.actions >= 1 ? '' : 'disabled'}>
            <span>🏮 借侧路接应开山 [3]</span>
            <small>因果兑现 · 免战直通山口！</small>
          </button>
        `);
      }
      if (e.id === 'n9') {
        if (state.flags.coreOwner !== 'socket') {
          mechBtns.push(`
            <button type="button" class="v8-btn is-primary" data-act="mech" data-kind="placeCore" ${e.actions >= 1 ? '' : 'disabled'}>
              <span>🏮 安放唯一灯芯 [3]</span>
              <small>耗1行动放入母灯座</small>
            </button>
          `);
        }
        if (state.flags.carrier === 'player' && wheelStopped && !e.braceAssistUsed && !e.braced) {
          mechBtns.push(`
            <button type="button" class="v8-btn is-primary" data-act="mech" data-kind="assistBrace">
              <span>🤝 阿禾免费扶稳 [0行动]</span>
              <small>立即置为架稳态！</small>
            </button>
          `);
        }
        if (wheelStopped && state.flags.coreOwner === 'socket') {
          const hand = getWeapon(state, state.handId);
          const canIgnite = e.braced && isFinalEligible(hand) && e.actions >= 1;
          const sec = getSecretEndingStatus(state);
          if (sec.canIgniteCelestial) {
            mechBtns.push(`
              <button type="button" class="v8-btn is-celestial" data-act="mech" data-kind="celestialIgnite" ${canIgnite ? '' : 'disabled'}>
                <span>🌟 万家薪火 · 剑魄归宗！</span>
                <small>${e.braced ? '开启隐藏真结局（十二灯与万家共鸣）' : '请先架稳底座'}</small>
              </button>
            `);
          } else {
            mechBtns.push(`
              <button type="button" class="v8-btn is-primary" data-act="mech" data-kind="ignite" ${canIgnite ? '' : 'disabled'}>
                <span>🌕 献剑复明母灯！</span>
                <small>${e.braced ? '嵌入主手自铸剑达成结局' : '请先架稳底座'}</small>
              </button>
            `);
          }
        }
      }

      elColCmd.innerHTML = `
        <div class="v8-ap-row">
          <span>行动火印：<b style="color:var(--v8-gold);letter-spacing:2px;">${'◆'.repeat(e.actions)}${'◇'.repeat(Math.max(0, 2 - e.actions))}</b> (${e.actions}/2)</span>
          <span style="font-size:12px;color:var(--v8-muted);">快捷键：[1]挥斩 [2]架剑 [Q]0行动易剑 [Space]结束本轮</span>
        </div>
        <div class="v8-cmd-buttons">
          ${
            firstAlive
              ? `<button type="button" class="v8-btn ${e.actions > 0 ? 'is-primary' : ''}" data-act="strike-target" data-target="${firstAlive.id}" ${
                  e.actions < 1 || !isWeaponUsable(getWeapon(state, state.handId)) ? 'disabled' : ''
                }>
                  <span>⚔️ 挥斩${esc(firstAlive.name)} [1]</span>
                  <small>耗1行动 · 点上方卡片可选目标</small>
                </button>`
              : ''
          }
          <button type="button" class="v8-btn" data-act="guard" ${e.actions < 1 || e.guarded ? 'disabled' : ''}>
            <span>🛡 ${wheelStopped ? '架稳母灯 [2]' : '架剑蓄破 [2]'}</span>
            <small>护势+3~6 · 下斩无视护甲且加伤</small>
          </button>
          ${mechBtns.join('')}
          <button type="button" class="v8-btn ${e.actions === 0 ? 'is-primary' : ''}" data-act="end-round">
            <span>🌙 结束本轮 [Space]</span>
            <small>${p.loss > 0 ? `结算风雪 · 灯火-${p.loss}` : '无损进入下一轮'}</small>
          </button>
        </div>
      `;
      return;
    }

    elColCmd.innerHTML = `<div class="v8-ap-row"><span>请在上方卷轴中作出选择以继续远行</span></div>`;
  }

  function openCompendiumModal() {
    const unlockedCount = Object.keys(compendium).length;
    const bonusPct = Math.round(compendiumBonusWidth() * 100);
    const cards = SWORD_COMPENDIUM.map((entry) => {
      const rec = compendium[entry.id];
      const unlocked = !!rec;
      const tierColor = entry.tier === '传世绝响' ? '#9ef7e5' : entry.tier === '神兵' ? '#ffd86b' : '#f0cda0';
      return `
        <div class="v8-comp-card ${unlocked ? 'is-unlocked' : 'is-locked'}">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;">
            <span style="color:${tierColor};font-weight:700;">✦ ${esc(entry.tier)}</span>
            <span style="color:${unlocked ? 'var(--v8-jade)' : 'var(--v8-muted)'};">
              ${unlocked ? `✓ 已收录 (最高 ${rec.maxStrength} 强)` : '🔒 待铸造'}
            </span>
          </div>
          <img src="${art(entry.artKey)}" alt="${esc(entry.name)}">
          <strong style="font-family:var(--v8-serif);font-size:16.5px;color:${unlocked ? '#ffe6b3' : '#95a6a0'};">
            ${unlocked ? esc(entry.name) : `？？？ · ${esc(entry.name.slice(-2))}`}
          </strong>
          <div style="font-size:12px;color:#cbd8d1;line-height:1.45;">条件：${esc(entry.condition)}</div>
          <div style="font-size:11.5px;font-style:italic;color:${unlocked ? '#f3c878' : '#7b8c86'};margin-top:auto;">
            “${unlocked ? esc(entry.poem) : '炉火未至，剑铭隐于玄铁之中……'}”
          </div>
        </div>
      `;
    }).join('');

    openModal(
      `📖 铸剑百炼录 · 传世名剑图鉴（已收录 ${unlockedCount} / ${SWORD_COMPENDIUM.length}）`,
      `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:rgba(126,208,190,0.12);border:1px solid rgba(126,208,190,0.35);margin-bottom:12px;">
        <div>
          <strong style="color:#d6fff5;">🔥 图鉴跨周目永久加持：</strong>
          <span style="font-size:13px;color:#e3ece8;">
            当前金焰甜区拓宽 <b>+${bonusPct}%</b>（每收录3柄+2%） · 初始铜钱加成 <b>+${unlockedCount >= 6 ? 1 : 0}</b>（收录满6柄激活）
          </span>
        </div>
        ${
          unlockedCount < SWORD_COMPENDIUM.length
            ? `<button type="button" class="v8-icon-btn is-accent" data-act="unlock-demo-compendium">✨ 评委一键预览全图鉴</button>`
            : `<span class="v8-ch-badge">✦ 十二名剑圆满入谱</span>`
        }
      </div>
      <div class="v8-compendium-grid">${cards}</div>
      `
    );
  }

  function openMixerModal() {
    const curTrack = audio.getManualTrack();
    const bgmPct = Math.round(audio.getBgmVolume() * 100);
    const sfxPct = Math.round(audio.getSfxVolume() * 100);

    const trackBtns = [
      `<button type="button" class="v8-arch-pill ${curTrack === 'auto' ? 'is-active' : ''}" data-act="set-bgm-track" data-track="auto">🔄 随章节场景自动切换</button>`,
      ...BGM_TRACKS.map(
        (t) => `
        <button type="button" class="v8-arch-pill ${curTrack === t.id ? 'is-active' : ''}" data-act="set-bgm-track" data-track="${t.id}">
          🎵 《${esc(t.title)}》<span style="opacity:.75;font-size:11px;">(${esc(t.subtitle)})</span>
        </button>
      `
      ),
    ].join('');

    openModal(
      '🎚️ 国风五声音律台 · 背景配乐与拟真音效试听',
      `
      <div class="v8-slider-row">
        <strong>🎼 国风背景音乐 (BGM) 音量：<span id="v8-bgm-val">${bgmPct}%</span></strong>
        <input type="range" id="v8-bgm-slider" min="0" max="100" value="${bgmPct}">
      </div>
      <div class="v8-slider-row">
        <strong>🔨 铁砧与破势音效 (SFX) 音量：<span id="v8-sfx-val">${sfxPct}%</span></strong>
        <input type="range" id="v8-sfx-slider" min="0" max="100" value="${sfxPct}">
      </div>

      <h4 style="margin:14px 0 8px;color:var(--v8-gold);font-family:var(--v8-serif);font-size:17px;">🎵 五首程序化国风主题原声点播</h4>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;">${trackBtns}</div>

      <h4 style="margin:12px 0 8px;color:var(--v8-gold);font-family:var(--v8-serif);font-size:17px;">🔔 核心物理拟真音效试听板</h4>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button type="button" class="v8-icon-btn is-accent" data-act="test-sfx" data-sfx="hammer_perfect">🔥 金焰极温龙吟锤</button>
        <button type="button" class="v8-icon-btn" data-act="test-sfx" data-sfx="quench">💧 寒泉玄油淬火嘶鸣</button>
        <button type="button" class="v8-icon-btn is-jade" data-act="test-sfx" data-sfx="stagger">⚡ 破势断招青铜重锣</button>
        <button type="button" class="v8-icon-btn" data-act="test-sfx" data-sfx="swap">🗡️ 居合易剑出鞘声</button>
        <button type="button" class="v8-icon-btn" data-act="test-sfx" data-sfx="compendium">📖 名剑入谱仙音</button>
        <button type="button" class="v8-icon-btn is-accent" data-act="test-sfx" data-sfx="relit">🌕 母灯复明编钟合鸣</button>
      </div>
      `
    );

    const bgmSlider = elModalBody.querySelector('#v8-bgm-slider');
    const sfxSlider = elModalBody.querySelector('#v8-sfx-slider');
    if (bgmSlider) {
      bgmSlider.addEventListener('input', (e) => {
        const v = Number(e.target.value) / 100;
        audio.unlock();
        audio.setBgmVolume(v);
        const lbl = elModalBody.querySelector('#v8-bgm-val');
        if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
      });
    }
    if (sfxSlider) {
      sfxSlider.addEventListener('input', (e) => {
        const v = Number(e.target.value) / 100;
        audio.unlock();
        audio.setSfxVolume(v);
        const lbl = elModalBody.querySelector('#v8-sfx-val');
        if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
      });
    }
  }

  function openRoadmapModal(focusNode = state.node) {
    const sec = getSecretEndingStatus(state);
    const secHtml = `
      <div style="padding:12px 14px;border-radius:9px;background:linear-gradient(90deg,rgba(126,208,190,0.16),rgba(243,200,120,0.12));border:1px solid rgba(126,208,190,0.45);margin-bottom:12px;">
        <strong style="color:#d6fff5;font-family:var(--v8-serif);font-size:17px;">🌟 隐藏真结局【万家薪火 · 剑魄归宗】契机进度 (${sec.metCount} / 3)：</strong>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:8px;font-size:12.5px;">
          <div>${sec.benevolenceMet ? '✓' : '◇'} <b>仁心不负</b>：救摆渡人 + 双驿全救 + 留恒温环</div>
          <div>${sec.anyMasterSword ? '✓' : '◇'} <b>神兵镇山</b>：持有强度 ≥ 6 的自铸名剑</div>
          <div>${sec.flameMet ? '✓' : '◇'} <b>长明不灭</b>：终局嵌剑时灯火 ≥ 5（当前 ${state.lamp}）</div>
        </div>
      </div>
    `;

    const rows = Object.values(NODES_DATA)
      .map((n) => {
        const done = state.completedNodes.includes(n.node);
        const cur = n.node === state.node;
        const highlight = n.node === focusNode ? 'border-color:#ffd875;background:rgba(243,200,120,0.13);' : '';
        return `
          <div style="padding:10px 12px;border-radius:8px;border:1px solid rgba(214,178,115,0.25);margin-bottom:8px;${highlight}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#ffe2a6;font-family:var(--v8-serif);font-size:16px;">
                ${done ? '✓' : cur ? '🏮' : '◇'} 第${n.node}站（第${n.chapter}章）· ${esc(n.title)}
              </strong>
              <span style="font-size:12px;color:var(--v8-muted);">${done ? '已走过' : cur ? '当前所在' : '前路待行'}</span>
            </div>
            <div style="font-size:13px;color:#dce4dd;margin-top:3px;">${esc(n.mission)}</div>
            <div style="font-size:12px;color:var(--v8-jade);margin-top:3px;">🔗 ${esc(n.causalPromise)}</div>
          </div>
        `;
      })
      .join('');

    openModal('🗺️ 三章九站 · 薪火因果全图与真结局契机', `${secHtml}<div>${rows}</div>`);
  }

  function openPresetsModal() {
    const cards = JUDGE_PRESETS.map(
      (p) => `
      <button type="button" class="v8-preset-card" data-act="load-preset" data-preset="${p.id}">
        <span class="v8-ch-badge">${esc(p.badge)}</span>
        <strong>${esc(p.title)}</strong>
        <p style="margin:6px 0 0;font-size:12.5px;color:#cbd8d1;line-height:1.5;">${esc(p.desc)}</p>
      </button>
    `
    ).join('');

    openModal(
      '⚡ 赛事评委演武跳关台（含隐藏真结局冲刺）',
      `<p style="margin:0 0 12px;color:#dce4dd;font-size:13.5px;">点击任一演武切片即可载入对应阶段装备与羁绊状态，快速检验数值手感、双剑连斩与【万家薪火】隐藏真结局演出。</p>
       <div class="v8-preset-grid">${cards}</div>`
    );
  }

  function openShelterDonateModal() {
    const candidates = [getWeapon(state, state.handId), getWeapon(state, state.reserveId)].filter(
      (w) => w && isWeaponUsable(w) && w.strength >= 3
    );
    const forgedCount = [getWeapon(state, state.handId), getWeapon(state, state.reserveId)].filter((w) => isFinalEligible(w)).length;

    const btns = candidates
      .map((w) => {
        const warnOnlyForged = w.source === 'forged' && forgedCount <= 1;
        return `
          <button type="button" class="v8-preset-card" data-act="confirm-shelter-donate" data-weapon="${w.id}" style="width:100%;margin-bottom:8px;">
            <strong>献出【${esc(formatWeaponTitle(w))}】（强度 ${w.strength}）撑住炉梁</strong>
            <p style="margin:4px 0 0;font-size:12.5px;color:${warnOnlyForged ? '#ffb8ad' : '#bfeee2'};">
              ${
                warnOnlyForged
                  ? '⚠ 注意：这是你目前唯一合格的自铸剑！若献出它，第7站务必用铁坯再打一柄新剑留给母灯。'
                  : w.source === 'inherited'
                  ? '✓ 推荐：用杜伯旧剑撑梁，完美保住你亲手锻造的主剑冲击隐藏真结局！'
                  : '献出后此剑将永久留在避难炉梁上。'
              }
            </p>
          </button>
        `;
      })
      .join('');

    openModal('🗡️ 选择撑住避难炉危梁的兵刃', btns || '<p>当前没有强度≥3的可用兵刃。</p>');
  }

  function openMenuModal() {
    const canRetry = state.retries[state.chapter] === 0 && state.phase !== 'ending';
    const canEvac = state.lamp > 0 && state.phase !== 'ending';
    const otherDiff = state.difficulty === 'master' ? 'standard' : 'master';
    openModal(
      '📜 炉边歇脚 · 难度微调、行囊与设置',
      `
      <div style="display:grid;gap:10px;">
        <div style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.05);">
          <strong style="color:var(--v8-gold);">当前模式：</strong>${esc(DIFFICULTY_MODES[state.difficulty]?.name || '寻常行旅')}
          · 天命：${esc(DESTINY_PERKS.find((p) => p.id === state.perk)?.name || '百炼成钢')}
          · 名剑图鉴：<b>${Object.keys(compendium).length}/12</b>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button type="button" class="v8-btn" data-act="switch-live-diff" data-diff="${otherDiff}">
            <span>⚖️ 切换为【${esc(DIFFICULTY_MODES[otherDiff].name)}】</span>
            <small>下一场遭遇立即按新数值曲线生效</small>
          </button>
          <button type="button" class="v8-btn" data-act="open-mixer">
            <span>🎚️ 国风音律与音效混音台</span>
            <small>调节BGM/音效音量与试听曲目</small>
          </button>
          <button type="button" class="v8-btn" data-act="open-compendium">
            <span>📖 传世名剑图鉴 (${Object.keys(compendium).length}/12)</span>
            <small>查看名剑诗铭与甜区加成</small>
          </button>
          <button type="button" class="v8-btn" data-act="export-save">
            <span>💾 导出当前旅程 JSON</span>
            <small>备份本趟完整状态</small>
          </button>
          ${
            canRetry
              ? `<button type="button" class="v8-btn" data-act="retry-chapter"><span>🔄 从第${state.chapter}章起点重整</span><small>本章剩余 1 次机会</small></button>`
              : ''
          }
          ${
            canEvac
              ? `<button type="button" class="v8-btn" data-act="evacuate-run"><span>🏮 护送众人与灯芯归乡</span><small>达成【保人归途】结局</small></button>`
              : ''
          }
          <button type="button" class="v8-btn" data-act="back-to-title"><span>⛰️ 返回标题画面</span><small>当前进度已自动保存</small></button>
        </div>
      </div>
      `
    );
  }

  function render() {
    elBackdrop.style.backgroundImage = `url("${art(getSceneBgKey())}")`;
    renderTopbar();

    if (screen === 'title') {
      renderTitleScreen();
    } else if (!state.prologueSeen) {
      renderPrologueOverlay();
    } else if (state.phase === 'prepare') {
      renderPrepareStage();
    } else if (state.phase === 'forging') {
      renderForgeStage();
    } else if (state.phase === 'encounter') {
      renderEncounterStage();
    } else if (state.phase === 'choice') {
      renderChoiceStage();
    } else if (state.phase === 'failed') {
      renderFailedStage();
    } else if (state.phase === 'ending') {
      renderEndingStage();
    }

    renderDeck();
  }

  function onMouseOver(ev) {
    const btn = ev.target instanceof HTMLElement ? ev.target.closest('button[data-act]') : null;
    if (btn && !btn.disabled) {
      audio.sfx('hover');
    }
  }

  function onClick(ev) {
    const target = ev.target instanceof HTMLElement ? ev.target.closest('[data-act]') : null;
    if (!target) return;
    const act = target.dataset.act;
    audio.unlock();

    switch (act) {
      case 'select-perk':
        selectedPerk = target.dataset.perk || 'hundred_refinements';
        audio.sfx('click');
        render();
        break;
      case 'select-diff':
        selectedDifficulty = target.dataset.diff === 'master' ? 'master' : 'standard';
        audio.sfx('click');
        render();
        break;
      case 'switch-live-diff':
        closeModal();
        applyAct({ type: 'setDifficulty', difficulty: target.dataset.diff });
        break;
      case 'start-new-run':
        state = createInitialState(
          `薪火-${Date.now().toString(36)}`,
          selectedPerk,
          false,
          selectedDifficulty,
          Object.keys(compendium).length
        );
        saveState(state);
        screen = 'play';
        syncAudioMood();
        audio.sfx('assist');
        render();
        break;
      case 'continue-run':
        screen = 'play';
        syncAudioMood();
        audio.sfx('assist');
        render();
        break;
      case 'dismiss-prologue':
        applyAct({ type: 'dismissPrologue' });
        break;
      case 'open-roadmap':
        openRoadmapModal(state.node);
        break;
      case 'inspect-node':
        openRoadmapModal(Number(target.dataset.node) || state.node);
        break;
      case 'open-compendium':
        openCompendiumModal();
        break;
      case 'unlock-demo-compendium': {
        const all = {};
        for (const entry of SWORD_COMPENDIUM) {
          all[entry.id] = compendium[entry.id] || { maxStrength: 7, count: 1, chapter: 3 };
        }
        saveCompendium(all);
        audio.sfx('compendium');
        showToast('✨ 已点亮全部 12 柄传世名剑图鉴（金焰甜区永久 +8%）！');
        openCompendiumModal();
        renderTopbar();
        break;
      }
      case 'open-mixer':
        openMixerModal();
        break;
      case 'set-bgm-track':
        audio.setManualTrack(target.dataset.track || 'auto');
        audio.sfx('click');
        openMixerModal();
        renderTopbar();
        break;
      case 'test-sfx':
        audio.sfx(target.dataset.sfx || 'hammer_perfect');
        break;
      case 'open-presets':
        openPresetsModal();
        break;
      case 'load-preset': {
        const pid = target.dataset.preset || 'preset_ch1_forge';
        state = buildPresetState(pid);
        saveState(state);
        // Also record preset forged blades in compendium!
        for (const w of state.weapons) {
          if (w.source === 'forged') {
            const matched = SWORD_COMPENDIUM.filter((e) => e.id !== 'special_celestial' && e.match(w)).map((e) => ({
              id: e.id,
              strength: w.strength,
              chapter: w.madeInChapter,
            }));
            recordCompendiumUnlocks(matched);
          }
        }
        screen = 'play';
        closeModal();
        syncAudioMood();
        audio.sfx('stagger');
        showToast('⚡ 已切入赛事演武切片！');
        render();
        break;
      }
      case 'toggle-audio':
        audio.toggleMute();
        renderTopbar();
        break;
      case 'open-menu':
        openMenuModal();
        break;
      case 'close-modal':
        audio.sfx('click');
        closeModal();
        break;
      case 'pulse-guide':
        audio.sfx('click');
        showToast(`🧭 指引：${computeCompassText()}`);
        break;
      case 'begin-forge':
        applyAct({ type: 'beginForge', archetype: 'jian' });
        break;
      case 'set-archetype':
        applyAct({ type: 'changeArchetype', archetype: target.dataset.arch });
        break;
      case 'select-quench':
        selectedQuench = target.dataset.quench || 'frost';
        audio.sfx('click');
        renderForgeStage();
        renderDeck();
        break;
      case 'set-heat-speed': {
        const mode = target.dataset.speed || 'normal';
        heatSpeedMode = HEAT_SPEED_MODES[mode] ? mode : 'normal';
        audio.sfx('click');
        showToast(`🔥 已切换炉风速度为【${HEAT_SPEED_MODES[heatSpeedMode].label}】`);
        renderForgeStage();
        break;
      }
      case 'anvil-strike':
        applyAct({ type: 'hammer', zone: currentHeatZone() });
        break;
      case 'forge-tech':
        applyAct({ type: 'forgeTech', kind: target.dataset.kind });
        break;
      case 'seal-forge':
        applyAct({ type: 'sealForge', slot: target.dataset.slot || 'hand', quench: selectedQuench });
        break;
      case 'quick-swap':
        applyAct({ type: 'swapSlots' });
        break;
      case 'inspect-hand': {
        const hw = getWeapon(state, state.handId);
        if (hw) {
          openModal(
            `🗡️ 兵刃详览 · ${formatWeaponTitle(hw)}`,
            `<p>当前强度：<b>${hw.strength}</b> / 原收锻强度：<b>${hw.sealedStrength ?? hw.strength}</b></p>
             <p>器型特性：${esc(BLADE_ARCHETYPES[hw.archetype]?.passive || '均衡传承剑')}</p>
             <p>淬火剑铭：${esc(hw.quench ? `${QUENCH_TRAITS[hw.quench].name}（${QUENCH_TRAITS[hw.quench].desc}）` : '无淬火词条（杜伯传承旧剑）')}</p>
             <p>母灯契合：${
               isFinalEligible(hw)
                 ? `<b style="color:var(--v8-jade);">✓ 符合山口母灯嵌入条件${hw.strength >= 6 ? '（且满足≥6强度隐藏真结局神兵门槛！）' : ''}</b>`
                 : '<b style="color:#ffbcb3;">⚠ 不可嵌入母灯（母灯需自铸剑：完好≥3 或 崩纹≥1）</b>'
             }</p>`
          );
        }
        break;
      }
      case 'temper-hand':
        applyAct({ type: 'temper' });
        break;
      case 'depart':
        applyAct({ type: 'depart' });
        break;
      case 'emergency-blank':
        applyAct({ type: 'emergencyBlank' });
        break;
      case 'shop':
        applyAct({ type: 'shop', item: target.dataset.item });
        break;
      case 'choose-option':
        applyAct({ type: 'choose', choice: target.dataset.choice });
        break;
      case 'strike-target':
        if (ev.target instanceof HTMLElement && ev.target.closest('[data-act="follow-up"]')) return;
        applyAct({ type: 'strike', targetId: target.dataset.target });
        break;
      case 'follow-up':
        ev.stopPropagation();
        applyAct({ type: 'followUp', targetId: target.dataset.target });
        break;
      case 'guard':
        applyAct({ type: 'guard' });
        break;
      case 'companion-assist':
        applyAct({ type: 'companionAssist', companionId: target.dataset.comp });
        break;
      case 'mech':
        applyAct({ type: 'mechanism', kind: target.dataset.kind });
        break;
      case 'open-shelter-donate':
        openShelterDonateModal();
        break;
      case 'confirm-shelter-donate':
        closeModal();
        applyAct({ type: 'mechanism', kind: 'donateShelter', weaponId: target.dataset.weapon });
        break;
      case 'end-round':
        applyAct({ type: 'endRound' });
        break;
      case 'retry-chapter':
        closeModal();
        applyAct({ type: 'retryChapter' });
        break;
      case 'evacuate-run':
        closeModal();
        applyAct({ type: 'evacuate' });
        break;
      case 'accept-failure':
        applyAct({ type: 'acceptFailure' });
        break;
      case 'export-save': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `护炉远行-V8.2-${state.seed}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 200);
        showToast('💾 已导出当前旅程 JSON 存档');
        break;
      }
      case 'back-to-title':
        closeModal();
        screen = 'title';
        syncAudioMood();
        render();
        break;
      default:
        break;
    }
  }

  function onKeyDown(ev) {
    if (!elModalWrap.hidden) {
      if (ev.key === 'Escape') closeModal();
      return;
    }
    if (screen !== 'play' || !state.prologueSeen) return;

    audio.unlock();
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (state.phase === 'forging') applyAct({ type: 'hammer', zone: currentHeatZone() });
      else if (state.phase === 'prepare' && !state.choice) applyAct({ type: 'depart' });
      else if (state.phase === 'encounter') applyAct({ type: 'endRound' });
    } else if (ev.key === 'q' || ev.key === 'Q') {
      if (state.phase === 'prepare' || state.phase === 'encounter') applyAct({ type: 'swapSlots' });
    } else if (ev.key === 'f' || ev.key === 'F') {
      if (state.phase === 'prepare') applyAct({ type: 'beginForge', archetype: 'jian' });
    } else if (ev.key === 't' || ev.key === 'T') {
      if (state.phase === 'prepare' || state.phase === 'encounter') applyAct({ type: 'temper' });
    } else if (ev.key === '1' && state.phase === 'encounter' && state.encounter) {
      const t = state.encounter.targets.find(
        (x) => x.health > 0 && (!x.requiresDestroyed || state.encounter.targets.some((d) => d.id === x.requiresDestroyed && d.health === 0))
      );
      if (t) applyAct({ type: 'strike', targetId: t.id });
    } else if (ev.key === '2') {
      if (state.phase === 'encounter') applyAct({ type: 'guard' });
      else if (state.phase === 'forging') applyAct({ type: 'forgeTech', kind: 'steady' });
    } else if (ev.key === '3' && state.phase === 'forging') {
      applyAct({ type: 'forgeTech', kind: 'fissure' });
    } else if (ev.key === 'Enter' && state.phase === 'forging') {
      applyAct({ type: 'sealForge', slot: 'hand', quench: selectedQuench });
    } else if (ev.key === 'Escape') {
      openMenuModal();
    }
  }

  // 60fps Canvas & Smooth Damped Forge Heat Cursor Loop
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
    lastTs = now;

    if (screen === 'play' && state.phase === 'forging') {
      const fw = getWeapon(state, state.forgeId);
      const modeCfg = HEAT_SPEED_MODES[heatSpeedMode] || HEAT_SPEED_MODES.normal;
      if (modeCfg.baseSpeed > 0) {
        // Gentle progressive scaling + soft sine edge damping near 0.06..0.94
        const hitRamp = fw && fw.hits >= 3 ? (fw.hits - 2) * 0.035 : 0;
        const edgeDamp = 0.68 + 0.32 * Math.sin(Math.max(0.08, Math.min(0.92, heatPos)) * Math.PI);
        const speed = (modeCfg.baseSpeed + hitRamp) * edgeDamp;
        heatPos += heatDir * speed * dt;
        if (heatPos >= 0.94) {
          heatPos = 0.94;
          heatDir = -1;
        } else if (heatPos <= 0.06) {
          heatPos = 0.06;
          heatDir = 1;
        }
      }
      const cursorEl = root.querySelector('#v8-heat-cursor');
      if (cursorEl) {
        const b = sweetBounds();
        const shownPos = heatSpeedMode === 'auto' ? (b.start + b.end) * 0.5 : heatPos;
        cursorEl.style.left = `${shownPos * 100}%`;
      }
      const hamEl = root.querySelector('#v8-hammer-img');
      if (hamEl) {
        hamEl.classList.toggle('is-striking', now < hammerAnimUntil);
      }
    }

    const rect = elCanvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(rect.height * dpr));
    if (elCanvas.width !== cw || elCanvas.height !== ch) {
      elCanvas.width = cw;
      elCanvas.height = ch;
    }
    const ctx = elCanvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (Math.random() < 0.34 && particles.length < 100) {
        const isSnow = state.chapter === 2 && state.phase !== 'forging' && state.phase !== 'ending';
        const isCelestial = state.ending?.kind === 'celestial_relit';
        const isForge = state.phase === 'forging' || state.chapter === 3;
        particles.push({
          kind: 'ambient',
          x: Math.random() * rect.width,
          y: isSnow ? -8 : rect.height + 8,
          vx: isSnow ? -26 - Math.random() * 24 : (Math.random() - 0.5) * 20,
          vy: isSnow ? 34 + Math.random() * 32 : -24 - Math.random() * 34,
          life: 3.2 + Math.random() * 2.5,
          maxLife: 5.5,
          size: isSnow ? 1.8 + Math.random() * 2.2 : 1.6 + Math.random() * 2.6,
          color: isCelestial
            ? Math.random() < 0.5
              ? '#9ef7e5'
              : '#ffe082'
            : isSnow
            ? '#dceef2'
            : isForge
            ? '#ffae52'
            : '#f7d88b',
        });
      }

      const alive = [];
      for (const pt of particles) {
        pt.life -= dt;
        if (pt.life <= 0) continue;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.kind === 'spark') pt.vy += 260 * dt;
        const alpha = Math.max(0, Math.min(1, pt.life / (pt.kind === 'spark' ? 0.4 : 1.5)));
        ctx.save();
        ctx.globalAlpha = pt.kind === 'ambient' ? alpha * 0.48 : alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        alive.push(pt);
      }
      particles = alive;

      const liveSlashes = [];
      for (const sl of slashes) {
        sl.life -= dt;
        if (sl.life <= 0) continue;
        const t = sl.life / sl.maxLife;
        ctx.save();
        ctx.globalAlpha = t;
        ctx.strokeStyle = sl.color;
        ctx.lineWidth = 4 * t + 1;
        ctx.shadowColor = sl.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(sl.x, sl.y, 95, 36, -0.52, -1.5, 1.3);
        ctx.stroke();
        ctx.restore();
        liveSlashes.push(sl);
      }
      slashes = liveSlashes;
    }

    rafId = requestAnimationFrame(loop);
  }

  elRoot.addEventListener('mouseover', onMouseOver);
  elRoot.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);
  render();
  rafId = requestAnimationFrame(loop);

  return {
    dispose() {
      if (rafId) cancelAnimationFrame(rafId);
      if (toastTimer) clearTimeout(toastTimer);
      elRoot.removeEventListener('mouseover', onMouseOver);
      elRoot.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      audio.dispose();
      root.innerHTML = '';
    },
  };
}
