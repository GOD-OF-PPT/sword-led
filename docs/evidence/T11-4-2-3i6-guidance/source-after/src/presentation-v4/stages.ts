import {CHAPTERS,COMMISSIONS,EVENTS,RECIPES,TRAITS,getRunView,describeRoute} from '../core-v4/index.js';
import type {Action,Blade,EventId,Modification,RunState} from '../core-v4/index.js';
import type {CollectionState} from '../application/v4-collection.js';
import {element} from '../presentation/dom.js';
import {chapterFacts,endingFacts,journeyOutcome,journeyScreen,CAMPAIGN_GOAL} from './journey.js';
import type {JourneyScreen} from './journey.js';

export interface JourneyStageContext {
  throughDay:8|12;
  delivery?:{commissionId:number;pieceIds:readonly string[]};
  chapterIntro?:true;
  temporary?:boolean;
  collection:{data:CollectionState;pending:boolean;problem:string|null};
  action(label:string,run:()=>void,primary?:boolean):HTMLElement;
  commandAction(label:string,command:Action,primary?:boolean):HTMLElement;
  thumb(blade:Blade):HTMLElement;
  prop(id:Modification|EventId):HTMLElement;
  leaveScene():void;
  book():void;
  toTitle():void;
  exportRun():void;
  startChallenge?():void;
}
export interface JourneyStage {
  title:string;body:HTMLElement;actions:HTMLElement[];image:string;
  mode:JourneyScreen|'delivery'|'intro';
}
const fmt=(value:number)=>value.toLocaleString('zh-CN');
const CHAPTER_TWO='/assets/d/v07-chapter2/';
const CHAPTER_THREE='/assets/d/v07-chapter3/';

