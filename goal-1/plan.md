# Goal 1 执行计划

## 当前状态（2026-10-21）

原始需求逐字保存在[input.md](input.md)，SHA256 b961f5c651df51121659687138cfe5edf125e25dadda11642136dfc6aaca852b。目标仍是完整PC网页锻造游戏、设计/实施文档、三套imagegen主界面及选定衍生美术、完整可玩流程、复核和GitHub提交推送；整个goal ACTIVE，未完成。

当前只执行tasks.md的3i.5“第三章、三结局与跨局内容”。已获明确批准“确认 v0.7，按完整方案分阶段实施”，D画风/直接左键/自然锤姿保持，不重复索要已获批准。基线2fec6a18c75f33c26d48da4c07f542369411d90d；前八天和R3.20已交付，本轮终章代码/九图已制作，技术核对已完成，提交推送核对尚待闭环。主预览已在本轮验证后有意切至71430的终章快照，不强刷用户标签。

当前plan/tasks曾积累大量相互覆盖的历史检查点；其完整原字节已保存于[旧计划](history/2026-10-21-before-final-chapter-plan.md)和[旧任务执行记录](history/2026-10-21-before-final-chapter-tasks.md)，哈希见[归档索引](history/2026-10-21-archive-index.json)。本页只维护有效当前计划，历史成果/红绿/全部原任务未丢失。压缩后仍须全量读取input/plan/tasks这三份当前文件，再按需读明确引用的历史或合同，避免把旧“待批准/正在运行”当现状。

## 已确认的产品和架构

- 私有仓库 https://github.com/GOD-OF-PPT/sword-led，main；现代PC浏览器，不做低版本兼容，不重写成熟Canvas/DOM为新引擎。
- [批准方案](../docs/v0.7-complete-game-proposal.md)是三章十二天、12真实委托、3配方、3可选改造（每局选2）、6事件、6手艺、3结局和跨局炉谱/行脚挑战；不以重复涨价、更多面板或概念图替代内容。
- forge-v4纯核决定条件/价格/资源/随机/阶段；V4Session唯一dispatch与局档/炉谱保存。独立schema4局档和schema1炉谱、旧同源writer锁；原v1/v2/v3解释器/key/旧入口和用户存档不改，不静默迁移。创建资格固化，跨局无钱包或永久数值叠加。
- Game Studio UI/Playtest/Foundation沿已认可D“行脚灯炉”：一簇紧凑目标、大剑/砧/来客/剑架，主要动作敲/交/留/收工；规则/炉谱/长叙事主动展开，关键新结果有明确行动，动效不发奖，读档不补播。保留键鼠/焦点/44px/静音/减弱动效/错误恢复。
- 新能力先合同与已批准OpenSpec；普通修复不另造审批。引用用户RTK/GJ/REPEAT和祖先适用AGENTS；全部shell经rtk，必要依赖复用，无新运行时依赖。

## 当前验证与预览（2026-10-21）

quality-final-memory357单测/29文件、strict/网页+SDK构建终态0，480质量输入稳定、75运行文件。最终浏览器覆盖24唯一逻辑/每引擎8：final-boundaries9真过＋final-memory3修复过＋final-journeys12过；同75产物，478实际浏览器执行输入稳定，唯一测试输入差异由导出等待exact原文/替换/hash证明。原边界3条错误等待另一导出按钮、旧release ENOSPC及中断均保留原红，不冒称单批24全绿。全部wrapper/child已实际终态。

收集器终态0；当前SDK回放97保存对象（最终69/历史28、64唯一状态）、校验55合法炉谱（最终39）、4明确未来负样例及3memory磁盘观测。8张代表图、所有具体源/构建/终态、来源与恢复收据在docs/evidence/T11-4-2-3i5。原8SDK/旧三入口仍同字节，66→75中63路径不变，只默认index/main JS/CSS及九图新增。原input/批准全文/21旧编译/0316备份/58美术冻结最终复核匹配。

已先核原26789命令与旧HTTP，有意切换到71430/4179/新75文件快照tmp/previews/T11-4-2-3i5-mountain-pass。全部HTTP同最终构建；隔离实际3左键+交剑/刷新、实际第8天→9及护灯已成归途→炉谱/作品/真实导出，共14对象、0错误。未强刷用户标签/触碰用户档。尚待主提交与任务回执push及Git blob/远程最终身份，tasks当前仍未勾完成。

## 当前3i.5详细实施与交付

详细接口先于代码写于[终章合同](../docs/v0.7-final-chapter-interface.md)，操作说明在[终章指南](../docs/v0.7-final-chapter-guide.md)。范围：旧day8 summary显式继续9；第9–12天真实委托、最后商人/事件、护灯验剑；三结局和三位来客后日谈；12作品详情、配方熟练/手艺见闻和合法挑战入口。九张原创运行图目标2MiB、硬2.5MiB，最后选择q72总2,384,710字节以保细节（软目标未达、硬预算满足），原PNG/prompt/直接引用/hash保留。

journey/stages只投影实际commissionOrder/history/核心ending与DOM意图。护灯交付不等于胜利，收工才决定phase；victory可10或11项，return也可能已做成护灯剑，失败可在任意章。第11委托逐路线计数，winning pieceIds和所有matchedPieceIds分开，单新剑不冒称两柄；跨到第12天仍能回看部分/额外交付。作品详情读合法集合收据，不构造假的RunState或复制判定。

