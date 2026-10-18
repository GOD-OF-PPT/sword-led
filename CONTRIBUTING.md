# 开发与验证约定

`/`保留v0.2旧契约，`/v2.html`为已批准的v0.3核心试玩。[核心接线](docs/v0.3-core-and-preview.md)说明两解释器/独立key/共享锁与SDK。D资产、独立练习和全界面见[D界面说明](docs/v0.3-d-interface.md)。不要用v2规则改写v1回放或直接覆盖旧档；已发布forge-v2也不能悄悄换数值表解释旧journal。变更先更新规则来源，再依[goal任务](goal-1/tasks.md)一次执行一项。

安装使用`npm ci --registry=https://registry.npmjs.org/`，版本来自package-lock；不随手更新依赖，当前无运行时第三方依赖。`npm run dev`用于开发，生产检查运行`npm run check`。单元/严格类型/构建通过只证明相应工程条件，真人乐趣单独记录。

浏览器验证按顺序运行，避免多个构建同时改dist：

```sh
npx playwright install chromium firefox webkit
npm run check
npm run test:browser
npm run test:cross
npm run test:art
```

页面测试默认单worker/retries0，真实存储SDK与原生Chrome探测另记；不要通过重试隐藏失败。旧`playwright.cross.config.ts`是五项目定向配置，排除直接启动原生Chrome的规格；其DPR2项目只覆盖部分渲染/控件场景。新版完整配置另为`playwright.v2.config.ts`：先构建一次，再运行`npx playwright test --config playwright.v2.config.ts`，六引擎/DPR项目各35项完整规格和一个原生Chrome项目两项，共212项。旧定向配置不能代替完整新版结果。各引擎版本与DPR要从实际运行环境获取，不能把引擎结果写成所有Safari/Edge/显卡均通过。

保持真实DOM输入和正式命令，不注入钱包、终局或幸运结果冒充可达玩法。核心边界fixture可以用于边界单测，证据须注明。键盘测试应遵守浏览器允许Tab移到工具栏的行为，不要求产品拦截全局Tab；用原生反向导航检验明确的页面内选择。音频图形/波形不代替真人听感；原生rAF的JS耗时不代替GPU/物理高刷认证。计时规格关闭trace采集，其余功能规格保留失败trace。

保留有意义的红测、原因和修复，证据说明代码/构建身份、测试过滤条件和实际结果。归档评论时仅提交索引/有限摘要与来源，不复制长评全文或把旧评论当今日已验证缺陷；[采集脚本](scripts/research/steam-reviews.mjs)拒绝覆盖既有证据，复采指定新的输出目录。

v2核心开发可先执行`npm run verify:v2 -- --seeds 1 --out tmp/v2-new-smoke`，完整记录为29组合×32种子。结果只代表定义的策略与合成输入误差；数值/核心逻辑变化后重新验证，不能拿旧规则数据证明新版。归档当前单测/UI/新SDK报告可用`node scripts/collect-ui-evidence.mjs --stage T11.3 --out <新的目录>`；跨引擎v2子集使用独立collector，输出目录不覆盖。不要在页面测试运行中重新构建同一个dist。D素材原图/提示词/编码合同见[美术维护](design/d/README.md)，`scripts/art/prepare-d.py`仅做格式导出与alpha/hash验证。

新版完整报告用`node scripts/collect-v2-cross.mjs --report test-results/v2-release-report.json --out <新目录> --expected 212 --projects 7 --purpose <本次范围>`归档；会拒绝跳过、重试、失败或不匹配的数量，并用当前构建SDK回放附件状态、记录源/产物指纹。原始失败报告另存诊断目录，不伪装成绿报告。高DPR截图可在测试全部结束后用可选维护脚本`scripts/encode-browser-evidence.py --report <原报告> --out <新临时目录>`无损换容器，需要Pillow/cwebp，不是游戏或测试运行依赖。它逐图验证完整解码RGBA/尺寸及ICC/Exif，保留原PNG和原始报告于忽略临时目录、记录原/归档hash；再将生成的report.json交给collector。压缩不裁切/重画，原图稿PNG仍原样提交。不要在原生性能测试同时编码截图。

所有AI美术保存原图、实际提示词、来源/引用链与SHA；运行资源独立于整张概念图，文字由代码渲染。未获用户同意的风格不能默认为选定。旧图/旧存档/旧提交使用新增版本或revert保留；不强推覆盖历史，不提交.env、dist、tmp和node_modules。
