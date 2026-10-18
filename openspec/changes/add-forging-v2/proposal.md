# Change: 锻脉、试剑与流派驱动的v0.3改版

## Why

用户真实试玩评价现版玩法/美术缺少新意，并要求研究ForgeTax及Steam同类评价。现版通过技术检查不能替代这个未通过结论。[研究](../../../docs/research/2026-10-18-forging-games.md)支持优先验证操作选择、成品用途和改变路线的构筑；这些仍是设计假设。

## What Changes

- **BREAKING for new runs only**：新规则forge-v2/schema2采用五节十点、锤法与时机、连纹、公开阈值损坏和淬火；旧版forge-v1原档/读取/继续保留。
- 增加选择委托、真实成品试剑/作品簿、一次性顾客回访、受限的超额结转、六技法/三槽和六种公开轮次事件。
- 按用户新偏好的D「行脚灯炉」派生独立美术，剑而非背景成为交互主体。
- 先做前三轮可玩验证，再完成完整十二轮和全流程/跨浏览器/真人复验；不把切片作为最终交付。

## Impact

- Added spec: forging-v2。v1能力仍由已批准的add-forging-game管理，不能用v2规则改写旧journal。
- Affected code: new src/core-v2, shared persistence adapter, presentation routing/input/scene/phases, styles/assets, simulation and browser checks.
- 产品/参数/边界/样例/验收唯一详细依据：[v0.3提案](../../../docs/v0.3-gameplay-proposal.md)。
- Status: Approved by the user on 2026-10-18: “确认 v0.3，开始前三轮可玩版本”. See [approval](../../../docs/decisions/2026-10-18-v03-approval.json). D is also preferred; no repeated confirmation gate for this scope.
