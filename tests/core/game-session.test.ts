import { describe, expect, it } from 'vitest';
import { createGameSession } from '../../src/application/session.js';
import { StrikeAttempt } from '../../src/platform/timing.js';
import { createLesson } from '../../src/tutorial/lesson.js';
import { validateRun } from '../../src/core/index.js';
import { MemoryStorage, session, TestLocks } from './persistence-fixtures';
import { SAVE_KEY } from '../../src/platform/storage.js';

async function fixture() {
  const storage = new MemoryStorage(), port = session(storage);
  let now = 1000, serial = 0;
  const game = createGameSession(port, { now: () => now }, () => `lesson-${++serial}`);
  await game.activate();
  expect(game.start({ runId: 'formal-1', seed: 'controller-test' }, game.capture(), false)).toBe(true);
  const hit = () => {
    const context = game.inputContext();if (!context) throw new Error('No input context');
    const attempt = new StrikeAttempt();attempt.start(context, 'key:Space', now);now += context.periodMs / 4;
    const released = attempt.release('key:Space', now, game.inputContext());if (!released) throw new Error('No release');
    return game.strike(released);
  };
  return { game, port, storage, hit, advance: (delta: number) => { now += delta; } };
}

describe('game presentation session', () => {
  it('accepts and saves before animation; locks one strike and ignores early/old completion', async () => {
    const f = await fixture();expect(f.hit()).toBe(true);
    expect(f.port.getSnapshot().state?.revision).toBe(1);
    expect(f.port.getSnapshot().dirty).toBe(false);
    const feedback = f.game.getSnapshot().feedback;if (!feedback) throw new Error('Missing feedback');
    expect(f.game.inputContext()).toBeNull();
    f.advance(449);f.game.finishFeedback(feedback.id);expect(f.game.getSnapshot().busy).toBe(true);
    f.advance(1);f.game.finishFeedback(feedback.id);expect(f.game.getSnapshot().busy).toBe(false);
    expect(f.port.getSnapshot().state?.rng.strike.draws).toBe(1);
    await f.game.dispose();
  });
  it('pause skips presentation without undoing an accepted strike or allowing old completion into a new run', async () => {
    const f = await fixture();f.hit();const old = f.game.getSnapshot().feedback;
    const accepted = f.port.getSnapshot().state;f.game.pause();
    expect(f.game.inputContext()).toBeNull();expect(f.port.getSnapshot().state).toBe(accepted);
    f.game.resume();f.game.menu();
    expect(f.game.start({ runId: 'formal-2', seed: 'controller-test' }, f.game.capture(), true)).toBe(true);
    f.hit();const current = f.game.getSnapshot().feedback;
    f.advance(2000);if (old) f.game.finishFeedback(old.id);
    expect(f.game.getSnapshot().feedback?.id).toBe(current?.id);
    expect(f.game.getSnapshot().busy).toBe(true);expect(f.port.getSnapshot().state?.revision).toBe(1);
    await f.game.dispose();
  });
  it('a captured release cannot follow a target/mode/route change', async () => {
    const f = await fixture(), context = f.game.inputContext();if (!context) throw new Error('No input');
    const engine = new StrikeAttempt();engine.start(context, 'key:Space', 0);
    const release = engine.release('key:Space', 350, context);if (!release) throw new Error('No release');
    const raw = f.storage.getItem(SAVE_KEY);f.game.selectMode('heavy');
    expect(f.game.strike(release)).toBe(false);expect(f.storage.getItem(SAVE_KEY)).toBe(raw);
    f.game.menu();expect(f.game.strike(release)).toBe(false);expect(f.port.getSnapshot().state?.revision).toBe(0);
    await f.game.dispose();
  });
  it('practice and the real cracked sample never touch the formal slot, stats or random streams', async () => {
    const f = await fixture();f.hit();f.game.pause();f.game.resume();
    const raw = f.storage.getItem(SAVE_KEY), formal = f.port.getSnapshot().state, writes = f.storage.writes.length;
    f.game.practice();expect(f.game.getSnapshot().slow).toBe(true);f.hit();f.game.lessonStep(1);
    expect(f.game.getSnapshot().view?.selected?.integrity).toBe(1);
    expect(f.game.getSnapshot().view?.revision).toBe(8);
    expect(f.storage.getItem(SAVE_KEY)).toBe(raw);expect(f.storage.writes).toHaveLength(writes);
    expect(f.port.getSnapshot().state).toBe(formal);
    f.game.endLesson();expect(f.game.getSnapshot().route).toBe('game');expect(f.game.getSnapshot().slow).toBe(false);
    expect(f.game.getSnapshot().view?.revision).toBe(formal?.revision);
    await f.game.dispose();
  });
  it('rejects stale confirmation tickets and retains the existing save', async () => {
    const f = await fixture(), old = f.game.capture();f.game.pause();f.game.resume();
    const raw = f.storage.getItem(SAVE_KEY);
    expect(f.game.start({ runId: 'replacement', seed: 'new-seed' }, old, true)).toBe(false);
    expect(f.storage.getItem(SAVE_KEY)).toBe(raw);await f.game.dispose();
  });
  it('re-activation immediately suspends new input before the asynchronous lease/read completes', async () => {
    const f = await fixture();const before = f.port.getSnapshot().state, pending = f.game.activate();
    expect(f.game.inputContext()).toBeNull();expect(f.game.getSnapshot().port.active).toBe(false);
    await pending;f.game.resume();expect(f.game.inputContext()).not.toBeNull();expect(f.port.getSnapshot().state).toEqual(before);
    await f.game.dispose();
  });
  it('menu continuation preserves an accepted dirty working copy; only explicit reload may discard it', async () => {
    const f = await fixture();f.storage.failMain = true;expect(f.hit()).toBe(true);
    const accepted = f.port.getSnapshot().state, raw = f.storage.getItem(SAVE_KEY);f.game.menu();
    expect(f.game.continueRun(f.game.capture())).toBe(true);
    expect(f.port.getSnapshot().state).toBe(accepted);expect(f.port.getSnapshot().dirty).toBe(true);
    expect(f.storage.getItem(SAVE_KEY)).toBe(raw);
    expect(f.game.continueRun(f.game.capture(), true)).toBe(true);
    expect(f.port.getSnapshot().state?.revision).toBe(0);expect(f.port.getSnapshot().dirty).toBe(false);
    await f.game.dispose();
  });
  it('second writer is view-only but may use isolated practice', async () => {
    const storage = new MemoryStorage(), locks = new TestLocks(), first = session(storage, locks), second = session(storage, locks);
    await first.activate();first.startNewGame({ runId: 'first', seed: 'x' }, { generation: first.getSnapshot().generation, confirmed: false });
    const game = createGameSession(second, { now: () => 0 }, () => 'lesson-other');await game.activate();
    expect(game.getSnapshot().port.mode).toBe('readonly');expect(game.continueRun(game.capture())).toBe(true);
    expect(game.inputContext()).toBeNull();const raw = storage.getItem(SAVE_KEY);
    game.practice();expect(game.inputContext()).not.toBeNull();expect(storage.getItem(SAVE_KEY)).toBe(raw);
    await game.dispose();await first.dispose();
  });
});

it('pins a reachable lesson recipe rather than an assigned integrity fixture', () => {
  const lesson = createLesson(1, 'lesson-proof');
  expect(lesson.state.stats).toMatchObject({ strikes: 7, damagedStrikes: 3, heats: 1 });
  expect(lesson.state.pieces[1]).toMatchObject({ integrity: 1, progress: 12, heat: 82, stress: 100 });
  expect(validateRun(lesson.state).ok).toBe(true);
});
