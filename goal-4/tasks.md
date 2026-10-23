# 剩余技术责任（承接原目标）

一次只执行一项；每三项全面review/debug；完成实际交付后记录，不以计划/报告冒充执行。

## T01 — 修复版本路由并建立当前v5纯键盘整局验证
- [x] 完成。旧v4测试明确旧入口、原用例不减；新v5配置/helper用真Tab/Enter/Space在Chromium DPR1走12天、重载/炉谱/earned challenge开局，逐命令正式SDK与存档一致、0 pointer；必要旧路由smoke。
- 实施：七份旧v4测试18处导航改为/v4.html，47原用例/断言保持；新增v5常驻配置/helper/键盘spec与npm命令；六项目明确DPR/两个视口。产品/core/存档/美术均未改。
- 实际终态：构建62597=0；发现74989/42972=0（6新项目/47旧case，仅发现）；旧30798=0（2项smoke）；新64095=0（Chromium DPR1一项，144 Accepted/148观察/90键盘click/0 pointer/error，12天12单/3印/2974钱/两改造/重载与12件炉谱全等）。挑战只真实资格新建opening/rev0/0钱/0journal，完整挑战待T02。
- 复核：6455正式SDK回放=0，151状态观察/149唯一、142炉谱观察/13唯一、148 raw全等；377源/80产物前后指纹一致，官方80字节产物不变。85原件、113旧源、7core-v5、9SDK及0316e07引用保持。看图两PC尺寸，实际DPR1；独立代理复核无本项必修问题。
- 交付：source 1b81434520d7254c565fb53c6feb7b16a33168d8；push73407实际exit0后fresh远程main一致，再通过GitHub API核4个blob全等，见docs/evidence/G4-T01/source-publication.json。试玩4179/PID45553保留原不可变快照，测试服务已退出。回执单独提交。
- [杠精审查] 通过：对本项真实入口/纯键盘链完成复核与修正，无未修T01缺口；未用配置/发现冒充六项目，未用挑战开局/AI通关冒充完整挑战/真人H或全目标完成。其余T02–T04保留，下一次只执行T02。完整审查见docs/reviews/G4-T01-keyboard-and-routing.md。

## T02 — 当前完整路径与六项目两尺寸矩阵
- [x] 完成。原47逻辑责任逐项对应到当前64逻辑；三引擎×两DPR、两PC尺寸、键鼠全结局/真实资格完整挑战、旧新路线/事件、焦点取消及组合保存/来源均取得实际终态。
- 实施：新增当前v5完整旅程、输入/事件/保存/尾项消费者；真实首红复现局档与炉谱“只改备份后旧确认仍可恢复”问题，app保存详情现读取物理来源、捕获原文并在确认前复读，变化/拒读只回到明确重看。核心、规则、SDK、存档版本与美术未改。
- 实际终态：build04/54379=0，尾严格类型02/7627=0；主matrix01/25268=0（56×6=336），尾matrix01/58277=0（8×6=48），0跳过/flaky/retry，两批共384次；每项目5条新整局，共18胜利/6归途/6失败，边界恢复另算。既有389输入与80运行文件在两批间不变，尾结束393/80指纹matches true。原失败与消费者修复原件全保留。
- 复核：独立主回放94375=0（4656保存观察/raw全等），尾回放4003=0（216/raw全等）；24张Chromium1预检图与另6张跨三引擎DPR2实图分开核。720高度成长说明定向真实滚轮03/68495=0，0→360后可读，经济状态不变；前两探针的内层视口误判原红保留。113旧源、7 core-v5、85原件、9 SDK与0316引用保持。全量默认diff检查保留原始error-context尾空格和冻结测试EOF空行；单列已创作代码范围检查0，不篡改原件求绿。
- 交付：source 04c794c7bb1901212d72f5f44c66db5edee885de；push64930实际0后fresh远程一致，publication64062实际0/7个GitHub blob全等。4179已换新不可变G4-T02快照，PID92661/session80923，80HTTP/SHA、实际3左键/绑定交货/赠礼/原文导出发布短消费43968=0。详见docs/reviews/G4-T02-current-flows.md及docs/evidence/G4-T02/run.json、source-publication.json。回执独立提交。
- [杠精审查] 通过：本任务原责任未缩水，无未处理的本项必修问题；保存真bug已修并六项目消费，测试误判与失败证据均保留。未把64逻辑当64局、两批当一次、合法恢复当前缀新整局、浏览器事件当原生或流程可达当平衡/真人乐趣。T03原生/声音/资源/性能与三task大复核、T04最终/H明确保留。下一轮只执行T03，原生goal继续active。

