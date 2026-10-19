# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-campaign.spec.ts >> default twelve-round campaign completes through three merchants, upgrades, replacement and reload with zero pointer events
- Location: tests/e2e/v3-campaign.spec.ts:33:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - text: 锤下求生
      - generic [ref=e6]: 行脚灯炉 · 十二轮契约版
    - generic [ref=e7]:
      - generic [ref=e8]: 第 3 / 12 轮
      - generic [ref=e9]: 交差 0 / 520
      - progressbar "本轮交差进度" [ref=e10]
      - list "本局契约旅程" [ref=e12]:
        - listitem "第1轮已达标" [ref=e13]: "1"
        - listitem "第2轮已达标" [ref=e14]: "2"
        - listitem "第3轮当前，商人到访" [ref=e15]: "3"
        - listitem "第4轮" [ref=e16]: "4"
        - listitem "第5轮" [ref=e17]: "5"
        - listitem "第6轮，商人到访" [ref=e18]: "6"
        - listitem "第7轮" [ref=e19]: "7"
        - listitem "第8轮" [ref=e20]: "8"
        - listitem "第9轮，商人到访" [ref=e21]: "9"
        - listitem "第10轮" [ref=e22]: "10"
        - listitem "第11轮" [ref=e23]: "11"
        - listitem "第12轮" [ref=e24]: "12"
    - generic [ref=e25]:
      - generic [ref=e26]: 金币 566
      - generic "契约印记 3/3" [ref=e27]:
        - generic [aria-hidden] [ref=e28]: 契
        - generic [aria-hidden] [ref=e29]: 契
        - generic [aria-hidden] [ref=e30]: 契
    - button "暂停" [ref=e31] [cursor=pointer]
    - button "契约" [ref=e32] [cursor=pointer]
  - region "保存状态" [ref=e33]:
    - status [ref=e34]: 本地自动保存
    - button "导出进度" [ref=e35] [cursor=pointer]
  - main [ref=e36]:
    - complementary [ref=e37]:
      - heading "今日三柄" [level=2] [ref=e38]
      - generic [ref=e39]:
        - button "镇岳重剑 上轮 · 121" [pressed] [ref=e40] [cursor=pointer]:
          - generic [ref=e41]: 镇岳重剑
          - generic [ref=e42]: 上轮 · 121
        - button "青云剑 本轮 · 40" [ref=e43] [cursor=pointer]:
          - generic [ref=e44]: 青云剑
          - generic [ref=e45]: 本轮 · 40
        - button "赤羽刀 本轮 · 40" [ref=e46] [cursor=pointer]:
          - generic [ref=e47]: 赤羽刀
          - generic [ref=e48]: 本轮 · 40
        - button "镇岳重剑 本轮 · 40" [ref=e49] [cursor=pointer]:
          - generic [ref=e50]: 镇岳重剑
          - generic [ref=e51]: 本轮 · 40
      - generic [ref=e52]:
        - heading "留给明天" [level=3] [ref=e53]
        - paragraph [ref=e55]: 空架 · 可留一柄跨轮
    - generic [ref=e56]:
      - generic [ref=e57]:
        - generic [ref=e58]: r1-3 · 镇岳重剑 / 叠纹 +3
        - strong [ref=e59]: "121"
        - generic [ref=e60]: 当前身价 · 收手即可交差
      - generic [ref=e61]:
        - img "镇岳重剑，叠纹，等级3，身价121，完好；外形不影响属性" [ref=e62]
        - button "铁砧 · 鼠标左键直接落锤，无需瞄准或卡时机" [ref=e63]:
          - generic: 鼠标左键 · 直接敲击剑身
      - status [ref=e64]: 剑已归架或取下，身价、裂纹与锤势原样保留。
      - generic [ref=e65]:
        - generic [ref=e66]: 下一锤裂损 5%
        - generic [ref=e67]: 大成 15% · 首次裂损仍能保住剑
      - generic [ref=e68]:
        - generic [ref=e69]: 锤势
        - generic [ref=e77]: 3/6
      - generic:
        - generic: 行脚商人已到炉边
        - generic: 手艺要用一柄剑交换，金币则能升级未来来料或补印记。
      - generic [ref=e78]:
        - button "落锤 左键点剑身 / 空格落锤" [active] [ref=e79] [cursor=pointer]:
          - text: 落锤
          - generic [ref=e80]: 左键点剑身 / 空格落锤
        - button "交差 121" [ref=e81] [cursor=pointer]
        - button "留给下一轮" [ref=e82] [cursor=pointer]
      - generic [ref=e83]:
        - button "回收 · 10金币" [ref=e84] [cursor=pointer]
        - button "收工" [ref=e85] [cursor=pointer]
        - group [ref=e86]:
          - generic "看懂这一锤" [ref=e87] [cursor=pointer]
    - complementary [ref=e88]:
      - generic [ref=e89]:
        - heading "今日委托" [level=2] [ref=e90]
        - img "等候成品的行客" [ref=e91]
        - strong [ref=e92]: 还差 520
        - paragraph [ref=e93]: 交差才计入目标。不要把三柄都花在商人那里。
      - generic [ref=e94]:
        - heading "随身手艺" [level=3] [ref=e95]
        - button "炉心余烬 连锻多一记安全锤" [ref=e97] [cursor=pointer]:
          - generic [ref=e99]:
            - text: 炉心余烬
            - generic [ref=e100]: 连锻多一记安全锤
      - button "行脚商人 · 已到场" [ref=e101] [cursor=pointer]
      - paragraph [ref=e102]: 一柄交差，一柄留后手。再锤一次，还是就此收手？
  - contentinfo [ref=e103]:
    - status
    - button "玩法图解" [ref=e104] [cursor=pointer]
    - group [ref=e105]:
      - generic "声音与动效" [ref=e106] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import type {Page,Locator} from '@playwright/test';
  3  | import {readFileSync} from 'node:fs';
  4  | import {mkdir,writeFile} from 'node:fs/promises';
  5  | import {applyCommand,validateRun,TRAITS} from '../../src/core-v3/index.js';
  6  | import type {Action,RunState} from '../../src/core-v3/index.js';
  7  | const dir='tmp/v3-campaign-states';
  8  | type Route={seed:string;actions:Action[];finalState:RunState};
  9  | const route=JSON.parse(readFileSync('docs/evidence/T11-4-2-3d/route.json','utf8')) as Route;
  10 | const repairRoute=JSON.parse(readFileSync('docs/evidence/T11-4-2-3d/repair-route.json','utf8')) as Route;
  11 | async function read(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));if(!raw)throw Error('No actual v3 save');const result=validateRun(JSON.parse(raw).state);if(!result.ok)throw Error(result.detail);return result.state;}
  12 | async function tabTo(page:Page,target:Locator){for(let i=0;i<100;i++){if(await target.evaluate(e=>e===document.activeElement))return;const back=await target.evaluate(e=>Boolean(document.activeElement&&(document.activeElement.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING)));await page.keyboard.press(back?'Shift+Tab':'Tab');}throw Error('Not keyboard reachable');}
  13 | async function activate(page:Page,target:Locator){await tabTo(page,target);await page.keyboard.press('Enter');}
  14 | const confirm=(page:Page)=>activate(page,page.locator('#v3-dialog-actions').getByRole('button',{name:'确认',exact:true}));
  15 | async function start(page:Page,seed:string){await page.goto('/');await expect(page.locator('#v3-workshop')).toBeVisible();await activate(page,page.locator('#v3-menu'));await tabTo(page,page.locator('#v3-seed'));await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(seed);await expect(page.locator('#v3-mode')).toHaveValue('12');await activate(page,page.getByRole('button',{name:'开一炉新契约'}));await confirm(page);expect((await read(page)).roundLimit).toBe(12);}
  16 | async function snapshot(page:Page,name:string){await mkdir(dir,{recursive:true});await writeFile(`${dir}/${test.info().project.name}-${name}.json`,JSON.stringify(await read(page),null,2)+'\n');}
  17 | async function perform(page:Page,action:Action){
  18 |  const before=await read(page);if('pieceId'in action){if(action.type==='reserve'&&before.reserveId===action.pieceId)await activate(page,page.locator('#v3-reserve-slot button'));else await activate(page,page.locator(`[data-piece="${action.pieceId}"]`));}
  19 |  switch(action.type){
  20 |   case 'strike':await tabTo(page,page.locator('#v3-strike'));await page.keyboard.press('Space');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');break;
  21 |   case 'deliver':await activate(page,page.locator('#v3-deliver'));break;
  22 |   case 'reserve':if(before.reserveId!==action.pieceId)await activate(page,page.locator('#v3-store'));break;
  23 |   case 'scrap':await activate(page,page.locator('#v3-scrap'));await confirm(page);break;
  24 |   case 'settle':await activate(page,page.locator('#v3-settle'));await confirm(page);break;
  25 |   case 'advance':await activate(page,page.getByRole('button',{name:'领取下一轮三柄剑'}));break;
  26 |   case 'claimGift':await activate(page,page.getByRole('button',{name:'首次达标 · 领一门免费手艺'}));await activate(page,page.getByRole('button',{name:action.traitId?new RegExp(`^${TRAITS[action.traitId].name} ·`):'领取40金币'}));break;
  27 |   case 'buy':await activate(page,page.locator('#v3-shop'));await activate(page,page.locator(`article[data-trait="${action.traitId}"] button`));if(action.replaceId)await activate(page,page.getByRole('button',{name:new RegExp(`^换下${TRAITS[action.replaceId].name}：`)}));await confirm(page);break;
  28 |   case 'upgrade':await activate(page,page.locator('#v3-shop'));await activate(page,page.getByRole('button',{name:/升级炉具/}));await expect(page.locator('#v3-dialog-body')).toContainText(`${before.base}→${before.base*2}`);await confirm(page);break;
  29 |   case 'repair':await activate(page,page.locator('#v3-shop'));await activate(page,page.getByRole('button',{name:/补一枚印记/}));await confirm(page);break;
  30 |  }
  31 |  const result=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!result.ok)throw Error(result.error);expect(await read(page)).toEqual(result.state);return result.state;
  32 | }
  33 | test('default twelve-round campaign completes through three merchants, upgrades, replacement and reload with zero pointer events',async({page},info)=>{
  34 |  test.setTimeout(360000);expect(validateRun(route.finalState).ok).toBe(true);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.addInitScript(()=>window.addEventListener('pointerdown',()=>document.documentElement.dataset.pointers=String(Number(document.documentElement.dataset.pointers??0)+1)));
  35 |  await start(page,route.seed);let checkedCancel=false,checkedDetails=false;const prices:number[]=[],seenFour:number[]=[];
  36 |  for(const action of route.actions){const before=await read(page);
  37 |   if(action.type==='buy'&&action.replaceId&&!checkedCancel){await activate(page,page.locator(`[data-piece="${action.pieceId}"]`));await activate(page,page.locator('#v3-shop'));await activate(page,page.locator(`article[data-trait="${action.traitId}"] button`));await activate(page,page.getByRole('button',{name:'保留原样',exact:true}));expect(await read(page)).toEqual(before);checkedCancel=true;}
  38 |   const s=await perform(page,action);
  39 |   if(action.type==='upgrade'){prices.push(before.coins-s.coins);expect(s.blades.filter(b=>b.status==='active').map(b=>b.base)).toEqual(before.blades.filter(b=>b.status==='active').map(b=>b.base));}
  40 |   if(action.type==='advance'){const fresh=s.blades.filter(b=>b.suppliedRound===s.round);expect(fresh).toHaveLength(3);expect(fresh.slice(1).every(b=>b.base===s.base)).toBe(true);if([4,7,10].includes(s.round)){await snapshot(page,`supply-${s.round}`);const bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(bytes);}}
> 41 |   if(action.type==='reserve'&&before.reserveId===action.pieceId&&await page.locator('#v3-inventory button').count()===4){seenFour.push(s.round);for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});const boxes=await page.locator('#v3-inventory button,#v3-strike,#v3-shop,#v3-settings summary').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));expect(boxes).toHaveLength(7);for(const box of boxes){expect(box.width).toBeGreaterThan(0);expect(box.height).toBeGreaterThan(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(height!);}}}
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ^ Error: expect(received).toBeGreaterThan(expected)
  42 |   if(action.type==='buy'){for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});for(const id of ['v3-value','v3-strike','v3-deliver','v3-shop','v3-settings']){const box=await page.locator('#'+id).boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(height!);}await mkdir(dir,{recursive:true});await page.screenshot({path:`${dir}/${info.project.name}-merchant-${s.round}-${width}.png`});}await snapshot(page,`merchant-${s.round}`);}
  43 |   if(!checkedDetails&&s.traits.length){const bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));await activate(page,page.locator('#v3-traits .v3-trait-item').first());await expect(page.locator('#v3-dialog')).toBeVisible();await activate(page,page.getByRole('button',{name:'回铁砧',exact:true}));expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(bytes);checkedDetails=true;}
  44 |  }
  45 |  const s=await read(page);expect(s.phase).toBe('victory');expect(s.round).toBe(12);expect(s.history).toHaveLength(12);expect(s.blades).toHaveLength(36);expect(prices).toEqual([180,900,4500]);expect(checkedCancel).toBe(true);expect(seenFour).toEqual([3,6,9]);expect(Number(await page.locator('html').getAttribute('data-pointers'))).toBe(0);
  46 |  await expect(page.locator('#v3-screen-title')).toHaveText('十二轮契约完成');await expect(page.locator('#v3-screen-body')).not.toContainText('三枚印记用尽');await expect(page.getByRole('button',{name:'领取下一轮三柄剑'})).toHaveCount(0);
  47 |  for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});const box=await page.locator('#v3-screen-actions').boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(height!);await page.screenshot({path:`${dir}/${info.project.name}-victory-${width}.png`});}
  48 |  await snapshot(page,'victory');await activate(page,page.locator('#v3-ledger>summary'));await expect(page.locator('#v3-ledger>table>tbody>tr')).toHaveCount(12);await activate(page,page.locator('.v3-piece-ledger>summary'));await expect(page.locator('.v3-piece-ledger li')).toHaveCount(36);await page.keyboard.press('End');await page.reload();expect((await read(page)).phase).toBe('victory');expect(errors).toEqual([]);
  49 | });
  50 | test('twelve-round failure and merchant repair use real seals and coins',async({page})=>{
  51 |  test.setTimeout(90000);await start(page,repairRoute.seed);const stop=repairRoute.actions.findIndex(a=>a.type==='repair');expect(stop).toBeGreaterThan(0);for(const action of repairRoute.actions.slice(0,stop+1))await perform(page,action);const repaired=await read(page);expect(repaired.repaired).toBe(true);expect(repaired.seals).toBe(3);await snapshot(page,'repaired');
  52 |  await activate(page,page.locator('#v3-menu'));await activate(page,page.getByRole('button',{name:'开一炉新契约'}));await confirm(page);for(let n=0;n<3;n++){await perform(page,{type:'settle'});if(n<2)await perform(page,{type:'advance'});}expect((await read(page)).phase).toBe('defeat');expect((await read(page)).roundLimit).toBe(12);await expect(page.locator('#v3-screen-title')).toHaveText('契约终止');await snapshot(page,'defeat');
  53 | });
  54 | test('existing three-round save stays three rounds; explicit fresh campaign supports twelve and cancel preserves the old bytes',async({page})=>{
  55 |  await page.goto('/?mode=3');await expect(page.locator('#v3-hit')).toBeEnabled();expect((await read(page)).roundLimit).toBe(3);await perform(page,{type:'strike',pieceId:'r1-1'});const old=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));await page.goto('/');await expect(page.locator('#v3-workshop')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(old);await expect(page.locator('#v3-edition')).toContainText('三轮练手');
  56 |  await activate(page,page.locator('#v3-menu'));await expect(page.locator('#v3-mode')).toHaveValue('12');await activate(page,page.getByRole('button',{name:'开一炉新契约'}));await activate(page,page.locator('#v3-dialog-actions').getByRole('button',{name:'返回',exact:true}));expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(old);await activate(page,page.getByRole('button',{name:'开一炉新契约'}));await confirm(page);expect((await read(page)).roundLimit).toBe(12);const twelve=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));await page.goto('/?mode=3');await expect(page.locator('#v3-workshop')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(twelve);await snapshot(page,'mode-continuity');
  57 | });
  58 | 
```