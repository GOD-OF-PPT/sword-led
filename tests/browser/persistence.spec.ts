import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/tests/browser/fixture.html');
  await page.evaluate(() => window.storageTest.ready);
}
async function start(page: Page, seed = 'browser-break-0') {
  const result = await page.evaluate(seed => {
    const session = window.storageTest.session;
    return session.startNewGame({ runId: crypto.randomUUID(), seed }, { generation: session.getSnapshot().generation, confirmed: false });
  }, seed);
  expect(result.ok).toBe(true);
}

test('persists real breakage across reload with no reward replay or random reroll', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page); await start(page);
  const before = await page.evaluate(() => {
    const { session } = window.storageTest;
    for (let index = 0; index < 20; index++) {
      const snapshot = session.getSnapshot(); const state = snapshot.state;
      if (!state) throw new Error('Missing run');
      const piece = state.pieces[2];
      if (piece.status === 'broken') break;
      const action = piece.heat === 0 && state.coal > 0 ? { type: 'heat', pieceId: piece.id }
        : { type: 'strike', pieceId: piece.id, mode: 'heavy', timingMark: 0 };
      const result = session.dispatch({ runId: state.runId, expectedRevision: state.revision, action }, snapshot.generation);
      if (!result.ok) break;
    }
    return session.getSnapshot();
  });
  expect(before.state?.pieces[2].status).toBe('broken');
  expect(before.dirty).toBe(false);
  await page.reload(); await page.evaluate(() => window.storageTest.ready);
  const restored = await page.evaluate(() => window.storageTest.session.getSnapshot());
  expect(restored.state).toEqual(before.state);
  const sameOutcome = await page.evaluate(() => {
    const { session, core } = window.storageTest; const snap = session.getSnapshot(); const state = snap.state;
    if (!state) throw new Error('Missing restored run');
    const envelope = { runId: state.runId, expectedRevision: state.revision,
      action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } };
    const expected = core.applyCommand(state, envelope);
    const actual = session.dispatch(envelope, snap.generation);
    return expected.ok && actual.ok && JSON.stringify(expected.state) === JSON.stringify(actual.state);
  });
  expect(sameOutcome).toBe(true);
  expect(errors).toEqual([]);
});

test('native Web Locks allow one writer and a clean handoff between two windows', async ({ page, context }) => {
  await open(page); await start(page, 'two-windows');
  const other = await context.newPage(); await open(other);
  expect(await other.evaluate(() => window.storageTest.session.getSnapshot().mode)).toBe('readonly');
  const denied = await other.evaluate(() => {
    const session = window.storageTest.session; const s = session.getSnapshot();
    return session.startNewGame({ runId: crypto.randomUUID(), seed: 'cannot-overwrite' }, { generation: s.generation, confirmed: true });
  });
  expect(denied).toMatchObject({ ok: false, error: 'readonly' });
  const original = await page.evaluate(() => window.storageTest.session.getSnapshot().state);
  await page.evaluate(() => window.storageTest.session.suspend());
  expect((await other.evaluate(() => window.storageTest.session.activate())).mode).toBe('writer');
  const changed = await other.evaluate(() => {
    const session = window.storageTest.session; const s = session.getSnapshot(); const state = s.state;
    if (!state) throw new Error();
    return session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'deliver', pieceId: '1:1' } }, s.generation);
  });
  expect(changed.ok).toBe(true);
  const back = await page.evaluate(() => window.storageTest.session.activate());
  expect(back.mode).toBe('readonly');
  expect(back.state).not.toEqual(original);
  expect(back.state?.pieces[0].status).toBe('delivered');
});

test('ordinary history navigation releases ownership and rereads the newest save', async ({ page, context }) => {
  await open(page); await start(page, 'history-restore');
  await page.goto('/tests/browser/away.html');
  const other = await context.newPage(); await open(other);
  expect(await other.evaluate(() => window.storageTest.session.getSnapshot().mode)).toBe('writer');
  const latest = await other.evaluate(() => {
    const session = window.storageTest.session; const s = session.getSnapshot(); const state = s.state;
    if (!state) throw new Error();
    return session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'deliver', pieceId: '1:3' } }, s.generation);
  });
  expect(latest.ok).toBe(true);
  await page.goBack();
  await page.waitForFunction(() => window.storageTest?.session.getSnapshot().active);
  const restored = await page.evaluate(() => ({ snapshot: window.storageTest.session.getSnapshot() }));
  expect(restored.snapshot.mode).toBe('readonly');
  expect(restored.snapshot.state?.pieces[2].status).toBe('delivered');
});

test('real localStorage quota failure keeps accepted memory dirty and retries without a second action', async ({ page }) => {
  await open(page); await start(page, 'quota-retry');
  const result = await page.evaluate(() => {
    const { session, SAVE_KEY } = window.storageTest;
    let length = 0; let quotaError = '';
    for (let step = 1 << 22; step >= 1; step = Math.floor(step / 2)) {
      try { localStorage.setItem('quota-fill', 'x'.repeat(length + step)); length += step; }
      catch (error) { quotaError = error instanceof DOMException ? error.name : 'unknown'; }
    }
    const oldDisk = localStorage.getItem(SAVE_KEY); const before = session.getSnapshot(); const state = before.state;
    if (!state) throw new Error();
    const hit = session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } }, before.generation);
    const dirty = session.getSnapshot(); const unchangedDisk = localStorage.getItem(SAVE_KEY) === oldDisk;
    localStorage.removeItem('quota-fill');
    const retry = session.retrySave(dirty.generation);
    return { quotaError, hit, dirty, unchangedDisk, retry, final: session.getSnapshot() };
  });
  expect(result.quotaError).toBe('QuotaExceededError');
  expect(result.hit).toMatchObject({ ok: true, persistence: { ok: false, error: 'storage_write_failed' } });
  expect(result.dirty.dirty).toBe(true);
  expect(result.unchangedDisk).toBe(true);
  expect(result.retry.ok).toBe(true);
  expect(result.final.dirty).toBe(false);
  expect(result.final.state).toEqual(result.dirty.state);
  await page.reload(); await page.evaluate(() => window.storageTest.ready);
  expect(await page.evaluate(() => window.storageTest.session.getSnapshot().state)).toEqual(result.final.state);
});

