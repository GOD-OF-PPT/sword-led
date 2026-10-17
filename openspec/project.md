# 项目上下文：sword-led

## 目的

开发暂名《锤下求生》的现代 PC 网页单人锻造游戏。完整用户输入在 `goal-1/input.md`；规则在 `docs/game-design.md`；本项目当前是新建项目，不继承祖先目录中其他 Electron/Next.js 应用的技术栈。

## 拟采用技术栈

- TypeScript、Vite；DOM/CSS 界面和 Canvas 2D 工坊；无第三方运行时框架。
- Vitest 规则/存档测试；Playwright 浏览器验证；npm 精确版本与 package-lock。
- 内核纯函数，不依赖 DOM、时钟、Math.random 或存储；网页与模拟用同一正式 Interface。
- 存档在 localhost/HTTPS 下使用版本化 localStorage，Web Locks 控制同源单写窗口；异常有明确出口。

## 规格与实施流程

新增能力提案为 `add-forging-game`。用户确认实施文档之前不开始业务代码；用户选定三套主界面之一后才派生最终美术和完整界面。当前两项决定均未发生。准备提案、图稿和复核无需再次申请授权。

目标任务逐项执行，以 `goal-1/tasks.md` 为主进度；每三项做全面审查和修复。代码/文档变更有提交与推送证据；规则版本与存档变更要同步记录。全量输入、计划、任务在压缩后重新读取。

## 标准

面向现代桌面 Chrome/Edge、Firefox、Safari；目标视口 1280×720、1920×1080。文字中文、键鼠完整可用、减弱动效与慢速时机可选。隐私数据/密钥不进仓库，资产和来源可追踪，不把静态图或单测包装成整局验收。

具体约定与验收使用 `docs/architecture.md`、`docs/ui-design.md`、`docs/implementation-plan.md`、`docs/acceptance-matrix.md`。提案中重复出现的能力是可验证合同，不是另一套独立玩法规则。
