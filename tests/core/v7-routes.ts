import {createRun,applyCommand} from '../../src/core-v7/game.js';
import type {Action} from '../../src/core-v7/model.js';
export function run(seed='lantern'){
 const created=createRun({runId:'full-campaign',seed});if(!created.ok)throw Error(created.error);
 let state=created.state;
 const act=(action:Action)=>{const r=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)throw Error(`${state.node}/${state.phase} ${JSON.stringify(action)}: ${r.error}`);state=r.state;return r;};
 const forge=(kind:'plain'|'fissure',slot:'hand'|'reserve'='reserve')=>{
  act({type:'beginForge'});const id=state.forgeId!;
  for(let i=0;i<3;i++)act({type:'forge',weaponId:id,kind:'ordinary'});
  act({type:'forge',weaponId:id,kind:kind==='plain'?'steady':'fissure'});
  act({type:'seal',weaponId:id,slot,replace:false});return id;
 };
 return{get state(){return state;},act,forge};
}
export function plainRoute(){
 const r=run(),a=r.act;
 const blade=r.forge('plain');a({type:'equip',weaponId:blade});
 a({type:'depart'});a({type:'guard'});a({type:'strike',targetId:'wood-guard'});a({type:'choose',choice:'escort'});
 a({type:'depart'});a({type:'cut',targetId:'bridge-rope'});a({type:'choose',choice:'rescue-ferryman'});a({type:'choose',choice:'take-rebound'});
 a({type:'depart'});a({type:'guard'});a({type:'strike',targetId:'charger'});a({type:'followUp',targetId:'flanker'});a({type:'endRound'});a({type:'strike',targetId:'flanker'});
 a({type:'choose',choice:'hold-crossing'});a({type:'guard'});a({type:'strike',targetId:'rammer'});a({type:'endRound'});
 a({type:'choose',choice:'keep-old'});a({type:'shop',item:'upgrade'});a({type:'depart'});
 a({type:'depart'});a({type:'choose',choice:'north-first'});a({type:'ferryAssist'});a({type:'choose',choice:'continue-station'});a({type:'cut',targetId:'south-rope'});
 a({type:'depart'});a({type:'donate',weaponId:'du-old-sword',recipient:'shelter'});a({type:'choose',choice:'leave-ring'});
 a({type:'beginForge'});const backup=r.state.forgeId!;for(let i=0;i<3;i++)a({type:'forge',weaponId:backup,kind:'ordinary'});a({type:'seal',weaponId:backup,slot:'reserve',replace:false});
 a({type:'depart'});a({type:'donate',weaponId:backup,recipient:'alan'});a({type:'guard'});a({type:'endRound'});a({type:'guard'});a({type:'strike',targetId:'main-rock'});a({type:'endRound'});a({type:'strike',targetId:'main-rock'});
 a({type:'depart'});a({type:'choose',choice:'courier-carries'});a({type:'useSideRoute'});
 return{r,blade,backup};
}
export function fissureRoute(){
 const r=run('furnace'),a=r.act;
 a({type:'depart'});a({type:'guard'});a({type:'strike',targetId:'wood-guard'});a({type:'endRound'});a({type:'strike',targetId:'wood-guard'});a({type:'choose',choice:'salvage'});
 a({type:'depart'});a({type:'cut',targetId:'bridge-rope'});a({type:'choose',choice:'save-cargo'});a({type:'choose',choice:'take-furnace'});
 const blade=r.forge('fissure');a({type:'equip',weaponId:blade});
 a({type:'depart'});a({type:'strike',targetId:'charger'});a({type:'strike',targetId:'flanker'});a({type:'choose',choice:'leave-crossing'});
 a({type:'choose',choice:'pay-upgrade'});a({type:'temper',weaponId:blade});a({type:'depart'});
 a({type:'depart'});a({type:'choose',choice:'north-first'});a({type:'strike',targetId:'north-latch'});a({type:'choose',choice:'continue-station'});a({type:'strike',targetId:'south-latch'});
 a({type:'temper',weaponId:blade});a({type:'depart'});a({type:'donate',weaponId:'du-old-sword',recipient:'shelter'});a({type:'choose',choice:'take-ring'});
 a({type:'depart'});a({type:'strike',targetId:'main-rock'});a({type:'strike',targetId:'loose-rock'});
 a({type:'temper',weaponId:blade});a({type:'depart'});a({type:'choose',choice:'player-carries'});a({type:'strike',targetId:'relay-latch'});
 return{r,blade};
}
