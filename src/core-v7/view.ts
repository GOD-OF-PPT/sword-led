import {freezeDeep} from '../core/immutable.js';
import {damagePreview} from './combat.js';
import type {DamagePreview} from './combat.js';
import {pressurePreview} from './encounters.js';
import {actionError} from './game.js';
import {OLD_SWORD_ID} from './initial.js';
import {handWeapon,usable,weapon} from './inventory.js';
import {finalEligible} from './journey.js';
import type {Action,Chapter,ChoiceId,ChoiceKind,EncounterId,ErrorCode,NodeId,Phase,RunState,StoryFlags,TargetId,Weapon,WeaponSlot} from './model.js';

export type ActionGroup='primary'|'weapon'|'forge'|'tool'|'mechanism'|'choice'|'camp'|'journey';
export interface ActionView {
 readonly action:Action;
 readonly label:string;
 readonly detail:string;
 readonly allowed:boolean;
 readonly reason:string|null;
 readonly errorCode:ErrorCode|null;
 readonly group:ActionGroup;
 /** Consumers must confirm this text before dispatching the already explicit command. */
 readonly requiresConfirmation:string|null;
}
export interface CharacterView {
 readonly id:'alan'|'he'|'du';
 readonly name:string;
 readonly line:string;
 readonly portrait:{readonly path:string;readonly x:number;readonly y:number;readonly width:418;readonly height:627};
}
export interface WeaponView {
 readonly id:string;
 readonly name:string;
 readonly kind:'inherited'|'plain'|'steady'|'fissure';
 readonly source:Weapon['source'];
 readonly status:Weapon['status'];
 readonly owner:Weapon['owner'];
 readonly ownerLabel:string;
 readonly slot:WeaponSlot|'forge'|null;
 readonly strength:number;
 readonly sealedStrength:number|null;
 readonly hits:number;
 readonly cracked:boolean;
 readonly fissureMarked:boolean;
 readonly condition:string;
 readonly usable:boolean;
 readonly finalEligible:boolean;
}
export interface ForgeView {
 readonly weapon:WeaponView;
 readonly hitsLeft:number;
 readonly ordinary:{readonly crackTickets:number;readonly totalTickets:1000;readonly successStrength:number;readonly crackStrength:number;readonly breaksOnCrack:boolean;readonly draws:1};
 readonly steady:{readonly strengthAfter:number;readonly crackedAfter:boolean;readonly chargeCost:1;readonly draws:0};
 readonly fissure:{readonly strengthAfter:number;readonly crackedAfter:true;readonly chargeCost:1;readonly draws:0};
}
export interface TargetView {
 readonly id:TargetId;
 readonly name:string;
 readonly role:'threat'|'mechanism';
 readonly health:number;
 readonly maxHealth:number;
 readonly armor:number;
 readonly pressure:number;
 readonly intent:string;
 readonly requiresDestroyed:TargetId|null;
 readonly dependency:string|null;
 readonly asset:string|null;
 readonly preview:(DamagePreview&{readonly healthAfter:number;readonly breaksWeapon:boolean})|null;
 readonly strike:ActionView;
 readonly followUp:ActionView|null;
 readonly blockedReason:string|null;
}
export interface EncounterView {
 readonly id:EncounterId;
 readonly objective:string;
 readonly round:number;
 readonly roundLimit:number;
 readonly roundsRemaining:number;
 readonly actions:number;
 readonly block:number;
 readonly opening:boolean;
 readonly guarded:boolean;
 readonly braced:boolean;
 readonly alanGuard:boolean;
 readonly routeOpened:boolean;
 readonly environmentPressure:number;
 readonly pressure:ReturnType<typeof pressurePreview>&{readonly lampAfter:number};
 readonly targets:readonly TargetView[];
 readonly reboundClaimed:boolean;
 readonly followUpUsed:boolean;
 readonly furnaceTriggered:boolean;
 readonly braceAssistUsed:boolean;
}
export interface ProgressView {
 readonly node:NodeId;
 readonly chapter:Chapter;
 readonly title:string;
 readonly status:'completed'|'current'|'visited'|'unreached';
 readonly coinsEarned:number;
 readonly choices:readonly {readonly id:ChoiceId;readonly label:string}[];
}
export interface EndingView {
 readonly kind:'relit'|'homeward'|'embers';
 readonly title:string;
 readonly summary:string;
 readonly stoppedAt:string;
 readonly dedicatedWeapon:WeaponView|null;
 readonly epilogues:readonly CharacterView[];
 readonly consequences:readonly string[];
}
export interface RunView {
 readonly rulesVersion:RunState['rulesVersion'];
 readonly runId:string;
 readonly revision:number;
 readonly chapter:Chapter;
 readonly chapterTitle:string;
 readonly node:NodeId;
 readonly title:string;
 readonly mission:string;
 readonly nextPlace:string;
 readonly phase:Phase;
 readonly phaseLabel:string;
 readonly scene:{readonly key:string;readonly background:string;readonly placeBackground:string;readonly fit:'contain';readonly resolved:boolean};
 readonly speaker:CharacterView;
 readonly lamp:number;
 readonly lampMax:8;
 readonly coins:number;
 readonly blanks:number;
 readonly charge:0|1;
 readonly slots:{readonly hand:WeaponView|null;readonly reserve:WeaponView|null};
 readonly works:readonly WeaponView[];
 readonly forge:ForgeView|null;
 readonly tool:{readonly kind:'rebound'|'furnace';readonly name:string;readonly level:1|2;readonly stored:number;readonly description:string;readonly asset:string;readonly upgradeUsed:boolean}|null;
 readonly storyFlags:StoryFlags;
 readonly worldChanges:readonly string[];
 readonly progress:readonly ProgressView[];
 readonly choice:ChoiceKind|null;
 readonly encounter:EncounterView|null;
 readonly finale:{readonly eligibleWeaponIds:readonly string[];readonly handEligible:boolean;readonly requirements:readonly {readonly id:string;readonly label:string;readonly met:boolean;readonly detail:string}[]}|null;
 readonly failure:{readonly reason:NonNullable<RunState['failure']>['reason'];readonly text:string;readonly node:NodeId}|null;
 readonly retries:{readonly chapter:Chapter;readonly used:0|1;readonly remaining:0|1;readonly failedAttempts:number};
 readonly ending:EndingView|null;
 readonly actions:readonly ActionView[];
 readonly newJourney:{readonly available:boolean;readonly confirmation:string};
}

