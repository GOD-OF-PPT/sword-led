# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v2-accessibility.spec.ts >> v2 live text, painted backgrounds, target scale and trial remain readable at 1280
- Location: tests/e2e/v2-accessibility.spec.ts:5:69

# Error details

```
Error: 0/6 font

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 12
Received:    11
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - button "锤下求生 行脚灯炉 · 锻脉与试剑" [ref=e5] [cursor=pointer]:
      - text: 锤下求生
      - generic [ref=e6]: 行脚灯炉 · 锻脉与试剑
    - generic [ref=e7]:
      - generic [ref=e8]: 第 1 / 12 轮 · 新交 0 + 信用 0 / 150 · 还差 150
      - progressbar "当轮交货与信用进度" [ref=e9]
    - generic [ref=e10]: 金币 0 废料 0 煤 2 印记 3/3
    - button "暂停" [ref=e11] [cursor=pointer]
    - button "契约菜单" [ref=e12] [cursor=pointer]
  - status [ref=e13]:
    - generic [ref=e14]: 本机契约已保存。
  - generic [ref=e16]:
    - complementary "本轮三件来料" [ref=e17]:
      - button "1 熟铁 可加工 18金币 · 完整4/4" [pressed] [ref=e18] [cursor=pointer]
      - button "2 熟铁 可加工 18金币 · 完整4/4" [ref=e21] [cursor=pointer]
      - button "3 精钢 可加工 22金币 · 完整3/3" [ref=e24] [cursor=pointer]
    - generic [ref=e27]:
      - generic [ref=e28]:
        - generic [ref=e29]: 熟铁·未定之刃
        - generic [ref=e30]: 静炉
      - generic [ref=e31]:
        - generic "当前剑身与五节锻造痕迹"
        - generic "剑身五节十个落点":
          - button "剑尖刃落点" [pressed] [ref=e32] [cursor=pointer]:
            - generic: 0/6
          - button "前刃刃落点" [ref=e33] [cursor=pointer]:
            - generic: 0/6
          - button "中段刃落点" [ref=e34] [cursor=pointer]:
            - generic: 0/6
          - button "根部刃落点" [ref=e35] [cursor=pointer]:
            - generic: 0/6
          - button "剑茎刃落点" [ref=e36] [cursor=pointer]:
            - generic: 0/6
          - button "剑尖脊落点" [ref=e37] [cursor=pointer]:
            - generic: 0/6
          - button "前刃脊落点" [ref=e38] [cursor=pointer]:
            - generic: 0/6
          - button "中段脊落点" [ref=e39] [cursor=pointer]:
            - generic: 0/6
          - button "根部脊落点" [ref=e40] [cursor=pointer]:
            - generic: 0/6
          - button "剑茎脊落点" [ref=e41] [cursor=pointer]:
            - generic: 0/6
      - generic [ref=e42]: 锋 0 韧 2 衡 0 ｜完整 4/4 · 已锻 0锤
      - paragraph [ref=e43]: 落锤增加性能，淬火后成为能交货的成品。
      - paragraph [ref=e44]: 锻纹：还未形成 连线 0/3
      - paragraph [ref=e45]: 剑尖 · 刃 · 本点提升锋；相邻三点连纹。方向键选点，Q/W/E换锤，1/2/3换坯。
    - complementary [ref=e46]:
      - heading "纸上委托" [level=2] [ref=e47]:
        - generic [aria-hidden] [ref=e48]: 委
        - text: 纸上委托
      - generic [ref=e51]:
        - heading "巡卫的守夜剑" [level=3] [ref=e52]
        - paragraph [ref=e53]: 锋≥6，韧≥5
        - paragraph [ref=e54]: 淬火后检查委托；两项各超要求3点再奖20。
      - generic [ref=e55]:
        - heading "随身手艺 · 点开查看" [level=3] [ref=e56]
        - button "桥脊扣 · 待游衡" [ref=e58] [cursor=pointer]
      - button "试一试这把剑" [disabled] [ref=e59]
      - button "翻看作品簿" [ref=e60] [cursor=pointer]
    - generic [ref=e61]:
      - generic [ref=e62]:
        - button "轻锤 · 力1 / 热8" [ref=e63] [cursor=pointer]
        - button "平锤 · 力3 / 热16" [pressed] [ref=e65] [cursor=pointer]
        - button "重锤 · 力5 / 热24" [ref=e67] [cursor=pointer]
      - generic [ref=e69]:
        - generic "松开时机" [ref=e70]:
          - generic [ref=e71]: 偏击
          - generic [ref=e72]: 普通
          - generic [ref=e73]: 精准
          - generic [ref=e74]: 普通
          - generic [ref=e75]: 偏击
        - button "按住蓄锤 · 松开落锤" [active] [ref=e76] [cursor=pointer]
        - paragraph [ref=e77]: 精准：+3属性 / 热−16 / 应力+4；普通：+3属性 / 热−16 / 应力+6；偏击：+2属性 / 热−16 / 应力+16
        - generic [ref=e78]:
          - generic [ref=e79]:
            - text: 热度 100/120
            - meter "热度100，阈值120" [ref=e80]
          - generic [ref=e81]:
            - text: 应力 0/40
            - meter "应力0，阈值40" [ref=e82]
      - generic [ref=e83]:
        - button "回火 · 1煤" [disabled] [ref=e84]
        - button "水淬" [disabled] [ref=e85]
        - button "油淬" [disabled] [ref=e87]
        - button "交货 18" [ref=e89] [cursor=pointer]
        - button "回收 +3废料" [ref=e90] [cursor=pointer]
        - button "收工" [ref=e91] [cursor=pointer]
  - contentinfo [ref=e92]:
    - status [ref=e93]: 已记录这次选择。
    - status
    - group [ref=e94]:
      - generic "操作与声音" [ref=e95] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from './fixtures';
  2  | import {openV2,startV2,strikeV2,readV2,confirmV2} from './v2-helpers';
  3  | import {renderedTextReadability} from './v2-readability';
  4  | 
  5  | for(const size of[{width:1280,height:720},{width:1920,height:1080}])test(`v2 live text, painted backgrounds, target scale and trial remain readable at ${size.width}`,async({page},info)=>{
> 6  |   await page.setViewportSize(size);await openV2(page,false);await startV2(page,'v2-readability');await page.waitForLoadState('networkidle');const before=await readV2(page),metrics=await renderedTextReadability(page);expect(await readV2(page)).toEqual(before);expect(metrics.length).toBeGreaterThan(35);const path=info.outputPath(`v2-readable-${size.width}.png`);await page.screenshot({path});await info.attach(`v2-readable-${size.width}`,{path,contentType:'image/png'});await info.attach(`v2-text-metrics-${size.width}`,{body:Buffer.from(JSON.stringify({method:'actual rendered background pixels after test-only transparent glyphs; original foreground computed color; disabled/decorative nodes excluded',size,metrics},null,2)),contentType:'application/json'});for(const m of metrics){expect(m.fontSize,`${m.text} font`).toBeGreaterThanOrEqual(12);expect(m.minContrast,`${m.text} contrast`).toBeGreaterThanOrEqual(4.5);}
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ^ Error: 0/6 font
  7  |   const environment=await page.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('#v2-blade')!,b=c.getBoundingClientRect();return{dpr:devicePixelRatio,canvas:{width:c.width,height:c.height,cssWidth:b.width,cssHeight:b.height},userAgent:navigator.userAgent,secureContext:isSecureContext,locks:typeof navigator.locks?.request};});expect(environment.dpr).toBe(info.project.use.deviceScaleFactor??1);expect(environment.canvas.width).toBeCloseTo(environment.canvas.cssWidth*Math.min(2,environment.dpr),0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  8  |   for(const node of[0,1,2,7,8,9])await strikeV2(page,node,'standard',false);await page.locator('#v2-oil').click();await confirmV2(page);const actual=await readV2(page);await page.locator('#v2-trial').click();await expect(page.locator('#v2-dialog-title')).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'收剑',exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'收剑',exact:true})).toBeInViewport({ratio:.95});await page.keyboard.press('Escape');expect(await readV2(page)).toEqual(actual);await info.attach(`v2-surface-${size.width}`,{body:Buffer.from(JSON.stringify({environment,state:actual},null,2)),contentType:'application/json'});
  9  | });
  10 | 
```