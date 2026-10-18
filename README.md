# sword-led · 锤下求生

一款面向现代 PC 浏览器的轮次制锻造游戏。每轮只有三件铁坯：控制落锤时机让它升值，在断裂前决定交货还是回收，靠商人升级撑过十二轮契约。

用户已确认实施方案v0.2，并选定 **B「行会手账」**。T04–T07已实现玩法内核、商人/升级、可靠存档、53场景×1000种子模拟/R2及B派生美术；当前构建为SDK与运行素材，完整游戏页面从T08接入。模拟与美术预览不代替真人可玩性验证。

## 项目资料

- [游戏设计文档](docs/game-design.md)：完整玩法、材料来源、锻造风险、回收/交货、商人、配额、惩罚与胜负。
- [实施方案](docs/implementation-plan.md)：确认范围、开发阶段、工具命令合同与交付门槛。
- [代码架构](docs/architecture.md)：纯内核、状态机、随机数、输入时序、可靠存档与模块分工。
- [商人与存档合同](docs/persistence-and-merchant.md)：交易、回放、保存/冲突/备份与浏览器接线。
- [三套主界面候选](design/README.md)：A 余烬工坊、B 行会手账、C 冷铁控制台，最终选型图、比较和完整提示词。
- [界面与风格](docs/ui-design.md)：完整页面、信息结构与三图共同状态。
- [验收矩阵](docs/acceptance-matrix.md)：44 项场景与证据要求；后台规则、存储与整局模拟已验证，游戏界面/真人验收待后续任务。
- [首次全面复核 R1](docs/reviews/R1-design-and-concepts.md)：规则闭环、架构、图稿检查、修正与后续验证责任。
- [确认记录](docs/decision-record.md)：用户已确认实施并选择 B，原始问答留存。
- [T04 内核验证](docs/reviews/T04-kernel-validation.md)：77 项测试、类型检查、构建与独立产物验证，含本轮边界。
- [T05 交易与存档验证](docs/reviews/T05-persistence-validation.md)：141 项测试、8 项浏览器集成测试与真 BFCache 证据。
- [模拟合同](docs/simulation-contract.md)与 [R2 内核/平衡报告](docs/reviews/R2-kernel-and-balance.md)：53,000行证据、正式通关/失败回放、锤法/升级/辅助/滥用对照与150项测试。
- [B派生美术包](design/b/README.md)与[T07验证](docs/reviews/T07-art-validation.md)：9张运行图、24材料帧、完整状态/流程设计、色板和可复跑拼装预览。
- [OpenSpec 提案](openspec/changes/add-forging-game/proposal.md)：四项新能力，已批准、分阶段实施。
- [原始输入](goal-1/input.md)：用户需求逐字保存。
- [执行计划](goal-1/plan.md)：实施顺序、验证、风险和回滚。
- [任务与执行记录](goal-1/tasks.md)：逐项进度、审查和提交证据。

## 开发顺序

先完善并复核游戏设计和实施文档，使用 imagegen 提供三套主界面候选。用户确认实施方案后先开发独立玩法内核；主界面选定后派生美术并完成网页全流程。测试、模拟、浏览器试玩与最终审查均保留实际证据。

三套候选、实施确认、内核/R2和B派生美术已完成，下一项接主菜单、教程与正式工坊。当前四个规则入口为 `createRun`、`applyCommand`、`getRunView`、`validateRun`，见[内核](src/core/index.ts)；[持久化会话](src/persistence/index.ts)接保存、锁和恢复。命令失败与保存失败分别处理。

## 本地验证

使用 `.nvmrc` 的 Node 22.12.0，或 `package.json` engines 允许的版本。npm 精确锁定 TypeScript、Vite、Vitest 和 Node 类型，当前没有第三方运行时依赖。

```bash
npm ci --registry=https://registry.npmjs.org/
npm run check
```

`check` 单次运行规则/会话测试，再执行严格类型检查和构建。也可分别用 `npm test`、`npm run typecheck`、`npm run build`；交互 watch 用 `npm run test:watch`。产物为 core/session 两入口与公共 chunk，应整体保留 dist；不提交 dist 或 node_modules。

存储浏览器测试需安装一次浏览器，再运行独立套件：

```bash
npx playwright install chromium
npm run test:storage:browser
```

套件使用隔离页面/profile 检查已构建 SDK，包含原生 Chrome BFCache 探测；这些测试页不是游戏界面，不进入生产产物。

整局模拟与回放：

```bash
npm run simulate -- --seeds 1000 --workers 6 --out tmp/my-verification
npm run simulate -- --replay docs/evidence/T06/verify-v1.medium-victory.json
```

默认53场景，每个最终状态都完整回放；输出统计JSON、逐局CSV.gz与胜负witness。已有输出不会覆盖；参数、输入误差假设和指标边界见模拟合同。T06 实测批次约18分钟，速度取决于设备，模型输入秒数不等于脚本耗时或真人整局时长。

目前`npm run dev`提供Vite模块服务和设计专用的`/design/b/preview/index.html`美术预览；`npm run preview`提供已构建模块与素材。**当前不提供游戏首页**，网页入口在T08添加。`npm run test:art`构建后验证生产图片、alpha、288种姿态组合、24材料帧、状态/对比度及两种尺寸；预览与正式游戏验收分别记录。

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

动作拒绝不改变原状态、随机位置或修订号。只对内核创建或 validateRun 校验过的状态调用；浏览器使用持久化会话自动尝试保存每个 Accepted 动作，dirty/冲突/显式恢复见存档合同。

## 素材与发布

游戏名称暂定。AI 生成素材会连同提示词、版本与项目路径记录，最终运行素材在仓库内保存。仓库初始为私有；未另行指定开源许可，公开发布与商业使用的素材授权在交付前核查。
