import { createGameSession, explainError } from '../application/session.js';
import type { GameSnapshot, Ticket } from '../application/session.js';
import type { PersistentSession } from '../application/persistent-session.js';
import type { Action, HammerMode, RunView } from '../core/index.js';
import { LESSONS } from '../tutorial/lesson.js';
import { bindStrikeInput } from '../platform/input.js';
import type { InputVisual } from '../platform/input.js';
import { loadArt, artImage } from './assets.js';
import type { ArtBundle } from './assets.js';
import { ForgeScene } from './scene.js';
import type { SceneModel } from './scene.js';
import { APP_TEMPLATE } from './template.js';
import { renderPhase } from './phases.js';

const MODES: readonly HammerMode[] = ['light', 'standard', 'heavy'];
const STATUS = { active: '加工中', delivered: '已交货', recycled: '已回收', broken: '已破碎' } as const;
function newIdentity(): string { return [...crypto.getRandomValues(new Uint32Array(4))].map(value => value.toString(16).padStart(8, '0')).join(''); }
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);if (text !== undefined) node.textContent = text;if (className) node.className = className;return node;
}

export function mountGame(root: HTMLElement, port: PersistentSession) {
  root.innerHTML = APP_TEMPLATE;
  const required = <T extends HTMLElement>(selector: string): T => { const node = root.querySelector<T>(selector);if (!node) throw new Error(`Missing view: ${selector}`);return node; };
  const text = (selector: string, value: string | number) => { const node = required(selector);const next = String(value);if (node.textContent !== next) node.textContent = next; };
  const button = (selector: string) => required<HTMLButtonElement>(selector);
  const shell = required('.app-shell');
  const dialog = required<HTMLDialogElement>('#dialog'), strike = button('#strike');
  const game = createGameSession(port, { now: () => performance.now() }, newIdentity);
  let snapshot = game.getSnapshot(), art: ArtBundle | null = null, scene: ForgeScene | null = null, menuScene: ForgeScene | null = null;
  let disposed = false, portReady = false, loadEpoch = 0, modalSequence = 0, feedbackFrame = 0, feedbackId = 0;
  let disposal: Promise<void> | null = null;
  let inputVisual: InputVisual = { preparing: false, mark: 0 }, userReduced = false;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const thumbnailKeys = new Map<string, string>();
  type Modal = { readonly id: number; readonly kind: string; readonly trigger: Element | null; readonly cancel: (() => void) | undefined };
  let modal: Modal | null = null;
  const input = bindStrikeInput(strike, {
    context: () => dialog.open || document.hidden ? null : game.inputContext(),
    release: attempt => { game.strike(attempt); },
    visual: visual => { inputVisual = visual;paintTiming();paintScene(); },
  });

  function restoreFocus(previous: Element | null) {
    queueMicrotask(() => {
      if (disposed || modal) return;
      if (previous instanceof HTMLElement && previous.isConnected && previous.getClientRects().length
        && previous.matches('button,input,select,textarea,a[href],[tabindex]')
        && !(previous instanceof HTMLButtonElement && previous.disabled)) previous.focus({ preventScroll: true });
      else if (snapshot.route !== 'menu' && snapshot.view?.phase === 'workshop' && !strike.disabled) strike.focus({ preventScroll: true });
      else if (snapshot.route === 'menu') button('#new-game').focus({ preventScroll: true });
      else if (snapshot.view?.phase !== 'workshop') required('#phase-title').focus({ preventScroll: true });
      else button('#pause').focus({ preventScroll: true });
    });
  }
  function closeDialog(cancel = true) {
    const previous = modal;modal = null;if (dialog.open) dialog.close();
    if (cancel) previous?.cancel?.();
    queueMicrotask(() => { if (!disposed && !modal) render(game.getSnapshot()); });
    restoreFocus(previous?.trigger ?? null);
  }
  function showDialog(kind: string, title: string, body: Node | string,
    actions: readonly { label: string; primary?: boolean; run: () => void }[], cancel?: () => void) {
    input.cancel();if (modal) closeDialog(false);
    const id = ++modalSequence;modal = { id, kind, trigger: document.activeElement, cancel };
    text('#dialog-title', title);required('#dialog-body').replaceChildren(typeof body === 'string' ? element('p', body) : body);
    const buttons = actions.map(action => {
      const node = element('button', action.label, action.primary ? 'primary' : '');node.type = 'button';
      node.addEventListener('click', () => { if (modal?.id === id) action.run(); });return node;
    });
    required('#dialog-actions').replaceChildren(...buttons);dialog.showModal();
    const field = dialog.querySelector<HTMLInputElement>('input[type=text]');
    if (field) field.focus();else buttons[0]?.focus();
  }
  function confirm(title: string, message: string, label: string, run: () => void) {
    showDialog('confirm', title, message, [
      { label: '取消', run: () => closeDialog() }, { label, primary: true, run: () => { closeDialog(false);run(); } },
    ]);
  }
  function newGame(memory = false, seed = '') {
    input.cancel();const ticket = game.capture(), current = snapshot.port;
    memory = memory || current.mode === 'memory';
    const ongoing = current.state !== null || current.dirty || current.load?.main.status === 'invalid' || current.load?.backup.status === 'valid';
    const form = element('form');form.id = 'new-run-form';
    const label = element('label', '契约种子（留空随机）'), field = element('input');field.type = 'text';field.name = 'seed';field.id = 'seed';field.maxLength = 128;field.autocomplete = 'off';field.value = seed;
    label.append(field);form.append(label, element('p', '相同种子与动作可以重现结果；接受 1–64 个字符。', 'seed-hint'));
    if (memory) form.append(element('p', current.dirty && current.mode !== 'memory' ? '当前还有未保存进度。另开试玩会放弃这份内存进度，但不会改写磁盘契约。'
      : current.mode === 'memory' ? '另开试玩会结束当前试玩，不会改写磁盘契约。返回本机存档需要重新载入页面。'
      : '这份试玩不保存。磁盘上的契约会保留，重新载入页面可回到本机存档。', 'form-warning'));
    else if (ongoing) form.append(element('p', current.state ? `这会以第 1 轮新契约替换当前第 ${current.state.round} 轮进度。取消会保留原契约。`
      : '本机已有契约或备份。这会建立新契约并替换主档；也可以取消，先尝试备份恢复。', 'form-warning'));
    const error = element('p', '', 'form-error');error.setAttribute('role', 'alert');
    const submit = element('button', memory ? '开始不保存试玩' : ongoing ? '覆盖并开始新契约' : '签订新契约', 'primary');submit.type = 'submit';
    form.append(error, submit);
    showDialog('new', memory ? '不保存试玩' : '签订新契约', form, [{ label: '取消', run: () => closeDialog() }]);
    const id = modal?.id;
    form.addEventListener('submit', event => {
      event.preventDefault();if (modal?.id !== id) return;
      const chosenSeed = field.value.trim() ? field.value : newIdentity().slice(0, 16);
      if (game.start({ runId: newIdentity(), seed: chosenSeed }, ticket, ongoing, memory)) { closeDialog(false);intro(); }
      else error.textContent = game.getSnapshot().note;
    });
  }
  function intro() {
    showDialog('intro', '今天，先看订单', '每轮只有三件铁坯。交货才计入当轮订单，金币余额不是订单。\n回收只给废料，商人升级会同时消耗金币和废料。\n少于配额扣一枚契约印记，三枚耗尽才失败。', [
      { label: '先练习一下', run: () => { closeDialog(false);game.practice(); } },
      { label: '开始锻造', primary: true, run: () => { closeDialog(false);render(game.getSnapshot()); } },
    ]);
  }
  function options(fromPause = false) {
    const body = element('div');
    const slowLabel = element('label', undefined, 'check'), slow = element('input');slow.type = 'checkbox';slow.id = 'slow-setting';slow.checked = snapshot.slow;
    slowLabel.append(slow, document.createTextNode('慢速游标 ×1.5（收益不变）'));
    const reduceLabel = element('label', undefined, 'check'), reduce = element('input');reduce.type = 'checkbox';reduce.id = 'motion-setting';reduce.checked = snapshot.reducedMotion;reduce.disabled = motionQuery.matches;
    reduceLabel.append(reduce, document.createTextNode(motionQuery.matches ? '系统已启用减弱动效' : '减弱动效'));
    body.append(slowLabel, reduceLabel, element('p', '空格只在击打区获得焦点时蓄锤。数字 1/2/3 选来料，Q/W/E 换锤，Esc 暂停。'));
    slow.addEventListener('change', () => game.setSlow(slow.checked));
    reduce.addEventListener('change', () => { userReduced = reduce.checked;game.setReducedMotion(userReduced || motionQuery.matches); });
    showDialog('options', '操作设置', body, [{ label: fromPause ? '返回暂停' : '完成', primary: true, run: () => { closeDialog(false);if (fromPause) pauseDialog(); } }], () => { if (fromPause) pauseDialog(); });
  }
  function pauseDialog() {
    showDialog('pause', '稍歇片刻', '准备中的落锤已取消。已接受的锻造结果会保留，暂停不扣资源。', [
      { label: '继续锻造', primary: true, run: () => { closeDialog(false);game.resume(); } },
      { label: '操作设置', run: () => options(true) },
      { label: '返回菜单', run: () => { closeDialog(false);game.menu(); } },
    ], () => game.resume());
  }
  function act(action: Action, ticket: Ticket = game.capture()) { game.command(action, ticket); }
  function disposePiece(type: 'deliver' | 'recycle') {
    const view = snapshot.view, selected = view?.selected;if (!view || !selected || !snapshot.canOperate) return;
    const ticket = game.capture();
    confirm(type === 'deliver' ? '交货后不能继续加工' : '回收后失去交货价值',
      type === 'deliver' ? `${selected.materialName} · ${selected.tierName}\n获得 ${selected.forgedValue} 金币，并计入当轮订单。\n交货后订单 ${view.delivered + selected.forgedValue} / ${view.quota}；金币 ${view.coins} → ${view.coins + selected.forgedValue}。`
        : `${selected.materialName} · ${selected.tierName}\n获得 ${selected.recoverableScrap} 废料，不计入订单。\n这件铁件当前可交货 ${selected.forgedValue} 金币；回收后不能恢复。`,
      type === 'deliver' ? '确认交货' : '确认回收', () => act({ type, pieceId: selected.id }, ticket));
  }
  function settle() {
    if (snapshot.route === 'lesson') { game.endLesson();return; }
    const view = snapshot.view;if (!view || !snapshot.canOperate) return;
    const ticket = game.capture(), active = view.pieces.filter(piece => piece.status === 'active').length;
    if (!active) { act({ type: 'settleRound', recycleRemaining: false }, ticket);return; }
    const scrap = view.pieces.reduce((sum, piece) => sum + piece.recoverableScrap, 0);
    confirm('提前收工', `剩余 ${active} 件会按当前阶级回收，共 ${scrap} 废料，不计入订单。\n已交货 ${view.delivered} / ${view.quota}${view.remaining ? `，尚差 ${view.remaining}，将扣 1 枚印记（${view.seals} → ${view.seals - 1}）。${view.seals === 1 ? '印记耗尽将终止契约。' : ''}` : '，订单已经达成，印记保留。'}`,
      '回收余件并结算', () => act({ type: 'settleRound', recycleRemaining: true }, ticket));
  }

  function storageMessage(s: GameSnapshot): string {
    if (s.route === 'lesson') return '独立练习，不写入正式契约';
    if (s.port.mode === 'memory') return '不保存试玩';
    if (s.port.conflict) return '暂时无法确认本机契约，请重新读取后再操作。';
    if (s.port.mode === 'readonly') return '另一窗口正在锻造，本窗口只可查看。';
    if (s.port.mode === 'unsupported') return '当前环境不能保护本机存档，可选择不保存试玩。';
    if (s.port.lastSave?.ok && !s.port.dirty && s.port.active) return '已保存';
    if (s.port.dirty && s.port.mode === 'writer' && s.port.active) return '有进度尚未保存，请重试保存。';
    if (s.port.load?.main.status === 'invalid') return '本机主档未能通过校验，可尝试备份或另开契约。';
    if (s.port.load?.main.status === 'unavailable' || s.port.mode === 'error') return '本机存档暂时无法读取，可重试或选择不保存试玩。';
    if (!s.port.active) return '正在重新读取契约…';
    if (s.port.dirty) return '有进度尚未保存，请重试保存。';
    return '已保存';
  }
  function paintTiming() {
    if (disposed) return;
    const view = snapshot.view;if (!view) return;
    const feedbackMark = snapshot.feedback?.events.find(event => event.type === 'StrikeResolved');
    const mark = inputVisual.preparing ? inputVisual.mark : feedbackMark?.type === 'StrikeResolved' ? feedbackMark.timingMark : 0;
    required('#cursor').style.left = `${mark / 100}%`;required('#timing-track').dataset.mark = String(mark);
    strike.classList.toggle('preparing', inputVisual.preparing);
    text('#timing-title', inputVisual.preparing ? '松开落锤；Esc 可取消' : snapshot.busy ? '锤击结果已确认' : '松开时，让游标落在中央');
  }
  function paintScene() {
    if (!art || !scene || disposed) return;
    if (snapshot.route === 'menu') { menuScene?.render({ piece: null, mode: 'standard', handle: 0, anvil: 0, reduced: true });return; }
    if (snapshot.view?.phase !== 'workshop') return;
    const view = snapshot.view, feedback = snapshot.feedback;
    let piece = view.selected, angle = art.stage.idleAngle + (inputVisual.preparing && !snapshot.reducedMotion ? Math.sin(inputVisual.mark / 10000 * Math.PI) * .025 : 0), flash = 0;
    const strikeEvent = feedback?.events.find(event => event.type === 'StrikeResolved');
    if (feedback) {
      const progress = Math.min(1, Math.max(0, (performance.now() - feedback.startedAt) / feedback.duration));
      if (!snapshot.reducedMotion && feedback.action === 'strike') {
        piece = progress < .4 ? feedback.before : feedback.after;
        angle = progress < .4 ? art.stage.idleAngle * (1 - progress / .4) : progress < .6 ? -.025 : art.stage.idleAngle * (progress - .6) / .4;
        flash = progress >= .4 && progress < .9 ? 1 - (progress - .4) / .5 : 0;
      } else piece = feedback.after;
    }
    const model: SceneModel = { piece, mode: feedback?.mode ?? snapshot.mode, handle: view.upgrades.handle, anvil: view.upgrades.anvil,
      angle, reduced: snapshot.reducedMotion, flash, ...(strikeEvent?.type === 'StrikeResolved' ? { grade: strikeEvent.timing, outcome: strikeEvent.outcome } : {}) };
    scene.render(model);
  }
  function updateFeedbackLoop() {
    const current = snapshot.feedback;
    if (!current || snapshot.paused || snapshot.route === 'menu') { cancelAnimationFrame(feedbackFrame);feedbackFrame = 0;feedbackId = 0;return; }
    if (feedbackId === current.id) return;
    cancelAnimationFrame(feedbackFrame);feedbackId = current.id;
    const tick = () => {
      if (disposed || snapshot.feedback?.id !== current.id || snapshot.paused) return;
      paintScene();
      if (performance.now() >= current.startedAt + current.duration) { feedbackId = 0;game.finishFeedback(current.id); }
      else feedbackFrame = requestAnimationFrame(tick);
    };
    feedbackFrame = requestAnimationFrame(tick);
  }
  function renderPiece(view: RunView) {
    const piece = view.selected;
    text('#piece-slot', piece ? `来料 ${view.pieces.findIndex(item => item.id === piece.id) + 1} · ${STATUS[piece.status]}` : '本轮来料已处理完毕');
    text('#piece-title', piece ? `${piece.materialName} · ${piece.tierName}` : '准备结算');
    text('#piece-value-label', piece?.status === 'broken' ? '损失估值' : piece?.status === 'recycled' ? '回收废料' : piece?.status === 'delivered' ? '交货所得' : '当前价值');
    text('#piece-value', piece?.status === 'recycled' ? piece.recoveredScrap : piece?.forgedValue ?? '—');text('#next-value', piece?.status === 'active' ? piece.nextValue ?? '封顶' : '—');
    text('#piece-progress', piece ? `${piece.progress} / ${piece.nextProgress ?? 35}` : '—');
    text('#integrity', piece ? `${piece.integrity} / ${piece.maxIntegrity}` : '—');text('#heat', piece?.heat ?? '—');text('#stress', piece?.stress ?? '—');
    for (const [id, value, max] of [['#progress-meter', piece?.progress ?? 0, piece?.nextProgress ?? 35], ['#heat-meter', piece?.heat ?? 0, 100], ['#stress-meter', piece?.stress ?? 0, 100]] as const) {
      const meter = required<HTMLProgressElement>(id);meter.max = max;meter.value = value;
    }
    const cells = required('#integrity-cells');
    if (cells.childElementCount !== (piece?.maxIntegrity ?? 0)) cells.replaceChildren(...Array.from({ length: piece?.maxIntegrity ?? 0 }, () => element('i')));
    [...cells.children].forEach((node, index) => node.classList.toggle('empty', index >= (piece?.integrity ?? 0)));
    text('#break-warning', !piece ? '三件都已处理，点击结算本轮。' : piece.status !== 'active' ? `${STATUS[piece.status]}，不能再次加工。`
      : piece.integrity === 1 ? '只剩 1 格：裂损即破碎！' : '本击破碎风险 0%，裂损只扣一格。');
    required('#break-warning').classList.toggle('critical', piece?.status === 'active' && piece.integrity === 1);
    text('#piece-help', piece?.status === 'active' ? '交货保住当前价值；回收换废料。' : '可点另一件来料查看，或结算本轮。');
    for (const grade of ['precise', 'ordinary', 'mishit'] as const) {
      const risk = piece?.risk.find(item => item.grade === grade), label = { precise: '精准', ordinary: '普通', mishit: '偏击' }[grade];
      text(`#risk-${grade}`, `${label} ${risk ? `${risk.damageRiskPct}%` : '—'}`);
    }
    const precise = view.timingBands.preciseHalfWidth / 100, ordinary = (view.timingBands.ordinaryHalfWidth - view.timingBands.preciseHalfWidth) / 100;
    required('#timing-track').style.gridTemplateColumns = `30fr ${ordinary}fr ${precise * 2}fr ${ordinary}fr 30fr`;
    text('#timing-speed', snapshot.slow ? '慢速 ×1.5' : '标准速度');
    text('#hammer-info', `成功 +${view.hammer.progress} · 精准 +${view.hammer.preciseProgress} · 热耗 ${view.hammer.heatCost}`);
    const allowed = snapshot.canOperate && !dialog.open;
    strike.disabled = !allowed || !piece?.actions.strike.allowed;
    text('#strike', snapshot.busy ? '落锤反馈中…' : !piece ? '本轮来料已处理完毕' : !piece.actions.strike.allowed ? explainError(piece.actions.strike.reason) : '按住蓄锤 · 松开落锤');
    for (const [id, action] of [['#heat-button', 'heat'], ['#deliver-button', 'deliver'], ['#recycle-button', 'recycle']] as const) {
      const availability = piece?.actions[action];button(id).disabled = !allowed || !availability?.allowed;
      button(id).title = availability && !availability.allowed ? explainError(availability.reason) : '';
    }
    text('#heat-cost', piece?.heat === 100 ? '已满热' : view.coal === 0 ? '煤不足' : `${view.coal} 煤 · 每次 1`);text('#deliver-price', piece?.forgedValue ?? '—');text('#recycle-price', piece ? `${piece.recoverableScrap} 废料` : '—');
    button('#settle-button').disabled = !allowed;text('#settle-button', snapshot.route === 'lesson' ? '结束练习' : view.pieces.some(item => item.status === 'active') ? '收工' : '结算本轮');
    for (const mode of MODES) { button(`#mode-${mode}`).setAttribute('aria-pressed', String(mode === snapshot.mode));button(`#mode-${mode}`).disabled = snapshot.busy || snapshot.paused; }
    for (const [index, item] of view.pieces.entries()) {
      const card = button(`#piece-${index + 1}`);card.setAttribute('aria-pressed', String(item.id === piece?.id));card.classList.toggle('finalized', item.status !== 'active');card.disabled = snapshot.busy || snapshot.paused;
      const set = (selector: string, value: string) => { const target = card.querySelector(selector);if (target) target.textContent = value; };
      set('.material-name', item.materialName);set('.tier-name', item.tierName);set('.piece-price', item.status === 'recycled' ? `+${item.recoveredScrap} 废料` : item.status === 'broken' ? `损失 ${item.forgedValue}` : `${item.forgedValue}`);
      set('.piece-state', item.status === 'active' ? `完整 ${item.integrity}/${item.maxIntegrity}` : STATUS[item.status]);
      const key = `${item.id}/${item.progress}/${item.status}/${card.clientWidth}`;
      if (thumbnailKeys.get(card.id) !== key && scene) { const canvas = card.querySelector('canvas');if (canvas) scene.thumbnail(canvas, item);thumbnailKeys.set(card.id, key); }
    }
    text('#scene-status', snapshot.route === 'lesson' ? '独立练习 · 不保存' : piece ? `${piece.materialName} · ${STATUS[piece.status]}` : '三件来料已处理');
    text('#saved', storageMessage(snapshot));text('#feedback', snapshot.feedback?.text ?? '');paintTiming();
  }
  let lastPhaseKey = '';
  let focusPhaseKey = '';
  function render(next: GameSnapshot) {
    if (disposed) return;snapshot = next;input.refresh();
    if (next.route === 'menu') focusPhaseKey = '';
    const ready = art !== null && portReady;required('#loading').hidden = ready;required('#menu').hidden = !ready || next.route !== 'menu';required('#game-route').hidden = !ready || next.route === 'menu';
    root.dataset.route = next.route;root.dataset.phase = next.view?.phase ?? 'none';root.dataset.revision = String(next.view?.revision ?? 0);
    required('#game-route').classList.toggle('lesson-running', next.route === 'lesson');
    if (!ready) return;
    const savedAt = next.port.lastSave?.ok ? next.port.lastSave.savedAt : next.port.load?.main.status === 'valid' ? next.port.load.main.savedAt : null;
    const savedTime = savedAt ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(savedAt)) : '尚未保存';
    const emptyPreview = next.port.load?.main.status === 'invalid' || next.port.load?.main.status === 'unavailable'
      ? '检测到本机契约，但暂时无法读取。原档会保留，可重试、恢复备份或另开契约。'
      : next.port.load?.backup.status === 'valid' ? '主档为空，可以从保存的备份恢复。' : '还没有开始契约。先练两锤，或领下今天的来料。';
    text('#save-preview', next.port.state ? `当前契约 · 第 ${next.port.state.round} / 12 轮\n金币 ${next.port.state.coins} · 印记 ${next.port.state.seals} / 3\n${next.port.mode === 'memory' ? '不保存试玩' : savedAt ? `上次保存：${savedTime}` : '尚未保存'}\n种子：${next.port.state.seed}` : emptyPreview);
    button('#continue').hidden = next.port.state === null;button('#new-game').disabled = !next.port.active || !['writer', 'memory'].includes(next.port.mode);
    text('#new-game', next.port.mode === 'memory' ? '另开试玩' : '新契约');text('#reconnect', next.port.mode === 'memory' ? '返回本机存档' : '重新读取契约');button('#memory-game').hidden = next.port.mode === 'memory';
    text('#continue', next.port.mode === 'readonly' ? '查看本机契约' : next.port.mode === 'memory' ? '继续不保存试玩' : '继续契约');
    text('#menu-storage', storageMessage(next) === '已保存' ? '' : storageMessage(next));button('#recover').hidden = next.port.mode === 'memory' || next.port.load?.backup.status !== 'valid' || next.port.load.main.status === 'valid' || Boolean(next.port.lastSave?.ok);
    button('#recover').disabled = !next.port.active || next.port.mode !== 'writer';
    const view = next.view;
    if (next.route !== 'menu' && view) {
      text('#round', next.route === 'lesson' ? '独立练习' : `第 ${view.round} / ${view.totalRounds} 轮`);
      text('#delivered', `${next.route === 'lesson' ? '练习交货' : '已交货'} ${view.delivered} / ${view.quota}`);text('#deficit', view.remaining ? `尚差 ${view.remaining}` : '订单达成');
      const progress = required<HTMLProgressElement>('#order-progress');progress.max = view.quota;progress.value = view.delivered;
      text('#seals', `${view.seals} / 3`);text('#coins', view.coins);text('#scrap', view.scrap);text('#coal', view.coal);
      required('#workshop').hidden = view.phase !== 'workshop';required('#phase-panel').hidden = view.phase === 'workshop';
      required('#lesson-banner').hidden = next.route !== 'lesson';
      if (next.route === 'lesson' && next.lessonStep !== null) {
        const lesson = LESSONS[next.lessonStep];if (lesson) { text('#lesson-title', `练习 ${next.lessonStep + 1} / ${LESSONS.length} · ${lesson.title}`);text('#lesson-text', lesson.text);text('#lesson-hint', lesson.hint); }
        text('#lesson-next', next.lessonStep === LESSONS.length - 1 ? '完成练习' : '下一课');text('#lesson-exit', '跳过 / 返回');
      }
      const message = storageMessage(next), show = next.route !== 'lesson' && !['已保存', '不保存试玩'].includes(message);
      required('#storage-banner').hidden = !show;text('#storage-text', message);
      button('#retry-save').hidden = !next.port.dirty || next.port.conflict || next.port.mode !== 'writer';
      button('#refresh-slot').hidden = next.port.mode === 'memory';
      if (view.phase === 'workshop') renderPiece(view);
      else {
        text('#phase-storage', storageMessage(next));
        const key = `${view.runId}/${view.revision}/${next.canOperate}/${next.port.generation}/${next.epoch}`;
        if (key !== lastPhaseKey && art) {
          const ticket = game.capture(), previous = document.activeElement;
          const focusId = previous instanceof HTMLElement && required('#phase-panel').contains(previous) ? previous.id : '';
          renderPhase(required('#phase-panel'), view, next.canOperate, art, { command: action => act(action, ticket), confirm,
            restart: sameSeed => newGame(false, sameSeed ? snapshot.seed ?? '' : ''), menu: () => game.menu() });lastPhaseKey = key;
          const replacement = focusId ? root.querySelector<HTMLElement>(`#${CSS.escape(focusId)}`) : null;
          if (!dialog.open && replacement instanceof HTMLButtonElement && !replacement.disabled) replacement.focus({ preventScroll: true });
          else if (!dialog.open && focusId) required('#phase-title').focus({ preventScroll: true });
        }
      }
      const stageKey = `${view.runId}/${view.phase}/${view.round}/${next.route}`;
      if (stageKey !== focusPhaseKey && !dialog.open && !document.hidden) {
        focusPhaseKey = stageKey;
        if (view.phase !== 'workshop') required('#phase-title').focus({ preventScroll: true });
      }
    }
    text('#game-note', next.note);paintScene();updateFeedbackLoop();
    if (next.paused && next.route !== 'menu' && modal?.kind !== 'pause' && modal?.kind !== 'options') { if (modal) closeDialog(false);if (!document.hidden) pauseDialog(); }
    else if (!next.paused && modal?.kind === 'pause') closeDialog(false);
  }

  button('#new-game').addEventListener('click', () => newGame());button('#memory-game').addEventListener('click', () => newGame(true));
  button('#continue').addEventListener('click', () => { game.continueRun(game.capture()); });
  button('#practice').addEventListener('click', () => game.practice());button('#options').addEventListener('click', () => options());
  button('#menu-logo').addEventListener('click', () => { input.cancel();game.menu(); });
  button('#pause').addEventListener('click', () => game.pause());button('#heat-button').addEventListener('click', () => { const piece = snapshot.view?.selected;if (piece) act({ type: 'heat', pieceId: piece.id }); });
  button('#deliver-button').addEventListener('click', () => disposePiece('deliver'));button('#recycle-button').addEventListener('click', () => disposePiece('recycle'));button('#settle-button').addEventListener('click', settle);
  for (const mode of MODES) button(`#mode-${mode}`).addEventListener('click', () => game.selectMode(mode));
  for (let index = 0; index < 3; index++) button(`#piece-${index + 1}`).addEventListener('click', () => { const piece = snapshot.view?.pieces[index];if (piece) game.selectPiece(piece.id); });
  button('#lesson-next').addEventListener('click', () => { const step = snapshot.lessonStep;if (step === null) return;if (step === LESSONS.length - 1) game.endLesson();else game.lessonStep(step + 1); });
  button('#lesson-reset').addEventListener('click', () => game.lessonStep(snapshot.lessonStep ?? 0));button('#lesson-exit').addEventListener('click', () => game.endLesson());
  for (const id of ['#reconnect', '#refresh-slot']) button(id).addEventListener('click', () => {
    input.cancel();
    if (snapshot.port.dirty || snapshot.port.mode === 'memory') {
      confirm('重新读取本机契约', '当前未保存进度或试玩将结束。本机已保存的契约会保留。', '重新载入并读取', () => location.reload());
    } else void game.activate();
  });
  button('#retry-save').addEventListener('click', () => game.retrySave());
  button('#recover').addEventListener('click', () => { const ticket = game.capture();confirm('恢复备份', '这会回到备份时的进度并替换当前主档。', '恢复备份', () => game.recover(ticket)); });
  const onCancel = (event: Event) => { event.preventDefault();closeDialog();render(game.getSnapshot()); };
  dialog.addEventListener('cancel', onCancel);
  const onDialogKey = (event: KeyboardEvent) => {
    if (event.repeat && event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) event.preventDefault();
  };
  dialog.addEventListener('keydown', onDialogKey);
  const onKey = (event: KeyboardEvent) => {
    if (event.repeat && event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault();return; }
    if (dialog.open || event.repeat) return;
    if (event.key === 'Escape' && snapshot.route !== 'menu') { event.preventDefault();game.pause();return; }
    if (snapshot.route === 'menu' || snapshot.paused || snapshot.view?.phase !== 'workshop') return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches('input,select,textarea') || target.isContentEditable)) return;
    const index = ['1', '2', '3'].indexOf(event.key), mode = ['q', 'w', 'e'].indexOf(event.key.toLowerCase());
    if (index >= 0) { event.preventDefault();const piece = snapshot.view.pieces[index];if (piece) game.selectPiece(piece.id); }
    if (mode >= 0) { event.preventDefault();const selected = MODES[mode];if (selected) game.selectMode(selected); }
  };
  const onBlur = () => game.pause();const onHidden = () => { if (document.hidden) game.pause();else render(game.getSnapshot()); };
  const onMotion = () => game.setReducedMotion(userReduced || motionQuery.matches);
  window.addEventListener('keydown', onKey);window.addEventListener('blur', onBlur);document.addEventListener('visibilitychange', onHidden);motionQuery.addEventListener('change', onMotion);
  const resize = new ResizeObserver(() => { thumbnailKeys.clear();render(game.getSnapshot()); });resize.observe(root);
  const unsubscribe = game.subscribe(render);onMotion();
  function paintModeIcons() {
    if (!art) return;
    for (const mode of MODES) {
      const canvas = button(`#mode-${mode}`).querySelector('canvas');if (!canvas) continue;
      canvas.width = 160;canvas.height = 80;const ctx = canvas.getContext('2d'), image = artImage(art, `hammer-${mode}`);
      if (ctx) { const scale = Math.min(145 / image.naturalWidth, 68 / image.naturalHeight);ctx.drawImage(image, (160 - image.naturalWidth * scale) / 2, (80 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale); }
    }
  }
  async function loadAssets() {
    const token = ++loadEpoch;button('#retry-art').hidden = true;text('#loading-text', '整理工坊美术…');
    try {
      const bundle = await loadArt();if (disposed || token !== loadEpoch) return;
      art = bundle;scene?.dispose();menuScene?.dispose();scene = new ForgeScene(required('#forge-scene'), bundle);menuScene = new ForgeScene(required('#menu-scene'), bundle, true);
      thumbnailKeys.clear();paintModeIcons();render(game.getSnapshot());
    } catch (error) {
      if (disposed || token !== loadEpoch) return;
      text('#loading-text', error instanceof Error ? error.message : '工坊图片未能载入，请重试。');button('#retry-art').hidden = false;
    }
  }
  button('#retry-art').addEventListener('click', () => { void loadAssets(); });
  void game.activate().then(() => { if (!disposed) { portReady = true;render(game.getSnapshot()); } });
  void loadAssets();
  return { dispose(): Promise<void> { if (disposal) return disposal;disposed = true;loadEpoch++;cancelAnimationFrame(feedbackFrame);input.dispose();unsubscribe();resize.disconnect();scene?.dispose();menuScene?.dispose();
    window.removeEventListener('keydown', onKey);window.removeEventListener('blur', onBlur);document.removeEventListener('visibilitychange', onHidden);motionQuery.removeEventListener('change', onMotion);dialog.removeEventListener('cancel', onCancel);dialog.removeEventListener('keydown', onDialogKey);
    if (dialog.open) dialog.close();shell.remove();disposal = game.dispose();return disposal; } };
}
