# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-playable.spec.ts >> primary hammer remains readable while hovered
- Location: tests/e2e/v3-playable.spec.ts:19:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 4.5
Received:    1.621405988933796
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - text: 锤下求生
      - generic [ref=e6]: 行脚灯炉 · v0.4 · 前三轮玩法验证版
    - generic [ref=e7]:
      - generic [ref=e8]: 第 1 轮 / 前三轮体验
      - generic [ref=e9]: 交差 0 / 180
      - progressbar "本轮交差进度" [ref=e10]
    - generic [ref=e11]: 金币 0 印记 ●●●
    - button "暂停" [ref=e12] [cursor=pointer]
    - button "契约" [ref=e13] [cursor=pointer]
  - region "保存状态" [ref=e14]:
    - status [ref=e15]: 本地自动保存
    - button "导出进度" [ref=e16] [cursor=pointer]
  - main [ref=e17]:
    - complementary [ref=e18]:
      - heading "今日三柄" [level=2] [ref=e19]
      - generic [ref=e20]:
        - button "本轮 · 40" [pressed] [ref=e21] [cursor=pointer]
        - button "本轮 · 40" [ref=e22] [cursor=pointer]
        - button "本轮 · 40" [ref=e23] [cursor=pointer]
      - generic [ref=e24]:
        - heading "留给明天" [level=3] [ref=e25]
        - paragraph [ref=e27]: 空架 · 可留一柄跨轮
    - generic [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]: r1-1 · 铁坯 +0
        - strong [ref=e31]: "40"
        - generic [ref=e32]: 当前身价 · 收手即可交差
      - img "等级0，身价40，完好" [ref=e34]
      - status [ref=e35]: 第一柄已就位。落一锤，看看它能值多少。
      - generic [ref=e36]:
        - generic [ref=e37]: 下一锤裂损 0%
        - generic [ref=e38]: 大成 15% · 首次裂损仍能保住剑
      - generic [ref=e39]:
        - generic [ref=e40]: 锤势
        - generic [ref=e48]: 0/6
      - generic [ref=e49]:
        - button "落锤 点击 / 空格松开 · 无需卡时机" [active] [ref=e50] [cursor=pointer]:
          - text: 落锤
          - generic [ref=e51]: 点击 / 空格松开 · 无需卡时机
        - button "交差 40" [ref=e52] [cursor=pointer]
        - button "留给下一轮" [ref=e53] [cursor=pointer]
      - generic [ref=e54]:
        - button "回收 · 10金币" [ref=e55] [cursor=pointer]
        - button "收工" [ref=e56] [cursor=pointer]
        - group [ref=e57]:
          - generic "看懂这一锤" [ref=e58]
    - complementary [ref=e59]:
      - heading "今日交差" [level=2] [ref=e60]
      - img "等候成品的行客" [ref=e61]
      - strong [ref=e62]: 还差 180
      - paragraph [ref=e63]: 交差才计入目标。不要把三柄都花在商人那里。
      - generic [ref=e65]:
        - heading "随身手艺" [level=3] [ref=e66]
        - paragraph [ref=e68]: 先落锤。首次达标后，可免费领一门手艺。
  - contentinfo [ref=e69]:
    - status [ref=e70]
    - group [ref=e71]:
      - generic "声音与动效" [ref=e72] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import type {Page,Locator} from '@playwright/test';
  3  | import {applyCommand,validateRun,quotaFor} from '../../src/core-v3/index.js';
  4  | import type {Action,RunState} from '../../src/core-v3/index.js';
  5  | import {writeFile,mkdir} from 'node:fs/promises';
  6  | const reports='tmp/v3-ui-states';
  7  | test.beforeEach(async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});(page as Page&{v3Errors:string[]}).v3Errors=errors;});
  8  | test.afterEach(async({page})=>{expect((page as Page&{v3Errors:string[]}).v3Errors).toEqual([]);});
  9  | async function read(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));if(!raw)throw Error('Missing v3 actual save');const r=validateRun(JSON.parse(raw).state);if(!r.ok)throw Error(r.detail);return r.state;}
  10 | async function expectCommand(before:RunState,page:Page,action:Action){const expected=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!expected.ok)throw Error(expected.error);const actual=await read(page);expect(actual).toEqual(expected.state);return actual;}
  11 | async function strike(page:Page,keyboard=false){const before=await read(page),id=await page.locator('#v3-blade-name').textContent(),pieceId=id?.split(' · ')[0];if(!pieceId)throw Error('no blade');
  12 |  if(keyboard){await page.locator('#v3-strike').focus();await page.keyboard.press('Space');}else await page.locator('#v3-strike').click();
  13 |  const s=await expectCommand(before,page,{type:'strike',pieceId});await expect(page.locator('#v3-value')).toHaveText(s.blades.find(b=>b.id===pieceId)!.value.toLocaleString('zh-CN'));await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');return s;}
  14 | async function confirm(page:Page){await expect(page.locator('#v3-dialog')).toBeVisible();await page.locator('#v3-dialog-actions').getByRole('button',{name:'确认',exact:true}).click();}
  15 | async function settle(page:Page){const before=await read(page);await page.locator('#v3-settle').click();await confirm(page);return expectCommand(before,page,{type:'settle'});}
  16 | async function advance(page:Page){const before=await read(page);await page.getByRole('button',{name:'领取下一轮三柄剑'}).click();return expectCommand(before,page,{type:'advance'});}
  17 | async function open(page:Page){await page.goto('/');await expect(page.locator('#v3-strike')).toBeEnabled();await expect(page.locator('#v3-workshop')).toBeVisible();}
  18 | async function saveState(page:Page,label:string){const s=await read(page);await mkdir(reports,{recursive:true});await writeFile(`${reports}/${test.info().project.name}-${label}.json`,JSON.stringify(s,null,2)+'\n');}
  19 | test('primary hammer remains readable while hovered',async({page})=>{
  20 |  await open(page);await page.locator('#v3-strike').hover();
  21 |  const contrast=await page.locator('#v3-strike').evaluate(b=>{const s=getComputedStyle(b),luminance=(value:string)=>{const channels=(value.match(/[\d.]+/g)??[]).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*channels[0]!+.7152*channels[1]!+.0722*channels[2]!;};const a=luminance(s.color),c=luminance(s.backgroundColor);return(Math.max(a,c)+.05)/(Math.min(a,c)+.05);});
> 22 |  expect(contrast).toBeGreaterThanOrEqual(4.5);
     |                   ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  23 | });
  24 | test('first click is live; keyboard has no timing requirement; reduced motion, pause and reload keep results',async({page})=>{
  25 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await expect(page.locator('#v3-value')).toHaveText('40');let s=await strike(page);expect(s.rng.forge.draws).toBe(1);
  26 |  await page.locator('#v3-settings summary').click();await page.locator('#v3-motion').check();await page.locator('#v3-muted').check();await page.locator('#v3-settings summary').click();s=await strike(page,true);expect(s.blades[0]?.hits).toBe(2);
  27 |  const before=await read(page);await page.locator('#v3-strike').focus();await page.keyboard.down('Space');await page.keyboard.press('Escape');await page.keyboard.up('Space');expect(await read(page)).toEqual(before);await page.getByRole('button',{name:'继续锻造',exact:true}).click();
  28 |  await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await read(page)).toEqual(before);expect(errors).toEqual([]);await saveState(page,'reload');
  29 | });
  30 | test('actual three rounds, optional gift, insurance, merchant trade and upgrade; honest ending at two desktop sizes',async({page})=>{
  31 |  await open(page);let s=await read(page);
  32 |  // Forge an insurance blade, explicitly store it, then fill today's quota with the other supply.
  33 |  for(let i=0;i<3;i++)s=await strike(page,i%2===1);const stored=s.blades[0]!;let before=s;await page.locator('#v3-store').click();s=await expectCommand(before,page,{type:'reserve',pieceId:stored.id});expect(s.reserveId).toBe(stored.id);
  34 |  for(let round=1;round<=3;round++){
  35 |   s=await read(page);
  36 |   if(round===2){const exact=s.blades.find(b=>b.id===stored.id);expect(exact).toEqual(stored);before=s;await page.locator('#v3-reserve-slot button').click();s=await expectCommand(before,page,{type:'reserve',pieceId:stored.id});}
  37 |   if(round===3){const id=s.shop[0]!;await page.locator('#v3-shop').click();await page.getByRole('button',{name:/用当前剑交换/}).first().click();await expect(page.locator('#v3-dialog-body')).toContainText('将交出');before=await read(page);const selected=(await page.locator('#v3-blade-name').textContent())!.split(' · ')[0]!;await confirm(page);s=await expectCommand(before,page,{type:'buy',pieceId:selected,traitId:id});expect(s.traits).toContain(id);
  38 |    await page.locator('#v3-shop').click();const upgrade=page.getByRole('button',{name:/升级炉具/});if(await upgrade.isEnabled()){await upgrade.click();before=await read(page);await confirm(page);s=await expectCommand(before,page,{type:'upgrade'});expect(s.base).toBe(80);expect(s.blades.filter(b=>b.suppliedRound===3).every(b=>b.base===40)).toBe(true);}else await page.getByRole('button',{name:'回铁砧'}).click();
  39 |   }
  40 |   for(let guard=0;guard<80;guard++){
  41 |    s=await read(page);if(s.delivered>=quotaFor(round))break;const b=s.blades.find(b=>b.status==='active'&&b.id!==s.reserveId);if(!b)break;
  42 |    await page.locator(`[data-piece="${b.id}"]`).click();if(b.value<quotaFor(round)-s.delivered&&!b.cracked){s=await strike(page);continue;}
  43 |    before=s;await page.locator('#v3-deliver').click();s=await expectCommand(before,page,{type:'deliver',pieceId:b.id});
  44 |   }
  45 |   if(round===1){await page.getByRole('button',{name:'首次达标 · 领一门免费手艺'}).click();before=await read(page);await page.getByRole('button',{name:/稳手护符 ·/}).click();s=await expectCommand(before,page,{type:'claimGift',traitId:'steady'});}
  46 |   for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});for(const id of ['v3-value','v3-risk','v3-strike','v3-deliver','v3-settle']){const box=await page.locator('#'+id).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height!);}
  47 |    if(round===3){await mkdir(reports,{recursive:true});await page.screenshot({path:`${reports}/${test.info().project.name}-forge-${width}.png`});}}
  48 |   await saveState(page,`round-${round}`);s=await settle(page);if(round<3)await advance(page);
  49 |  }
  50 |  expect(s.phase).toBe('experienceComplete');expect(s.round).toBe(3);expect(s.blades.filter(b=>b.suppliedRound===4)).toHaveLength(0);await expect(page.locator('#v3-screen-title')).toHaveText('前三轮体验结束');await expect(page.getByRole('button',{name:'领取下一轮三柄剑'})).toHaveCount(0);await saveState(page,'experience-end');
  51 | });
  52 | test('three misses really fail; restart respects a changed seed; invalid main recovers actual backup',async({page})=>{
  53 |  await open(page);for(let i=0;i<3;i++){await settle(page);if(i<2)await advance(page);}expect((await read(page)).phase).toBe('defeat');await expect(page.locator('#v3-screen-title')).toHaveText('契约终止');await page.getByRole('button',{name:'再开一炉'}).click();await page.locator('#v3-seed').fill('restart-new-seed');await page.getByRole('button',{name:'开一炉新契约'}).click();await expect(page.locator('#v3-strike')).toBeEnabled();expect((await read(page)).seed).toBe('restart-new-seed');
  54 |  await strike(page);const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('sword-led.save.backup.v3')!).state);await page.evaluate(()=>localStorage.setItem('sword-led.save.v3','{broken'));await page.reload();await page.locator('#v3-recover').click();await expect(page.locator('#v3-dialog-body')).toContainText('保存于');await confirm(page);expect(await read(page)).toEqual(backup);await saveState(page,'recovered');
  55 | });
  56 | test('same-origin v2 writer blocks v3 safely; write refusal carries exact state into unsaved play',async({page,context})=>{
  57 |  const old=await context.newPage();await old.goto('/v2.html');await expect(old.locator('#v2-new')).toBeEnabled();await old.locator('#v2-new').click();await old.locator('#v2-starters button').first().click();const oldBytes=await old.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  58 |  await page.goto('/');await expect(page.locator('#v3-save-text')).toContainText('只读');await old.close();await page.locator('#v3-reread').click();await confirm(page); // no v3 main exists yet; use the explicit new-game menu
  59 |  await page.getByRole('button',{name:'开一炉新契约'}).click();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(oldBytes);
  60 |  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sword-led.save.v3')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};});
  61 |  const before=await read(page);await page.locator('#v3-strike').click();await expect(page.locator('#v3-save-text')).toContainText('保存失败');expect(await read(page)).toEqual(before);await page.locator('#v3-memory').click();await confirm(page);await expect(page.locator('#v3-save-text')).toContainText('不保存');await expect(page.locator('#v3-value')).not.toHaveText('40');
  62 | });
  63 | test('real seeded burst survives interruption; crack then break and next-piece action are distinct',async({page})=>{
  64 |  await open(page);await page.locator('#v3-menu').click();await page.locator('#v3-seed').fill('path-0');await page.getByRole('button',{name:'开一炉新契约'}).click();await confirm(page);
  65 |  for(let i=0;i<6;i++)await strike(page);await expect(page.locator('#v3-risk')).toContainText('本次无裂损');const before=await read(page);await page.locator('#v3-strike').click();const burst=await expectCommand(before,page,{type:'strike',pieceId:'r1-1'});expect(burst.rng.forge.draws-before.rng.forge.draws).toBe(2);await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await read(page)).toEqual(burst);
  66 |  for(let i=0;i<5;i++)await strike(page);let s=await read(page);expect(s.blades[0]?.cracked).toBe(true);await expect(page.locator('#v3-risk')).toContainText('再裂会断');await saveState(page,'cracked');await mkdir(reports,{recursive:true});await page.screenshot({path:`${reports}/${test.info().project.name}-cracked.png`});
  67 |  s=await strike(page);expect(s.blades[0]?.status).toBe('broken');await expect(page.locator('#v3-risk')).toContainText('已断');const rev=s.revision;await page.locator('#v3-strike').click();expect((await read(page)).revision).toBe(rev);await expect(page.locator('#v3-blade-name')).toContainText('r1-2');await saveState(page,'broken');
  68 | });
  69 | async function tabTo(page:Page,target:Locator){for(let i=0;i<100;i++){if(await target.evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Control not keyboard reachable');}
  70 | async function activateKey(page:Page,target:Locator){await tabTo(page,target);await page.keyboard.press('Enter');}
  71 | test('keyboard completes all three rounds with zero pointer events and no timing recipe',async({page})=>{
  72 |  await page.addInitScript(()=>window.addEventListener('pointerdown',()=>{document.documentElement.dataset.v3Pointers=String(Number(document.documentElement.dataset.v3Pointers??0)+1);}));await open(page);let s=await read(page);
  73 |  for(let round=1;round<=3;round++){
  74 |   for(let guard=0;guard<75;guard++){
  75 |    s=await read(page);if(s.delivered>=quotaFor(round))break;const b=s.blades.find(p=>p.status==='active'&&p.id!==s.reserveId);if(!b)break;
  76 |    await activateKey(page,page.locator(`[data-piece="${b.id}"]`));
  77 |    if(b.value<quotaFor(round)-s.delivered&&!b.cracked){await tabTo(page,page.locator('#v3-strike'));await page.keyboard.press('Space');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');}
  78 |    else await activateKey(page,page.locator('#v3-deliver'));
  79 |   }
  80 |   await activateKey(page,page.locator('#v3-settle'));await activateKey(page,page.locator('#v3-dialog-actions').getByRole('button',{name:'确认',exact:true}));if(round<3)await activateKey(page,page.getByRole('button',{name:'领取下一轮三柄剑'}));
  81 |  }
  82 |  s=await read(page);expect(s.phase).toBe('experienceComplete');expect(s.round).toBe(3);expect(Number(await page.locator('html').getAttribute('data-v3-pointers'))).toBe(0);await saveState(page,'keyboard-end');
  83 | });
  84 | 
```