/** Build only DOM and explicit command intentions. No session, timer or reward lives here. */
export function buildJourneyStage(input:RunState,context:JourneyStageContext):JourneyStage {
  // Core views freeze their nested results. Keep this DOM projection detached from a legal restored caller.
  const state:RunState=structuredClone(input);
  const view=getRunView(state),facts=chapterFacts(state,view.chapter.id),h=state.history.at(-1);
  const baseMode=journeyScreen(state,context.throughDay);
  const mode=baseMode==='future'||baseMode==='ending'||baseMode==='defeat'?baseMode:context.delivery?'delivery':context.chapterIntro?'intro':baseMode;
  const body=element('div',undefined,'v4-journey-copy'),actions:HTMLElement[]=[];
  let title='',image='/assets/d/v07/lantern-road-v1.webp';
  const paragraph=(copy:string)=>body.append(element('p',copy));
  const addProtection=()=>{if(h?.protected)body.append(element('p','护炉契保住了这次契印；本局不会再次保印，未完成的约定仍如实留下。','v4-protection-receipt'));};
  const addWorks=(blades:readonly Blade[],day:number,target:HTMLElement=body)=>{
    if(!blades.length)return;
    const works=element('div',undefined,'v4-delivery-works');
    for(const blade of blades){
      const work=element('figure',undefined,'v4-journey-work');work.dataset.piece=blade.id;
      work.append(context.thumb(blade),element('figcaption',`${RECIPES[blade.recipe].name} · ${fmt(blade.value)}身价 · 等级${blade.level} · 连锻${blade.bursts}次 · ${blade.suppliedDay<day?'沿途留剑':'本日新剑'}${blade.cracked?' · 有裂纹':' · 无裂纹'}`));works.append(work);
    }
    target.append(works);
  };
  const addNext=()=>{
    const next=view.next;if(!next)return;
    const section=element('section',undefined,'v4-next-journey');
    section.append(element('h3',`明天：${next.commission.title}`),element('p',next.commission.request));
    for(const route of next.commission.routes)section.append(element('p',describeRoute(route)));
    section.append(element('p',`三柄新坯，普通底价各${fmt(next.normalBase)}。${next.inheritanceBonus?`第一柄另有余温铁夹来料，实际底价${fmt(next.firstBase)}。`:''}`));
    if(next.reserve){
      const kept=state.blades.find(b=>b.id===next.reserve!.id);
      if(kept)section.append(context.thumb(kept),element('p',`架上${RECIPES[kept.recipe].name}：当前${fmt(kept.value)} → 明日${fmt(next.reserve.value)}；${next.reserve.cracked?'裂纹保留':'无裂纹'}，锤势${next.reserve.charge}/6。`));
    }else section.append(element('p','没有留剑；需要旧剑时，纸单上的新剑替代路线仍然可做。'));
    if(next.merchant)section.append(element('p','行脚商人将到炉边，可用余剑换手艺；金币准备后续铁料或修补契印。'));
    body.append(section);
  };
  const addGrowth=()=>{
    if(!view.modifications.length)return;
    const list=element('div',undefined,'v4-journey-modifications');
    for(const m of view.modifications){const card=element('section',undefined,'v4-equipped-modification');card.append(context.prop(m.id),element('h3',m.name+' · 已装好'),element('p',m.text));list.append(card);}body.append(list);
  };
  const addQualification=(chapterId:number)=>{
    const recipe=chapterId===1?'护刃':'重锋',saved=!context.collection.pending&&!context.collection.problem&&context.collection.data.chapters.includes(chapterId);
    paragraph(context.temporary?`本次是不保存试玩，新的章节成果不会写入炉谱；离开前可导出这次行程。已有炉谱记录保持原样。`:saved?`炉谱已记下第${chapterId===1?'一':'二'}章。下次启程可自由使用${recipe}。`:'这次章节成果等待安全保存，请查看保存详情；当前行程与已选炉具保持原样。');
  };

  if(mode==='delivery'&&context.delivery){
    const outcome=journeyOutcome(state,context.delivery.commissionId),c=outcome.commission;
    title=outcome.complete?c.title:`${c.title} · 已交付${outcome.progressText}`;image=outcome.image;
    paragraph(outcome.complete?c.success:`已经交付${outcome.progressText}，尚未完成这站委托。合格兵器不能重复计数。`);
    // Accepted ordering does not turn an earlier partial route into the winning receipt.
    const shown=outcome.complete?outcome.pieceIds:outcome.matchedPieceIds;
    const ids=[...new Set([...context.delivery.pieceIds,...shown])].filter(id=>shown.includes(id));
    addWorks(ids.map(id=>state.blades.find(b=>b.id===id)!),outcome.day);
    if(c.id===11){
      for(const route of outcome.routes)paragraph(`${route.description}：已交付${route.count}/${route.required}${route.id===outcome.routeId?' · 以此路线完成':''}`);
      const others=outcome.matchedBlades.filter(b=>!outcome.pieceIds.includes(b.id));
      if(outcome.complete&&others.length){paragraph('此前交过的新剑也已送出；本次由旧剑路线接完，不计作两柄新剑完成。');addWorks(others,outcome.day);}
    }
    if(c.id===12)paragraph('护灯剑验收完成。回炉边收工后，才会按沿途真实完成的约定判定这次结局。');
    paragraph(`已交给${c.name}。交出的剑不会再回到剑架、回收或换取手艺。`);
    actions.push(context.action('回到铁砧',context.leaveScene,true));
  }else if(mode==='intro'){
    title=view.chapter.title;image=view.chapter.id===3?CHAPTER_THREE+'mountain-pass-arrival-v1.webp':view.chapter.id===2?CHAPTER_TWO+'twin-stations-dark-v1.webp':'/assets/d/v07/lantern-road-v1.webp';
    paragraph(view.chapter.opening);paragraph(view.commission.request);
    for(const route of view.commission.routes)paragraph(route.description);
    const kept=state.blades.find(b=>b.id===state.reserveId);
    if(kept){body.append(context.thumb(kept));paragraph(`剑架上同行的${RECIPES[kept.recipe].name}，现在身价${fmt(kept.value)}。先取回，再决定交付还是续锻。`);}
    else paragraph(view.commission.routes.some(r=>r.age==='new')?'未留旧剑也能继续：可以用纸单上的新剑路线接替这一程。':'新的三柄铁坯已到炉边；先看纸单，再决定这一程的打法。');
    if(view.chapter.id===3)paragraph(`最后一位商人今天到来。炉具与沿途学会的手艺仍在；最终护灯剑需要：${describeRoute(COMMISSIONS[11]!.routes[0]!)}。`);
    actions.push(context.action('回到铁砧',context.leaveScene,true));
  }else if(mode==='opening'){
    title=CHAPTERS[0]!.title;paragraph(CHAPTERS[0]!.opening);paragraph(CAMPAIGN_GOAL);
    paragraph(view.commission.request);for(const route of view.commission.routes)paragraph(route.description);
    paragraph('左键敲击，见好就交。每次收工只按真实完成情况判定契印。');
    actions.push(context.commandAction('点火开炉',{type:'continue'}),context.commandAction('跳过开场',{type:'continue'},false));
  }else if(mode==='receipt'&&h){
    const outcome=journeyOutcome(state,h.commissionId);
    title=state.day===4?'第一程，走完了':state.day===8?'第二程，走完了':h.met?'这一站的约定，做到了':'带着遗憾，继续上路';
    image=outcome.image;paragraph(outcome.commission[h.met?'success':'failure']);
    paragraph(`交剑 ${fmt(h.sales)}金币 · 回收 ${fmt(h.recovered)}金币 · 契印 ${h.sealsAfter}/3`);
    if(h.protected)paragraph('护炉契保住了这次契印；本局不会再次保印。');
    if(h.reserveId){const kept=state.blades.find(b=>b.id===h.reserveId);if(kept){body.append(context.thumb(kept));paragraph(`留下${RECIPES[kept.recipe].name} · 当前身价${fmt(kept.value)}。`);}}
    if(state.day===4){paragraph(`第一章委托完成 ${facts.completed}/4；渡口${facts.chapterEndMet?'已恢复巡守':'仍有未竟的约定'}。`);addGrowth();addQualification(1);paragraph(CHAPTERS[1]!.opening);}
    if(state.day===8){paragraph(`双驿实际交付 ${outcome.progressText} · 第二章完成 ${facts.completed}/4。`);addWorks(outcome.matchedBlades,outcome.day);addGrowth();addQualification(2);paragraph(CHAPTERS[2]!.opening);}
    addNext();actions.push(context.commandAction('沿灯路，去下一天',{type:'advance'}),context.action('翻开炉谱',context.book),context.action(state.day===8?'带着炉谱，再启一程':'回标题',context.toTitle));
    if(state.day===4||state.day===8)actions.push(context.action('导出这次行程',context.exportRun));
  }else if(mode==='chapter'){
    const outcome=journeyOutcome(state,state.commissionOrder[facts.endDay-1]!);image=outcome.image;
    title=view.chapter.id===1?(h?.met?'渡口重新亮了':'炉火还在，渡口仍有缺口'):
      outcome.complete?'风雪双驿，灯火相连':outcome.count?'一站有灯，一站仍在风雪里':'双驿仍在等剑';
    paragraph(outcome.commission[h?.met?'success':'failure']);
    if(view.chapter.id===2){paragraph(`双驿实际交付 ${outcome.progressText}；两柄剑必须分别合格。`);addWorks(outcome.matchedBlades,outcome.day);}
    paragraph(`本章完成 ${facts.completed}/4 项委托，仍有${state.seals}枚契印。${h?.met?'这一程的约定已经做成。':'未完成的约定如实留下，炉火存续仍可改造。'}`);
    addProtection();
    body.append(element('h3','给下一程，改一件炉具'));
    const grid=element('div',undefined,'v4-choice-grid v4-modification-choices');
    for(const modification of view.chapterChoices){const card=element('article',undefined,'v4-card');card.dataset.modification=modification.id;const plinth=element('div',undefined,'v4-modification-plinth');plinth.append(context.prop(modification.id));card.append(plinth,element('h3',modification.name),element('p',modification.text),context.commandAction(`装上${modification.name}`,{type:'chooseModification',modification:modification.id}));grid.append(card);}body.append(grid);
    actions.push(context.action('先看看炉谱',context.book),context.action('回标题，保留选择',context.toTitle));
  }else if(mode==='complete'){
    const outcome=journeyOutcome(state,state.commissionOrder[facts.endDay-1]!);title='第二程，走完了';image=outcome.image;
    paragraph(outcome.commission[facts.chapterEndMet?'success':'failure']);
    paragraph(`双驿实际交付 ${outcome.progressText} · 第二章完成 ${facts.completed}/4 · 契印 ${state.seals}/3`);
    addProtection();addWorks(outcome.matchedBlades,outcome.day);addGrowth();addQualification(2);
    paragraph('本次页面已走完前八天。第8天收工与第二件炉具已经留在当前行程；后续章节接入后可从这里继续。这里是阶段收束，尚未抵达十二灯结局。');
    actions.push(context.action('翻开炉谱',context.book,true),context.action('带着炉谱，再启一程',context.toTitle),context.action('导出这次行程',context.exportRun));
  }else if(mode==='ending'||mode==='defeat'){
    const ending=endingFacts(state)!,memories=element('section',undefined,'v4-ending-memories');title=ending.title;image=ending.image;body.dataset.ending=ending.phase;
    paragraph(ending.text);
    paragraph(`走到第${state.day}天 · 实际完成 ${ending.completed}/12 项委托 · 契印 ${state.seals}/3`);
    const listen=context.action('听听三人的后话',()=>{memories.scrollIntoView({block:'start'});memories.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});});listen.classList.add('v4-ending-listen');body.append(listen);
    if(ending.phase==='defeat')paragraph('契印已用尽，这次行程在这里停下。未抵达的约定保持空白；已有作品与成长不会被写成丢失。');
    else if(ending.finalBladeMade)paragraph(ending.phase==='victory'?'山口护灯剑已验收，关键的灯路接通了。其他失约仍保留在沿途记录中。':'山口护灯剑已经做成；沿途仍有未完成的关键约定或完成数量不足，因此这次是灯下归途。');
    else paragraph('山口护灯剑尚未做成；这次归途保留已经完成的作品与手艺。');
    const missing=ending.missingCritical.map(day=>ending.lamps.find(lamp=>lamp.day===day)!);
    if(missing.length)paragraph('尚未完成的关键约定：'+missing.map(lamp=>`第${lamp.day}天 · ${lamp.commission.title}${lamp.status==='unreached'?'（未抵达）':''}`).join('；')+'。');
    if(ending.finalBladeMade){const final=ending.lamps.find(lamp=>lamp.commissionId===12)!;body.append(element('h3','这次真正交出的护灯剑'));addWorks(final.blades,final.day);}
    addGrowth();
    paragraph(`这一程来料升级${view.growth.upgradeCount}次 · 当前铁坯底价${fmt(view.growth.supplyBase)} · 可用配方：${view.recipes.map(recipe=>recipe.name).join('、')}。`);
    paragraph(`本次留下的配方熟练：${ending.mastery.length?ending.mastery.map(recipe=>RECIPES[recipe].name).join('、'):'尚未取得'}；手艺见闻：${ending.traits.length?ending.traits.map(trait=>TRAITS[trait].name).join('、'):'尚未取得'}。`);
    paragraph(context.temporary?'本次是不保存试玩，新的作品、章节与成长不会写入炉谱；离开前请导出这次行程。已有炉谱记录保持原样。':context.collection.pending||context.collection.problem?'部分新成长还没有安全保存，请先查看保存详情或导出行程。':'安全保存的作品、章节、配方熟练与手艺见闻都留在炉谱，可在下一程查看。');
    memories.append(element('h3','灯下，三人的后话'));
    for(const person of ending.people){
      const detail=element('details',undefined,'v4-ending-person');detail.dataset.customer=person.customer;
      detail.append(element('summary',`${person.name} · 完成${person.completed} · 失约${person.missed} · 未抵达${person.unreached}`));
      for(const record of person.records){
        const memory=element('section',undefined,'v4-ending-memory');memory.dataset.commission=String(record.commissionId);memory.dataset.result=record.status;
        memory.append(element('h4',`第${record.day}天 · ${record.commission.title} · ${record.status==='met'?'约定已成':record.status==='missed'?'留下遗憾':'尚未抵达'}`));
        memory.append(element('p',record.status==='unreached'?'这一站还没有走到，炉谱不替这次行程编写结果。':record.commission[record.met?'success':'failure']));
        if(record.matchedBlades.length){
          memory.append(element('p',record.met?`完成路线：${record.routes.find(route=>route.id===record.routeId)!.description}`:`实际交付：${record.progressText}，尚未凑齐合格数量。`));
          addWorks(record.met?record.blades:record.matchedBlades,record.day,memory);
          const extra=record.met?record.matchedBlades.filter(b=>!record.pieceIds.includes(b.id)):[];
          if(extra.length){memory.append(element('p','此前另有匹配交付，已送出且不重复计入完成收据。'));addWorks(extra,record.day,memory);}
        }
        detail.append(memory);
      }
      memories.append(detail);
    }
    body.append(memories);
    if(context.collection.data.challenge&&!context.collection.pending&&!context.collection.problem&&context.startChallenge)actions.push(context.action('行脚挑战，再走一程',context.startChallenge,true));
    actions.push(context.action(mode==='defeat'?'看看留下的炉谱':'翻开完整炉谱',context.book,actions.length===0),context.action('回到路口，再开一炉',context.toTitle),context.action('导出这次行程',context.exportRun));
  }else if(mode==='future'){
    title='这份后续行程，已为你留住';paragraph(`当前档在第${state.day}天。本次页面开放到第${context.throughDay}天；当前进度保持原样，可导出后在包含后续章节的版本继续。`);
    actions.push(context.action('查看炉谱',context.book,true),context.action('导出行程',context.exportRun),context.action('回标题',context.toTitle));
  }else{
    title=view.commission.title;paragraph(view.commission.request);actions.push(context.action('回到铁砧',context.leaveScene,true));
  }

  if(h&&['receipt','chapter','complete','ending','defeat'].includes(mode))for(const event of state.eventHistory.filter(e=>e.day===h.day)){
    const card=element('section',undefined,'v4-event-receipt');
    card.append(element('h3',EVENTS[event.id].name+' · '+(event.choice==='accept'?'已接受':'已婉拒')),context.prop(event.id),element('p',event.choice==='accept'?EVENTS[event.id].result:'保留了眼前的剑与金币，没有追加代价。'));
    if(event.coins)card.append(element('p',`${event.coins>0?'收入':'花费'} ${fmt(Math.abs(event.coins))}金币`));
    if(event.pieceId){const blade=state.blades.find(b=>b.id===event.pieceId);if(blade)card.append(context.thumb(blade),element('p',`这柄${RECIPES[blade.recipe].name}已换出，不再计入交付或留剑。`));}body.append(card);
  }
  body.dataset.chapter=String(view.chapter.id);
  if(image.includes('twin-stations-'))body.classList.add('v4-twin-outcome');
  if(image.startsWith(CHAPTER_THREE))body.classList.add('v4-scene-panorama');
  return{title,body,actions,image,mode};
}
