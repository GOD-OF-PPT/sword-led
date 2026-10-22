# T01–T03联合技术复核与锻造菜单修缮

当前现代PC技术检查已取得分批证据；本轮定位并修复最后一个旧入口关闭缺口。T03的完成以实际提交、推送与发布回执为准，T04全目标审计与真实体验仍另列。没有更改已批准的玩法、计价、钱包、随机、存档合同或D美术，也没有扩手机／低版兼容范围。

## 原五项与产品交付

设计、内核、架构、UI及实施文档保留在`docs/game-design.md`、`implementation-plan.md`、`architecture.md`、`ui-design.md`和v0.8方案／操作指南。A/B/C三候选、先选B、后来选D及近景稿的实际顺序和派生资源保留，不改写选择历史。私有GitHub仓库已经创建并持续交付。

正式v5包含三章十二天、十二委托、三配方、六手艺、两次章末改造、商人／事件、三结局、炉谱和真实资格挑战；标题至开炉、落锤、交付／出售／回收、留剑、交易、事件、收工、结局、重开、暂停、恢复及原文导出均有接线。静态复核未见新占位或缺失出口。T01键盘十二天和T02两批384页面消费及独立回放保原版本身份，不能把流程可达说成经营平衡或真人乐趣已获认可。

用户已澄清“身价、酬劳和实收的显示关系让人困惑”。当前已发布的界面把作品估值、整单酬劳／已领、本柄酬劳＋品质加赏＝实收分别呈现，报价说明只读正式quote。付款04在两PC尺寸核普通10、委托120、day8分付158／127和说明零写，并修了宽屏币种换行。后续试听重试也已发布。具体反馈的修补不等于用户接受整体趣味性；后来可选再反馈未答不当通过，也不是新增审批门。

## 本轮原生菜单定位与最小修补

原v3完整输入用例的业务断言完成，root `Target.disposeBrowserContext` 却持续挂到runner关闭整个浏览器。恢复Clock的候选已实际失败并撤回。此前静态Clock／Audio四叶及本轮右键default／prevent两叶（59／52ms）、真实v3加载无Clock／有Clock两叶（86／53ms）均正常关闭；它们只是不足以复现，不是原完整用例已修。

`legacy-live-sample-01`保原用例／180秒预算／全部输入与断言。实际consumer exit1、421源／82产物结束一致；协议149在179.426秒后才回复。唯一自有Chrome主进程17272、版本156.0.8078.4，经精确binary、临时profile、启动身份及祖先链核对后，单次2秒OS sample实际exit0；采样开始与完成时consumer仍活跃、149尚未回复。主线程1244个统计样本共享`NSMenu _popUpContextMenu`→`NSContextMenuTrackingSession`→`NSMenuTrackingSession startRunningMenuEventLoop`嵌套循环，1238叶在mach_msg等待。这是本次关闭期间原生菜单仍在跟踪的直接定位；不是1244ms CPU，也不推断全部Chromium内部销毁机制或设备根因。

据此只在`bindDirectStrikeInput`已有两个落锤surface上增加同一个`contextmenu.preventDefault`回调，并在dispose配对移除。没有document全局拦截、额外按键／自动重试／关闭绕路；左键、Space、detail0、身份检查、音色和经济命令保持。原未改v3 case SHA仍为673b9e1fa67fb0fb09f17047f5106570ff4887ebbb1b9dec09ec73553511c01c。

| 实际新批次 | 结果与边界 |
| --- | --- |
| build23／harness14 | 严格类型及两个构建actual0；harness14确由当前源码重新编译，未覆盖原harness |
| menu-legacy-repair01 | 4/4，原v3三现代引擎DPR1完整左键／hold／drag／右键／doubleclick／busy Space及原context关闭通过；另当前Chromium旧v4两PC尺寸实际锤面几何通过，0skip/flaky |
| menu-v5-input01 | C/F/W DPR1三项3/3；两个真实trusted右键事件均在落锤目标取消默认菜单，raw零变，之后真实左拖只1Accepted；去掉旧Escape／resume掩盖步骤。设置上的合成事件仅核拦截范围，不冒充系统菜单 |
| menu-lifecycle01 | 当前harness14／Chromium DPR1一项通过；原20同realm mount、真实合法UI锤击、800＋500ms闲置和原pending／WAAPI门保持；每轮恰两目标菜单注册，dispose后包括旧detached目标的记录回baseline。这不是堆回收证明 |
| menu-published01 | 正式4179新82文件HTTP逐字全等；两真实右键零经济命令、三左键、绑定合格交付、手艺、报价说明零写与原文导出通过，0页面错误。root实际看1280／1920发布工坊原图 |