## T03 — 原生、声音、长档性能及三项全面复核
- [x] 完成。现代PC原生生命周期/BFCache、声音与画稿恢复、长档/调度/性能及T01–T03联合review/debug已有分批实际证据；原81ms交付有界调查和现行原门结果，历史未知限界保留。
- 实施中：T03首红已修detail0取消、附属画稿重试、BFCache暂停/过期选剑、字号/可读性、继续启声/跨epoch和待恢复发声归属；renderer唯一像素缓存已通过旧新合法边界Canvas对照。原110旧源保持＋3必要UI例外，85美术/ref保持。真实1900回放加载超3秒后，仅game.ts改历史不可变Action的事务分配；原6core/8SDK保持，game.ts/v5SDK明确必要例外，规则/计价/完整校验均保留。
- 历史检查点（见下方当前进度）：build13/harness11实际0；旧原生5＋1通过仍绑定旧构建。音频原138次126过12红已分类；build12有窗口Firefox23/23通过。原非声音180次153过27红，资源/输入/调度全过，3对比已修、24性能红保留；build12性能预检2过2红，所有JS预算通过，剩原生rAF调度空档及真实长档加载。新旧Canvas实际对照01通过。golden01在4898边/25路/31checkpoint/96ownership一致后因consumer误选首个buy而非fullslot中止，原红完整保留，修consumer后再核，不冒称完成。
- 用户H已真实澄清“身价、酬劳和实收的显示关系让人困惑”。报价UI已区分作品估值、整单酬劳/已领、本柄酬劳＋品质加赏＝实收；提供真实报价只读说明，未改规则或旧档。现在优先真实普通出售/委托/第8天双柄分付/留剑/钱袋用尽及两尺寸核对，不以技术绿测代替用户反馈。
- 本次产品进度：build16与付款UI04实际0，当前Chromium DPR1一个逻辑覆盖两PC尺寸；普通10、委托120、双剑158/127与各次钱包差额一致，说明原文/局/炉谱零变。root人工看六张最终图并修宽屏币种换行；golden02实际4908边／25路／32检查点／174所有权检查全等。已归档85文件／六张原图，压缩往返与输入字节核对通过；source ca4d85247a217722ab1fe98b7746756e21db7523已实际commit/push，fresh远程一致及9个GitHub blob相同；4179已换82文件不可变快照G4-T03-payment-clarity（PID79317/session89058），HTTP全等，实际3左键／绑定交付／赠礼／说明零写／原文导出通过。发布smoke首次仍断言旧术语“身价”的consumer红保留，02只改期望当前“估值”后通过；生产字节保持。本项不勾选。
- 本轮实际进度：当前1890长档定向2/2过（上界643–659ms），冷首屏图片2,557,210B／JS gzip100,698B达预算，系统Chrome六项通过。声音完整批02为137过1红；候选批03为133过5红，四项旧图断言与一项native时钟缺口分开；后续十次8过2红仍不稳定，全部产品实验/legacy适配已还原，build21的82产物与官方build16相同。证据与审查见docs/reviews/G4-T03-recovery-progress.md，声音问题后置且不冒记关闭。 本轮检查源与1324份无损证据已提交推送至487bb41eaf7a3f086cfdecd508e10814207dbae3，fresh远程及GitHub根tree一致、五个blob相同；诊断文件更新不改变试玩的82产物。
- 本轮实际终态：non-audio-current02有窗口21逻辑×6为125过／1红，0跳过／flaky，417源／82产物结束全等；资源／可读性／生命周期／加载与响应过原门，唯一红为FF DPR2、1920极长档pointer第4锤收尾81ms回调。页面可见有焦点，具体耗时未定位，原50ms调查门保留。legacy18为14过4红；最小late-arm消费者只把真实native故障定位到目标手势，不改0旧声／3新声门；typecheck20实际0，target03三引擎目标均过，v3 Chromium仍context teardown180秒红，整批3过1红。两个批次均实际终态／结束417/82全等，未改生产代码。
- 本轮联合复核：原五项内容与批准链、C端付款、源码／资源所有权、保存／安全／依赖有界审查完成，未发现新增占位出口或静态必修项；root又实际查看1280工坊与1920极长档图。当前82个dist／不可变快照／4179 HTTP原字节再次一致。总结见docs/reviews/G4-T03-current-progress.md；独立原文回放和本轮新增证据／发布回执执行后另记。按用户优先级本轮不再扩声音／性能／兼容候选循环。
- 独立回放：replay-current01实际0，对明确选定非声音current02／声音02／系统native04的原文做正式SDK核对；5471个合法state对象、1512次实际保存、828次capture及expected全等，373个不同state／21炉谱，9 SDK及所读输入前后hash不变。未遇2049负样本或collection-export槽，不冒称覆盖它们；原UI非零结果未改。此为留存原文验证，不增加新局或重跑矩阵。
- 新增进度归档：current-progress-archive01实际0，五项明确终态运行的1274份原文／诊断／所选截图已无损存入docs/evidence/G4-T03-current-progress，gzip往返及输入前后SHA一致；两张root实际查看的当前图及两张旧入口失败图保留，全部其他原件不删。未冒充全T03档案／验收。
- 本轮交付：source b8016dcf3239b7e74a9d8f8e0c060a9861bc8d30实际提交／push0，fresh远程main与GitHub根tree均一致，五个测试／报告／清单／压缩回放blob原字节全等；见docs/evidence/G4-T03-current-progress/source-publication.json。1274份payload均明确入Git；报价试玩仍是相同82字节产物，无需轮换。回执另提交，T03／goal仍未完成。
- [杠精审查] 本轮进度可交付，完整T03仍打回：原五项／费用反馈未缩水，测试未松门、没有新规则／占位／生产候选；报价已经实际发布。WebKit声音、FF2真实81ms与旧v3关闭余项未修，不以静态无新问题／有限回放／提交推送给T03[x]或goal complete。
- 2026-10-23定向交互修缮：实际发现同设置内第二次试听复用挂起pending，first-red01在Chromium1复现resumeCalls仍1，418/82结束全等。仅当前v5试听按钮增加已有silence()后原preview，明确点击替换旧试听所有权。build22实际0；repair01三个现代引擎DPR1九次全部通过，含新重试／连续试听／跨设置授权，原波形门与旧声不补播保持，四槽原文相同而非统计API写次数。共享audio/core/SDK/原美术没有再改，80个运行文件原字节相同，只换v5 main和index引用。
- 旧v3定向诊断：legacy-clock-cleanup01实际1，原body完成、显式clock.resume4.85ms完成后仍context teardown180秒；排除了“仅补await恢复Clock即可关闭”的具体候选，不能泛化根因。原消费者完整恢复，未奏效候选／原红保留，不重复跑。
- 新交付：4179切至不可变G4-T03-preview-retry快照（PID4973/session67793），旧快照保留；published01实际0，82个HTTP原字节全等，真实3左键／合格交剑／领手艺／报价说明／导出原文／两次普通试听与原文不变，0页错误。root实际看两PC尺寸设置图。preview-retry-archive01实际0，明确五项运行的78份原文／诊断／原图无损往返，见docs/reviews/G4-T03-preview-retry.md；本次源与证据推送结果随后记录。
- 计划内静音尾核：preview-retry-mute01另实际3/3通过（C/F/W DPR1），418/82结束全等；与九项是分开的实际批次。新增无损补档有明确run/end指纹，不把静音故障或原138完整范围缩减。构建/正式SDK/规则在两批间未变。
- 本次修缮交付：source 47e17f8dff5fe1ec3583e8aab2498c44839857d6实际提交／push0，fresh远程main及GitHub根tree一致，六个当前代码／用例／README／报告／清单blob原字节相同；93份进度payload全部入Git，source-publication.json保留身份。试玩为新build22快照，回执另提交；不因此关闭T03或原目标。
- [杠精修缮审查] 本次明确重试修缮通过：真实首红已复现并最小修，token/epoch/旧finally/新授权只读审查无阻断，九次实际与发布验证有据；未把DPR1/三项当完整138、软件波形当扬声器或API写次数。原defer实际延迟native调用的归因问题已识别，纯完成延迟草稿仍未激活，不用新语义重写旧137/138。
- 2026-10-23正确音频协议：已激活纯完成延迟探针（原手势调用native，release只交付原结果，保原拒绝/constructor暂停/全部门）。title01固定WK1三次3/3，fault-axis01九逻辑×六项目54/54实际通过，均418/82结束全等。独立57份operation/SHA复核无阻断，正确晚完成责任在该范围闭环；旧137/138及clock0候选保原复合注入身份，不冒称通过/物理声音。六份retry机制literal过时已外置勘误，未来文字纠正，没有为文字重跑。
- 本地真实性能采样：profiler01 selector NoTests原红保留，02才首个实际case，实际exit1/418/82一致。53MB原生profile含完整内容GeckoMain/CPU/JS栈，30/31ms有结束重投影与clientWidth同步布局栈；本次pointer p9517/接触228两红保留，原81未重现/未归因。仅本地解析/保存，无安装/上传；trace与原始json前后SHA不变。
- 观测校准：安装版expect源码与profile都见忙碌属性未满足时的可见性/ARIA工作；native完成等待改成读取既有MO空闲标记，guard last存在/Accepted/idleAt，原5秒/后置属性/全部contacts/原文/800+500ms/数值预算保持，raw采集RPC仍存在。calibrated-observation01原FF2/1920极长档实际通过，p958/7/6，max14/24/21，最慢接触138；calibrated-burst01原同项目四连锻实际通过，三合法恢复/3Accepted/12contacts/原样本门保持，两批418/82结束全等。typecheck21/22/23均0。当前校准结果不等于产品优化或旧81test-only归因。
- 关闭诊断：legacy-close-protocol01原case actual1，临时截图147已回复、root dispose149挂到约3分钟后browser.close才回复，418/82一致；OS sample在首个terminal守卫停止，未发采样。close-minimal01四个固定静态条件实际exit0，421/82一致，各context28–44ms关闭，均自有browser正常清理；没有游戏/SDK/存档/Locks，该组未复现原游戏，不冒称修复或设备根因。
- [杠精观测审查] 本轮正确音频协议与观测校准通过独立静态/实际核对，所有原门和失败保留；没有生产代码/SDK/美术delta，没有把profiler开销当基线、局部通过当全矩阵或原文不变当API写次数。root实际看当前FF2/1920长档工坊图，报价/风险/控件正常。详见docs/reviews/G4-T03-observation-calibration.md；新增无损档案和推送实际结果随后记录。
- 本轮无损归档：observation-calibration-archive01实际0，11个明确终态命令／330份原文、原生profile、诊断及原图，gzip往返和输入前后SHA一致；原件与历史失败均保留。不是完整T03档案或目标完成，源与回执推送后另记。
- 本轮校准交付：source 2fd17e10ec6e96b9280ae15e9878aec96a79ba4a实际提交／push0，fresh远程main与GitHub根tree一致，六个消费者／报告／清单／压缩采样摘录blob原字节一致；330份payload均入Git，见docs/evidence/G4-T03-observation-calibration/source-publication.json。当前82运行字节及正式试玩与build22相同；回执另提交，不提前勾选T03／goal。
- 前轮待完成（历史，以下最终结项更新其现状）：原81ms历史调查、旧v3 Chromium销毁问题与最终整体审计仍明确未闭；正确晚完成协议/当前校准长档及四连锻已取得实际终态，不误列未执行。可选新版金额/交互反馈已询问，尚未收到答复不当接受，也不阻塞独立技术工作。T03保持未勾选，原件/失败保留，测试与兼容最低优先级，不扩范围。


