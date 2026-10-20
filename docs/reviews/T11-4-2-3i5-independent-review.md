# 3i.5 终章集成源码复核

2026-10-21；基线 `2fec6a18c75f33c26d48da4c07f542369411d90d`。本次只读检查终章实施合同与 `presentation-v4` 的 app、journey、stages、collection-ui、story 及对应布局。未运行构建、浏览器或任何验证批次，未修改源码、测试或美术。复核与 root 的发布执行分开；复核者曾实现 journey/stages，因此这些文件属于再审，不冒称另一作者的独立验收。

## 已发现、交 root 修复

**P2：内存试玩结局可能把临时成长说成已经保存。** 复核快照的 `stages.ts:148` 仅依据 collection.pending/problem 选择“安全保存的作品……都留在炉谱”。`v4-persistence.ts` 的 refresh 仅在 writable(writer) 时将当前局成果并入集合；memory 局可以 pending=false/problem=null，当前炉谱仍为空。因此空炉谱下明确不保存试玩、真实走至结局后，该句与保存横幅相矛盾。未发现借此授予金币、作品或挑战资格。root 已确认修复并安排 readonly→明确 memory 的真实恢复边界验证；本报告写入时不宣称修复或复验已完成。

## 本次未发现其他实质缺陷的范围

- 结局由核心 phase 与 view.ending 的 completed、missingCritical、finalBladeMade 投影；护灯交付仍在 workshop，收工后才进入终局。十一项完成的胜利、护灯已成但关键约定缺失的归途、前期失败后的未抵达记录分别保留，不在 UI 重算胜负。
- 第11委托历史使用实际交付日与公开 routeAssessment；pieceIds/blades 为完成路线收据，matchedPieceIds/matchedBlades 保留其他真实匹配交付。跨至第12天仍可从灯路各站 details 查看，先新后旧不会被写成两新剑完成。
- 挑战入口检查合法炉谱、pending/problem 与当前写入模式；root 新局仍经 V4Session 重新读取资格、明确覆盖确认及 runId/revision/generation 票据。未来炉谱不会被 UI 当成资格，memory 不自行增发持久资格。陈旧回调最终仍受会话与核心拒绝。
- 后日谈入口滚动至真实人物记录并聚焦 summary；summary 使用原生可键盘访问控件。模态打开重置正文滚动，嵌套作品页关闭后按可见阶段按钮/标题回退焦点，不再固定聚焦隐藏的落锤按钮。这里是源码可达性核对，不代替两尺寸或浏览器实测。
- 动态文字经 element/textContent 创建，图片路径来自固定映射，新增投影/炉谱模块未引入 eval、动态脚本、外部请求或原始存档 HTML 渲染。collectionWorkPage 读取已经校验的 route/day/兵器收据，不伪造 RunState。对比基线的已跟踪生产改动集中在表现与入口；未发现核心规则、存档 schema、SDK 或依赖更改。

第一章中途来信 UI 遗漏已由 root 接手补齐 day3 提示及灯路回顾；属于已批准内容的接线补齐，本报告不将其描述为已验证完成。

## 复核输入快照

以下SHA256在问题发现后的文档整理阶段采样；app/stages已包含root随后接入的修补，不能用这两项哈希复现旧问题。问题发现和哈希采样不是同一时间点。修补前quality-release/after.json实际记录app为1208c0c00eedec9e8d3ea859a307bc92d7b9dc2a95d78d3dedcb2e4497b74105、stages为77b4651accb12b161994cbf5ded772efe2b8bce0cfca555d22ed062fa8305d07；两个阶段均由root最终证据保留。

| 文件 | SHA256 |
| --- | --- |
| app.ts | e8d60d445a2b4017dfee4eb9d3f0041bf3375ec6902d3eb28db846a20805eb41 |
| journey.ts | 0c47eec954b4fe74e1cbb7d014a7e2f248848994122962546c054cc7b21dc4b4 |
| stages.ts | 0cfafbfcb2f7a500df9bd4396bcab5bdb26135c58ac3f1aa3a117a160c19e342 |
| collection-ui.ts | b11330d0a4087e9ab5b7f6dfd8d207977f7e7f372ccf724c649c786d72b7d530 |
| story.ts | 74d326959eba88785b462ffe698af682a88bb956fea8c81132464ccb958ce8b6 |
| journey.css | 25080f062373e8e81247f320c419f3c5882b63506e108369d4f1618d055be3c0 |
| collection.css | 45fdc9c9f698fa2790084f49b085acd9617e9b67b026b6a5722753f117d55fd4 |

本复核不把 root 报告的既有绿批次、当前 repair 批次或 ENOSPC 诊断故障合并成“一批全绿”，也不重新计数其结果。修补后的内存文案/来信接线需定向验证；规模策略、最终广矩阵、真人体验及整体 goal 验收仍按原任务保留。

## Root 修复闭环（2026-10-21）

memory P2已由app显式传入temporary，并在章末/三结局说明本次成果不写入炉谱、离开前可导出；旧已保存记录保持。final-memory token v07-final-memory-01实际三引擎3/3终态0、40.181秒、changedInputs=[]；合法恢复结束局→只读→明确memory→直接下载实际行程，当前SDK校验等于原合法局，原磁盘run原文不变且profile保持null，无挑战入口。原三次测试失败是错误等待另一个导出按钮，exact测试修正与原红保留，不改游戏/断言/超时。

首章来信补第3天advance通知和灯路回顾，正常新局路径已在Chromium/Firefox主线＋挑战用例观察通过；不是读档补播。当前源码SHA如下，与上表稍后采样的哈希相同；修补前身份以上述quality-release快照为准，不将发现问题时与文档采样时混作一个快照。

- `src/presentation-v4/app.ts`：`e8d60d445a2b4017dfee4eb9d3f0041bf3375ec6902d3eb28db846a20805eb41`
- `src/presentation-v4/stages.ts`：`0cfafbfcb2f7a500df9bd4396bcab5bdb26135c58ac3f1aa3a117a160c19e342`
