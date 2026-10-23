import type {DomainEvent,RunView} from '../core-v6/index.js';

export interface StageCopy {readonly eyebrow:string;readonly title:string;readonly purpose:string;readonly uses:string}
export interface ForgeCopy {readonly risk:string;readonly technique:string;readonly seal:string;readonly condition:string}
export interface ResultCopy {readonly kicker:string;readonly title:string;readonly copy:string}
export interface RecapCopy {readonly title:string;readonly copy:string;readonly facts:readonly string[]}

const fmt=(value:number)=>value.toLocaleString('zh-CN');
const toolName=(tool:RunView['tool'])=>tool==='rebound'?'回锋齿':tool==='furnace'?'崩炉钉':'没有额外工具';
const schoolName=(school:'steady'|'fissure'|null)=>school==='steady'?'定线':school==='fissure'?'崩纹':'手艺';

function mainUses(view:RunView):string {
 const plan=view.bladeUses?.mainPlan;
 if(!view.activePiece?.school)return'先选手艺，再落第一锤。';
 if(!plan?.clearable)return'眼前这柄，还不足以三回合开路。';
 const rope=plan.routes.some(route=>route.rope),latch=plan.routes.some(route=>route.latch);
 if(rope||latch)return`已有开路走法 · 尚有余力争${rope&&latch?'一件工具':rope?'回锋齿':'崩炉钉'}`;
 return'已有开路走法 · 额外工具条件未齐';
}

/** All forecasts and permissions come from the formal view, not a second solver. */
export function stageCopy(view:RunView):StageCopy {
 switch(view.phase){
  case'main-forge':return{
   eyebrow:'第一炉 · 一剑开路',title:view.activePiece?.school?'这柄剑，准备怎么用？':'先选手艺，再落第一锤',
   purpose:view.activePiece?.school?'左键点剑身落锤。想用手艺，先点手艺按钮，再落下一锤；收锻后就带这柄去试锋。':'三柄铁坯共用一次手艺。先挑稳锋或裂炉，再左键落锤；不是选好就自动生效。',uses:mainUses(view),
  };
  case'main-trial':return{
   eyebrow:'携剑试锋',title:'木盾挡着路，这一剑怎么出？',
   purpose:'点木卫斩击，或先架剑探隙。每次用一回合，护送的人在等你开路。',
   uses:view.trial?.opening?'接缝已经露出，下一斩会用掉这次探隙。':'探隙只照顾下一斩；直接出剑与先找接缝，由你决定。',
  };
  case'cache':{
   const possible=view.caches.filter(cache=>cache.allowed);
   return{eyebrow:'路已经通了',title:'把余力用在哪里？',purpose:'最多带走一件工具，也可以就此启程。这里不能再架剑或换剑。',
    uses:!view.trial?.turnsLeft?'这柄已经用完试锋余火，带着开路钱继续走吧。':possible.length?`这柄现在能取${possible.map(cache=>cache.target==='rope'?'吊索里的回锋齿':'铁闩后的崩炉钉').join('或')}。`:'这柄还不合工具条件；剑已开路，酬劳不会因此丢掉。'};
  }
  case'echo-forge':return view.tool==='rebound'?{
   eyebrow:'回锋齿 · 试着用一次',title:'让这一剑，还有下一剑',purpose:'另铸一柄，先探隙再斩主靶。超出的伤害会留下，再由你指向远处的靶。',uses:'工具要靠实际追斩用出来；这里只试一次，不再发开路钱。',
  }:{
   eyebrow:'崩炉钉 · 试着用一次',title:'把炉火接到下一柄',purpose:view.charge?'先用掉这炉的一次手艺，再击破带护甲的主靶，看看次数能否回来。':'次数已经用掉了；带剑击破护甲，看看能否接回来。',uses:view.charge?'次数本来是满的，击破不会多出第二次；先把这一次真正用出去。':'主靶击破后，才可能把用掉的那次接回来。',
  };
  case'echo-trial':{
   if(view.tool==='rebound')return{
    eyebrow:'回锋齿 · 实际试锋',title:view.followUp.allowed?'指向远靶，把余力送过去':'这一斩，留得出余力吗？',
    purpose:view.followUp.allowed?`点远靶，送出存下的${fmt(view.followUp.damage)}伤害。`:'先探隙，再斩主靶；超出的伤害才能留作追斩。',uses:view.followUp.allowed?'只用这份余力，不再加剑的强度。':'三回合只试一次，余力还要亲手追出。',
   };
   return{eyebrow:'崩炉钉 · 实际试锋',title:'击破护甲，把手艺接回来',purpose:'点主靶出剑；击破后看这炉手艺次数的真实变化。',uses:view.charge?'现在次数已满；触发工具也不会额外赚一次。':'刚才用掉的次数，等这次真正击破后才会回来。'};
  }
  case'echo-recharge':return{
   eyebrow:'崩炉钉 · 接上新坯',title:view.echo.rechargeGained?'把刚回的手艺，用在另一柄':'没有多得次数，仍可用现有手艺',
   purpose:'这柄新坯先选手艺，再备下一记、左键落锤；用完就收好。',
   uses:view.echo.rechargeGained?'刚才确实回了一次；在另一柄上用出来，才算接成。':'击破时次数本来就是满的，没有净增加；这次不能算成功回充。',
  };
  case'recap':case'failed':{
   const recap=recapCopy(view);return{eyebrow:'这一剑的回顾',title:recap.title,purpose:recap.copy,uses:'回看真实经过，或再铸一剑换个走法。'};
  }
 }
}

