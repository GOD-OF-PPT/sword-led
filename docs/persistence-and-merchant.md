# 商人、存档与持久化会话合同

T05 / 2026-10-18（Asia/Shanghai）。实施依据仍为用户已确认的 v0.2，主界面仍为 B「行会手账」。本文件解释已实现的后台接口；完整游戏页面与玩家提示在后续界面任务中接入。

## 商人交易

正式规则动作新增 `buy(productId)`；调用 `applyCommand` 时同样携带 runId 和 expectedRevision。报价、余额、限购、阶段和等级都由内核核对，调用方不能指定价格或直接改钱包。

| productId | 商品 | 第一级 | 第二级 | 效果/限制 |
| --- | --- | --- | --- | --- |
| handle | 配重锤柄 | 100 金币 +3 废料 | 180 +5 | 每级精准半宽 +200，最多两级 |
| bellows | 强化风箱 | 120 +4 | 220 +6 | 每级下轮煤配给 +1，当前余煤不增加，最多两级 |
| anvil | 稳固砧台 | 160 +6 | 260 +8 | 每级裂损风险 −3 个百分点，最多两级 |
| repair | 契约修补 | 240 +6 | 价格不变 | 印记恢复一枚、不超过三，每次来访一次 |

商人在存活的第 3/6/9 轮结算后出现。每种商品每次来访至多买一次，可买不同商品；不增加铁坯、不刷新库存。扣两种货币、生效、记账、记录购买和增加一次 revision 是同一个规则结果；失败保持旧对象/随机状态/货币不变。

`getRunView(state).merchant` 提供 active 和四份 offers，包含商品名、效果、当前/下一级、价格、availability 与禁用原因；永久升级满两级时 price 为 null，修补保留固定报价并按限购/印记禁用。`purchases` 给终局复盘使用。商人购买不抽随机数，也没有额外的隐藏轮次奖励。

## 存档格式与回放校验

主键 `sword-led.save.v1`，备份键 `sword-led.save.backup.v1`。Envelope 恰好包含 schemaVersion=1、rulesVersion=`forge-v1`、savedAt（UTC ISO 字符串）和 state。存储策略 getter、读取和写入均在可捕获异常的 Adapter 内访问。

RunState 新增只读 `journal: Action[]`，记录每个 Accepted 命令的规范动作。选择/锤法切换/暂停/动画不属于规则命令，不写入 journal；一次提前收工即使回收三件，也只记一个命令。journal 长度等于 revision。

外部状态由 `validateRun(unknown)` 校验并重建：

1. 限制为纯 JSON 数据、有限安全整数、深度/节点/字节上限；拒绝 getter、函数、symbol、循环、稀疏数组和异常原型，不执行输入 accessor。
2. 核对规则版本、runId、规范种子与命令日志。当前日志上限 2048；合法十二轮的热度、煤、三件机会和限购使可接受命令数量有界。
3. 从 seed 和 runId 新建初始局，按原始顺序通过同一个正式 applyCommand 回放日志；任何非法阶段、重复购买、错误目标/锤法/落点都拒绝。
4. 对比重建状态与输入状态的所有字段；货币、随机进度、购买、历史、印记、三件状态及未知字段均须一致。返回新的规范只读状态，不冻结调用方输入。

读取原始存档限制 **256 KiB UTF-8**，检查 envelope/schema/rules/timestamp 后才回放。savedAt 不参与规则计算；恢复不向界面重播回放过程中的奖励事件。正常刷新始终使用最新有效主档，不根据备份时间偷偷回滚。

这是合法状态一致性与正常操作恢复，不是服务端防篡改或竞技反作弊。T04 尚未发布浏览器存档；T05 是 schema v1 的首个实际存档实现，缺少 journal 的外部快照会明确拒绝，不静默补造历史。

## 已接受与已保存分别表示什么

`PersistentSession.dispatch` 的 ok=true 表示规则命令已经生效。其 persistence 仍可能为失败；此时快照 dirty=true，内存保留新状态、随机位置和唯一结果。页面必须显示尚未保存，不能据此自动重发同一击或购买。

`retrySave(generation)` 仅序列化当前工作副本；不再调用内核，不加 revision、不抽样、不重复奖惩。主档写成功才清 dirty。备份写失败但主档成功时 backupWarning=true，表示当前进度已保存、备份暂未更新。

主档成功写入前，上一份有效主档成为备份。异常/损坏的主档不会覆盖好备份。主档无效且备份合法时，`recoverBackup({confirmed:true,generation})` 才替换；主档仍合法时返回 main_available。恢复备份会回到那份快照的进度，页面须在确认中说明。

## 单写窗口与工作副本

原生 Web Lock 名称为 `sword-led.writer`。只使用 exclusive/ifAvailable，不抢占。当前可写会话持锁；第二窗口只读，重试激活时重新检查锁和主档。实现不使用时间戳租约、过期偷锁或随机等待。

