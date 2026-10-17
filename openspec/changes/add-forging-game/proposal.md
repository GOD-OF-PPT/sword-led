# Change: 完整轮次制锻造游戏

## Why

用户已有“在固定空间控制铁锤加工三件铁件，成功增值、失手破损，回收/商人/配额惩罚”的想法。需要把它变成可理解、可复盘、有完整胜负与经营决策的 PC 网页游戏，并提供设计文档、三个主界面方案、实现和 GitHub 交付。

## What Changes

- 十二轮契约，每轮三件行会来料，三锤法与按住/松开的时机操作。
- 纯规则模块处理进度/升值、热度/应力、裂损/破碎、交货/回收及确定性随机。
- 当轮交货配额、三枚契约印记、失败与通关；第 3/6/9 轮商人及原子购买。
- 可验证的整局模拟、版本化存档、暂停/后台取消、单写窗口和键鼠完整操作。
- 三套 imagegen 概念，由用户选定后派生资产，并实现主菜单/教学/工坊/商人/日终/终局。
- 类型/规则/浏览器/视觉验收、README 与 GitHub 提交推送。

## Capabilities

### New Capabilities

- `forge-loop`：来料、敲击、风险、升值/处置、可重放随机。
- `contract-economy`：配额、轮次/胜负、商人/升级、交易一致性、复盘统计。
- `game-session`：自动保存/恢复、输入时序、单写窗口、会话生命周期。
- `desktop-interface`：完整 PC 网页流程、教学、可访问性、选型与资产呈现。

### Modified Capabilities

无；当前项目没有既有业务实现。

## Impact

新增 `src/`、`scripts/`、`tests/`、`public/assets/`、`design/` 与 npm 工具链，实际路径按 [架构](../../../docs/architecture.md)。运行时只需静态托管；不引入账号、付费或多人服务器。规则与初始数值以 [游戏设计](../../../docs/game-design.md) 为准，验收按 [矩阵](../../../docs/acceptance-matrix.md)。

## Approval

状态：**2026-10-17 用户已批准实施**。用户实际答复为“确认 v0.2，开始玩法内核”；本提案对应 `docs/implementation-plan.md` v0.2 及链接材料。用户同时选定“B 行会手账”，独立记录在 `docs/decision-record.md`。T04 实施前置已满足，按既定顺序推进。
