# v0.8 十二天真实 UI 消费记录

本目录只保存隔离 Chromium 试玩消费者和原始证据，不改产品、已有测试、goal 或 Git。以鼠标、标题种子输入、实际页面按钮/拖交进入经济命令；浏览器 evaluate 仅读取实际 localStorage 或 DOM/几何，不调用经济 port，不注钱，不按未来 RNG 结果改变路线。

## 两个不同构建批次

- `run-01`：消费 root 冻结构建 **20017 / main-BiACznLl**。session **89173 实际 exit 1**，45 条实际 UI 命令、46 次完整保存观察。第 5 天事件查看时，消费者误用不存在的 `#v4-event`；正式按钮为 `#v4-event-open`。这是消费者定位错误，页面错误为零。原失败图、failure、states、actions、capture 和执行前 producer `play-run-01.mjs` / `helpers-run-01.mjs` 全部保留。
- 仅将消费者的事件 ID 改为正式 ID，产品保持冻结。`run-02` 仍消费 **20017 / main-BiACznLl**，session **44373 实际 exit 0**。fresh 空 context 从真实标题新建故事局，按已经发布的 `docs/evidence/T11-4-2-3l1/journeys/victory.json.state.journal` 固定 **142 条**完整命令执行，不截首章。每次保存都经正式 `validateRun` 完整回放，并与 Node `applyCommand` 预期状态深度全等。
- 主批结束后，root 对末日留架/取回的三处文字作修正并完成新构建 **95804 / main-BCsDbsVf**。`branches-01-*` 只消费该新构建，session **28127 实际 exit 0**；主 142 命令没有重跑，不冒称主批消费最终文字构建。核心与九个 SDK 在两构建间保持字节不变，由 root 冻结记录核对。

## 主新局与明确单列的恢复分支

`run-02`：142 条真实 UI 命令、146 次保存观察、80 张两尺寸截图，0 页面错误。完成 12/12，3 契印，2974 铜钱，余温架＋风箱。第 8 天两剑酬劳为 125＋125，第 11 天先新后旧酬劳为 300＋300；消息与纸单只显示真实收件，作品保留第 10 天旧剑来源。胜利页面真实重载无新增奖励；查看 12 件 forge-v5 作品和旧剑接力作品后，由结局实际按钮合法新建行脚挑战：新 runId、revision0、coins0、opening，资格来自已持久炉谱。**没有运行挑战整局。**

三个后续分支分别使用独立 context，不计作另外三局新十二天：

1. `branches-01-old-first-chapter-resume`：原 `docs/evidence/T11-4-2-3l3/ui/run-02/states.json#real-reload-summary` 是旧首章真实 UI 保存，原 state/collection 经 SDK repository 编码后显式恢复。本轮 1 条真实 `advance` 到第五天，一旧两新、取回不补第四柄，章首查看/返回零经济；2 次保存观察、6 张截图。
2. `branches-01-day-twelve-return`：恢复主批实际保存 `run-02/states.json#a127-advance` 的原 raw，不合成钱包或兵器；本轮 1 条真实 `settle` 得到 11/12、2 印的灯下归途，重载全等。3 次保存观察、4 张截图。
3. `branches-01-fresh-three-misses`：空 context 从真实标题开始，固定 `v5-missed-days`；6 条 UI 命令使三个真实失约在第 3 天归零失败，重载全等。8 次保存观察、2 张截图。

## 画面与边界

每次 `capture` 在 1280×720、1920×1080 各存一张图，并记录纸单、回执、交剑、收工、事件、商人与场景/弹窗按钮的实际边界和中心命中对象；截图/resize前后正式状态全等。主批所有非弹窗工坊画面中，所有可见启用的交剑/收工/事件/商人按钮中心归属自身且未越出视口，几何汇总见 `geometry-summary.json`。人工查看了第 5 天旧新纸单1280、第 8 天双剑部分收件1280、第 9 天商人1920、第 11 天新剑先交1280、胜利1280、旧首章可继续1280、归途1920、失败1280，未见关键按钮遮挡。root 另核更多代表图及最终文案定向。

这是现有正式规则的流程/交互消费证据，不是兼容矩阵、胜率模型或真人趣味验收。全部红绿批次数量分别保留，不能把恢复前缀或重复保存表征计为更多新整局。