写前在独占锁下核对当前原始主档与**该工作副本自己的基准**。读取缓存与工作副本基准分开；读取失败、恢复失败、其他窗口的 storage 事件都不能把未保存副本悄悄变成基于新档的副本。低层 SaveRepository 接受显式 SaveBase；会话始终传自己的基准。

storage 事件只提示存档已变化，不自动采纳写入基准，也不隐式丢弃 dirty 内存。冲突后可明确选择读取最新主档、恢复合法备份、新开或继续不写盘试玩；retrySave 本身不绕过冲突。Web Locks 保护遵循该协议的窗口，不能阻止任意本地脚本直接修改 localStorage。

## 会话生命周期与操作身份

| 情况 | 行为 |
| --- | --- |
| activate | 暂停规则操作、申请锁、重新读档；完成前 active=false，操作返回 not_active |
| pagehide / suspend | 立即停止接受操作、令旧操作身份失效并释放锁，保留工作副本 |
| pageshow.persisted | 重新激活、读最新档；不能用 BFCache 中的旧内存覆盖另一窗口的进度 |
| dirty 副本恢复 | 若主档仍是自身原基准则保留 dirty；基准变了则保留内存并阻止写入，等待明确选择 |
| dispose | 移除浏览器监听、释放锁、清理订阅；后续操作拒绝，晚到激活结果无效 |
| 缺锁能力 | 返回 unsupported；只有明确选择 useMemory 后才玩，始终不写盘 |

会话对外的 generation 用于旧输入/确认/回调失效；内部 activationEpoch 只表示激活流程身份。排队的存档通知可以令旧输入失效，但不能取消正在完成的重新激活。页面调用 dispatch 和确认操作时须传捕获的 generation，不能在异步回调中临时读取新代号来冒充原操作。

原生 BFCache 测试由独立 Chrome/CDP 探测完成：Playwright 的普通 Page 生命周期不支持该恢复路径（[官方说明](https://playwright.dev/docs/next/navigations#backforward-cache-bfcache)）。普通浏览器套件检查重新加载/存储/多窗口，原生探测另外要求 pageshow.persisted=true、旧 JS heap 标记保留、最新存档被采纳和旧代号被拒绝；不通过人工派发 pageshow 伪装真实缓存。

## 正式入口与页面接线

- 纯规则：`src/core/index.ts`，createRun / applyCommand / getRunView / validateRun。模拟器只用此入口，不写玩家存档。
- 浏览器会话：`src/persistence/index.ts` 的 createBrowserSession(window)，自动接 pagehide/pageshow/storage。
- 可替换 Adapter：createSaveRepository 和 createWriterLease，供测试或其他宿主使用。页面接线使用完整会话，不绕过锁直接写低层仓库。
- 页面订阅只读快照渲染；规则动作只通过 dispatch 送入，不能再根据领域事件手动加金币/废料。

浏览器模块示例（完整画面尚待后续任务）：

```js
import { createBrowserSession } from './dist/sword-led-session.js';

const game = createBrowserSession(window);
const stop = game.subscribe(s => console.log({ mode: s.mode, dirty: s.dirty, revision: s.state?.revision }));
const loaded = await game.activate();
if (loaded.mode === 'writer' && loaded.load?.main.status === 'empty') {
  game.startNewGame({ runId: crypto.randomUUID(), seed: 'forge-demo' },
    { generation: game.getSnapshot().generation, confirmed: false });
}
const snapshot = game.getSnapshot();
if (snapshot.mode === 'writer' && snapshot.state) {
  game.dispatch({ runId: snapshot.state.runId, expectedRevision: snapshot.state.revision,
    action: { type: 'strike', pieceId: snapshot.state.pieces[0].id, mode: 'standard', timingMark: 5000 } }, snapshot.generation);
}
// 页面卸载/路由销毁时执行这两步；普通暂停不销毁会话。
stop();
await game.dispose();
```

覆盖/恢复确认由页面向玩家呈现具体损失后交回 confirmed=true；取消不改规则状态或存档。界面使用 current state 和 lastSave/dirty/conflict 判断当前进度；load 是最近一次读取报告，不代表之后每次动作的当前状态。错误代码与 journal/原始主档只用于内部诊断，玩家看到清楚的中文说明。

## 复跑验证

```bash
npm ci --registry=https://registry.npmjs.org/
npx playwright install chromium
npm run check
npm run test:storage:browser
```

浏览器脚本先构建，再在隔离的测试 origin/profile 中验证产物。两个 ESM 入口共享 dist 中的公共 chunk，应整体保留 dist，不能只复制一个入口文件。测试页和原生探测均在 tests/browser，不进入运行产物，也不是游戏页面。

实际结果及边界见 [T05 验证报告](reviews/T05-persistence-validation.md)。数值策略平衡、完整网页、音效/可访问性和所有游戏页面的用户验收仍由 T06–T12 完成。
