# T10 · 设置、音效、键盘与恢复验证

日期2026-10-18，规则forge-v1、契约schema v1。结果：188项单测、59页面、8存储、strict类型/双构建及美术回归通过。[功能合同](../settings-and-audio.md)定义设置与音效边界；T11–T12仍负责更广浏览器/真人评价及最大R4。

## 实际实现

- 独立设置键保存静音、0–100音量、慢速和减弱动效；首次空设置不写盘，坏/未来版本原串保留，写失败仍在本页生效并可重试。临时重读失败保留已知静音选择，跨窗事件不丢dirty偏好，设置与正式契约互不重写。
- 原生Web Audio短音效由新Accepted事件触发；读档/继续/重绘不重播。首次手势创建/恢复、音量平滑、静音/零音量/暂停/后台/菜单停止；最多4组/12振荡源，每个短时结束并disconnect。局/路线/generation与本地epoch守护晚到恢复和关闭的试听，构造/恢复拒绝均可无声继续。
- 菜单/教学/工坊/确认/商人/结算/终局/重开完整DOM键盘操作；焦点落在安全控件，反馈后可连续空格，主动Tab离开不被抢回，Ctrl/Cmd/Alt组合不被当作锤法/材料/蓄锤。
- 坏档/不兼容/读存储被拒/只读/写失败/备份未更新分别说明；备份确认有真实轮次/保存时间。可保留dirty当前局改为不保存续玩，不丢已接受结果，不重置随机，不覆盖磁盘。1280×720错误提示出现时仍能看风险和关键状态。

## 发现与闭环

| 项目 | 发现与修复 |
| --- | --- |
| Q10-01 连续键盘击打 | 原生disabled会使击打区失焦，第二次Space未提交，纯键盘用例只录得1击。增加局/修订/generation/epoch守护的反馈焦点恢复；Tab主动转移保留，旧局/暂停/配置取消不偷回焦点 |
| Q10-02 菜单和弹窗 | 设置原先聚焦“完成”，继续工坊未聚焦击打区；改为首个可用输入/安全按钮、阶段标题或击打区。只读教学返回可用继续按钮；设置重试按钮隐藏后移至完成/返回暂停 |
| Q10-03 教学慢速 | 教学初始慢速与已保存正式false不同，旧值比较会忽略明确取消；同值显式改动也更新当前教学及正式偏好。系统动效变化同步禁用状态与标签，不覆盖用户选择 |
| Q10-04 保存失败版式 | 720错误栏把破碎提示裁到0.341924可见，0.95断言失败；复用紧凑字段布局，保留≥12px、风险/应力/全部操作。原失败截图和样式hash保留，两个尺寸复验 |
| Q10-05 声音按钮 | 通用pressed浅背景与声音按钮浅字存在冲突，补深木色背景，并核查开/静音两态实际字号/对比 |
| Q10-06 异步音频 | 延迟原生resume、关闭试听、换契约、构造与恢复拒绝均走真实页面；旧Promise不得补播旧击打，失败不撤销规则或阻塞存档 |
| Q10-07 偏好与窗口 | 设置失败不能伪称已保存；dirty跨窗更新不覆盖本页，明确重试后另一清洁窗口同步。读失败不回到默认并意外丢掉已知静音 |
| Q10-08 测试事实 | 固定种子第二次精准仍有1%裂损，曾误断言必+3；改与正式applyCommand精确结果对照，未换幸运seed或改风险。原生AudioParam在调度前读value为440，探针改记录真实setValueAtTime参数，并另量波形；不把参数记录冒充频谱/听感 |

## 验证方式

机器材料位于`docs/evidence/T10`：188项单测及严格类型/双构建，最终页面/SDK报告、源/产物/附件hash、音频/键盘/性能数据与实际截图。只有全部终态passed且无skip/flaky时归档工具才接受。

[总索引](../evidence/T10/summary.json)、[unit](../evidence/T10/unit-report.json)、[页面](../evidence/T10/ui-report.json)、[存储](../evidence/T10/storage-report.json)、[运行时审计](../evidence/T10/runtime-audits.json)与[独立核对](../evidence/T10/verification.json)均已落盘。最终源、17构建文件、56附件hash一致；13份实际状态再次完整回放，17份核心/后台/lock源码与T09一致，3份SDK字节相同。Node22.12.0/macOS x64/Chrome156.0.8078.4；单测约4秒，页面约6.9分钟，存储约9秒。

实际信号：[原生波形](../evidence/T10/ui/native-audio-waveform.json)峰值0.0056689，[限流/清理](../evidence/T10/ui/audio-lifecycle-and-cap.json)最多12源、静音后0活跃且context suspended；[旧恢复](../evidence/T10/ui/late-resume-rejected.json)与[恢复被拒](../evidence/T10/ui/audio-resume-denied.json)分别留证。710条文字指标最低12px/对比4.57855；24原图/24prompt和原始input hash未变。

