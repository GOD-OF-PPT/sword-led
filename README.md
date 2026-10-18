# sword-led · 锤下求生

一款面向现代 PC 浏览器的轮次制锻造游戏。每轮只有三件铁坯：控制落锤时机让它升值，在断裂前决定交货还是回收，靠商人升级撑过十二轮契约。

当前运行版为v0.2/B「行会手账」，包含十二轮/商人/胜负/续玩和设置/声音。**2026-10-18真人试玩认为玩法和美术缺乏新意，当前可玩性未通过。** 已按用户给出的ForgeTax链接研究七款Steam作品与110条唯一评论，形成[v0.3玩法/实施提案](docs/v0.3-gameplay-proposal.md)。用户已明确回复“确认 v0.3，开始前三轮可玩版本”，美术采用新偏好的[D「行脚灯炉」](design/v03/README.md)。下一任务实施新核心与三轮可玩，图稿和确认不能当作新版已实现。T11完整D界面/十二轮/复验及T12最大审查保留。

## 项目资料

- [Steam玩法/评论研究](docs/research/2026-10-18-forging-games.md)：抽样方法、正负体验、具体评论回链和现版设计诊断。
- [已确认v0.3改版提案](docs/v0.3-gameplay-proposal.md)与[D方向图](design/v03/README.md)：锻脉/试剑/技法构筑、样例/风险/新旧档与实施验收。
- [游戏设计文档](docs/game-design.md)：完整玩法、材料来源、锻造风险、回收/交货、商人、配额、惩罚与胜负。
- [实施方案](docs/implementation-plan.md)：确认范围、开发阶段、工具命令合同与交付门槛。
- [代码架构](docs/architecture.md)：纯内核、状态机、随机数、输入时序、可靠存档与模块分工。
- [商人与存档合同](docs/persistence-and-merchant.md)：交易、回放、保存/冲突/备份与浏览器接线。
- [三套主界面候选](design/README.md)：A 余烬工坊、B 行会手账、C 冷铁控制台，最终选型图、比较和完整提示词。
- [界面与风格](docs/ui-design.md)：完整页面、信息结构与三图共同状态。
- [验收矩阵](docs/acceptance-matrix.md)：44项场景；已有规则、存储、模拟与工坊输入证据，整局UI/真人验收继续按任务完成。
- [首次全面复核 R1](docs/reviews/R1-design-and-concepts.md)：规则闭环、架构、图稿检查、修正与后续验证责任。
- [确认记录](docs/decision-record.md)：用户已确认实施并选择 B，原始问答留存。
- [T04 内核验证](docs/reviews/T04-kernel-validation.md)：77 项测试、类型检查、构建与独立产物验证，含本轮边界。
- [T05 交易与存档验证](docs/reviews/T05-persistence-validation.md)：141 项测试、8 项浏览器集成测试与真 BFCache 证据。
- [模拟合同](docs/simulation-contract.md)与 [R2 内核/平衡报告](docs/reviews/R2-kernel-and-balance.md)：53,000行证据、正式通关/失败回放、锤法/升级/辅助/滥用对照与150项测试。
- [B派生美术包](design/b/README.md)与[T07验证](docs/reviews/T07-art-validation.md)：9张运行图、24材料帧、完整状态/流程设计、色板和可复跑拼装预览。
- [工坊接线合同](docs/workshop-implementation.md)与[T08验证](docs/reviews/T08-workshop-validation.md)：175单测、26页面检查、8存储回归、原生Chrome最小化/恢复与实际截图。
- [经营/终局接线](docs/contract-flow.md)与[R3报告](docs/reviews/R3-full-contract-flow.md)：真实页面成功/失败、商人、账本、重开与T07–T09联合复核。
- [设置/音效/恢复合同](docs/settings-and-audio.md)与[T10品质报告](docs/reviews/T10-quality-validation.md)：独立设置、短音效生命周期、纯键盘整局、异常恢复与实际回调预算。
- [OpenSpec 提案](openspec/changes/add-forging-game/proposal.md)：四项新能力，已批准、分阶段实施。
- [原始输入](goal-1/input.md)：用户需求逐字保存。
- [执行计划](goal-1/plan.md)：实施顺序、验证、风险和回滚。
- [任务与执行记录](goal-1/tasks.md)：逐项进度、审查和提交证据。

## 开发顺序

先完善并复核游戏设计和实施文档，使用 imagegen 提供三套主界面候选。用户确认实施方案后先开发独立玩法内核；主界面选定后派生美术并完成网页全流程。测试、模拟、浏览器试玩与最终审查均保留实际证据。

