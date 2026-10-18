# 开发与验证约定

当前运行版为v0.2。[v0.3提案](docs/v0.3-gameplay-proposal.md)与D美术方向已获用户明确答复，下一任务实施三轮可玩。不要用v2规则改写v1回放或直接覆盖旧档。变更先更新对应规则来源，再依[goal任务](goal-1/tasks.md)一次执行一项。

安装使用`npm ci --registry=https://registry.npmjs.org/`，版本来自package-lock；不随手更新依赖，当前无运行时第三方依赖。`npm run dev`用于开发，生产检查运行`npm run check`。单元/严格类型/构建通过只证明相应工程条件，真人乐趣单独记录。

浏览器验证按顺序运行，避免多个构建同时改dist：

```sh
npx playwright install chromium firefox webkit
npm run check
npm run test:browser
npm run test:cross
npm run test:art
```

页面测试默认单worker/retries0，真实存储SDK与原生Chrome探测另记；不要通过重试隐藏失败。跨引擎配置排除两项直接启动原生Chrome的文件，它们仍在主UI套件执行；Firefox/WebKit的DPR2项目只跑渲染/控件相关规格，完整业务在常规DPR跑。各引擎版本与DPR要从实际运行环境获取，不能把引擎结果写成所有Safari/Edge/显卡均通过。

保持真实DOM输入和正式命令，不注入钱包、终局或幸运结果冒充可达玩法。核心边界fixture可以用于边界单测，证据须注明。键盘测试应遵守浏览器允许Tab移到工具栏的行为，不要求产品拦截全局Tab；用原生反向导航检验明确的页面内选择。音频图形/波形不代替真人听感；原生rAF的JS耗时不代替GPU/物理高刷认证。计时规格关闭trace采集，其余功能规格保留失败trace。

保留有意义的红测、原因和修复，证据说明代码/构建身份、测试过滤条件和实际结果。归档评论时仅提交索引/有限摘要与来源，不复制长评全文或把旧评论当今日已验证缺陷；[采集脚本](scripts/research/steam-reviews.mjs)拒绝覆盖既有证据，复采指定新的输出目录。

所有AI美术保存原图、实际提示词、来源/引用链与SHA；运行资源独立于整张概念图，文字由代码渲染。未获用户同意的风格不能默认为选定。旧图/旧存档/旧提交使用新增版本或revert保留；不强推覆盖历史，不提交.env、dist、tmp和node_modules。
