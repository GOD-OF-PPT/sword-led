# 3m 旧版通知复现

仅针对官方 `http://127.0.0.1:4179/` 的不可变 `T11-4-2-3k-formed` 版本；PID 32067 在运行前由实际 `ps` 核对。SDK 只从该快照导入，served SDK 与本地原件 SHA256 一致：`0525dd1f3642af2a1a54e397e6023cd9baf4dcccda4c5af3b9ed721a92ae89e5`。没有引用后来构建的 dist，没有修改 src/tests，没有操作用户页面、profile 或存档。

所有前缀都由正式 `witness-fixed/complete.json` 的原始 journal 经 `createRun` + `applyCommand` 重放得到，再以正式 repository 写入隔离 Chromium context 的合法存档。没有注入剑字段或改变随机。历史前缀恢复不算新整局。

| 病例 | 实际结果 | 证据 |
| --- | --- | --- |
| 满势→连锻耗尽（第3天，前缀38） | 未复现：连锻首次满足委托，新达标消息覆盖满势提示。此负结果保留。 | `charge-consumed.json`、before/after PNG |
| 达标→另选原坯→点击旧通知 | 已复现：标题仍是“这柄剑，已经合格了”，焦点到 `v4-deliver`，但文本是“卖给行会 · 40”，选中 d1-2。未激活卖剑，正式状态保持。 | `ready-to-other-sword.json`、before/after PNG |
| 合法断剑→busy期间点击换下一柄 | 已复现：真实 trusted 点击时 busy=true；已换到可锻的 d9-2，1400 ms 后仍 busy=true，交付禁用，再点剑身也不新增正式命令。没有宣称观察无限时间。 | `broken-next-busy.json`、immediate/after PNG |
| 满势→连锻耗尽（第4天，前缀55） | 已复现：实际 charge=0、下一次普通锤裂损率12%，通知仍说“下一次落锤是安全连锻，不会出现裂损”。 | `run-02/charge-consumed.json`、before/after PNG |

首批会话 48862 实际终态 exit 0（`process.json`、`stdout.log`），补例会话 60121 实际终态 exit 0（`run-02/process.json`、`followup-stdout.log`）。首批共4次已接受 UI 锤击，补例2次，共6次；还有一次被卡住界面拒绝的尝试锤击，不算接受。首批 result.json/stdout 的 scope 误写为5次，原字节保留，以本段和各病例 `acceptedActions` 为正确计数。首批脚本原件保留在 `repro-attempt01.mjs`；补例 CLI 初次将 flag 当输出目录，完整结果已原样移动到 `run-02`，修正后的脚本避免再次误解析。

两批均0页面异常。只运行一个 Chromium 进程／批、顺序隔离 context；不是兼容矩阵、模型、完整十二天新试玩或 v0.8 实施。所有 browser/context 均在脚本 finally 正常关闭。官方旧服务保持运行，未切换发布。
