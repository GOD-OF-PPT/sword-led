import { getRunView } from '../core/index.js';
import type { Action, CreateRunInput, DomainEvent, HammerMode, PieceView, RunView } from '../core/index.js';
import type { PersistentSession, SessionSnapshot } from './persistent-session.js';
import { createLesson, applyLesson } from '../tutorial/lesson.js';
import type { Lesson } from '../tutorial/lesson.js';
import { sameInput } from '../platform/timing.js';
import type { InputIdentity, ReleasedAttempt } from '../platform/timing.js';

export interface Clock { now(): number }
export type Route = 'menu' | 'game' | 'lesson';
export interface Ticket {
  readonly route: Route; readonly routeEpoch: number; readonly generation: number;
  readonly runId: string | null; readonly revision: number | null;
}
export interface Feedback {
  readonly id: number; readonly startedAt: number; readonly duration: number; readonly action: Action['type'];
  readonly before: PieceView | null; readonly after: PieceView | null; readonly mode: HammerMode;
  readonly events: readonly DomainEvent[]; readonly text: string;
}
export interface GameSnapshot {
  readonly route: Route; readonly epoch: number; readonly paused: boolean; readonly busy: boolean;
  readonly slow: boolean; readonly reducedMotion: boolean; readonly mode: HammerMode;
  readonly view: RunView | null; readonly seed: string | null; readonly port: SessionSnapshot;
  readonly lessonStep: number | null; readonly feedback: Feedback | null; readonly note: string; readonly canOperate: boolean;
}

export function explainError(error: string): string {
  const messages: Record<string, string> = {
    invalid_seed: '种子需要 1–64 个字符。', stale_session: '契约状态已变化，请重新检查后操作。',
    stale_revision: '铁件已经变化，请重新选择操作。', readonly: '另一窗口正在锻造，本窗口只可查看。',
    not_active: '正在重新读取契约，请稍候。', locks_unsupported: '当前环境无法保护本机存档，可选择不保存试玩。',
    save_conflict: '本机契约已被另一窗口改变，请先读取最新进度。', save_unavailable: '暂时无法读取或保存契约。',
    confirmation_required: '这会替换进行中的进度，请确认后再继续。', no_run: '请先建立一份契约。',
    no_heat: '铁件已经冷却，请加热或收手。', max_progress: '已到最高阶，可以交货或回收。',
    no_coal: '煤不足，可以先交货或回收。', already_hot: '当前已经是满热。', piece_finalized: '这件铁坯已经处理完毕。',
    insufficient_coins: '金币不足。', insufficient_scrap: '废料不足。', already_purchased: '本次来访已经购买过。',
    max_level: '这项工具已升到最高级。', repair_not_needed: '契约印记已经完整。', main_available: '主档仍然可用，请读取主档。',
    backup_unavailable: '没有可用备份。', wrong_phase: '当前阶段无法执行这个操作。',
  };
  return messages[error] ?? '当前操作未能完成，请检查契约状态后重试。';
}
function eventText(events: readonly DomainEvent[]): string {
  const ending = events.find(event => event.type === 'RunEnded');
  if (ending?.type === 'RunEnded') return ending.outcome === 'victory' ? '十二轮契约期完成' : '契约印记耗尽，契约终止';
  const settled = events.find(event => event.type === 'RoundSettled');
  if (settled?.type === 'RoundSettled') return settled.summary.metQuota ? '订单达成' : '订单未达标，扣除 1 枚印记';
  const started = events.find(event => event.type === 'RoundStarted');
  if (started?.type === 'RoundStarted') return `第 ${started.round} 轮开炉：三件新来料，配额 ${started.quota}，配给 ${started.coal} 煤。`;
  const strike = events.find(event => event.type === 'StrikeResolved');
  if (strike?.type === 'StrikeResolved') {
    const grade = { precise: '精准', ordinary: '普通', mishit: '偏击' }[strike.timing];
    const outcome = strike.outcome === 'success' ? `成功，进度 +${strike.progressGained}`
      : strike.outcome === 'broken' ? '铁件破碎，回收 1 废料' : '裂损，完整度 −1';
    const raised = events.some(event => event.type === 'TierRaised') ? ' · 升阶！' : '';
    return `${grade} · ${outcome}${raised}`;
  }
  for (const event of events) {
    if (event.type === 'PieceDelivered') return `交货成功，订单与金币 +${event.value}`;
    if (event.type === 'PieceRecycled') return `回收完成，废料 +${event.scrap}，不计订单`;
    if (event.type === 'Heated') return '加热完成，消耗 1 煤；裂痕不会修复';
    if (event.type === 'PurchaseMade') return '购买完成，工具与契约状态已更新';
    if (event.type === 'RoundSettled') return event.summary.metQuota ? '订单达成' : '订单未达标，扣除 1 枚印记';
  }
  return '';
}

