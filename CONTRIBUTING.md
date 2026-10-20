# 开发与验证约定

默认`/`为已批准v0.7的生产第一章（forge-v4/schema4）；`/v3.html`保留旧炉前契约，`/v2.html`为旧D细锻，`/legacy.html`为B版。新旧独立key、同一个writer锁；不得用新解释器改写旧journal或自动转换旧档。见[首章界面](docs/v0.7-first-chapter-interface.md)、[核心](docs/v0.7-core-contract.md)和[保存合同](docs/v0.7-persistence-contract.md)。按[goal任务](goal-1/tasks.md)一次执行一项，后八天和最终验收仍在后续任务。

安装使用`npm ci --registry=https://registry.npmjs.org/`，版本来自package-lock；不随手更新依赖，当前无运行时第三方依赖。`npm run dev`用于开发，生产检查运行`npm run check`。单元/严格类型/构建通过只证明相应工程条件，真人乐趣单独记录。

浏览器验证按顺序运行，避免多个构建同时改dist：

```sh
npx playwright install chromium firefox webkit
npm run check
npm run test:browser
npm run test:cross
npm run test:art
```

当前`test:browser`构建一次后串行运行`playwright.v4-ui.config.ts`与`playwright.v4-storage.config.ts`；当前首章UI也可在已有构建上独立运行。首章实际45项与最后重复键6项的不同构建边界见[验证报告](docs/reviews/T11-4-2-3i3-first-chapter.md)，不要将48条逻辑覆盖说成一批48全绿。旧v3配置使用显式v3.html入口。

页面测试默认单worker/retries0，真实存储SDK与原生Chrome探测另记；不要通过重试隐藏失败。旧`playwright.cross.config.ts`是五项目定向配置，排除直接启动原生Chrome的规格；其DPR2项目只覆盖部分渲染/控件场景。旧D细锻完整配置为`playwright.v2.config.ts`：先构建一次，再运行`npx playwright test --config playwright.v2.config.ts`，六引擎/DPR项目各35项完整规格和一个原生Chrome项目两项，共212项。旧定向配置不能代替完整新版结果。各引擎版本与DPR要从实际运行环境获取，不能把引擎结果写成所有Safari/Edge/显卡均通过。

保持真实DOM输入和正式命令，不注入钱包、终局或幸运结果冒充可达玩法。核心边界fixture可以用于边界单测，证据须注明。键盘测试应遵守浏览器允许Tab移到工具栏的行为，不要求产品拦截全局Tab；用原生反向导航检验明确的页面内选择。音频图形/波形不代替真人听感；原生rAF的JS耗时不代替GPU/物理高刷认证。计时规格关闭trace采集，其余功能规格保留失败trace。

保留有意义的红测、原因和修复，证据说明代码/构建身份、测试过滤条件和实际结果。归档评论时仅提交索引/有限摘要与来源，不复制长评全文或把旧评论当今日已验证缺陷；[采集脚本](scripts/research/steam-reviews.mjs)拒绝覆盖既有证据，复采指定新的输出目录。

v2核心开发可先执行`npm run verify:v2 -- --seeds 1 --out tmp/v2-new-smoke`，T11.2阶段记录为29组合×32种子；后续原1000规模见旧v2模型审计，不替代当前v4平衡。结果只代表定义的策略与合成输入误差；数值/核心逻辑变化后重新验证，不能拿旧规则数据证明新版。归档当前单测/UI/新SDK报告可用`node scripts/collect-ui-evidence.mjs --stage T11.3 --out <新的目录>`；跨引擎v2子集使用独立collector，输出目录不覆盖。不要在页面测试运行中重新构建同一个dist。D素材原图/提示词/编码合同见[美术维护](design/d/README.md)，`scripts/art/prepare-d.py`仅做格式导出与alpha/hash验证。

新版完整报告用`node scripts/collect-v2-cross.mjs --report test-results/v2-release-report.json --out <新目录> --expected 212 --projects 7 --purpose <本次范围>`归档；会拒绝跳过、重试、失败或不匹配的数量，并用当前构建SDK回放附件状态、记录源/产物指纹。原始失败报告另存诊断目录，不伪装成绿报告。高DPR截图可在测试全部结束后用可选维护脚本`scripts/encode-browser-evidence.py --report <原报告> --out <新临时目录>`无损换容器，需要Pillow/cwebp，不是游戏或测试运行依赖。它逐图验证完整解码RGBA/尺寸及ICC/Exif，保留原PNG和原始报告于忽略临时目录、记录原/归档hash；再将生成的report.json交给collector。压缩不裁切/重画，原图稿PNG仍原样提交。不要在原生性能测试同时编码截图。

新批次应在构建后、测试前保存输入快照，避免归档时才拍下另一套源码/产物：

```sh
mkdir -p tmp
npm run build
node scripts/release-fingerprint.mjs capture tmp/release-start.json
npx playwright test --config playwright.v2.config.ts
node scripts/collect-v2-cross.mjs --report test-results/v2-release-report.json --out docs/evidence/my-new-release --expected 212 --projects 7 --baseline tmp/release-start.json
```

输出文件/目录必须新建。快照覆盖src/tests/scripts/public、构建/配置和测试实际读取的历史JSON；新增外部测试输入可在capture命令末尾追加仓库相对路径。`verify <manifest>`单独核对；新collector的`--baseline`会拒绝测试开始之后才取得的快照，以及变更/新增/丢失输入。旧报告无基线时保持明确的旧证据层级，不补拍假装已有开始快照。该工具不运行测试、不改变源码、不证明真人验收；普通审查笔记和本轮结果目录不在执行输入内。

v2完整规模使用`npm run verify:v2 -- --seeds 1000 --workers 4 --out tmp/my-v2-1000`。workers范围1–8，1为同一batch函数的串行路径；默认4。固定29组合全部保留，25种子分片按原profile/seed顺序归并，每终态正式回放并记录状态hash，worker退出异常或源/编译产物变化则不写成功summary。会运行较久；不要在它运行时重新编译tmp/simulation或修改参与模拟的core/timing/policy/worker/锁文件。不要把合成输入误差分布称为真人准确率。T12原规模批次的终态以实际会话/summary为准，启动不等于通过。

所有AI美术保存原图、实际提示词、来源/引用链与SHA；运行资源独立于整张概念图，文字由代码渲染。未获用户同意的风格不能默认为选定。旧图/旧存档/旧提交使用新增版本或revert保留；不强推覆盖历史，不提交.env、dist、tmp和node_modules。
