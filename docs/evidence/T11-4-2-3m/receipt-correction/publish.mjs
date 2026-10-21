import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const sdk = await import(pathToFileURL(resolve('dist/sword-led-v4.js')).href);
const out = 'docs/evidence/T11-4-2-3m/receipt-correction';
const manifest = JSON.parse(await readFile(`${out}/run.json`, 'utf8'));
const url = 'http://127.0.0.1:4179/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const http = [];
for (const row of manifest.buildFiles) {
  const path = row.path.slice(5), response = await fetch(url + path);
  assert(response.ok, path);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())), row.sha256, path);
  http.push({ path, sha256: row.sha256 });
}
let result = sdk.createRun({ runId: 'receipt-published', seed: 'lantern-witness-0', mode: 'story', eligibility: { recipes: ['light'], challenge: false } });
assert(result.ok); let state = result.state;
result = sdk.applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action: { type: 'continue' } });
assert(result.ok); state = result.state;
const storage = new Map(), repo = sdk.createV4SaveRepository(() => ({ getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) }));
repo.load(); assert(repo.write(state).ok);
const browser = await chromium.launch(), errors = [], states = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(raw => localStorage.setItem('sword-led.save.v4', raw), storage.get('sword-led.save.v4'));
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.locator('#v4-continue').click();
  async function actual() {
    const observed = JSON.parse(await page.evaluate(() => localStorage.getItem('sword-led.save.v4'))).state;
    assert(sdk.validateRun(observed).ok); assert.deepEqual(observed, state); states.push(observed);
  }
  await actual();
  async function command(action, input) {
    const r = sdk.applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action }); assert(r.ok);
    await input(); state = r.state;
    await expect.poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem('sword-led.save.v4'))).state.revision).toBe(state.revision);
    await actual();
  }
  for (let n = 0; n < 3; n++) {
    await command({ type: 'strike', pieceId: 'd1-1' }, () => page.locator('#v4-hit').click({ position: { x: 250, y: 170 }, force: true }));
    await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy', 'false');
  }
  await command({ type: 'deliver', pieceId: 'd1-1' }, () => page.locator('#v4-notice-action').click());
  await expect(page.locator('#v4-inline-delivery')).toBeVisible();
  const checks = [];
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const check = await page.locator('#v4-deliver').evaluate(button => {
      const box = button.getBoundingClientRect(), top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { buttonOwnsCenter: button === top || button.contains(top), bottom: box.bottom, settleTop: document.querySelector('#v4-settle').getBoundingClientRect().top };
    });
    assert(check.buttonOwnsCenter && check.bottom < check.settleTop); checks.push({ size, ...check });
  }
  await command({ type: 'deliver', pieceId: 'd1-2' }, () => page.locator('#v4-deliver').click());
  assert.equal(errors.length, 0);
  await writeFile(`${out}/published.json`, JSON.stringify({ at: new Date().toISOString(), url, snapshot: manifest.snapshot, previewPid: 62339, previewSession: 58313, http, realLeftClicks: 3, directNoticeDelivery: 1, explicitSale: 1, checks, states, errors, userProfileTouched: false }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, http: http.length, actualUiCommands: 5, states: states.length, checks: checks.length, errors }));
} finally { await browser.close(); }