export function createGameSession(port: PersistentSession, clock: Clock, identity: () => string) {
  let route: Route = 'menu', returnRoute: 'menu' | 'game' = 'menu';
  let epoch = 0, routeEpoch = 0, lessonSerial = 0, feedbackSerial = 0, batch = 0, activation = 0;
  let paused = false, locked = false, disposed = false, slow = false, lessonSlow = true, reducedMotion = false;
  let selection: string | null = null, lessonSelection: string | null = null;
  let mode: HammerMode = 'standard', lessonMode: HammerMode = 'light';
  let lesson: Lesson | null = null, feedback: Feedback | null = null, note = '';
  let currentPort = port.getSnapshot();
  const listeners = new Set<(snapshot: GameSnapshot) => void>();
  const state = () => route === 'lesson' ? lesson?.state ?? null : currentPort.state;
  const selected = () => route === 'lesson' ? lessonSelection : selection;
  const selectedMode = () => route === 'lesson' ? lessonMode : mode;
  const view = (): RunView | null => { const run = state();return run ? getRunView(run, { pieceId: selected(), mode: selectedMode() }) : null; };
  const canOperate = () => !disposed && route !== 'menu' && !paused && !locked && (route === 'lesson'
    || (currentPort.active && !currentPort.conflict && (currentPort.mode === 'writer' || currentPort.mode === 'memory')));
  const getSnapshot = (): GameSnapshot => Object.freeze({ route, epoch, paused, busy: locked, slow: route === 'lesson' ? lessonSlow : slow,
    reducedMotion, mode: selectedMode(), view: view(), seed: state()?.seed ?? null, port: currentPort,
    lessonStep: route === 'lesson' ? lesson?.step ?? null : null, feedback, note, canOperate: canOperate() });
  const publish = () => {
    if (batch || disposed) return;
    const snapshot = getSnapshot();
    for (const listener of listeners) { try { listener(snapshot); } catch { console.error('工坊界面更新失败'); } }
  };
  const transact = <T>(work: () => T): T => { batch++;try { return work(); } finally { batch--;publish(); } };
  const invalidate = () => { epoch++;feedback = null;locked = false; };
  const chooseFirst = () => {
    const run = state();if (!run) return;
    const current = run.pieces.find(piece => piece.id === selected());
    if (!current || current.status !== 'active') {
      const next = run.pieces.find(piece => piece.status === 'active')?.id ?? null;
      if (route === 'lesson') lessonSelection = next;else selection = next;
    }
  };
  const fail = (error: string) => { note = explainError(error);return false; };
  const capture = (): Ticket => Object.freeze({ route, routeEpoch, generation: currentPort.generation,
    runId: state()?.runId ?? null, revision: state()?.revision ?? null });
  const matches = (ticket: Ticket) => !disposed && ticket.route === route && ticket.routeEpoch === routeEpoch
    && ticket.generation === currentPort.generation && ticket.runId === (state()?.runId ?? null) && ticket.revision === (state()?.revision ?? null);
  const inputContext = (): InputIdentity | null => {
    const current = view();
    if (!canOperate() || current?.phase !== 'workshop' || !current.selected?.actions.strike.allowed) return null;
    return { runId: current.runId, revision: current.revision, generation: route === 'lesson' ? lessonSerial : currentPort.generation,
      epoch, pieceId: current.selected.id, mode: selectedMode(), periodMs: current.hammer.periodMs * ((route === 'lesson' ? lessonSlow : slow) ? 1.5 : 1) };
  };
  const unsubscribe = port.subscribe(snapshot => {
    const changed = snapshot.generation !== currentPort.generation || snapshot.state?.runId !== currentPort.state?.runId;
    currentPort = snapshot;
    if (changed && route !== 'lesson') { invalidate();if (route === 'game' && !snapshot.active) paused = true; }
    if (snapshot.state && !snapshot.state.pieces.some(piece => piece.id === selection)) selection = snapshot.state.pieces.find(piece => piece.status === 'active')?.id ?? null;
    publish();
  });
  const command = (action: Action, ticket: Ticket): boolean => transact(() => {
    if (!matches(ticket)) return fail('stale_session');
    if (!canOperate()) return fail(paused || locked ? 'not_active' : currentPort.conflict ? 'save_conflict' : 'readonly');
    const run = state(), before = view()?.selected ?? null;
    if (!run) return fail('no_run');
    locked = true;
    const result = route === 'lesson' && lesson ? (() => { const applied = applyLesson(lesson, action);lesson = applied.lesson;return applied.result; })()
      : port.dispatch({ runId: run.runId, expectedRevision: run.revision, action }, currentPort.generation);
    if (!result.ok) { locked = false;return fail(result.error); }
    note = eventText(result.events);
    if (['strike', 'heat', 'deliver', 'recycle'].includes(action.type)) {
      feedback = Object.freeze({ id: ++feedbackSerial, startedAt: clock.now(), duration: reducedMotion ? 120 : 450,
        action: action.type, before, after: view()?.selected ?? null, mode: selectedMode(), events: result.events, text: note });
    } else { locked = false;epoch++;chooseFirst(); }
    return true;
  });
  const api = {
    getSnapshot, capture, inputContext, command,
    subscribe(listener: (snapshot: GameSnapshot) => void) { listeners.add(listener);listener(getSnapshot());return () => { listeners.delete(listener); }; },
    async activate() {
      if (disposed) return getSnapshot();
      const token = ++activation;
      if (route !== 'lesson') invalidate();if (route === 'game') paused = true;
      note = '';const pending = port.activate();currentPort = port.getSnapshot();publish();await pending;
      if (!disposed && token === activation) { currentPort = port.getSnapshot();publish(); }
      return getSnapshot();
    },
    start(input: CreateRunInput, ticket: Ticket, confirmed: boolean, memory = false): boolean {
      return transact(() => {
        if (!matches(ticket) || route === 'lesson') return fail('stale_session');
        const result = memory ? port.useMemory(input, { generation: ticket.generation, confirmed })
          : port.startNewGame(input, { generation: ticket.generation, confirmed });
        if (!result.ok) return fail(result.error);
        invalidate();routeEpoch++;route = 'game';paused = false;mode = 'standard';selection = null;chooseFirst();
        note = memory ? '不保存试玩：离开前请留意进度不会写入本机。' : '新契约已建立，每轮只有三件来料。';return true;
      });
    },
    continueRun(ticket: Ticket, confirmed = false): boolean {
      return transact(() => {
        if (!matches(ticket)) return fail('stale_session');
        if (!currentPort.state) return fail('no_run');
        if (currentPort.mode === 'writer' && (!currentPort.dirty || confirmed)) {
          const result = port.resume({ generation: ticket.generation, confirmed });if (!result.ok) return fail(result.error);
        } else if (currentPort.mode !== 'writer' && currentPort.mode !== 'memory' && currentPort.mode !== 'readonly') return fail('save_unavailable');
        invalidate();routeEpoch++;route = 'game';paused = false;chooseFirst();note = '';return true;
      });
    },
    recover(ticket: Ticket): boolean {
      return transact(() => {
        if (!matches(ticket)) return fail('stale_session');
        const result = port.recoverBackup({ generation: ticket.generation, confirmed: true });if (!result.ok) return fail(result.error);
        invalidate();routeEpoch++;route = 'game';paused = false;selection = null;chooseFirst();note = '已读取所选备份。';return true;
      });
    },
    retrySave() { return transact(() => { const result = port.retrySave(currentPort.generation);if (!result.ok) return fail(result.error);note = '当前进度已保存。';return true; }); },
    strike(attempt: ReleasedAttempt): boolean {
      if (!sameInput(attempt.identity, inputContext())) return transact(() => fail('stale_session'));
      return command({ type: 'strike', pieceId: attempt.identity.pieceId, mode: attempt.identity.mode, timingMark: attempt.timingMark }, capture());
    },
    finishFeedback(id: number) {
      if (disposed || !feedback || feedback.id !== id || clock.now() < feedback.startedAt + feedback.duration) return;
      feedback = null;locked = false;chooseFirst();publish();
    },
    selectPiece(id: string) { if (locked || disposed || !state()?.pieces.some(piece => piece.id === id)) return;invalidate();if (route === 'lesson') lessonSelection = id;else selection = id;note = '';publish(); },
    selectMode(next: HammerMode) { if (locked || disposed) return;invalidate();if (route === 'lesson') lessonMode = next;else mode = next;publish(); },
    setSlow(next: boolean) { invalidate();if (route === 'lesson') lessonSlow = next;else slow = next;publish(); },
    setReducedMotion(next: boolean) { invalidate();reducedMotion = next;publish(); },
    pause() { if (route === 'menu' || paused || disposed) return;invalidate();paused = true;routeEpoch++;publish(); },
    resume() { if (disposed) return;invalidate();paused = false;publish(); },
    menu() { if (disposed) return;invalidate();routeEpoch++;route = 'menu';paused = false;lesson = null;note = '';publish(); },
    practice() { if (disposed) return;returnRoute = route === 'game' ? 'game' : 'menu';invalidate();routeEpoch++;route = 'lesson';paused = false;
      lesson = createLesson(0, identity());lessonSerial++;lessonSelection = lesson.selected;lessonMode = 'light';lessonSlow = true;note = '';publish(); },
    lessonStep(step: number) { if (disposed || route !== 'lesson') return;invalidate();routeEpoch++;lesson = createLesson(step, identity());lessonSerial++;
      lessonSelection = lesson.selected;lessonMode = 'standard';paused = false;note = '';publish(); },
    endLesson() { if (disposed || route !== 'lesson') return;invalidate();routeEpoch++;route = returnRoute === 'game' && currentPort.state ? 'game' : 'menu';
      lesson = null;paused = false;chooseFirst();note = '练习不会写入正式契约。';publish(); },
    dispose() { disposed = true;invalidate();unsubscribe();listeners.clear();const released = port.dispose();currentPort = port.getSnapshot();return released; },
  };
  return api;
}
export type GameSession = ReturnType<typeof createGameSession>;
