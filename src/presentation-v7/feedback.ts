import type {DomainEvent,RunView,WeaponView} from '../core-v7/index.js';

export type NoticeTone='quiet'|'story'|'reward'|'danger';
export interface ResultFeedback {copy:string;title?:string;tone?:NoticeTone}
export const choiceTitles:Record<string,string>={'first-road':'巡路开了，先顾哪一边？','bridge-rescue':'桥下还有人在等','bridge-tool':'挑一件带上路的手艺','crossing-extra':'灯车已能走，还要再守吗？','camp-old-sword':'杜伯的老伙计','station-first':'风里传来两处求救','station-second':'另一驿还亮着求救灯','shelter-ring':'一只环，两处炉火','relay-carrier':'最后一段，谁来送灯？'};

const blade=(value:WeaponView|null|undefined)=>value?`${value.name}（强度${value.strength}）`:'空剑位';
const nextStep=(view:RunView)=>view.choice?choiceTitles[view.choice]??view.mission:view.mission;
const earnedCoins=(events:readonly DomainEvent[])=>events.reduce((sum,event)=>sum+(event.type==='CoinsChanged'&&event.amount>0?event.amount:0),0);
function toolUse(view:RunView):string{
 if(!view.tool)return'';
 if(view.tool.kind==='rebound')return view.tool.level===2?'溢出余力可带到后面的战斗；用工具旁的“余力追斩”免费追斩一次。':'在下一战先击破一个目标、留下溢出余力，再用工具旁的“余力追斩”免费打另一目标一次。';
 return `每场首次亲手击破带甲目标，手艺补到1次；用“续炉”修复手中剑${view.tool.level===2?'4':'2'}点，最多回到收锻强度。${view.tool.level===2?'二阶续炉也会抚平意外裂纹，保留真正崩纹。':''}`;
}

