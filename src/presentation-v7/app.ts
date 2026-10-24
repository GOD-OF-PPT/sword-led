import {getRunView,errorText} from '../core-v7/index.js';
import type {Action,ActionView,CharacterView,DomainEvent,RunState,RunView,WeaponView} from '../core-v7/index.js';
import {V7_SAVE_KEY,V7_BACKUP_KEY} from '../application/v7-persistence.js';
import type {V7Session} from '../application/v7-persistence.js';
import {createPreferences} from '../platform/settings.js';
import {createForgeAudio} from '../platform/audio.js';
import {IMPACT_SOUNDS} from '../presentation-v3/impact.js';
import {SWORD_ART} from '../presentation-v6/sword-art.js';
import {STANDING_ART} from './standing-art.js';
import {CAMPAIGN_SHELL} from './shell.js';
import {createCampaignScene} from './scene.js';
import {choiceTitles,resultFeedback} from './feedback.js';
import type {NoticeTone} from './feedback.js';

interface DialogChoice {label:string;run:()=>void;primary?:boolean;disabled?:boolean}
const elem=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};

/** The session owns facts. This layer owns focus, scenes and short-lived presentation. */
export function mountCampaign(root:HTMLElement,port:V7Session){
 root.innerHTML=CAMPAIGN_SHELL;
 const game=root.firstElementChild as HTMLElement;
 const node=<T extends HTMLElement=HTMLElement>(id:string):T=>{const e=root.querySelector<T>('#'+id);if(!e)throw Error('Missing '+id);return e;};
 const dialog=node<HTMLDialogElement>('c7-dialog');
 const preferences=createPreferences(()=>window.localStorage),audio=createForgeAudio(undefined,IMPACT_SOUNDS),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let snapshot=port.getSnapshot(),prefs=preferences.getSnapshot(),route:'title'|'play'='title';
 let disposed=false,busy=false,modal=false,sequence=0,display:RunState|null=null,origin:HTMLElement|null=null;
 let noticeTimer:ReturnType<typeof setTimeout>|null=null,arrivalTimer:ReturnType<typeof setTimeout>|null=null;
 const covers=new Set<Animation>();
 let scene:ReturnType<typeof createCampaignScene>|null=null;
 const reduced=()=>prefs.value.reducedMotion||motion.matches;
 const current=()=>snapshot.state;
 const writable=()=>snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory');
 const canAct=()=>!disposed&&!busy&&!modal&&route==='play'&&!document.hidden&&writable();
 const show=(id:string,value:boolean)=>{node(id).hidden=!value;};
 const text=(id:string,value:string)=>{node(id).textContent=value;};
 const button=(label:string,run:()=>void,primary=false)=>{const e=elem('button',label,`c7-button ${primary?'is-primary':'is-secondary'}`);e.type='button';e.onclick=run;return e;};
 function notice(copy:string,tone:NoticeTone='quiet',title?:string){
  if(noticeTimer)clearTimeout(noticeTimer);const e=node('c7-notice');e.dataset.tone=tone;
  e.replaceChildren(...(title?[elem('strong',title),elem('span',copy)]:[elem('span',copy)]));show('c7-notice',!!copy);
  game.dataset.notice=String(!!copy);
  if(copy)noticeTimer=setTimeout(()=>{show('c7-notice',false);game.dataset.notice='false';noticeTimer=null;},tone==='quiet'?4600:tone==='danger'?8500:7200);
 }
 function cancelVisuals(){sequence++;scene?.cancel();for(const cover of covers)cover.cancel();covers.clear();busy=false;display=null;audio.silence();}
 function appError(code:string):string{
  const known=errorText(code as Parameters<typeof errorText>[0]);
  return known??({confirmation_required:'先确认是否替换当前旅程。',readonly:'另一个页面正在收好旅程；本页暂时只能查看。',stale_session:'旅程已变化，请重新查看后操作。',save_conflict:'本机进度有变化，请在行囊中核对。',save_unavailable:'这次没有写入磁盘，可重试保存或导出当前旅程。',not_active:'旅程正在重新取得保存权，请稍候。',locks_unsupported:'本页暂未取得保存权，可在行囊中选择不保存继续。',session_busy:'上一件事正在落定，请稍候。'} as Record<string,string>)[code]??'这一步暂时没有完成，请查看行囊或重试。';
 }
 function closeDialog(){
  if(dialog.open)dialog.close();modal=false;cancelVisuals();render();
  const previous=origin;origin=null;queueMicrotask(()=>{if(disposed||modal)return;if(previous?.isConnected&&!previous.closest('[hidden]')&&!previous.matches(':disabled'))previous.focus({preventScroll:true});});
 }
 function openDialog(title:string,body:HTMLElement|string,choices:readonly DialogChoice[]=[]){
  if(!modal)origin=document.activeElement instanceof HTMLElement?document.activeElement:null;
  cancelVisuals();modal=true;text('c7-dialog-title',title);
  node('c7-dialog-body').replaceChildren(typeof body==='string'?elem('p',body):body);
  node('c7-dialog-actions').replaceChildren(...choices.map(c=>{const e=button(c.label,c.run,!!c.primary);e.disabled=!!c.disabled;return e;}));
  render();if(!dialog.open)dialog.showModal();queueMicrotask(()=>dialog.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true}));
 }
 function confirm(title:string,copy:string,run:()=>void){
  const ticket={generation:snapshot.generation,id:current()?.runId,revision:current()?.revision};
  openDialog(title,copy,[{label:'再想想',run:closeDialog},{label:'确认',primary:true,run:()=>{
   const valid=ticket.generation===snapshot.generation&&ticket.id===current()?.runId&&ticket.revision===current()?.revision;
   closeDialog();if(valid)run();else notice('旅程已有变化，请重新查看这一步。');
  }}]);
 }
 function take(value:ActionView){
  if(!value.allowed){notice(value.reason??'这一步暂时不可用。');return;}
  const run=()=>{if(modal)closeDialog();send(value.action);};
  if(value.requiresConfirmation)confirm(value.label,value.requiresConfirmation,run);else run();
 }
 function actionButton(value:ActionView,primary=false,detail=false):HTMLButtonElement{
  const e=button(value.label,()=>take(value),primary);e.dataset.action=value.action.type;
  if('kind'in value.action)e.dataset.kind=value.action.kind;
  if('slot'in value.action)e.dataset.slot=value.action.slot;
  if('targetId'in value.action)e.dataset.target=value.action.targetId;
  if('choice'in value.action)e.dataset.choice=value.action.choice;
  if('weaponId'in value.action)e.dataset.weaponId=value.action.weaponId;
  if('item'in value.action)e.dataset.item=value.action.item;
  e.disabled=!value.allowed||!writable()||busy;e.title=value.reason??value.detail;
  if(detail){e.replaceChildren(elem('strong',value.label),elem('p',value.detail));if(value.reason)e.append(elem('small',value.reason));}
  return e;
 }
 function cue(events:readonly DomainEvent[]){
  const f=events.find(e=>e.type==='Forged'),ending=events.find(e=>e.type==='EndingReached'),strike=events.find(e=>e.type==='Struck'),mechanism=events.find(e=>e.type==='MechanismUsed');
  const endingCue=ending?ending.kind==='relit'?'victory':ending.kind==='homeward'?'delivery':'defeat':null;
  audio.acceptedCue(endingCue??(f?.type==='Forged'?f.result==='broken'?'broken':f.result==='crack'?'damage':f.kind==='ordinary'?'standard':'heavy':events.some(e=>e.type==='Failed')?'defeat':strike?strike.damage===0?'light':'heavy':events.some(e=>e.type==='RoundEnded'&&e.loss>0)?'damage':events.some(e=>e.type==='Guarded'||e.type==='Equipped'||e.type==='Sealed')?'light':events.some(e=>e.type==='ForgeStarted'||e.type==='Tempered')?'heat':mechanism?mechanism.mechanism==='core'?'delivery':mechanism.mechanism.includes('rope')?'heavy':'met':events.some(e=>e.type==='ShopUsed'||e.type==='ToolChanged')?'purchase':'met'));
 }
 function arrive(view:RunView){
  if(arrivalTimer)clearTimeout(arrivalTimer);
  const e=node('c7-arrival');e.querySelector('span')!.textContent=`第${view.chapter}章 · ${view.chapterTitle}`;e.querySelector('strong')!.textContent=view.title;e.hidden=false;
  arrivalTimer=setTimeout(()=>{e.hidden=true;arrivalTimer=null;},reduced()?1000:1800);
 }
 function send(action:Action){
  const before=current();if(!before||!canAct())return;
  if(arrivalTimer){clearTimeout(arrivalTimer);arrivalTimer=null;show('c7-arrival',false);}
  cancelVisuals();notice('');busy=true;display=before;const own=++sequence,generation=snapshot.generation,beforeView=getRunView(before);
  void audio.gesture();
  const result=port.dispatch({runId:before.runId,expectedRevision:before.revision,action},generation);
  if(!result.ok){busy=false;display=null;notice(appError(result.error));render();return;}
  const after=getRunView(result.state),valid=()=>!disposed&&own===sequence&&snapshot.generation===generation&&current()?.runId===result.state.runId&&current()?.revision===result.state.revision;
  render();
  const forgeShift=beforeView.phase!==after.phase&&result.events.some(e=>e.type==='ForgeStarted'||e.type==='Sealed'||e.type==='Discarded');
  const transition=!result.events.some(e=>e.type==='Donated'&&e.recipient==='lamp')&&(forgeShift||result.events.some(e=>e.type==='ChoiceMade'||e.type==='EncounterStarted'||e.type==='ChapterStarted'||e.type==='Retried'||e.type==='EndingReached'));
  let covered:Promise<unknown>=Promise.resolve();
  if(transition&&!forgeShift&&!reduced()){
   const cover=node('c7-curtain').animate([{opacity:0},{opacity:1,offset:.34},{opacity:1,offset:.60},{opacity:0}],{duration:620,easing:'ease-in-out'});covers.add(cover);covered=cover.finished.catch(()=>{}).finally(()=>covers.delete(cover));
  }
  const contact=()=>{if(!valid())return;
   if(transition){display=result.state;render();if(forgeShift&&!reduced()){const reveal=game.querySelector<HTMLElement>('.c7-world')!.animate([{opacity:.35},{opacity:1}],{duration:180});covers.add(reveal);void reveal.finished.catch(()=>{}).finally(()=>covers.delete(reveal));}}else{renderVitals(after);renderRack(after);renderTool(after);renderForgeReadout(after);}
   const round=result.events.find(e=>e.type==='RoundEnded');
   if(round?.type==='RoundEnded'&&after.phase==='encounter')node('c7-turn').replaceChildren(elem('strong',`第${round.round}轮 · 敌方行动`),elem('span',`灯火 ${round.before} → ${round.after}`),elem('small','这一轮正在落定，随后恢复两次行动'));
   game.dataset.contactRevision=String(after.revision);
   const feedback=resultFeedback(result.events,beforeView,after);notice(feedback.copy,feedback.tone,feedback.title);cue(result.events);
  };
  const playing=scene?scene.play(result.events,beforeView,after,contact):Promise.resolve().then(contact);
  void Promise.all([playing,covered]).then(()=>{if(!valid())return;busy=false;display=null;render();if(after.chapter!==beforeView.chapter)arrive(after);}).catch(()=>{if(valid()){busy=false;display=null;render();}});
 }
 function fresh(){return{runId:crypto.randomUUID(),seed:`护炉-${crypto.randomUUID().slice(0,12)}`};}
 function start(confirmed=false){
  const r=port.startNewGame(fresh(),{generation:snapshot.generation,confirmed});
  if(!r.ok){if(r.error==='confirmation_required')confirm('另起一趟旅程？','当前旅程会被替换。想留住这趟记忆，可先在行囊中导出；取消会保留眼前进度。',()=>start(true));else{notice(appError(r.error));save();}return;}
  route='play';closeDialog();render();const v=current();if(v)arrive(getRunView(v));void audio.gesture();
 }
 function continueRun(){if(!current())return;route='play';cancelVisuals();render();void audio.gesture();}
 function portrait(target:HTMLElement,value:CharacterView){
  const p=value.portrait;target.style.backgroundImage=`url("${p.path}")`;target.style.backgroundSize='300% 200%';target.style.backgroundPosition=`${p.x===0?0:p.x===418?50:100}% ${p.y===0?0:100}%`;
 }
 function standing(target:HTMLElement,value:CharacterView){
  const frame=STANDING_ART.frames.find(f=>f.id===value.id)!;
  const height=Math.min(360,game.clientHeight*.4),scale=height/frame.height;
  target.style.width=`${frame.width*scale}px`;target.style.height=`${height}px`;target.style.marginInline='auto';
  target.style.backgroundImage=`url("${STANDING_ART.src}")`;target.style.backgroundSize=`${STANDING_ART.width*scale}px ${STANDING_ART.height*scale}px`;target.style.backgroundPosition=`${-frame.x*scale}px ${-frame.y*scale}px`;
  node('c7-companion').style.height=`${height}px`;node('c7-companion').style.minHeight=`${height}px`;
 }
 function inspectWeapon(value:WeaponView){
  cancelVisuals();
  const v=current()?getRunView(current()!):null;if(!v)return;
  const body=elem('div',undefined,'c7-weapon-sheet'),figure=elem('div',undefined,'c7-weapon-figure'),art=elem('span',undefined,'c7-weapon-art'),f=SWORD_ART.frames[3],scale=230/f.width;
  art.setAttribute('aria-hidden','true');art.style.height=`${f.height*scale}px`;art.style.backgroundImage=`url("${SWORD_ART.src}")`;art.style.backgroundSize=`${SWORD_ART.width*scale}px ${SWORD_ART.height*scale}px`;art.style.backgroundPosition=`${-f.x*scale}px ${-f.y*scale}px`;figure.dataset.condition=value.status;figure.append(art);
  const facts=elem('div',undefined,'c7-weapon-facts');facts.append(elem('strong',`当前强度 ${value.strength}`),elem('p',value.sealedStrength!==null?`收锻时强度 ${value.sealedStrength}`:'仍在锻造中'),elem('p',value.condition),elem('small',value.ownerLabel));figure.append(facts);body.append(figure);
  if(value.kind==='inherited')body.append(elem('p','杜伯留下的旧剑能开路、挡护；母灯最后需要你亲手打造的剑。'));
  else if(value.finalEligible)body.append(elem('p','这柄剑已符合母灯的用剑条件。先留住它，走到山口还要停轮、放灯、架稳。'));
  const related=v.actions.filter(a=>'weaponId'in a.action&&a.action.weaponId===value.id&&['equip','discardWeapon','temper'].includes(a.action.type));
  const controls=elem('div',undefined,'c7-weapon-controls');controls.append(...related.map(a=>actionButton(a,false,true)));body.append(controls);openDialog(value.name,body);
 }
 function renderRack(v:RunView){
  const slots=node('c7-rack');slots.replaceChildren();
  for(const [kind,value]of Object.entries(v.slots)){
   const e=elem('button',undefined,'c7-rack-slot');e.type='button';e.dataset.slot=kind;e.dataset.condition=value?.kind??'empty';
   e.append(elem('small',kind==='hand'?'手中':'备用 · 换手'),elem('b',value?`${value.name} · ${value.strength}`:'空剑位'));
   if(value){const art=elem('span',undefined,'c7-mini-blade'),f=SWORD_ART.frames[3],scale=98/f.width;art.setAttribute('aria-hidden','true');art.style.height=`${f.height*scale}px`;art.style.marginBlock='16px';art.style.backgroundImage=`url("${SWORD_ART.src}")`;art.style.backgroundSize=`${SWORD_ART.width*scale}px ${SWORD_ART.height*scale}px`;art.style.backgroundPosition=`${-f.x*scale}px ${-f.y*scale}px`;e.prepend(art);e.title=`${value.condition}；${kind==='reserve'?'点此换手':'点此查看这柄剑'}`;
    e.onclick=()=>{const equip=v.actions.find(a=>a.action.type==='equip'&&a.action.weaponId===value.id);if(kind==='reserve'&&equip?.allowed&&writable())take(equip);else inspectWeapon(value);};
   }else{e.disabled=true;e.title='空位可在收锻时放入一柄新剑。';}
   e.disabled||=busy;slots.append(e);
  }
 }
 function renderTool(v:RunView){
  show('c7-tool',!!v.tool||v.phase==='forging');
  if(v.phase==='forging'){
   const tool=node('c7-tool'),img=elem('img'),info=elem('div');img.src='/assets/d/hammer-standard-v1.webp';img.alt='';info.append(elem('strong','这一炉手艺'),elem('small',v.charge?`可用 ${v.charge} 次`:'次数已用完','c7-tool-status'));
   const techniques=v.actions.filter(a=>a.action.type==='forge'&&a.action.kind!=='ordinary');tool.dataset.ready=String(techniques.some(a=>a.allowed));tool.dataset.stored='false';
   for(const kind of ['steady','fissure'] as const){const a=techniques.find(a=>a.action.type==='forge'&&a.action.kind===kind),projected=v.forge?.[kind];if(a&&projected){const b=actionButton({...a,label:kind==='steady'?'用定线':'刻崩纹'},a.allowed);b.append(elem('span',a.reason??`强度 → ${projected.strengthAfter} · 用1次`,'c7-action-detail'));b.append(elem('small',kind==='fissure'?'斩击穿甲＋2 · 每斩磨损2':'不添新裂 · 成器后不磨损','c7-technique-tradeoff'));info.append(b);}}
   tool.replaceChildren(img,info);tool.title='普通锤点剑身；这两种手艺点击就用出一记，共享一次机会。';
  }else if(v.tool){const tool=node('c7-tool'),img=elem('img'),info=elem('div');img.src=v.tool.asset;img.alt='';info.append(elem('strong',`${v.tool.name}${v.tool.level===2?' · 二阶':''}`));tool.replaceChildren(img,info);tool.title=v.tool.description;tool.dataset.stored=String(v.tool.stored>0);
   const active=v.actions.filter(a=>a.action.type==='temper'||a.action.type==='followUp'&&a.allowed);tool.dataset.ready=String(active.some(a=>a.allowed));
   if(v.tool.kind==='furnace')info.append(elem('small',v.charge?'手艺 1 次可用':'手艺次数已用完','c7-tool-status'));
   for(const a of active){const cost=a.action.type==='followUp'||v.phase==='prepare'?0:1,b=actionButton({...a,label:`${a.action.type==='temper'?'续炉':a.label} · ${cost}行动`},a.allowed);if(a.action.type==='temper')b.append(elem('span',a.reason??'用1次手艺，修复手中剑','c7-action-detail'));info.append(b);}
   if(v.tool.kind==='rebound')info.append(elem('small',v.encounter?.followUpUsed?'本场追斩已用完':v.tool.stored?`余力 ${v.tool.stored} · ${active.some(a=>a.allowed)?'可免费追斩':'已留住，带往下一战'}`:'击破时有溢出，才会存下余力','c7-tool-status'));
   else info.append(elem('small',v.encounter?.furnaceTriggered?'本场回充已触发，不会再补':v.encounter?'本场首次击破带甲目标，可补到1次':'击破带甲目标才回充；买坯不补次数'));
  }
 }
 function forecastLine(v:RunView):string{
  return v.briefing?.targets.map(t=>`${t.name} ${t.health}耐久 / 甲${t.armor}${t.damage!==null?`：直斩${t.damage} · 架剑后${t.guardedDamage}`:'：落锤后看伤害'}`).join('；')??'';
 }
 function renderForgeReadout(v:RunView){
  show('c7-forge-readout',!!v.forge);if(!v.forge)return;
  const f=v.forge,e=node('c7-forge-readout');e.replaceChildren(elem('strong',`强度 ${f.weapon.strength}`),elem('p',`${f.weapon.condition} · ${f.weapon.hits}/6记`),elem('small',`铁坯 ${v.blanks} · 手艺 ${v.charge}次 · ${f.ordinary.crackTickets===0?'下一锤安全':`下一锤${f.ordinary.crackTickets/10}%${f.ordinary.breaksOnCrack?'再裂即碎':'首裂，强度−1'}`}`),elem('p',forecastLine(v),'c7-forge-purpose'));
  if(v.briefing?.alternative)e.append(elem('small',v.briefing.alternative));
 }
 function renderBriefing(v:RunView){
  const panel=node('c7-briefing');show('c7-briefing',v.phase==='prepare'&&!v.choice&&!!v.briefing);if(v.phase!=='prepare'||!v.briefing)return;
  panel.replaceChildren(elem('small',v.node===4?'雪线上，下一程的消息':'前路已探明 · 先为这一程备剑'));
  const targets=elem('div',undefined,'c7-briefing-targets');
  for(const t of v.briefing.targets){const row=elem('div',undefined,'c7-briefing-target'),info=elem('div');if(t.asset){const img=elem('img');img.src=t.asset;img.alt='';row.append(img);}info.append(elem('b',t.name),elem('small',`${t.health}耐久 · 护甲${t.armor}`),elem('p',t.damage===null?'手中还没有可用剑':`${v.briefing.bladeName}：直斩 ${t.damage} / 架剑后 ${t.guardedDamage}`));row.append(info);targets.append(row);}panel.append(targets);
  if(v.briefing.alternative)panel.append(elem('p',v.briefing.alternative,'c7-briefing-route'));
  if(v.briefing.toolHint)panel.append(elem('small',v.briefing.toolHint));
 }
 function renderTurn(v:RunView){
  show('c7-turn',v.phase==='encounter');if(!v.encounter)return;
  const e=v.encounter,t=node('c7-turn');t.dataset.empty=String(e.actions===0);t.replaceChildren(elem('strong',`第${e.round}/${e.roundLimit}轮`),elem('span',`行动 ${'◆'.repeat(e.actions)}${'◇'.repeat(2-e.actions)}`),elem('small',`压力${e.pressure.pressure} − 援手${e.pressure.reduction} − 护势${e.block}${e.braced?' · 已架稳':''}`));
  const cost=elem('small',`现在结束：${e.pressure.loss?`灯火−${e.pressure.loss}`:'灯火无损'}`);cost.dataset.danger=String(e.pressure.loss>0);t.append(cost);
  const next=e.opening?e.targets.find(target=>target.health>0&&!target.dependency&&target.preview):null;if(next?.preview)t.append(elem('small',`下一斩 · ${next.name}可受${next.preview.damage}伤害`,'c7-next-hit'));
 }
 function renderVitals(v:RunView){
  node('c7-lamp').replaceChildren(...Array.from({length:8},(_,i)=>{const e=elem('i');e.dataset.lit=String(i<v.lamp);e.setAttribute('aria-hidden','true');return e;}),elem('strong',`${v.lamp}/8`));node('c7-lamp').setAttribute('aria-label',`灯火${v.lamp}/8`);text('c7-coins',`◉ ${v.coins}钱`);renderTurn(v);
 }
 function projectWorld(v:RunView){
  game.querySelector<HTMLElement>('.c7-world')!.style.backgroundImage=`url("${v.scene.background}")`;
  standing(node('c7-companion').querySelector<HTMLElement>('.c7-person')!,v.speaker);text('c7-speaker',v.speaker.name);text('c7-line',v.speaker.line);
  show('c7-companion',v.phase!=='forging');
 }
 function renderMechanisms(v:RunView){
  const panel=node('c7-mechanisms'),actions=v.phase==='encounter'?v.actions.filter(a=>a.group==='mechanism'):[];
  panel.replaceChildren();show('c7-mechanisms',actions.length>0);game.dataset.mechanisms=String(actions.length>0);
  if(!actions.length)return;panel.append(elem('small',v.node===9?'修复母灯 · 每一步都要落定':'这段路的其他办法'));
  for(const a of actions){
   const weaponId='weaponId'in a.action?a.action.weaponId:null,w=v.works.find(value=>value.id===weaponId);
   const isDone=a.action.type==='placeCore'&&v.storyFlags.coreOwner==='socket'||a.action.type==='assistBrace'&&!!v.encounter?.braceAssistUsed;
   const label=a.action.type==='donate'?(a.action.recipient==='shelter'?'留剑撑梁':'交剑给阿岚'):isDone&&a.action.type==='placeCore'?'灯芯已放妥':a.label;
   const missing=a.action.type==='ignite'?v.finale?.requirements.filter(r=>!r.met).slice(0,2).map(r=>r.label).join('、'):null;
   const reason=missing?`还需：${missing}`:a.reason;
   const detail=isDone?'已经完成':reason??(w?`${w.name} · 强度${w.strength} · 用1行动${a.action.type==='donate'?'，剑会留下':''}`:['ferryAssist','assistBrace'].includes(a.action.type)?'不耗行动 · 本段一次':'用1行动');
   const b=actionButton({...a,label},a.allowed);b.append(elem('span',detail,'c7-action-detail'));panel.append(b);
  }
 }
 function renderActions(v:RunView){
  const area=node('c7-actions');area.replaceChildren();
  const choices=v.actions.filter(a=>a.group==='choice');
  const choiceVisible=choices.length>0&&v.phase!=='forging';show('c7-choice',choiceVisible||v.phase==='failed');
  if(choiceVisible){const panel=node('c7-choice');panel.replaceChildren(elem('small',`${v.speaker.name}在等你回应`),elem('h2',choiceTitles[v.choice??'']??'眼前的选择'),elem('p',v.speaker.line,'c7-choice-line'),...choices.map(a=>{const e=actionButton(a,false,true);e.classList.add('c7-choice-option');return e;}));}
  if(v.phase==='failed'){
   const panel=node('c7-choice');panel.replaceChildren(elem('small',`止步于 ${v.title}`),elem('h2','先把这口火记住'),elem('p',v.failure?.text??'这趟暂且止步。'),...v.actions.filter(a=>a.action.type==='retryChapter'||a.action.type==='acceptFailure').map(a=>actionButton(a,a.action.type==='retryChapter',true)));
  }
  if(v.phase==='prepare'){
   const depart=v.actions.find(a=>a.action.type==='depart'),forge=v.actions.find(a=>a.action.type==='beginForge');
   const firstForge=v.node===1&&!v.works.some(w=>w.source==='forged'&&w.status==='sealed');
   if(forge)area.append(actionButton({...forge,label:firstForge?'为这趟路，打一柄剑':'随行炉车 · 开炉'},firstForge));
   if(depart)area.append(actionButton({...depart,label:v.node===9?'去修复母灯':firstForge?'先用杜伯旧剑开路':depart.label},!firstForge));
   if([1,4,7].includes(v.node))area.append(button('炉边修整',shop));
  }else if(v.phase==='forging'){
   const seals=v.actions.filter(a=>a.action.type==='seal');for(const a of seals)area.append(actionButton({...a,label:a.action.type==='seal'&&a.action.slot==='hand'?'收锻 · 放到手中':'收锻 · 留作备用'}));
   const discard=v.actions.find(a=>a.action.type==='discardForge');if(discard){const e=actionButton({...discard,label:'放弃此坯'});e.classList.add('c7-quiet');area.append(e);}
  }else if(v.phase==='encounter'){
   const mechanisms=v.actions.filter(a=>a.group==='mechanism');
   const guard=v.actions.find(a=>a.action.type==='guard'),end=v.actions.find(a=>a.action.type==='endRound');if(guard){const b=actionButton({...guard,label:`${guard.label} · 1行动`},!mechanisms.some(a=>a.allowed));b.append(elem('span',guard.reason??'护势＋3 · 下一斩无视甲并加2','c7-action-detail'));area.append(b);}if(end){const free=v.actions.some(a=>a.allowed&&(a.action.type==='followUp'||a.action.type==='ferryAssist'||a.action.type==='assistBrace'));const b=actionButton({...end,label:`${v.encounter?.actions===0?'敌方行动':'结束本轮'}${v.encounter?.pressure.loss?` · 灯火−${v.encounter.pressure.loss}`:' · 无损'}`},v.encounter?.actions===0);if(free)b.append(elem('span','还有免费追斩 / 援手可用','c7-action-detail'));area.append(b);}
  }
  renderMechanisms(v);
  renderTool(v);
  renderForgeReadout(v);renderBriefing(v);
  const context=v.phase==='forging'?'左键剑身，亲手落锤。三记安全锤后可以收手，也可以用手艺继续打。':v.phase==='encounter'?v.encounter?.actions===0?'本轮行动已用完；若有可用的免费援手或追斩，还能先用，再结束本轮。':'点道路上的目标出剑。读信息不耗行动；只有“结束本轮”才结算风雪。':v.phase==='prepare'?'先看前路和手中两剑，再决定上路或开炉。':v.phase==='choice'?'选择会留在后面的路上。':'可以从本章起点重整一次，或记下这次止步。';
  text('c7-context',v.phase==='prepare'&&v.node===9?`母灯只收自制剑：完好强度≥3，或真正崩纹≥1。${v.finale?.handEligible?'手中这柄已经合格。':v.finale?.eligibleWeaponIds.length?'备用剑合格，可先换到手中。':'可用剩余铁坯重锻，或从章初重整。'}`:context);
 }
 function renderEnding(v:RunView){
  const e=v.ending;if(!e)return;const area=node('c7-ending');area.replaceChildren(elem('small',`护炉远行 · ${e.stoppedAt}`),elem('h1',e.title),elem('p',e.summary));
  const people=elem('div',undefined,'c7-ending-people');for(const p of e.epilogues){const card=elem('article',undefined,'c7-epilogue'),face=elem('span',undefined,'c7-portrait');portrait(face,p);card.append(face,elem('b',p.name),elem('p',p.line));people.append(card);}area.append(people);const consequences=elem('details',undefined,'c7-ending-consequences');consequences.append(elem('summary','这趟路实际留下了什么'));for(const line of e.consequences)consequences.append(elem('p',line));area.append(consequences);
  const controls=elem('div',undefined,'c7-ending-actions');controls.append(button('回看这趟灯路',road),button('再走一趟',()=>start(),true));area.append(controls);
 }
 function saveWarning():string{
  if(snapshot.mode==='memory')return'本趟暂不落盘 · 可导出旅程';
  if(snapshot.mode==='readonly')return'另一页面正在保存 · 本页只读';
  if(snapshot.conflict)return'本机行囊有变化 · 点此核对';
  if(snapshot.dirty)return'刚才的进展还未存好 · 点此重试';
  if(snapshot.mode==='unsupported'||snapshot.mode==='error')return'暂未取得保存权 · 点此选择继续方式';
  if(snapshot.load?.main.status==='invalid'||snapshot.load?.main.status==='unavailable')return'本机行程暂不可续读 · 原文保留';
  if(snapshot.load?.main.status==='empty'&&snapshot.load.backup.status==='valid')return'找到上一次行囊 · 点此恢复';
  return'';
 }
 function render(){
  if(disposed)return;const state=display??current(),v=state?getRunView(state):null;
  const screen=route==='title'?'title':v?.ending?'ending':'play';game.dataset.screen=screen;game.dataset.phase=v?.phase??'prepare';game.dataset.busy=String(busy);game.dataset.choice=String(!!v?.choice);game.dataset.reduced=String(reduced());
  show('c7-title',screen==='title');show('c7-play',screen==='play');show('c7-ending',screen==='ending');game.querySelector<HTMLElement>('.c7-hud')!.hidden=screen==='title';
  const world=game.querySelector<HTMLElement>('.c7-world')!;world.style.backgroundImage=`url("${screen==='title'?'/assets/d/v07/lantern-road-v1.webp':v?.scene.background??'/assets/d/v07/lantern-road-v1.webp'}")`;
  const warning=saveWarning();game.dataset.warning=String(!!warning);show('c7-save-warning',!!warning);text('c7-save-warning',warning);
  audio.configure(prefs.value);audio.identify(current()?.runId??'title');audio.setMode(route==='play'&&!modal&&!document.hidden?'game':'silent');
  if(screen==='title'){
   const a=node('c7-title-actions');a.replaceChildren();if(current()){const b=button(v?.ending?'回看旅程终章':`继续 · ${v?.title??'灯路'}`,continueRun,true);b.disabled=!snapshot.active;a.append(b);}
   const b=button(current()?'另起一趟旅程':'推起炉车，启程',()=>start(),!current());b.disabled=!writable();a.append(b);
   text('c7-resume-copy',v?`${v.chapterTitle} · ${v.lamp}点灯火 · ${v.ending?'这趟路已经留下结局':v.mission}`:'三章九站 · 同一柄剑、同行的人、三种结局');return;
  }
  if(!v)return;
  text('c7-chapter',`第${v.chapter}章 · ${v.chapterTitle}`);text('c7-place',v.title);text('c7-mission',v.mission);text('c7-next',`下一程 · ${v.nextPlace}`);
  renderVitals(v);
  const roadButton=node('c7-road');roadButton.replaceChildren(...v.progress.map(p=>{const e=elem('i',undefined,'c7-road-dot');e.dataset.state=p.status;e.title=p.title;e.setAttribute('aria-hidden','true');return e;}));
  projectWorld(v);
  if(screen==='ending'){renderEnding(v);return;}renderRack(v);renderActions(v);scene?.render(v);
  if(!canAct())for(const e of root.querySelectorAll<HTMLButtonElement>('.scene7 button'))e.disabled=true;
 }
 function road(){
  if(!current())return;const v=getRunView(current()!),body=elem('div',undefined,'c7-history');
  body.append(elem('p','母灯在山口等着。同一趟路，已经做过的选择都留在这里。'));
  for(const p of v.progress){const row=elem('div',undefined,'c7-road-entry');row.dataset.state=p.status;row.append(elem('b',`${p.status==='completed'?'◆':p.status==='current'?'◈':'◇'} ${p.node} · ${p.title}`),elem('small',p.status==='unreached'?'尚未抵达':p.status==='current'?'正在这里':p.status==='completed'?'已经走过':'曾经抵达'));for(const c of p.choices)row.append(elem('p',c.label));body.append(row);}
  body.append(elem('h3','这趟路留下的事'));for(const line of v.worldChanges)body.append(elem('p',line));
  if(v.works.some(w=>w.hits>0)){body.append(elem('h3','留下的作品'));for(const w of v.works.filter(w=>w.hits>0))body.append(elem('p',`${w.name} · ${w.strength}${w.sealedStrength!==null?` / 原强度${w.sealedStrength}`:''} · ${w.condition} · ${w.ownerLabel}`));}
  openDialog('山口之前，灯路之上',body,[{label:'回到眼前',primary:true,run:closeDialog}]);
 }
 function shop(){
  cancelVisuals();
  if(!current())return;const v=getRunView(current()!),body=elem('div',undefined,'c7-camp'),host=elem('div',undefined,'c7-camp-host'),face=elem('span',undefined,'c7-camp-portrait'),greeting=elem('div');
  portrait(face,{id:'du',name:'杜伯',line:'',portrait:{path:'/assets/d/customers-atlas-v2.webp',x:836,y:627,width:418,height:627}});face.setAttribute('aria-hidden','true');
  greeting.append(elem('h3','杜伯把炉车停在风背处'),elem('p','“煤和铁坯都在这儿。挑需要的，别把钱白花了。”'));host.append(face,greeting);body.append(host);
  const purse=elem('p',undefined,'c7-camp-purse');purse.append(elem('strong',`身上 ${v.coins}钱`),elem('span',`灯火 ${v.lamp}/8 · 铁坯 ${v.blanks}/3 · 手艺 ${v.charge}次`));body.append(purse);
  const goods=elem('div',undefined,'c7-camp-goods');
  for(const a of v.actions.filter(a=>a.group==='camp'&&(v.tool||a.action.type==='shop'&&['coal','blank'].includes(a.action.item)))){
   if(a.action.type!=='shop')continue;const item=a.action.item,row=elem('article',undefined,'c7-shop-item'),art=elem('span',undefined,`c7-goods-art c7-goods-${item}`),copy=elem('div',undefined,'c7-goods-copy');row.dataset.goods=item;row.dataset.available=String(a.allowed&&writable());art.setAttribute('aria-hidden','true');
   if(item==='coal')art.append(elem('i'),elem('i'),elem('i'));
   if(item==='upgrade'||item==='exchange'){const img=elem('img');img.src=item==='exchange'?`/assets/d/v09/${v.tool?.kind==='rebound'?'furnace-nail':'rebound-tooth'}-v1.webp`:v.tool!.asset;img.alt='';art.append(img);}
   copy.append(elem('strong',item==='coal'?'一包炉煤':item==='blank'?'一枚新铁坯':item==='upgrade'?`${v.tool?.name??'工具'} · 升到二阶`:`换成${v.tool?.kind==='rebound'?'崩炉钉':'回锋齿'}`),elem('p',a.detail));
   const b=actionButton(a,true);copy.append(b);const reason=a.reason??(!writable()?'本页暂时只能查看，取得保存权后再交易。':null);if(reason)copy.append(elem('small',reason,'c7-shop-reason'));row.append(art,copy);goods.append(row);
  }
  body.append(goods,elem('small','买好就收回炉车，仍从眼前这段路继续。','c7-camp-footer'));openDialog('杜伯的炉边摊',body,[{label:'回到炉车旁',primary:true,run:closeDialog}]);
 }
 function talk(){if(!current())return;cancelVisuals();const v=getRunView(current()!),body=elem('div');body.append(elem('p',v.speaker.line),elem('h3','眼前的约定'),elem('p',v.mission),elem('p',v.nextPlace));if(v.finale){body.append(elem('h3','母灯还差哪些步骤'));for(const f of v.finale.requirements)body.append(elem('p',`${f.met?'✓':'○'} ${f.label} · ${f.detail}`));}for(const a of v.actions.filter(a=>a.group==='mechanism'))body.append(actionButton(a,false,true));openDialog(`和${v.speaker.name}说几句`,body,[{label:'我记住了',primary:true,run:closeDialog}]);}
 function download(name:string,value:string){const url=URL.createObjectURL(new Blob([value],{type:'application/json'})),a=elem('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
 function raw(key:string):string|null{try{return window.localStorage.getItem(key);}catch{return null;}}
 function save(){
  const body=elem('div',undefined,'c7-facts'),warning=saveWarning();body.append(elem('p',warning||'旅程会在每次行动后收好；旧版行程放在各自的行囊里。'));
  const exported=port.exportRun();if(exported)body.append(button('导出手中这趟旅程',()=>download(`护炉远行-${current()!.runId}.json`,port.exportRun()??exported)));
  for(const[key,label]of [[V7_SAVE_KEY,'导出磁盘主档原文'],[V7_BACKUP_KEY,'导出磁盘备份原文']] as const){const value=raw(key);if(value!==null)body.append(button(label,()=>download(`${key}.json`,value)));}
  if(snapshot.dirty&&snapshot.mode==='writer')body.append(button('再收好一次',()=>{const r=port.retrySave(snapshot.generation);notice(r.ok?'这趟旅程已经收好。':appError(r.error));save();},true));
  if(snapshot.conflict)body.append(button('核对后读取磁盘最新行程',()=>confirm('读取磁盘最新行程？','手中尚未存好的进展会被替换。可以先取消并导出当前旅程。',()=>{const r=port.resume({generation:snapshot.generation,confirmed:true});if(r.ok){route='play';render();}else notice(appError(r.error));})));
  const backup=snapshot.load?.backup,shown=raw(V7_BACKUP_KEY);
  if(backup?.status==='valid'&&snapshot.load?.main.status!=='valid')body.append(button(`恢复备份 · ${getRunView(backup.state).title}`,()=>confirm('恢复这份备份？','会使用刚展示的备份继续。原主档如需保留，请先取消并导出原文。',()=>{
   if(raw(V7_BACKUP_KEY)!==shown){notice('备份已变化，请重新核对。');save();return;}const r=port.recoverBackup({generation:snapshot.generation,confirmed:true});if(r.ok){route='play';render();}else notice(appError(r.error));
  })));
  if(!snapshot.active||!['writer','memory'].includes(snapshot.mode))body.append(button('重新取得保存权',()=>{closeDialog();void port.activate().then(()=>{if(!disposed)save();});}));
  body.append(button(current()?'保留手中进度，不保存继续':'不保存，先走一趟',()=>confirm('本趟暂不落盘？','磁盘原文会保留。关闭或刷新前，请导出这次旅程，否则本次新进展会丢失。',()=>{const r=port.useMemory(current()?null:fresh(),{generation:snapshot.generation,confirmed:true});if(r.ok){route='play';render();}else notice(appError(r.error));})));
  openDialog('把行囊收好',body,[{label:'回到旅程',primary:true,run:closeDialog}]);
 }
 function settings(){const body=elem('div');for(const kind of ['muted','volume','reducedMotion'] as const){const row=elem('label'),control=elem('input');control.type=kind==='volume'?'range':'checkbox';if(kind==='volume'){control.min='0';control.max='100';control.value=String(prefs.value.volume);control.oninput=()=>preferences.update({volume:Number(control.value)});}else{control.checked=prefs.value[kind];control.onchange=()=>preferences.update({[kind]:control.checked});}row.append(elem('span',kind==='muted'?'静音':kind==='volume'?'炉火与敲击音量':'减弱动效'),control);body.append(row);}openDialog('炉火与声音',body);}
 function pause(){
  cancelVisuals();
  const body=elem('div',undefined,'c7-menu-sheet'),v=current()?getRunView(current()!):null;body.append(elem('p','炉火为你留着，读信和歇脚都不推进回合。'));
  const links=elem('div',undefined,'c7-menu-links');for(const [label,detail,run]of [['看整条灯路','走过的站、做过的选择和作品去向',road],['收好行囊','保存、导出与恢复这趟旅程',save],['声音与动效','炉火音量、静音和减弱动效',settings],['炉边口诀','想不起来时，翻一眼就好',()=>openDialog('只记这几件事','普通左键锻造前三记安全；定线稳，崩纹猛但每斩磨损2。每轮只有两步，架剑能护火并让下一斩无视甲、伤害加2；点结束才结算压力。两柄剑和工具会陪你走下去，交出去的剑就留在别人手里。')]] as const){const b=button(label,run);b.append(elem('span',detail,'c7-action-detail'));links.append(b);}body.append(links);
  for(const a of v?.actions.filter(a=>a.group==='journey')??[])body.append(actionButton(a,false,true));
  body.append(button('回到山路起点',()=>{closeDialog();route='title';render();}));openDialog('歇一歇',body,[{label:'继续眼前这一步',primary:true,run:closeDialog}]);
 }
 scene=createCampaignScene(node('c7-stage'),{reduced,onForge:()=>{const s=current();if(s?.phase==='forging'&&s.forgeId)send({type:'forge',weaponId:s.forgeId,kind:'ordinary'});},onStrike:id=>send({type:'strike',targetId:id})});
 node('c7-road').onclick=road;node('c7-menu').onclick=pause;node('c7-companion').onclick=talk;node('c7-title-save').onclick=save;node('c7-save-warning').onclick=save;node('c7-dialog-close').onclick=closeDialog;
 const onCancel=(e:Event)=>{e.preventDefault();closeDialog();};dialog.addEventListener('cancel',onCancel);
 const onKey=(e:KeyboardEvent)=>{if(e.repeat&&(e.code==='Space'||e.key==='Enter'))e.preventDefault();if(e.key==='Escape'&&!modal&&route==='play'){e.preventDefault();pause();}};
 const onHidden=()=>{if(document.hidden)cancelVisuals();render();};
 const onMotion=()=>{cancelVisuals();render();};
 const onResize=()=>{cancelVisuals();render();};
 root.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onHidden);motion.addEventListener('change',onMotion);window.addEventListener('resize',onResize);
 const stopPrefs=preferences.subscribe(value=>{const changed=value.value.reducedMotion!==prefs.value.reducedMotion;prefs=value;if(changed)cancelVisuals();render();});
 const stop=port.subscribe(value=>{const changed=value.generation!==snapshot.generation||value.state?.runId!==snapshot.state?.runId;snapshot=value;if(changed)cancelVisuals();render();});
 render();void port.activate();
 return{async dispose(){if(disposed)return;disposed=true;cancelVisuals();if(noticeTimer)clearTimeout(noticeTimer);if(arrivalTimer)clearTimeout(arrivalTimer);stop();stopPrefs();scene?.dispose();dialog.removeEventListener('cancel',onCancel);root.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onHidden);motion.removeEventListener('change',onMotion);window.removeEventListener('resize',onResize);await Promise.allSettled([port.dispose(),audio.dispose()]);if(root.firstElementChild===game)root.replaceChildren();}};
}
