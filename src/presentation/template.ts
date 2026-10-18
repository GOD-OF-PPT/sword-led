export const APP_TEMPLATE = `
<div class="app-shell">
  <section id="loading" class="loading paper" aria-live="polite"><p class="eyebrow">锤下求生 · 行会手账</p><h1>正在开炉</h1><p id="loading-text">整理工坊与本机契约…</p><button id="retry-art" hidden>重新载入美术</button></section>
  <section id="menu" class="menu-screen" hidden>
    <canvas id="menu-scene" aria-hidden="true"></canvas>
    <div class="menu-shade"></div>
    <article class="menu-book paper"><p class="eyebrow">行会来料 · 铁与炉火 · 一锤一抉择</p><h1>锤下求生</h1><h2>三件来料，十二轮契约。</h2>
      <p>让铁坯升值，在它断裂前决定收手。交货完成今天的订单，回收为下一次升级留出余地。</p>
      <div id="save-preview" class="save-preview"></div>
      <button id="continue" class="primary">继续契约</button><button id="new-game">新契约</button>
      <div class="menu-pair"><button id="practice">先练两锤</button><button id="options">操作设置</button></div>
      <div id="menu-storage" class="storage-message"></div>
      <div class="menu-pair"><button id="reconnect">重新读取契约</button><button id="recover" hidden>从备份恢复</button></div>
      <button id="memory-game" class="quiet">不保存试玩</button>
      <p class="small">鼠标或空格按住蓄锤，松开落锤。没有现实时间倒计时，随时暂停。</p>
    </article>
  </section>
  <section id="game-route" class="game-route" hidden>
    <header class="topbar">
      <button id="menu-logo" class="brand paper" aria-label="返回契约菜单">锤下求生<span>行会手账</span></button>
      <div class="order paper"><span id="round">第 1 / 12 轮</span><strong id="delivered">已交货 0 / 120</strong><b id="deficit">尚差 120</b><progress id="order-progress" max="120" value="0" aria-label="当轮交货额"></progress></div>
      <div class="seal-counter" aria-label="契约印记"><span class="contract-token" aria-hidden="true">契</span><span>契约印记<strong id="seals">3 / 3</strong></span></div>
      <div class="wallet"><span>金币<strong id="coins">0</strong></span><span>废料<strong id="scrap">0</strong></span><span>煤<strong id="coal">1</strong></span></div>
      <button id="pause" class="pause-button" aria-label="暂停">Ⅱ</button>
    </header>
    <div id="storage-banner" class="storage-banner" hidden><span id="storage-text"></span><button id="retry-save">重试保存</button><button id="refresh-slot">读取最新契约</button></div>
    <aside id="lesson-banner" class="lesson-banner paper" hidden><div><b id="lesson-title"></b><span id="lesson-text"></span><small id="lesson-hint"></small></div><button id="lesson-reset">重练本课</button><button id="lesson-next" class="primary">下一课</button><button id="lesson-exit">返回契约</button></aside>
    <main id="workshop" class="workshop">
      <section class="scene-panel" aria-label="锻造工坊"><canvas id="forge-scene" aria-label="铁锤、砧台与当前铁件"></canvas>
        <div id="scene-status" class="scene-status"></div><p id="feedback" class="feedback-message" aria-hidden="true"></p><span id="saved" class="saved-status">已保存</span></section>
      <aside class="piece-panel paper" aria-labelledby="piece-title"><p class="eyebrow" id="piece-slot">行会来料</p><h2 id="piece-title">请选择铁坯</h2>
        <div class="value-pair"><div><span id="piece-value-label">当前价值</span><strong id="piece-value">—</strong></div><div>下一阶<strong id="next-value">—</strong></div></div>
        <label class="stat-line">进度<strong id="piece-progress">—</strong><progress id="progress-meter" max="35" value="0"></progress></label>
        <div class="stat-line"><span>完整度</span><strong id="integrity">—</strong><div id="integrity-cells" class="integrity-cells"></div></div>
        <label class="stat-line">热度<strong id="heat">—</strong><progress id="heat-meter" max="100" value="0"></progress></label>
        <label class="stat-line">应力<strong id="stress">—</strong><progress id="stress-meter" max="100" value="0"></progress></label>
        <p id="break-warning" class="break-warning"></p><p id="piece-help" class="small"></p>
      </aside>
      <section class="timing-panel" aria-label="落锤时机与裂损风险">
        <div class="timing-heading"><strong id="timing-title">松开时，让游标落在中央</strong><span id="timing-speed">标准速度</span></div>
        <div id="timing-track" class="timing-track"><span class="band miss">偏击</span><span class="band ordinary">普通</span><span class="band precise">精准</span><span class="band ordinary">普通</span><span class="band miss">偏击</span><i id="cursor" class="cursor" aria-hidden="true"></i></div>
        <div id="risk-row" class="risk-row"><span>裂损风险：</span><b id="risk-precise"></b><b id="risk-ordinary"></b><b id="risk-mishit"></b></div>
      </section>
      <section class="bottom-board paper" aria-label="来料、锤法与锻造操作">
        <div class="tray" aria-label="本轮三件来料">
          <button id="piece-1" class="piece-card"><span class="slot-number">1</span><canvas aria-hidden="true"></canvas><b class="material-name"></b><span class="tier-name"></span><strong class="piece-price"></strong><small class="piece-state"></small></button>
          <button id="piece-2" class="piece-card"><span class="slot-number">2</span><canvas aria-hidden="true"></canvas><b class="material-name"></b><span class="tier-name"></span><strong class="piece-price"></strong><small class="piece-state"></small></button>
          <button id="piece-3" class="piece-card"><span class="slot-number">3</span><canvas aria-hidden="true"></canvas><b class="material-name"></b><span class="tier-name"></span><strong class="piece-price"></strong><small class="piece-state"></small></button>
        </div>
        <div class="mode-panel"><h3>锤击模式</h3><div class="mode-buttons"><button id="mode-light"><canvas aria-hidden="true"></canvas>轻锤<kbd>Q</kbd></button><button id="mode-standard"><canvas aria-hidden="true"></canvas>标准锤<kbd>W</kbd></button><button id="mode-heavy"><canvas aria-hidden="true"></canvas>重锤<kbd>E</kbd></button></div><p id="hammer-info" class="small"></p></div>
        <div class="actions"><button id="strike" class="strike-button primary" aria-describedby="strike-help">按住蓄锤 · 松开落锤</button><p id="strike-help" class="small">鼠标 / 空格；Esc 暂停</p>
          <div class="action-row"><button id="heat-button" class="heat-action">加热<small id="heat-cost">1 煤</small></button><button id="deliver-button" class="teal-action">交货<strong id="deliver-price"></strong></button><button id="recycle-button">回收<strong id="recycle-price"></strong></button><button id="settle-button">收工</button></div>
        </div>
      </section>
    </main>
    <section id="phase-panel" class="phase-panel paper" aria-labelledby="phase-title" hidden><div class="phase-scroll"><p id="phase-kicker" class="eyebrow"></p><h1 id="phase-title" tabindex="-1"></h1><p id="phase-description"></p><div id="phase-content"></div></div><div class="phase-footer"><span id="phase-storage" class="small"></span><div id="phase-actions" class="phase-actions"></div></div></section>
    <p id="game-note" class="game-note" role="status" aria-live="polite"></p>
  </section>
  <dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-paper paper"><h2 id="dialog-title"></h2><div id="dialog-body"></div><div id="dialog-actions" class="dialog-actions"></div></div></dialog>
</div>`;
