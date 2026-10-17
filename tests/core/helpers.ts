import { applyCommand, createRun } from '../../src/core/index.js';
import type { Action, RunState, Workpiece } from '../../src/core/index.js';

export function newRun(seed = 'core-tests', runId = 'test-run'): RunState {
  const result = createRun({ runId, seed });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

export function act(state: RunState, action: Action): RunState {
  const result = applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action });
  if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
  return result.state;
}

export function send(state: RunState, action: unknown) {
  return applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action });
}

// Boundary fixtures exercise individual rules; they do not claim save reachability or a played full run.
export function firstPieceFixture(patch: Partial<Workpiece>, overrides: Partial<RunState> = {}): RunState {
  const run = newRun();
  return { ...run, ...overrides, pieces: [{ ...run.pieces[0], ...patch }, run.pieces[1], run.pieces[2]] };
}

export function roundFixture(round: number, seals = 3): RunState {
  const run = newRun();
  return { ...run, round, seals, pieces: [
    { ...run.pieces[0], id: `${round}:1`, material: 'iron' },
    { ...run.pieces[2], id: `${round}:2`, material: 'steel' },
    { ...run.pieces[0], id: `${round}:3`, material: 'meteorite', integrity: 2 },
  ] };
}