export function forgeCopy(view:RunView,armed:boolean):ForgeCopy {
 const blade=view.activePiece,forge=view.forge;
 const condition=!blade?'这一柄已收好':blade.status==='broken'?'已经断裂':blade.fissureMarked&&blade.cracked?'崩纹裂剑':blade.cracked?'已有裂纹':blade.hits===0?'尚未落锤':'剑身完好';
 if(!blade||!forge)return{condition,risk:'已经离开炉台，不能再补锤。',technique:'先回到可以锻造的阶段',seal:'这柄已收锻'};
 let risk:string;
 if(view.phase==='echo-recharge')risk='这里只能用现有的这一次手艺，不能普通落锤。';
 else if(armed&&forge.technique.allowed)risk=blade.school==='fissure'?`下一记主动刻裂，落下后强度${fmt(forge.technique.strengthAfter)}；不再能切吊索。`:`下一记不会添新裂纹，落下后强度${fmt(forge.technique.strengthAfter)}；已有裂纹不会修复。`;
 else if(!forge.ordinary.allowed)risk=errorCopy(forge.ordinary.reason??'unavailable');
 else if(forge.ordinary.crackTickets===0)risk=blade.cracked?'下一记普通锤不会再裂，已有裂纹仍在。':'下一记普通锤不会裂；之后的风险另看当前提示。';
 else{
  const percent=fmt(forge.ordinary.crackTickets/forge.ordinary.totalTickets*100);
  risk=forge.ordinary.crackBreaks?`下一记普通锤有${percent}%会断，收锻也能保住当前结果。`:`下一记普通锤有${percent}%会留下裂纹；这记裂损会降低强度。`;
 }
 const technique=!blade.school?'先选一门手艺':!view.charge?'手艺已用 · 本炉余0次':!forge.technique.allowed?errorCopy(forge.technique.reason??'unavailable'):armed?`已备${schoolName(blade.school)} · 仅下一记，点此取消`:`备${schoolName(blade.school)} · 下一锤（余1次）`;
 return{condition,risk,technique,seal:forge.seal.allowed?'收锻，携剑试锋':forge.seal.reason==='empty_blade'?'先落一锤，再携剑试锋':'当前不能收锻'};
}

function recapReason(reason:string):string {
 switch(reason){
  case'main-blanks-exhausted':return'这炉的三柄铁坯都已用过。回看刚才的剑，再开新炉调整做法。';
  case'echo-blanks-exhausted':return'这炉余坯已尽，工具没试成；开出的路和所得工具仍保留。';
  case'echo-turns-exhausted':return'试锋余火已尽，工具没试成；开出的路和所得工具仍保留。';
  case'rebound-no-overkill':return'主靶已倒，没有存下追斩余力；回锋还没接成。';
  case'echo-no-blank-after-recharge':return'工具已触发，余坯已尽，没能在另一柄上用出。';
  case'furnace-charge-was-full':return'触发时次数已满；用掉原有次数，仍不算净回充。';
  case'gate-cleared-without-tool':return'这一剑已经开路，本次没有带走额外工具。';
  case'furnace-demonstrated':return'击破甲靶回充＋1，并在另一柄新坯用出了这次手艺。';
  case'rebound-demonstrated':return'存下的余力，已亲手追斩并击破远靶。';
  default:return'开出的路、用过的剑和所得工具，都留在这次回顾里。';
 }
}

