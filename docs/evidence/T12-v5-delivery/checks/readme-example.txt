import { createRun, applyCommand, getRunView } from './dist/sword-led-v5.js';

const created = createRun({ runId: 'example-run', seed: 'forge-demo' });
if (!created.ok) throw new Error(created.error);
const opened = applyCommand(created.state, {
  runId: created.state.runId,
  expectedRevision: created.state.revision,
  action: { type: 'continue' },
});
if (!opened.ok) throw new Error(opened.error);
const hit = applyCommand(opened.state, {
  runId: opened.state.runId,
  expectedRevision: opened.state.revision,
  action: { type: 'strike', pieceId: 'd1-1' },
});
if (!hit.ok) throw new Error(hit.error);
const view = getRunView(hit.state);
console.log(view.day, view.coins, view.blades[0].blade.value);
