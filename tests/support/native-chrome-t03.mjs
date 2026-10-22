import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// T03 only: isolated headful system Chrome by default. No user profile or Playwright lifecycle emulation.
export async function launchNativeChrome(options = {}) {
  const executablePath = options.executablePath ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const headless = options.headless ?? false;
  const protocolTimeoutMs = options.protocolTimeoutMs ?? 8000;
  const conditionTimeoutMs = options.conditionTimeoutMs ?? 10000;
  const profile = await mkdtemp(join(tmpdir(), 'sword-led-native-'));
  const command = [
    ...(headless ? ['--headless=new'] : []), '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-extensions', '--no-proxy-server', '--use-mock-keychain', 'about:blank',
  ];
  const child = spawn(executablePath, command, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const input = child.stdio[3]; const output = child.stdio[4];
  const pending = new Map(); let sequence = 0; let buffer = Buffer.alloc(0); let stderr = '';
  let finished = false, exitCode = null, exitSignal = null, processError = null;
  const observers = new Set();
  const exited = new Promise(resolve => {
    const done = () => { finished = true; resolve(); };
    child.once('exit', (code,signal) => { exitCode=code;exitSignal=signal;done(); });
    child.once('error', error => { processError=String(error);done(); });
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
      const message = JSON.parse(text);
      if (message.method) for (const observer of observers) { try { observer(message); } catch { /* A diagnostic observer cannot change the browser protocol. */ } }
      const item = pending.get(message.id);
      if (!item) continue;
      pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    }
  });
  const request = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}; ${stderr}`)); }, protocolTimeoutMs);
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
    for (const end = Date.now() + conditionTimeoutMs; Date.now() < end;) {
      try { if (await evaluate(sessionId, expression)) return; } catch (error) { lastError = error; }
      await delay(40);
    }
    throw new Error(`Native condition did not settle: ${expression}; ${lastError ?? ''}`);
  };
  const attach = async (url, targetOptions = {}) => {
    const { targetId } = await request('Target.createTarget', { url, ...(targetOptions.newWindow ? {newWindow:true} : {}) });
    const { sessionId } = await request('Target.attachToTarget', { targetId, flatten: true });
    return { targetId, sessionId };
  };
  const launch = {executablePath,headless,profile,pid:child.pid,command:[executablePath,...command]};
  return { request, evaluate, wait, attach, launch, subscribe(observer) { observers.add(observer);return()=>observers.delete(observer); }, async close() {
    abort(new Error('Native probe closed'));
    if (!finished) child.kill('SIGTERM');
    await Promise.race([exited, delay(2000)]);
    if (!finished) { child.kill('SIGKILL'); await exited; }
    await rm(profile, { recursive: true, force: true });
    observers.clear();
    return {...launch,exitCode,signal:exitSignal,error:processError,profileRemoved:true};
  } };
}
