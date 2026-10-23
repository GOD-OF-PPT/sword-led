export const V6_TEMPLATE=`
<div class="x6-game" data-screen="title" data-phase="main-forge" data-rules-version="forge-v6">
 <div class="x6-world" aria-hidden="true"><div class="x6-road-light"></div></div>
 <header class="x6-header"><a class="x6-brand" href="/">锤下求生 <span>一剑开路</span></a><div class="x6-wallet" id="x6-wallet" hidden>开路钱 <strong id="x6-coins">0</strong></div><nav aria-label="行囊"><button id="x6-help" type="button">怎么玩</button><button id="x6-save" type="button">行程</button><button id="x6-menu" type="button" hidden>歇一歇</button></nav></header>
 <section id="x6-title" class="x6-title">
  <p class="x6-overline">v0.9 · 雾松关试锋</p><h1>一剑<span>开路</span></h1><p class="x6-title-line">把剑握在自己手里，试试它能走到哪里。</p>
  <p class="x6-title-story">三柄铁坯，一次定下火候的机会。<br>锻一柄好剑，劈开木盾；还有余力，就去争一件新手艺。</p>
  <div class="x6-title-actions"><button id="x6-start" type="button" class="x6-primary">点火，铸第一剑</button><button id="x6-continue" type="button" hidden>继续这趟开路</button></div>
  <details class="x6-seed"><summary>行旅种子</summary><label for="x6-seed">同一条路，有相同的际遇</label><input id="x6-seed" maxlength="64" autocomplete="off" placeholder="留空，走一条新路"></details>
  <a class="x6-back" href="/">回到十二灯行旅</a>
 </section>
 <main id="x6-play" hidden aria-label="铸剑与开路">
  <section class="x6-heading"><p id="x6-stage" class="x6-overline"></p><h1 id="x6-goal"></h1><p id="x6-purpose"></p></section>
  <aside id="x6-supply" class="x6-supply" aria-label="这一炉的铁坯"><h2>此炉三坯</h2><div id="x6-blanks"></div><button id="x6-discard" type="button">换一柄新坯</button></aside>
  <section id="x6-schools" class="x6-schools" aria-label="开炉手艺">
   <button type="button" data-school="steady" aria-pressed="false"><span class="x6-seal x6-steady">定</span><strong>稳锋 · 定线</strong><small>用出手艺时，只保下一记不添裂纹</small></button>
   <button type="button" data-school="fissure" aria-pressed="false"><span class="x6-seal x6-fissure">崩</span><strong>裂炉 · 崩纹</strong><small>主动刻裂，换一剑穿甲的爆发</small></button>
  </section>
  <div id="x6-forge-scene" class="x6-forge-scene">
   <canvas id="x6-blade" role="img" aria-label="本次打造的剑与裂纹"></canvas>
   <button id="x6-hit" type="button" aria-label="鼠标左键落锤，不需要卡时机"></button>
   <div id="x6-hammer" aria-hidden="true"><img src="/assets/d/hammer-forge-v2.webp" alt="" draggable="false"></div>
   <div id="x6-sparks" aria-hidden="true"></div><div id="x6-impact" aria-hidden="true"></div>
  </div>
  <div id="x6-targets" class="x6-targets" hidden>
   <button id="x6-primary" class="x6-target x6-primary-target" type="button"><img id="x6-guard-art" src="/assets/d/v09/wood-guardian-v1.webp" alt="" draggable="false"><span class="x6-target-caption"><strong id="x6-primary-name">拦路木卫</strong><span id="x6-primary-health"></span></span></button>
   <button id="x6-secondary" class="x6-target x6-secondary-target" type="button" hidden><span class="x6-practice-target" aria-hidden="true"><i></i><b>✦</b></span><span class="x6-target-caption"><strong>远处的试锋靶</strong><span id="x6-secondary-health"></span></span></button>
   <button id="x6-rope" class="x6-target x6-cache x6-rope" type="button" hidden><span class="x6-hanging-rope" aria-hidden="true"></span><span class="x6-chest" aria-hidden="true"><img src="/assets/d/v09/rebound-tooth-v1.webp" alt=""></span><span class="x6-target-caption"><strong>切绳 · 取回锋齿</strong><span id="x6-rope-need"></span></span></button>
   <button id="x6-latch" class="x6-target x6-cache x6-latch" type="button" hidden><span class="x6-chest" aria-hidden="true"><img src="/assets/d/v09/furnace-nail-v1.webp" alt=""><i class="x6-iron-latch"></i></span><span class="x6-target-caption"><strong>破闩 · 取崩炉钉</strong><span id="x6-latch-need"></span></span></button>
   <div id="x6-escort" class="x6-escort" aria-hidden="true"><svg viewBox="0 0 80 150"><path d="M30 45q-18 10-13 52l-8 43 21-5 10-35 8 36 20 4-11-46q7-43-14-49Z" fill="#243c41" stroke="#d7b57c" stroke-width="2"/><circle cx="39" cy="28" r="15" fill="#b99062"/><path d="m12 32 27-22 27 22Z" fill="#182c32" stroke="#ba975d"/><path d="m55 60 16 29" stroke="#b89e73" stroke-width="6"/><path d="M70 82v12" stroke="#e4c176" stroke-width="2"/><rect x="62" y="94" width="16" height="24" rx="5" fill="#ffca68"/></svg></div>
  </div>
  <section id="x6-result" class="x6-result" hidden aria-live="polite" aria-atomic="true"><small id="x6-result-kicker"></small><strong id="x6-result-title"></strong><p id="x6-result-copy"></p></section>
  <aside id="x6-tool" class="x6-tool" hidden><img id="x6-tool-art" alt=""><div><strong id="x6-tool-name"></strong><p id="x6-tool-copy"></p></div></aside>
  <section id="x6-readout" class="x6-readout" aria-label="手中剑的状况"><p><strong id="x6-strength">0</strong><span>强度</span><b id="x6-condition">粗铁坯</b></p><div id="x6-hit-count" class="x6-hit-count"></div><p id="x6-risk"></p><p id="x6-uses"></p></section>
  <div id="x6-turns" class="x6-turns" hidden aria-label="试锋余火"></div>
  <section class="x6-actions" aria-label="当前可以做的事"><button id="x6-technique" type="button" aria-pressed="false" hidden></button><button id="x6-forge" type="button" class="x6-primary" hidden>落锤 <small>左键剑身 / 空格</small></button><button id="x6-seal" type="button" class="x6-primary" hidden>收锻，携剑试锋</button><button id="x6-guard" type="button" hidden>架剑探隙</button><button id="x6-leave" type="button" hidden>路已通，就此启程</button></section>
 </main>
 <section id="x6-recap" class="x6-recap" hidden><p class="x6-overline">这一剑，留下的故事</p><h1 id="x6-recap-title" tabindex="-1"></h1><p id="x6-recap-copy"></p><div id="x6-recap-facts"></div><div class="x6-title-actions"><button id="x6-again" type="button" class="x6-primary">再铸一剑，换个走法</button><button id="x6-history" type="button">回看刚才的剑</button></div><a class="x6-back" href="/">回到十二灯行旅</a></section>
 <div id="x6-save-warning" class="x6-save-warning" hidden></div><p id="x6-status" class="x6-status" role="status" aria-live="polite"></p>
 <dialog id="x6-dialog" aria-labelledby="x6-dialog-title"><h2 id="x6-dialog-title"></h2><div id="x6-dialog-body"></div><div id="x6-dialog-actions"></div></dialog>
</div>`;
