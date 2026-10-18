# T08 — 正式入口、教学与工坊交互

2026-10-18。实施依据为已批准v0.2、B「行会手账」、forge-v1及T07运行素材。本轮已从SDK/设计预览推进到实际游戏入口；完整经营/日终/终局设计及整局R3仍由T09完成。

## 已实现的玩家行为

- 正式index.html与中文主菜单：新契约、继续、独立练习、操作设置、本机存档概要/时间、备份与不保存试玩入口。种子只作文本，替换进度有明确确认。
- B风格DOM/CSS/Canvas工坊：真实订单/缺口/印记/货币、三件来料、阶级/价值/完整度/热度/应力、三锤法、五区时机与三档风险。终结件可查看，不能再次加工。
- 鼠标与空格共用唯一attempt，所有者和runId/revision/会话generation/应用epoch/目标/锤法/周期一致才接受；松开事件时间判断落点，rAF只显示。重复按键、混合释放、切目标/换锤、失焦、取消、弹窗和暂停不偷扣资源。
- 正式命令先接受并尝试保存，再播放约450ms反馈。精准/普通/偏击与成功/裂损分别显示；暂停可跳过表现，已提交结果不回退。
- 三课独立教学可跳过/重看：时机、裂痕、交货/回收。临界样例由lesson-damage-0的8条真实命令准备（7击/3损伤/1次加热），不赋值完整度，不写正式档或推进其随机流。
- 为工坊提供真实退出路线：交货/回收/提前收工确认和基础日终/商人/终局路由均接内核，不放无作用按钮。三件详细复盘、经营/终局完整美术与全局验收仍留在T09；声音、设置保存、进一步异常/可访问性与性能仍留在T10–T11。

## 架构与资源

[应用会话](../../src/application/session.ts)只持有路线、选择、暂停和表现；正式状态唯一来自既有PersistentSession，教学独立。[timing](../../src/platform/timing.ts)与[输入](../../src/platform/input.ts)归一事件，[资产加载](../../src/presentation/assets.ts)校验图集，[场景](../../src/presentation/scene.ts)缓存静态底图和当前材质层；空闲没有持续绘制循环。Canvas DPR封顶2，反馈火星最多12条，不消耗业务随机流。

构建分为网页与SDK两步：先构建页面并复制public，再由vite.sdk.config.ts保留两个SDK入口/共享chunk。三个SDK文件与T06字节哈希完全相同，forge-v1、规则、价格和存档schema没有变更。[机器汇总](../evidence/T08/summary.json)记录所有生产文件、源文件及截图SHA256。

主入口JS为72,823字节，Node gzip统计26,298字节；页面CSS15,053字节、gzip4,028字节，另有428字节tokens。9张运行图片仍为2,652,400字节（2.53MiB）。这些是当前构建体积，不是硬件帧耗验收；p95/高刷新率/跨引擎仍在后续检查。

## 发现与修复

| ID | 问题与处理 | 证据 |
| --- | --- | --- |
| T08-01 | 应用层缓存active快照可能在异步重新激活中仍允许准备；激活开始即取消输入、读取PService即时快照并暂停，旧激活结果有身份检查 | 单测覆盖重读未完成前inputContext为空；不靠最终写入失败阻止界面假准备 |
| T08-02 | 从菜单继续时不能强行丢弃已接受的dirty副本；保留工作副本，显式重新载入才确认放弃 | 存储故障浏览器用真实UI接受一击，磁盘仍rev0、内存rev1；菜单往返保持，重试后磁盘rev1且只抽一次 |
| T08-03 | 最近读取报告不代表当前保存结果；显示以lastSave/dirty/conflict为准，成功重试清除旧失败提示 | 真实页面存档状态、重试后的主档完整回放；不保存模式始终明确标记，新契约按钮改为“另开试玩” |
| T08-04 | 弹窗中重排后取消可能留下禁用控件/错误焦点；关闭后先刷新控件再归还可聚焦触发点 | 测试确实改变到1920×1080并等待Canvas宽度变化，再取消；原铁件不变、控件恢复、焦点返回 |
| T08-05 | 长按Enter可能穿透新开的契约/引导；阻止弹窗内重复Enter默认提交 | 原生键盘重复keydown不能替换空档或跳过引导；Space只在击打区处理 |
| T08-06 | 旧反馈或异步dispose不能操作新界面；反馈id/epoch失效，dispose只同步删除自身shell并复用释放Promise | 单测/浏览器在反馈中新签契约、旧回调后新档仍rev0；已接受结果在暂停/刷新后保留 |
| T08-07 | 原生隐藏与Playwright Page焦点模拟不同；使用共享的无Page模拟Chrome管道测试窗口最小化/恢复 | 下述原生证据观察到真实blur/hidden，旧keyup确实到达且原始主档字节不变 |
| T08-08 | 低高度教学说明挤压风险区；压缩练习侧栏与重复帮助，保留全部数值/警示；产品文案改为固定练习示例 | 720高下完整度/热/应力/警示与主要操作可见，截图及IntersectionObserver断言通过 |
| T08-V01 | 一次检查误并行启动两个带构建的脚本，可能互相覆盖dist/报告，未采作最终证据 | 改为单次构建后串行UI/存储套件；outputDir分为ui/storage，提供test:browser；最终源版本复跑归档 |