/** Pick one result from an Accepted event batch; never turn animation into a reward. */
export function resultCopy(events:readonly DomainEvent[]):ResultCopy|null {
 const recap=events.find(event=>event.type==='Recap');
 if(recap?.type==='Recap')return{kicker:'这一段已收好',title:recap.demonstrated?'工具，真正用出来了':'回看这一剑',copy:recapReason(recap.reason)};
 const charge=events.find(event=>event.type==='ChargeRestored');
 if(charge?.type==='ChargeRestored')return{kicker:'崩炉钉应声',title:charge.gained?'炉火，回来了':'次数本来就是满的',copy:charge.gained?'手艺＋1 · 新坯选手艺、备下一记，再落锤。':'工具已触发，没有多得次数。'};
 const cache=events.find(event=>event.type==='CacheTaken');
 if(cache?.type==='CacheTaken')return{kicker:cache.target==='rope'?'吊索，断开了':'铁闩，破开了',title:toolName(cache.tool)+'到手',copy:'下一炉，亲手试试这门新手艺。'};
 const gate=events.find(event=>event.type==='GateCleared');
 if(gate?.type==='GateCleared')return{kicker:'路，开了',title:'护送人，过关了',copy:`开路钱 ${fmt(gate.amount)}铜钱 · ${gate.turnsLeft?`还余${gate.turnsLeft}火，可争工具`:'最后一火通关，也算开路成功'}`};
 const failed=events.find(event=>event.type==='TrialFailed'||event.type==='Failed');
 if(failed?.type==='Failed')return{kicker:'炉火歇下了',title:'这次还没开路',copy:recapReason(failed.reason)};
 if(failed?.type==='TrialFailed')return{kicker:'这柄没能完成',title:'试锋余火已尽',copy:failed.stage==='main'?'这柄的经过已留下；有未用新坯时，可调整做法再试，手艺次数不会重来。':'这次工具练习结束，开路成果仍在；不会补出一次试锋。'};
 const follow=events.find(event=>event.type==='FollowUpStored');
 if(follow?.type==='FollowUpStored')return{kicker:'回锋留住余力',title:`存下${fmt(follow.damage)}追斩`,copy:'点远靶，只打出这份余力，不再加剑的强度。'};
 const hit=events.find(event=>event.type==='Forged');
 if(hit?.type==='Forged'){
  const titles={success:'刃锋渐成',crack:'裂纹留下了',broken:'这一柄，断了',steady:'定线落下',fissure:'崩纹刻进剑身'};
  const detail=hit.result==='broken'?'换一柄再起火；已用的手艺不会回来。':hit.result==='crack'?'再裂会断，普通裂纹不带穿甲。':hit.result==='fissure'?'穿甲出剑，随后磨损；不能切绳。':hit.result==='steady'?'仅这一锤不添裂纹，不修旧裂。':'';
  return{kicker:hit.result==='broken'?'上一柄的落锤结果':hit.technique?'这次手艺已用出':'这一锤',title:titles[hit.result],copy:hit.result==='broken'?detail:`强度 ${fmt(hit.before)} → ${fmt(hit.after)}${detail?' · '+detail:''}`};
 }
 const strike=events.find(event=>event.type==='Struck');
 if(strike?.type==='Struck')return{kicker:'剑落下了',title:strike.damage?`打出${fmt(strike.damage)}伤害`:'木盾挡住了这一剑',copy:strike.damage?`耐久 ${strike.before} → ${strike.after}`:'余火−1 · 可以先架剑找接缝'};
 if(events.some(event=>event.type==='Guarded'))return{kicker:'架剑，等接缝',title:'破绽，露出来了',copy:'余火−1 · 只照顾下一斩，再架不叠加'};
 const school=events.find(event=>event.type==='SchoolChosen');
 if(school?.type==='SchoolChosen')return{kicker:'手艺已选',title:schoolName(school.school),copy:'选好没有花次数。想用它，先点手艺按钮，再落下一锤；次数看炉边标记。'};
 if(events.some(event=>event.type==='Sealed'))return{kicker:'收锻',title:'把这柄，带去试锋',copy:'强度与裂纹已经定下；试锋中不能换剑或回炉补锤。'};
 if(events.some(event=>event.type==='Discarded'))return{kicker:'换坯',title:'刚才的剑留下记录',copy:'只换尚未锻过的新坯，不会返还这炉已用的手艺次数。'};
 return null;
}

