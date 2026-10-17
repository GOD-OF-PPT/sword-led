# T02 实施文档检查记录

日期：2026-10-17。范围：本轮实施/架构/UI/验收材料及 OpenSpec 提案，不是 T03/R1 全面复核，也不代表业务实现或浏览器验收。

## 实际产出

[实施方案](../implementation-plan.md)、[架构](../architecture.md)、[UI](../ui-design.md)、[验收矩阵](../acceptance-matrix.md)、[工具核实](../technical-sources.md)，以及 `add-forging-game` 的 proposal/design/tasks 与四份能力规格。核心规则共 21 条 Requirement、45 条 Scenario，验收矩阵 44 项。三套图仍待 T03 生成，两项用户决定都仍待收取。

## 本轮实际检查

- `openspec validate add-forging-game --strict --no-interactive`：通过，返回 `Change 'add-forging-game' is valid`。
- `openspec list --json`：仅一份提案，14 个实施检查项全部未勾选。工具显示 in-progress 表示提案存在，不表示已实施。
- `openspec list --specs --json`：`No specs found.`；已交付正式规格目录仍为空，未把提案冒充发布完成的能力。
- 文档本地链接、代码块闭合、四能力/21 Requirement/45 Scenario 结构及每条 SHALL/Scenario：通过。
- AC01–AC44 连续无重复；所有 F/E/S/U 能力均在验收矩阵出现：通过。
- 三图共用样例的配额缺口、价值/下阶值、热度/应力和精准风险公式：算术核对通过，未声称实际 RNG 回放已运行。
- 原始 input SHA256 保持 `b961f5c651df51121659687138cfe5edf125e25dadda11642136dfc6aaca852b`；业务 TS/JS/HTML 文件数 0，无 package.json、无依赖安装、无代码实施。
- 核对本机 Node 22.12.0、npm 10.9.0、OpenSpec 1.3.1，读取 npm 包 engines/peer 元数据及官方工具/浏览器文档；保存版本与链接。尚未安装或验证项目工具链运行。

## 自我质疑发现并修正的缺口

| 质疑 | 修正与核对 |
| --- | --- |
| 暂停到底冻结一个可继续的蓄锤，还是取消？ | 游戏设计明确取消准备、恢复须重新按下；架构/规格同步，防止旧松开事件结算 |
| 蓄锤中换锤法或慢速设置能否偷换判定参数？ | 明确取消；attempt 固定目标/锤法/周期/runId/revision |
| 重新开局后旧动画/资源回调能否改新局？ | 会话 generation 失效检查，补专门 Scenario |
| 只按 JSON 类型读取能否载入破碎但完整度不为零等状态？ | 明确 unknown 重建、语义/版本/范围/阶段/账目校验；不把类型断言当验证 |
| 日终 current pieces 和 history 会不会重复算钱？ | 明确 workshop 额外计算未入历史的当前轮，已结算阶段不再双计 |
| 教学会不会覆盖正在进行的正式局？ | 明确独立练习，不先创建正式档；重看回菜单后续原档，不自动新开 |
| 好看的概念图是否会被当成成品页面？ | 三套同状态，正式数字/按钮均 DOM；背景/锤砧/铁件分层派生，实际浏览器完整局另验 |
| 文档是不是把构建/平衡/可玩性假设写成已通过？ | 所有未来命令标为合同，验收全是待运行；数值/性能/真人反馈明确未验证 |

[杠精审查] 通过：本任务的文档、架构决策、可执行顺序、异常路径与验证合同已交付；没有越过确认门槛，也没有用占位业务代码、静态图或未跑测试包装完成。下一任务 T03 实际生成图稿并做 R1。
