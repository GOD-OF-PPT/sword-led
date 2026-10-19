# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-playable.spec.ts >> real seeded burst survives interruption; crack then break and next-piece action are distinct
- Location: tests/e2e/v3-playable.spec.ts:64:1

# Error details

```
Error: piece_unavailable
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic [ref=f1e5]:
      - text: 锤下求生
      - generic [ref=f1e6]: 行脚灯炉 · v0.4 · 前三轮玩法验证版
    - generic [ref=f1e7]:
      - generic [ref=f1e8]: 第 1 轮 / 前三轮体验
      - generic [ref=f1e9]: 交差 0 / 180
      - progressbar "本轮交差进度" [ref=f1e10]
    - generic [ref=f1e11]: 金币 10 印记 ●●●
    - button "暂停" [ref=f1e12] [cursor=pointer]
    - button "契约" [ref=f1e13] [cursor=pointer]
  - region "保存状态" [ref=f1e14]:
    - status [ref=f1e15]: 本地自动保存
    - button "导出进度" [ref=f1e16] [cursor=pointer]
  - main [ref=f1e17]:
    - complementary [ref=f1e18]:
      - heading "今日三柄" [level=2] [ref=f1e19]
      - generic [ref=f1e20]:
        - button "本轮 · 40" [pressed] [ref=f1e21] [cursor=pointer]
        - button "本轮 · 40" [ref=f1e22] [cursor=pointer]
      - generic [ref=f1e23]:
        - heading "留给明天" [level=3] [ref=f1e24]
        - paragraph [ref=f1e26]: 空架 · 可留一柄跨轮
    - generic [ref=f1e27]:
      - generic [ref=f1e28]:
        - generic [ref=f1e29]: r1-2 · 铁坯 +0
        - strong [ref=f1e30]: "40"
        - generic [ref=f1e31]: 当前身价 · 收手即可交差
      - img "等级0，身价40，完好" [ref=f1e33]
      - status [ref=f1e34]: 断剑回收 · 身价-2,066 · 已按底价回收金币
      - generic [ref=f1e35]:
        - generic [ref=f1e36]: 下一锤裂损 0%
        - generic [ref=f1e37]: 大成 15% · 首次裂损仍能保住剑
      - generic [ref=f1e38]:
        - generic [ref=f1e39]: 锤势
        - generic [ref=f1e47]: 0/6
      - generic [ref=f1e48]:
        - button "落锤 点击 / 空格松开 · 无需卡时机" [active] [ref=f1e49] [cursor=pointer]:
          - text: 落锤
          - generic [ref=f1e50]: 点击 / 空格松开 · 无需卡时机
        - button "交差 40" [ref=f1e51] [cursor=pointer]
        - button "留给下一轮" [ref=f1e52] [cursor=pointer]
      - generic [ref=f1e53]:
        - button "回收 · 10金币" [ref=f1e54] [cursor=pointer]
        - button "收工" [ref=f1e55] [cursor=pointer]
        - group [ref=f1e56]:
          - generic "看懂这一锤" [ref=f1e57]
    - complementary [ref=f1e58]:
      - heading "今日交差" [level=2] [ref=f1e59]
      - img "等候成品的行客" [ref=f1e60]
      - strong [ref=f1e61]: 还差 180
      - paragraph [ref=f1e62]: 交差才计入目标。不要把三柄都花在商人那里。
      - generic [ref=f1e64]:
        - heading "随身手艺" [level=3] [ref=f1e65]
        - paragraph [ref=f1e67]: 先落锤。首次达标后，可免费领一门手艺。
  - contentinfo [ref=f1e68]:
    - status [ref=f1e69]
    - group [ref=f1e70]:
      - generic "声音与动效" [ref=f1e71] [cursor=pointer]
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
> 10 | async function expectCommand(before:RunState,page:Page,action:Action){const expected=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!expected.ok)throw Error(expected.error);const actual=await read(page);expect(actual).toEqual(expected.state);return actual;}
     |                                                                                                                                                                                              ^ Error: piece_unavailable
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
  22 |  expect(contrast).toBeGreaterThanOrEqual(4.5);
  23 | });
  24 | test('first click is live; keyboard has no timing requirement; reduced motion, pause and reload keep results',async({page})=>{
  25 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await expect(page.locator('#v3-value')).toHaveText('40');let s=await strike(page);expect(s.rng.forge.draws).toBe(1);
  26 |  await page.locator('#v3-settings summary').click();await page.locator('#v3-motion').check();await page.locator('#v3-muted').check();await page.locator('#v3-settings summary').click();s=await strike(page,true);expect(s.blades[0]?.hits).toBe(2);
  27 |  await page.locator('#v3-strike').focus();await page.keyboard.down('Enter');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');const oneEnter=await read(page);await page.keyboard.down('Enter');await page.keyboard.up('Enter');expect(await read(page)).toEqual(oneEnter);
  28 |  const before=await read(page);await page.locator('#v3-strike').focus();await page.keyboard.down('Space');await page.keyboard.press('Escape');await page.keyboard.up('Space');expect(await read(page)).toEqual(before);await page.getByRole('button',{name:'继续锻造',exact:true}).click();
  29 |  await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await read(page)).toEqual(before);expect(errors).toEqual([]);await saveState(page,'reload');
  30 | });
  31 | test('actual three rounds, optional gift, insurance, merchant trade and upgrade; honest ending at two desktop sizes',async({page})=>{
  32 |  await open(page);let s=await read(page);
  33 |  // Forge an insurance blade, explicitly store it, then fill today's quota with the other supply.
  34 |  for(let i=0;i<3;i++)s=await strike(page,i%2===1);const stored=s.blades[0]!;let before=s;await page.locator('#v3-store').click();s=await expectCommand(before,page,{type:'reserve',pieceId:stored.id});expect(s.reserveId).toBe(stored.id);
  35 |  for(let round=1;round<=3;round++){
  36 |   s=await read(page);
  37 |   if(round===2){const exact=s.blades.find(b=>b.id===stored.id);expect(exact).toEqual(stored);before=s;await page.locator('#v3-reserve-slot button').click();s=await expectCommand(before,page,{type:'reserve',pieceId:stored.id});}
  38 |   if(round===3){const id=s.shop[0]!;await page.locator('#v3-shop').click();await page.getByRole('button',{name:/用当前剑交换/}).first().click();await expect(page.locator('#v3-dialog-body')).toContainText('将交出');before=await read(page);const selected=(await page.locator('#v3-blade-name').textContent())!.split(' · ')[0]!;await confirm(page);s=await expectCommand(before,page,{type:'buy',pieceId:selected,traitId:id});expect(s.traits).toContain(id);
  39 |    await page.locator('#v3-shop').click();const upgrade=page.getByRole('button',{name:/升级炉具/});if(await upgrade.isEnabled()){await upgrade.click();before=await read(page);await confirm(page);s=await expectCommand(before,page,{type:'upgrade'});expect(s.base).toBe(80);expect(s.blades.filter(b=>b.suppliedRound===3).every(b=>b.base===40)).toBe(true);}else await page.getByRole('button',{name:'回铁砧'}).click();
  40 |   }
  41 |   for(let guard=0;guard<80;guard++){
  42 |    s=await read(page);if(s.delivered>=quotaFor(round))break;const b=s.blades.find(b=>b.status==='active'&&b.id!==s.reserveId);if(!b)break;
  43 |    await page.locator(`[data-piece="${b.id}"]`).click();if(b.value<quotaFor(round)-s.delivered&&!b.cracked){s=await strike(page);continue;}
  44 |    before=s;await page.locator('#v3-deliver').click();s=await expectCommand(before,page,{type:'deliver',pieceId:b.id});
  45 |   }
  46 |   if(round===1){await page.getByRole('button',{name:'首次达标 · 领一门免费手艺'}).click();before=await read(page);await page.getByRole('button',{name:/稳手护符 ·/}).click();s=await expectCommand(before,page,{type:'claimGift',traitId:'steady'});}
  47 |   for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});for(const id of ['v3-value','v3-risk','v3-strike','v3-deliver','v3-settle']){const box=await page.locator('#'+id).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height!);}
  48 |    if(round===3){await mkdir(reports,{recursive:true});await page.screenshot({path:`${reports}/${test.info().project.name}-forge-${width}.png`});}}
  49 |   await saveState(page,`round-${round}`);s=await settle(page);if(round<3)await advance(page);
  50 |  }
  51 |  expect(s.phase).toBe('experienceComplete');expect(s.round).toBe(3);expect(s.blades.filter(b=>b.suppliedRound===4)).toHaveLength(0);await expect(page.locator('#v3-screen-title')).toHaveText('前三轮体验结束');await expect(page.getByRole('button',{name:'领取下一轮三柄剑'})).toHaveCount(0);await saveState(page,'experience-end');
  52 | });
  53 | test('three misses really fail; restart respects a changed seed; invalid main recovers actual backup',async({page})=>{
  54 |  await open(page);for(let i=0;i<3;i++){await settle(page);if(i<2)await advance(page);}expect((await read(page)).phase).toBe('defeat');await expect(page.locator('#v3-screen-title')).toHaveText('契约终止');await page.getByRole('button',{name:'再开一炉'}).click();await page.locator('#v3-seed').fill('restart-new-seed');await page.getByRole('button',{name:'开一炉新契约'}).click();await expect(page.locator('#v3-strike')).toBeEnabled();expect((await read(page)).seed).toBe('restart-new-seed');
  55 |  await strike(page);const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('sword-led.save.backup.v3')!).state);await page.evaluate(()=>localStorage.setItem('sword-led.save.v3','{broken'));await page.reload();await page.locator('#v3-recover').click();await expect(page.locator('#v3-dialog-body')).toContainText('保存于');await confirm(page);expect(await read(page)).toEqual(backup);await saveState(page,'recovered');
  56 | });
  57 | test('same-origin v2 writer blocks v3 safely; write refusal carries exact state into unsaved play',async({page,context})=>{
  58 |  const old=await context.newPage();await old.goto('/v2.html');await expect(old.locator('#v2-new')).toBeEnabled();await old.locator('#v2-new').click();await old.locator('#v2-starters button').first().click();const oldBytes=await old.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  59 |  await page.goto('/');await expect(page.locator('#v3-save-text')).toContainText('只读');await old.close();await page.locator('#v3-reread').click();await confirm(page); // no v3 main exists yet; use the explicit new-game menu
  60 |  await page.getByRole('button',{name:'开一炉新契约'}).click();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(oldBytes);
  61 |  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sword-led.save.v3')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};});
  62 |  const before=await read(page);await page.locator('#v3-strike').click();await expect(page.locator('#v3-save-text')).toContainText('保存失败');expect(await read(page)).toEqual(before);await page.locator('#v3-memory').click();await confirm(page);await expect(page.locator('#v3-save-text')).toContainText('不保存');await expect(page.locator('#v3-value')).not.toHaveText('40');
  63 | });
  64 | test('real seeded burst survives interruption; crack then break and next-piece action are distinct',async({page})=>{
  65 |  await open(page);await page.locator('#v3-menu').click();await page.locator('#v3-seed').fill('path-0');await page.getByRole('button',{name:'开一炉新契约'}).click();await confirm(page);
  66 |  for(let i=0;i<6;i++)await strike(page);await expect(page.locator('#v3-risk')).toContainText('本次无裂损');const before=await read(page);await page.locator('#v3-strike').click();const burst=await expectCommand(before,page,{type:'strike',pieceId:'r1-1'});expect(burst.rng.forge.draws-before.rng.forge.draws).toBe(2);await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await read(page)).toEqual(burst);
  67 |  for(let i=0;i<5;i++)await strike(page);let s=await read(page);expect(s.blades[0]?.cracked).toBe(true);await expect(page.locator('#v3-risk')).toContainText('再裂会断');await saveState(page,'cracked');await mkdir(reports,{recursive:true});await page.screenshot({path:`${reports}/${test.info().project.name}-cracked.png`});
  68 |  s=await strike(page);expect(s.blades[0]?.status).toBe('broken');await expect(page.locator('#v3-risk')).toContainText('已断');const rev=s.revision;await page.locator('#v3-strike').click();expect((await read(page)).revision).toBe(rev);await expect(page.locator('#v3-blade-name')).toContainText('r1-2');await saveState(page,'broken');
  69 | });
  70 | async function tabTo(page:Page,target:Locator){for(let i=0;i<100;i++){if(await target.evaluate(e=>e===document.activeElement))return;const backwards=await target.evaluate(e=>Boolean(document.activeElement&&(document.activeElement.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING)));await page.keyboard.press(backwards?'Shift+Tab':'Tab');}throw Error('Control not keyboard reachable');}
  71 | async function activateKey(page:Page,target:Locator){await tabTo(page,target);await page.keyboard.press('Enter');}
  72 | test('keyboard completes all three rounds with zero pointer events and no timing recipe',async({page})=>{
  73 |  await page.addInitScript(()=>window.addEventListener('pointerdown',()=>{document.documentElement.dataset.v3Pointers=String(Number(document.documentElement.dataset.v3Pointers??0)+1);}));await open(page);let s=await read(page);
  74 |  for(let round=1;round<=3;round++){
  75 |   for(let guard=0;guard<75;guard++){
  76 |    s=await read(page);if(s.delivered>=quotaFor(round))break;const b=s.blades.find(p=>p.status==='active'&&p.id!==s.reserveId);if(!b)break;
  77 |    await activateKey(page,page.locator(`[data-piece="${b.id}"]`));
  78 |    if(b.value<quotaFor(round)-s.delivered&&!b.cracked){await tabTo(page,page.locator('#v3-strike'));await page.keyboard.press('Space');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');}
  79 |    else await activateKey(page,page.locator('#v3-deliver'));
  80 |   }
  81 |   await activateKey(page,page.locator('#v3-settle'));await activateKey(page,page.locator('#v3-dialog-actions').getByRole('button',{name:'确认',exact:true}));if(round<3)await activateKey(page,page.getByRole('button',{name:'领取下一轮三柄剑'}));
  82 |  }
  83 |  s=await read(page);expect(s.phase).toBe('experienceComplete');expect(s.round).toBe(3);expect(Number(await page.locator('html').getAttribute('data-v3-pointers'))).toBe(0);await saveState(page,'keyboard-end');
  84 | });
  85 | 
```