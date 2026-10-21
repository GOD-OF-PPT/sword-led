# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v5-events.spec.ts >> v5 restored boundary: explicit rest accept, reload and real next-day consequence
- Location: tests/e2e/v5-events.spec.ts:7:71

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: -0
Received: 0
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - text: +
  - main "行脚灯炉" [ref=f1e4]:
    - generic [aria-hidden]:
      - strong: 锤下求生
      - generic: v0.8 炉边交易 · 三柄行囊
    - generic "契印与行囊" [ref=f1e5]:
      - generic [ref=f1e6]:
        - generic [ref=f1e7]: 契印
        - strong [ref=f1e8]: 2/3
      - generic [ref=f1e9]:
        - generic [ref=f1e10]: 铜钱
        - strong [ref=f1e11]: "159"
    - complementary "炉边剑架" [ref=f1e12]:
      - heading "候火的剑" [level=2] [ref=f1e13]
      - paragraph [ref=f1e14]: 拿起剑，拖给来客
      - generic [ref=f1e15]:
        - button "轻刃 · 40" [pressed] [ref=f1e16] [cursor=pointer]
        - button "轻刃 · 40" [ref=f1e17] [cursor=pointer]
      - region "留给明天的剑" [ref=f1e18]:
        - heading "留一把，待明日" [level=3] [ref=f1e19]
        - button "取回 轻刃 · 40" [ref=f1e21] [cursor=pointer]
        - paragraph [ref=f1e22]: 明日：旧剑1 ＋ 新坯2
        - button "明日打算 ›" [ref=f1e23] [cursor=pointer]
      - generic [ref=f1e24]:
        - button "留给明天" [ref=f1e25] [cursor=pointer]
        - generic "配方选择"
    - generic "铁砧与当前兵器" [ref=f1e26]:
      - generic "青云轻刃，乌铁坯，等级0，身价40，完好；仅造型展示"
      - button "在剑身上落锤" [ref=f1e27]
    - region "当前剑的身价与状况":
      - paragraph:
        - generic: 作品身价
        - strong: "40"
        - generic: 轻刃 · 无裂纹
      - paragraph: 等级 0 · 已完成安全连锻 0次
      - generic:
        - paragraph: 下一锤裂损 0% · 首裂会掉价
        - paragraph: 锤势 0/6
      - button "落锤 左键剑身 / 空格" [active] [ref=f1e28] [cursor=pointer]:
        - text: 落锤
        - generic [ref=f1e29]: 左键剑身 / 空格
    - complementary "等剑的来客与委托" [ref=f1e30]:
      - button "和来客聊聊" [ref=f1e31] [cursor=pointer]:
        - generic [ref=f1e32]:
          - generic [ref=f1e33]: 杜伯
          - generic [ref=f1e34]: 点来客，听听心愿
      - generic [ref=f1e35]:
        - paragraph [ref=f1e36]: 第3天 · 灯从炉起
        - heading "修炉试锋" [level=1] [ref=f1e37]
        - paragraph [ref=f1e38]: 好剑有它要去的地方
        - generic [ref=f1e41]:
          - generic [ref=f1e42]:
            - paragraph [ref=f1e43]:
              - strong [ref=f1e44]: 交付一柄
              - text: · 连锻≥1次 · 身价≥260
            - paragraph [ref=f1e45]: 还差1次连锻，另有1项
          - img "第1柄尚未交付" [ref=f1e47]:
            - generic [ref=f1e48]: 待交
        - paragraph [ref=f1e49]: 合格后递给来客，才算交妥
        - paragraph [ref=f1e50]: 今日酬劳 100 · 已收0
      - paragraph [ref=f1e51]: 让一柄剑经历一次安全连锻，看看这座炉的火候。
      - text: 收讫
      - button "卖给行会 · 收10" [ref=f1e52] [cursor=pointer]
      - paragraph [ref=f1e53]: 作品身价40 · 收购余60
      - button "行脚商人的摊子" [ref=f1e55] [cursor=pointer]
      - paragraph [ref=f1e56]: 成器可换手艺 · 等级至少3
    - generic "已装炉具"
    - region "随身手艺与炉具" [ref=f1e57]:
      - button "首赠 · 选手艺" [ref=f1e59] [cursor=pointer]
    - button "回收这柄剑" [ref=f1e60] [cursor=pointer]
    - button "收工，封炉" [ref=f1e61] [cursor=pointer]
  - navigation "行旅工具" [ref=f1e62]:
    - button "暂停与行旅菜单" [ref=f1e63] [cursor=pointer]: 行囊
    - button "打开炉谱" [ref=f1e64] [cursor=pointer]: 炉谱
    - button "打开设置" [ref=f1e65] [cursor=pointer]: 设置
    - button "查看保存详情" [ref=f1e66] [cursor=pointer]: 进度已收好
  - region [ref=f1e67]:
    - generic [ref=f1e69]:
      - heading "守炉 · 已记妥" [level=2] [ref=f1e70]
      - paragraph [ref=f1e71]: 铜钱 159 → 159。剑和铜钱保持，继续安排这一炉。
    - button "收起这条炉边消息" [ref=f1e72] [cursor=pointer]: ×
  - status [ref=f1e73]
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import type {EventId} from '../../src/core-v5/index.js';
  3  | import {KeyboardV5,v5Sdk} from './v5-helpers.js';
  4  | import {eventBoundaryV5,lastStrikeV5,reloadExactV5} from './v5-interaction-helpers.js';
  5  | const IDS:readonly EventId[]=['donation','loan','salvage','credit','shelter','rest'];
  6  | 
  7  | for(const id of IDS)for(const choice of ['accept','decline'] as const)test(`v5 restored boundary: explicit ${id} ${choice}, reload and real next-day consequence`,async({page},info)=>{
  8  |  const h=new KeyboardV5(page,info,'mouse');await h.install();const boundary=eventBoundaryV5(id);await h.restoreLegitimate(boundary);expect(boundary.day).toBe(3);expect(boundary.eventId).toBe(id);expect(boundary.reserveId).toBe('d3-1');
  9  |  const before=(await h.read()).state;
  10 |  await h.same('inspect then cancel does not choose event',async()=>{await h.activate(page.locator('#v4-event-open'));await expect(page.locator(`#v4-dialog-body canvas[data-prop="${id}"]`)).toBeVisible();if(choice==='accept')await h.capture(`${id}-event-offer`);await h.activate(page.getByRole('button',{name:'暂不决定',exact:true}));});
  11 |  if(id==='salvage'&&choice==='accept'){
  12 |   const raw=(await h.read()).raw;await h.same('cancel selected old-sword event confirmation',async()=>{await h.activate(page.locator('#v4-event-open'));await h.activate(page.locator('[data-event-piece="d3-1"] button'));await expect(page.locator('#v4-dialog-title')).toBeVisible();await h.activate(page.getByRole('button',{name:'再想想',exact:true}));});expect((await h.read()).raw).toEqual(raw);
  13 |  }
  14 |  const pieceId=id==='donation'?'d3-2':id==='salvage'?'d3-1':undefined;
  15 |  const action={type:'chooseEvent' as const,choice,...(choice==='accept'&&pieceId?{pieceId}:{})};const quote=v5Sdk.eventQuote(before,pieceId);const chosen=await h.command(action),record=chosen.eventHistory.at(-1)!;
> 16 |  expect(record).toMatchObject({day:3,id,choice});expect(chosen.eventHistory.filter(e=>e.day===3)).toHaveLength(1);expect(chosen.eventStatus).toBe(choice==='accept'?'accepted':'declined');expect(chosen.coins-before.coins).toBe(choice==='decline'?0:id==='salvage'?160:-quote.cost);expect(chosen.marketSpent).toBe(before.marketSpent);
     |                                                                                                                                                                                                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  17 |  if(choice==='decline'){expect(chosen.blades).toEqual(before.blades);expect(chosen.pending).toEqual(before.pending);expect(chosen.reserveId).toBe(before.reserveId);}
  18 |  else if(id==='donation'){expect(chosen.blades.find(b=>b.id==='d3-2')?.status).toBe('donated');expect(chosen.pending.supplyPct).toBe(120);}
  19 |  else if(id==='salvage'){expect(chosen.reserveId).toBeNull();expect(chosen.blades.find(b=>b.id==='d3-1')?.status).toBe('bartered');expect(record.pieceId).toBe('d3-1');}
  20 |  else if(id==='credit')expect(chosen.crackGuard).toBe(true);
  21 |  else if(id==='loan')expect(chosen.pending.loan).toBe(true);
  22 |  else if(id==='shelter')expect(chosen.pending.shelter).toBe(true);
  23 |  else{expect(chosen.blades).toEqual(before.blades);expect(chosen.pending).toEqual(before.pending);}
  24 |  await expect(page.locator('#v4-event-open')).toBeHidden();await reloadExactV5(h);await expect(page.locator('#v4-event-open')).toBeHidden();
  25 |  const settlement=v5Sdk.getRunView(chosen).settlement;await h.command({type:'settle'});const next=await h.command({type:'advance'}),fresh=next.blades.filter(b=>b.suppliedDay===4),kept=next.blades.find(b=>b.id==='d3-1');
  26 |  expect(next.day).toBe(4);expect(next.eventHistory).toHaveLength(1);expect(next.pending).toEqual({supplyPct:100,loan:false,shelter:false});expect(next.marketSpent).toBe(0);expect(next.coins).toBe(chosen.coins+settlement.recovered);
  27 |  expect(fresh).toHaveLength(id==='salvage'&&choice==='accept'?3:2);const base=choice==='accept'&&id==='donation'?48:40;expect(fresh.map(b=>b.base)).toEqual(fresh.map(()=>base));if(kept?.status==='active')expect(kept.value).toBe(40);
  28 |  expect(next.dayBuffs).toEqual({supplyPct:base===48?120:100,loan:choice==='accept'&&id==='loan',shelter:choice==='accept'&&id==='shelter'});await reloadExactV5(h);
  29 |  if(choice==='accept'&&id==='loan'){
  30 |   await h.command({type:'reserve',pieceId:'d3-1'});await h.command({type:'strike',pieceId:'d3-1'});expect(lastStrikeV5(h).hits.every(hit=>!hit.triggers.includes('loan'))).toBe(true);
  31 |   for(let n=0;n<3;n++){await h.command({type:'strike',pieceId:'d4-1'});expect(lastStrikeV5(h).hits.every(hit=>hit.triggers.includes('loan'))).toBe(true);}
  32 |   await h.command({type:'strike',pieceId:'d4-1'});expect(lastStrikeV5(h).hits.every(hit=>!hit.triggers.includes('loan'))).toBe(true);await h.command({type:'strike',pieceId:'d4-2'});expect(lastStrikeV5(h).hits.every(hit=>!hit.triggers.includes('loan'))).toBe(true);
  33 |  }
  34 |  if(choice==='accept'&&id==='shelter'){
  35 |   await h.command({type:'reserve',pieceId:'d3-1'});
  36 |   for(const pieceId of ['d3-1','d4-1','d4-2'])for(let n=0;n<3;n++){await h.command({type:'strike',pieceId});expect(lastStrikeV5(h).hits.every(hit=>hit.triggers.includes('shelter'))).toBe(pieceId==='d4-1');}
  37 |   const view=v5Sdk.getRunView((await h.read()).state),a=view.blades.find(p=>p.blade.id==='d4-1')!,b=view.blades.find(p=>p.blade.id==='d4-2')!;expect(a.odds.crack).toBe(Math.max(0,b.odds.crack-30));
  38 |  }
  39 |  if(choice==='accept'&&id==='credit'){
  40 |   let consumed=false,broken=false;for(let n=0;n<30;n++){const s=(await h.read()).state,piece=v5Sdk.getRunView(s).blades.find(p=>p.blade.id==='d4-1');if(!piece?.canStrike)break;await h.command({type:'strike',pieceId:'d4-1'});for(const hit of lastStrikeV5(h).hits){if(hit.result==='crack'){expect(hit.triggers).toContain('credit');expect(hit.after).toBe(hit.before);consumed=true;await reloadExactV5(h);}if(hit.result==='broken'){expect(hit.triggers).not.toContain('credit');broken=true;}}if(broken)break;}expect(consumed).toBe(true);expect(broken).toBe(true);expect((await h.read()).state.crackGuard).toBe(false);
  41 |  }
  42 |  if(choice==='accept')await h.capture(`${id}-actual-next-day`);await reloadExactV5(h);expect((await h.read()).state.eventHistory.filter(e=>e.id===id)).toHaveLength(1);await h.finish({scope:'Explicit event accept/decline from fully replayed restored boundary, with actual UI refresh/advance/effects; not a new complete game',event:id,choice});
  43 | });
  44 | 
```