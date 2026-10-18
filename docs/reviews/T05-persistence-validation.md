# T05 — 商人、升级与可靠存档验证

2026-10-18（Asia/Shanghai）。依据：已确认实施 v0.2、已选 B、T04 内核、E03–E05 / S01–S02 / S04。状态：实现与本轮验证完成；完整局平衡、游戏界面与最终玩家验收仍归后续任务。

## 实际交付

- 正式 buy 动作、四商品报价、等级/限购、双货币原子扣款、修补印记和购买记录；view 与执行共享规则，交易不加铁坯或抽样。
- Accepted 命令日志 journal 与 validateRun：从 seed/runId 回放正式内核，核对整个快照，不靠类型断言加载外部数据。
- schema v1 主档/备份、UTF-8 256 KiB 上限、版本/日期/日志校验、dirty、原样重试、显式覆盖/恢复。
- Web Locks 单写会话、独立工作副本基准、写前核对、窗口/缓存恢复、旧操作拒绝和明确的不写盘试玩。
- core/session 两个 ESM 入口与共享 chunk；无第三方运行时依赖。接口与接线见[合同](../persistence-and-merchant.md)。

## 最终复验

环境：Node 22.12.0、darwin/x64、Chrome for Testing 156.0.8078.4。浏览器使用隔离 context/profile，不接触用户正常浏览器数据。

| 检查 | 实际结果 |
| --- | --- |
| 干净安装 | `npm ci --registry=https://registry.npmjs.org/` 退出 0；安装 43 包、审计 44 包，0 vulnerabilities |
| 单次验证 | 干净安装后 `npm run check` 退出 0，7 文件 / **141 项测试通过**；strict 双配置和 Vite 构建通过 |
| 产物浏览器验证 | 对构建后的 SDK 执行 `npx playwright test`，**8 项通过** |
| 真正 BFCache | 独立 Chrome/CDP：pageshow.persisted=true、原 JS heap 标记保留、另一窗口新档被读取、旧代号被拒绝；[原始结果与构建 SHA256](../evidence/T05/native-bfcache.json) |
| dist 会话入口 | Node 导入两入口，执行新局/敲击/保存/解码/validateRun/销毁：revision=1、journal=1、saved=valid、锁已释放 |
| 隔离与清理 | 五个 devDependency 精确锁定、无 dependencies；内核无平台/墙钟/Math.random；无占位、DEBUG 标记或生产测试钩子；夹具服务器已停止 |

Playwright 1.64.1 仅为 devDependency，浏览器缓存不入仓库。官方 Next [导航说明](https://playwright.dev/docs/next/navigations#backforward-cache-bfcache)明确普通 Page 不支持 BFCache 恢复；本轮将普通历史导航与独立原生探测分开，未把重新加载当真实缓存恢复。

## 关键路径

### 商人与升级

新局 seed=`merchant-0` 经 **97 个正常 Accepted 命令**进入第三轮商人：784 金币、22 废料、2 印记，回放合法。四商品各自价格、同时扣费和不抽样均验证；全买后 164 金币/3 废料/3 印记、三工具各一级。离开后煤配给 2、精准区扩大、砧台风险降低。

继续实际命令到第六轮验证三种二级价格和两级封顶。任一货币不足、同访重复、满印记修补、错阶段、非法商品及失败终局购买均拒绝，无部分扣款。交易前缀不直接赋值钱包；单项不足/满级边界另用明确局部 fixture，不当合法存档证明。

持久化会话逐条执行该日志、买砧台与修补，再创建新会话读档，核对限购及“历史日终印记 2 / 当前修补后 3”，没有把真实修补误判为历史矛盾。

### 外部状态、写盘与恢复

回放验证覆盖伪造货币/煤/印记/材料/统计/历史/购买/随机位置、错版本/身份/种子、缺失或重复/非法日志、未知字段、unsafe number、getter/函数/symbol、循环/深度/大小。返回规范只读结果，输入不被修改或冻结。

真实浏览器在破碎后刷新，状态/废料/随机进度一致，下一击与未刷新的正式内核预测一致。真实填满 localStorage 触发 QuotaExceededError，规则动作只生效一次、旧主档保留、内存 dirty；释放空间后 retrySave 不加 revision/抽样，再刷新恢复同一结果。

主档损坏但备份合法时不自动回滚或删除；确认 false 保留原档，true 才恢复，好主档存在时拒绝旧备份覆盖。备份更新失败和主档保存失败分别报告；读权限、clock、格式等异常在 Adapter 单测中验证。

### 多窗口与生命周期

原生 Web Locks 验证唯一 writer、第二窗口 readonly；传 confirmed=true 也不能抢写。释放/交接后重新读档，旧窗口不会覆盖他人新进度。

一个窗口有未保存敲击、另一个窗口保存不同动作，即使两边 revision 同为 1，原生 storage 事件仍使第一窗口保留 dirty 并阻止重试覆盖，明确选读新档后才切换。能力缺失在真实浏览器中注入 navigator.locks 不可用，只有明确 memory 选择后可玩且始终不落盘。

原生 Chrome 探测另外证明旧 heap 真正恢复、重新取得/拒绝写权、读取最新档与拒绝旧 generation。测试页是 SDK 夹具，不是游戏 UI 或玩家完整局验收。

## 诊断、修复与预防

使用 diagnose 的复现 → 最小公共接口回归 → 修复 → 原场景复验循环：

| 问题 | 修复与证据 |
| --- | --- |
| dirty 窗口收到通知会采纳他人基准，之后可能覆盖新档 | 通知只标记更新，不采纳基准；单测与两个真实窗口事件验证 |
| BFCache 返回的排队通知取消激活，停在 inactive/旧 revision | 最小接口测试先失败；拆分 activationEpoch 与 generation；回归和真缓存恢复通过 |
| 激活过程中仍接受动作，之后读档丢掉未保存结果 | 入口回归先复现 accepted=true；恢复期间 active=false；全套复验通过 |
| 失败恢复读取污染基准，下一次激活误解除冲突 | 先复现合法新主档被错误授权覆盖；workingBase 绑定工作副本，写入显式核对；回归通过 |

临时空白对照页、框架内强开 BFCache 参数和 DEBUG 探针已删除。保留原生管道探测作为正式回归 seam，finally 关闭/清理 profile。预防原则：区分规则 runId/revision、旧输入 generation、激活 epoch；工作副本保留自己的写入基准。现有 Module seam 能验证整条链，不需要通用事件总线。

曾修正一项测试误把未购买的空 purchases 当损坏；现验证伪造购买和删除真实购买两方向。缺少 state.rulesVersion 也明确归为无效状态；未放宽正式校验来迎合测试。

[杠精审查] 通过：本轮入口有实现和异常出口，交易/保存/恢复/窗口链有实际证据，发现的竞态已修复复验；未把单测、SDK 夹具或推送算作完整游戏验收。

## 后续责任

T06：1000 种子多策略/锤法对照、可重放通关、数值平衡和 R2。T07：只沿 B 派生正式美术。T08–T11：真实页面、键鼠时机/反馈、音效/设置、恢复提示、完整局与视觉验收，进一步验证 Firefox/WebKit。T12：最大 review 与最终交付。

本轮原生证据来自当前 macOS/x64 Chrome，未扩张为全部浏览器或开发系统的认证。游戏首页仍未实现。实施与 B 选型均已确认，下一任务无新的确认门槛。
