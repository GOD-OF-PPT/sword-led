import type { RunState, ValidationResult } from './model.js';
import { applyCommand, createRun } from './game.js';
import { isRecord, parseAction } from './guards.js';
import { RULES_VERSION } from './rules.js';

export const MAX_SAVE_BYTES = 256 * 1024;
export const MAX_JOURNAL_ACTIONS = 2048;

// A bounded JSON snapshot without invoking accessors or trusting object prototypes.
function canonicalJson(value: unknown): string | null {
  let nodes = 0;
  let characters = 0;
  const visit = (item: unknown, depth: number): string | null => {
    if (++nodes > 50000 || depth > 16) return null;
    if (item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isSafeInteger(item))) {
      const encoded = JSON.stringify(item);
      characters += encoded.length;
      return characters <= MAX_SAVE_BYTES ? encoded : null;
    }
    if (typeof item === 'string') {
      if (item.length > MAX_SAVE_BYTES) return null;
      const encoded = JSON.stringify(item);
      characters += encoded.length;
      return characters <= MAX_SAVE_BYTES ? encoded : null;
    }
    if (typeof item !== 'object') return null;
    const array = Array.isArray(item);
    const prototype: unknown = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(item);
    if (keys.some(key => typeof key !== 'string') || keys.length > 10000) return null;
    const pairs: string[] = [];
    if (array) {
      if (item.length > MAX_JOURNAL_ACTIONS || keys.length !== item.length + 1) return null;
      for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
        const child: unknown = descriptor.value;
        const encoded = visit(child, depth + 1);
        if (encoded === null) return null;
        pairs.push(encoded);
      }
      return `[${pairs.join(',')}]`;
    }
    const names = Object.getOwnPropertyNames(item).sort();
    for (const key of names) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
      characters += key.length + 3;
      if (characters > MAX_SAVE_BYTES) return null;
      const child: unknown = descriptor.value;
      const encoded = visit(child, depth + 1);
      if (encoded === null) return null;
      pairs.push(`${JSON.stringify(key)}:${encoded}`);
    }
    return `{${pairs.join(',')}}`;
  };
  try {
    const result = visit(value, 0);
    return result !== null && new TextEncoder().encode(result).byteLength <= MAX_SAVE_BYTES ? result : null;
  } catch {
    return null;
  }
}

export function validateRun(input: unknown, expectedRulesVersion: string = RULES_VERSION): ValidationResult {
  const encoded = canonicalJson(input);
  if (encoded === null) return { ok: false, error: 'invalid_state', detail: 'State must be bounded plain JSON data with finite safe integers.' };
  const data: unknown = JSON.parse(encoded);
  if (!isRecord(data)) return { ok: false, error: 'invalid_state', detail: 'State must be an object.' };
  if (typeof data.rulesVersion !== 'string') return { ok: false, error: 'invalid_state', detail: 'State rules version is missing.' };
  if (expectedRulesVersion !== RULES_VERSION || data.rulesVersion !== expectedRulesVersion) {
    return { ok: false, error: 'invalid_rules_version', detail: 'Rules version does not match the installed rules.' };
  }
  if (typeof data.runId !== 'string' || typeof data.seed !== 'string') {
    return { ok: false, error: 'invalid_state', detail: 'Run identity and seed are required.' };
  }
  if (!Array.isArray(data.journal) || data.journal.length > MAX_JOURNAL_ACTIONS) {
    return { ok: false, error: 'invalid_journal', detail: 'A bounded command journal is required.' };
  }
  const created = createRun({ runId: data.runId, seed: data.seed });
  if (!created.ok) return { ok: false, error: 'invalid_state', detail: created.error };
  let state: RunState = created.state;
  for (const [index, entry] of data.journal.entries()) {
    const raw: unknown = entry;
    const parsed = parseAction(raw);
    if (!parsed.ok) return { ok: false, error: 'invalid_journal', detail: `Command ${index}: ${parsed.error}` };
    const applied = applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action: parsed.action });
    if (!applied.ok) return { ok: false, error: 'invalid_journal', detail: `Command ${index}: ${applied.error}` };
    state = applied.state;
  }
  if (canonicalJson(state) !== encoded) {
    return { ok: false, error: 'invalid_state', detail: 'State does not match its seed and accepted-command journal.' };
  }
  return { ok: true, state };
}
