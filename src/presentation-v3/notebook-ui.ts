import type {Blade,RunState} from '../core-v3/index.js';
import {element} from '../presentation/dom.js';
import {bladeAppearance} from './appearance.js';
import {assessBlade,getNotebook} from './notebook.js';
import type {NotebookKind,CustomerId} from './notebook.js';

const thanks:Record<NotebookKind,string>={debut:'巡夜的路，这柄剑正好。',light:'轻快得很，山路也不怕长了。',burst:'这炉火，真的留在剑上了。',return:'同行过一程的剑，我会珍惜。',cracked:'这道裂纹，也有它的故事。',masterwork:'这一柄，值得留下名字。',doubleBurst:'两次炉火，果然不同。',finale:'这一程的好剑，都记在这里。'};
const fmt=(n:number)=>n.toLocaleString('zh-CN');
export function notebookPages(s:RunState,changed:()=>void=()=>{}){
 const view=getNotebook(s),body=element('div',undefined,'v3-notebook-body');
 body.append(element('p',`${view.title} · 本炉作品 ${view.works.length}/${s.roundLimit}`,'v3-book-heading'),element('p','回顾本炉已交差的成品。印签只作评鉴，没有额外奖励；不合建议的剑仍可照常交差。','v3-book-explainer'));
 const pages=element('div',undefined,'v3-notebook-pages');
 for(const page of view.pages){
  const article=element('article');article.dataset.notebookRound=String(page.round);article.dataset.notebookStatus=page.status;
  article.append(element('small',`第 ${page.round} 页`));
  const person=page.work?.request??page.request;
  if(person){const portrait=element('span',undefined,'v3-book-person');portrait.dataset.customer=person.customer;portrait.setAttribute('aria-hidden','true');article.append(portrait);}
  if(page.work){const {blade,request}=page.work,look=bladeAppearance(blade),canvas=element('canvas');canvas.dataset.notebookPiece=blade.id;canvas.setAttribute('aria-hidden','true');article.append(element('h3',`${request.name} · ${request.title}`),canvas,element('b',`${look.name} · ${look.rank}`),element('p',`身价 ${fmt(blade.value)} · 等级 ${blade.level}${blade.cracked?' · 真实裂纹保留':' · 完好'}`),element('small',page.work.condition),element('span','记','v3-work-mark'));}
  else{article.append(element('h3',page.request?`${page.request.name} · ${page.request.title}`:'待来客'),element('p',page.request?.condition??'本炉尚未遇见这一页的来客。'),element('small',page.status==='missed'?'本轮未成合意作品，原契约照常结算。':page.status==='today'?'今天可以试一试，也可先保住主契约。':page.status==='tomorrow'?'明日预告，留一手也许用得上。':'未来的作品，留待炉火。'));}
  pages.append(article);
 }
 if(s.roundLimit%2){const end=element('article',undefined,'v3-book-endpage');end.append(element('h3','这一炉，先记到这里'),element('p','三页练手，也是好剑的开始。'));pages.append(end);}
 const nav=element('nav',undefined,'v3-book-nav'),previous=element('button','往前翻'),position=element('span',undefined,'v3-book-spread-label'),next=element('button','往后翻');nav.setAttribute('aria-label','手札翻页');position.setAttribute('aria-live','polite');
 let spread=Math.floor((s.round-1)/2);const sheets=Array.from(pages.children);
 function turn(){sheets.forEach((node,i)=>{(node as HTMLElement).hidden=Math.floor(i/2)!==spread;});previous.disabled=spread===0;next.disabled=spread>=Math.ceil(s.roundLimit/2)-1;position.textContent=`第 ${spread*2+1}–${Math.min(s.roundLimit,spread*2+2)} 页 / ${s.roundLimit}`;changed();}
 previous.onclick=()=>{if(spread>0){spread--;turn();}};next.onclick=()=>{if(spread<Math.ceil(s.roundLimit/2)-1){spread++;turn();}};nav.append(previous,position,next);body.append(pages,nav);turn();return body;
}
export function notebookSummary(s:RunState,open:()=>void){
 const view=getNotebook(s),body=element('section',undefined,'v3-notebook-summary'),button=element('button','翻开本炉手札');button.onclick=open;
 body.append(element('b',`本炉作品 ${view.works.length}/${s.roundLimit} · ${view.title}`),element('p',view.currentWork?`${view.currentWork.request.name} · ${view.currentWork.request.title}：${bladeAppearance(view.currentWork.blade).name}，身价${fmt(view.currentWork.blade.value)}。`:'本轮来客建议可以放下，手札仍记得此前的作品。'),button);return body;
}
export function paintNotebook(root:HTMLElement,s:RunState,draw:(canvas:HTMLCanvasElement,b:Blade)=>void){
 for(const c of root.querySelectorAll<HTMLCanvasElement>('[data-notebook-piece]')){const b=s.blades.find(b=>b.id===c.dataset.notebookPiece);if(b&&c.getBoundingClientRect().width>0)draw(c,b);}
}
/** Owns only one pose timer/animation; state and rewards remain outside presentation. */
export function createNotebookScene(root:HTMLElement,reduced:()=>boolean){
 const find=(id:string)=>{const node=root.querySelector<HTMLElement>('#'+id);if(!node)throw Error(`Missing ${id}`);return node;};
 const figure=find('v3-customer-figure'),talk=find('v3-customer-talk'),paper=find('v3-order-paper'),book=find('v3-notebook');
 let timer:ReturnType<typeof setTimeout>|null=null,animation:Animation|null=null,customer:CustomerId|null=null,token=0;
 function reset(){token++;if(timer!==null)clearTimeout(timer);timer=null;animation?.cancel();animation=null;figure.dataset.pose='waiting';talk.textContent='';}
 return{reset,render(s:RunState,b:Blade|null,customerReady:boolean,coverReady:boolean){
  const view=getNotebook(s),request=view.current,a=b?assessBlade(s,b,request):null;
  if(customer!==request.customer){reset();customer=request.customer;figure.dataset.customer=customer;}
  root.firstElementChild?.classList.toggle('customer-art-ready',customerReady);root.firstElementChild?.classList.toggle('book-art-ready',coverReady);
  figure.setAttribute('aria-label',`${request.name}在炉边等候${request.title}作品`);figure.dataset.notebookKind=request.kind;
  find('v3-customer-name').textContent=`${request.name} · ${request.title}`;
  find('v3-customer-condition').textContent=view.currentWork?.condition??a?.condition??request.condition;
  find('v3-customer-difference').textContent=view.currentWork?'这页已记下，交差仍照常填主契约。':a?.reason??'可以换下一柄，也可以先查看收工结果。';
  find('v3-next-customer').textContent=view.next?`明日：${view.next.title}${view.next.kind==='return'?` · 旧剑≥${fmt(view.next.target)}`:''}`:'本炉收官，作品留在手札。';
  find('v3-customer-motive').textContent=request.motive;paper.dataset.notebookComplete=String(!!view.currentWork);find('v3-paper-mark').hidden=!view.currentWork;
  find('v3-notebook-count').textContent=`已评鉴 ${view.works.length}/${s.roundLimit}`;book.setAttribute('aria-label',`本炉手札，已评鉴${view.works.length}/${s.roundLimit}，只读无额外奖励`);
 },play(before:RunState,after:RunState){
  if(document.hidden||before.runId!==after.runId)return;
  const old=getNotebook(before),work=getNotebook(after).works.find(w=>!old.works.some(p=>p.round===w.round));if(!work)return;
  reset();const current=token;figure.dataset.pose='thanks';talk.textContent=`${work.request.name}：${thanks[work.request.kind]}`;
  if(!reduced()){animation=figure.animate([{transform:'translateY(5px)'},{transform:'translateY(0)'}],{duration:450,easing:'ease-out'});void animation.finished.catch(()=>{});}
  timer=setTimeout(()=>{if(current!==token)return;reset();},2400);
  return work;
 }};
}
