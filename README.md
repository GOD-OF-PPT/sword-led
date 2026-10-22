# sword-led · 锤下求生

一款面向现代 PC 浏览器的轮次制锻造游戏。每日只有三柄兵器：左键落锤让它升值，在断裂前决定交剑、留剑、换艺还是回收，带着炉火走完十二份约定。

**当前默认版为 v0.8「炉边报价 · 三柄行囊」：[本机试玩](http://127.0.0.1:4179/)**。三章十二天、十二份委托、三次商人、两次炉具改造与三种结局均接真实经营和保存。作品估值与实际酬劳/品质加赏分开，行会有限收购；留剑占次日三柄中的一位，等级至少3的成器可换手艺。[完整操作指南](docs/v0.8-twelve-lights-guide.md)说明流程与取舍。已有v0.8首章档可从第四天收据继续；原v0.7行程从标题“续走旧行程”或[旧炉前](http://127.0.0.1:4179/v4.html)续玩，新旧局内金币和兵器不互迁。

报价现分三处：剑旁是“作品估值”，纸单是“整单酬劳／已领”，交付按钮是“本次实收铜钱”。按钮下列“本柄酬劳＋品质加赏＝实收”，点击“看报价说明”可查看加赏、行会折价和钱袋限制；双剑每柄按实际份额领取。[本次修缮与验证](docs/reviews/G4-T03-payment-progress.md)记录实际范围，完整技术收尾仍在进行。

设置中的“试听敲击声”现在每次明确点击都会替换之前等待中的试听，再发起一次尝试；旧请求晚到不会补播。已核对三个现代引擎DPR1的定向重试、连续试听和跨设置请求归属；[修缮记录](docs/reviews/G4-T03-preview-retry.md)保留原失败与具体范围。

刷新原标签页可见“v0.8 炉边报价 · 三柄行囊”。单双剑以独立剑位显示，旧剑／新剑明确任选一条；双剑分期收款，改走旧剑路线只补基础酬劳差额，已经交出的新剑仍有真实去向。达标提示可直接交出绑定的合格剑，裂纹提示打开实际差项，切剑后不会残留旧剑消息。连锻身价随真实接触逐记变化；跨阶亮出成器名，交出的原剑送到来客手中，刷新只恢复事实、不补发奖励。铁砧上方显示当前差项与风险，六格火星蓄满后下一锤安全连锻；“明日打算”列出真实纸单和一旧两新／三新坯，取下旧剑不补第四柄。第12天留架只暂存本局，不带入新局。旧契约仍可从“行旅种子与更早旧路”进入[旧版炉前](http://127.0.0.1:4179/v3.html)，旧D细锻和B版入口也保留。

商人摊先挑一件实物签，再在摊内挑献剑，直接比较今天实收、明日用途与交出的代价；确认前不移动炉前的剑。铁料和补印显示付款前后、确定收益及缺多少钱；买不起也能看收益。明日装箱可预览任一余剑，经余温后的确定身价与一旧两新，确认才挂架。钱袋空时可就近“安排这柄”，留剑、换艺或明确零价回收均有出口。借锤、炉棚、护送加料和保价以炉边实物区分待明日、此炉与真实本锤消耗；交易后铜钱、契印和新手艺按实际变化反馈。

终章要求两次连锻、裂护刃/无裂替代、旧剑接力/两柄新剑和最终无裂重锋；护灯剑交出后仍需收工，才按真实完成数与关键约定决定结局。“灯下归途”也可能已经做成护灯剑；未完成和未抵达分别记录。炉谱展示十二份最佳真实作品、配方熟练与手艺见闻，成功结局安全保存后才解锁挑战。明确不保存试玩不写入新炉谱，离开前可导出。

开场与灯路回顾现在明确目标：守住第4、8、12天的关键约定，至少完成10项并保有契印，才能十二灯复明。关键日收工前会说明失约后果；护炉契保印不补约。旧刃回收没有架上剑时，可用新入口返回铁砧，选余剑点“留给明天”挂架后再回来确认，今日坯也可交换；导航不会自动交剑。

[v0.8批准方案](docs/v0.8-workshop-economy-proposal.md)、[正式核心API](docs/v0.8-core-api.md)、[保存/导入合同](docs/v0.8-persistence-contract.md)、[R3.23三项复核](docs/reviews/R3-23-v08-twelve-lights.md)及[R3.24成长交易复核](docs/reviews/R3-24-v08-growth-trade.md)记录当前实现；[当前原五项交付复核](docs/reviews/R4-v5-delivery-review.md)汇总来源与尚未收到的真人反馈。现有页面记录已包含键鼠完整故事、真实赚取资格后的完整重排挑战，以及两新剑、旧新混合、归途与独立失败；实际范围见[当前流程复核](docs/reviews/G4-T02-current-flows.md)。流程可达不等于经营平衡或真人乐趣通过。历史v4的30,000终态及旧规则经济风险保留在[旧平衡报告](docs/reviews/T11-4-2-3i6-v4-balance.md)，不作为v5结论。[九张终章美术原件/提示词](design/d/v07-chapter3/README.md)及前两章原件保持。交互、界面与玩法继续优先，兼容广测后置；真人体验和最终最大复核仍待。本机预览未公网部署。

历史 [v0.6炉前](docs/v0.6-workshop-interface.md)和[R3.18](docs/reviews/R3-18-game-studio-forge-ui.md)保留原交付身份。[ForgeTax完整实况复核](docs/research/2026-10-19-forgetax-session-study.md)与Steam评论研究记录了参考依据；当前优化依据用户对主线、成长、内容的反馈推进。

2026-10-18真人曾评价v0.2玩法/美术缺乏新意；已据ForgeTax及110条唯一Steam评论修订并取得明确v0.3批准。[核心证据](docs/reviews/R3-5-v2-core-and-playable.md)保留928局策略与原试玩结果，[D界面说明](docs/v0.3-d-interface.md)记录新接线与独立练习。[新版技术验收](docs/reviews/R3-7-v2-technical-acceptance.md)与[44AC映射](docs/v0.3-acceptance.md)分别记录实际矩阵、故障修复及待办。真人再玩和最大交付仍按T11.4.2–T12推进，技术通过不等于玩家满意。

独立行程与带来源炉谱已接全十二天。旧主册/备份先逐项预览章节、配方、熟练、手艺见闻、挑战及作品，再明确确认；只合并成长，当前局资格保持，下一次启程才用已安全保存的新资格。

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

打开终端显示的地址，默认`/`为v0.8三章十二天（forge-v5规则），`/v4.html`为原v0.7三章十二天（forge-v4规则），`/v3.html`为旧版炉前，`/v2.html`为旧D细锻，`/legacy.html`为B版旧契约。生产版本用`npm run build`后`npm run preview`，默认端口4173。构建包含五个HTML、网页资源与core/session/v2/v3/v4 SDK及共享chunk，并独立追加forge-v5 SDK，应整体保留dist，不提交dist或node_modules。新版独立局档/炉谱、显式旧册导入与续玩API见[保存合同](docs/v0.8-persistence-contract.md)，旧v4会话和原件保持。需要通过localhost或HTTPS运行。

| 操作 | 用法 |
| --- | --- |
| 落锤 | 中央剑身区域鼠标左键；键盘聚焦落锤后松开空格，或Enter激活；无需卡时机 |
| 换剑 | 左侧剑架点击，或Tab/Shift+Tab移动后Enter选择 |
| 暂停 | Esc或暂停按钮；后台/失焦取消准备，不偷扣资源 |
| 交差/回收 | 满足委托条件的收件才计主目标；卖行会最多收身价四分之一，回收最多收原来料底价四分之一，均受今日钱袋限制；处置后不可再加工 |
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

现行v5浏览器验证入口为 `npm run test:v5:browser`（或在已冻结构建上运行 `npx playwright test --config playwright.v5-ui.config.ts`）。配置明确Chromium/Firefox/WebKit × DPR1/2；当前[验收映射](docs/v0.8-acceptance-map.md)逐项记录已执行范围，原生窗口、声音和性能另属后续检查。只跑当前键盘链可选择 `v5-keyboard.spec.ts --project chromium-dpr1`。旧v4用例明确进入 `/v4.html`，不会用v5首页去读v4存档。实际case清单以 `--list` 为准。

保留的v4页面回归在构建后运行 `npx playwright test --config playwright.v4-ui.config.ts`。forge-v3界面回归可单独运行 `npx playwright test --config playwright.v3.config.ts`（Chromium/Firefox/WebKit须已安装）；这些旧配置不代表当前v5页面验收，不要在浏览器批次运行时重建共用dist。

`check`运行单测、严格类型检查和网页/旧SDK/独立v5 SDK构建。`test:browser`一次构建后串行运行旧v4页面与v4/兼容存储SDK；也可分别用`test:e2e`/`test:storage:browser`。真实Chrome原生窗口/缓存探测采用隔离profile；测试只改变测试侧时钟/事件，不注入钱包/终局。美术检查使用独立设计页，不作为正式游戏验收。单项命令还包括`npm test`、`npm run typecheck`、`npm run build`和交互`test:watch`。

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

历史 forge-v4 模型与独立审计（不用于v5经营结论；先构建，每个输出路径必须新建）：

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

B旧版入口为`/legacy.html`，D细锻为`/v2.html`，v0.4为`/v3.html`，v0.7三章十二天为`/v4.html`，v0.8三柄行囊为`/`；开发服务还提供`/design/b/preview/index.html`美术校验页。`test:art`核对B风格的9张图片、alpha、288姿态、24材料帧和设计组件；D素材在新版UI/alpha规格中核对，两者证据分别记录。旧阶段机器证据归档工具为`node scripts/collect-ui-evidence.mjs --stage T10 --out <新的证据目录>`，已有证据不覆盖；归档前需生成最新unit/UI/storage报告。新版完整矩阵使用贡献说明中的v2 collector。

构建后可在 Node 中调用当前 forge-v5 正式内核（旧 SDK 保留给旧行程）：

```js
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
```

动作拒绝不改变原状态、随机位置或修订号。只对内核创建或 validateRun 校验过的状态调用；浏览器使用 createV5BrowserSession 自动尝试保存 Accepted 动作，dirty/冲突/显式恢复见[当前保存合同](docs/v0.8-persistence-contract.md)。保存详情可分别导出合法的内存行程、炉谱，以及磁盘主/备局档原文。原文导出在损坏/未知版本或只读时也可用，逐槽记录读取失败；它用于先留存资料，不直接当合法局档导入。

## 素材与发布

游戏名称暂定。AI 生成素材会连同提示词、版本与项目路径记录，最终运行素材在仓库内保存。仓库初始为私有；未另行指定开源许可，公开发布与商业使用的素材授权在交付前核查。