root app唯一控制新局确认/保存/输入/表现；challenge需合法已安全保存的资格，pending/problem/readonly不可给可执行入口，明确memory可用已有合法资格而不改磁盘。回看不发命令/资源；新页从顶部，嵌套作品回退焦点可见。实际level/bursts靠剑展示，D场景按真实委托/phase选图，完整contain保安全区，有失败回退。

已写src/presentation-v4的journey/stages/collection-ui/app/shell/story及专属CSS和必要测试；无核心/保存合同变更。初轮355过2失败是测试只scrap第二柄后第三柄又合法补齐双驿，已保原诊断并改合法分支，19定向过。最后补了嵌套焦点/作品页继承160px滚动的实机缺陷，红绿诊断保留。正式最终quality98865已终态0：357单测/29文件、strict与网页/SDK双构建75文件，353实际执行输入前后无漂移。旧66产物中63路径同字节（含8SDK与旧三入口），仅默认index和main JS/CSS变化；后续浏览器仍须实际完成，不能将单测/构建当整局验收。

验证按实际依赖执行：
1. 最终unit/strict/网页+SDK构建顺序执行，事前捕获全部实际src/tests/scripts/config/public运行图和witness；unit/build不读design元数据，艺术家只在独立design补资料，完整design/public随后一起冻结进浏览器。活跃批次不改它消费的源/测试/构建；不因观察超时重启。
2. 先Chromium的两尺寸三结局/真实作品页可读性与旧保存day9可玩边界pilot，实看后修复；没有源码变动时不重复已过case。再三引擎五个真实journey case及余引擎视觉/边界，总计划21逻辑例（未执行完成，不预填绿）。每批独立目录、实际PID/token/terminal/输入和产物指纹、零自动重试，红绿如实分批覆盖。
3. 实际UI210胜→合法216挑战、194归途+6失败（键盘/0pointer）、208两新剑、213先新后旧且护灯已成仍return。恢复样例/未来炉谱/readonly/memory开局/单剑失约跨天仅算明确边界，不冒称额外整局。保存真实run与collection原文，当前编译SDK逐对象完整回放、集合领域校验；不注入钱、phase或资格，不偷看RNG。
4. 独立核对全部9原图/运行图/预算/引用/alpha、两PC尺寸/按钮/无404和正文可见；旧8SDK/旧网页产物及原source按字节等价复用，有变化按依赖补消费者，不重跑无变化模型凑数。
5. 完成报告、来源/凭证/依赖/文档和全差异发布清单/Git blob。验证后另建75左右文件的冻结预览，核实旧26789命令与旧HTTP后有意切换，全部HTTP同构建并隔离新鲜浏览器实际smoke，不动用户标签/存档。主交付push终态0及新远程同SHA后，标本task完成，另提交任务回执，再核干净/远程/全blob/预览，简报结束。

## 磁盘与证据保存

磁盘曾真实ENOSPC，先前大QA PNG试压只省7%已放弃，未动原件。为本轮测试，26份旧QA副本已和既存0316 Git备份的22个blob逐字节复核，并实测恢复一份5,689,571字节trace后再次移出；总逻辑384,579,335字节，statfs观测约745MB→1.12GB，不将全部差额归因整理。元数据、完整恢复映射和restore.mjs在tmp/T11-4-2-3i5/qa-git-archive，交付时纳入轻量证据。旧原路径可按映射从本机Git恢复，不覆盖已有不同文件；只承诺字节/mode/毫秒mtime，不声称xattr/亚毫秒时间。游戏源码、原画、用户档、旧预览、simulation和Git对象均未删除。

必须保持input上述hash；批准时全文docs/evidence/v07-approval/approved-proposal.md SHA256 3eba82c2b60f126b49c772daea40df87fa631ecf979dbc5d7c0834b177c884fb；codex/workshop-scene-full-evidence仍指0316e0711fd590debb592dc41cfc4190d47e3be7；tmp/simulation原21编译文件按docs/evidence/T12/run.json校验，不重编译覆盖。正式/失败原件先留本机与hash，远程发布全部游戏/原美术/prompt、报告/真实对象与必要代表图，不再推巨型trace；可逆归档必须有明确恢复收据。

## 风险、自审与回滚

风险包括只放开日期冒充终章、把护灯交付当全胜、挑战按日期画错用途、先新后旧误算两剑、未保存炉谱提前发资格、readonly/memory写盘越权、作品页滚动/焦点/裁切、原画或证据被清理、批次漂移与伪称全绿。各项由核心事实/唯一port、合法不同路线/具体恢复和失败、实机截图/键鼠/真实对象回放、明确档案身份验证；当前已知缺陷继续修复复验，不以测试数量代填玩家满意。GJ连续三次正式审查退回才按规则求指导，普通debug失败不等于三次退回。不能客观保证零bug，以本task可核验证据闭环，列未验证条件。

回滚使用新增revert，保留全部旧档/key/原PNG/旧预览及Git备份，不强推或删除历史。当前3i.5完成后仍有3i.6的v4 1000共享种子/多策略/反退化/全部终态回放，T11.4.3的当前v4最终两尺寸/DPR/三引擎/原生生命周期/音频性能/故障矩阵，以及T12最大R4/原始五项/REPEAT和真人H。3i.5/.6/最终矩阵作为下一组三项全面review/debug；全部必要任务完成才update_goal complete。

每次只执行一个task。结束前自问“你对当前实现100%有信心吗”，有据漏洞立即修复，不作绝对无缺陷宣称；提交交付物→标任务/记录自审与验证→任务回执提交→简报结束，由goal自动续轮。最新H为v0.6完整性未通过，v0.7实施批准不等于新玩法/听感或整个目标验收。
