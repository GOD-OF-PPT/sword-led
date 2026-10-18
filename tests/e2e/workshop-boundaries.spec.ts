import { expect, test } from './fixtures';
import { getRunView } from '../../src/core/index.js';
import { openGame, preciseKeyStrike, readRun, startGame } from './helpers';

test('controlled release uses its timestamp while the displayed frame is still at zero', async ({ page }) => {
  await openGame(page);await startGame(page);
  const markBeforeRelease = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('#strike');if (!button) throw new Error('No strike');
    const time = performance.now();
    const down = new PointerEvent('pointerdown', { bubbles: true, pointerId: 77, isPrimary: true, button: 0 });
    Object.defineProperty(down, 'timeStamp', { value: time });button.dispatchEvent(down);
    const before = document.querySelector<HTMLElement>('#timing-track')?.dataset.mark;
    const up = new PointerEvent('pointerup', { bubbles: true, pointerId: 77, isPrimary: true, button: 0 });
    Object.defineProperty(up, 'timeStamp', { value: time + 350 });window.dispatchEvent(up);return before;
  });
  expect(markBeforeRelease).toBe('0');expect((await readRun(page)).journal[0]).toMatchObject({ type: 'strike', timingMark: 5000 });
});

test('repeat keydown and inputs during feedback cannot add commands', async ({ page }) => {
  await openGame(page);await startGame(page);await page.locator('#strike').focus();
  await page.keyboard.down('Space');await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');
  await expect(page.locator('#strike')).toBeDisabled();
  await page.locator('#strike').dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerId: 1 });
  await page.locator('#strike').dispatchEvent('pointerup', { button: 0, isPrimary: true, pointerId: 1 });
  expect((await readRun(page)).revision).toBe(1);await page.clock.runFor(500);
  expect((await readRun(page)).rng.strike.draws).toBe(1);
});

test('element blur and pointer cancellation do not consume a strike', async ({ page }) => {
  await openGame(page);await startGame(page);await page.locator('#strike').focus();
  await page.keyboard.down('Space');await page.clock.runFor(350);await page.locator('#mode-heavy').focus();await page.keyboard.up('Space');
  expect((await readRun(page)).revision).toBe(0);
  const box = await page.locator('#strike').boundingBox();if (!box) throw new Error('No strike');
  await page.mouse.move(box.x + 20, box.y + 20);await page.mouse.down();await page.clock.runFor(350);
  await page.locator('#strike').dispatchEvent('pointercancel', { pointerId: 1 });await page.mouse.up();
  expect((await readRun(page)).revision).toBe(0);
});

test('cancelling a resized confirmation restores controls and focus without changing the piece', async ({ page }) => {
  await openGame(page);await startGame(page);const before = await readRun(page);
  const oldCanvasWidth = await page.locator('#forge-scene').evaluate(canvas => (canvas as HTMLCanvasElement).width);
  await page.locator('#deliver-button').click();await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(() => page.locator('#forge-scene').evaluate(canvas => (canvas as HTMLCanvasElement).width)).not.toBe(oldCanvasWidth);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#deliver-button')).toBeEnabled();await expect(page.locator('#deliver-button')).toBeFocused();
  expect(await readRun(page)).toEqual(before);await preciseKeyStrike(page);expect((await readRun(page)).revision).toBe(1);
});

test('slow timing changes only the period, and a changed setting cancels the held input', async ({ page }) => {
  await openGame(page);await startGame(page);await page.locator('#strike').focus();await page.keyboard.down('Space');
  await page.clock.runFor(350);await page.keyboard.press('Escape');await page.getByRole('button', { name: '操作设置', exact: true }).click();
  await page.locator('#slow-setting').check();await page.keyboard.up('Space');
  await page.getByRole('button', { name: '返回暂停', exact: true }).click();await page.getByRole('button', { name: '继续锻造', exact: true }).click();
  expect((await readRun(page)).revision).toBe(0);await preciseKeyStrike(page, 525);
  const state = await readRun(page);expect(state.journal[0]).toMatchObject({ timingMark: 5000 });expect(state.pieces[0]).toMatchObject({ progress: 3, heat: 88 });
});

