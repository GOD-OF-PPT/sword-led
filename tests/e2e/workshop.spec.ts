import { expect, test } from './fixtures';
import { openGame, preciseKeyStrike, readRun, startGame } from './helpers';

test('production entry accepts a precise keyboard strike and saves it once', async ({ page }) => {
  const errors: string[] = [];page.on('pageerror', error => errors.push(error.message));
  await openGame(page);await startGame(page);
  await preciseKeyStrike(page);
  const state = await readRun(page);
  expect(state.revision).toBe(1);expect(state.stats.strikes).toBe(1);expect(state.rng.strike.draws).toBe(1);
  expect(state.journal[0]).toMatchObject({ type: 'strike', mode: 'standard', timingMark: 5000 });
  expect(state.pieces[0]).toMatchObject({ progress: 3, heat: 88 });
  await expect(page.locator('#saved')).toHaveText('已保存');expect(errors).toEqual([]);
});

test('real native keyboard events also reach the kernel without a controlled clock', async ({ page }) => {
  await openGame(page, false);await startGame(page, 'native-input');
  await page.locator('#strike').focus();await page.keyboard.down('Space');await page.waitForTimeout(350);await page.keyboard.up('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-revision', '1');
  const state = await readRun(page);expect(state.stats.strikes).toBe(1);expect(state.pieces[0].heat).toBe(88);
  const event = state.journal[0];expect(event?.type).toBe('strike');
  if (event?.type === 'strike') expect(event.timingMark).toBeGreaterThanOrEqual(0);
});

test('mixed pointer/space and duplicate releases cannot dispatch a second strike', async ({ page }) => {
  await openGame(page);await startGame(page);
  const box = await page.locator('#strike').boundingBox();if (!box) throw new Error('No strike area');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);await page.mouse.down();
  await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');
  expect((await readRun(page)).revision).toBe(0);
  await page.mouse.move(8, 8);await page.mouse.up();await page.clock.runFor(500);
  expect((await readRun(page)).stats.strikes).toBe(1);
  await page.keyboard.up('Space');await page.mouse.up();expect((await readRun(page)).stats.strikes).toBe(1);
});

test('target, hammer and pause cancellation consume no resources or random draws', async ({ page }) => {
  await openGame(page);await startGame(page);
  for (const key of ['2', 'e', 'Escape']) {
    await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);
    await page.keyboard.press(key);await page.keyboard.up('Space');
    expect((await readRun(page)).revision).toBe(0);
    if (key === 'Escape') await page.getByRole('button', { name: '继续锻造', exact: true }).click();
  }
  expect((await readRun(page)).rng.strike.draws).toBe(0);
});

test('tutorial can be practised, skipped and replayed without touching the formal slot', async ({ page }) => {
  await openGame(page);await startGame(page);const before = await page.evaluate(() => localStorage.getItem('sword-led.save.v1'));
  await page.locator('#menu-logo').click();await page.locator('#practice').click();
  await expect(page.locator('#lesson-banner')).toBeVisible();await preciseKeyStrike(page, 600);
  await page.locator('#lesson-next').click();await expect(page.locator('#integrity')).toHaveText('1 / 4');
  await page.locator('#lesson-exit').click();await page.locator('#continue').click();
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBe(before);
  expect((await readRun(page)).revision).toBe(0);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) test(`workshop stays readable and reachable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
  await page.setViewportSize(viewport);await openGame(page);await startGame(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const selector of ['#strike', '#risk-row', '#piece-1', '#piece-2', '#piece-3', '#settle-button', '#break-warning']) await expect(page.locator(selector)).toBeInViewport({ ratio: .95 });
  await page.screenshot({ path: info.outputPath(`workshop-${viewport.width}.png`) });
  await info.attach(`workshop-${viewport.width}`, { path: info.outputPath(`workshop-${viewport.width}.png`), contentType: 'image/png' });
});
