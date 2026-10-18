# 工具链与官方依据核实

核实日期：2026-10-17（Asia/Shanghai），项目 T02。仅查询与编写方案，尚未在项目安装这些依赖。

## 本地与 npm 元数据

通过本机只读命令与 npm 官方 registry 包元数据核实。最初命令使用本机默认 `https://registry.yarnpkg.com/`；随后对下表每个包显式加 `--registry=https://registry.npmjs.org/` 再次复核，版本/engines 结果一致，未改动用户全局 registry 设置。

| 项目 | 当前核实结果 | 方案含义 |
| --- | --- | --- |
| 本机 Node | 22.12.0 | 满足本次 Vite/Vitest 所查询版本的 engines 下限；不宣称是最新安全补丁 |
| 本机 npm | 10.9.0 | 使用 npm 与单一 package-lock，实施时记录最终环境 |
| 全局 OpenSpec | 1.3.1 | 用于本次提案结构与 strict 验证 |
| vite | 8.3.4；Node `^20.19.0 || >=22.12.0` | 构建/开发 devDependency |
| typescript | 7.0.2；Node `>=16.20.0` | strict 类型检查 devDependency |
| vitest | 5.0.5；Node `^22.12.0 || ^24.0.0 || >=26.0.0`，Vite peer 包含 8.x | 规则/存档测试 devDependency |
| @playwright/test | 1.64.1；Node `>=20` | 真实浏览器测试 devDependency，浏览器二进制另装 |
| @types/node 22.x | 本次查询最新补丁 22.20.5 | 构建配置/测试脚本的 Node 类型；实施时精确锁定 |

这些是本次查询结果，不是未来永远有效的版本推荐。T04 安装前重新读取 engines 与可用补丁，记录最终选用版本并提交锁文件；变更版本须执行兼容性验证，不静默跟随 latest。生产运行时不包含这些测试工具，也没有框架、存储或音频运行依赖。

复核元数据的命令：`npm view vite version engines --json --registry=https://registry.npmjs.org/`、`npm view typescript version engines --json --registry=https://registry.npmjs.org/`、`npm view vitest version engines peerDependencies --json --registry=https://registry.npmjs.org/`、`npm view @playwright/test version engines --json --registry=https://registry.npmjs.org/`。类型包另用相同 registry 查询 `@types/node@22.20.5`。执行 shell 时遵循 RTK 前缀。

## 官方依据及对项目的影响

| 依据 | 已核实内容 | 对项目的决策 |
| --- | --- | --- |
| [Vite 入门](https://vite.dev/guide/) | Node 下限及 vanilla-ts 路径，dev/build/preview 用法 | 用 Vite 构建原生 TS 网页，实施再建立命令 |
| [Vite TypeScript](https://vite.dev/guide/features#typescript) | TS 转译本身不执行类型检查，支持独立 `tsc --noEmit` | typecheck 与 build 分开真实执行；isolatedModules |
| [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html) | strict 开启一组更严格检查 | 使用 strict，同时明确额外索引/可选属性检查 |
| [Vitest 入门](https://vitest.dev/guide/) | 当前工具要求与 `vitest run` 单次执行 | 纯内核与存档使用 Node 环境测试，不默认启动 watch |
| [Playwright 安装](https://playwright.dev/docs/intro) | 浏览器二进制需安装，官方列当前 Node/OS 要求 | 不以安装 npm 包等同浏览器可用；报告实际环境 |
| [Playwright 配置](https://playwright.dev/docs/test-configuration) | 可配置 webServer、多浏览器、截图/trace | 对生产预览跑实际键鼠与存储，保留诊断材料 |
| [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) | 存储按 origin/protocol 隔离，可被策略阻止，file URL 无可靠约定 | try/catch、明确失败、localhost/HTTPS 正式运行 |
| [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) | 帧率随屏幕变化，后台通常暂停，需按时间推进 | 用单调时间计算落点，取消后台准备，效果不影响规则 |
| [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) | 同 origin 可持有独占锁；安全上下文能力；可 ifAvailable 查询 | 单可写会话，第二窗口只读，不用本地时间戳假锁 |
| [MDN storage 事件](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) | 发生在其他共享存储文档，不发生在执行写入的本窗口 | 本窗口直接处理保存结果，跨窗口事件仅用于通知 |
| [MDN Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) | 自动播放限制与用户手势创建/恢复 context、用户控制 | 首次操作启用音效，静音/音量可控，失败不阻断玩法 |

架构使用这些能力是项目设计判断，并非来源已经验证本项目实现。浏览器兼容性、性能、存储异常、音频实际效果均要在相应任务运行后报告。

## T04 实际落地

使用 Node 22.12.0 / npm 10.9.0，实际锁定 Vite 8.3.4、TypeScript 7.0.2、Vitest 5.0.5、@types/node 22.20.5；Playwright 在后续真实界面验证时添加。本轮无运行时依赖。`npm ci --registry=https://registry.npmjs.org/` 和 `npm run check` 已执行通过，完整结果见 T04 报告。

内核先按 [Vite library mode](https://vite.dev/guide/build#library-mode) 构建独立 ESM，网页入口在 T08 添加。随机算法核对 [Tommy Ettinger 的原始 C 实现](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) 与 [FNV 文档](https://www.ietf.org/archive/id/draft-eastlake-fnv-25.html)；C 参考输出向量保存在 tests/fixtures，TypeScript 与其逐项对照。保留约定算法用于本地可重放，不宣称其为密码学随机或已证明整局概率平衡。

## T05 实际落地（2026-10-18）

新增精确 devDependency `@playwright/test` 1.64.1（npm 官方源核实 Node engines ≥20）；实际 Chromium/Chrome for Testing 为 156.0.8078.4。干净安装、141 单元测试、strict/构建与 8 浏览器集成均通过，见 [T05 报告](reviews/T05-persistence-validation.md)。Node 测试配置增加 DOM 类型以检查浏览器回调与能力 Interface，所有严格选项保留，纯 core 平台隔离另行检查。

Web Locks 的 [request/ifAvailable](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request) 和 [localStorage 异常](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)用于真实 Adapter。Playwright [官方 Next 导航说明](https://playwright.dev/docs/next/navigations#backforward-cache-bfcache)指出普通 Page 不支持 BFCache 恢复测试，因此原生回归以独立 Chrome/CDP 管道执行；实际缓存/heap/版本/构建 hash 在 JSON 证据中记录。该浏览器缓存不入仓库，没有修改用户全局 registry/代理或正常浏览器 profile。
