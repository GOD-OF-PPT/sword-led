## ADDED Requirements

### Requirement: S01 Versioned automatic saves and visible write failures

系统 SHALL 在每个 Accepted 动作后序列化完整规则状态到版本化主档，包含随机位置、限购和历史；主档成功后才显示已保存。写失败 SHALL 保留已接受的内存状态、标明未保存并允许重试，重试不得重新执行动作。

#### Scenario: Save after a broken piece
- **WHEN** 一击造成破碎且主档写入成功后刷新
- **THEN** 恢复 broken 状态及一次废料奖励，不能重新抽该击或重放奖励

#### Scenario: Storage rejects write
- **WHEN** 存储不可写或空间不足
- **THEN** 当前规则结果仍有效、显示 dirty，重试只保存最新状态，不再次敲击或扣款

### Requirement: S02 Validate and recover external save data

系统 SHALL 将外部 JSON 当作 unknown 校验：长度、schema/rules 版本、结构、有限整数/范围、材料/状态、历史/阶段和经济一致性。非法主档不得进入规则模块或被静默删除；主档问题 SHALL 有明确原因、备份恢复/新局出口，覆盖进行中存档须用户确认。

#### Scenario: Invalid save
- **WHEN** 遇到损坏 JSON、错误规则版本、负资源、非法终结状态或不相容历史
- **THEN** 不白屏、不自动重开、不直接类型断言加载；显示原因和可选恢复入口

#### Scenario: Cancel replacement
- **WHEN** 用户在有进行中存档时选择新局又取消确认
- **THEN** 原档和内存局不变，不消耗随机或重置资源

### Requirement: S03 Frame-independent timing and single strike attempt

系统 SHALL 用单调时间在松开事件时计算整数落点，使用与 rAF 显示相同的往复函数；单一 attempt 归一鼠标/空格，忽略按键自动重复和混合输入。取消准备 SHALL 不产生规则命令、随机变化或资源消耗。

#### Scenario: Refresh-rate-independent release
- **WHEN** 在不同渲染帧率下同一有效时刻释放
- **THEN** 获得相同整数落点/时机，不使用上一帧落点或帧数判定

#### Scenario: Cancel on blur or pause
- **WHEN** 蓄锤中失焦、hidden、pointercancel、Esc、暂停、切换目标/锤法或改变时机速度
- **THEN** 取消当前 attempt，随后旧 keyup/pointerup 不得落锤

### Requirement: S04 One writable browser session

系统 SHALL 使用同源独占 Web Lock 保证单个可写会话；第二窗口不得覆盖存档，必须可读提示与重试。bfcache 恢复或重新获取锁后 SHALL 重读主档，不用旧内存覆盖新局。锁/存储能力不可用时可以明确进入不写盘试玩，不宣称仍有存档保护。

#### Scenario: Second tab
- **WHEN** 同源窗口已经持有可写会话锁
- **THEN** 新窗口显示只读/等待重试，不抢占、不写入、不新开覆盖该局

#### Scenario: Reacquire after navigation
- **WHEN** 页面释放锁后从历史恢复
- **THEN** 先重新拿锁并校验主档，再允许修改，旧异步反馈不能落到新会话

### Requirement: S05 Lifecycle-safe input and feedback

系统 SHALL 只在对应工坊/阶段处理快捷键；确认/输入控件不穿透触发击打。逻辑变更先完成并尝试保存，再播放结果；暂停/销毁必须清理输入、rAF、订阅和音频，重复进入不得累积事件。

#### Scenario: Dialog keyboard isolation
- **WHEN** 交货/回收确认或种子输入获得焦点
- **THEN** Space/Enter 遵循当前控件，不误向工坊提交击打，Esc 关闭或取消当前交互

#### Scenario: Reload during feedback
- **WHEN** 动作接受并保存后在动画中刷新
- **THEN** 恢复已提交结果而非准备前状态，不靠动画回调再次修改资源

#### Scenario: Old session feedback arrives late
- **WHEN** 新开/恢复/销毁后上一会话的异步加载或动画回调到达
- **THEN** 旧 generation 的结果被忽略，不重绘、解锁、发声或修改当前局
