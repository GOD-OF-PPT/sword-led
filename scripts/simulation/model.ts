import type { HammerMode, RunState } from '../../src/core/index.js';

export type Strategy = 'conservative' | 'balanced' | 'aggressive' | 'raw' | 'recycle' | 'idle' | 'blind';
export type Skill = 'low' | 'medium' | 'high' | 'perfect' | 'blind';
export type HammerPolicy = HammerMode | 'adaptive';
export type UpgradeRoute = 'heat' | 'precision' | 'stability' | 'none';
export interface Scenario {
  readonly id: string;
  readonly strategy: Strategy;
  readonly skill: Skill;
  readonly hammer: HammerPolicy;
  readonly upgrades: UpgradeRoute;
  readonly slow: boolean;
  readonly duplicateSpam: boolean;
}
export const SIMULATION_VERSION = 'sim-v1';
export const PROFILES = {
  low: { sigmaMs: 110, lapse: 0.12 },
  medium: { sigmaMs: 50, lapse: 0.06 },
  high: { sigmaMs: 22, lapse: 0.02 },
  perfect: { sigmaMs: 0, lapse: 0 },
  blind: { sigmaMs: 0, lapse: 1 },
} as const;
export interface RunMetrics {
  readonly outcome: 'victory' | 'defeat' | 'idle';
  readonly rounds: number;
  readonly seals: number;
  readonly coins: number;
  readonly goldEarned: number;
  readonly goldSpent: number;
  readonly scrap: number;
  readonly broken: number;
  readonly strikes: number;
  readonly heats: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly activeInputSeconds: number;
  readonly modeStrikes: Readonly<Record<HammerMode, number>>;
  readonly gradeStrikes: { readonly precise: number; readonly ordinary: number; readonly mishit: number };
  readonly replayValid: boolean;
  readonly stateBytes: number;
}
export interface RunResult { readonly state: RunState; readonly metrics: RunMetrics }

export function scenarios(suite: 'full' | 'base' | 'abuse'): Scenario[] {
  const result: Scenario[] = [];
  const add = (strategy: Strategy, hammer: HammerPolicy, skill: Skill, upgrades: UpgradeRoute = 'heat', slow = false, duplicateSpam = false) => {
    result.push({ id: [strategy, hammer, skill, upgrades, slow ? 'slow' : 'normal', duplicateSpam ? 'spam' : 'clean'].join('-'),
      strategy, hammer, skill, upgrades, slow, duplicateSpam });
  };
  if (suite !== 'abuse') {
    for (const strategy of ['conservative', 'balanced', 'aggressive'] as const) {
      for (const hammer of ['light', 'standard', 'heavy', 'adaptive'] as const) {
        for (const skill of ['low', 'medium', 'high'] as const) add(strategy, hammer, skill);
      }
    }
  }
  if (suite === 'full') {
    for (const hammer of ['light', 'standard', 'heavy', 'adaptive'] as const) add('balanced', hammer, 'perfect');
    for (const skill of ['medium', 'high'] as const) for (const route of ['precision', 'stability', 'none'] as const) add('balanced', 'adaptive', skill, route);
    for (const skill of ['low', 'medium'] as const) add('balanced', 'adaptive', skill, 'heat', true);
  }
  if (suite !== 'base') {
    add('raw', 'light', 'perfect', 'none');
    add('recycle', 'light', 'perfect', 'none');
    add('idle', 'light', 'perfect', 'none');
    add('blind', 'heavy', 'blind', 'none');
    add('balanced', 'adaptive', 'medium', 'heat', false, true);
  }
  return result;
}
