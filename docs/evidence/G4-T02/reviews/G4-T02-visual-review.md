# G4 T02 两PC尺寸既有画面复核

结论：本组24张既有PNG未发现需要中断当前matrix01的关键视觉问题。1280×720和1920×1080下，所看提示、主行动和固定弹层footer均可读；没有发现按钮被纸单/回执盖住、文字横向溢出或主行动裁出视口。这个结论限于以下截图，不是matrix01执行结果，也不是真人趣味H。

只读取既有PNG及文件清单，未开浏览器、运行构建或修改源/测试/dist。当前matrix01/25268的冻结输入保持；唯一新增文件为本报告。

## 所看文件

下表每行都实际查看了同目录中`-1280.png`与`-1920.png`两张原图，共12组24张。所有均为Chromium DPR1对应的既有preflight画面；不将其冒称其他引擎或DPR2的人工复核。

| 批次与artifacts内目录 | 图片主名 |
| --- | --- |
| preflight-03 / v5-storage-v5-a-book-backu-73c77-older-recovery-confirmation-chromium-dpr1 | changed-backup-requires-review-book |
| preflight-03 / v5-storage-v5-a-run-backup-b67ba-older-recovery-confirmation-chromium-dpr1 | changed-backup-requires-review-run |
| preflight-02 / v5-interactions-v5-full-sl-962f3-one-trait-without-cash-cost-chromium-dpr1 | full-slot-real-replacement |
| preflight-02 / v5-interactions-v5-delayed-27ecf-s-spent-when-equipped-again-chromium-dpr1 | real-used-pardon-reacquired |
| preflight-02 / v5-events-v5-restored-boun-f7f0b-d-real-next-day-consequence-chromium-dpr1 | donation-event-offer |
| preflight-02 / v5-events-v5-restored-boun-3259c-d-real-next-day-consequence-chromium-dpr1 | rest-event-offer |
| preflight-02 / v5-events-v5-restored-boun-d54c2-d-real-next-day-consequence-chromium-dpr1 | credit-event-offer |
| preflight-02 / v5-events-v5-restored-boun-b5ffb-d-real-next-day-consequence-chromium-dpr1 | loan-event-offer |
| preflight-02 / v5-events-v5-restored-boun-4a2a5-d-real-next-day-consequence-chromium-dpr1 | salvage-event-offer |
| preflight-02 / v5-events-v5-restored-boun-2b69d-d-real-next-day-consequence-chromium-dpr1 | shelter-event-offer |
| preflight-02 / v5-branches-restored-legit-c7d88--pair-and-keeps-partial-pay-chromium-dpr1 | restored-twin-1-before-settlement |
| preflight-02 / v5-branches-restored-legit-c7d88--pair-and-keeps-partial-pay-chromium-dpr1 | restored-twin-1-chapter-summary |

目录共同前缀：`/Users/gordon/githome/sword-led/tmp/goal4-T02/runs/<批次>/artifacts/`。

## 画面判断与语义边界

**备份来源变化提示。** 两种尺寸都在保存详情顶部完整显示“备份已变化或暂不可读取。请核对现有来源后，再决定恢复”。炉谱界面同屏显示当前8件作品及时间；局档界面显示当前第8天、1097金币及时间。导出原文、重新读取、恢复现有备份和返回按钮均可见，旧确认弹层没有继续占据屏幕。PNG能够证明警示和新来源信息可读；拒绝过期恢复、没有静默采用新来源，仍应以实际命令/原始slot断言为准。

**满槽替换与用过的护印。** 替换后提示明确写出“已入行囊”和被换下的手艺，三件手艺实物及未领取首赠在底部保留，纸单、卖剑、落锤和收工均未被遮住。1280帧有短时转移飘字靠近摊位按钮上缘，字与控件仍可辨，没有盖住关键主行动；不据单帧推断点击命中情况。重新装备护炉契后，灰色实物下“本局已用”在两尺寸都完整，未表现为新的一次护印机会。画面只证明反馈表达，是否准确付出那柄剑、钱包不变和pardonUsed不重置以实际回放为准。

**六事件offer。** 道具、请求、后果和选择按钮均在屏内，1280没有操作藏在footer之后的情况。捐剑的两个候选有各自完整选择按钮；旧刃回收只列架上对象。借锤明确“明日第一柄新坯”和前三记普通锤正收益多10%，修棚明确明日第一新坯减3个百分点，赊护写明首裂保价而不恢复断剑，守炉说明没有额外得失。付60/80/90、获得160或付出一柄剑的区别在画面上能辨认。接受、拒绝与暂不决定不是同一个按钮；PNG不代替它们的实际不同命令证据。

捐剑和守炉的这些offer来自preflight-02原红case。它们在后续金额差断言中曾因`0/-0`消费者问题失败，这不影响offer截图的可读性证据；也不能因为图看起来正确就把那两个原红整case写成通过。修复后的执行身份须单独使用preflight-03记录。

**双驿1/2。** 工坊纸单一格收讫、一格待交，“已收一柄，还等另一柄”、已收酬劳125和余剑出售报价同时可读；人物手中显示已经交出的那一柄，不把当前铁砧余剑当第二份收据。章末两尺寸都明写“双驿尚未全部接通，不能把一柄剑算作两柄”“实际交付1/2”“第二章完成3/4”。画面是一亮一暗的两驿，未用全亮图掩盖失约。1280正文后续成长部分在滚动区域内，固定“去下一天/炉谱/导出”等行动仍完整可见；1920能同时容纳更多已装炉具内容。章标题“第二程，走完了”表示日程结束，正文明确不是主单全部完成，不误写成2/2或十二灯胜利。

## 非阻断的用词细节

事件正文仍有“金币”与工坊“铜钱”的叫法混用；旧刃回收的叙事叫“旧剑”，候选却精确标出“今日来料”。图中有清楚的数量、同一钱包和候选实际来料信息，未造成当前画面错误；后者也不能据叙事用词推断已经满足“此前来料”的委托资格。可在后续文字统一时处理，不建议因此修改正在跑矩阵的冻结产品。

## 不作的结论

本报告不宣布matrix01通过，不把既有preflight截图当六项目全覆盖，不以PNG证明SDK/slot/费用/次数正确，也不判断音频、帧率、真实操作跟手或玩家是否愿意再玩。H仍由真人当前体验决定。
