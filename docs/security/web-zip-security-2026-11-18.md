# Web Zip 安全扫描报告

扫描路径: `/Users/gordon/githome/sword-led`
扫描的 HTML 文件数: 初扫 337；修复后全目录复扫 348（新增 11 个为本轮导出的静态交付包页面）。
问题统计: 边界校正后初扫共 1,795 项，其中高风险 1,758 项、中风险 37 项、需人工复核 0 项；当前 Git 追踪内容占其中 38 项高风险规则命中。

## 总体结论

**当前发布链路的 38 项规则命中已修复，当前追踪内容复扫 0 项；新静态交付包的 11 个 HTML 复扫 0 项。整个本地工作目录仍有 1,757 项历史/未追踪内容命中，不能称为全目录零问题。**

这些规则属于保守静态判断：动态HTML命中表示需建立过滤边界，固定根路径命中主要涉及部署可用性，不代表每条都已证实能被攻击者利用。

默认排除 `node_modules`、`.git`、`.svn`、`.hg`、`dist`、`build`、`.cache`、`.turbo`、`.next`、`coverage`、`Library`、`Temp`、`Logs`。本轮未放宽原工作目录的默认排除规则。构建后另将新导出的 `tmp/security-20261117-233917/release` 作为独立静态交付目标复扫；其中没有历史缓存、源码快照或包内后端。

## 高风险

当前交付：0 项。全目录剩余 1,720 项，均来自未追踪的历史预览、采集网页、测试trace或旧源码/构建快照；逐项文件、行号、证据与建议保存在附带审计包的 `root-after.md` / `root-after.json`，没有通过改写旧证据或隐藏默认扫描目录来消除命中。不要将整个工作目录作为生产静态包发布。

## 中风险

当前交付：0 项。全目录剩余 37 项中文路径，属于历史浏览器下载/存档的原始文件名，保持来源与归档身份，不重命名或重新发布这些材料。逐项路径在附带审计包中。

## 需人工复核

0 项。最初工具把两个名为 `dist` 的历史目录符号链接计入复核，最终边界审查依技能默认排除规则移出统计。未跟随链接或改写旧文件；校正前初稿保存在 `before-raw-initial.json` / `.md`，不能把它们当成已修复漏洞计数。

## 已实施的修复

