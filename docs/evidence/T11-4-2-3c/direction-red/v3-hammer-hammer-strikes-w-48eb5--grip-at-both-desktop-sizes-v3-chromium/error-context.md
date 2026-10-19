# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v3-hammer.spec.ts >> hammer strikes with a flat metal face and rotates around its grip at both desktop sizes
- Location: tests/e2e/v3-hammer.spec.ts:4:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 10
Received:   56.61148642388851
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - text: 锤下求生
      - generic [ref=e6]: 行脚灯炉 · v0.4 兵器成长版 · 前三轮
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
  1 | import {test,expect} from '@playwright/test';
  2 | import {installHammerProbe} from './hammer-probe';
  3 | import {mkdir,writeFile} from 'node:fs/promises';
  4 | test('hammer strikes with a flat metal face and rotates around its grip at both desktop sizes',async({page},info)=>{
  5 |  const dir='tmp/v3-hammer-states';await mkdir(dir,{recursive:true});await page.goto('/');await expect(page.locator('#v3-hit')).toBeEnabled();await page.locator('#v3-hammer img').evaluate(async(i:HTMLImageElement)=>{await i.decode();});
> 6 |  for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});await page.screenshot({path:`${dir}/${info.project.name}-${width}-idle.png`});await installHammerProbe(page);const box=await page.locator('#v3-hit').boundingBox();await page.mouse.click(box!.x+box!.width*.58,box!.y+box!.height*.6);await expect.poll(()=>page.evaluate(()=>window.v3HammerGeometry.complete)).toBe(true);const probe=await page.evaluate(()=>window.v3HammerGeometry),best=probe.frames.reduce((a,b)=>b.gap<a.gap?b:a);await writeFile(`${dir}/${info.project.name}-${width}-geometry.json`,JSON.stringify({probe,best},null,2)+'\n');await page.screenshot({path:`${dir}/${info.project.name}-${width}-after.png`});expect(Math.abs(best.angle)).toBeLessThan(10);expect(best.pivotGap).toBeLessThan(4);expect(best.gap).toBeLessThan(6);}
    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       ^ Error: expect(received).toBeLessThan(expected)
  7 | });
  8 | 
```