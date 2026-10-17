# sword-led · 锤下求生

一款面向现代 PC 浏览器的轮次制锻造游戏。每轮只有三件铁坯：控制落锤时机让它升值，在断裂前决定交货还是回收，靠商人升级撑过十二轮契约。

用户已确认实施方案 v0.2，并选定 **B「行会手账」**。T04 已实现可独立验证的玩法内核；当前构建产物是规则模块，尚无完整游戏页面。商人交易、可靠存档、由 B 派生的素材和网页全流程按后续任务交付。

## 项目资料

- [游戏设计文档](docs/game-design.md)：完整玩法、材料来源、锻造风险、回收/交货、商人、配额、惩罚与胜负。
- [实施方案](docs/implementation-plan.md)：确认范围、开发阶段、工具命令合同与交付门槛。
- [代码架构](docs/architecture.md)：纯内核、状态机、随机数、输入时序、可靠存档与模块分工。
- [三套主界面候选](design/README.md)：A 余烬工坊、B 行会手账、C 冷铁控制台，最终选型图、比较和完整提示词。
- [界面与风格](docs/ui-design.md)：完整页面、信息结构与三图共同状态。
- [验收矩阵](docs/acceptance-matrix.md)：44 项场景与证据要求；T04 对应规则测试已执行，整局策略/存档/浏览器验收待后续任务。
- [首次全面复核 R1](docs/reviews/R1-design-and-concepts.md)：规则闭环、架构、图稿检查、修正与后续验证责任。
- [确认记录](docs/decision-record.md)：用户已确认实施并选择 B，原始问答留存。
- [T04 内核验证](docs/reviews/T04-kernel-validation.md)：77 项测试、类型检查、构建与独立产物验证，含本轮边界。
- [OpenSpec 提案](openspec/changes/add-forging-game/proposal.md)：四项新能力，已批准、分阶段实施。
- [原始输入](goal-1/input.md)：用户需求逐字保存。
- [执行计划](goal-1/plan.md)：实施顺序、验证、风险和回滚。
- [任务与执行记录](goal-1/tasks.md)：逐项进度、审查和提交证据。

## 开发顺序

先完善并复核游戏设计和实施文档，使用 imagegen 提供三套主界面候选。用户确认实施方案后先开发独立玩法内核；主界面选定后派生美术并完成网页全流程。测试、模拟、浏览器试玩与最终审查均保留实际证据。

三套主界面候选、R1 和实施确认已完成。继续先做独立内核与经营/存档，再由已选 B 派生美术并接入完整页面。当前三个正式入口为 `createRun`、`applyCommand`、`getRunView`，见 [内核](src/core/index.ts)；外部存档校验入口在 T05 实现，没有空函数替代。

## 本地验证

使用 `.nvmrc` 的 Node 22.12.0，或 `package.json` engines 允许的版本。npm 精确锁定 TypeScript、Vite、Vitest 和 Node 类型，当前没有第三方运行时依赖。

```bash
npm ci --registry=https://registry.npmjs.org/
npm run check
```

`check` 单次运行规则测试，再执行严格类型检查和构建。也可分别使用 `npm test`、`npm run typecheck`、`npm run build`；交互 watch 用 `npm run test:watch`。产物为 `dist/sword-led-core.js`，不提交 dist 或 node_modules。

目前 `npm run dev` 提供 Vite 模块开发服务，可查看 `/src/core/index.ts`；`npm run preview` 提供已构建的模块。**当前不提供游戏首页**，网页入口在 T08 的完整界面任务中添加。

构建后可在 Node 中调用同一个正式内核：

```js
import { createRun, applyCommand, getRunView } from './dist/sword-led-core.js';

const created = createRun({ runId: 'example-run', seed: 'forge-demo' });
if (!created.ok) throw new Error(created.error);
const hit = applyCommand(created.state, {
  runId: created.state.runId,
  expectedRevision: created.state.revision,
  action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 },
});
if (!hit.ok) throw new Error(hit.error);
console.log(getRunView(hit.state).selected);
```

动作拒绝不改变原状态、随机位置或修订号。只对由内核创建的合法状态调用此入口；不将未经验证的外部 JSON 当作游戏状态，T05 会提供正式校验与存档 Adapter。

## 素材与发布

游戏名称暂定。AI 生成素材会连同提示词、版本与项目路径记录，最终运行素材在仓库内保存。仓库初始为私有；未另行指定开源许可，公开发布与商业使用的素材授权在交付前核查。