- 将当前HTML入口、设计预览与图标引用改为包内相对路径，Vite显式设置 `base: ./`。
- 在实际HTML写入边界使用锁定版本 [js-xss 1.0.17](https://github.com/leizongmin/js-xss) 白名单过滤。禁止脚本/嵌入标签、事件属性、危险协议、可执行Data URI及危险CSS；保留必要的游戏按钮、ARIA/data属性、光栅图片与受限SVG/CSS。
- 资源和导航URL在呈现层相对当前静态包解析，保持纯规则模块与存档规则不变；在根目录托管时仍保留原资源路径身份。
- 单文件试玩版由当前源模块自动打包，内嵌41个WebP资源及依赖许可；后续运行 `npm run build` 会同步更新，避免修复只落在一份副本。
- 新增13条安全/兼容测试，并在浏览器回归发现定位/flex样式被默认过滤后补齐受限样式白名单与断言，避免布局退化。

## 验证结果

- Node 22.12.0：类型检查、生产构建和所有SDK构建通过。
- 43个单测文件、451项测试通过（包括新增13项安全/兼容测试）。
- 独立扫描器负向控制检出16项预设问题，且正确跳过合成 `node_modules` 目录。
- 暂存文件树的独立导出目录：15个HTML、1个Vite配置，复扫0项。
- 11个发布入口在 `/nested/games/sword-led/` 子目录托管下启动，无运行时/资源请求错误；隐藏的空图片占位不计为加载失败。
- v8真实界面完成开局、三锤、淬火、保存/恢复及进入战斗；保留定位与flex样式。
- 修复后的单文件版通过 `file://` 离线进入铸剑；内置演武终局可完成结算并显示SVG雷达。
- 实际浏览器中的6组脚本/事件/SVG/协议/CSS攻击样本：执行计数0、危险元素0、危险属性0。
- 旧B美术校验通过：9张运行图片、24帧、288组几何组合、透明通道一致。
- 单文件输出重复生成的SHA-256一致；最终输入稳定后未再修改运行代码。

浏览器行为测试是修复后的独立本地回归，不属于静态扫描，也没有为核验外部脚本URL发起网络或DNS探测。未声称完整跨浏览器、真人体验或渗透测试完成。

## 已修复的初扫命中明细

以下均为修复前证据，保留原1-based行号，避免用新文件行号冒充原始位置。

### H-1 固定资源/导航路径（已修复）
- 文件: `campaign.html`
- 行号: 11
- 证据: `src="/src/v7-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-2 固定资源/导航路径（已修复）
- 文件: `campaign.html`
- 行号: 8
- 证据: `href="/favicon.svg"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-3 固定资源/导航路径（已修复）
- 文件: `classic.html`
- 行号: 11
- 证据: `src="/src/classic-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-4 固定资源/导航路径（已修复）
- 文件: `design/b/preview/index.html`
- 行号: 61
- 证据: `src="/assets/b/merchant-kit-v1.webp"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-5 固定资源/导航路径（已修复）
- 文件: `design/b/preview/index.html`
- 行号: 7
- 证据: `href="/assets/b/tokens.css"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-6 固定CSS资源路径（已修复）
- 文件: `design/campaign-v1/storyboard.html`
- 行号: 16
- 证据: `url('/assets/d/customers-atlas-v2.webp')`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-7 固定资源/导航路径（已修复）
- 文件: `design/campaign-v1/storyboard.html`
- 行号: 41
- 证据: `src="/assets/d/reboot/forge-focus-backdrop-v1.webp"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-8 固定资源/导航路径（已修复）
- 文件: `design/campaign-v1/storyboard.html`
- 行号: 58
- 证据: `src="/assets/d/v07-chapter3/ending-twelve-lights-v1.webp"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-9 固定资源/导航路径（已修复）
- 文件: `forge.html`
- 行号: 11
- 证据: `src="/src/forge-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-10 固定资源/导航路径（已修复）
- 文件: `index.html`
- 行号: 11
- 证据: `src="/src/v8-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-11 固定资源/导航路径（已修复）
- 文件: `index.html`
- 行号: 8
- 证据: `href="/favicon.svg"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-12 固定资源/导航路径（已修复）
- 文件: `legacy.html`
- 行号: 2
- 证据: `href="/assets/b/tokens.css"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-13 固定资源/导航路径（已修复）
- 文件: `legacy.html`
- 行号: 2
- 证据: `src="/src/main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-14 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 4855
- 证据: `elModalBody.innerHTML = html`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-15 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5070
- 证据: `elStepper.innerHTML = parts.join('')`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-16 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5077
- 证据: `elLampPill.innerHTML = \`<span>🔥 灯火</span><span class="v8-lamp-pips">${pips.join('')}</span><strong>${state.lamp}/${state.lampMax}</strong>\``
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-17 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5078
- 证据: `elResPill.innerHTML = \`🪙 <b>${state.coins}</b>钱 · 🧱 坯<b>${state.blanks}</b> · ⚡ 技<b>${state.charge}</b>\``
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-18 固定资源/导航路径（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5105
- 证据: `href="/campaign.html"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-19 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5108
- 证据: `elStageBody.innerHTML = \` <div class="v8-title-screen"> <div class="v8-title-hero"> <div class="v8-kicker">锤下求生 · 三章九站铸剑战棋 · V8.2 薪火参赛版</div> <h1>护炉远行</h1> <p class="v8-title-lead"> 绝顶山口的母灯熄了，十二盏山路长灯正一盏盏暗入风雪。<br> 推起小炉车观火铸剑，收集十二传世名剑图鉴，沿途救齐众人`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-20 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5160
- 证据: `elStageBody.innerHTML = \` <div class="v8-choice-stage"> <div class="v8-scroll-box"> <h2>📜 护炉立誓 · 三章远行要诀</h2> <p>母灯在绝顶山口熄灭，你们推着唯一灯芯与随行小炉车踏入夜路。出发前只记这三件事：</p> <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));g`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-21 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5257
- 证据: `elStageBody.innerHTML = \` <div class="v8-prepare-view"> <div class="v8-companion-stage"> <img class="v8-companion-img" src="${art(comp.fullArt)}" alt="${esc(comp.name)}"> <div class="v8-speech-card"> <b>${esc(comp.name)} · ${esc(comp.role)}`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-22 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5383
- 证据: `elStageBody.innerHTML = \` <div class="v8-forge-view"> <div class="v8-heat-hud"> <div class="v8-heat-top"> <span>🔥 <b>柔阻尼炉温仪</b> · ${esc(riskText)}</span> <span class="v8-speed-pills"> <span style="color:var(--v8-muted);font-size:11px;">炉风速`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-23 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5550
- 证据: `elStageBody.innerHTML = \` <div class="v8-encounter-view"> ${topBanner} <div class="v8-arena-grid"> <div class="v8-hero-stance ${e.block > 0 ? 'is-guarded' : ''}"> ${ hand && isWeaponUsable(hand) ? \`<img class="v8-hero-blade-img" src="${art(`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-24 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5595
- 证据: `elStageBody.innerHTML = \` <div class="v8-choice-stage"> <div class="v8-scroll-box"> <small style="color:#7c582b;font-weight:700;">第${state.node}站 · ${esc(NODES_DATA[state.node].title)} · 因果抉择</small> <h2>${esc(cData.title)}</h2> <p>${esc(cD`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-25 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5609
- 证据: `elStageBody.innerHTML = \` <div class="v8-choice-stage"> <div class="v8-scroll-box"> <small style="color:#963d28;font-weight:700;">止步于 第${state.node}站 · ${esc(NODES_DATA[state.node].title)}</small> <h2>炉火受阻 · 先把这口火记在心里</h2> <p>${esc(state.fa`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-26 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5712
- 证据: `elStageBody.innerHTML = \` <div class="v8-ending-view"> <div class="v8-ending-left ${end.isSecret ? 'is-celestial' : ''}"> <span class="v8-ch-badge">${esc(end.difficultyName)} · 止于 ${esc(end.stoppedAt)}</span> <h1>${esc(end.title)}</h1> <p s`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-27 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5830
- 证据: `elColRack.innerHTML = \`<div class="v8-rack-row">${slotCard(hand, true)}${slotCard(reserve, false)}</div>${toolHtml}\``
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-28 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5855
- 证据: `elColAssist.innerHTML = \` <div class="v8-assist-row">${assistHtml}</div> <div class="v8-log-box">${logsHtml}</div> \``
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-29 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5864
- 证据: `elColCmd.innerHTML = \` <div class="v8-ap-row"> <span>📍 当前阶段：<b>炉车整备</b>（阅读、调音与换剑不耗回合）</span> </div> <div class="v8-cmd-buttons"> <button type="button" class="v8-btn ${firstForge ? 'is-primary' : ''}" data-act="begin-forge" ${state.blanks <`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-30 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 5886
- 证据: `elColCmd.innerHTML = \` <div class="v8-ap-row"> <span>🔥 瞄准上方<b>金焰甜区</b>落锤 · 技火剩余 <b>${state.charge}</b> 次</span> </div> <div class="v8-cmd-buttons"> <button type="button" class="v8-btn is-primary" data-act="anvil-strike" ${!fw || fw.hits >=`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-31 动态HTML赋值（已修复）
- 文件: `public/playable-v8.html`
- 行号: 6018
- 证据: `elColCmd.innerHTML = \` <div class="v8-ap-row"> <span>行动火印：<b style="color:var(--v8-gold);letter-spacing:2px;">${'◆'.repeat(e.actions)}${'◇'.repeat(Math.max(0, 2 - e.actions))}</b> (${e.actions}/2)</span> <span style="font-size:12px;color:va`
- 原因: 动态HTML赋值未在此赋值边界经过指定sanitizer。
- 修复: 统一sanitizer处理并由同源模块重新生成离线版。

### H-32 固定资源/导航路径（已修复）
- 文件: `v2.html`
- 行号: 4
- 证据: `src="/src/v2-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-33 固定资源/导航路径（已修复）
- 文件: `v3.html`
- 行号: 2
- 证据: `src="/src/v3-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-34 固定资源/导航路径（已修复）
- 文件: `v4.html`
- 行号: 2
- 证据: `src="/src/v4-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-35 固定资源/导航路径（已修复）
- 文件: `v6.html`
- 行号: 11
- 证据: `src="/src/v6-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-36 固定资源/导航路径（已修复）
- 文件: `v6.html`
- 行号: 8
- 证据: `href="/favicon.svg"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-37 固定资源/导航路径（已修复）
- 文件: `v8.html`
- 行号: 11
- 证据: `src="/src/v8-main.ts"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

### H-38 固定资源/导航路径（已修复）
- 文件: `v8.html`
- 行号: 8
- 证据: `href="/favicon.svg"`
- 原因: 固定根路径或本机路径依赖特定部署位置，子目录静态托管可能失效。
- 修复: 使用包内相对引用，配合相对base及呈现层URL解析。

## 建议修复顺序与后续边界

1. 当前发布命中已修复并复扫；部署完整构建产物，或独立使用 `public/playable-v8.html`。
2. 不将 `tmp/` 与历史 `docs/evidence/` 当作生产包发布；如要公开某份旧HTML，应按其原始身份另行复核。
3. 本次仅覆盖技能定义的静态规则与列出的本地回归，不能证明不存在所有安全漏洞。

完整原始结果和扫描实现见 [审计附件](web-zip-security-2026-11-18-audit.zip)。本轮基于提交 `643fb9057a7cbe71d85068c3abd0f7a35a527005` 修复，未重写历史。
