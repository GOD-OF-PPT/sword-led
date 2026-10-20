# 3i.5 山口终章、三结局与完整炉谱

**3i.5实施与技术核对完成；提交及最终远程身份见任务回执。** 2026-10-21；基线 `2fec6a18c75f33c26d48da4c07f542369411d90d`。本轮接通第三章、三结局及跨局入口；整个goal仍在推进，平衡、广矩阵与真人体验另行完成。

承接已批准的 [v0.7 方案](../v0.7-complete-game-proposal.md)、[终章合同](../v0.7-final-chapter-interface.md)、[核心合同](../v0.7-core-contract.md)及[保存合同](../v0.7-persistence-contract.md)。玩家操作见[终章指南](../v0.7-final-chapter-guide.md)。不变更计价、风险、随机流、存档 schema 或旧 SDK。

## 本轮实际实施

- 第8天选完第二件炉具后可明确继续第9天，同局保留手艺、配方、留剑与随机状态。第三章使用山口未完成场景；实际第9天商人和第9/11天事件沿核心日期发生，挑战则按委托编号选择用途场景。
- 委托9显示真实连锻次数；委托10可走裂护刃或更高身价无裂护刃；委托11支持旧剑一柄或当日新剑两柄，第一柄只记部分进度；委托12检查无裂重锋、等级与身价。条件与动作继续读取核心公开投影。
- `journeyOutcome` 分开保存胜出 pieceIds/blades 与所有 matchedPieceIds/matchedBlades。历史部分交付、先新后旧及挑战重排都使用实际交付日；跨至第12天仍可在灯路回顾展开第11委托收据，不能把单剑写成双剑完成。
- 护灯交付仅进入局部验剑，核心仍处于 workshop；收工才按真实 phase 进入胜利、归途或失败。结局读取核心 completed、missingCritical、finalBladeMade，允许11/12胜利及护灯已成仍归途，不把前期失败后的未抵达写成失约。
- 三位来客分别回顾自己四份委托和真实作品，提供“听听三人的后话”入口。炉谱展示十二项最佳作品、实际路线/交付日/来料日、配方/等级/裂纹/普通锤/连锻/身价、三章资格、配方熟练和六手艺见闻。缺页不生成假作品。
- 持久化成功的合法胜利成果才提供挑战资格；标题、炉谱和结局按 pending/problem、写入模式及冲突门控。新局仍经 V4Session 读取资格并明确确认覆盖；已有资格不携带跨局钱包或倍率。

阶段模块只返回 DOM 与意图，root app 保持唯一 dispatch/保存/模态/输入所有权。旧第4/8天投影边界仍可显式测试；实际生产默认十二天。旧档与旧预览保持独立。

## 发现与修缮

1. 初始新增单测355过、2失败。测试仅把第8天第二柄改成回收，但后来的第三柄原行会售卖会合法补成第二份交付，核心因此正确保持胜利。修为保留第一柄真实交付、其余当日 deliver 改为合法 scrap；全部锤击和随机抽样保持。定向19项通过，原红摘要与拒绝的初始假设均保留。
2. 补齐第11委托历史的逐路线计数、完成收据与额外匹配交付；只读的炉谱/结局挑战入口与标题门控一致。嵌套作品页关闭后回退到可见阶段控件；打开模态重置正文滚动，修复实际诊断中 scrollTop=160 导致作品顶部被遮住的问题。
3. 后日谈增加直接进入阅读区的入口。原合法结局 visual 样例与新局路径分别验，不将恢复样例说成从头通关。
4. [只读源码复核](T11-4-2-3i5-independent-review.md)发现 memory 结局可能把临时成长说成已保存。root 已接入内存状态说明，并补 readonly→明确 memory 恢复边界；第一章中途来信已补第3天提示及灯路回顾。两项属于新最终构建；memory恢复边界三引擎3/3已通过，首章来信在新局长路径核对，不能沿用先前旧构建绿批次。

## 最新已完成的质量检查

来源：`tmp/T11-4-2-3i5/quality-final-memory/`，对应 memory 文案与首章来信修补后的新构建。

| 检查 | 已观察结果 | 边界 |
| --- | --- | --- |
| 全套单测 | 357/357，29文件；exit0 | unit PID63131，2026-10-20T18:18:23.195Z 至18:18:35.835Z |
| 严格检查及生产/SDK构建 | exit0，75个运行文件 | build PID63306，至18:18:40.076Z |
| 本次质量批次输入 | 480项，changedInputs=[] | 包含实际源码、测试、配置、公开图、设计来源和指定样例；不代表浏览器批次已通过 |

`quality-final-memory/result.json` 中 scope 文本仍带早先“21 final cases”表述；最终计划调整为**24个唯一逻辑用例**，实际按边界9过＋修复后3过＋长路径12项覆盖；原始质量记录保留当时文字，最终收集器检查24唯一映射，不以旧21项代填。

