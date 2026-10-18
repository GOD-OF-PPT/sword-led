import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { validateRun } from '../../src/core/index.js';
import type { RunState } from '../../src/core/index.js';

export async function openGame(page: Page, clock = true) {
  if (clock) await page.clock.install({ time: new Date('2026-10-18T06:00:00.000Z') });
  await page.goto('/');await expect(page.locator('#menu')).toBeVisible();
  if (clock) await page.clock.pauseAt(new Date('2026-10-18T06:01:00.000Z'));
}
export async function startGame(page: Page, seed = 'workshop-browser') {
  await page.locator('#new-game').click();await page.getByLabel('契约种子（留空随机）').fill(seed);
  await page.getByRole('button', { name: '签订新契约', exact: true }).click();
  await page.getByRole('button', { name: '开始锻造', exact: true }).click();
  await expect(page.locator('#workshop')).toBeVisible();
}
export async function readRun(page: Page): Promise<RunState> {
  const raw: unknown = await page.evaluate(() => { const saved = localStorage.getItem('sword-led.save.v1');return saved ? JSON.parse(saved) : null; });
  if (!raw || typeof raw !== 'object' || !('state' in raw)) throw new Error('No real saved run');
  const checked = validateRun(raw.state);if (!checked.ok) throw new Error(checked.detail);return checked.state;
}
export async function preciseKeyStrike(page: Page, hold = 350) {
  await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(hold);
  await page.keyboard.up('Space');await page.clock.runFor(500);
}
