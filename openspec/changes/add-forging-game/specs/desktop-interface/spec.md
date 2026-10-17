## ADDED Requirements

### Requirement: U01 Complete desktop entry and continuation

系统 SHALL 提供中文主菜单、新局、继续、教学与设置入口，适配现代 PC 浏览器；继续展示合法存档概要，错误存档有恢复说明；新局覆盖需确认。菜单不是玩法交付的替代品。

#### Scenario: Start and continue
- **WHEN** 用户新建或继续一局
- **THEN** 分别进入初始轮或所保存阶段，且可正常操作全部后续流程

### Requirement: U02 Readable and truthful workshop interaction

系统 SHALL 同时呈现轮次/配额/印记、货币、三件状态、选中件进度/价值/完整度/热度/应力、锤法与风险、交货/回收/加热/结算。文本/按钮 SHALL 用可操作 DOM，场景用独立图层；所有数字来自正式规则视图。

#### Scenario: Risky selected piece
- **WHEN** 选中只剩一格完整度的精钢
- **THEN** 同时显示当前价值、下一阶目标与本次破碎风险，交货/回收结果明确且状态变化真实

#### Scenario: Target desktop sizes
- **WHEN** 在 1280×720 和 1920×1080 查看并操作
- **THEN** 无横向溢出，订单、风险、主要操作和三件托盘完整可达，不以静态截图冒充控件

### Requirement: U03 Full round, merchant and ending flows

系统 SHALL 实现交货/回收/提前收工确认、日终、商人、通关/失败总结和重开出口；所有界面连接正式内核。真实浏览器验收 SHALL 至少各走完一局胜利和失败，不通过注入终局状态冒充。

#### Scenario: End-to-end victory
- **WHEN** 玩家经正常输入完成十二轮并保有印记
- **THEN** 经历全部应有日终/商人阶段并进入真实胜利总结，可同种子/新种子再战

#### Scenario: Early failure and cancellation
- **WHEN** 印记耗尽，或在任意处置确认中取消
- **THEN** 前者进入可退出/重开的失败总结，后者不改变铁件和资源

### Requirement: U04 Isolated interactive tutorial

系统 SHALL 提供可跳过和重看的独立练习，明确说明精准、裂痕、交货与回收；练习不得消耗/奖励正式局资源或推进其随机数，脚本演示不得假装正式随机。

#### Scenario: Practice without modifying a run
- **WHEN** 从菜单打开教学并练习或跳过
- **THEN** 进行中正式存档与资源不变，能够返回菜单或正常开始正式第 1 轮

### Requirement: U05 Accessible control, settings and audio

系统 SHALL 提供键盘完整操作、可见焦点、弹窗焦点管理、非纯颜色状态、静音/音量、减弱动效与慢速游标；设置独立保存。音频必须从用户手势启用，不能阻断无声玩法；慢速不改变收益。

#### Scenario: Reduced-motion and keyboard run
- **WHEN** 用户启用减弱动效并用键盘操作
- **THEN** 关闭震屏/强闪烁且结果仍清楚，弹窗不漏焦点，主要流程可完成

#### Scenario: Muted or blocked audio
- **WHEN** 静音或浏览器拒绝启动音频
- **THEN** 正式玩法、视觉/文字反馈和设置入口仍可用，暂停/退出无残留持续声源

### Requirement: U06 Reviewed concepts and consistent derived assets

项目 SHALL 通过内置 imagegen 分别生成三套同数据的主界面候选，保存原图/提示词并逐图检查。只有用户选定后才能派生最终素材和完整风格；正式资产必须本地保存、来源/锚点/尺寸明确、所需透明图具有真实 alpha。

#### Scenario: Three concepts for selection
- **WHEN** 完成视觉选型材料
- **THEN** A/B/C 为三张独立工坊主界面实图、玩法信息相同而风格不同，有优缺点与用户选择记录，不预填已选

#### Scenario: Derived and loaded assets
- **WHEN** 选定图稿后完成运行资产及其界面
- **THEN** 背景/锤砧/铁件/裂损/商人/结算风格一致，文字与数字可编辑，加载失败有重试，不把整张概念图当游戏按钮层