test('reload during feedback restores the accepted result without replaying it', async ({ page }) => {
  await openGame(page);await startGame(page);await page.locator('#strike').focus();await page.keyboard.down('Space');
  await page.clock.runFor(350);await page.keyboard.up('Space');const accepted = await readRun(page);
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();
  expect(await readRun(page)).toEqual(accepted);await expect(page.locator('#piece-progress')).toHaveText('3 / 5');
  await expect(page.locator('#feedback')).toBeEmpty();
});

test('a newly signed contract is not changed by an old feedback callback', async ({ page }) => {
  await openGame(page);await startGame(page);await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');
  await page.locator('#menu-logo').click();await page.locator('#new-game').click();await page.locator('#seed').fill('replacement-after-hit');
  await page.getByRole('button', { name: '覆盖并开始新契约', exact: true }).click();await page.getByRole('button', { name: '开始锻造', exact: true }).click();
  await page.clock.runFor(1200);const state = await readRun(page);expect(state.seed).toBe('replacement-after-hit');expect(state.revision).toBe(0);expect(state.rng.strike.draws).toBe(0);
});

test('the second same-origin tab is read-only but can practice without rewriting the slot', async ({ page, context }) => {
  await openGame(page);await startGame(page);const before = await page.evaluate(() => localStorage.getItem('sword-led.save.v1'));
  const other = await context.newPage();await other.goto('/');await expect(other.locator('#menu')).toBeVisible();
  await expect(other.locator('#new-game')).toBeDisabled();await expect(other.locator('#menu-storage')).toContainText('只可查看');
  await other.locator('#continue').click();await expect(other.locator('#strike')).toBeDisabled();
  await other.locator('#menu-logo').click();await other.locator('#practice').click();await other.locator('#lesson-next').click();
  await expect(other.locator('#integrity')).toHaveText('1 / 4');expect(await other.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBe(before);await other.close();
});

test('write failure retains accepted memory across the menu and retries the same result', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'sword-led.save.v1' && Reflect.get(window, 'uiSaveFault')) throw new DOMException('Quota', 'QuotaExceededError');return original.call(this, key, value); };
  });
  await openGame(page);await startGame(page);await page.evaluate(() => Reflect.set(window, 'uiSaveFault', true));await preciseKeyStrike(page);
  await expect(page.locator('#app')).toHaveAttribute('data-revision', '1');expect((await readRun(page)).revision).toBe(0);
  await expect(page.locator('#storage-text')).toContainText('尚未保存');await page.locator('#menu-logo').click();await page.locator('#continue').click();
  await expect(page.locator('#piece-progress')).toHaveText('3 / 5');await expect(page.locator('#app')).toHaveAttribute('data-revision', '1');
  await page.locator('#retry-save').click();await expect(page.locator('#storage-text')).toContainText('尚未保存');
  await page.evaluate(() => Reflect.set(window, 'uiSaveFault', false));await page.locator('#retry-save').click();
  const saved = await readRun(page);expect(saved.revision).toBe(1);expect(saved.stats.strikes).toBe(1);expect(saved.rng.strike.draws).toBe(1);
  await expect(page.locator('#saved')).toHaveText('已保存');
  await expect(page.locator('#game-note')).toContainText('已保存');
});

test('asset-load failure can retry without erasing a saved run', async ({ page, runtimeAudit }) => {
  runtimeAudit.allowHttpStatus(503);
  await openGame(page);await startGame(page);await preciseKeyStrike(page);const before = await page.evaluate(() => localStorage.getItem('sword-led.save.v1'));
  await page.route('**/assets/b/hammer-standard-v1.webp', route => route.fulfill({ status: 503, body: 'temporarily unavailable' }));
  await page.reload();await expect(page.locator('#retry-art')).toBeVisible();expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBe(before);
  await page.unroute('**/assets/b/hammer-standard-v1.webp');await page.locator('#retry-art').click();await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#continue').click();expect((await readRun(page)).revision).toBe(1);
});

