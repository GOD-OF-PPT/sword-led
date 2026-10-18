# 真人试玩后的锻造游戏研究

日期：2026-10-18。结论：现版可玩性未通过真人评价，应重新做核心选择与成品反馈。技术检查不是这次反馈的反证。原文见[用户反馈](../../goal-1/feedback-2026-10-18.md)，建议见[v0.3提案](../v0.3-gameplay-proposal.md)。

## 方法与边界

先检索“铸剑传奇”，未找到可靠对应项；用户随后补充“steam名称铸剑大师”，最后明确给出 [ForgeTax / app 5245810](https://store.steampowered.com/app/5245810/ForgeTax/)，以该链接为准。没有将名称相似的手机移植、下载站或非官方wiki当作规则依据。

本轮读取七款游戏的Steam官方介绍，逐条阅读有限评论样本，实际查看ForgeTax、Bladesong和Potion Craft的官方页面/截图。没有购买、安装或亲自玩这些竞品，截图观察不能证明其运行行为。关于缺陷的评论是玩家当时的体验，不代表已经复现或今天仍存在。

按 [Steam当前匿名评论API](https://partner.steamgames.com/doc/webapi/IUserReviewsService) 查询：每款English热门好评/差评、近期好评/差评各3条，简中热门好评/差评各2条；仅Steam购买、首屏、热门不限日期，保留官方默认的离题/质量过滤。六款第一批95条均去重；ForgeTax补充16行去重15条，合计**111行、110条唯一评论、42次查询，0查询失败**。My Little Blacksmith Shop的简中差评桶只有1条，没有补其他语言凑数。

这是刻意寻找设计机会的分层便利样本，不能估计整体好评率、用户需求比例或市场规模。热门评论可能很旧；“好评”中也有大量批评，不能只读点赞标签。API的语言字段不保证正文实际用该语言。全文保留在忽略目录`tmp/research/2026-10-18-steam/`用于本机核对，不把第三方长评全文复制入仓库；[第一批查询/评论索引](evidence/2026-10-18/steam-sample.json)、[ForgeTax索引](evidence/2026-10-18/steam-sample-5245810.json)保留参数、时间、ID、原始响应/文本hash、推荐与游玩时长、原评回链。复采脚本见[scripts/research/steam-reviews.mjs](../../scripts/research/steam-reviews.mjs)；当前脚本拒绝覆盖既有证据，指定`node scripts/research/steam-reviews.mjs 5245810 tmp/new-forgetax-study`可生成新的独立快照，原始全文写入带时间戳的忽略目录。

## 一手玩法材料与可借鉴部分

| 对象 | 官方展示能支持的事实 | 本项目取舍（设计判断） |
| --- | --- | --- |
| [ForgeTax](https://store.steampowered.com/app/5245810/ForgeTax/?l=schinese) | 冒险锻打、短暂入神、用剑换遗物、遗物联动与贡品压力；官方画面以剑、当前收益和概率为焦点 | 学习“当下交差vs投入构筑”的机会成本；加入我们自己的锻造落点/性能/试剑，不复刻其巨龙、抽签票或第一人称空间 |
| [Bladesong](https://store.steampowered.com/app/2305640/Bladesong/) | 自由剑身塑形、模块化剑柄、顾客性能要求与叙事；官方截图展示成品库与形状操作 | 学习“我做出的剑能被识别”，避免做成复杂CAD或长篇文字作为主玩法 |
| [Anvil Saga](https://store.steampowered.com/app/1587540/Anvil_Saga/) | 铁匠铺经营与RPG/故事选择，派系关系、工坊扩建、员工 | 顾客回访和选择后果可用；本项目不加入工人寻路/开放城镇 |
| [Blacksmith Master](https://store.steampowered.com/app/2292800/Blacksmith_Master/) | 采矿到制造/销售的生产链与工坊成长 | 进阶要改变选择；不扩成大规模工厂模拟 |
| [Fantasy Blacksmith](https://store.steampowered.com/app/959520/) | 幻想锻造、组装与不同剑的制作 | 每种材料/成品有形态差异；不增加真实时间等待和搬运负担 |
| [My Little Blacksmith Shop](https://store.steampowered.com/app/980940/) | 工具/武器制作、资源与工坊、物理操作 | 保留“亲手制作”的直接感；不以易失控物理模拟承载订单结算 |
| [Potion Craft](https://store.steampowered.com/app/1210320/Potion_Craft/) | 材料操作、配方实验、地图路线、顾客用途；手稿美术把工具和玩法统一 | 借鉴“路线选择看得见”，但采用已选D的布篷/灯炉/金属语言，不复制炼金地图或整屏羊皮纸 |

ForgeTax的[10月11日官方开发进展](https://steamcommunity.com/app/5245810/allnews/)也直接讨论了构筑尚未成形就结束、成形后重复、遗物身份与成品用途。公告中的持剑战龙内容是**开发计划/原型展示**，不能写成当前已经推出的玩法。本项目只做短时试剑反馈，不能用这个公告许诺完整动作战斗。

## 具体评论与设计回应

以下均为短摘要，不是逐字引用。日期以API创建/更新字段为准；ID可在上述索引核对。没有采信评论中“低概率不应发生”“开发者已放弃”等未验证断言。

| 来源与当时标签 | 玩家实际关注点 | 转化为我们的可验证设计 |
| --- | --- | --- |
| ForgeTax [237025305](https://steamcommunity.com/profiles/76561198171342166/recommended/5245810/)，10月6日，好评，55分钟 | 喜欢聚焦的核心，但构筑信息埋得深、每把重复开局，超额武器缺用途 | 第1轮即解释流派；少量落锤形成差异；成品试剑与作品簿 |
| ForgeTax [237631418](https://steamcommunity.com/profiles/76561198300805671/recommended/5245810/)，10月13日，好评，115分钟 | 喜欢奇特剑型、入神和搭配；认为商店选择乏味 | 商人卖改变操作路线的技法，显示前后对照和关联锻纹 |
| ForgeTax [237609171](https://steamcommunity.com/profiles/76561198280311936/recommended/5245810/)，10月13日，差评，154分钟 | 认为做出高价剑的爽点被逐日重新归零的压力抵消 | 试验受限的超额贡献结转；结转有上限，保留后续轮的决策 |
| ForgeTax [237165600](https://steamcommunity.com/profiles/76561199108928289/recommended/5245810/)，10月7日，差评，7分钟；[237523920](https://steamcommunity.com/profiles/76561197991817650/recommended/5245810/)，10月12日更新，112分钟 | 低概率碎剑让人不信任系统/回溯 | 伤害改由公开应力阈值和操作质量决定，显示三个时机结果预览；这不能反推竞品的概率实现错误 |
| ForgeTax [236969921](https://steamcommunity.com/profiles/76561199112454838/recommended/5245810/)，10月5日，好评，265分钟 | 想要更有力的搭配、内容和后期用途；旧强化上限带来打断感 | 本项目允许余热内过锻，公开有限资源；不把无限膨胀数字当内容。其“上限30”早于10月6日官方上调，不能沿用为当前事实 |
| Bladesong [220656061](https://steamcommunity.com/profiles/76561198098344333/recommended/2305640/)，3月14日，差评，676分钟；[217177771](https://steamcommunity.com/profiles/76561198992273218/recommended/2305640/)，1月30日，好评，377分钟 | 成品离手就不再重要，超规格缺奖励；希望看到实际性能 | 锋/韧/衡驱动三个可重播试剑，超要求给有限奖励，保留真实成品快照 |
| Bladesong [237312963](https://steamcommunity.com/profiles/76561198056445690/recommended/2305640/)，10月9日，差评，2810分钟 | 经济逼迫玩家不断做最低成本达标品，创意成为额外负担 | 视觉由玩法自然生成，不另收装饰税；不给玩家必须刷几十把才能尝试构筑的门槛 |
| Anvil Saga [134513716](https://steamcommunity.com/profiles/76561198080709139/recommended/1587540/)，2023年11月22日更新，好评；[235437336](https://steamcommunity.com/profiles/76561198121611089/recommended/1587540/)，2026年9月17日，差评 | 前者赞赏派系/故事变化，后者反感流程卡住、存档改变选择 | 少量真实回访后果；所有订单与回访入日志且刷新等价，不引入复杂NPC调度 |
| Blacksmith Master [214498141](https://steamcommunity.com/profiles/76561197977094760/recommended/2292800/)，2025年12月29日，好评，1761分钟；[194993465](https://steamcommunity.com/profiles/76561197995104737/recommended/2292800/)，2025年5月16日，差评 | 一边认可成长，一边要求变化的约束、事件和真正取舍 | 三幕引入订单偏好/轮次事件，改变加工顺序和路线，不能只换材料颜色 |
| Fantasy Blacksmith [66566083](https://steamcommunity.com/profiles/76561198050616089/recommended/959520/)，2020年4月4日，好评；[49485319](https://steamcommunity.com/profiles/76561198122116710/recommended/959520/)，2019年3月21日更新，好评 | 喜欢剑型/魔法实验，但等待和模糊教学破坏节奏 | 无现实等待的煤炭回火，明确预览。旧评只用于发现通用风险，不断言当前仍如此 |
| My Little Blacksmith Shop [235757579](https://steamcommunity.com/profiles/76561198175834773/recommended/980940/)，9月21日，好评，2998分钟；[187779885](https://steamcommunity.com/profiles/76561198100952954/recommended/980940/)，2025年2月12日，差评 | 喜欢自己制作的物品有用途；担忧改版方向/宣传与实际不一致 | 保留原版可恢复路径；D仅为概念，必须由实际运行画面复核，不能拿图稿宣称实现 |
| Potion Craft [139702221](https://steamcommunity.com/profiles/76561198026663817/recommended/1210320/)，2023年6月7日，差评；[133640264](https://steamcommunity.com/profiles/76561198988622378/recommended/1210320/)，2023年2月26日，差评 | 初始实验有趣，后期材料处理成为大量重复手工 | 原型先测第1与第3轮是否有不同决策，记录实际锤数/取消/思考，不能靠长流程证明耐玩 |
| Potion Craft [128518150](https://steamcommunity.com/profiles/76561198153147148/recommended/1210320/)，2022年12月14日更新，好评 | 希望顾客需求、处理方式与后续故事相联 | 三类短订单与隔轮回访，收益/用途都来自同一真实剑性能 |

## 现版诊断（结合用户评价的设计推断）

1. 一次锤击主要改变累计进度/风险，落点没有空间含义；多数铁件的目标相同，三种锤法更接近速度/风险参数。
2. 十二轮主要提高配额，商人主要降低失败率或补资源，缺少能重新组织操作的流派组合。
3. 每件交货后只剩收入和账本，不知道剑为何而造、性能如何；现有24阶级图无法弥补用途缺失。
4. [现版1920画面](../evidence/T10/ui/workshop-1920.png)中工坊/大砧台占据注意力，铁坯小、底部操作密，视觉“在看工坊”强于“在做一把剑”。
5. v0.2中精准仍可能裂损，与概率正确与否是两件事；真人已反馈整体无趣，继续增加自动测试不会解决这个设计问题。

因此优先顺序是：**有意义的落锤选择 → 看得见的独特成品 → 成品用途/构筑回报 → 再扩大内容**。不优先新增挖矿、多人、开放世界、更多资源币或单纯延长局长。以上是待试玩验证的改版假设，并未证明改后已经好玩。