截图：[设置/键盘焦点](../evidence/T10/ui/keyboard-settings.png)、[720保存失败](../evidence/T10/ui/storage-failure-1280.png)、[1080保存失败](../evidence/T10/ui/storage-failure-1920.png)、[恢复备份](../evidence/T10/ui/backup-recovered.png)、[键盘通关](../evidence/T10/ui/keyboard-victory.png)。[纯键盘通关journal](../evidence/T10/ui/keyboard-complete-victory.json)为336动作/三次商人/0指针事件；[键盘失败及重开](../evidence/T10/ui/keyboard-only-flow.json)独立记录。为核查长表滚动，另续读这份实际通关记录执行End，[最后一轮和购买项均可见](../evidence/T10/restored-ledger-scroll.json)，该续读不冒充又一局通关。

纯键盘用例只使用Tab/Enter、数字/QWE与Space，从第一轮走完整336动作和三次商人到十二轮胜利；指针事件计数0，全部规则/RNG/账目与T06 witness一致，另有设置→锤击→交货/回收→暂停→第三轮失败→新开流程。允许受控Clock稳定等级，不注入资源或终局；原有混合输入完整胜负与四商品继续回归。

音频探针仅在测试中包装原生AudioContext与振荡源，读取真实Analyser波形，并核对源上限、stop和suspend。故障分别注入构造抛错、resume拒绝、第一次resume延迟；没有生产探针或作弊入口。暂停状态Analyser可能留最后一帧缓存，不以缓存为零判断静音，而以断开/停止/上下文状态验证；人类听感未冒充通过。

60/120/144Hz为测试侧rAF回调节奏，用相同350ms释放验证5000落点、同一正式收益/随机与空闲停止；这不是物理高刷认证。原生rAF用未安装Clock的真实浏览器，在两个目标尺寸各做3击并记录回调墙钟p95与空闲工作；指标只涵盖JS绘制/反馈回调，不是GPU/整机帧时长。

| 环境/尺寸 | JS回调p95 | 回调间隔中位数/95分位 | 解释 |
| --- | --- | --- | --- |
| 完整套件含trace，1280×720 | 1.2ms，154样本 | 16.7 / 16.7ms | 对应原始采集条件 |
| 完整套件含trace，1920×1080 | 3.4ms，97样本 | 33.3 / 33.4ms | 不能从低JS耗时推断60fps |
| 无trace同构建，1280×720 | 1.2ms，152样本 | 16.7 / 16.7ms | 空白页中位数也是16.7ms |
| 无trace同构建，1920×1080 | 1.5ms，150样本 | 16.7 / 16.7ms | 没复现33ms；不对采集/环境差异强行归因 |

完整套件数据在[native1280](../evidence/T10/ui/native-frame-budget-1280.json)/[native1920](../evidence/T10/ui/native-frame-budget-1920.json)，独立[无trace空白/游戏对照](../evidence/T10/untraced-frame-inspection.json)保留全部时间戳。间隔包括动作之间的间隙，未擅自归类为GPU/闲置；T11继续更广环境核验，不隐藏较差样本或改阈值。

```bash
npm test -- --reporter=default --reporter=json --outputFile=test-results/unit-report.json
npm run test:browser
node scripts/art/verify.mjs --out tmp/new-art-review
node scripts/collect-ui-evidence.mjs --stage T10 --out tmp/new-quality-evidence
```

T07原图/提示词与9张运行图不变，24材料帧/288姿态/alpha再次核对。无新增运行时依赖，核心/SDK与T09逐字节核对；正式输入新增修饰键取消，未改规则或随机算法。正常流程无pageerror/console.error/HTTP错误；原有图片重试用例故意503并单列记录。

保存失败版式的[原失败截图](../evidence/T10/debug/storage-failure-1280-before.png)和[红测/旧样式hash](../evidence/T10/debug/layout-red.json)保留；最终两尺寸可见性检查通过。npm audit为0漏洞、凭证/占位/生产探针扫描通过；文档链接/围栏和OpenSpec strict另行核对。预览快照`tmp/previews/T10`与17份产物一致，4179服务44431，实际HTTP200/首页hash/浏览器菜单通过，见[预览记录](../evidence/T10/preview-smoke.json)。旧50925服务先核实后关闭；不凭旧句柄假定后续仍活。

## 交付边界

本轮完成功能、相应品质与已测环境验证；T11继续跨引擎、整局矩阵和真人反馈如实记录，T12进行最大R4/来源/安全/最终远程审查。不能用音频图代替听感、模拟Hz代替物理显示器、短样本p95代替全部硬件。临时试玩使用独立已验证构建快照，具体句柄和HTTP核实在goal计划及预览记录；仅本机服务，未宣称互联网部署。