严格类型检查曾发现测试导入未导出常量及未用类型，均修复，未关闭strict/noUnused选项。只在缓存生成时做热度着色，保留深色墨线，不修改PNG/WebP原图。

## 已运行的验证

| 层级 | 实际结果与记录 |
| --- | --- |
| 单测 | 11文件/175测试全部通过，含三角波/时钟/所有者/身份/取消、反馈锁、dirty继续、激活和教学隔离；[原始JSON](../evidence/T08/unit-report.json) |
| 页面浏览器 | 26项通过：原生与受控时机、重复/混合输入、取消、弹窗、慢速/系统减弱动效、刷新、新旧会话、只读窗口、存储故障、图片503重试、种子XSS、真实订单账本与两尺寸；[完整报告](../evidence/T08/ui-report.json) |
| 运行异常 | 每例自动审计pageerror/console.error/HTTP状态；正常路径无异常，图片故障测试只显式允许503并验证恢复；[审计](../evidence/T08/runtime-audits.json) |
| 存储SDK | 8项回归通过，覆盖原生Web Locks、真BFCache/缓存heap/最新档、真实配额耗尽、破碎刷新与dirty冲突；[报告](../evidence/T08/storage-report.json)、[原生BFCache](../evidence/T08/storage/native-bfcache-evidence.json) |
| 原生后台 | Chrome156原生窗口最小化，观察document.hidden=true与blur；恢复后的旧keyup到达，磁盘原文不变；新按住/释放后rev/strikes/draws均1；[记录](../evidence/T08/ui/native-window-input.json)、[截图](../evidence/T08/ui/native-window-input-screen.png) |
| 文字与尺寸 | 1280×720、1920×1080无横向溢出，关键控件与风险可见；覆盖文字最小12px、最低对比4.5785（含准备状态）；[文字数据](../evidence/T08/ui/workshop-readability.json) |
| 美术回归 | 9张生产图片alpha与原PNG差异0，24材料帧/288姿态原拼装回归通过；源素材未改；[回归记录](../evidence/T08/art-regression.json) |

原生Chrome测试是隔离的自动化浏览器输入，不代替真人试玩。受控测试使用Playwright Clock或测试侧DOM事件时间戳；生产没有强制成功、设置钱包/终局或测试时钟入口。Clock覆盖performance、Event.timeStamp及rAF的行为见[官方说明](https://playwright.dev/docs/clock)，并另有非受控原生输入验证。

截图：[主菜单](../evidence/T08/ui/main-menu.png)、[720工坊](../evidence/T08/ui/workshop-1280.png)、[1080工坊](../evidence/T08/ui/workshop-1920.png)、[临界精钢](../evidence/T08/ui/critical-steel.png)、[教学](../evidence/T08/ui/tutorial-crack.png)、[暂停](../evidence/T08/ui/paused-workshop.png)。临界精钢由critical-steel-0正常UI五次重锤偏击得到，进度9/热10/应力72/完整1，三风险37/43/55全部与正式视图一致，正余热仍允许最后一击。

## 本机预览与后续

当前[本机可玩预览](http://127.0.0.1:4179/)使用忽略目录tmp/previews/T08的已测试构建快照，避免后续构建过程影响此版本；[启动smoke](../evidence/T08/preview-smoke.json)核对HTTP200、菜单可见与首页hash。它只在当前机器服务存活时可用，未宣称互联网部署。其他机器按README安装、构建、运行。

T08的入口、独立教学、工坊操作/信息与输入生命周期已完成。T09仍须完成经营/三件复盘/终局的完整表现、真正UI一局胜利和失败及R3；T10仍须音效、设置持久化、完整焦点/异常恢复与性能品质；T11–T12仍须跨层/主观反馈与最终最大审查。没有据175/26/8为绿声称整个游戏或所有浏览器/真人可玩性完成。
