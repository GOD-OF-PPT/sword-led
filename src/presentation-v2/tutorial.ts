import { createRun, applyCommand, getRunView, getTrial } from '../core-v2/index.js';
import type { Action } from '../core-v2/index.js';
import { SECTION_NAMES } from '../core-v2/rules.js';
import { bindStrikeInput } from '../platform/input.js';
import { element } from '../presentation/dom.js';
import { NODE_X, nodeY, paintBlade } from './blade.js';

/** A real private run: no repository, formal session, journal export or economic rewards. */
export function createTutorial(texture:()=>HTMLImageElement|undefined,slow:boolean){
  const body=element('section',undefined,'forge-lesson');body.id='v2-lesson';
  const intro=element('p','练习炉不写入正式契约。先在刃上连续敲左侧三个相邻点，再转到脊；最后淬火与交货。每点容量6，平锤占3。');
  const hint=element('p',undefined,'lesson-hint');hint.id='v2-lesson-hint';hint.setAttribute('role','status');
  const stage=element('div',undefined,'blade-host lesson-stage'),canvas=element('canvas');canvas.setAttribute('aria-label','练习剑真实锻造结果');
  const nodes=element('div');stage.append(canvas,nodes);
  const track=element('div',undefined,'timing-track');for(const s of['偏击','普通','精准','普通','偏击'])track.append(element('span',s));const cursor=element('i');track.append(cursor);
  const strike=element('button','按住空格或鼠标，亮线到中央松开','primary');strike.id='v2-lesson-strike';
  const report=element('p',undefined,'small'),actions=element('div',undefined,'phase-actions');
  const water=element('button','练习水淬'),oil=element('button','练习油淬'),deliver=element('button','练习交货'),reset=element('button','重新练习');
  water.id='v2-lesson-water';oil.id='v2-lesson-oil';deliver.id='v2-lesson-deliver';actions.append(water,oil,deliver,reset);
  body.append(intro,hint,stage,track,strike,report,actions);
  function initial(){const r=createRun({runId:'tutorial-d',seed:'D-private-practice'});if(!r.ok)throw Error(r.error);let s=r.state;for(const action of[{type:'chooseTechnique',techniqueId:'bridgeClip'},{type:'chooseRequest',requestId:null}]as const){const a=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});if(!a.ok)throw Error(a.error);s=a.state;}return s;}
  let state=initial(),node=0,epoch=0,disposed=false;
  const buttons:HTMLButtonElement[]=[];
  const input=bindStrikeInput(strike,{
    context:()=>disposed||strike.disabled?null:{rulesVersion:'forge-v2',runId:state.runId,revision:state.revision,generation:0,epoch,pieceId:'1:1',node,mode:'standard',periodMs:1400*(slow?1.5:1)},
    release:a=>send({type:'strike',pieceId:'1:1',node:a.identity.node??0,mode:'standard',timingMark:a.timingMark}),
    visual:v=>{cursor.style.left=`${v.preparing?v.mark/100:0}%`;},
  });
  function send(action:Action){const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(r.ok){state=r.state;render();}else{report.textContent='这一步暂时不可用：可以换落点、淬火或重新练习。';}}
  function render(){
    if(disposed)return;input.refresh();const view=getRunView(state,{pieceId:'1:1',node,mode:'standard'}),p=view.selected;if(!p)return;
    hint.textContent=p.status==='delivered'?'练习完成。交货取得金币并计入配额，回收则只取得废料。':p.quench?'已经封存，检查实际锋/韧/衡，再练习交货。':p.patterns.includes('edge')&&p.patterns.includes('spine')?'两种锻纹完成。比较水/油结果，再选一种封存。':p.patterns.includes('edge')?'巡锋完成；再选中段、根部、剑茎的脊侧各一锤。':'先依次选剑尖、前刃、中段的刃侧，各精准落锤一次。';
    report.textContent=`锋${p.ratings.edge} / 韧${p.ratings.toughness} / 衡${p.ratings.balance}；热${p.heat}，应力${p.stress}/${p.threshold}，完整${p.integrity}/${p.maxIntegrity}；${p.quench?`试剑：切${getTrial(p)?.cut} / 挡${getTrial(p)?.block} / 衡${getTrial(p)?.handling}档，可交${p.value}`:'中央精准，普通也能加工；偏击多加应力。'}`;
    strike.disabled=!p.outcomes[0]?.allowed;water.disabled=!p.quenches[0]?.allowed;oil.disabled=!p.quenches[1]?.allowed;deliver.disabled=!p.quench||p.status!=='active';
    for(const[i,b]of buttons.entries()){b.disabled=p.quench!==null||p.status!=='active';b.setAttribute('aria-pressed',String(i===node));b.textContent=`${i<5?'刃':'脊'} ${p.nodes[i]??0}/6`;}
    queueMicrotask(()=>{if(!disposed&&canvas.isConnected)paintBlade(canvas,p,node,texture());});
  }
  for(let i=0;i<10;i++){const b=element('button',undefined,'lesson-node');b.style.left=`${(NODE_X[i%5]??0)/10}%`;b.style.top=`${nodeY(i)/3.4}%`;b.setAttribute('aria-label',`练习${SECTION_NAMES[i%5]}${i<5?'刃':'脊'}落点`);b.addEventListener('click',()=>{input.cancel();epoch++;node=i;render();strike.focus({preventScroll:true});});buttons.push(b);nodes.append(b);}
  for(const[control,medium]of[[water,'water'],[oil,'oil']]as const)control.addEventListener('click',()=>send({type:'quench',pieceId:'1:1',medium}));
  deliver.addEventListener('click',()=>send({type:'deliver',pieceId:'1:1'}));reset.addEventListener('click',()=>{input.cancel();epoch++;state=initial();node=0;render();strike.focus();});
  body.addEventListener('keydown',event=>{if(event.ctrlKey||event.altKey||event.metaKey)return;const k=event.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k))return;event.preventDefault();input.cancel();epoch++;node=k==='ArrowUp'?node%5+5:k==='ArrowDown'?node%5:Math.floor(node/5)*5+Math.max(0,Math.min(4,node%5+(k==='ArrowRight'?1:-1)));render();if(!strike.disabled)strike.focus({preventScroll:true});});
  render();return {body,dispose(){disposed=true;epoch++;input.dispose();}};
}