test('corrupt primary keeps its backup and only explicit recovery replaces it', async ({ page }) => {
  await open(page); await start(page, 'recover-browser');
  const backup = await page.evaluate(() => {
    const { session, SAVE_KEY, BACKUP_KEY } = window.storageTest; const s = session.getSnapshot(); const state = s.state;
    if (!state) throw new Error();
    session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } }, s.generation);
    const backup = localStorage.getItem(BACKUP_KEY); localStorage.setItem(SAVE_KEY, 'broken-json'); return backup;
  });
  await page.reload(); await page.evaluate(() => window.storageTest.ready);
  const result = await page.evaluate(() => {
    const { session, SAVE_KEY, BACKUP_KEY } = window.storageTest;
    const before = session.getSnapshot();
    const denied = session.recoverBackup({ generation: before.generation, confirmed: false });
    const unchanged = localStorage.getItem(SAVE_KEY);
    const restored = session.recoverBackup({ generation: session.getSnapshot().generation, confirmed: true });
    return { before, denied, unchanged, restored, backup: localStorage.getItem(BACKUP_KEY), after: session.getSnapshot() };
  });
  expect(result.before.load?.main.status).toBe('invalid');
  expect(result.denied).toMatchObject({ ok: false, error: 'confirmation_required' });
  expect(result.unchanged).toBe('broken-json');
  expect(result.restored.ok).toBe(true);
  expect(result.after.state?.revision).toBe(0);
  expect(result.after.dirty).toBe(false);
  expect(result.backup).toBe(backup);
});

test('missing lock capability enables explicit memory play and leaves the disk unchanged', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, get: () => undefined }); });
  await open(page);
  const result = await page.evaluate(() => {
    const { session, SAVE_KEY } = window.storageTest; const initial = session.getSnapshot();
    const denied = session.startNewGame({ runId: 'unsupported', seed: 'memory' }, { generation: initial.generation, confirmed: false });
    const memory = session.useMemory({ runId: 'memory-browser', seed: 'memory' }, { generation: session.getSnapshot().generation, confirmed: true });
    const s = session.getSnapshot(); const state = s.state;
    if (!state) throw new Error();
    const hit = session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } }, s.generation);
    return { initial, denied, memory, hit, current: session.getSnapshot(), disk: localStorage.getItem(SAVE_KEY) };
  });
  expect(result.initial.mode).toBe('unsupported');
  expect(result.denied).toMatchObject({ ok: false, error: 'locks_unsupported' });
  expect(result.memory.ok).toBe(true);
  expect(result.hit).toMatchObject({ ok: true, persistence: null });
  expect(result.current).toMatchObject({ mode: 'memory', dirty: true });
  expect(result.disk).toBeNull();
});

test('native storage events cannot rebase retained dirty memory over another window progress', async ({ page, context }) => {
  await open(page); await start(page, 'dirty-event');
  const unsaved = await page.evaluate(() => {
    const { session, SAVE_KEY } = window.storageTest;
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === SAVE_KEY) { Storage.prototype.setItem = native; throw new DOMException('Injected one-write failure', 'QuotaExceededError'); }
      native.call(this, key, value);
    };
    const s = session.getSnapshot(); const state = s.state;
    if (!state) throw new Error();
    session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } }, s.generation);
    return session.getSnapshot();
  });
  expect(unsaved.dirty).toBe(true);
  await page.evaluate(() => window.storageTest.session.suspend());
  const other = await context.newPage(); await open(other);
  const written = await other.evaluate(() => {
    const session = window.storageTest.session; const s = session.getSnapshot(); const state = s.state;
    if (!state) throw new Error();
    const result = session.dispatch({ runId: state.runId, expectedRevision: state.revision,
      action: { type: 'deliver', pieceId: '1:3' } }, s.generation);
    return { result, snapshot: session.getSnapshot() };
  });
  expect(written.result.ok).toBe(true);
  await page.waitForFunction(() => window.storageTest.session.getSnapshot().conflict);
  await other.evaluate(() => window.storageTest.session.suspend());
  const reactivated = await page.evaluate(() => window.storageTest.session.activate());
  expect(reactivated).toMatchObject({ mode: 'writer', dirty: true, conflict: true, state: unsaved.state });
  const resolution = await page.evaluate(() => {
    const session = window.storageTest.session; const s = session.getSnapshot();
    const retry = session.retrySave(s.generation);
    const denied = session.resume({ generation: s.generation, confirmed: false });
    const accepted = session.resume({ generation: session.getSnapshot().generation, confirmed: true });
    return { retry, denied, accepted, final: session.getSnapshot() };
  });
  expect(resolution.retry).toMatchObject({ ok: false, error: 'save_conflict' });
  expect(resolution.denied).toMatchObject({ ok: false, error: 'confirmation_required' });
  expect(resolution.accepted.ok).toBe(true);
  expect(resolution.final.state).toEqual(written.snapshot.state);
});
