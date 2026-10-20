# sword-led · 锤下求生

一款面向现代 PC 浏览器的轮次制锻造游戏。每轮只有三件铁坯：点击落锤让它升值，在断裂前决定交货、留剑还是回收，靠手艺和商人升级撑过契约。

**当前首页为 v0.7「重燃十二盏灯 · 山口终章」：[本机试玩](http://127.0.0.1:4179/)**。三章十二天主线已接通：十二种打造委托、三次商人、六种事件、配方和炉具成长、三种结局、人物后日谈、完整炉谱与合法解锁的行脚挑战。左键直接敲剑，合格后交给来客；余剑可卖、回收、留给明天或换手艺。界面沿已选 D「行脚灯炉」，文字和操作均为真实组件。[终章操作指南](docs/v0.7-final-chapter-guide.md)、[终章技术复核](docs/reviews/T11-4-2-3i5-final-chapter.md)和[当前平衡／引导报告](docs/reviews/T11-4-2-3i6-v4-balance.md)记录实际范围与验证边界。

刷新原标签页可见新标题；已有第8天进度可点“沿灯路，去下一天”，保留配方、手艺、留剑与随机状态。新行程使用独立v4存档；旧契约从“行旅种子与旧路”进入[旧版炉前](http://127.0.0.1:4179/v3.html)，旧D细锻和B版入口也保留。不会自动转换或清空旧档。

终章要求两次连锻、裂护刃/无裂替代、旧剑接力/两柄新剑和最终无裂重锋；护灯剑交出后仍需收工，才按真实完成数与关键约定决定结局。“灯下归途”也可能已经做成护灯剑；未完成和未抵达分别记录。炉谱展示十二份最佳真实作品、配方熟练与手艺见闻，成功结局安全保存后才解锁挑战。明确不保存试玩不写入新炉谱，离开前可导出。

开场与灯路回顾现在明确目标：守住第4、8、12天的关键约定，至少完成10项并保有契印，才能十二灯复明。关键日收工前会说明失约后果；护炉契保印不补约。旧刃回收没有架上剑时，可用新入口返回铁砧，选余剑点“留给明天”挂架后再回来确认，今日坯也可交换；导航不会自动交剑。

[完整批准方案](docs/v0.7-complete-game-proposal.md)、[终章界面合同](docs/v0.7-final-chapter-interface.md)、[内核合同](docs/v0.7-core-contract.md)、[保存合同](docs/v0.7-persistence-contract.md)和[九张终章美术原件/提示词](design/d/v07-chapter3/README.md)可查；前两章说明和原件继续保留。30组共享1000种子的30,000终态已完成生产回放和另一次全量独立审计；固定7锤胜率28%，成长／留剑对胜率作用较弱、后期金币富余的风险如实保留，模型不代表真人满意。整体目标还包括最终广DPR/原生生命周期/音频性能矩阵、真人体验与最大复核。本机预览未公网部署。

历史 [v0.6炉前](docs/v0.6-workshop-interface.md)和[R3.18](docs/reviews/R3-18-game-studio-forge-ui.md)保留原交付身份。[ForgeTax完整实况复核](docs/research/2026-10-19-forgetax-session-study.md)与Steam评论研究记录了参考依据；当前优化依据用户对主线、成长、内容的反馈推进。

2026-10-18真人曾评价v0.2玩法/美术缺乏新意；已据ForgeTax及110条唯一Steam评论修订并取得明确v0.3批准。[核心证据](docs/reviews/R3-5-v2-core-and-playable.md)保留928局策略与原试玩结果，[D界面说明](docs/v0.3-d-interface.md)记录新接线与独立练习。[新版技术验收](docs/reviews/R3-7-v2-technical-acceptance.md)与[44AC映射](docs/v0.3-acceptance.md)分别记录实际矩阵、故障修复及待办。真人再玩和最大交付仍按T11.4.2–T12推进，技术通过不等于玩家满意。

## 项目资料

- [Steam玩法/评论研究](docs/research/2026-10-18-forging-games.md)：抽样方法、正负体验、具体评论回链和现版设计诊断。
- [行旅版场景与反馈](docs/v0.4-workshop-scene.md)：实物工坊、上下文引导、交接/达标/归架等真实反馈，以及商人/收据/终局作品。
- [v0.4完整契约](docs/v0.4-campaign.md)与[基础玩法](docs/v0.4-playable.md)：即时增值、裂损/连锻、保险剑、三次商人、胜负与账本；旧三轮档继续练手。
- [已确认v0.3改版提案](docs/v0.3-gameplay-proposal.md)与[D方向图](design/v03/README.md)：锻脉/试剑/技法构筑、样例/风险/新旧档与实施验收。
- [v0.3核心与试玩](docs/v0.3-core-and-preview.md)：操作、共享存储适配口、独立存档/SDK、928局策略边界与复跑命令；[R3.5](docs/reviews/R3-5-v2-core-and-playable.md)保留三任务复核与后续责任。
- [forge-v2原规模模型审计](docs/reviews/R4-v2-model-audit.md)：29组合各1000种子、旧928重叠与正式胜负回放、压缩原结果和16项审计拒绝检查；只验证旧规则技术条件，不替代真人乐趣或新v0.4验收。
- [游戏设计文档](docs/game-design.md)：完整玩法、材料来源、锻造风险、回收/交货、商人、配额、惩罚与胜负。
- [实施方案](docs/implementation-plan.md)：确认范围、开发阶段、工具命令合同与交付门槛。
- [代码架构](docs/architecture.md)：纯内核、状态机、随机数、输入时序、可靠存档与模块分工。
- [商人与存档合同](docs/persistence-and-merchant.md)：交易、回放、保存/冲突/备份与浏览器接线。
- [三套主界面候选](design/README.md)：A 余烬工坊、B 行会手账、C 冷铁控制台，最终选型图、比较和完整提示词。
- [界面与风格](docs/ui-design.md)：完整页面、信息结构与三图共同状态。
- [验收矩阵](docs/acceptance-matrix.md)：44项场景；已有规则、存储、模拟与工坊输入证据，整局UI/真人验收继续按任务完成。
- [R4审查检查点](docs/reviews/R4-final-audit.md)：原始五项/44AC/V3逐项结果、恢复提示修补、历史v2策略规模批次与未完成的真人门槛；[REPEAT](docs/reviews/REPEAT-2026-10-19.md)记录只扩展有据的重复流程。
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

v0.2三套候选、内核/R2/B美术与完整UI保留。v0.3已实施独立[core-v2](src/core-v2/index.ts)及真实试玩，仍用`createRun/applyCommand/getRunView/validateRun`，并提供只读试剑/作品簿。共享会话保护分别注入v1/v2解释器，界面不自行加钱或抽随机。D资产/全界面已连接，最终验证与真人反馈继续推进，旧模拟不能证明新玩法。

## 本地游玩与验证

使用 `.nvmrc` 的 Node 22.12.0，或 `package.json` engines 允许的版本。npm 精确锁定 TypeScript、Vite、Vitest 和 Node 类型，当前没有第三方运行时依赖。

```bash
npm ci --registry=https://registry.npmjs.org/
npm run dev
```

打开终端显示的地址，默认`/`为v0.7三章十二天（forge-v4规则），`/v3.html`为旧版炉前，`/v2.html`为旧D细锻，`/legacy.html`为B版旧契约。生产版本用`npm run build`后`npm run preview`，默认端口4173。构建包含四个HTML、网页资源与core/session/v2/v3/v4 SDK及共享chunk，应整体保留dist，不提交dist或node_modules。v4已导出独立局档/炉谱会话，具体API见[保存合同](docs/v0.7-persistence-contract.md)；当前生产网页已接通十二天和三结局。需要通过localhost或HTTPS运行。

| 操作 | 用法 |
| --- | --- |
| 落锤 | 中央剑身区域鼠标左键；键盘聚焦落锤后松开空格，或Enter激活；无需卡时机 |
| 换剑 | 左侧剑架点击，或Tab/Shift+Tab移动后Enter选择 |
| 暂停 | Esc或暂停按钮；后台/失焦取消准备，不偷扣资源 |
| 交差/回收 | 满足委托条件的交剑才完成主目标；卖行会只得金币，回收只得底价的四分之一金币；处置后不可再加工 |
| 操作设置 | 静音/音量、减弱动效自动独立保存；系统动效优先，失败可重试；旧细锻模式另有慢速时机 |
| 声音 | 首次手势后启用；打开设置可静音或试听；暂停/后台/菜单会停止 |

每个接受动作后尝试保存，失败保留内存进度并提示重试；菜单继续会保留未保存工作副本。旧两版的独立教学与显式不保存试玩不写正式档。同源另一窗口只读，关闭占用窗口后可重新读取。

保存故障可确认保留当前局继续不保存；刷新/关闭会失去这份试玩，本机磁盘契约保留。坏档不自动删除，合法备份恢复前显示轮次与时间；备份写失败会明确区别于主档写失败。设置故障不阻断正式锻造。旧两版教学初次使用慢速，可在设置中调整；v0.4直接落锤，不使用时机速度。

临时[可玩预览](http://127.0.0.1:4179/)使用已验证构建快照，具体版本和实际存活检查见[执行计划](goal-1/plan.md)。仅当前机器/服务存活时可用；其他机器按上述命令运行，没有宣称已互联网部署。

工程检查按顺序执行，避免同时构建共用的dist：

```bash
npx playwright install chromium
npm run check
npm run test:browser
npm run test:art
```

当前v4页面回归在构建后运行 `npx playwright test --config playwright.v4-ui.config.ts`。保留的forge-v3界面回归可单独运行 `npx playwright test --config playwright.v3.config.ts`（Chromium/Firefox/WebKit须已安装）；不要在浏览器批次运行时重建共用dist。

`check`运行单测、严格类型检查与双构建。`test:browser`一次构建后串行运行当前v4页面与v4/兼容存储SDK；也可分别用`test:e2e`/`test:storage:browser`。真实Chrome原生窗口/缓存探测采用隔离profile；测试只改变测试侧时钟/事件，不注入钱包/终局。美术检查使用独立设计页，不作为正式游戏验收。单项命令还包括`npm test`、`npm run typecheck`、`npm run build`和交互`test:watch`。

保留的forge-v3界面配置可在同一构建上测试三种引擎：

```bash
npm run build
npx playwright test --config playwright.v3.config.ts
```

使用4186端口、单worker、无重试；v0.5阶段曾枚举105项（三引擎各35，当前清单以 --list 为准），含21项来客/册页/无门槛交差/错误回退，以及此前84项锻造、成长、完整十二轮/失败/商人/保存和场景回归。完整局用原生Tab/Enter/Space逐命令对照正式内核。对应历史主改版实测为102项全过，最后册页专属CSS修补后21项全过；45个产物路径不变，主JS改名但内容同字节，不把这两份报告称为一次105全绿。报告见[R3.17](docs/reviews/R3-17-traveler-notebook.md)；最终全DPR/原生生命周期/组合故障/音频/性能矩阵另验。

跨引擎工具：`npx playwright install firefox webkit`后可执行旧版/混合定向配置`npm run test:cross`。旧D细锻矩阵单独执行：

```bash
npm run build
npx playwright test --config playwright.v2.config.ts
```

新版配置使用4182端口、单worker、无重试。R3.7首版基线为六个Chromium/Firefox/WebKit的DPR1/2项目各35项加原生Chrome两项，共212项；本次主界面二版新增视觉流程用例，实际枚举和结果以当前报告为准，不能把旧212称为新构建全量通过。每个项目都包含纯键盘十二轮、三商人、失败重开和组合保存故障；两种桌面尺寸由规格明确覆盖。输出`test-results/v2-release/`与`test-results/v2-release-report.json`，不会覆盖旧版/存储报告。原生Chrome窗口/缓存探测独立标记，不会伪标为Firefox/WebKit。运行中不要重建同一个dist；具体结果以技术验收报告为准。Playwright WebKit引擎不是在真实Safari产品上验收，Chromium也不等同真实Edge。[贡献说明](CONTRIBUTING.md)列出证据归档与边界。

当前 forge-v4 模型与独立审计（先构建，每个输出路径必须新建）：

```bash
npm run build
node --test tests/model/v4-policy.test.mjs tests/model/v4-metrics.test.mjs tests/model/v4-model.test.mjs tests/model/v4-audit.test.mjs
node scripts/v4-model.mjs --seeds 1000 --workers 6 --out tmp/my-v4-model --seed-prefix v4-balance
node scripts/audit-v4-model.mjs --input tmp/my-v4-model --out tmp/my-v4-audit.json --seeds 1000 --prefix v4-balance --workers 6
```

30组含打法、消融、固定点击、负对照和镜像，并非30种独立玩法。每局完整journal／终态保存在gzip中；独立工具另外重放全部终态、核对经济与全部摘要。运行期间不得修改源、测试、配置、公开资源或构建；观察超时应继续读取原进程，不能重复启动。已归档批次绑定冻结提交`13538b0`，复核它须按[归档复现说明](docs/evidence/T11-4-2-3i6-model/README.md)恢复独立checkout和完整原构建，不能拿修改后的界面源码冒充原输入。策略和指标解释见[验证合同](docs/v0.7-balance-validation-contract.md)。

历史 forge-v1 模拟与回放（会编译旧tmp/simulation；维护现有证据时在独立checkout复现）：

```bash
npm run simulate -- --seeds 1000 --workers 6 --out tmp/my-verification
npm run simulate -- --replay docs/evidence/T06/verify-v1.medium-victory.json
```

默认53场景，每个最终状态都完整回放；输出统计JSON、逐局CSV.gz与胜负witness。已有输出不会覆盖；参数、输入误差假设和指标边界见模拟合同。T06 实测批次约18分钟，速度取决于设备，模型输入秒数不等于脚本耗时或真人整局时长。

B旧版入口为`/legacy.html`，D细锻为`/v2.html`，v0.4为`/v3.html`，v0.7三章十二天为`/`；开发服务还提供`/design/b/preview/index.html`美术校验页。`test:art`核对B风格的9张图片、alpha、288姿态、24材料帧和设计组件；D素材在新版UI/alpha规格中核对，两者证据分别记录。旧阶段机器证据归档工具为`node scripts/collect-ui-evidence.mjs --stage T10 --out <新的证据目录>`，已有证据不覆盖；归档前需生成最新unit/UI/storage报告。新版完整矩阵使用贡献说明中的v2 collector。

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
