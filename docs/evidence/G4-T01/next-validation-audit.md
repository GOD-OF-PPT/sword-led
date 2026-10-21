# 当前 v5 下一阶段验证盘点（只读）

日期：2026-10-21。主目标工具已由主控确认 active；本代理先只读盘点，随后按代码前goal-4/T01方案和主控明确授权，只修七份旧v4测试的18处入口，详见末节。没有运行测试、构建、浏览器或提交。依据未执行T11.4.3草稿、当前tests/e2e与Playwright配置、v5实际归档消费者及其范围说明。没有读取大量PNG，也没有把旧报告改名作为当前通过。用户仍将交互/界面/玩法置于测试和兼容之前；以下顺序是在等待真人H期间补保留技术责任，不是再开一个阻挡产品反馈的大矩阵。

## 首要发现：旧配置不是 v5 回归入口（旧路由已在T01修正）

初读时，`playwright.v4-ui.config.ts`匹配`v4-*.spec.ts`，三个引擎默认1280×720，服务4198；但`tests/e2e/v4-helpers.ts.startV4`仍`page.goto('/')`。现在根页面实际是forge-v5，helper却读`sword-led.save.v4`并用core-v4/witness核对。因此不能直接运行这套配置后宣称“当前v5通过”，也不能只因元素仍叫`#v4-*`就认定它在运行旧版。后续T01已将这些旧版目标导航改为`/v4.html`，并未把它们转成v5测试。

具体例子：`v4-navigation.spec.ts`断言第一把原坯出售40、第二把累计80；现v5普通出售最多为身价四分之一，并共享日钱袋。`v4-compat-entry`还称“四个实际入口”且最后进`/`后`saveV4`，当前实际有五入口。`v4-final`/`v4-second`旧SDK、schema4、collection.v1、旧完整前缀同样不可直接换名字套v5。旧版自身应明确访问`/v4.html`，新版应独立helper、见证与配置；不是改旧规则来迁就断言。

`npm run test:e2e`和`test:browser`目前仍选上述旧v4配置；默认`playwright.config.ts`主要指向tests/browser SDK fixture。当前没有常驻的`playwright.v5-ui.config.ts`或`tests/e2e/v5-*.spec.ts`。旧v2/v3/通用cross/ui配置广泛匹配历史文件，不能用它们一键代替现版页面验收。这里是源码映射结论，未执行任何测试或`--list`，不预断实际红绿数量。

## 草稿原件现状

目录：`tmp/drafts/T11-4-3-v4-before-product-priority-20261021/`；manifest基线ef52f4c，明确每份“unexecuted draft; no browser/build/model result”。本次只读重新计算15份copy的SHA，全部匹配，原件完整。

| 草稿组 | 可复用基础 | 不能直接沿用的内容 |
| --- | --- | --- |
| release配置、v4-helpers | 单worker、无重试、主流程trace关闭；真实Tab/ShiftTab/Enter、键盘输入种子；显式继承context的DPR/viewport | 旧`/`路由、core-v4、save.v4/collection.v1、旧金额/轨迹。6个引擎×DPR项目及native只是未执行设计，不是现有结果。 |
| final/final-visual | 从真实标题走完→合法持久挑战；分开归途/失败；恢复终局仅当边界；实际作品/图/动作可见 | 旧210命令胜利和挑战脚本不可转为v5见证；已恢复终局不计新整局。 |
| resilience + critical-fault | pointer/Space/Enter单次所有权、busy/双击、暂停/换剑/换局取消；主档/炉谱/设置分层写失败；备份单槽变化与旧确认竞态 | 需重新绑定v5/schema2的真实raw与generation/preview票据；恢复/导入不能让客户端伪造数值或来源。 |
| accessibility | 两PC尺寸、44px目标、可见内容、真实背景可读性、已装备设施/手艺和故障并存 | 旧“four-sword rack”与v5总三槽冲突；不可恢复该旧形状或擅加第四柄来凑测试。当前摊位/装箱/空袋出口为新界面，需加入。 |
| art-retry/audio/probe | 缺图→正式重试、无重载丢进度；真实AudioContext波形、静音/音量/晚到resume取消；实际strike结果对应cue | 仍是未运行旧v4消费者；v5当前新道具/消息不能由旧结果代验。音频波形不是真人听感。 |
| native-v4与扩展native-chrome | 系统Google Chrome独立profile、实际最小化/恢复、trusted blur/visibility、BFCache nonce/persisted、只读/dirty/memory区分 | draft明确system executable/headless:false选项，而active `tests/support/native-chrome.mjs`默认bundled Chromium +headless。不能把active旧headless fixture说成现v5系统可见Chrome验收。 |
| release-probe近上限 | 合法Accepted reserve切换构造长journal、完整validate、合法收工出口；分离实际raw/故障观察 | 需用v5合法前缀重新生成，不能改旧snapshot版本或注revision。15草稿里有近1898 helper，但未见完成的v5性能/60/120/144测试批；不能以helper存在当已验证。 |

