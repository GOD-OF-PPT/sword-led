import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Real Chrome pipe protocol without Playwright Page lifecycle emulation.
export async function launchNativeChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'sword-led-native-'));
  const child = spawn(chromium.executablePath(), [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-extensions', '--no-proxy-server', '--use-mock-keychain', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const input = child.stdio[3]; const output = child.stdio[4];
  const pending = new Map(); let sequence = 0; let buffer = Buffer.alloc(0); let stderr = '';
  let finished = false;
  const exited = new Promise(resolve => {
    const done = () => { finished = true; resolve(); };
    child.once('exit', done); child.once('error', done);
  });
  const abort = error => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
  };
  child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-4096); });
  child.on('error', abort); child.once('exit', () => abort(new Error(`Chrome exited: ${stderr}`)));
  input.on('error', abort); output.on('error', abort);
  output.on('data', bytes => {
    buffer = Buffer.concat([buffer, bytes]);
    for (let end; (end = buffer.indexOf(0)) !== -1;) {
      const text = buffer.subarray(0, end).toString(); buffer = buffer.subarray(end + 1);
      if (!text) continue;
      const message = JSON.parse(text); const item = pending.get(message.id);
      if (!item) continue;
      pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    }
  });
  const request = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}; ${stderr}`)); }, 8000);
    timer.unref(); pending.set(id, { resolve, reject, timer });
    input.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
  const evaluate = async (sessionId, expression) => {
    const result = await request('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (sessionId, expression) => {
    let lastError;
    for (const end = Date.now() + 10000; Date.now() < end;) {
      try { if (await evaluate(sessionId, expression)) return; } catch (error) { lastError = error; }
      await delay(40);
    }
    throw new Error(`Native condition did not settle: ${expression}; ${lastError ?? ''}`);
  };
  const attach = async url => {
    const { targetId } = await request('Target.createTarget', { url });
    const { sessionId } = await request('Target.attachToTarget', { targetId, flatten: true });
    return { targetId, sessionId };
  };
  return { request, evaluate, wait, attach, async close() {
    abort(new Error('Native probe closed'));
    if (!finished) child.kill('SIGTERM');
    await Promise.race([exited, delay(2000)]);
    if (!finished) { child.kill('SIGKILL'); await exited; }
    await rm(profile, { recursive: true, force: true });
  } };
}