export function recapCopy(view:RunView):RecapCopy {
 const facts=[view.gateCleared?'主路已开':'主路未开',`本次开路钱 ${fmt(view.coins)}铜钱`,view.tool?`带回工具：${toolName(view.tool)}`:'本次没有带回工具'];
 if(view.tool==='furnace'&&view.echo.toolTriggered)facts.push(view.echo.rechargeGained?view.echo.techniqueUsedAfterRecharge?'回来的一次，已在另一柄上用出':'确实回了一次，尚未在另一柄上用出':'触发时次数已满，没有净增加');
 if(view.tool==='rebound'){
  const sent=view.trial?.followUpUsed||view.history.some(trial=>trial.kind==='rebound'&&trial.followUpUsed);
  facts.push(view.echo.demonstrated?'回锋追斩已击破远靶':sent?'追斩已送出，远靶未击破':'这次还没有送出回锋追斩');
 }
 if(view.phase==='failed')return{title:'这次还没开路',copy:recapReason(view.endReason??'main-blanks-exhausted'),facts};
 if(!view.tool)return{title:view.gateCleared?'一剑开路，先到这里':'这一剑，先收好',copy:view.gateCleared?'路已通，酬劳已按实际结果留下；这次没有带走额外工具。':'回看这次真实经过，再决定下一炉的做法。',facts};
 return{title:view.echo.demonstrated?view.tool==='rebound'?'回锋，接到了远处':'炉火，接到了下一柄':'工具带回了，还没有用开',copy:recapReason(view.echo.reason??view.endReason??''),facts};
}

export function errorCopy(code:string):string {
 const copy:Readonly<Record<string,string>>={
  school_required:'先给这柄选一门手艺，再落锤。',school_locked:'首锤后手艺已定；想换做法，要用另一柄新坯。',
  no_charge:'现在没有可用的手艺次数，换坯不会自动补回。',already_cracked:'这柄已有裂纹，不能再刻崩纹。',
  hammer_limit:'这柄已敲满六记，不能再锤；可收锻查看用途。',empty_blade:'先落至少一锤，再带剑去试锋。',
  piece_unavailable:'这柄已不能继续用，请看手中剑和剩余新坯。',turns_exhausted:'试锋余火已用尽，查看本次结果再决定去向。',
  target_unavailable:'眼前目标已变化，请按当前可选目标出手。',cache_unavailable:'这柄还不合工具条件；看看目标旁的要求，也可带着开路钱离开。',
  tool_unavailable:'本段只取一件工具，已经取得的不会再发一份。',record_limit:'记录已到安全上限，请先导出这趟行程，再开新炉。',
  wrong_phase:'这次动作不属于眼前阶段，请看当前可做的事。',wrong_run:'行程已换，请重新查看眼前这柄剑。',stale_revision:'结果已更新，请按当前画面重新选择。',
  stale_session:'页面身份已更新，请重新读取当前行程。',readonly:'另一开路页面正在保存；关闭占用页后再读取最新。',
  save_conflict:'磁盘行程已变化；先导出想保留的进度，再读取最新。',save_unavailable:'当前行程暂不可读取或保存，可查看备份或明确选择不保存试玩。',
  locks_unsupported:'暂时不能取得保存权，可明确选择不保存试玩。',not_active:'页面已停用，请重新读取当前行程。',
  confirmation_required:'这会替换当前进度，请先查看来源，再明确确认。',main_available:'主档仍可继续，不能用备份直接替换。',
  backup_unavailable:'没有可恢复的合法备份；原文保留，可先导出。',session_busy:'本次结果正在收妥，请稍后再操作。',
  invalid_run_id:'这次行程标记无效，请重新开炉。',invalid_seed:'行旅种子需有内容，且不超过64个字符。',
  wrong_rules:'这份行程属于其他玩法，请回对应入口继续。',invalid_command:'这次动作没有成立，请按当前可用按钮重新操作。',
  disposed:'这页已经退出，请重新打开行程。',no_run:'尚未开炉，先开始或读取一趟行程。',unavailable:'当前不能这样做，请查看眼前的剑和可选动作。',
 };
 return copy[code]??'这次选择没有成立；已接受的结果保持，请查看当前行程。';
}
