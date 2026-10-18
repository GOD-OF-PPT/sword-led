import { readFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';
import { openGame, readRun, startGame } from './helpers';
import { validateRun } from '../../src/core/index.js';
import type { Action, RunState } from '../../src/core/index.js';
import { gradeOf, HAMMERS } from '../../src/core/rules.js';
import { textReadability } from './readability';

function witness(file: string): RunState {
  const raw: unknown = JSON.parse(readFileSync(new URL(`../../docs/evidence/T06/${file}`, import.meta.url), 'utf8'));
  if (!raw || typeof raw !== 'object') throw new Error('No witness');
  const checked = validateRun('state' in raw ? raw.state : raw);if (!checked.ok) throw new Error(checked.detail);return checked.state;
}
async function rawSave(page: Page) { return page.evaluate(() => localStorage.getItem('sword-led.save.v1')); }
async function confirm(page: Page, label: string) { await page.getByRole('button', { name: label, exact: true }).click(); }

/** Only public DOM controls and native key events. No state/command/test hooks in the page. */
async function inputAction(page: Page, action: Action) {
  if ('pieceId' in action) {
    const slot = action.pieceId.split(':')[1];await page.locator(`#piece-${slot}`).click();
  }
  if (action.type === 'strike') {
    await page.locator(`#mode-${action.mode}`).click();
    await page.locator('#strike').focus();await page.keyboard.down('Space');
    const period = HAMMERS[action.mode].periodMs;
    let hold = Math.round(action.timingMark * period / 20000);
    // Millisecond Clock quantization must not turn a boundary ordinary hit into a precise hit.
    const projected = () => Math.round(hold * 20000 / period);
    while (gradeOf(projected(), 0) !== gradeOf(action.timingMark, 0)) hold += projected() < action.timingMark ? 1 : -1;
    await page.clock.runFor(hold);await page.keyboard.up('Space');await page.clock.runFor(500);
  } else if (action.type === 'heat') { await page.locator('#heat-button').click();await page.clock.runFor(500); }
  else if (action.type === 'deliver' || action.type === 'recycle') {
    await page.locator(action.type === 'deliver' ? '#deliver-button' : '#recycle-button').click();
    await confirm(page, action.type === 'deliver' ? '确认交货' : '确认回收');await page.clock.runFor(500);
  } else if (action.type === 'settleRound') {
    await page.locator('#settle-button').click();if (action.recycleRemaining) await confirm(page, '回收余件并结算');
  } else if (action.type === 'advanceSummary') await page.locator('#phase-advance').click();
  else if (action.type === 'buy') { await page.locator(`#buy-${action.productId}`).click();await confirm(page, '确认购买'); }
  else if (action.type === 'leaveMerchant') { await page.locator('#phase-leave').click();await confirm(page, '离开并开炉'); }
}

async function capture(page: Page, info: TestInfo, name: string) {
  const text = await textReadability(page, '#phase-panel h1,#phase-panel h3,#phase-panel p,#phase-panel dt,#phase-panel dd,#phase-panel button,#phase-panel summary,#phase-panel th,#phase-panel td,#phase-panel li,#phase-panel span');
  expect(text.filter(item => item.fontSize < 12 || item.contrast < 4.5)).toEqual([]);
  await info.attach(`${name}-readability`, { body: Buffer.from(JSON.stringify(text)), contentType: 'application/json' });
  const path = info.outputPath(`${name}.png`);await page.screenshot({ path });await info.attach(name, { path, contentType: 'image/png' });
}
async function visibleFooter(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.locator('#phase-actions button').all()) {
    const box = await button.boundingBox();expect(box).not.toBeNull();
    if (box) { expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y + box.height).toBeLessThanOrEqual((await page.viewportSize())!.height);expect(box.height).toBeGreaterThanOrEqual(40); }
  }
}
async function visibleMerchandise(page: Page) {
  const clip = await page.locator('.phase-scroll').boundingBox();if (!clip) throw new Error('No merchant viewport');
  for (const card of await page.locator('.offer').all()) {
    const box = await card.boundingBox();if (!box) throw new Error('No merchandise');
    expect(box.y).toBeGreaterThanOrEqual(clip.y);expect(box.y + box.height).toBeLessThanOrEqual(clip.y + clip.height + 1);
  }
}