export function resultFeedback(events:readonly DomainEvent[],before:RunView,after:RunView):ResultFeedback{
  if(after.ending)return{title:after.ending.title,copy:after.ending.summary,tone:after.ending.kind==='relit'?'reward':'story'};
  if(events.some(e=>e.type==='Failed'))return{title:'先护住同行的人',copy:after.failure?.text??'暂且止步，可以重整或带着记忆收炉。',tone:'danger'};
  const purchase=events.find(e=>e.type==='ShopUsed');
  if(purchase?.type==='ShopUsed'){
   const received=purchase.item==='coal'?`灯火 ${before.lamp} → ${after.lamp}，实际添了${after.lamp-before.lamp}点。`:purchase.item==='blank'?`铁坯 ${before.blanks} → ${after.blanks}，手艺次数仍是${after.charge}。`:purchase.item==='upgrade'?`${after.tool?.name??'工具'}已到二阶；本趟升阶资格已用。${toolUse(after)}`:`换得一级${after.tool?.name??'工具'}，原工具已交给杜伯。${before.tool?.stored?'原有追斩余力已清。':''}${toolUse(after)}`;
   return{title:`杜伯收下${purchase.price}钱`,copy:`${received} 手里还余${after.coins}钱。`,tone:'reward'};
  }
  const choice=events.find(e=>e.type==='ChoiceMade');
  if(choice?.type==='ChoiceMade'){
   const outcomes:Record<typeof choice.choice,{title:string;copy:string}>={
    escort:{title:'同行的人先上路',copy:'没有耗灯火。到了渡口，他们会替你减轻首轮压力。'},
    salvage:{title:'从旧路捎回3钱',copy:`这次用了1点灯火。现有${after.coins}钱、${after.lamp}点灯火，下一程去断桥。`},
    'rescue-ferryman':{title:'摆渡人被拉上岸',copy:'双驿赶路时他会带路，还能替你牵索一次。先挑一件带上路的工具。'},
    'save-cargo':{title:'货物保住了 · 5钱入袋',copy:`现有${after.coins}钱。摆渡人没能随队，双驿要靠自己开路。`},
    'take-rebound':{title:'回锋齿扣在剑鞘边',copy:'下一程有冲阵者与侧袭者：先击破一只并留下溢出余力，另一只就能用0行动追斩；余力只在这场有效。'},
    'take-furnace':{title:'崩炉钉收进炉车',copy:'下一程的冲阵者有甲，亲手击破它可把手艺补到1次；再用“续炉”修复手中剑2点，最多回到收锻强度。已满时不会多存次数。'},
    'leave-crossing':{title:'带着炉火上雪线',copy:`已到杜伯的冬炉。先点清${after.lamp}点灯火、${after.blanks}枚铁坯，再决定旧剑的去留。`},
    'hold-crossing':{title:'渡口还要你再守一轮',copy:'撞桩者已经逼近。守住这一阵，才会留下额外报酬与山口接应。'},
    'keep-old':{title:'杜伯旧剑留在架上',copy:'这次没花钱，也没升阶。修整好后，就能带它继续上雪线。'},
    'dismantle-old':{title:`旧剑卸下 · ${after.tool?.name??'工具'}二阶`,copy:`没有花钱。旧剑已离开剑架，本趟唯一升阶资格已用。${toolUse(after)}`},
    'pay-upgrade':{title:`付4钱 · ${after.tool?.name??'工具'}二阶`,copy:`杜伯旧剑仍在架上。余${after.coins}钱，本趟唯一升阶资格已用。${toolUse(after)}`},
    'north-first':{title:'炉车转向北驿',copy:'巡守还困在门后。两轮内破开门闩；摆渡人的牵索若可用，也能直接开路。'},
    'south-first':{title:'炉车转向南驿',copy:'信使在拦索后等你。两轮内切索或破锁，把人接出来。'},
    'leave-station':{title:'带已救的人离开',copy:'另一处驿站没有记作救援成功。下一程，去最后一座避难炉。'},
    'continue-station':{title:'转身去接另一驿的人',copy:`${after.storyFlags.ferrymanSaved?'摆渡人带路，没耗赶路灯火。':'已用1点灯火赶路。'}这一处每轮风雪3，两轮内开路。`},
    'take-ring':{title:'恒温环随你上山',copy:'终局每轮压力减2。避难炉已冷，双驿援手会留去撤离居民。'},
    'leave-ring':{title:'把暖意留在避难炉',copy:after.storyFlags.northSaved||after.storyFlags.southSaved?'炉火继续保温，已救的驿站援手也能继续帮你开路。':'炉火继续保温。后面的山路，仍要靠手中的剑与队伍。'},
    'courier-carries':{title:'阿禾接过唯一灯芯',copy:'先替她打开山口。送达后，母灯开场会有2护势。'},
    'player-carries':{title:'唯一灯芯仍在你手里',copy:'终局要用1行动放灯。停轮后，阿禾可免费扶稳底座一次。'},
   };
   return{...outcomes[choice.choice],tone:events.some(e=>e.type==='ToolChanged')?'reward':'story'};
  }
  const donation=events.find(e=>e.type==='Donated');if(donation?.type==='Donated'){
   const given=before.works.find(w=>w.id===donation.weaponId),name=blade(given);
   return{title:donation.recipient==='alan'?'阿岚接过了备用剑':donation.recipient==='shelter'?'剑撑住了避难炉梁':'旧剑卸下，手艺上路',copy:donation.recipient==='alan'?`${name}已离开你的剑架。这段落石，他每轮替队伍减2压力。`:donation.recipient==='shelter'?`${name}留在这里，屋里的人稳住了；它不会再回到剑架。${nextStep(after)}`:`${name}已用于工具升阶。${toolUse(after)}`,tone:'story'};
  }
  // Opening a route commonly emits EncounterCompleted too. Name the player's actual
  // operation first, so cutting a rope cannot masquerade as placing the final core.
  const mechanism=events.find(e=>e.type==='MechanismUsed');
  if(mechanism?.type==='MechanismUsed'){
   const completed=events.some(e=>e.type==='EncounterCompleted'),earned=earnedCoins(events);
   const follow=completed?`${earned?`${earned}钱入袋。`:''}${nextStep(after)}`:'';
   switch(mechanism.mechanism){
    case'bridge-rope':return{title:'吊索切开，桥路已通',copy:`${blade(before.slots.hand)}切断了吊索，强度未损；不必再击破桥闩。${follow}`,tone:'reward'};
    case'south-rope':return{title:'南驿拦索已断',copy:`${blade(before.slots.hand)}切开拦索，强度未损，信使已经脱困。${follow}`,tone:'reward'};
    case'relay-rope':return{title:'山口拦索已断',copy:`切索没有磨损剑。${after.storyFlags.coreOwner==='socket'?'阿禾已把唯一灯芯送入母灯灯座。':'唯一灯芯仍由你保管。'}${follow}`,tone:'reward'};
    case'ferry':return{title:`摆渡人牵开了${mechanism.targetId==='north-latch'?'北驿门闩':'南驿通路'}`,copy:`没有耗行动，也没磨损剑；本趟双驿唯一一次牵索援手已用。${follow}`,tone:'story'};
    case'side-route':return{title:'接应带你走过侧道',copy:`用了1行动绕过山口，不必破坏门闩，剑也未损。${after.storyFlags.coreOwner==='socket'?'阿禾已把灯芯送入母灯灯座。':'灯芯仍由你保管，终局需亲手放灯。'}${follow}`,tone:'story'};
    case'core':{
     const wheel=after.encounter?.targets.find(t=>t.id==='reverse-wheel');
     return{title:'唯一灯芯已放入灯座',copy:`用了1行动。${wheel&&wheel.health>0?'接下来先断传动、停逆转轮，再架稳嵌剑。':'逆转轮已停；接下来架稳底座，再嵌入合格的自制剑。'}放灯已解除先前的架稳。`,tone:'story'};
    }
    case'brace-assist':{
     const embed=after.actions.find(a=>a.action.type==='ignite');
     return{title:'阿禾扶稳了底座',copy:`这次援手不耗行动，本场只能用一次。${embed?.allowed?'现在可紧接嵌剑。':embed?.reason??'请查看母灯还缺的条件。'}换剑、续炉、放灯或斩击会解除架稳。`,tone:'story'};
    }
   }
  }
  const completed=events.find(e=>e.type==='EncounterCompleted');
  if(completed?.type==='EncounterCompleted'){
   const earned=earnedCoins(events),hit=events.find(e=>e.type==='Struck'),round=events.find(e=>e.type==='RoundEnded');
   const target=hit?.type==='Struck'?before.encounter?.targets.find(t=>t.id===hit.targetId)?.name??'目标':null;
   const outcome=hit?.type==='Struck'?`${target}受到${hit.damage}伤害，已破开。${hit.strengthBefore!==hit.strengthAfter?`剑强度 ${hit.strengthBefore} → ${hit.strengthAfter}。`:''}`:round?.type==='RoundEnded'?`守到了这一段结束，灯火 ${round.before} → ${round.after}。`:'';
   const recharge=events.find(e=>e.type==='Recharged'),notes=[outcome,events.some(e=>e.type==='Broken')?'剑也断在这一击。':'',recharge?.type==='Recharged'?recharge.gained>0?'炉钉把手艺补到1次。':'回充已触发，次数原本已满。':'',after.tool?.stored?`仍留有${after.tool.stored}点追斩余力。`:''].filter(Boolean).join('');
   const title=completed.encounterId==='n3-extra'?'渡口接应留下了':completed.encounterId==='n3-main'?'灯车渡过了这一阵':completed.encounterId==='n7'?'队伍穿过了落石':'这段路打开了';
   return{title:`${title}${earned?` · ${earned}钱入袋`:''}`,copy:`${notes}${nextStep(after)}`,tone:'reward'};
  }
  const forged=events.find(e=>e.type==='Forged');if(forged?.type==='Forged')return forged.result==='broken'?{title:'铁坯碎了',copy:'第二道裂纹贯穿。已用的铁坯和手艺次数不会返还。',tone:'danger'}:forged.result==='crack'?{title:'锤声发闷 · 添了一道裂纹',copy:`强度 ${forged.before} → ${forged.after}。再冒险落锤前，先看清剑身。`,tone:'danger'}:forged.result==='fissure'?{title:'崩纹刻入，锋芒亮起',copy:`强度 ${forged.before} → ${forged.after}。以剑出击穿甲加2，斩后强度−2；余力追斩不磨损剑。`,tone:'reward'}:{copy:`${forged.result==='steady'?'这一线打稳了':'落锤成形'} · 强度 ${forged.before} → ${forged.after}`};
  const hit=events.find(e=>e.type==='Struck');if(hit?.type==='Struck'){
   const target=before.encounter?.targets.find(t=>t.id===hit.targetId)?.name??'机关';
   const recharge=events.find(e=>e.type==='Recharged'),stored=events.find(e=>e.type==='ReboundStored');
   const extra=events.some(e=>e.type==='Broken')?' · 剑也断在这一击':hit.strengthBefore!==hit.strengthAfter?` · 剑强度${hit.strengthBefore}→${hit.strengthAfter}`:'';
   const copy=`${hit.source==='followUp'?'余力追斩':'出剑'} ${hit.damage} · ${target}${hit.after===0?'已破开':`还余${hit.after}`}${extra}`;
   if(recharge?.type==='Recharged')return{title:recharge.gained>0?'炉钉回充 · 手艺补到1次':'回充已触发 · 次数原本已满',copy:`${copy}。${recharge.gained>0?'现在可以把这次手艺用于续炉。':'本场回充机会已用，不会再额外累加。'}`,tone:'reward'};
   if(stored?.type==='ReboundStored')return{title:`留住${stored.after}点余力`,copy:`${copy}。可选另一目标，0行动追斩一次。`,tone:'reward'};
   return{copy,tone:events.some(e=>e.type==='Broken')?'danger':'quiet'};
  }
  const round=events.find(e=>e.type==='RoundEnded');if(round?.type==='RoundEnded')return{title:round.loss?'风雪压来':'这一阵挡住了',copy:`压力${round.pressure} − 援手${round.reduction} − 护势${round.block}，灯火 ${round.before} → ${round.after}。下一轮重新获得2行动。`,tone:round.loss?'danger':'quiet'};
  if(events.some(e=>e.type==='Guarded')){const embed=after.actions.find(a=>a.action.type==='ignite');return after.encounter?.braced?{title:'母灯架稳了',copy:`${embed?.allowed?'接下来可紧接嵌剑。':embed?.reason??'下一步请查看母灯还缺的条件。'}换剑、续炉、放灯或斩击会解除架稳。`,tone:'story'}:{copy:'挡在灯车前 · 本轮护势 +3，下一斩无视甲并加2'};}
  if(events.some(e=>e.type==='Retried'))return{title:'炉火重新点清',copy:`回到${after.chapterTitle}的起点。本章重整机会已用。`,tone:'story'};
  const tempered=events.find(e=>e.type==='Tempered');if(tempered?.type==='Tempered')return{title:'炉钉亮起 · 已用1次手艺',copy:`强度 ${tempered.before} → ${tempered.after}${tempered.crackCleared?'，意外裂纹已抚平':''}。剩余${after.charge}次。`,tone:'reward'};
  const sealed=events.find(e=>e.type==='Sealed');if(sealed?.type==='Sealed'){
   const value=after.works.find(w=>w.id===sealed.weaponId),replaced=before.works.find(w=>w.id===sealed.replacedId);
   return{title:`${value?.name??'新剑'}成器 · 强度${value?.strength??0}`,copy:`已放到${sealed.slot==='hand'?'手中':'备用剑位'}。${replaced?`${blade(replaced)}已替换弃置，不会移入另一剑位。`:sealed.slot==='reserve'?`手中仍是${blade(after.slots.hand)}。`:''}${sealed.slot==='reserve'?'上路前可点备用剑换手。':'这柄剑将随你上路。'}`,tone:'reward'};
  }
  if(events.some(e=>e.type==='ToolChanged'))return{title:`${after.tool?.name??'工具'}已${after.tool?.level===2?'升阶':'带上'}`,copy:toolUse(after),tone:'reward'};
  const equipped=events.find(e=>e.type==='Equipped');if(equipped?.type==='Equipped')return{title:`换到手中 · ${blade(after.slots.hand)}`,copy:`${after.slots.reserve?`${blade(after.slots.reserve)}已收回备用剑位。`:'备用剑位现在空着。'}${equipped.actions===null?'整备换手不耗行动。':`用了1行动，本轮剩${equipped.actions}行动；换手已解除架稳。`}`};
  const discarded=events.find(e=>e.type==='Discarded');if(discarded?.type==='Discarded')return{title:before.phase==='forging'?'已放弃这一坯':'已从剑架取下弃置',copy:`${blade(before.works.find(w=>w.id===discarded.weaponId))}不会再回到剑架。${before.phase==='forging'?'铁坯与已用手艺不返还。':''}`};
  if(events.some(e=>e.type==='ForgeStarted'))return{title:'铁坯已放上炉台',copy:`本章还余${after.blanks}枚铁坯。前三记普通锤安全；先看前路，再决定强度和手艺。`};
  const arrived=events.find(e=>e.type==='EncounterStarted');if(arrived?.type==='EncounterStarted'){
   const encounter=after.encounter,notes:string[]=[];
   if(encounter?.id==='n3-main'&&after.storyFlags.escortFirst)notes.push('先前护送的人替你接住了渡口首轮1点压力。');
   if(encounter?.id==='n7'&&after.storyFlags.northSaved&&after.storyFlags.ring==='left'&&encounter.targets.some(t=>t.id==='loose-rock'&&t.health===0))notes.push('留在暖炉的北驿巡守先清开了散石；眼前只需应付剩下的落石。');
   if(encounter?.id==='n9'){
    if(after.storyFlags.ring==='taken')notes.push('带来的恒温环已生效：母灯每轮风雪压力减2。');
    if(after.storyFlags.carrier==='courier'&&after.storyFlags.coreOwner==='socket')notes.push('阿禾已送妥灯芯，开场替你留下2护势。');
   }
   return{title:`已到${after.title}`,copy:`${notes.join('')}${after.mission}${encounter?` 每轮2行动，限${encounter.roundLimit}轮；只有结束本轮才结算压力。`:''}`,tone:'story'};
  }
  return{copy:''};
 }