const CHAPTER_TITLES:Readonly<Record<Chapter,string>>={1:'把人送过河',2:'哪一处火不能熄',3:'把剑留在灯里'};
const NODES:Readonly<Record<NodeId,{readonly title:string;readonly mission:string;readonly next:string}>>={
 1:{title:'巡夜引火',mission:'替阿岚打开巡路，让灯车后的人跟上。',next:'断桥牵索 · 把炉车送过河'},
 2:{title:'断桥牵索',mission:'切开吊索或破开桥闩，再决定救人还是保货。',next:'渡口守灯 · 保护灯车撤离'},
 3:{title:'渡口守灯',mission:'拦住正面冲阵与绕行威胁，让同行人渡河。',next:'冬炉换手 · 到雪线营地修整'},
 4:{title:'冬炉换手',mission:'与杜伯点清剑、工具和补给，再上雪线。',next:'风雪双驿 · 选择先救哪一处'},
 5:{title:'风雪双驿',mission:'替北驿巡守或南驿信使开门，至少救下一处。',next:'最后一座炉 · 面对避难炉与恒温环'},
 6:{title:'最后一座炉',mission:'用真实持有的剑撑梁或破除顶锁，救出炉边的人。',next:'缺口之剑 · 护队伍穿过落石'},
 7:{title:'缺口之剑',mission:'护住队伍通过落石；可交备用剑给阿岚挡住一侧。',next:'最后的接力 · 把唯一灯芯送入山口'},
 8:{title:'最后的接力',mission:'决定谁携灯芯，用接应路线或自己的剑打开山口。',next:'山口护灯 · 将亲手打造的剑留在母灯'},
 9:{title:'山口护灯',mission:'断传动、停逆转轮、放妥灯芯，架稳后嵌入亲手打造的剑。',next:'让母灯复明，或带人和灯芯返回山下'},
};
const PHASE_LABELS:Readonly<Record<Phase,string>>={prepare:'炉车整备',forging:'亲手锻剑',encounter:'道路行动',choice:'眼前的选择',failed:'暂且止步',ending:'旅程终章'};
const TARGET_ASSETS:Partial<Record<TargetId,string>>={
 'wood-guard':'/assets/d/v09/wood-guardian-v1.webp',
 'bridge-latch':'/assets/d/v1-campaign/bridge-winch-v1.webp',
 'north-latch':'/assets/d/v1-campaign/bridge-winch-v1.webp',
 'south-latch':'/assets/d/v1-campaign/bridge-winch-v1.webp',
 'relay-latch':'/assets/d/v1-campaign/bridge-winch-v1.webp',
 charger:'/assets/d/v1-campaign/charger-v1.webp',
 flanker:'/assets/d/v1-campaign/flanker-v1.webp',
 rammer:'/assets/d/v1-campaign/charger-v1.webp',
 'roof-lock':'/assets/d/v1-campaign/shelter-lock-v1.webp',
 'drive-lock':'/assets/d/v1-campaign/drive-lock-v1.webp',
 'reverse-wheel':'/assets/d/v1-campaign/mother-wheel-v1.webp',
};
const CHOICES:Readonly<Record<ChoiceKind,readonly ChoiceId[]>>={
 'first-road':['escort','salvage'],'bridge-rescue':['rescue-ferryman','save-cargo'],'bridge-tool':['take-rebound','take-furnace'],
 'crossing-extra':['leave-crossing','hold-crossing'],'camp-old-sword':['keep-old','dismantle-old','pay-upgrade'],
 'station-first':['north-first','south-first'],'station-second':['leave-station','continue-station'],
 'shelter-ring':['take-ring','leave-ring'],'relay-carrier':['courier-carries','player-carries'],
};
const CHOICE_COPY:Readonly<Record<ChoiceId,{readonly label:string;readonly detail:string}>>={
 escort:{label:'先护送同行人',detail:'不花灯火；渡口主段首轮压力减1。'},
 salvage:{label:'回身搜物',detail:'付1灯火，得到3钱；付后必须至少留1灯火。'},
 'rescue-ferryman':{label:'救摆渡人',detail:'双驿第二处免赶路灯火；他还可在双驿牵索开路一次。'},
 'save-cargo':{label:'保住货物',detail:'得到5钱；本趟没有摆渡人的双驿援手。'},
 'take-rebound':{label:'带上回锋齿',detail:'每场首次斩击击破且有正溢出，保存余力，免费追斩另一合法目标一次。'},
 'take-furnace':{label:'带上崩炉钉',detail:'每场首次亲手击破带甲目标，将技法次数补到1；可用次数续炉当前剑。'},
 'leave-crossing':{label:'带火上雪线',detail:'直接离开，保住当前剑与灯火；不取得额外守渡口报酬或接应。'},
 'hold-crossing':{label:'再守一轮渡口',detail:'另迎一场一轮压力5的撞桩者；成功得到2钱，并开启终章接应路线。'},
 'keep-old':{label:'留下杜伯旧剑',detail:'旧剑继续留在真实剑架；这次决定不花钱、不升阶。'},
 'dismantle-old':{label:'拆旧剑升工具',detail:'旧剑离开剑架，免费将当前一级工具升到二级，使用本趟唯一升阶资格。'},
 'pay-upgrade':{label:'付4钱升工具，保旧剑',detail:'付4钱将工具升到二级，保留旧剑；使用本趟唯一升阶资格。'},
 'north-first':{label:'先救北驿巡守',detail:'门闩耐久6、甲1，两轮内开门；第一处每轮风雪2，成功得到2钱。留环后巡守能清开第7站散石。'},
 'south-first':{label:'先救南驿信使',detail:'完好强度4可切障，或破开耐久6、甲2障锁；两轮，每轮风雪2，成功得到2钱。留环后能开山口侧路。'},
 'leave-station':{label:'带已救的人离开',detail:'保住灯火，继续去最后一座炉；另一处不会被记作已救援。'},
 'continue-station':{label:'继续救另一驿',detail:'再救一处，第二处每轮风雪3；通常先付1灯火赶路，救过摆渡人则免付。'},
 'take-ring':{label:'取走恒温环',detail:'终局每轮压力减2；避难炉熄灭，已救双驿援手转去撤离居民，不能兑现第7／8站帮助。'},
 'leave-ring':{label:'把恒温环留下',detail:'避难炉继续保温；已救北驿可清散石，已救南驿可开侧路，终局靠队伍架稳。'},
 'courier-carries':{label:'让阿禾先送灯',detail:'开路后灯芯进入灯座；终局开场有2护势，不再需要亲自放灯芯。'},
 'player-carries':{label:'自己握住灯芯',detail:'终局花1行动放灯芯；逆转轮停下后，阿禾可免费替你架稳一次，只置架稳标记。'},
};
const ERROR_TEXT:Readonly<Record<ErrorCode,string>>={
 invalid_run_id:'旅程标识不合规则。',invalid_seed:'锻造种子不合规则。',invalid_command:'这条行动格式不合规则。',
 wrong_rules:'这份旅程使用了其他版本的规则。',wrong_run:'这条行动属于另一趟旅程。',stale_revision:'旅程已有变化，请查看最新状态后再行动。',
 record_limit:'本趟行动记录已达到保存上限，不能再接受行动。',wrong_phase:'当前阶段不能进行这项行动。',unavailable:'这项帮助已经使用，或本趟尚未取得条件。',
 weapon_unavailable:'需要一柄仍由你持有、符合条件且未断裂的剑。',no_blanks:'没有未用铁坯；可在营地购买，或保留现有剑继续。',
 no_charge:'本炉的技法次数已用完。',hammer_limit:'这柄剑已敲满六记，请收锻或放弃。',empty_blade:'至少成功打出1点强度，才能收锻。',
 already_fissure:'这柄剑已有真正崩纹，不能再次刻入。',slot_occupied:'这个剑位已有剑，必须明确确认替换。',invalid_target:'目标已完成，或必须先解除前置机关。',
 not_enough_actions:'本轮行动点已用完；可用免费援手，或结束本轮。',guard_already_used:'本轮已经架过剑，不能再次架剑。',not_enough_coins:'钱不够完成这笔交易。',
 at_capacity:'灯火或未用铁坯已满，不能继续购买。',upgrade_used:'本趟唯一升阶资格已使用，或工具已是二级。',no_tool:'当前没有这项行动所需的工具。',
 no_rebound:'没有可用追斩余力，或本场追斩已用过。',not_worn:'当前剑无需恢复强度，也没有可清除的意外裂纹。',no_retry:'本章的重整机会已使用。',
 not_ready:'前置步骤尚未完成。',not_enough_light:'灯火不足；付出后必须至少保留1灯火。',choice_unavailable:'这个选择不属于眼前事件，或已作出决定。',
};

