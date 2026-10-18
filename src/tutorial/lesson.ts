import { applyCommand, createRun } from '../core/index.js';
import type { Action, CommandResult, RunState } from '../core/index.js';

export const LESSONS = [
  { title: '把握落锤时机', text: '按住鼠标或空格，游标到中央时松开。精准能多获进度，也会降低本次裂损风险。', hint: '先尝试几锤；练习资源不写入正式契约。' },
  { title: '看懂裂痕，再决定收手', text: '这件练习坯只剩一格完整度。再发生裂损就会破碎；精准也不保证永远成功。', hint: '这是固定的练习示例，不会消耗正式契约的铁坯或进度。' },
  { title: '交货保订单，回收换升级', text: '试着交货一件、回收另一件。交货同时增加金币与当轮交货额；回收只增加废料。', hint: '只交货会缺少升级所需废料，继续加工也要留意热度与应力。' },
] as const;

export interface Lesson { readonly step: number; readonly state: RunState; readonly selected: string }

export function createLesson(step: number, identity: string): Lesson {
  const index = Math.max(0, Math.min(LESSONS.length - 1, Math.floor(step)));
  const created = createRun({ runId: identity, seed: index === 1 ? 'lesson-damage-0' : `guild-lesson-${index}` });
  if (!created.ok) throw new Error(created.error);
  let state = created.state;
  const selected = state.pieces[index === 1 ? 1 : 0].id;
  if (index === 1) {
    for (let count = 0; count < 14; count++) {
      const piece = state.pieces.find(candidate => candidate.id === selected);
      if (!piece) throw new Error('Lesson target missing');
      if (piece.integrity === 1) break;
      const action: Action = piece.heat === 0 ? { type: 'heat', pieceId: selected }
        : { type: 'strike', pieceId: selected, mode: 'heavy', timingMark: 0 };
      const result = applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action });
      if (!result.ok) throw new Error(`Lesson preparation failed: ${result.error}`);
      state = result.state;
    }
    const target = state.pieces.find(piece => piece.id === selected);
    if (!target || target.status !== 'active' || target.integrity !== 1) throw new Error('Pinned lesson recipe changed');
  }
  return { step: index, state, selected };
}

export function applyLesson(lesson: Lesson, action: Action): { readonly lesson: Lesson; readonly result: CommandResult } {
  const result = applyCommand(lesson.state, { runId: lesson.state.runId, expectedRevision: lesson.state.revision, action });
  return { lesson: result.ok ? { ...lesson, state: result.state } : lesson, result };
}