v0.2三套候选、实施确认、内核/R2、B美术及完整UI/音效/设置已实现，真人反馈后正在T11改版。当前正式入口为`createRun/applyCommand/getRunView/validateRun`及只读账本`getRunLedger`，见[内核](src/core/index.ts)；[持久化会话](src/persistence/index.ts)唯一持有正式工作副本。界面不自行加钱或抽随机数；未来v2使用独立规则/存档，不能以旧模拟证明新版。

## 本地游玩与验证

使用 `.nvmrc` 的 Node 22.12.0，或 `package.json` engines 允许的版本。npm 精确锁定 TypeScript、Vite、Vitest 和 Node 类型，当前没有第三方运行时依赖。

```bash
npm ci --registry=https://registry.npmjs.org/
npm run dev
```

打开终端显示的地址，默认[本地游戏](http://127.0.0.1:5173/)。生产版本用`npm run build`后`npm run preview`，默认端口4173。构建包含dist/index.html、网页资源及兼容保留的core/session SDK；应整体保留dist，不提交dist或node_modules。需要通过localhost或HTTPS运行。

| 操作 | 用法 |
| --- | --- |
| 落锤 | 在击打区按住鼠标，或聚焦后按住空格；松开按时机结算 |
| 来料/锤法 | 点击，或数字1/2/3与Q/W/E；准备中切换会取消 |
| 暂停 | Esc或暂停按钮；后台/失焦取消准备，不偷扣资源 |
| 交货/回收 | 交货计订单和金币，回收只加废料；确认后不可再加工 |
| 操作设置 | 静音/音量、慢速×1.5、减弱动效自动独立保存；系统动效优先，失败可重试 |
| 声音 | 首次手势后启用；游戏顶部可静音，设置中可试听；暂停/后台/菜单会停止 |

每个接受动作后尝试保存，失败保留内存进度并提示重试；菜单继续会保留未保存工作副本。教学与显式不保存试玩不写正式档。同源另一窗口只读，关闭占用窗口后可重新读取。

保存故障可确认保留当前局继续不保存；刷新/关闭会失去这份试玩，本机磁盘契约保留。坏档不自动删除，合法备份恢复前显示轮次与时间；备份写失败会明确区别于主档写失败。设置故障不阻断正式锻造。教学初次使用慢速，可在设置中明确调整，正式契约使用保存的慢速选项。

临时[可玩预览](http://127.0.0.1:4179/)使用已验证构建快照，具体版本和实际存活检查见[执行计划](goal-1/plan.md)。仅当前机器/服务存活时可用；其他机器按上述命令运行，没有宣称已互联网部署。

工程检查按顺序执行，避免同时构建共用的dist：

```bash
npx playwright install chromium
npm run check
npm run test:browser
npm run test:art
```

`check`运行单测、严格类型检查与双构建。`test:browser`一次构建后串行运行正式页面与存储SDK；也可分别用`test:e2e`/`test:storage:browser`。真实Chrome原生窗口/缓存探测采用隔离profile；测试只改变测试侧时钟/事件，不注入钱包/终局。美术检查使用独立设计页，不作为正式游戏验收。单项命令还包括`npm test`、`npm run typecheck`、`npm run build`和交互`test:watch`。

跨引擎工具：`npx playwright install firefox webkit`后执行`npm run test:cross`。独立输出在`test-results/cross/`和`cross-report.json`，包含Chromium DPR2、Firefox/WebKit常规与两者的DPR2定向界面检查。原生Chrome进程专用测试保留在`test:browser`，不会伪标为Firefox/WebKit。Playwright WebKit引擎不是已在真实Safari产品上验收，Chromium也不等同真实Edge。当前只归档实际通过的子集，完整新版本矩阵按T11.4执行。[贡献说明](CONTRIBUTING.md)列出测试边界。

整局模拟与回放：

```bash
npm run simulate -- --seeds 1000 --workers 6 --out tmp/my-verification
npm run simulate -- --replay docs/evidence/T06/verify-v1.medium-victory.json
```

默认53场景，每个最终状态都完整回放；输出统计JSON、逐局CSV.gz与胜负witness。已有输出不会覆盖；参数、输入误差假设和指标边界见模拟合同。T06 实测批次约18分钟，速度取决于设备，模型输入秒数不等于脚本耗时或真人整局时长。

正式入口为根路径`/`；开发服务还提供`/design/b/preview/index.html`美术校验页。`test:art`核对9张生产图片、alpha、288姿态、24材料帧和设计组件；它与正式页面测试分别记录。机器证据归档工具为`node scripts/collect-ui-evidence.mjs --stage T10 --out <新的证据目录>`，已有证据不覆盖；归档前需生成最新unit/UI/storage报告。

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