/** Error wording stays in the formal projection, including contextual disabled controls. */
export function errorText(error:ErrorCode|null,state?:RunState,action?:Action):string|null {
 if(error===null)return null;
 if(!state||!action)return ERROR_TEXT[error];
 const e=state.encounter;
 if(error==='invalid_target'&&(action.type==='strike'||action.type==='followUp')){
  const target=e?.targets.find(t=>t.id===action.targetId);
  if(target?.health===0)return'这个目标已经完成，无需再斩。';
  const dependency=e?.targets.find(t=>t.id===target?.requiresDestroyed);
  if(dependency&&dependency.health>0)return`先破除${dependency.name}，才能攻击这个目标。`;
 }
 if(error==='not_ready'){
  if(action.type==='depart')return'先决定杜伯旧剑的去留，再离开冬炉。';
  if(action.type==='placeCore')return state.flags.coreOwner==='socket'?'唯一灯芯已经在灯座，无需重复放置。':'这条携灯路线由阿禾送灯，无需你重复放灯。';
  if(action.type==='assistBrace')return e?.braceAssistUsed?'阿禾本场已经帮忙架稳一次。':state.flags.carrier!=='player'?'阿禾先送灯，本趟没有这次免费架稳援手。':'先停下逆转轮，阿禾才能帮忙架稳。';
  if(action.type==='ignite'){
   if(e?.targets.some(t=>t.id==='drive-lock'&&t.health>0))return'先斩断传动锁。';
   if(e?.targets.some(t=>t.id==='reverse-wheel'&&t.health>0))return'先停下逆转轮。';
   if(state.flags.coreOwner!=='socket')return'先将唯一灯芯放进灯座；放灯会解除先前架稳。';
   return'停轮后先架稳，再紧接着嵌剑；换剑、续炉、放灯或斩击会解除架稳。';
  }
 }
 if(error==='weapon_unavailable'){
  if(action.type==='depart'&&state.node===9)return'需要一柄仍持有的自制合格剑：完好强度至少3，或真正崩纹强度至少1。可用剩余铁坯重锻、章初重整或撤离。';
  if(action.type==='cut')return`需要手中完好剑，强度至少${action.targetId==='bridge-rope'?3:4}；有裂纹的剑不能切索。`;
  if(action.type==='ignite')return state.handId!==action.weaponId?'必须先把要嵌入的剑换到手中，随后重新架稳。':'母灯只接受手中真实自制剑：完好强度至少3，或真正崩纹强度至少1；杜伯旧剑不能代替。';
  if(action.type==='donate')return action.recipient==='alan'?'必须是当前备用位仍拥有、未断且强度至少3的剑。':'需要任一真实持有剑位中未断且强度至少3的剑。';
  if(action.type==='strike')return'手中没有可用剑；有备用剑时可花1行动换手，也可架剑或撤离。';
  if(action.type==='equip')return state.handId===action.weaponId?'这柄剑已经在手中。':'这柄剑不在你的可用剑位中。';
 }
 if(error==='unavailable'){
  if(action.type==='ferryAssist')return !state.flags.ferrymanSaved?'这趟没有救下摆渡人，无法借他的手牵索。':state.flags.ferryAssistUsed?'摆渡人在双驿只牵索一次，这次帮助已经用过。':'当前驿路已经打开。';
  if(action.type==='useSideRoute')return e?.routeOpened?'山口道路已经打开。':'需要守住额外一轮渡口，或救过南驿并留下恒温环，才有接应路线。';
  if(action.type==='donate')return action.recipient==='alan'?'阿岚本场已经收到一柄剑。':'炉梁已经有剑撑住。';
 }
 if(error==='no_tool'&&action.type==='temper')return'战地续炉需要崩炉钉；回锋齿不能修剑。';
 if(error==='at_capacity'&&action.type==='shop')return action.item==='coal'?'灯火已经是8，无需再添煤。':'未用铁坯已经有3枚，不能继续购买。';
 if(error==='not_enough_coins'&&action.type==='shop')return`需要${action.item==='upgrade'?4:2}钱，当前只有${state.coins}钱。`;
 return ERROR_TEXT[error];
}