test('cancelled disposal and early closure retain the contract; receipts survive reload without a second penalty', async ({ page }, info) => {
  await openGame(page);await startGame(page, 'flow-cancel');const initial = await rawSave(page);
  for (const id of ['#deliver-button', '#recycle-button', '#settle-button']) {
    await page.locator(id).click();await confirm(page, '取消');expect(await rawSave(page)).toBe(initial);await expect(page.locator(id)).toBeFocused();
  }
  await page.locator('#settle-button').click();await expect(page.locator('#dialog-body')).toContainText('共 10 废料');await expect(page.locator('#dialog-body')).toContainText('3 → 2');
  await confirm(page, '回收余件并结算');const settled = await readRun(page);
  expect(settled).toMatchObject({ phase: 'roundSummary', seals: 2, coins: 0, scrap: 10 });
  await expect(page.locator('.receipt-piece')).toHaveCount(3);await expect(page.locator('#phase-title')).toHaveText('订单未达标');
  await expect(page.locator('#phase-title')).toBeFocused();await expect(page.locator('#game-note')).toHaveText('订单未达标，扣除 1 枚印记');
  await visibleFooter(page);await capture(page, info, 'summary-missed-1280');
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();
  expect(await readRun(page)).toEqual(settled);await expect(page.locator('.receipt-piece')).toHaveCount(3);
  await page.locator('#phase-advance').click();await expect(page.locator('#round')).toHaveText('第 2 / 12 轮');
  expect((await readRun(page)).scrap).toBe(10);await expect(page.locator('#game-note')).toContainText('三件新来料');
});

