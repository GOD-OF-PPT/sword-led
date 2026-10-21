# G4/T02 B：当前 v5 存储用例覆盖交回

2026-10-21，代码前已全量读取goal-4/input.md、plan.md、tasks.md。只新增`tests/e2e/v5-storage.spec.ts`与`v5-storage-helpers.ts`；未改共享helper、配置、package、产品、SDK、旧原件或用户试玩。现为26个计划展开case，待root统一typecheck/发现/冻结浏览器运行，**没有本次通过数量**。

| 原责任/新增边界 | 实际spec意图 | 计划case数 |
| --- | --- | ---: |
| L16/L40 | 合法第4/8天已交妥前缀，UI收工/改造；run、book、settings同时拒写，实际下载校验Accepted内存，先重试run再book再设置，新成长不冒称已落盘 | 2 |
| 备份只写失败 | run备份拒写但main真实一锤保存；book备份拒写但章末主炉谱保存，分别显示警告/旧备份保持 | 2 |
| 设置独立读失败/未知schema | 原文在未作设置选择前保留，仍真实落锤；明确改静音后才写新设置，游戏不回滚 | 2 |
| L17/L45 | 坏局+未来炉谱，各自日期备份先取消再实际恢复，两个来源独立，未先抹未知原件 | 1 |
| backup-only来源竞态 | run/book确认后仅备份raw被同源另页改变，保留旧DOM回调不得恢复未展示的新来源；重新查看后才接受 | 2 |
| L20/拒读 | run主读、book主读、localStorage getter拒读，保留底层raw；只有明确memory后才继续，实际download校验真实锤结果，零持久写 | 3 |
| 备份只读失败 | run原文导出明确backup读取失败，book原文bundle明确backup.ok=false；不伪装成null空槽，合法main续用 | 2 |
| L44 | writer acquisition拒绝后真实重试底层Web Lock并保存新锤 | 1 |
| L20 | navigator.locks缺失，明确memory开炉/一锤导出，run/book零写 | 1 |
| L18 | 同context第二页只读，owner实际一锤后关闭，reader显式取得保存权/读最新/再锤 | 1 |
| L18/新旧隔离 | 真实旧v3页面先持锁，一锤旧档保留；v5等owner关闭后显式接手、保存新锤 | 1 |
| L19 | 空标题实际收到同源合法v5主档事件，需显式读取最新；另开确认取消不覆盖 | 1 |
| L46 | 第8天scrap旧确认遇实际第9天主档变更后失效，保留旧内存可导出，显式读最新后旧回调也不能处置新剑 | 1 |
| L47 | 同revision翻炉谱后捕获的合法章按钮仍可用；后八章generation变化后，旧按钮即使对应新章合法选项也不得执行 | 1 |
| 旧schema来源 | main/backup分别预览→取消零写→明确导入；旧作品保留forge-v4来源、当前局资格和钱包不变；实际新开使用持久资格，v4.html→默认入口的旧/新raw隔离 | 2 |
| 预览票据/失败重试 | 旧源变化拒旧票据；明确确认较少作品后拒book写，再改变旧源为全局作品，重试只能保存已确认的较少集合 | 1 |
| L10 | 合法终局恢复，valid/future book两分支：readonly不可开挑战，memory不发新奖；已持久资格仅允许另开不保存challenge opening，unknown绝不授予 | 2 |

总26。L39普通第4/8summary/第9天继续、第二章真实失败、双剑0/2和1/2收工由root旅程分工覆盖；本组没有假称额外完整故事/挑战。T03原生BFCache、最小化、音频、画稿重试和性能未混入本组。

## 真实输入与验证方式

- 全部合法前缀只由shipping v5 SDK的create/apply从已发布142命令见证重建，并完整validate后用正式repository编码；缓存合法前缀避免每case反复完整构造。旧schema使用shipping v4解释器重建/校验，再由v5旧codec确认，不改旧原文。
- 新增probe只在测试context包裹Storage/Web Locks；保留原生getter仅供测试观察故障下的真实底层raw，产品仍真实抛拒读。初始化的fixture明确为合法恢复边界；坏JSON/未来版本是明确负样例。
- 正常UI动作复用`KeyboardV5(page,info,'mouse')`和正式逐命令全等。dirty/memory不能误用磁盘作为当前工作副本，因此只通过实际“导出当前行程”下载获得真实内存，完整validate后与applyCommand全等；手动接受记录含runId/mode并写命令原件。
- retained callback仅调用已显示DOM按钮的click以验过期身份，未调用产品经济port。external change通过同源静态页真实Storage.setItem生成trusted storage事件，等待精确key+新raw，不伪造StorageEvent。
- 同context子页继承Playwright项目DPR，create/finish与两尺寸截图均实读DPR。未另造默认DPR1的context。writer/reader双页动作合并进同case命令记录，前owner快照独立保存，避免覆盖原证据。
- 没有浏览器、构建、提交或推送。一次尝试用TS compiler API仅做语法读取时，安装的TS7没有ScriptTarget API而报工具错误；未视为代码错误或类型检查成功，统一strict由root执行。

## 已知应保留的首红可能

只读源码显示主局browser绑定目前只监听main key；book备份虽会refresh但恢复回调没有绑定已展示backup raw。上述两个backup-only竞态**可能暴露真实产品缺口**。用例坚持“旧确认不能恢复未展示来源”，没有为了当前代码而放宽或skip。root应保留首红再最小复现/修补并重新冻结，不修改旧SDK/规则求绿。

[杠精审查] 通过代码分工范围：旧/新key、日期、来源、失败两层、memory与资格均分清；保留负样例和真实下载，没有注钱包/phase/RNG、没有把SDK边界当新整局，也没有用未执行spec填绿。实际消费者和C端结果待root统一运行。