test('seed input and menu previews treat external text as text', async ({ page }) => {
  await openGame(page);const seed = '<img src=x onerror=window.xss=1>';await startGame(page, seed);await page.locator('#menu-logo').click();
  await expect(page.locator('#save-preview')).toContainText(seed);expect(await page.locator('img[src=x]').count()).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, 'xss') ?? 0)).toBe(0);expect((await readRun(page)).seed).toBe(seed);
});

test('held Enter cannot submit a newly opened contract dialog or skip the introduction', async ({ page }) => {
  await openGame(page);await page.locator('#new-game').focus();await page.keyboard.down('Enter');
  await expect(page.locator('#seed')).toBeVisible();await page.keyboard.down('Enter');
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBeNull();
  await page.keyboard.up('Enter');await page.locator('#seed').fill('keyboard-dialog');await page.keyboard.down('Enter');await page.keyboard.down('Enter');
  await expect(page.locator('#dialog-title')).toHaveText('今天，先看订单');expect((await readRun(page)).revision).toBe(0);
  await page.keyboard.up('Enter');
});

test('delivery, recycling and round exit use the real order ledger', async ({ page }) => {
  await openGame(page);await startGame(page);await page.locator('#deliver-button').click();await page.getByRole('button', { name: '确认交货', exact: true }).click();await page.clock.runFor(500);
  await expect(page.locator('#coins')).toHaveText('18');await expect(page.locator('#delivered')).toHaveText('已交货 18 / 120');
  await page.locator('#piece-1').click();await expect(page.locator('#deliver-button')).toBeDisabled();await expect(page.locator('#piece-value-label')).toHaveText('交货所得');
  await page.locator('#piece-2').click();await page.locator('#recycle-button').click();await page.getByRole('button', { name: '确认回收', exact: true }).click();await page.clock.runFor(500);
  await page.locator('#settle-button').click();await page.getByRole('button', { name: '回收余件并结算', exact: true }).click();
  const settled = await readRun(page);expect(settled.phase).toBe('roundSummary');expect(settled).toMatchObject({ coins: 18, scrap: 7, seals: 2 });
  await page.getByRole('button', { name: '进入下一轮', exact: true }).click();await expect(page.locator('#delivered')).toHaveText('已交货 0 / 150');await expect(page.locator('#coins')).toHaveText('18');
});

test('a real critical steel piece displays all three actual break risks', async ({ page }, info) => {
  await openGame(page);await startGame(page, 'critical-steel-0');await page.locator('#piece-3').click();await page.locator('#mode-heavy').click();
  for (let hit = 0; hit < 5; hit++) await preciseKeyStrike(page, 0);
  const state = await readRun(page), view = getRunView(state, { pieceId: '1:3', mode: 'heavy' });
  expect(view.selected).toMatchObject({ integrity: 1, progress: 9, heat: 10, stress: 72 });
  for (const risk of view.selected?.risk ?? []) { expect(risk.breakRiskPct).toBe(risk.damageRiskPct);await expect(page.locator(`#risk-${risk.grade}`)).toContainText(`${risk.damageRiskPct}%`); }
  await expect(page.locator('#break-warning')).toHaveText('只剩 1 格：裂损即破碎！');await expect(page.locator('#strike')).toBeEnabled();
  const file = info.outputPath('critical-steel.png');await page.screenshot({ path: file });await info.attach('critical-steel', { path: file, contentType: 'image/png' });
});

test('explicit memory play never writes and never presents a later contract as saved', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, get: () => undefined }); });
  await openGame(page);await expect(page.locator('#new-game')).toBeDisabled();await page.locator('#memory-game').click();await page.locator('#seed').fill('memory-only');
  await page.getByRole('button', { name: '开始不保存试玩', exact: true }).click();await page.getByRole('button', { name: '开始锻造', exact: true }).click();await preciseKeyStrike(page);
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBeNull();await expect(page.locator('#saved')).toHaveText('不保存试玩');
  await page.locator('#menu-logo').click();await expect(page.locator('#new-game')).toHaveText('另开试玩');await page.locator('#new-game').click();
  await expect(page.getByRole('button', { name: '开始不保存试玩', exact: true })).toBeVisible();await page.getByRole('button', { name: '取消', exact: true }).click();
});
