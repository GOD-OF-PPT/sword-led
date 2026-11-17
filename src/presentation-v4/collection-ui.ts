import { packageUrl } from '../security/package-url.mjs';
import {CHAPTERS,COMMISSIONS,RECIPES,RECIPE_IDS,TRAITS,TRAIT_IDS,describeRoute} from '../core-v4/index.js';
import type {Blade} from '../core-v4/index.js';
import type {CollectionState,CollectionWork} from '../application/v4-collection.js';
import {element} from '../presentation/dom.js';
import {traitArt} from '../presentation-v3/art.js';
import {commissionImage} from './journey.js';

interface BookContext {
  pending:boolean;
  problem:boolean;
  canStart:boolean;
  thumb(blade:Blade):HTMLElement;
  action(label:string,run:()=>void,primary?:boolean,disabled?:boolean):HTMLElement;
  viewWork(id:number):void;
  challenge():void;
}
const fmt=(value:number)=>value.toLocaleString('zh-CN');

/** Collection receipts are already validated. This surface never constructs a run or grants awards. */
export function collectionBook(data:CollectionState,context:BookContext):HTMLElement {
  const body=element('div',undefined,'v4-book');
  body.append(element('p',`已入册 ${data.works.length}/12 件委托作品 · 走完章节 ${data.chapters.length}/3`));
  if(context.pending||context.problem)body.append(element('p','部分新成果尚待安全保存，请查看保存详情。','v4-collection-warning'));
  const chapters=element('p',data.chapters.length?data.chapters.map(id=>CHAPTERS[id-1]!.title+' · 已走完').join(' / '):'灯路从第一炉开始，真正走完的章节会留在这里。');body.append(chapters);
  const recipes=element('section',undefined,'v4-collection-recipes');recipes.append(element('h3','留下的配方与手艺'));
  for(const id of RECIPE_IDS){
    const unlocked=id==='light'||data.chapters.includes(id==='guard'?1:2),card=element('p');card.dataset.mastery=id;
    card.append(element('b',RECIPES[id].name+'：'),element('span',unlocked?'可自由使用':'随主线借用后解锁；走完相应章节即可自由使用'),element('small',data.mastery.includes(id)?'名器熟练已留名':'交出等级≥9的合格名器，可留下熟练记录'));recipes.append(card);
  }
  const traits=element('details',undefined,'v4-collection-traits');traits.append(element('summary',`手艺见闻 · ${data.traits.length}/6`));
  const traitGrid=element('div',undefined,'v4-choice-grid');
  for(const id of TRAIT_IDS){const known=data.traits.includes(id),card=element('article',undefined,'v4-card');card.dataset.discovery=id;card.append(traitArt(id),element('h3',TRAITS[id].name+(known?' · 已见闻':' · 尚未学过')),element('p',TRAITS[id].text));traitGrid.append(card);}traits.append(traitGrid);recipes.append(traits);body.append(recipes);
  const grid=element('div',undefined,'v4-book-grid');
  for(const c of COMMISSIONS){
    const work=data.works.find(w=>w.commissionId===c.id),card=element('article',undefined,'v4-card');card.dataset.record=String(c.id);
    card.append(element('h3',`${c.id}. ${c.title}`));
    if(work){for(const b of work.blades)card.append(context.thumb(b));card.append(element('p',work.blades.map(b=>`${RECIPES[b.recipe].name} · ${fmt(b.value)}`).join(' / ')),element('small',`${c.name}的委托 · 第${work.day}天交付`),context.action('翻看这件作品',()=>context.viewWork(c.id)));}
    else card.append(element('p','尚未留名'),element('small',c.request));grid.append(card);
  }
  body.append(grid,element('h3','下一程，换一种打造计划'));
  body.append(element('p',data.challenge?'十二灯复明的旅程已经留名。行脚挑战会重排章内委托，商人仍在第3、6、9天到访；配方与手艺需要重新安排。':'完成“十二灯复明”结局后开启行脚挑战；已经取得的章节与作品会一直留下。'));
  if(data.challenge)body.append(context.action('开启行脚挑战',context.challenge,true,context.pending||context.problem||!context.canStart));
  return body;
}

export function collectionWorkPage(work:CollectionWork,thumb:(blade:Blade)=>HTMLElement):HTMLElement {
  const c=COMMISSIONS[work.commissionId-1]!,route=c.routes.find(r=>r.id===work.routeId)!,body=element('article',undefined,'v4-work-page');
  const image=element('img');image.src=packageUrl(commissionImage(c.id,{complete:true,routeId:work.routeId,count:work.blades.length,required:route.count}));image.alt=c.title+'的用途场景';image.onerror=()=>{image.onerror=null;image.src=packageUrl('/assets/d/v07/lantern-road-v1.webp');};
  body.append(element('p',c.success),element('h3','这一程的约定'),element('p',describeRoute(route)),element('p',`${c.name} · 第${work.day}天交付 · ${work.blades.length===1?'一柄剑，接住了约定':'两柄剑，各自送到等剑的人手里'}`));
  for(const blade of work.blades){const card=element('section',undefined,'v4-work-receipt');card.dataset.piece=blade.id;card.append(thumb(blade),element('h3',`${RECIPES[blade.recipe].name} · ${fmt(blade.value)}身价`),element('p',`等级 ${blade.level} · 普通锤 ${blade.hits}次 · 安全连锻 ${blade.bursts}次 · ${blade.cracked?'有裂纹':'无裂纹'}`),element('p',`第${blade.suppliedDay}天来料${blade.suppliedDay<work.day?'，作为旧剑接续这一程':'，当日打造交付'} · 来料底价 ${fmt(blade.base)} · 曾达身价 ${fmt(blade.peak)}`));body.append(card);}
  const scene=element('details',undefined,'v4-work-scene');scene.append(element('summary','看看它去了哪里'),image);body.append(scene,element('small','炉谱记下了各委托的最佳成品。带上沿途学会的配方，再启一程，试试新的打造计划。'));return body;
}
