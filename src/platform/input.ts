import { sameInput, StrikeAttempt, timingMarkAt } from './timing.js';
import type { InputIdentity, ReleasedAttempt } from './timing.js';

export type InputVisual = { readonly preparing: false; readonly mark: 0 } | { readonly preparing: true; readonly mark: number };
interface InputHost {
  context(): InputIdentity | null;
  release(attempt: ReleasedAttempt): void;
  visual(state: InputVisual): void;
}

export function bindStrikeInput(button: HTMLButtonElement, host: InputHost) {
  const attempt = new StrikeAttempt();
  const suppressed = new Set<string>();
  let frame = 0, pointer: number | null = null, disposed = false;
  const stamp = (event: Event) => Number.isFinite(event.timeStamp) && event.timeStamp >= 0 ? event.timeStamp : performance.now();
  const clearVisual = () => {
    cancelAnimationFrame(frame);frame = 0;
    const previous = pointer;pointer = null;
    if (previous !== null) { try { if (button.hasPointerCapture(previous)) button.releasePointerCapture(previous); } catch { /* Capture may already be released. */ } }
    host.visual({ preparing: false, mark: 0 });
  };
  const cancel = () => { if (attempt.current) { attempt.cancel();clearVisual(); } };
  const refresh = () => { if (attempt.current && !sameInput(attempt.current.identity, host.context())) cancel(); };
  const animate = (id: number) => {
    const current = attempt.current;
    if (disposed || !current || current.id !== id) return;
    if (!sameInput(current.identity, host.context())) { cancel();return; }
    host.visual({ preparing: true, mark: timingMarkAt(performance.now() - current.startedAt, current.identity.periodMs) });
    frame = requestAnimationFrame(() => animate(id));
  };
  const begin = (owner: string, event: Event) => {
    if (disposed || !attempt.start(host.context(), owner, stamp(event))) return false;
    const current = attempt.current;
    if (current) { host.visual({ preparing: true, mark: 0 });frame = requestAnimationFrame(() => animate(current.id)); }
    return true;
  };
  const finish = (owner: string, event: Event) => {
    const previous = attempt.current;
    const released = attempt.release(owner, stamp(event), host.context());
    if (previous && !attempt.current) clearVisual();
    if (released) host.release(released);
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || button.disabled) return;
    event.preventDefault();button.focus({ preventScroll: true });
    if (begin(`pointer:${event.pointerId}`, event)) {
      pointer = event.pointerId;
      try { button.setPointerCapture(event.pointerId); } catch { /* Synthetic test events do not own a native pointer. */ }
    }
  };
  const up = (event: PointerEvent) => { if (event.button === 0) finish(`pointer:${event.pointerId}`, event); };
  const pointerCancelled = (event: PointerEvent) => { if (attempt.current?.owner === `pointer:${event.pointerId}`) cancel(); };
  const keyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    if (event.ctrlKey || event.metaKey || event.altKey) { cancel();return; }
    event.preventDefault();
    if (event.repeat || suppressed.has('Space') || button.disabled || document.activeElement !== button) return;
    suppressed.add('Space');begin('key:Space', event);
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    if (suppressed.delete('Space')) { event.preventDefault();if (event.ctrlKey || event.metaKey || event.altKey) cancel();else finish('key:Space', event); }
  };
  const blur = () => { cancel();suppressed.clear(); };
  const hidden = () => { if (document.hidden) blur(); };
  button.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up, true);
  button.addEventListener('pointercancel', pointerCancelled);
  button.addEventListener('lostpointercapture', pointerCancelled);
  button.addEventListener('keydown', keyDown);
  button.addEventListener('blur', cancel);
  window.addEventListener('keyup', keyUp, true);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', hidden);
  return {
    cancel, refresh,
    dispose() {
      disposed = true;cancel();suppressed.clear();
      button.removeEventListener('pointerdown', down);window.removeEventListener('pointerup', up, true);
      button.removeEventListener('pointercancel', pointerCancelled);button.removeEventListener('lostpointercapture', pointerCancelled);
      button.removeEventListener('keydown', keyDown);button.removeEventListener('blur', cancel);
      window.removeEventListener('keyup', keyUp, true);window.removeEventListener('blur', blur);document.removeEventListener('visibilitychange', hidden);
    },
  };
}