- 最终定位与修缮：legacy-live-sample01原用例actual1、421/82结束一致；唯一自有Chrome17272在dispose149未返时单次OS sample实际0，1244主线程统计样本明确处于NSMenu原生菜单跟踪嵌套循环。仅已有两落锤surface阻止contextmenu默认行为并dispose配对移除，input新SHA ffb58b…；原v3完整case字节未改，未加Escape/关闭绕路/时钟恢复或新规则。
- 最终实际：build23/harness14均0；menu-legacy-repair01原v3 C/F/W三项及旧v4 C两尺寸一项共4/4，menu-v5-input01真实两右键零命令＋左拖一次3/3，menu-lifecycle01当前harness14的原20mount1/1；三批423/82结束一致、0skip/flaky。正式4179切至不可变G4-T03-forge-menu（PID19044/session85963），menu-published01实际0/505/82一致，82HTTP全等、两右键/三左键/合格交付/手艺/报价零写/原文导出过，0页面错误；root实际看四张两PC当前及发布图。
- 有界调查与联合结论：原81ms的收尾区段及观察器布局干扰机制已有定位/原生profile/源码依据，历史单次CPU细分无法追溯，原红不改；当前校准普通及四连锻过原门，未来有效样本再到50ms仍需定位，不盲跑冒称复现。原18legacy及各现代责任按原身份＋差分对应，完整联合产品/代码/保存/安全审查mustfix=none。110旧源＋3UI例外、6core＋game例外、8SDK＋v5例外、85原图/ref全核。旧V4默认tmp别名前次T03raw不可追溯的限制已如实记录，T01/T11的Git原件仍完整，未拿不同运行冒充恢复。
- 最终交付：final-technical-archive01实际0，9终态命令/171无损payload/4张已看原图，前后SHA及gzip往返一致。代码fe14556763b16edfb02ae93b98364f953174bcd5和证据source b12f6341171d7fd3f0acf5d43a1e4047ed237ee2均实际提交后push0；fresh远程main/GitHub根tree一致、七个代码/报告/采样/harness代表blob原字节相同，171payload全在提交中。见docs/reviews/G4-T03-final-technical-review.md及docs/evidence/G4-T03-final-technical/source-publication.json；任务/回执另提交。
- [杠精最终审查] 通过：原完整关闭首红已直接定位并经未改原用例修复复验；无占位/删断言/松阈值/整批冒领/扬声器或物理Hz夸大。T01–T03三项大复核与修缮完成；有据限界、旧失败和可选反馈身份保留。本次只结束T03，T04最终最大审计/真实体验及原goal继续，用户低优先测试要求未被扩范围。