function character(id:CharacterView['id'],line:string,relieved=false):CharacterView {
 return{id,name:id==='alan'?'阿岚':id==='he'?'阿禾':'杜伯',line,
  portrait:{path:'/assets/d/customers-atlas-v2.webp',x:id==='alan'?0:id==='he'?418:836,y:relieved?627:0,width:418,height:627}};
}
function weaponName(value:Weapon):string {
 return value.source==='inherited'?'杜伯旧剑':value.fissureMarked?'崩纹刃':value.technique==='steady'?'定线剑':'素钢剑';
}
function weaponView(state:RunState,value:Weapon):WeaponView {
 const ownerLabels:Readonly<Record<Weapon['owner'],string>>={forge:'炉台上',player:'你的剑架',alan:'阿岚持有',shelter:'留在避难炉梁',lamp:'嵌入母灯',none:'已离开剑架'};
 return{id:value.id,name:weaponName(value),kind:value.source==='inherited'?'inherited':value.fissureMarked?'fissure':value.technique==='steady'?'steady':'plain',
  source:value.source,status:value.status,owner:value.owner,ownerLabel:ownerLabels[value.owner],
  slot:state.handId===value.id?'hand':state.reserveId===value.id?'reserve':state.forgeId===value.id?'forge':null,
  strength:value.strength,sealedStrength:value.sealedStrength,hits:value.hits,cracked:value.cracked,fissureMarked:value.fissureMarked,
  condition:value.status==='broken'?'已断裂':value.status==='discarded'?'已弃置':value.owner==='alan'?'阿岚持剑挡护':value.owner==='shelter'?'撑住炉梁':value.owner==='lamp'?'成为母灯构件':value.fissureMarked?'真正崩纹 · 斩后磨损2':value.cracked?'意外裂纹':'完好',
  usable:usable(state,value.id),finalEligible:finalEligible(state,value.id)};
}
function actionView(state:RunState,action:Action,label:string,detail:string,group:ActionGroup,requiresConfirmation:string|null=null):ActionView {
 const error=actionError(state,action);
 return{action,label,detail,group,allowed:error===null,reason:errorText(error,state,action),errorCode:error,requiresConfirmation};
}
function currentPressure(values:readonly number[],round:number):number {
 return values.length?values[Math.min(round-1,values.length-1)]??0:0;
}
function encounterObjective(id:EncounterId):string {
 switch(id){
  case'n1':return'三轮内击破巡路木卫，打开巡路。';
  case'n2':return'三轮内用完好强度3的手中剑切索，或击破断桥铁闩。';
  case'n3-main':return'清掉两种威胁，或扛完三轮且灯火仍大于0，保护灯车撤离。';
  case'n3-extra':return'击破撞桩者，或承担这一轮压力且灯火仍大于0，保住渡口接应。';
  case'n5-north':return'两轮内破开北驿门闩；有摆渡人时也可请他牵索。';
  case'n5-south':return'两轮内用完好强度4的手中剑切障、破开障锁，或请摆渡人牵索。';
  case'n6':return'三轮内献一柄仍持有且强度至少3的剑撑梁，或击破失控顶锁。';
  case'n7':return'清掉落石，或扛完三轮且灯火仍大于0，护队伍通过缺口。';
  case'n8':return'三轮内借接应开侧路、用完好强度4的手中剑切索，或击破山口铁闩。';
  case'n9':return'五轮内断传动、停轮、放妥灯芯，架稳后花1行动嵌入手中合格自制剑。';
 }
}
function worldChanges(state:RunState):string[] {
 const f=state.flags,lines:string[]=[];
 if(f.escortFirst!==null)lines.push(f.escortFirst?'先护送同行人：渡口主段首轮少1压力。':'曾付1灯火回身搜物，取得3钱。');
 if(f.ferrymanSaved!==null)lines.push(f.ferrymanSaved?`摆渡人已获救：双驿赶路免灯火，牵索援手${f.ferryAssistUsed?'已用':'尚未使用'}。`:'当时保住货物，取得5钱；摆渡人没有加入。');
 if(f.crossingHeld)lines.push('额外守住渡口：取得2钱，山口接应路线已开启。');
 if(f.northSaved)lines.push(f.ring==='taken'?'北驿已救：巡守转去撤离避难炉居民。':f.ring==='left'?'北驿已救且恒温环留下：巡守可清开缺口散石。':'北驿巡守已脱困，等待恒温环的决定。');
 if(f.southSaved)lines.push(f.ring==='taken'?'南驿已救：信使转去撤离避难炉居民。':f.ring==='left'?'南驿已救且恒温环留下：山口侧路有信使引路。':'南驿信使已脱困，等待恒温环的决定。');
 if(f.ring!==null)lines.push(f.ring==='left'?'恒温环留在避难炉，炉火继续保温。':'恒温环已取走：避难炉冷却，终局每轮压力减2。');
 if(f.oldDecision!==null)lines.push(f.oldDecision==='dismantled'?'杜伯旧剑已拆解，工具因此升阶。':f.oldDecision==='paid'?'当时付4钱升级工具，并保留了杜伯旧剑。':'冬炉时选择留下杜伯旧剑。');
 if(f.shelterSword){const value=weapon(state,f.shelterSword);if(value)lines.push(`${weaponName(value)}留在避难炉梁，已不在玩家剑架。`);}
 if(f.donatedToAlan){const value=weapon(state,f.donatedToAlan);if(value)lines.push(`${weaponName(value)}交给阿岚，曾在落石场每轮挡2压力，已不在玩家剑架。`);}
 if(f.carrier!==null)lines.push(f.coreOwner==='party'?'灯芯已由当前持有者交回队伍。':f.coreOwner==='socket'?'唯一灯芯已送入灯座。':f.carrier==='courier'?'唯一灯芯交给阿禾先送。':'唯一灯芯仍由你携带。');
 return lines;
}
function currentSpeaker(state:RunState):CharacterView {
 const f=state.flags,e=state.encounter;
 switch(state.choice){
  case'first-road':return character('alan','巡路开了。先把人送到渡口，还是用一口灯火回身找些钱？');
  case'bridge-rescue':return character('he','桥能走了，可摆渡人和货还困在这边，只能先保一边。');
  case'bridge-tool':return character(f.ferrymanSaved?'he':'du',f.ferrymanSaved?'到双驿，他能带路，再替我们牵一回索。现在选一件随行工具。':'五钱收稳；摆渡人的手，这趟就借不上了。选一件工具继续走。');
  case'crossing-extra':return character('alan','灯车已经能撤。再守一轮能保住山口接应，你来决定这口火值不值。');
  case'camp-old-sword':return character('du','旧剑还能挡一阵，也能拆来养工具，你来选。');
  case'station-first':return character('he','北边是巡守，南边是信使，两处都有人等。');
  case'station-second':return character('he',f.ferrymanSaved?'一处的人接出来了。摆渡人能带路，再赶另一处不用添火。':'一处的人接出来了。再赶另一处，要多烧一口灯火。');
  case'shelter-ring':return character('du','炉梁稳住了。母灯少的那只环，正替这一屋人挡着寒气。');
  case'relay-carrier':return character('he','灯芯只有这一枚，最后这段，交给谁？');
  case null:break;
 }
 switch(state.node){
  case 1:return character('alan','先开巡路，灯车后面还有人，别让他们掉进黑里。');
  case 2:return character('he','桥那边能上岸，可摆渡人和货还困在这边。');
  case 3:return character('alan',e?.id==='n3-extra'?'再替渡口挡这一阵，山口那头就能有人接我们。':'一个冲正面，一个绕灯车；先拦谁，你看清。');
  case 4:return character('du',f.oldDecision==='dismantled'?'老剑卸下了，工具替它往前走；别再翻剑架找它。':f.oldDecision==='paid'?'旧剑留住了，工具也换好了，这四钱没白花。':usable(state,OLD_SWORD_ID)?'老伙计还在架上，往后总有用得着的时候。':'旧剑已经离架，剩下的钱和手艺，我替你点清。');
  case 5:return character('he',e?.id==='n5-north'?'巡守就在门后，先替他们打开这道门闩。':e?.id==='n5-south'?'信使就在障后，切开拦索或破锁，都能把他们接出来。':'北边是巡守，南边是信使，两处都有人等。');
  case 6:return character('du','母灯少的那只环，正替这一屋人挡着寒气。先把炉梁稳住。');
  case 7:{
   const reserve=weapon(state,state.reserveId);
   return character('alan',f.donatedToAlan?'剑在我这里，这段落石，我替你多接一些。':reserve&&usable(state,reserve.id)&&reserve.strength>=3?'把备用剑交我，我多挡一侧；你手里就少一柄退路。':'架上没有合格备用剑，先看清哪一阵石头最急。');
  }
  case 8:return character('he',f.carrier==='courier'?'我把灯芯送进灯座，你替我看住背后。':f.carrier==='player'?'轮停、灯芯放妥后，我来扶稳底座，只帮这一回。':'灯芯只有这一枚，最后这段，交给谁？');
  case 9:return character('du',e?.braced?'底座架稳了。把手中合格的自制剑留在这里，母灯才能接住这口火。':'母灯还缺最后一件东西——你亲手打出的那柄剑。');
 }
}
function endingView(state:RunState,works:readonly WeaponView[]):EndingView|null {
 const ending=state.ending;if(!ending)return null;
 const f=state.flags,dedicated=works.find(value=>value.id===ending.dedicatedWeaponId)??null;
 let epilogues:CharacterView[],summary:string;
 if(ending.kind==='relit'){
  const old=weapon(state,OLD_SWORD_ID);
  const du=usable(state,OLD_SWORD_ID)?'老伙计还在，新剑也找到了该守的地方。':f.oldDecision==='dismantled'?'老剑拆开养了工具，新剑留给母灯，都没白走。':f.shelterSword===OLD_SWORD_ID?'旧剑留在炉梁，新剑留在山口，各有去处。':f.donatedToAlan===OLD_SWORD_ID?'旧剑交给阿岚挡护，新剑留给母灯，各有去处。':old?.status==='broken'?'旧剑断在了这趟路上；你打的这柄，托住母灯了。':'旧剑的去向我们记着；你打的这柄，托住母灯了。';
  epilogues=[character('alan',f.northSaved&&f.ring==='left'?'北驿的人替我们清了缺口，这盏灯也照着他们。':'缺口是我们自己守过的，这盏灯照得见。',true),
   character('he',f.carrier==='courier'?'我先送到的那点火，终于照回山下了。':'你握到山口的灯芯，现在不只照你脚下了。',true),character('du',du,true)];
  summary=dedicated?`${dedicated.name}以${dedicated.strength}强度留在母灯，成为${dedicated.fissureMarked?'泄力件':'稳固件'}。道路重新亮起，沿途每个人的结果仍由这趟实际选择留下。`:'母灯已经复明，沿途的人与炉火留下各自的结果。';
 }else if(ending.kind==='homeward'){
  epilogues=[character('alan',f.donatedToAlan?'你交我的剑还在，我拿它断后。':'我走最后，先把还在队里的人带下山。'),
   character('he','灯芯收好了，这回先把身边的人送回去。'),
   character('du',f.ring==='left'?'避难炉还亮着，回去的人有地方暖手。':f.ring==='taken'?'避难炉已经冷了，别再让人等在风里。':'先找个避风处，下一趟再走。')];
  summary=`队伍在${NODES[ending.node].title}止步，带着还亮的${state.lamp}点灯火和唯一灯芯返回。母灯尚未复明。`;
 }else{
  epilogues=[character('alan',f.ferrymanSaved||f.northSaved||f.southSaved?'我记着我们止步的地方，也记着接出来的人。':'我们止步在这里，后面的路还没能守住。'),
   character('he',f.southSaved?'南驿的信使脱了困，这一件事没有白做。':'没走到的地方，我不能替他们报平安。'),
   character('du','哪一步值得再试，回头我们一起想，先别急着怪这把剑。')];
  summary=`旅程止于${NODES[ending.node].title}。这次没有修复母灯；已完成的救援和作品去向保留在回看中。`;
 }
 const consequences=worldChanges(state);
 if(dedicated)consequences.push(`${dedicated.name}已经嵌入母灯，不能再切回手中。`);
 return{kind:ending.kind,title:ending.kind==='relit'?'灯路复明':ending.kind==='homeward'?'保人归途':'炉火暂熄',summary,stoppedAt:NODES[ending.node].title,dedicatedWeapon:dedicated,epilogues,consequences};
}
function placeBackground(state:RunState):string {
 if(state.ending)return`/assets/d/v07-chapter3/ending-${state.ending.kind==='relit'?'twelve-lights':state.ending.kind==='homeward'?'homeward':'embers'}-v1.webp`;
 switch(state.node){
  case 1:return'/assets/d/v07/lantern-road-v1.webp';
  case 2:return`/assets/d/v07/bridge-${state.phase==='choice'?'lit':'dark'}-v1.webp`;
  case 3:return'/assets/d/v07/bridge-lit-v1.webp';
  case 4:case 6:return'/assets/d/v07-chapter2/winter-forge-v1.webp';
  case 5:return`/assets/d/v07-chapter2/twin-stations-${state.flags.northSaved&&state.flags.southSaved?'lit':state.flags.northSaved||state.flags.southSaved?'one':'dark'}-v1.webp`;
  case 7:return'/assets/d/v07-chapter3/mountain-pass-arrival-v1.webp';
  case 8:return state.flags.carrier===null?'/assets/d/v07-chapter3/mountain-pass-arrival-v1.webp':'/assets/d/v07-chapter3/relay-one-v1.webp';
  case 9:return state.flags.coreOwner==='socket'?'/assets/d/v07-chapter3/last-lantern-delivered-v1.webp':'/assets/d/v07-chapter3/mountain-pass-arrival-v1.webp';
 }
}
function buildActions(state:RunState):ActionView[] {
 const actions:ActionView[]=[],add=(action:Action,label:string,detail:string,group:ActionGroup,confirmation:string|null=null):void=>{actions.push(actionView(state,action,label,detail,group,confirmation));};
 const hand=handWeapon(state),reserve=weapon(state,state.reserveId),forge=weapon(state,state.forgeId),e=state.encounter;
 if(state.phase==='prepare'){
  add({type:'beginForge'},'用一枚铁坯开炉','消耗1枚未用铁坯；普通锤直接可用，整炉共用剩余技法次数。','primary');
  add({type:'depart'},state.node===4?'离开冬炉':state.node===5?'去双驿救援':state.node===8?'商量最后的接力':'带剑上路',state.node===9?'入场前须有合格自制剑；完好强度≥3，或真正崩纹强度≥1。':`继续当前主线：${NODES[state.node].mission}`,'primary');
 }
 if(state.phase==='forging'&&forge){
  const risk=forge.hits<3?0:forge.cracked?350:200;
  add({type:'forge',weaponId:forge.id,kind:'ordinary'},'落一记普通锤',`成功强度+1；${risk===0?'本记无裂纹风险':`${risk/10}%${forge.cracked?'再裂即碎':'首裂，强度减1'}`}。每记抽一次公开1000票。`,'forge');
  add({type:'forge',weaponId:forge.id,kind:'steady'},'用定线','消耗1次技法，强度+1，不添裂、不修旧裂；不抽票。','forge');
  add({type:'forge',weaponId:forge.id,kind:'fissure'},'刻入崩纹',forge.cracked?'消耗1次技法，强度+1，将意外裂纹转成真正崩纹；已是崩纹不能再刻。':'消耗1次技法，强度+3并留下真正崩纹；成器斩击穿甲加2，随后磨损2。','forge');
  for(const slot of ['hand','reserve'] as const){
   const replaced=weapon(state,slot==='hand'?state.handId:state.reserveId),label=slot==='hand'?'手中':'备用';
   add({type:'seal',weaponId:forge.id,slot,replace:true},`收锻，放入${label}位`,replaced?`明确替换${weaponName(replaced)}（强度${replaced.strength}）；旧持有物将弃置，不能找回。`:`锁定当前工艺与原强度，放入空${label}位。`,'forge',replaced?`确认弃置${label}位的${weaponName(replaced)}，用本柄新剑替换？`:null);
  }
  add({type:'discardForge',weaponId:forge.id},'放弃这块在锻铁坯','铁坯不返还；回到同一站整备，不恢复本炉已用技法次数。','forge','确认放弃当前在锻铁坯？铁坯和已用次数不会返还。');
 }
 if(state.phase==='prepare'||state.phase==='encounter'){
  if(reserve)add({type:'equip',weaponId:reserve.id},`换用${weaponName(reserve)}`,state.phase==='encounter'?'花1行动交换手中与备用剑；会解除架稳。':'免费交换手中与备用剑，不复制剑。','weapon');
  if(hand&&state.tool?.kind==='furnace')add({type:'temper',weaponId:hand.id},'用崩炉钉续炉',`消耗1次技法，恢复${state.tool.level===2?4:2}强度，至多到原收锻强度${hand.sealedStrength??0}；${state.tool.level===2?'可清意外裂纹，真正崩纹保留；':''}${state.phase==='encounter'?'花1行动并解除架稳。':'整备时不花行动。'}`,'tool');
  if(state.phase==='prepare')for(const value of [hand,reserve])if(value)add({type:'discardWeapon',weaponId:value.id},`放下${weaponName(value)}`,'这柄剑会离开玩家剑架；不返还铁坯，也不换钱。','weapon',`确认弃置${weaponName(value)}？此举不会得到钱或铁坯。`);
 }
 if(state.phase==='prepare'&&(state.node===1||state.node===4||state.node===7)){
  add({type:'shop',item:'coal'},'2钱添煤','补3灯火，上限8；满灯时不能购买。','camp');
  add({type:'shop',item:'blank'},'2钱买一枚铁坯','未用铁坯上限3；不赠送技法次数。','camp');
  add({type:'shop',item:'upgrade'},'4钱升阶工具','将当前一级工具升到二级；本趟只有一次升阶资格。','camp');
  add({type:'shop',item:'exchange'},'2钱交换工具',`交出当前工具，换另一件一级工具；${state.tool?.stored?`清掉现存${state.tool.stored}追斩余力；`:''}已用升阶资格不返还。`,'camp','确认交出当前工具并付2钱，换另一件一级工具？现存余力会清除，升阶资格不会返还。');
 }
 if(state.choice&&(state.phase==='choice'||state.phase==='prepare'))for(const choice of CHOICES[state.choice]){
  const copy=CHOICE_COPY[choice];
  const detail=choice==='continue-station'?(state.flags.ferrymanSaved?'摆渡人带路，不付赶路灯火；另一处每轮风雪3，两轮内救援，成功得到2钱。':'先付1灯火且付后至少留1；另一处每轮风雪3，两轮内救援，成功得到2钱。'):copy.detail;
  add({type:'choose',choice},copy.label,detail,'choice',choice==='dismantle-old'?'确认拆解仍持有的杜伯旧剑并使用唯一升阶资格？旧剑将离开剑架。':null);
 }
 if(state.phase==='encounter'&&e){
  for(const target of e.targets){
   const hit=hand&&usable(state,hand.id)?damagePreview(hand,target.armor,e.opening):null;
   add({type:'strike',targetId:target.id},`斩击${target.name}`,hit?`花1行动；伤害${hit.damage}，剑强度${hit.strengthBefore}→${hit.strengthAfter}${hit.wear?'，本击后磨损'+hit.wear:''}${hit.strengthAfter===0?'并断裂':''}。`:'花1行动；需要可用手中剑。','primary');
   if(state.tool?.kind==='rebound')add({type:'followUp',targetId:target.id},`余力追斩${target.name}`,`免费打出当前所存${state.tool.stored}伤害；不磨剑、不叠剑强度、不递归触发，每场一次。会解除架稳。`,'tool');
  }
  const stopped=e.id==='n9'&&e.targets.some(t=>t.id==='reverse-wheel'&&t.health===0),p=pressurePreview(state);
  add({type:'guard'},stopped?'架稳母灯':'架剑',`花1行动，本轮护势+3，下一次斩击无视甲且加2；每轮一次。${stopped?'同时置架稳，随后可紧接嵌剑。':'即使手中无剑也可挡护。'}`,'primary');
  add({type:'endRound'},'行动结束',`结算本轮公开压力：${p.pressure}−援手${p.reduction}−护势${p.block}，灯火损失${p.loss}；未用行动不保留。`,'primary');
  if(e.id==='n2')add({type:'cut',targetId:'bridge-rope'},'切开断桥吊索','花1行动；需要完好强度至少3的手中剑，不造成斩击磨损，不触发击破工具。','mechanism');
  if(e.id==='n5-south')add({type:'cut',targetId:'south-rope'},'切开南驿拦索','花1行动；需要完好强度至少4的手中剑，直接开路，不触发击破工具。','mechanism');
  if(e.id==='n5-north'||e.id==='n5-south')add({type:'ferryAssist'},'请摆渡人牵索','不花行动，直接打开当前驿路；双驿整段只可用一次，不触发击破工具。','mechanism');
  if(e.id==='n6')for(const value of [hand,reserve])if(value)add({type:'donate',weaponId:value.id,recipient:'shelter'},`用${weaponName(value)}撑住炉梁`,'花1行动；需要仍持有、未断且强度至少3。剑留在炉梁并离开剑架，不触发击破工具。','mechanism',`确认把${weaponName(value)}留在避难炉梁？它将离开你的剑架。`);
  if(e.id==='n7'&&reserve)add({type:'donate',weaponId:reserve.id,recipient:'alan'},`把备用${weaponName(reserve)}交给阿岚`,'花1行动；需备用剑强度至少3。本场每轮总压力减2，剑转交阿岚，不再可切换。','mechanism',`确认把备用${weaponName(reserve)}交给阿岚？剑会离开你的剑架。`);
  if(e.id==='n8'){
   add({type:'useSideRoute'},'借接应牵索开路','花1行动；需守住渡口，或救过南驿且留下恒温环。直接开路，不触发击破工具。','mechanism');
   add({type:'cut',targetId:'relay-rope'},'切开山口拦索','花1行动；需要完好强度至少4的手中剑，直接开路，不触发击破工具。','mechanism');
  }
  if(e.id==='n9'){
   add({type:'placeCore'},'把灯芯放入灯座','自己持灯路线花1行动；唯一灯芯转入灯座，会解除先前架稳。','mechanism');
   add({type:'assistBrace'},'请阿禾扶稳底座','自己持灯路线、逆转轮停下后可免费用一次；只置架稳，不加护势或破绽。','mechanism');
   const candidate=hand??reserve;
   if(candidate)add({type:'ignite',weaponId:candidate.id},`把${weaponName(candidate)}嵌入母灯`,'花1行动；须传动与逆转轮停下、灯芯在灯座、刚架稳，且使用手中合格自制剑。剑永久留在母灯，结束旅程。','mechanism',`确认将${weaponName(candidate)}留在母灯成为构件，完成这趟旅程？`);
  }
 }
 if(state.phase==='prepare'||state.phase==='encounter'||state.phase==='failed')add({type:'retryChapter'},'从本章章初重整','本章只可一次；回到章初补给后的状态，回滚本章交易、剑、灯火、剧情与付奖，保留失败记录。','journey','确认从本章章初重整？本章所有当前进展和交易都会回滚，且消耗本章唯一机会。');
 if(state.phase==='failed')add({type:'acceptFailure'},'接受败退','结束本趟，保留实际止步、作品去向与已完成的救援。','journey');
 else if(state.phase!=='ending')add({type:'evacuate'},'带人和灯芯撤离','尚有灯火即可结束本趟；唯一灯芯交回队伍，母灯不会被记作复明。','journey','确认带队伍和灯芯返回，结束本趟旅程？');
 return actions;
}

