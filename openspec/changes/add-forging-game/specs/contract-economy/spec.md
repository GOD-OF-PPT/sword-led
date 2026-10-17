## ADDED Requirements

### Requirement: E01 Explicit quota and atomic round settlement

系统 SHALL 只把当轮实际交货总值计入配额，按十二轮配额表判定达标；不足扣一枚契约印记，保留交货金币，不追加债务或下轮罚配额。结算 SHALL 等玩家操作且整轮恰好一次，提前收工只回收尚 active 的铁件。

#### Scenario: Exact quota boundary
- **WHEN** 当轮交货恰好等于配额或低于配额 1
- **THEN** 前者不扣印记，后者只扣一枚；往日金币、台面估值和废料不补足缺口

#### Scenario: Close early
- **WHEN** 尚有 active 件且用户确认提前收工
- **THEN** 这些件按当时材料/阶级回收，随后一次性判配额和记录结果；取消或未确认不改变状态

#### Scenario: Ready without automatic penalty
- **WHEN** 最后一件被处理完
- **THEN** 保持工坊可结算状态，不自动扣印记；重复结算被拒绝

### Requirement: E02 Twelve-round lifecycle and terminal priority

系统 SHALL 从轮 1 进行至轮 12，初始三印记；扣至 0 立即失败，优先于商人/通关；第 12 轮结算后印记仍大于 0 则完成契约期。新轮 SHALL 只在合法继续动作时产生，重置当日材料/配额进度/煤，不重置金币/废料/升级/印记。

#### Scenario: Final round outcome
- **WHEN** 第 12 轮结算后印记为 0 或大于 0
- **THEN** 分别进入 defeat 或 victory，不再出现商人或第 13 轮

#### Scenario: Defeat on merchant day
- **WHEN** 第 3/6/9 轮结算耗尽最后印记
- **THEN** 进入失败总结，不能进入商人恢复印记

#### Scenario: Nonterminal continuation
- **WHEN** 非终局日终继续或商人离开
- **THEN** 恰好进入一次合法后继阶段，不重领材料或煤

### Requirement: E03 Scheduled merchant and meaningful upgrades

系统 SHALL 在存活的第 3/6/9 轮日终后提供固定四商品：锤柄、风箱、砧台、契约修补；价格、效果和上限遵循设计表。永久升级每级对正式玩法生效，每种每访至多买一级；修补每访一次且不超过三印记。

#### Scenario: Upgrade effects
- **WHEN** 购买锤柄/砧台/风箱并进入后续工坊
- **THEN** 精准区每级半宽 +200、裂损风险每级 −3 个百分点、下轮煤配给每级 +1；等级最多为 2

#### Scenario: Repair and visit limits
- **WHEN** 当次已经修补或印记已经为 3
- **THEN** 修补不可购买；未购买且印记不足时按 240 金币与 6 废料原子扣费恢复一枚

### Requirement: E04 Atomic purchases and resource invariants

系统 SHALL 在商人阶段验证商品、余额、等级和当次限购后一次性扣除金币与废料并生效；任何验证失败或重复动作都不得部分扣费。所有资源 SHALL 是有界非负整数，煤/升级/印记不得超出规则范围。

#### Scenario: Insufficient one currency
- **WHEN** 金币足够但废料不足，或反之
- **THEN** 拒绝交易，两种货币、等级、限购记录和 revision 全部不变

#### Scenario: Duplicate purchase
- **WHEN** 重复提交相同购买或当访重复购买同商品
- **THEN** 拒绝，不重复加级/修补或扣费

### Requirement: E05 Honest run summary and replay statistics

系统 SHALL 保存每轮交货/配额/印记变化、铁件处置/破碎损失、购买与本局统计，终局展示达标与违约轮数、最高阶级、金币及破碎情况。重开 SHALL 全量重新初始化，不把上一局资源带入。

#### Scenario: Contract completed despite one final breach
- **WHEN** 第 12 轮违约后仍有印记而通关
- **THEN** 总结明确标出该次违约，不声称十二轮全部达标

#### Scenario: Same-seed retry
- **WHEN** 选择同种子再挑战
- **THEN** 从轮 1、零金币/废料、三印记与初始升级开始，保留原 seed 而无其他资源继承
