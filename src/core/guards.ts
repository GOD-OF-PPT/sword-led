import type { Action, Availability, ErrorCode, RunState, Workpiece } from './model.js';
import { isHammerMode, MAX_PROGRESS } from './rules.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function available(error: ErrorCode | null): Availability {
  return error === null ? { allowed: true } : { allowed: false, reason: error };
}

export function pieceError(state: RunState, piece: Workpiece | undefined, operation: 'strike' | 'heat' | 'deliver' | 'recycle'): ErrorCode | null {
  if (state.phase !== 'workshop') return 'wrong_phase';
  if (!piece) return 'piece_not_found';
  if (piece.status !== 'active') return 'piece_finalized';
  if (operation === 'strike') {
    if (piece.progress >= MAX_PROGRESS) return 'max_progress';
    if (piece.heat <= 0) return 'no_heat';
  }
  if (operation === 'heat') {
    if (piece.heat >= 100) return 'already_hot';
    if (state.coal <= 0) return 'no_coal';
  }
  return null;
}

export function settleError(state: RunState, recycleRemaining: boolean): ErrorCode | null {
  if (state.phase !== 'workshop') return 'wrong_phase';
  return !recycleRemaining && state.pieces.some(piece => piece.status === 'active') ? 'unprocessed_pieces' : null;
}

export function parseAction(value: unknown): { readonly ok: true; readonly action: Action } | { readonly ok: false; readonly error: ErrorCode } {
  if (!isRecord(value)) return { ok: false, error: 'invalid_command' };
  switch (value.type) {
    case 'strike': {
      if (typeof value.pieceId !== 'string') return { ok: false, error: 'invalid_command' };
      if (!isHammerMode(value.mode)) return { ok: false, error: 'invalid_hammer' };
      if (typeof value.timingMark !== 'number' || !Number.isInteger(value.timingMark) || value.timingMark < 0 || value.timingMark > 10000) {
        return { ok: false, error: 'invalid_timing' };
      }
      return { ok: true, action: { type: 'strike', pieceId: value.pieceId, mode: value.mode, timingMark: value.timingMark } };
    }
    case 'heat':
    case 'deliver':
    case 'recycle':
      return typeof value.pieceId === 'string'
        ? { ok: true, action: { type: value.type, pieceId: value.pieceId } }
        : { ok: false, error: 'invalid_command' };
    case 'settleRound':
      return typeof value.recycleRemaining === 'boolean'
        ? { ok: true, action: { type: 'settleRound', recycleRemaining: value.recycleRemaining } }
        : { ok: false, error: 'invalid_command' };
    case 'advanceSummary':
    case 'leaveMerchant':
      return { ok: true, action: { type: value.type } };
    default:
      return { ok: false, error: 'invalid_command' };
  }
}