/** Public, deterministic presentation only: no random stream, checkpoint, or raw action journal. */
export function getRunView(state:RunState):RunView {
 const works=state.weapons.map(value=>weaponView(state,value)),actions=buildActions(state);
 const hand=handWeapon(state),forge=weapon(state,state.forgeId),e=state.encounter,p=pressurePreview(state),ending=endingView(state,works);
 const slot=(id:string|null):WeaponView|null=>works.find(value=>value.id===id)??null;
 const resolvedChoices:readonly ChoiceKind[]=['first-road','bridge-rescue','bridge-tool','crossing-extra','station-second','shelter-ring'];
 const place=placeBackground(state),resolved=state.nodes.some(record=>record.node===state.node&&record.completed)||(state.phase==='choice'&&state.choice!==null&&resolvedChoices.includes(state.choice));
 const targets:TargetView[]=e?e.targets.map(target=>{
  const strike=actions.find(value=>value.action.type==='strike'&&value.action.targetId===target.id)??actionView(state,{type:'strike',targetId:target.id},`斩击${target.name}`,'当前阶段不能斩击。','primary');
  const followUp=actions.find(value=>value.action.type==='followUp'&&value.action.targetId===target.id)??null;
  const hit=hand&&usable(state,hand.id)?damagePreview(hand,target.armor,e.opening):null,pressure=target.health>0?currentPressure(target.pressures,e.round):0;
  const dependency=e.targets.find(value=>value.id===target.requiresDestroyed);
  return{id:target.id,name:target.name,role:target.role,health:target.health,maxHealth:target.maxHealth,armor:target.armor,pressure,
   intent:target.health===0?'已完成':target.role==='threat'?`本轮施加${pressure}压力`:'道路机关；环境压力另计',requiresDestroyed:target.requiresDestroyed,
   dependency:dependency&&dependency.health>0?`先破除${dependency.name}`:null,asset:TARGET_ASSETS[target.id]??null,
   preview:hit?{...hit,healthAfter:Math.max(0,target.health-hit.damage),breaksWeapon:hit.strengthAfter===0}:null,strike,followUp,blockedReason:strike.reason};
 }):[];
 const eligibleWeaponIds=[state.handId,state.reserveId].filter((id):id is string=>id!==null&&finalEligible(state,id));
 const finale=state.node===9&&state.phase!=='ending'?{eligibleWeaponIds,handEligible:finalEligible(state,state.handId),requirements:[
  {id:'weapon',label:'手中合格自制剑',met:finalEligible(state,state.handId),detail:'完好强度至少3，或真正崩纹强度至少1；备用剑须先换手，旧剑不能代替。'},
  {id:'drive',label:'传动锁已断',met:e?.targets.some(value=>value.id==='drive-lock'&&value.health===0)??false,detail:'先断传动锁，才能攻击逆转轮。'},
  {id:'wheel',label:'逆转轮已停',met:e?.targets.some(value=>value.id==='reverse-wheel'&&value.health===0)??false,detail:'轮停后架剑才会架稳母灯。'},
  {id:'core',label:'唯一灯芯在灯座',met:state.flags.coreOwner==='socket',detail:state.flags.carrier==='courier'?'阿禾已选先送灯路线，开路后送入灯座。':'自己持灯时花1行动放入；放灯会解除架稳。'},
  {id:'brace',label:'当前已经架稳',met:e?.braced??false,detail:'停轮后架剑，或请阿禾用一次免费援手；随后紧接嵌剑。'},
  {id:'action',label:'剩余1行动可嵌剑',met:(e?.actions??0)>=1,detail:'嵌剑消耗1行动；结束回合不解除架稳。'},
 ]}:null;
 const failure=state.failure?{...state.failure,text:state.failure.reason==='light-exhausted'?'灯火耗尽，队伍暂时止步。':state.failure.reason==='round-limit'?'未在公开轮限内打开道路，队伍暂时止步。':'本次在这里收回脚步。'}:null;
 const tool=state.tool?{...state.tool,name:state.tool.kind==='rebound'?'回锋齿':'崩炉钉',upgradeUsed:state.upgradeUsed,
  asset:`/assets/d/v09/${state.tool.kind==='rebound'?'rebound-tooth':'furnace-nail'}-v1.webp`,
  description:state.tool.kind==='rebound'?`首次斩击击破且有正溢出时存余力，每场免费追斩一次；${state.tool.level===2?'未用余力可跨节点，新的溢出只保较大值。':'场末清除未用余力。'}`:`每场首次亲手击破带甲目标，将技法次数补至1（已满则净增0）；续炉恢复${state.tool.level===2?4:2}强度至原收锻值${state.tool.level===2?'，并清意外裂纹，真正崩纹保留':''}。`}:null;
 const view:RunView={rulesVersion:state.rulesVersion,runId:state.runId,revision:state.revision,chapter:state.chapter,chapterTitle:CHAPTER_TITLES[state.chapter],node:state.node,title:NODES[state.node].title,
  mission:ending?ending.summary:failure?failure.text:state.phase==='forging'?`${NODES[state.node].mission} 先在随身炉车打出一柄剑，再继续这一站。`:e&&state.phase==='encounter'?encounterObjective(e.id):NODES[state.node].mission,
  nextPlace:ending?ending.kind==='relit'?'母灯已复明 · 回看这趟灯路':'旅程已结束 · 回看后可另开新旅程':NODES[state.node].next,phase:state.phase,phaseLabel:PHASE_LABELS[state.phase],
  scene:{key:ending?`ending-${ending.kind}`:`node-${state.node}-${state.phase}`,background:state.phase==='forging'?'/assets/d/reboot/forge-focus-backdrop-v1.webp':place,placeBackground:place,fit:'contain',resolved},
  speaker:ending?.epilogues[0]??(failure?character('alan','先停下来。能重整就把本章从头点清；不再走，也要记住已经接出来的人。'):currentSpeaker(state)),
  lamp:state.lamp,lampMax:8,coins:state.coins,blanks:state.blanks,charge:state.charge,slots:{hand:slot(state.handId),reserve:slot(state.reserveId)},works,
  forge:forge&&state.phase==='forging'?{weapon:weaponView(state,forge),hitsLeft:Math.max(0,6-forge.hits),
   ordinary:{crackTickets:forge.hits<3?0:forge.cracked?350:200,totalTickets:1000,successStrength:forge.strength+1,crackStrength:forge.cracked?forge.strength:Math.max(0,forge.strength-1),breaksOnCrack:forge.cracked,draws:1},
   steady:{strengthAfter:forge.strength+1,crackedAfter:forge.cracked,chargeCost:1,draws:0},fissure:{strengthAfter:forge.strength+(forge.cracked?1:3),crackedAfter:true,chargeCost:1,draws:0}}:null,
  tool,storyFlags:{...state.flags},worldChanges:worldChanges(state),
  progress:([1,2,3,4,5,6,7,8,9] as const).map(node=>{
   const record=state.nodes.find(value=>value.node===node);
   return{node,chapter:Math.ceil(node/3) as Chapter,title:NODES[node].title,status:record?.completed?'completed':node===state.node?'current':record?'visited':'unreached',coinsEarned:record?.coinsEarned??0,choices:(record?.choices??[]).map(id=>({id,label:CHOICE_COPY[id].label}))};
  }),choice:state.choice,
  encounter:e?{id:e.id,objective:encounterObjective(e.id),round:e.round,roundLimit:e.roundLimit,roundsRemaining:Math.max(0,e.roundLimit-e.round+1),actions:e.actions,block:e.block,opening:e.opening,guarded:e.guarded,braced:e.braced,alanGuard:e.alanGuard,routeOpened:e.routeOpened,
   environmentPressure:currentPressure(e.environment,e.round),pressure:{...p,lampAfter:Math.max(0,state.lamp-p.loss)},targets,reboundClaimed:e.reboundClaimed,followUpUsed:e.followUpUsed,furnaceTriggered:e.furnaceTriggered,braceAssistUsed:e.braceAssistUsed}:null,
  finale,failure,retries:{chapter:state.chapter,used:state.retries[state.chapter],remaining:state.retries[state.chapter]===0?1:0,failedAttempts:state.failedAttempts.length},ending,actions,
  newJourney:{available:state.phase==='ending',confirmation:'确认开始新的护炉旅程？本趟结果可先导出保存，新旅程不继承剑、钱或工具。'}};
 return freezeDeep(view);
}
