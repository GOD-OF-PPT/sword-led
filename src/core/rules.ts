import type { HammerMode, Material, RunState, TimingGrade, Workpiece } from './model.js';
import { freezeDeep } from './immutable.js';

export const RULES_VERSION = 'forge-v1';
export const QUOTAS = freezeDeep([120, 150, 180, 210, 250, 290, 340, 390, 450, 520, 600, 700]);
export const MERCHANT_ROUNDS = freezeDeep([3, 6, 9]);
export const MAX_PROGRESS = 35;
export const TIERS = freezeDeep([
  { name: '粗坯', progress: 0, multiplier: 10 },
  { name: '整形', progress: 2, multiplier: 16 },
  { name: '淬炼', progress: 5, multiplier: 25 },
  { name: '成刃', progress: 9, multiplier: 38 },
  { name: '精工', progress: 14, multiplier: 56 },
  { name: '上品', progress: 20, multiplier: 80 },
  { name: '名作', progress: 27, multiplier: 115 },
  { name: '传世', progress: 35, multiplier: 160 },
]);
export const MATERIALS = freezeDeep({
  iron: { name: '熟铁', baseValue: 18, integrity: 4, risk: 2, scrap: 3 },
  steel: { name: '精钢', baseValue: 22, integrity: 3, risk: 6, scrap: 4 },
  meteorite: { name: '陨铁', baseValue: 28, integrity: 2, risk: 10, scrap: 5 },
} satisfies Record<Material, object>);
export const HAMMERS = freezeDeep({
  light: { label: '轻锤', progress: 1, heat: 8, stress: 3, risk: -2, periodMs: 1600 },
  standard: { label: '标准锤', progress: 2, heat: 12, stress: 7, risk: 2, periodMs: 1400 },
  heavy: { label: '重锤', progress: 3, heat: 18, stress: 12, risk: 7, periodMs: 1200 },
} satisfies Record<HammerMode, object>);

export function isHammerMode(value: unknown): value is HammerMode {
  return value === 'light' || value === 'standard' || value === 'heavy';
}

export function tierOf(progress: number): number {
  let result = 0;
  for (const [index, tier] of TIERS.entries()) if (progress >= tier.progress) result = index;
  return result;
}

export function tierAt(index: number) {
  const tier = TIERS[index];
  if (!tier) throw new Error('Internal tier index outside rules table');
  return tier;
}

export function quotaFor(round: number): number {
  const quota = QUOTAS[round - 1];
  if (quota === undefined) throw new Error('Internal round outside contract');
  return quota;
}

export function valueOf(piece: Workpiece): number {
  return Math.floor(MATERIALS[piece.material].baseValue * tierAt(tierOf(piece.progress)).multiplier / 10);
}

export function recyclingValue(piece: Workpiece): number {
  return MATERIALS[piece.material].scrap + Math.floor(tierOf(piece.progress) / 2);
}

export function gradeOf(mark: number, handleLevel: number): TimingGrade {
  const distance = Math.abs(mark - 5000);
  if (distance <= 600 + 200 * handleLevel) return 'precise';
  return distance <= 2000 ? 'ordinary' : 'mishit';
}

export function damageRisk(piece: Workpiece, mode: HammerMode, grade: TimingGrade, anvilLevel: number): number {
  const timing = grade === 'precise' ? -6 : grade === 'mishit' ? 12 : 0;
  const cold = Math.ceil(Math.max(0, 40 - piece.heat) / 10) * 4;
  const risk = MATERIALS[piece.material].risk + tierOf(piece.progress) * 3 + HAMMERS[mode].risk
    + timing + cold + Math.floor(piece.stress / 20) * 3 - anvilLevel * 3;
  return Math.max(0, Math.min(85, risk));
}

export function deliveredThisRound(state: RunState): number {
  return state.pieces.reduce((sum, piece) => sum + (piece.status === 'delivered' ? valueOf(piece) : 0), 0);
}
