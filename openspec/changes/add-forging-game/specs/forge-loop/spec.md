## ADDED Requirements

### Requirement: F01 Three deterministic workpieces per round

系统 SHALL 每轮提供恰好三件状态独立的铁坯，按游戏设计表初始化基础价值、完整度、热度和应力；第 1 轮固定熟铁/熟铁/精钢，后续固定熟铁/精钢并按 35%/45%/20% 抽取第三件。铁件不得跨轮保留或从商人增购。

#### Scenario: First round stock
- **WHEN** 创建一局
- **THEN** 恰好三件，材料为熟铁/熟铁/精钢，热度 100、应力 0，完整度分别为 4/4/3

#### Scenario: Later round stock
- **WHEN** 合法进入第 2–12 轮
- **THEN** 恰好生成三件新 id 的材料，煤按当轮配给重置，第三件抽样只推进一次 stock 随机流

### Requirement: F02 Skill-based strikes and progression

系统 SHALL 按轻/标准/重锤、整数时机落点和当前升级计算成功进度、热耗和时机分类，按累计进度阈值升阶；精准成功额外 +1，跨阶保留进度，35 封顶。所有规则结果 SHALL 由正式规则模块产生。

#### Scenario: Precise standard strike
- **WHEN** 可敲击铁件收到精准标准锤且随机判定成功
- **THEN** 进度 +3、热度扣 12 最低为 0、应力 +7 最高为 100，按阈值更新阶级

#### Scenario: Timing endpoints and invalid marks
- **WHEN** 落点距离中心恰好等于精准或普通半宽，或落点为非整数/越界
- **THEN** 合法端点归入较好时机，非法落点拒绝且状态/随机位置完全不变

#### Scenario: Maximum tier
- **WHEN** 进度达到 35
- **THEN** 禁止继续击打，仍允许交货或回收

### Requirement: F03 Transparent risk, heat and breakage

系统 SHALL 使用击打前的材料/阶级/热度/应力/砧台等级及本次锤法/时机计算裂损概率，遵循设计中的上取整和 0–85% 钳制；视图 SHALL 同时提供裂损概率与本次直接破碎概率。裂损扣一格完整度、额外 +6 应力，不增加进度；归零立即破碎。

#### Scenario: Risk preview agrees with execution
- **WHEN** 精钢阶级 3、标准锤、精准、热度 40、应力 47、砧台等级 1
- **THEN** 预览与执行均使用 14% 裂损概率；完整度为 1 时破碎概率也是 14%，大于 1 时本次破碎概率为 0

#### Scenario: Heating and zero-resource exits
- **WHEN** 热度为 0 或煤为 0，或尝试给满热铁件加热
- **THEN** 不能进行对应非法操作且不扣资源，但 active 铁件仍能交货/回收；合法加热只耗一煤、回满热、应力 +5，不修完整度/进度

#### Scenario: Last integrity breaks
- **WHEN** 完整度为 1 的铁件判定裂损
- **THEN** 状态成为 broken、完整度为 0、只产生一次 +1 废料与损失记录，不得继续加工或交货

### Requirement: F04 Value and irreversible disposal

系统 SHALL 使用整数倍率表得出交货价值；交货同时加等值金币和本轮交货值，主动回收只按材料与阶级加废料。交货/回收/破碎均 SHALL 为唯一不可逆终结，重复命令不能重复获利。

#### Scenario: Delivery versus recycling
- **WHEN** 阶级 3 的熟铁被交货，或相同状态铁件被主动回收
- **THEN** 交货得到 68 金币和 68 当轮交货值；回收得到 4 废料、0 金币、0 交货值

#### Scenario: Repeated disposal
- **WHEN** 对已 delivered/recycled/broken 件再次执行任何加工或处置
- **THEN** 拒绝且货币、随机数、revision 和状态不变

### Requirement: F05 Deterministic and immutable rule transitions

系统 SHALL 固定 seed 规范化、FNV-1a/Mulberry32 算法与 stock/strike 双流；同规则版本、种子与动作序列产生相同状态。每个合法击打只推进一次 strike 流；非法/重复/预览/取消不抽样。命令 SHALL 校验 runId 和 expectedRevision，并保持旧状态对象不变。

#### Scenario: Reload and replay
- **WHEN** 合法状态序列化并恢复，随后执行相同动作序列
- **THEN** 结果与不刷新时一致，后续来料不受之前击打次数改变

#### Scenario: Stale or foreign command
- **WHEN** runId 不符或 expectedRevision 过期
- **THEN** 返回拒绝结果，不产生新事件、不扣费、不推进随机数或 revision
