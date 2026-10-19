# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-scene.spec.ts >> resizing four actual inventory pieces preserves the focused sword node and exact saved bytes
- Location: tests/e2e/v3-scene.spec.ts:10:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - text: 锤下求生
      - generic [ref=e6]: 行脚灯炉 · 三轮练手
    - generic [ref=e7]:
      - generic [ref=e8]: 第 2 / 3 轮 · 练手
      - generic [ref=e9]: 交差 0 / 300
      - progressbar "本轮交差进度" [ref=e10]
      - list "本局契约旅程" [ref=e12]:
        - listitem "第1轮失约" [ref=e13]: "1"
        - listitem "第2轮当前" [ref=e14]: "2"
        - listitem "第3轮，商人到访" [ref=e15]: "3"
    - generic [ref=e16]:
      - generic [ref=e17]: 金币 20
      - generic "契约印记 2/3" [ref=e18]:
        - generic [aria-hidden] [ref=e19]: 契
        - generic [aria-hidden] [ref=e20]: 契
        - generic [aria-hidden] [ref=e21]: 契
    - button "暂停" [ref=e22] [cursor=pointer]
    - button "契约" [ref=e23] [cursor=pointer]
  - region "保存状态" [ref=e24]:
    - status [ref=e25]: 本地自动保存
    - button "导出进度" [ref=e26] [cursor=pointer]
  - main [ref=e27]:
    - complementary [ref=e28]:
      - heading "今日三柄" [level=2] [ref=e29]
      - generic [ref=e30]:
        - button "青云剑 上轮 · 40" [pressed] [ref=e31] [cursor=pointer]:
          - generic [ref=e32]: 青云剑
          - generic [ref=e33]: 上轮 · 40
        - button "青云剑 本轮 · 40" [ref=e34] [cursor=pointer]:
          - generic [ref=e35]: 青云剑
          - generic [ref=e36]: 本轮 · 40
        - button "赤羽刀 本轮 · 40" [ref=e37] [cursor=pointer]:
          - generic [ref=e38]: 赤羽刀
          - generic [ref=e39]: 本轮 · 40
        - button "镇岳重剑 本轮 · 40" [ref=e40] [cursor=pointer]:
          - generic [ref=e41]: 镇岳重剑
          - generic [ref=e42]: 本轮 · 40
      - generic [ref=e43]:
        - heading "留给明天" [level=3] [ref=e44]
        - paragraph [ref=e46]: 空架 · 可留一柄跨轮
    - generic [ref=e47]:
      - generic [ref=e48]:
        - generic [ref=e49]: r1-1 · 青云剑 / 乌铁坯 +0
        - strong [ref=e50]: "40"
        - generic [ref=e51]: 当前身价 · 收手即可交差
      - generic [ref=e52]:
        - img "青云剑，乌铁坯，等级0，身价40，完好；外形不影响属性" [ref=e53]
        - button "铁砧 · 鼠标左键直接落锤，无需瞄准或卡时机" [ref=e54]:
          - generic: 鼠标左键 · 直接敲击剑身
      - status [ref=e55]: 剑已归架或取下，身价、裂纹与锤势原样保留。
      - generic [ref=e56]:
        - generic [ref=e57]: 下一锤裂损 0%
        - generic [ref=e58]: 大成 15% · 首次裂损仍能保住剑
      - generic [ref=e59]:
        - generic [ref=e60]: 锤势
        - generic [ref=e68]: 0/6
      - generic:
        - generic: 再锤一记，还是收手？
        - generic: 看好下方裂损风险。交差保住今天，挂剑为下一轮留后手。
      - generic [ref=e69]:
        - button "落锤 左键点剑身 / 空格落锤" [ref=e70] [cursor=pointer]:
          - text: 落锤
          - generic [ref=e71]: 左键点剑身 / 空格落锤
        - button "交差 40" [ref=e72] [cursor=pointer]
        - button "留给下一轮" [ref=e73] [cursor=pointer]
      - generic [ref=e74]:
        - button "回收 · 10金币" [ref=e75] [cursor=pointer]
        - button "收工" [ref=e76] [cursor=pointer]
        - group [ref=e77]:
          - generic "看懂这一锤" [ref=e78] [cursor=pointer]
    - complementary [ref=e79]:
      - generic [ref=e80]:
        - heading "今日委托" [level=2] [ref=e81]
        - img "等候成品的行客" [ref=e82]
        - strong [ref=e83]: 还差 300
        - paragraph [ref=e84]: 交差才计入目标。不要把三柄都花在商人那里。
      - generic [ref=e85]:
        - heading "随身手艺" [level=3] [ref=e86]
        - paragraph [ref=e88]:
          - generic [ref=e90]: 首次达标 · 免费领手艺
      - paragraph [ref=e91]: 一柄交差，一柄留后手。再锤一次，还是就此收手？
  - contentinfo [ref=e92]:
    - status
    - button "玩法图解" [ref=e93] [cursor=pointer]
    - group [ref=e94]:
      - generic "声音与动效" [ref=e95] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import type {Page} from '@playwright/test';
  3  | import {mkdir,writeFile} from 'node:fs/promises';
  4  | import {applyCommand,validateRun} from '../../src/core-v3/index.js';
  5  | const dir='tmp/v3-scene-states';
  6  | async function read(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));const v=validateRun(JSON.parse(raw!).state);if(!v.ok)throw Error(v.detail);return v.state;}
  7  | async function open(page:Page){await mkdir(dir,{recursive:true});await page.goto('/?mode=3');await expect(page.locator('#v3-hit')).toBeEnabled();}
  8  | async function hit(page:Page){const before=await read(page),pieceId=(await page.locator('#v3-blade-name').textContent())!.split(' · ')[0]!;await page.locator('#v3-hit').click({position:{x:400,y:120}});const r=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'strike',pieceId}});if(!r.ok)throw Error(r.error);expect(await read(page)).toEqual(r.state);await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');}
  9  | async function qualify(page:Page){for(let n=0;n<8&&(await read(page)).blades[0]!.value<180;n++)await hit(page);expect((await read(page)).blades[0]!.value).toBeGreaterThanOrEqual(180);}
  10 | test('resizing four actual inventory pieces preserves the focused sword node and exact saved bytes',async({page},info)=>{
  11 |  await page.setViewportSize({width:1280,height:720});await open(page);await page.locator('#v3-store').click();await page.locator('#v3-settle').click();await page.getByRole('button',{name:'确认',exact:true}).click();await page.getByRole('button',{name:'领取下一轮三柄剑'}).click();await page.locator('#v3-reserve-slot button').click();await expect(page.locator('#v3-inventory button')).toHaveCount(4);await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');const target=page.locator('#v3-inventory button').last();await expect(target).toBeFocused();const original=await target.elementHandle(),bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));const samples=[];
> 12 |  for(const [width,height]of [[1920,1080],[1280,720]]){await page.setViewportSize({width:width!,height:height!});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));expect(await original!.evaluate(e=>e.isConnected)).toBe(true);await expect(target).toBeFocused();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(bytes);const boxes=await page.evaluate(()=>Array.from(document.querySelectorAll('#v3-inventory button')).map(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};}));expect(boxes).toHaveLength(4);for(const b of boxes){expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);expect(b.y+b.height).toBeLessThanOrEqual(height!);}samples.push({width,height,boxes});}
     |                                                                                                                                                                                                                                                                                         ^ Error: expect(received).toBe(expected) // Object.is equality
  13 |  await writeFile(`${dir}/${info.project.name}-resize-focus.json`,JSON.stringify({samples,state:await read(page)},null,2)+'\n');
  14 | });
  15 | test('physical workshop and three-step guide stay readable; help is optional and never changes a save',async({page},info)=>{
  16 |  await open(page);await mkdir(dir,{recursive:true});await expect(page.locator('#v3-coach')).toContainText('第一锤');await expect(page.locator('.v3-journey li')).toHaveCount(3);const bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));
  17 |  for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});expect(await page.locator('.v3-rack').evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('0px');expect(await page.locator('.v3-commission').evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('guild-scroll-v1.webp');for(const sel of ['#v3-hit','#v3-strike','#v3-deliver','#v3-store','#v3-settle','#v3-help','#v3-settings summary']){const b=await page.locator(sel).boundingBox();expect(b).not.toBeNull();expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.y+b!.height).toBeLessThanOrEqual(height!);}await page.screenshot({path:`${dir}/${info.project.name}-workshop-${width}.png`});}
  18 |  await page.locator('#v3-help').click();await expect(page.locator('.v3-help-story section')).toHaveCount(3);await expect(page.locator('#v3-dialog')).toHaveAttribute('data-kind','help');await page.screenshot({path:`${dir}/${info.project.name}-help.png`});await page.getByRole('button',{name:'回铁砧',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(bytes);
  19 | });
  20 | test('accepted delivery has real sword flight, quota stamp, and honest pieces on the round receipt',async({page},info)=>{
  21 |  await open(page);await qualify(page);await expect(page.locator('#v3-coach')).toContainText('足够交差');const before=await read(page);await page.locator('#v3-deliver').click();await expect(page.locator('[data-scene-cue="met"]')).toBeVisible();await expect(page.locator('[data-scene-cue="delivery"] canvas')).toHaveCount(1);const actual=await read(page),r=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'deliver',pieceId:'r1-1'}});if(!r.ok)throw Error(r.error);expect(actual).toEqual(r.state);await expect(page.locator('#v3-coach')).toContainText('委托已成');await page.screenshot({path:`${dir}/${info.project.name}-met.png`});
  22 |  await page.locator('#v3-settle').click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.locator('.v3-receipt-stamp')).toHaveText('委托达成');await expect(page.locator('[data-story-piece]')).toHaveCount(3);const ids=await page.locator('[data-story-piece]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLElement).dataset.storyPiece));expect(ids).toEqual(['r1-1','r1-2','r1-3']);await page.screenshot({path:`${dir}/${info.project.name}-receipt.png`});await writeFile(`${dir}/${info.project.name}-receipt.json`,JSON.stringify(await read(page),null,2)+'\n');await page.getByRole('button',{name:'领取下一轮三柄剑'}).click();await expect(page.locator('[data-scene-cue="round"]')).toContainText('第 2 轮');await page.reload();await expect(page.locator('#v3-hit')).toBeEnabled();expect(await page.locator('#v3-feedback-layer').locator('*').count()).toBe(0);
  23 | });
  24 | test('ceremony cancels on pause; reduced motion and rapid return never replay rewards or leave flying objects',async({page})=>{
  25 |  await open(page);await qualify(page);await page.locator('#v3-deliver').click();const bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));await page.keyboard.press('Escape');await expect(page.locator('#v3-feedback-layer')).toBeEmpty();await page.waitForTimeout(1800);expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'))).toBe(bytes);await page.getByRole('button',{name:'继续锻造',exact:true}).click();await page.locator('#v3-settings summary').click();await page.locator('#v3-motion').check();await page.locator('#v3-settings summary').click();await page.locator('#v3-store').click();await expect(page.locator('[data-scene-cue="reserve"]')).toBeVisible();expect(await page.locator('#v3-feedback-layer').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);expect(await page.locator('.v3-flying-blade').count()).toBe(0);const after=await read(page);await page.locator('#v3-menu').click();await expect(page.locator('#v3-feedback-layer')).toBeEmpty();await page.getByRole('button',{name:'返回当前进度'}).click();expect(await read(page)).toEqual(after);await page.waitForTimeout(1000);await expect(page.locator('#v3-feedback-layer')).toBeEmpty();
  26 | });
  27 | test('merchant staging and terminal trophies use actual props and blades; all story controls fit the small viewport',async({page},info)=>{
  28 |  await page.setViewportSize({width:1280,height:720});await open(page);for(let n=0;n<2;n++){await page.locator('#v3-settle').click();await page.getByRole('button',{name:'确认',exact:true}).click();await page.getByRole('button',{name:'领取下一轮三柄剑'}).click();}await page.locator('#v3-shop').click();await expect(page.locator('#v3-dialog')).toHaveAttribute('data-kind','merchant');await expect(page.locator('.v3-trader-portrait')).toBeVisible();await expect(page.locator('.v3-shop-grid article')).toHaveCount(2);await page.screenshot({path:`${dir}/${info.project.name}-merchant.png`});await page.getByRole('button',{name:'回铁砧',exact:true}).click();await page.locator('#v3-settle').click();await page.getByRole('button',{name:'确认',exact:true}).click();await expect(page.locator('#v3-screen-title')).toHaveText('契约终止');await expect(page.locator('.v3-end-hero [data-story-piece]')).toHaveCount(1);for(const button of await page.locator('#v3-screen-actions button').all()){const b=await button.boundingBox();expect(b!.y+b!.height).toBeLessThanOrEqual(720);}await page.screenshot({path:`${dir}/${info.project.name}-defeat.png`});await writeFile(`${dir}/${info.project.name}-defeat.json`,JSON.stringify(await read(page),null,2)+'\n');
  29 | });
  30 | 
```