# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v2-audio.spec.ts >> v2 native resume denial stays readable and never revokes an accepted sword
- Location: tests/e2e/v2-audio.spec.ts:15:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Array [
-   "suspended",
+   "interrupted",
  ]
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
            - generic: 3/6
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
      - generic [ref=e42]: 锋 3 韧 2 衡 0 ｜完整 4/4 · 已锻 1锤
      - paragraph [ref=e43]: 现在按原坯交 18；水淬后可交42 / 油淬后可交42
      - paragraph [ref=e44]: 锻纹：还未形成 连线 1/3
      - paragraph [ref=e45]: 剑尖 · 刃 · 本点提升锋；相邻三点连纹。方向键选点，Q/W/E换锤，1/2/3换坯。
    - complementary [ref=e46]:
      - heading "纸上委托" [level=2] [ref=e47]:
        - generic [aria-hidden] [ref=e48]: 委
        - text: 纸上委托
      - generic [ref=e51]:
        - heading "巡卫的守夜剑" [level=3] [ref=e52]
        - paragraph [ref=e53]: 锋≥6，韧≥5
        - paragraph [ref=e54]: 淬火后核对；双项各超3另奖20。
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
        - button "按住蓄锤 · 松开落锤" [ref=e76] [cursor=pointer]
        - paragraph [ref=e77]: 精准：+3属性 / 热−16 / 应力+4；普通：+3属性 / 热−16 / 应力+6；偏击：+2属性 / 热−16 / 应力+16
        - generic [ref=e78]:
          - generic [ref=e79]:
            - text: 热度 84/120
            - meter "热度84，阈值120" [ref=e80]
          - generic [ref=e81]:
            - text: 应力 4/40
            - meter "应力4，阈值40" [ref=e82]
      - generic [ref=e83]:
        - button "回火 · 1煤" [ref=e84] [cursor=pointer]
        - button "水淬 → 42" [ref=e85] [cursor=pointer]
        - button "油淬 → 42" [ref=e87] [cursor=pointer]
        - button "交货 18" [ref=e89] [cursor=pointer]
        - button "回收 +3废料" [ref=e90] [cursor=pointer]
        - button "收工" [ref=e91] [cursor=pointer]
  - contentinfo [ref=e92]:
    - status [ref=e93]: 落锤已结算；继续、换路线或淬火收手。
    - status
    - group [ref=e94]:
      - generic "操作与声音" [active] [ref=e95] [cursor=pointer]
      - generic [ref=e96]:
        - generic [ref=e97]:
          - checkbox "慢速时机" [ref=e98]
          - text: 慢速时机
        - generic [ref=e99]:
          - checkbox "减弱动效" [ref=e100]
          - text: 减弱动效
        - generic [ref=e101]:
          - checkbox "静音" [ref=e102]
          - text: 静音
        - generic [ref=e103]:
          - text: 音量
          - slider "音量" [ref=e104]: "55"
        - generic [ref=e105]: 正在使用默认设置
        - status [ref=e106]: 声音被浏览器阻止，可再次操作重试
```

# Test source

```ts
  1  | import {test,expect} from './fixtures';
  2  | import {installAudioProbe,audioProbe} from './audio-probe';
  3  | import {readV2,openV2,startV2,strikeV2,confirmV2} from './v2-helpers';
  4  | 
  5  | test('v2 actual accepted strike creates native waveform and mute/pause/menu/reload stop or avoid replay',async({page},info)=>{
  6  |   await installAudioProbe(page);await openV2(page,false);expect((await audioProbe(page)).constructors).toBe(0);await startV2(page);await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['running']);await page.waitForTimeout(350);await page.keyboard.up('Space');await expect.poll(async()=>(await audioProbe(page)).peak).toBeGreaterThan(.001);const sound=await audioProbe(page);expect(sound.starts).toBe(3);expect(sound.frequencies).toEqual([719,1193,1777]);const accepted=await readV2(page);
  7  |   await page.locator('#v2-pause').click();await expect.poll(async()=>(await audioProbe(page)).active).toBe(0);await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['suspended']);await page.locator('#v2-resume').click();await strikeV2(page,1,'standard',false);await page.locator('#v2-settings summary').click();await page.locator('#v2-muted').check();await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['suspended']);expect((await audioProbe(page)).active).toBe(0);expect((await audioProbe(page)).maxActive).toBeLessThanOrEqual(12);const beforeReload=await readV2(page);await page.locator('#v2-menu-button').click();await page.reload();await page.locator('#v2-continue').click();expect((await audioProbe(page)).starts).toBe(0);expect(await readV2(page)).toEqual(beforeReload);
  8  |   await info.attach('v2-native-audio',{body:Buffer.from(JSON.stringify({sound,accepted,beforeReload,afterReload:await audioProbe(page)},null,2)),contentType:'application/json'});
  9  | });
  10 | 
  11 | test('v2 delayed native audio resume cannot sound the old accepted strike after a pause or new contract',async({page},info)=>{
  12 |   await installAudioProbe(page,{defer:true});await openV2(page);await startV2(page);await strikeV2(page);expect((await audioProbe(page)).starts).toBe(0);const old=await readV2(page);await page.locator('#v2-pause').click();await page.evaluate(()=>window.audioTestProbe.releaseResume?.());await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['suspended']);expect((await audioProbe(page)).starts).toBe(0);await page.locator('#v2-menu-button').click();await page.locator('#v2-new').click();await confirmV2(page);await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-decline').click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['running']);await page.clock.runFor(350);await page.keyboard.up('Space');const fresh=await readV2(page);expect(fresh.runId).not.toBe(old.runId);expect(fresh.pieces[0]?.strikes).toBe(1);await expect.poll(async()=>(await audioProbe(page)).starts).toBe(3);await info.attach('v2-deferred-audio',{body:Buffer.from(JSON.stringify({old,fresh,probe:await audioProbe(page)},null,2)),contentType:'application/json'});
  13 | });
  14 | 
  15 | test('v2 native resume denial stays readable and never revokes an accepted sword',async({page})=>{
> 16 |   await installAudioProbe(page,{rejectResume:true});await openV2(page);await startV2(page);await strikeV2(page);const accepted=await readV2(page);expect(accepted.pieces[0]?.strikes).toBe(1);await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-audio-state')).toContainText('被浏览器阻止');const probe=await audioProbe(page);expect(probe.starts).toBe(0);expect(probe.states).toEqual(['suspended']);expect(await readV2(page)).toEqual(accepted);
     |                                                                                                                                                                                                                                                                                                                                                                                                             ^ Error: expect(received).toEqual(expected) // deep equality
  17 | });
  18 | 
```