15份里有4个同路径active旧文件仍存在（final、final-visual、helpers、native-chrome），当前内容与保存的draft均不同；其余11个draft新增路径未在active树出现。不要覆盖原件恢复草稿，更不要把“保存副本”当作其已进入执行配置。未用静态`test(`计数冒充Playwright展开枚举。

## 当前 v5 已有基础，避免重复造轮子

- `docs/evidence/T11-4-2-3l5/ui/helpers.mjs`是真正v5 UI消费者：读save.v5/collection.v2，正式SDK validate+Node applyCommand逐接受动作全等；隔离Chromium、两PC截图/中心命中、只读DOM和raw观察。它已有实物签、摊内献剑、装箱和当前报价定位，是新helper最合适的起点。
- 同目录`play.mjs/windows.mjs/trade-final.mjs`分别对应三份明确构建；主142命令、六成长窗口27命令和最终献艺3命令有各自范围/红绿记录。主流程使用鼠标和seed.fill，零星Esc不等于“纯键盘全局”。新测试可复用动作执行与逐步对SDK，不能合并不同构建报告为最终一次全绿。
- 3l.4真实标题故事局142命令走完12/12，并从安全保存胜利实际开启挑战；README明确**没有运行挑战整局**。归途、前三天真实失败、旧首章summary续玩均已分开消费。当前并非完全缺乏整局/三结局证据；新责任在于现行冻结构建、键盘与未覆盖路径。
- `tests/core/v5-economy.test.ts`已定义分期/混路线、共钱袋、零出售、明确零回收、真实碎剑、三槽、等级3献艺、空袋委托和40首赠等有意义规则用例；`v5-persistence.test.ts`有真实来源集合、schema5重载、预览零写/来源票据、写失败重试、资格冻结及readonly/memory。未执行本次复跑；不把这些unit称为DOM/原生生命周期验证。
- 3l.2`browser.mjs`在真实localStorage/Web Locks下消费新SDK保存/显式导入/来源变化拒绝，实际5命令；页面在素材URL上直接调API，准确范围是**SDK浏览器**，不是游戏UI点击。
- T12-v5-delivery当前消费者已针对坏JSON、未知schema、只读第二页和主key读取拒绝，真实导出原文/取消恢复，三case四下载、0领域命令。可重用按key故障/原文精确比对模式；它不证明正常锻造写失败重试、实际备份恢复或完整键盘。
- `tests/e2e/keyboard.ts`的真实Tab导航与草稿`enterSeedV4`可抽出新版键盘基础；现active v4的`startV4(keys=true)`仍seed.fill，不能凭keys参数称所有输入均纯键盘。

## 准确剩余缺口与推进顺序