三修补批结束均423源／82产物全等，发布批505／82（另绑定82快照）全等；不同批次不拼成一次全矩阵。原失败、无效候选和各最小化结果保持自身身份。

## 当前门、历史81ms与证据边界

系统Chrome native04六项真实最小化／BFCache同堆／writer／旧输入通过；音频原15逻辑90次与正确完成轴八旧逻辑＋新重试共54/54、标题固定3/3保各自身份。原复合探针直到release才调用native，不能称透明晚完成；新探针原手势调用native、仅延迟结果，57份operation归属／SHA独立核对通过。旧137/138、clock0候选和软件波形不重写成完整最新138或物理扬声器证明。

非声音current02为21×6、125过1历史红；资源、可读性、生命周期、加载与其他响应已有原身份结果。near-limit1898→1900／2049保留旧UI负样本，golden02的4908边／25路／32检查点／174所有权核对保核心同值；replay-current01核5471合法state／1512保存／828capture，未遇2049或collection-export槽，不冒称由它新覆盖这些分支。冷页图片2,557,210B≤3MiB、当时JS gzip100,698B≤150KiB保原测量身份。受控60/120/144是调度证明，不是物理刷新率认证。

原预算保持：callback样本≥60、p95<16.7ms、max≥50ms须定位；短handler p95<50/max<100，长<100/<200；input→Accepted≤150、普通contact≤200、load≤3000；尾核800＋500ms无孤儿rAF／pending／运行scene动画／active声音。首锤和Continue冷成本未删，四连锻原无普通contact200门。

原81ms确在FF DPR2／1920／1890journal／pointer第4锤收尾回调区段，页面可见有焦点；原用例继续以失败保留。当时没有执行栈／CPU samples／可用LongTasks，单次函数、DOM写、GC、OS和协议的CPU细分无法事后恢复。预定一次profile02未重现81，但有效GeckoMain／CPU／JS／marker把本次30／31ms定位到watch→结束重投影及clientWidth同步布局；其p9517／接触228红保留，不当无profile基线。实际profile和安装版expect源码证实未满足busy matcher会采集ARIA／可见性／布局，据此校准为只读既有MO空闲标记和后置属性核对，raw RPC仍在。

校准后的原FF2／1920三输入各6Accepted通过原门，callback p95=8/7/6、max14/24/21、contact≤138、load上界874/628/626ms；同项目四连锻另通过。**有界调查已完成到证据可达边界：收尾区段与相关观察器干扰链有据，历史81自身函数CPU根因仍无法追溯；旧红不改，当前校准结果单独成立。** 不声称原81纯test-only／已修或提高50ms门；未来有效当前样本再触门仍须定位，不用盲跑假装重建过去的栈。

## 联合代码／安全／原件复核

联合审查覆盖C端流程／提示、保存来源确认、声音与图片所有权、缓存完整失效、listener／rAF／dispose、导出和依赖；未发现现行未修mustfix。原真实bug均保首红和最小修补：detail0、三附属画稿重试、BFCache暂停／过期选剑、字体纸墨、Continue启声、跨epoch声音归属、像素缓存及长journal事务分配。命令仍绑定run／revision／generation；外来文字走textContent，JSON有结构／大小／整数／深度和完整回放校验，本地下载及时revoke，无新凭据、依赖、远程API或生产测试hook。

保护核实际0：110旧源保持＋input/audio/forge三例外，6core＋game分配例外，8SDK＋v5SDK例外，85原美术及0316e071…保留ref。input从d73a…改为ffb58…，修改前完整原件及精确两阶段差分保留；没有声称113／7／9全部未变。当前harness14重新编译并实际20mount通过，旧harness及其试听单回调差分记录仍保原身份。

本轮发现旧v4消费者另把两尺寸JSON／PNG写到默认tmp别名；当前四份已立即另存本轮`v4-generated/`并记录生成来源，后续命令须显式设置新V4_EVIDENCE_ROOT。Git中T01同名四原件及更早T11原件／SHA仍完整，但覆盖前T03同名raw在限定证据范围无不可变副本／事前hash，不能用T01版本冒充恢复，也不能宣称这些旧tmp别名仍是旧字节。旧实际通过回执仍保留，此限制不由当前新图或新绿抹除。

[本轮无损归档](../evidence/G4-T03-final-technical/manifest.json)记录明确终态命令、完整原文／OS sample／原图、精确SHA及gzip往返；其余既有证据继续引用原档。当前试玩为不可变`G4-T03-forge-menu`、build23，旧快照仍可回退。源码与task完成的实际推送身份见后续发布回执；本技术结项不等于T04或整个goal完成。