test('a complete UI contract reaches all three merchants and victory, retains the ledger and restarts cleanly', async ({ page }, info) => {
  test.setTimeout(600000);
  const reference = witness('verify-v1.medium-victory.json');
  await openGame(page);await startGame(page, reference.seed);
  const stages: { revision: number; round: number; phase: string; coins: number; scrap: number; seals: number }[] = [];
  let visits = 0, metCaptured = false, missedCaptured = false;
  for (const [index, action] of reference.journal.entries()) {
    await inputAction(page, action);await expect(page.locator('#app')).toHaveAttribute('data-revision', String(index + 1));
    if (action.type === 'settleRound' || action.type === 'advanceSummary' || action.type === 'leaveMerchant' || action.type === 'buy') {
      const run = await readRun(page);stages.push({ revision: run.revision, round: run.round, phase: run.phase, coins: run.coins, scrap: run.scrap, seals: run.seals });
      if (run.phase === 'roundSummary') {
        await expect(page.locator('.receipt-piece')).toHaveCount(3);await visibleFooter(page);
        const met = run.history.at(-1)?.metQuota;
        if ((met && !metCaptured) || (!met && !missedCaptured)) {
          await capture(page, info, met ? 'summary-met-1280' : 'summary-missed-full-run');if (met) metCaptured = true;else missedCaptured = true;
        }
      }
      if (run.phase === 'merchant' && action.type === 'advanceSummary') {
        visits++;expect([3, 6, 9]).toContain(run.round);await expect(page.locator('.offer')).toHaveCount(4);await expect(page.locator('#phase-title')).toBeFocused();
        const before = await rawSave(page);
        await page.locator('#phase-leave').click();await confirm(page, '取消');expect(await rawSave(page)).toBe(before);await expect(page.locator('#phase-leave')).toBeFocused();
        const nextBuy = reference.journal[index + 1];
        if (nextBuy?.type === 'buy') { await page.locator(`#buy-${nextBuy.productId}`).click();await confirm(page, '取消');expect(await rawSave(page)).toBe(before);await expect(page.locator(`#buy-${nextBuy.productId}`)).toBeFocused(); }
        await visibleFooter(page);await visibleMerchandise(page);await capture(page, info, `merchant-${run.round}-1280`);
        if (run.round === 3) {
          await page.setViewportSize({ width: 1920, height: 1080 });await visibleFooter(page);await visibleMerchandise(page);await capture(page, info, 'merchant-3-1920');
          await page.setViewportSize({ width: 1280, height: 720 });
          await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();expect(await readRun(page)).toEqual(run);
        }
      }
      if (action.type === 'buy') {
        await expect(page.locator(`#buy-${action.productId}`)).toBeDisabled();await expect(page.locator(`[data-product=${action.productId}]`)).toContainText('本次已购');
        await expect(page.locator('#phase-title')).toBeFocused();
        // Re-reading a bought offer must preserve the one-time purchase and wallet.
        if (run.round === 6) { await page.locator('#phase-menu').click();await page.locator('#continue').click();expect(await readRun(page)).toEqual(run);await expect(page.locator(`#buy-${action.productId}`)).toBeDisabled(); }
      }
    }
  }
  const final = await readRun(page);expect(final.phase).toBe('victory');expect(visits).toBe(3);expect(final.revision).toBe(336);
  const { runId: ignoredActualId, journal: actualJournal, ...actual } = final;
  const { runId: ignoredExpectedId, journal: expectedJournal, ...expected } = reference;
  expect(actual).toEqual(expected);expect(actualJournal).toHaveLength(expectedJournal.length);
  for (let i = 0; i < actualJournal.length; i++) {
    const a = actualJournal[i], b = expectedJournal[i];
    if (a?.type === 'strike' && b?.type === 'strike') expect(gradeOf(a.timingMark, 0)).toBe(gradeOf(b.timingMark, 0));else expect(a).toEqual(b);
  }
  await expect(page.locator('#phase-title')).toHaveText('契约期完成');await expect(page.locator('#phase-content')).toContainText('3268');
  await visibleFooter(page);await capture(page, info, 'victory-1280');
  await page.locator('.ending-ledger summary').click();await expect(page.locator('tbody tr')).toHaveCount(12);await expect(page.locator('.ending-ledger li')).toHaveCount(final.purchases.length);
  await visibleFooter(page);await capture(page, info, 'victory-ledger-1280');
  await page.setViewportSize({ width: 1920, height: 1080 });await visibleFooter(page);await capture(page, info, 'victory-ledger-1920');
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();expect(await readRun(page)).toEqual(final);
  await page.locator('#phase-replay').click();await expect(page.locator('#seed')).toHaveValue(reference.seed);await confirm(page, '取消');expect(await readRun(page)).toEqual(final);await expect(page.locator('#phase-replay')).toBeFocused();
  await page.locator('#phase-replay').click();await confirm(page, '覆盖并开始新契约');await confirm(page, '开始锻造');
  const restarted = await readRun(page);expect(restarted.runId).not.toBe(final.runId);expect(restarted).toMatchObject({ seed: reference.seed, revision: 0, round: 1, coins: 0, scrap: 0, seals: 3 });
  expect(restarted.purchases).toHaveLength(0);expect(restarted.history).toHaveLength(0);expect(restarted.rng.strike.draws).toBe(0);
  await info.attach('complete-victory-run', { body: Buffer.from(JSON.stringify({ method: 'native keyboard + controlled Clock, DOM buttons only; no state injection', browser: await page.context().browser()?.version(), stages, state: final }, null, 2)), contentType: 'application/json' });
});

