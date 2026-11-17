# 锤下求生 · 护炉远行

带着小炉车与唯一灯芯走过三章九站，亲手锻剑，为同行的人开路，最后把自己的剑留在母灯。面向现代PC浏览器，D「行脚灯炉」手绘风格，左键锻造与回合道路行动。

**默认入口：[本机游玩](http://127.0.0.1:4179/)**，或显式打开 `/campaign.html`。标题应为“护炉远行”。包含跨关双剑、持续工具、救援与营地、真实选择后果、章初重整及三个结局。

本轮针对“玩法不完整、动效有缺陷”补齐备战用途、全部开路办法和动作因果：整备/锻造可比较下一程护甲与伤害；敌方预备、冲击、援手/格挡与灯损分别可见；开坯、收锻、换手和七种机关有各自回应。依据与边界见[本轮调研](docs/research/2026-10-24-v1-interaction-guidance.md)、[实际断链调查](docs/reviews/2026-10-24-v1-interaction-investigation.md)及[修订核对](docs/reviews/2026-10-24-v1-interaction-review.md)。

## ✦ V8 薪火铸魂 · 参赛升级版（默认入口 `/`）

针对赛事评审与深度游玩完成三大维度升级（详见 [V8 参赛重构说明](docs/v2.0-competition-overhaul.md)）：
1. **零遮挡三段式舞台交互**：顶栏九站灯路步进器 + 中央无遮挡动态粒子手绘舞台 + 底部统一铸铁指令席，消除悬浮块堆叠与盲扫悬停。
2. **九站因果灯链与母灯五步仪**：全程标注「即时得失 + 后关因果伏笔」，左下常驻母灯契合指示，终章展示五步复明仪并提供防卡死应急护板铁坯。
3. **观火音律神锻与破势易剑战棋**：新增三器型（长剑/重刀/阔刃）、金焰甜区停针暴击、三类淬火剑铭、红光蓄力【破势断招】、0行动【居合易剑】、伙伴主动协战、五声调式合成配乐、「⚡ 赛事评委演武跳关台」及五维 SVG 雷达宗师碑文结算。
- 免构建单文件试玩版：`public/playable-v8.html`；原版 v1.0 入口完整保留于 `/campaign.html`。

## 开始游玩

```bash
npm ci
npm run dev
```

使用 `.nvmrc` 的Node 22.12.0或package.json允许的版本，打开终端显示的地址。生产构建用 `npm run build`，再 `npm run preview`；部署时保留整个dist，包括独立SDK与共享chunk。

main 的追踪文件保持在 100 MB 以内；历史大体积证据与旧版设计原图见[备份分支及恢复方法](docs/repository-size.md)。

生产部署使用整个 `dist/`，支持任意静态托管子目录；离线试玩可直接打开 `public/playable-v8.html`。`npm run build` 会从同一份源码重新生成单文件版并内嵌图片，无需下载外部脚本。安全修复范围与复扫结果见[Web Zip 安全扫描报告](docs/security/web-zip-security-2026-11-18.md)。

| 操作 | 做什么 |
| --- | --- |
| 左键点剑身 | 普通落锤；前三记安全，之后公开首裂20%／再裂35%；每柄最多六记 |
| 定线／崩纹 | 点击用出一记有限手艺；定线稳，崩纹穿甲有爆发但每斩磨损2 |
| 点道路目标 | 用手中真实兵器斩击；悬停可看伤害、磨损与前置条件 |
| 架剑／结束本轮 | 每轮两行动；架剑挡3并使下一斩无视甲加2，主动结束才结算压力 |
| 剑架／工具 | 备用位可换手，交战中花1行动；追斩与续炉由实际工具提供 |
| 灯路／歇一歇 | 看完整旅程、后果、保存和设置；阅读不推进回合 |

每章补未用铁坯到3、手艺到1、灯火恢复3且上限8。两柄剑跨站保留，献出或打断的剑不会回架。每章一次重整回到补给后的章初，回滚本章资源与选择，留下失败经历。任何现有旅程另开前均可取消确认。

详见[完整游玩指南](docs/v1.0-play-guide.md)。

## 当前设计与实现

- [已批准的完整玩法合同](docs/v1.0-lantern-expedition-proposal.md)与[实施顺序](docs/v1.0-lantern-expedition-implementation.md)。
- [架构与模块](docs/v1.0-architecture.md)：纯规则、正式视图、持久会话、场景与DOM。
- [v7 SDK](docs/v7-sdk.md)：`createRun / applyCommand / getRunView / validateRun`，forge-v7/schema7独立保存。
- [美术原件、提示词与清单](design/d/v1-campaign/README.md)：内置image_gen生成，运行位图已实际绑定对象。
- [完整网页两路线与三结局](docs/reviews/2026-10-24-v1-complete-browser-routes.md)、[界面修缮](docs/reviews/2026-10-24-v1-ui-review-3.md)、[最终审查](docs/reviews/2026-10-24-v1-final-review.md)及[发布回执](docs/reviews/2026-10-24-v1-release.md)。
- [产品研究与指导](docs/research/2026-10-23-v6-rejection-guidance.md)：ForgeTax等产品的官方玩法与玩家反馈，回应旧版缺少完整主线的问题。

两条实际网页路线均完成九站并复明，另核对归途与败退。流程核对、实际玩家反馈和设计节奏目标均按证据记录；15～25分钟尚不是实测结论。

## 保留的旧版本

| 入口 | 内容与进度 |
| --- | --- |
| `/forge.html`、`/classic.html` | v0.8十二灯经营行旅，forge-v5/schema5，原存档继续 |
| `/v6.html` | v0.9雾松关试锋短段，forge-v6/schema6，原存档继续 |
| `/v4.html`、`/v3.html`、`/v2.html`、`/legacy.html` | 更早版本与原解释器 |

新主线不迁入旧钱包、工具或兵器。旧版设计、技术记录和用户负评在[历史README](README.pre-v1.md)保留；原始需求在[备份中的 goal-1/input.md](https://github.com/GOD-OF-PPT/sword-led/blob/backup/main-before-size-cleanup-20261117-203734/goal-1/input.md)保留。

## 有界工程检查

```bash
npm run typecheck
npx vitest run tests/core/v7-*.test.ts
npm run build
```

本轮优先游戏内容、交互与美术，执行31项必要规则/保存检查及单现代PC的完整网页路线。旧测试与矩阵保留，v5浏览器用例显式进入 `/forge.html`；历史规模检查不作为本轮重跑或趣味结论。
