/** DOM surfaces only. The controller supplies every run value and available action. */
export const V4_TEMPLATE = `
<div class="v4-app" data-screen="title">
  <section id="v4-title" class="v4-title-screen" aria-labelledby="v4-main-title">
    <div class="v4-title-copy">
      <p class="v4-edition">重燃十二盏灯 · 山口终章</p>
      <h1 id="v4-main-title">锤下<span>求生</span></h1>
      <p class="v4-title-line">一炉火，一柄剑，一程未熄的灯。</p>
      <div class="v4-title-actions">
        <button id="v4-start" class="v4-primary" type="button">提灯启程<span>开一炉新火</span></button>
        <button id="v4-continue" class="v4-secondary" type="button" hidden>继续行旅</button>
      </div>
      <div class="v4-title-links">
        <button id="v4-title-collection" class="v4-text-button" type="button">翻开炉谱</button>
        <button id="v4-title-challenge" class="v4-text-button" type="button" hidden>行脚挑战</button>
        <button id="v4-title-settings" class="v4-text-button" type="button">炉边设置</button>
      </div>
      <details class="v4-journey-options">
        <summary>行旅种子与旧路</summary>
        <label for="v4-seed">行旅种子<span>相同种子会走过相同的际遇</span></label>
        <input id="v4-seed" maxlength="64" autocomplete="off" spellcheck="false" placeholder="留空，踏上一条新路">
        <a id="v4-old-v3" href="/v3.html">续玩旧版契约</a>
      </details>
    </div>
    <p class="v4-title-footnote">左键落锤，见好就收。好剑总有它要去的地方。</p>
  </section>

  <main id="v4-workshop" class="v4-workshop" hidden aria-label="行脚灯炉">
    <header class="v4-objective">
      <p id="v4-day" class="v4-eyebrow"></p>
      <h1 id="v4-goal-name"></h1>
      <p id="v4-goal-condition"></p>
      <p id="v4-goal-progress" class="v4-goal-progress"></p>
    </header>
    <div class="v4-purse" aria-label="契印与行囊">
      <div class="v4-resource v4-resource-seals"><span>契印</span><strong id="v4-seals"></strong></div>
      <div class="v4-resource v4-resource-coins"><span>铜钱</span><strong id="v4-coins"></strong></div>
    </div>

    <aside class="v4-rack" aria-label="炉边剑架">
      <h2>候火的剑</h2>
      <div id="v4-inventory" class="v4-inventory"></div>
      <section class="v4-kept-sword" aria-label="留给明天的剑">
        <h3>留一把，待明日</h3>
        <div id="v4-reserve-slot"></div>
      </section>
      <div class="v4-rack-actions">
        <button id="v4-reserve" type="button">挂上剑架</button>
        <div id="v4-recipes" aria-label="配方选择"></div>
      </div>
    </aside>

    <div id="v4-scene" class="v4-scene" aria-label="铁砧与当前兵器">
      <canvas id="v4-blade" aria-label="当前兵器外观"></canvas>
      <button id="v4-hit" type="button" aria-label="在剑身上落锤"></button>
      <div id="v4-impact-glow" aria-hidden="true"></div>
      <div id="v4-impact-ring" aria-hidden="true"></div>
      <div id="v4-reticle" aria-hidden="true"></div>
      <div id="v4-sparks" aria-hidden="true"></div>
      <div id="v4-hammer" aria-hidden="true"><img alt="" draggable="false"></div>
      <div id="v4-float" aria-hidden="true"></div>
      <div id="v4-impact-badge" aria-hidden="true"></div>
    </div>

    <section class="v4-blade-reading" aria-label="当前剑的身价与状况">
      <p class="v4-value-line"><span>剑价</span><strong id="v4-value"></strong><span id="v4-condition"></span></p>
      <p id="v4-craft-record"></p>
      <div class="v4-next-hit"><p id="v4-risk"></p><p id="v4-charge"></p></div>
      <button id="v4-strike" class="v4-strike-button" type="button">落锤<span>左键剑身 / 空格</span></button>
    </section>

    <aside class="v4-customer" aria-label="等剑的来客">
      <button id="v4-customer-open" class="v4-person-target" type="button" aria-haspopup="dialog" aria-label="和来客聊聊">
        <span id="v4-customer-figure" class="v4-customer-figure" data-pose="waiting" role="img">
          <span class="v4-customer-fallback" aria-hidden="true"></span>
          <span class="v4-customer-sprite" aria-hidden="true"></span>
        </span>
        <span class="v4-customer-nameplate"><b id="v4-customer-name"></b><small>点来客，听听心愿</small></span>
      </button>
      <p id="v4-talk" class="v4-customer-wish"></p>
      <button id="v4-deliver" class="v4-primary v4-deliver-button" type="button">把剑交给来客</button>
      <div class="v4-visiting-actions">
        <button id="v4-shop" type="button" hidden>行脚商人的摊子</button>
        <button id="v4-event-open" type="button" hidden>炉边来信</button>
      </div>
    </aside>

    <div id="v4-modifications" class="v4-modifications v4-furnishings" aria-label="已装炉具"></div>
    <section class="v4-travel-props" aria-label="随身手艺与炉具">
      <div id="v4-traits" class="v4-traits"></div>
      <div id="v4-gift" class="v4-gift"></div>
    </section>
    <button id="v4-scrap" class="v4-ground-action" type="button">回收这柄剑</button>
    <button id="v4-settle" class="v4-settle-button" type="button">收工，封炉<span>看看今日的收成</span></button>
  </main>

  <section id="v4-stage" class="v4-stage" hidden aria-labelledby="v4-stage-title">
    <div class="v4-stage-view"><img id="v4-stage-image" alt=""></div>
    <div class="v4-stage-story">
      <p class="v4-eyebrow">灯炉行记</p>
      <h1 id="v4-stage-title" tabindex="-1"></h1>
      <div id="v4-stage-copy" class="v4-stage-copy"></div>
      <div id="v4-stage-actions" class="v4-stage-actions"></div>
    </div>
  </section>

  <nav id="v4-tools" class="v4-tools" aria-label="行旅工具">
    <button id="v4-menu" type="button" aria-label="暂停与行旅菜单">行囊</button>
    <button id="v4-book" type="button" aria-label="打开炉谱">炉谱</button>
    <button id="v4-settings" type="button" aria-label="打开设置">设置</button>
    <button id="v4-save-open" type="button" aria-label="查看保存详情">存档</button>
  </nav>

  <section id="v4-notice" class="v4-notice" hidden aria-labelledby="v4-notice-title">
    <div class="v4-notice-mark" aria-hidden="true"></div>
    <div class="v4-notice-content"><h2 id="v4-notice-title"></h2><p id="v4-notice-copy"></p><button id="v4-notice-action" type="button" hidden>查看</button></div>
    <button id="v4-notice-dismiss" class="v4-close" type="button" aria-label="收起这条炉边消息">×</button>
  </section>

  <section id="v4-save-banner" class="v4-save-banner" hidden aria-label="保存状态">
    <p id="v4-save-summary"></p><button id="v4-save-details" class="v4-text-button" type="button">查看保存详情</button>
  </section>
  <p id="v4-status" class="v4-status" role="status" aria-live="polite" aria-atomic="true"></p>

  <dialog id="v4-dialog" aria-labelledby="v4-dialog-title">
    <h2 id="v4-dialog-title"></h2>
    <div id="v4-dialog-body"></div>
    <div id="v4-dialog-actions"></div>
  </dialog>
  <div id="v4-effects" class="v4-effects" aria-hidden="true"></div>
</div>`;