| 优先级/ID | 当前残余验证责任 | 最小但完整的实际消费者/停止条件 |
| --- | --- | --- |
| 先做 V01 | 建立当前v5可重复入口、源/构建/见证身份 | 新版独立配置/新SDK helper断言根data-rules-version=forge-v5，固定单一现代Chromium、worker1/retries0、独立空profile/context与测试端口，避开用户4179。使用同一个冻结完整构建；先核现有v5见证正式回放，旧fixture不转版本。 |
| 先做 V02 | **当前v5纯键盘完整故事→合法挑战整局** | 种子以Tab/键入，动作只用Tab/ShiftTab/Enter/Space，不用click/fill/程序focus冒充可达；监听pointer为0。正常故事到真实胜利、炉谱安全落盘、由实际按钮开challenge并走到真实结局。每Accepted正式全等/保存回放、重要日重载不补发。挑战需按实际章内重排准备合法v5路线，不搬旧v4挑战journal或注initialEligibility。现只有挑战开局证据，这一整局不能省略。 |
| 先做 V03 | 新界面关键动作与输入所有权/取消 | pointerdown只接受一锤，右键/拖移/长按/重复Enter/混Space不会新增；busy双击与旧keyup、暂停/Esc/设置/换剑/新局/失焦取消后需新输入。验证已接受锤取消表现仍保存。明确包括新摊内goods/献剑焦点、满槽替换、装箱固定footer、空钱袋安排、双剑部分交与绑定通知，不只测旧炉前按钮。 |
| 然后 V04 | 当前v5真实DOM保存/来源确认闭环 | 在合法前缀上单列run主/backup、collection主/backup、settings组合拒写，实际锤后保留Accepted内存与旧raw，重试/导出/明确memory可达；一项保存失败不假称另一项没成功。实际备份raw变化发生在确认后时旧确认拒绝或重新展示，旧主册/备份来源导入预览变化亦需明确重看；同context第二页只读/关闭owner后重取读取最新。保留T12已经覆盖的原文导出，不重复当新整局。 |
| 然后 V05 | 当前v5系统Chrome原生失焦/最小化和BFCache | 隔离可见系统Chrome；Space held时最小化取消旧keyup，pointer已接受后最小化不撤结果。clean/dirty/memory/stale-confirm返回要记录真实trusted事件、heap nonce、pageshow.persisted、独占锁和新raw，不把Page.setWebLifecycleState/SDK fixture缓存当生产页面原生。若实际不可缓存，应记录确切原因，不伪报通过。 |
| 后置 V06 | 新版设置/声音/缺图与长档性能保留责任 | 缺图经正式重试不丢局；静音/音量0/系统减弱/晚到resume/试听关闭和结果文本独立；用合法v5近软限journal验证交/回收/封炉/导出出口和恢复耗时。无trace测实际handler/rAF，60/120/144只可称受控调度等值，不能称物理高刷。按原已写门槛找具体问题，不事后放宽；仍是后置技术工作，不替代真人听感/乐趣。 |
| 最后 V07 | 原保留广矩阵与两尺寸可读性 | 原T11.4.3的现代Chromium/Firefox/WebKit×DPR1/2责任仍保留，但应在V01–V06现行行为稳定后明确实际枚举再执行。每个独立context继承并实读DPR/canvas像素，两PC尺寸覆盖新纸单/摊位/装箱/终局/恢复消息，关键控件不遮挡并实际看图。不能把单Chromium两尺寸称六项目，不把WebKit称真实Safari或Chromium称Edge。 |

这份排序不把已验证v5规则、三结局和鼠标整局清零，也不把原残余广矩阵暗中删除。V02不是重复无收益模型，而是目前真实缺少的玩家键盘和完整挑战路径；应先于音频大批、跨引擎/DPR和性能扩展。

## 复用时必须修正的具体差异

