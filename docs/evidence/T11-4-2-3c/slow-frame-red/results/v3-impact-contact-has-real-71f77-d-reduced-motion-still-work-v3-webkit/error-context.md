# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-impact.spec.ts >> contact has real particles, ring, blade recoil and distinct native percussive sound; mute and reduced motion still work
- Location: tests/e2e/v3-impact.spec.ts:19:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 6
Received:   23.75051631561444
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - text: 锤下求生
      - generic [ref=e6]: 行脚灯炉 · v0.4 锻锤修正版 · 前三轮
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
        - button "青云剑 本轮 · 58" [pressed] [ref=e21] [cursor=pointer]:
          - generic [ref=e22]: 青云剑
          - generic [ref=e23]: 本轮 · 58
        - button "赤羽刀 本轮 · 40" [ref=e24] [cursor=pointer]:
          - generic [ref=e25]: 赤羽刀
          - generic [ref=e26]: 本轮 · 40
        - button "镇岳重剑 本轮 · 40" [ref=e27] [cursor=pointer]:
          - generic [ref=e28]: 镇岳重剑
          - generic [ref=e29]: 本轮 · 40
      - generic [ref=e30]:
        - heading "留给明天" [level=3] [ref=e31]
        - paragraph [ref=e33]: 空架 · 可留一柄跨轮
    - generic [ref=e34]:
      - generic [ref=e35]:
        - generic [ref=e36]: r1-1 · 青云剑 / 初开锋 +1
        - strong [ref=e37]: "58"
        - generic [ref=e38]: 当前身价 · 收手即可交差
      - generic [ref=e39]:
        - img "青云剑，初开锋，等级1，身价58，完好；外形不影响属性" [ref=e40]
        - button "铁砧 · 鼠标左键直接落锤，无需瞄准或卡时机" [active] [ref=e41]:
          - generic: 鼠标左键 · 直接敲击剑身
      - status [ref=e42]: 锻成 · 身价+18
      - generic [ref=e43]:
        - generic [ref=e44]: 下一锤裂损 0%
        - generic [ref=e45]: 大成 15% · 首次裂损仍能保住剑
      - generic [ref=e46]:
        - generic [ref=e47]: 锤势
        - generic [ref=e55]: 1/6
      - generic [ref=e56]:
        - button "落锤 左键点剑身 / 空格落锤" [ref=e57] [cursor=pointer]:
          - text: 落锤
          - generic [ref=e58]: 左键点剑身 / 空格落锤
        - button "交差 58" [ref=e59] [cursor=pointer]
        - button "留给下一轮" [ref=e60] [cursor=pointer]
      - generic [ref=e61]:
        - button "回收 · 10金币" [ref=e62] [cursor=pointer]
        - button "收工" [ref=e63] [cursor=pointer]
        - group [ref=e64]:
          - generic "看懂这一锤" [ref=e65]
    - complementary [ref=e66]:
      - heading "今日交差" [level=2] [ref=e67]
      - img "等候成品的行客" [ref=e68]
      - strong [ref=e69]: 还差 180
      - paragraph [ref=e70]: 交差才计入目标。不要把三柄都花在商人那里。
      - generic [ref=e72]:
        - heading "随身手艺" [level=3] [ref=e73]
        - paragraph [ref=e75]:
          - generic [ref=e77]: 首次达标 · 免费领手艺
  - contentinfo [ref=e78]:
    - status [ref=e79]
    - group [ref=e80]:
      - generic "声音与动效" [ref=e81] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import type {Page} from '@playwright/test';
  3  | import {applyCommand,validateRun} from '../../src/core-v3/index.js';
  4  | import {installAudioProbe,audioProbe} from './audio-probe';
  5  | import {installHammerProbe} from './hammer-probe';
  6  | import {mkdir,writeFile} from 'node:fs/promises';
  7  | const dir='tmp/v3-impact-states';
  8  | async function read(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));if(!raw)throw Error('No actual save');const r=validateRun(JSON.parse(raw).state);if(!r.ok)throw Error(r.detail);return r.state;}
  9  | async function open(page:Page){await page.goto('/');await expect(page.locator('#v3-hit')).toBeEnabled();}
  10 | async function point(page:Page,x=.62,y=.6){const box=await page.locator('#v3-hit').boundingBox();if(!box)throw Error('No hit area');return{x:box.x+box.width*x,y:box.y+box.height*y};}
  11 | async function left(page:Page){const before=await read(page),p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.down();const expected=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'strike',pieceId:'r1-1'}});if(!expected.ok)throw Error(expected.error);expect(await read(page)).toEqual(expected.state);await page.mouse.up();await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');return expected.state;}
  12 | test('left-down on the actual sword commits once, aim is cosmetic, hold/up/double-click/drag do not duplicate',async({page})=>{
  13 |  await open(page);const original=await read(page);let p=await point(page,.35,.55);await page.mouse.move(p.x,p.y);await expect(page.locator('#v3-scene')).toHaveClass(/aiming/);const x1=await page.locator('#v3-scene').evaluate(e=>e.style.getPropertyValue('--aim-x'));p=await point(page,.8,.63);await page.mouse.move(p.x,p.y);expect(await page.locator('#v3-scene').evaluate(e=>e.style.getPropertyValue('--aim-x'))).not.toBe(x1);expect(await read(page)).toEqual(original);
  14 |  await page.mouse.down();const hit=await read(page);expect(hit.revision).toBe(original.revision+1);expect(hit.rng.forge.draws).toBe(1);await page.waitForTimeout(320);await page.locator('#v3-strike').focus();await page.keyboard.press('Space');expect(await read(page)).toEqual(hit);await page.mouse.move(5,5);await page.mouse.up();expect(await read(page)).toEqual(hit);
  15 |  await page.mouse.down();p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.up();expect(await read(page)).toEqual(hit);
  16 |  await page.mouse.click(p.x,p.y,{button:'right'});expect(await read(page)).toEqual(hit);
  17 |  await page.mouse.dblclick(p.x,p.y,{delay:5});const twice=await read(page);expect(twice.revision).toBe(hit.revision+1);await page.keyboard.down('Space');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');await page.keyboard.up('Space');expect(await read(page)).toEqual(twice);
  18 | });
  19 | test('contact has real particles, ring, blade recoil and distinct native percussive sound; mute and reduced motion still work',async({page},info)=>{
  20 |  await installAudioProbe(page);await open(page);await page.locator('#v3-settings summary').click();await expect.poll(async()=>(await audioProbe(page)).states).toContain('running');await page.locator('#v3-settings summary').click();const p=await point(page);await page.mouse.move(p.x,p.y);await installHammerProbe(page);await page.mouse.down();await expect(page.locator('#v3-scene')).toHaveAttribute('data-outcome',/success|great/);
  21 |  const effects=await page.locator('#v3-scene').evaluate(e=>({particles:e.querySelectorAll('#v3-sparks i').length,animations:e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length,outcome:e.getAttribute('data-outcome')}));expect(effects.particles).toBe(36);expect(effects.animations).toBeGreaterThan(10);await page.mouse.up();const sound=await audioProbe(page);expect(sound.starts).toBe(3);expect(sound.frequencies).toEqual(effects.outcome==='great'?[89,631,1723]:[139,947,2381]);expect(sound.maxActive).toBeLessThanOrEqual(12);
> 22 |  await expect.poll(()=>page.evaluate(()=>window.v3HammerGeometry.complete)).toBe(true);const geometry=await page.evaluate(()=>window.v3HammerGeometry),best=geometry.frames.reduce((a,b)=>b.gap<a.gap?b:a),contact={...geometry,gap:best.gap,best};await mkdir(dir,{recursive:true});await writeFile(`${dir}/${info.project.name}-contact.json`,JSON.stringify({effects,sound,contact,state:await read(page)},null,2)+'\n');expect(contact.gap).toBeLessThan(6);await page.screenshot({path:`${dir}/${info.project.name}-contact.png`});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                 ^ Error: expect(received).toBeLessThan(expected)
  23 |  await page.locator('#v3-settings summary').click();await page.locator('#v3-muted').check();await page.locator('#v3-motion').check();await page.locator('#v3-settings summary').click();const starts=(await audioProbe(page)).starts;await expect(page.locator('#v3-hit')).toBeEnabled();await left(page);expect((await audioProbe(page)).starts).toBe(starts);expect((await audioProbe(page)).active).toBe(0);expect(await page.locator('#v3-scene').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0);
  24 | });
  25 | test('burst is atomic on left-down and late visual hits cannot survive pause, modal or reload',async({page})=>{
  26 |  await open(page);for(let i=0;i<6;i++)await left(page);const before=await read(page),p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.down();const accepted=await read(page);expect(accepted.rng.forge.draws-before.rng.forge.draws).toBe(2);expect(accepted.journal.length-before.journal.length).toBe(1);await page.mouse.up();await page.keyboard.press('Escape');await page.waitForTimeout(450);expect(await read(page)).toEqual(accepted);expect(await page.locator('#v3-scene').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);await page.getByRole('button',{name:'继续锻造',exact:true}).click();await page.reload();await expect(page.locator('#v3-hit')).toBeEnabled();expect(await read(page)).toEqual(accepted);
  27 |  await page.locator('#v3-strike').focus();await page.keyboard.down('Space');await page.locator('#v3-menu').click();await page.keyboard.up('Space');expect(await read(page)).toEqual(accepted);
  28 | });
  29 | test('large left-click target and keyboard alternatives remain visible at both desktop sizes',async({page})=>{
  30 |  await open(page);for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});const box=await page.locator('#v3-hit').boundingBox();expect(box!.width).toBeGreaterThan(400);expect(box!.height).toBeGreaterThanOrEqual(160);expect(box!.y+box!.height).toBeLessThan(height!);await left(page);await expect(page.locator('#v3-hit')).toBeFocused();const before=await read(page);await page.keyboard.press('Space');expect((await read(page)).revision).toBe(before.revision+1);await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');}
  31 | });
  32 | test('record actual left-click growth and burst effects without injecting any game result',async({browser},info)=>{
  33 |  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:`${dir}/clips`,size:{width:1280,height:720}}}),page=await context.newPage();
  34 |  try{await open(page);for(let i=0;i<6;i++){await left(page);await page.waitForTimeout(140);}const before=await read(page),accepted=await left(page);expect(accepted.rng.forge.draws-before.rng.forge.draws).toBe(2);await page.waitForTimeout(500);await writeFile(`${dir}/${info.project.name}-clip-state.json`,JSON.stringify(accepted,null,2)+'\n');}
  35 |  finally{const video=page.video();await context.close();if(video){const path=await video.path();await info.attach('actual-left-click-effects',{path,contentType:'video/webm'});}}
  36 | });
  37 | 
```