## 浏览器批次及构建边界

历史诊断原件均保留，不计入修补后新构建的最终覆盖。

| 批次 | 真实终态 | 本页如何使用 |
| --- | --- | --- |
| pilot | 2通过，exit0；输入无漂移 | 旧构建 Chromium 结局双尺寸及旧summary继续诊断 |
| pilot-listen | 2通过，exit0；输入无漂移 | 旧构建后日谈入口与结局图实看；不等同最终全局验收 |
| release 原15项 | exit130，有意中止；3真通过、2基础设施失败、1中断、9未跑 | 历史诊断；报告的10 skipped包含中断1与未跑9，不能称15项通过 |
| repair | 2通过，exit0；输入无漂移 | 原ENOSPC失败的 Chromium 长路径定向复验，仍属 memory/来信修补前旧构建 |
| final-boundaries | exit1；9过、3测试失败，266.719s；无漂移 | 9个结局双尺寸/旧summary与外部保存边界计覆盖，3个导出等待错误不计通过 |
| final-memory | exit0；3/3，40.181s；无漂移 | exact修正直接下载等待，三引擎复验未知炉谱/readonly/memory及真实导出 |
| final-journeys | exit0；12/12，1870.645s；无漂移/跳过/重试 | 三引擎各4例：实际新局胜利→合法挑战、键盘归途与独立失败、两新剑、先新后旧归途 |

原 release 的 Chromium 长路径在保存 `challenge-eleven-real-commissions.json` 时发生真实 ENOSPC，trace导出亦 ENOSPC；two-new的证据目录创建报ENOENT并伴随trace ENOSPC。root 核实自有进程后发 SIGINT，终态130，保留报告和不完整证据，不把磁盘错误改写成玩法失败或通过。中断的 Firefox 用例当时仍停在 busy 观察，不将其列为完成的正式失败或通过。

随后仅增加长路径测试的 `test.use({trace:'off'})`，逐字去掉该块可还原原测试哈希；命令、断言、超时及当时75个游戏运行文件不变。两条 Chromium 定向复验真实通过。**此证明只跨原 release→repair 的诊断修改，不跨之后 memory/来信的新构建。** 最终批次必须在新构建重新覆盖全部24逻辑项，不拿历史三项补绿。

最终批次身份与覆盖：

- final-boundaries：token v07-final-boundaries-01，wrapper63602/child63608，exit1，9过3测试失败、无中断/skip/自动重试。测试误将结局直接下载当成打开保存弹层，等待另一按钮直至60秒；生产文案断言已通过。原红/截图和exact修正保留。
- final-memory：token v07-final-memory-01，wrapper64559/child64561，exit0，3通过。导出等待在点击前建立，之后当前SDK重放实际下载；原run字节不变、空炉谱仍null，不能解锁挑战。
- final-journeys：token v07-final-journeys-01，wrapper64946/child64947，exit0，12通过；2026-10-20T18:27:11.177Z至18:58:23.502Z。每引擎实际执行210主线胜→216合法挑战、194键盘归途＋6命令独立败、208两新剑胜、213先新后旧且护灯已成归途。各自独立新局，不修改钱/日期/phase/RNG或资格。
- 三批须同75运行文件，各批前后无漂移；边界批→修复批唯一输入差异为同一测试的直接导出等待修正，exact原文/替换/hash经收集器重建。收集器已严格核对通过，当前478执行输入与最终旅程完全相同；质量批次的480包含其额外批准快照/质量脚本，计数边界不同。
- [24项唯一覆盖表](../evidence/T11-4-2-3i5/case-coverage.json)为9+3+12，每引擎8项；[批次身份](../evidence/T11-4-2-3i5/batch-identities.json)保留每批源/运行hash及原红，**不是单批24全绿**。
- 恢复样例、memory开局/导出和早期失败在[对象回放记录](../evidence/T11-4-2-3i5/replay.json)分别标记；不冒称额外完整十二天UI局。[本机原件索引](../evidence/T11-4-2-3i5/local-formal-originals.json)记录原路径/字节/hash，巨型trace只留本机，发布其真实摘要。

## 原创D美术与预算

九张实际运行 WebP、九张原 PNG、完整prompt与直接引用/hash保存在 [design/d/v07-chapter3](../../design/d/v07-chapter3/README.md)。六张独立场景、三次直接母图编辑；接力部分/完成各自直接编辑同一arrival母版。局部护灯与全胜场景分开，归途允许护灯已成，任意章失败不画成作品毁坏。生成编辑存在局部纹理变化，不宣称逐像素遮罩替换。