1. DOM前缀`v4`仍在v5中复用，版本身份须看装配/core/save/根dataset；禁止仅全局替换字母或沿用old raw。
2. v5三总槽；候选/挂架/取回不补新坯，旧草稿四槽及旧高额收入、旧市场无限回购不再成立。所有cash断言消费正式quote/cashOptions，不照抄40/80。
3. 商人不再四张等权长卡；需先点`[data-stall-good=upgrade|repair]`或`[data-stall-trait]`，献剑用`[data-stall-piece]`，最终确认锁pieceId。装箱候选`[data-carry-piece]`及固定`#v5-pack-confirm`，候选只读不改外部选择。
4. schema2炉谱作品带forge-v4/v5来源；原schema1旧解锁预览、明确确认、当前资格冻结/下局才生效是新增UI责任，不能旧codec解析新集合或自动把旧高分标v5。
5. 新成长feedback和event pending/credit消耗只对Accepted/实际trigger播；取消表现不能发钱或撤钱。重载只恢复事实，不补播成器或奖。
6. draft音频/缺图probe、native-global和case数据使用新窗口/新命名，避免混到旧回执。长流程关闭trace并流式保留原始状态；短故障才单列trace，避免重演磁盘不足后删原件。

## 报告边界

此盘点的可验证输出是15草稿哈希原件保持、当前配置/SDK/key/入口错位、可重用真实v5消费者和具体残余行为；没有新的测试通过数量，也没有断言某个残余行为已经有bug。下一步若实施，应先写同一goal task的方案/见证/范围，再只执行该任务；不把等待H变成无止境矩阵，也不让技术绿替真人“愿意继续玩”。

[杠精审查] 通过只读范围：没有偷删完整挑战/纯键盘/保存竞态等原责任，也没有把所有旧基线都说成无效；明确哪些只是SDK、恢复窗口、历史构建或未执行draft，优先真实玩家路径，兼容/性能仍后置。

## 代码前goal-4/T01授权后的旧v4路由修补

主控先创建goal-4/input.md、plan.md、tasks.md，并明确分配本代理只修`tests/e2e/v4-*.ts`入口。已全量读取这三个新文件后执行；未动产品、core/SDK、v5新测试、package/config、草稿原件或旧断言。

| 变更文件 | 导航数 | 保持原意的处理理由 |
| --- | ---: | --- |
| tests/e2e/v4-helpers.ts | 1 | startV4本来就读schema4/witness并发core-v4命令；必须从真实旧v4开始，reload自然留在该页。 |
| tests/e2e/v4-forge.spec.ts | 1 | 独立start测试旧v4自然锤/接触与原首章，不应误开v5。 |
| tests/e2e/v4-final-visual.spec.ts | 1 | 恢复的是合法旧v4终局和schema1炉谱，只能由旧解释器消费。 |
| tests/e2e/v4-final.spec.ts | 6 | 终局/readonly/holder/temporary/future/partial各page均验证旧v4的真实存档与资格，统一明确旧入口；保留原断言和全部分支。 |
| tests/e2e/v4-recovery.spec.ts | 4 | 同源v3-v4 lease交接、新外部v4保存页与memory缺锁出口均以v4为对象，改测试目标而不改资源/期望。 |
| tests/e2e/v4-second-saves.spec.ts | 4 | checkpoint及独立同源变档page都携带schema4，日期/修订/章末确认原语义保持。 |
| tests/e2e/v4-compat-entry.spec.ts | 1 | 原case四入口指legacy/v2/v3/v4，最后进v4并saveV4；保留“四入口”case名与旧三档不变断言，不把它冒充现行五入口兼容结果。 |

七文件共18个`.goto('/')`精确替换为`.goto('/v4.html')`。逐文件将当前全文与修改前全文做只读字符串核对：除了这18个路由字面量，所有字节保持；case名/声明/断言/参数化循环均未变，所以没有删case求绿。已对全部active v4-*.ts复查，未剩`.goto('/')`；未找到需另改的iframe/location隐式根入口。`/legacy.html`、`/v2.html`、`/v3.html`、素材URL、SDK、origin/baseURL、same-context关系和page.reload均保持。

没有执行旧47枚举或smoke，不预填其实际终态；完整47原责任由主控/独立映射审查实际列单，统一build后做必要旧路由smoke。当前v5独立helper与真实键盘整局由另一代理实施，不能由本路由修补代验。

[杠精审查] 通过本分工：只纠正验收对象，没有修改产品或旧金额断言、没有把旧case改名为v5、没有缩减原47或启动广矩阵。剩余运行核对由主控冻结后执行并记录。