## T04 — 全目标最终审计与真实H闭环
- [x] 完成。原五项及获批v0.8/D开发、最大设计/产品/代码安全审查、已收到H问题修缮和源交付均有据。原实施/美术确认已满足；修后整体主观认可仍未知，不勾H接受，也不将后写的每版正面口令当原始批准要求。
- 当前H已实际答复：估值、酬劳和实收关系困惑。T03报价修缮已实际交付，T04真实再体验闭环未被填为接受；不把先前无答、当前问题已修或技术绿测当整体乐趣获认可。
- 实施：实际CUA首访/首章抓到steady已装备却误报首裂掉价，以及浮字/装箱/手艺/章末旧词；主风险按burst→cracked→steady或仍待用credit→普通后果显示，当前v5语义统一估值/铜钱。仅表示层，core/save/9SDK/85art/ref同基线；共享forge只可选ARIA标签，旧版默认不变。当前索引的旧/v2/仅首章/待接后段状态已纠正，冻结批准/历史原件未追改。
- 实际验证：build01/type02/03实0；risk-language01 C1单case，4正式合法恢复/6实际strike，首裂/steady/credit消费/二裂/安全连锻、float/ARIA/三只读面板原文过；legacy-label01 C1旧v4两尺寸锤面和默认词1/1，两批421/82结束一致。真实UI首章38Accepted/20strike/4单/1次180备料/1事件拒绝/留取2/余温架/3印379钱，实际导出正式逐命令回放全等；不是新十二天或真人试玩。IAB中途319裁切原图保留，最终1280PC收据另核，不冒称手机验收。
- 最大复核：原五项/确认顺序、284项图源hash/231文件、全部当前内容与已有T01–T03责任分层、C端风险回报和留卖换成长、保存/输入/资源/声音/导出/代码安全、依赖/凭据/来源均逐项核；真实风险与术语错误已修，独立最终审查无剩余mustfix。原要求“流程完整，可玩性高”逐字保留，以实际体验设计审查而非绿测支持；未取得总体主观正面评价明确未知。原AC41/OpenSpec没有每次修补后正面再答的强制门，自加口令的澄清有明确来源，不是未答默认认可。
- 发布与归档：4179新不可变G4-T04-workshop-copy-01，PID29157/session38280；published01实0/506/82结束一致、82HTTP/两右键/3左键/主单/首赠/新保护ARIA/quote零经济变/原文导出过，0页错。138无损payload和四原始input不变，SHA/gzip往返一致；新临时4250页/服务已关闭、viewport恢复。旧81与复合音频及tmp别名限制保历史，不改红为绿。
- 交付：source b4b8476ae126784524fda77ce9b7486da64c0330实际commit/push0，fresh远程main/GitHub根tree相同，九代表blob包括代码/用例/报告/真实导出/PC原图全部原字节一致，138payload全入Git，当前dist/快照/HTTP82全等；docs/evidence/G4-T04/source-publication.json记录实际身份。任务和完成回执另提交后再核最终远程；整个goal仅在该最后回执真实完成后调用complete。
- [杠精最终审查] 通过：完整游戏、文档、imagegen三选与派生、批准顺序、PC全流程和GitHub交付没有缩水；本轮真实问题均修、没有占位/删功能/松门/新规则/盲测、没有将AI/路线/推送冒充H接受。对当前规定范围交付无剩余有据必修项；不是所有未来设备/策略/审美均无问题的保证。T04开发/审查/交付责任完成，修后总体主观评价以未知保留，后续具体新反馈可另行迭代。


### 2026-10-23 后续真实试玩反馈

用户对“作品估值 → 整单酬劳／已领 → 本次实收”的关系明确答复：**“金额关系清楚了”**。金额清晰度这项已获真实确认，原问答逐字记录于`docs/decisions/2026-10-23-payment-clarity-feedback.json`。不扩大为整体玩法、重复感、美术或听感认可；本条无需产品改动，不重开已完成开发目标。