最终 q72 总计 **2,384,710 bytes**。2MiB软目标未达，超出287,558 bytes；2.5MiB硬预算2,621,440 bytes通过。q60虽压至2,066,134 bytes，实际细线与山雾表现较弱，主控在硬预算内选择q72画质；不声称双预算均通过。

`verification.json` 记录九组源PNG逐字节副本、prompt/引用、原生尺寸、单帧与不透明alpha=255、同参数内存重编码精确等于运行WebP。八图1672×941，局部护灯1673×940，不缩放或裁切原件。画面完整contain，实际兵器/数值由代码绘制。`visual-review.json` 绑定九张原PNG及九张最终q72逐图目检；root 另核58个冻结文件哈希。美术来源/解码/预算检查不替代游戏条件与浏览器验收。

## 证据、保存与磁盘

- 当前SDK正式回放97个保存对象（最终构建69、历史诊断28，合64个唯一状态）；校验55个合法炉谱包（最终39）、4个明确schema999负样例及3份memory磁盘原文观测。3份最终memory导出有实际下载并全回放。预览另验证14个对象，不并入97冒充更多整局。
- 发布证据在[本轮目录](../evidence/T11-4-2-3i5/replay.json)：报告、逐例覆盖、实际对象、8张代表图、各批before/after与终态、质量/图源/修复原文、Git可逆归档收据及工具原字节快照。工具保持原执行路径的相对导入，归档tools不直接充当新执行目录；重跑网页可使用下方正式测试命令。无未解析证据JSON；原ENOSPC缺失的最终文件/trace不伪造补齐。
- 原input SHA为 `b961f5c651df51121659687138cfe5edf125e25dadda11642136dfc6aaca852b`，批准全文SHA为 `3eba82c2b60f126b49c772daea40df87fa631ecf979dbc5d7c0834b177c884fb`；[最终保留核验](../evidence/T11-4-2-3i5/validation/preserved-inputs-final.json)再次确认21个旧编译文件、全部58美术冻结文件、原文及备份ref均匹配。
- 旧QA整理只移除了26份已逐字节核对至保留Git备份 `0316e0711fd590debb592dc41cfc4190d47e3be7` 的普通诊断副本，逻辑384,579,335 bytes；不涉及源码、用户存档、原美术、旧预览或编译。recovery-map/restore脚本记录原路径、Git blob、SHA、模式与mtime；抽样真实恢复5,689,571 bytes验证字节、模式及毫秒mtime。xattr与亚毫秒mtime不在承诺中。
- 清理前后观察可用空间变化375,361,536 bytes包含并发系统活动与APFS共享，不当作精确物理回收量；可恢复Git对象与备份ref必须保持可达。

## 发布核对与后续责任

| 项目 | 状态 |
| --- | --- |
| 旧8SDK/旧运行消费者 | 最终66→75，63同路径同字节；8SDK/旧三入口均同字节。只更默认index/main JS/CSS及新增九图，见[等价表](../evidence/T11-4-2-3i5/validation/build-equivalence-final.json) |
| 本机预览 | 已核原26789命令/旧index后有意替换；新PID71430，`tmp/previews/T11-4-2-3i5-mountain-pass`。75HTTP逐文件同最终dist |
| 实际预览smoke | 隔离新浏览器5接受命令含3次可信左键、交剑/原字节续玩；实际第8天档→第9天；实际护灯已成归途→后话/炉谱/作品/导出，14对象通过、0页面/资源错误。见[收据](../evidence/T11-4-2-3i5/preview/result.json)；未读写用户档/刷新用户标签 |
| 来源/依赖/凭证 | 原PNG/prompt/引用与冻结核对通过；无核心、保存、包或依赖变更，npm audit0漏洞。暂存全文件/解压日志凭证扫描、本地文档链接及Git blob核对由[发布清单](../evidence/T11-4-2-3i5/publication-manifest.json)与[核验](../evidence/T11-4-2-3i5/verification.json)记录 |
| Git提交/远程 | 主提交与实际push终态/新远程SHA、后续任务回执和干净状态记入[任务记录](../../goal-1/tasks.md)；预览不是公网部署 |

复跑本轮网页范围时，先安装三引擎并顺序执行`npm test`、`npm run build`，再用Playwright v4配置选择`v4-final.spec.ts`、`v4-final-visual.spec.ts`和`v4-second-saves.spec.ts`，grep为`a fresh|a complete keyboard|explicit restored-ending|existing legal endings|a saved first-chapter|an external day-nine`。不要在运行同一dist的批次中重建；一次新24例运行是新的身份，不改写本轮9+3+12来源记录。

本轮仅3i.5。3i.6的1000共享种子/策略与全终态回放、T11.4.3最终DPR/原生生命周期/音频性能/故障广矩阵、真人H及最大R4均保留未完成。当前小样路径、源码复核或推送均不替代这些责任，也不宣称玩家已认可整体乐趣。