test('a separate normal UI run loses the last seal, offers no final merchant and can start a different seed', async ({ page }, info) => {
  const reference = witness('verify-v1.raw-defeat.json');await openGame(page);await startGame(page, reference.seed);
  for (const action of reference.journal) await inputAction(page, action);
  const final = await readRun(page);expect(final).toMatchObject({ phase: 'defeat', round: 3, seals: 0, revision: 14 });
  await expect(page.locator('#phase-title')).toHaveText('契约终止');await expect(page.locator('#game-note')).toHaveText('契约印记耗尽，契约终止');
  expect(await page.locator('#phase-leave').count()).toBe(0);expect(await page.locator('#phase-advance').count()).toBe(0);
  await visibleFooter(page);await capture(page, info, 'defeat-1280');await page.setViewportSize({ width: 1920, height: 1080 });await visibleFooter(page);await capture(page, info, 'defeat-1920');
  await page.locator('.ending-ledger summary').click();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('.ending-ledger')).toContainText('本局没有购买');
  await page.locator('#phase-new').click();await expect(page.locator('#seed')).toHaveValue('');await page.locator('#seed').fill('different-contract');
  await confirm(page, '覆盖并开始新契约');await confirm(page, '开始锻造');expect((await readRun(page)).seed).toBe('different-contract');
  await info.attach('complete-defeat-run', { body: Buffer.from(JSON.stringify({ method: 'normal DOM delivery and round controls; no state injection', state: final }, null, 2)), contentType: 'application/json' });
});

test('handle and repair purchases, scrap shortage, visit limits and next-round upgrade effects use real UI receipts', async ({ page }, info) => {
  test.setTimeout(300000);const reference = witness('concept-b-state.json');await openGame(page);await startGame(page, reference.seed);
  for (const action of reference.journal) {
    await inputAction(page, action);
    if (action.type === 'buy' && action.productId === 'anvil') {
      const before = await readRun(page);expect(before).toMatchObject({ round: 3, coins: 214, scrap: 1 });
      await expect(page.locator('#buy-bellows')).toBeDisabled();await expect(page.locator('[data-product=bellows]')).toContainText('废料不足');
      await expect(page.locator('#buy-handle')).toBeDisabled();expect(await readRun(page)).toEqual(before);
    }
  }
  const reached = await readRun(page);expect(reached).toMatchObject({ round: 6, coins: 585, scrap: 6, seals: 2 });
  await page.locator('#settle-button').click();await confirm(page, '回收余件并结算');await page.locator('#phase-advance').click();
  const before = await readRun(page);expect(before).toMatchObject({ coins: 585, scrap: 16, seals: 1 });
  await page.locator('#buy-repair').click();await expect(page.locator('#dialog-body')).toContainText('1 → 2');await confirm(page, '取消');expect(await readRun(page)).toEqual(before);
  await inputAction(page, { type: 'buy', productId: 'repair' });const repaired = await readRun(page);
  expect(repaired).toMatchObject({ coins: 345, scrap: 10, seals: 2 });await expect(page.locator('#buy-repair')).toBeDisabled();
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();expect(await readRun(page)).toEqual(repaired);await expect(page.locator('#buy-repair')).toBeDisabled();
  await inputAction(page, { type: 'buy', productId: 'handle' });await inputAction(page, { type: 'buy', productId: 'bellows' });
  const bought = await readRun(page);expect(bought).toMatchObject({ coins: 45, scrap: 1, seals: 2, upgrades: { handle: 2, bellows: 1, anvil: 1 } });
  await expect(page.locator('#buy-anvil')).toBeDisabled();await expect(page.locator('[data-product=anvil]')).toContainText('金币不足');
  await visibleFooter(page);await visibleMerchandise(page);await capture(page, info, 'merchant-repair-and-limits-1280');
  await inputAction(page, { type: 'leaveMerchant' });const next = await readRun(page);expect(next).toMatchObject({ round: 7, coal: 2, coins: 45, scrap: 1 });
  expect(next.pieces).toHaveLength(3);
  const preciseWidth = await page.locator('.band.precise').boundingBox(), track = await page.locator('#timing-track').boundingBox();
  if (!preciseWidth || !track) throw new Error('No timing bands');expect(preciseWidth.width / (track.width - 4)).toBeCloseTo(.2, 2);
  await info.attach('repair-and-upgrade-run', { body: Buffer.from(JSON.stringify({ before, repaired, bought, next }, null, 2)), contentType: 'application/json' });
});
