# 护炉远行 SDK

`dist/sword-led-v7.js` 是独立 ES module；规则为 `forge-v7`，不修改旧版 SDK 或钱包。

```js
import {createRun, applyCommand, getRunView, validateRun} from './sword-led-v7.js';
const created = createRun({runId: crypto.randomUUID(), seed: '山口灯火'});
if (created.ok) {
  const state = created.state;
  const result = applyCommand(state, {
    runId: state.runId,
    expectedRevision: state.revision,
    action: {type: 'depart'},
  });
  if (result.ok) console.log(getRunView(result.state), result.events);
}
```

`createRun`、`applyCommand`、`getRunView` 为纯规则边界。渲染层发送意图，不计算伤害、工具机会、奖励或结局。拒绝返回原状态与空事件；接受状态不可变、revision 加一、规范动作追加到 journal。锻造／剑架／交战／剧情／章初重整都通过同一命令入口。

`validateRun(JSON.parse(raw))` 从 seed 和 accepted journal 完整回放，再逐字段核对状态。导入者提供的 checkpoint、工具、灯芯、重整次数或失败历史不能成为额外真相。上限为500条已接受动作、200KiB状态；规则版本不匹配直接拒绝。

浏览器持久化使用 `createV7BrowserSession(window)`；非浏览器测试或宿主可组合 `createV7SaveRepository`、`createV7WriterLease`、`createV7Session`。会话保留 generation、单写租约、主备恢复、脏档重试与实际内存态导出。任何已存在的旅程，包括后日谈，新开都要求当前 generation 的确认；取消不改变进度。

存档键为 `sword-led.save.v7` 与 `sword-led.save.backup.v7`，写锁为 `sword-led.writer.v7`。封套 schemaVersion 为7，rulesVersion 为forge-v7。v5／v6使用原键与原解释器；无自动迁钱或清档。

画面可以短暂保留动作前场景以播放接触、磨损和转场，接受结果应立即交会话保存。动画不生成第二次命令，也不延迟主线事实。读取视图、打开旅程和取消确认不推进回合。
# 炉路交互修订的只读预测

`getRunView`新增`briefing`：整备/锻造时提供下一程目标、耐久、护甲、当前手中或在锻剑的直斩/架剑后伤害，以及已成立的特殊开路和工具用途。预测直接复用场次定义与伤害函数，不生成随机结果、不执行动作。

`TargetView.forecast`提供当前轮到公开轮限的压力数组，首项即本轮压力。已破除目标各项为0。两项都只存在于view，不进入schema7保存或journal；旧v7旅程不需迁移。

