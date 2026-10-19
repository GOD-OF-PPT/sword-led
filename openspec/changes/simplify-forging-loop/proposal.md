# Change: 用增值、风险和收手重建默认锻造循环

## Why

用户实际试玩后确认美术已更新，但认为交互复杂、缺少游戏性。完整实况时间轴与关键画面复核显示，ForgeTax把即时增值、停手和有限剑的竞争用途放在中心；现版却先要求多轴加工，未淬火时主要价格仍为底价。新方案见[可审阅实施文档](../../../docs/v0.4-gameplay-proposal.md)与[研究](../../../docs/research/2026-10-19-forgetax-session-study.md)。

## What Changes

- **BREAKING（仅新模式）**：新增forge-v3/schema3；默认单击落锤，每锤直接计价。以两次裂损、六格锤势连锻、交差/留剑/以剑换手艺形成取舍。新模式不要求选十点、逐锤换锤、卡时机或独立水油加工。
- 保留D美术和已有设置/音频/生命周期能力；真实Accepted结果驱动锤、火星、剑型、裂纹和身价反馈。
- 先完成前三轮真实可玩切片和真人反馈，再完整十二轮/多策略/浏览器/最大审查。没有删除原goal的完整交付与1000种子义务。
- 原forge-v1/v2解释器、入口、key、历史证据和可续存档保留，不迁移或重解释旧journal。

## Impact

- 新能力规格：`forging-v3`。既有两个提案不改写成被新规则验收通过。
- 新模块：`src/core-v3/`、`src/application/v3-persistence.ts`、`src/presentation-v3/`及独立SDK。复用已有generic会话/存储、同源writer锁、D资产与设置；不新增运行时依赖。
- 默认入口切换会明确版本，`v2.html`与`legacy.html`保留。回滚为新增revert及旧快照，不覆盖用户档。

## Approval

2026-10-19用户已明确确认“确认 v0.4，开始前三轮开发”，原问答见docs/decisions/2026-10-19-v04-approval.json。新规则实施前置满足，不重复申请D美术或v0.3/v0.4权限。
