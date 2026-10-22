import type {Page} from '@playwright/test';
import type {Action} from '../../src/core-v5/index.js';

export interface AudioFaults {deny?:boolean;rejectResume?:boolean;defer?:boolean}
interface NodeRecord {id:number;kind:string;context:number}
interface SourcePath {oscillator:number;envelope:number|null;master:number|null;analyser:number|null;destination:number|null}
interface SourceRecord {id:number;at:number;when:number;frequency:number;type:OscillatorType;stopAt:number|null;ended:boolean;disconnected:boolean;context:number;resetSerial:number;currentTime:number;masterGainValue:number|null;path:SourcePath}
interface CaptureReset {serial:number;at:number;contexts:{context:number;currentTime:number;state:AudioContextState}[]}
interface WaveformWindow {resetSerial:number;at:number;gapMs:number|null;context:number;currentTime:number;state:AudioContextState;peak:number;activeSourceIds:number[];masterGainValue:number;analyser:number;fftSize:number;windowDurationMs:number}
interface MasterGainCall {resetSerial:number;at:number;context:number;currentTime:number;master:number;method:string;args:number[];valueBefore:number;valueAfter:number}
interface AudioCapture {peak:number;samples:number;contacts:{at:number;outcome:string}[];inputs:({at:number;type:string;trusted:boolean}&AuthorityState)[];resetSerial:number;resetAt:number;resets:CaptureReset[];windows:WaveformWindow[];peakWindow:WaveformWindow|null;maxSampleGapMs:number;lastSampleAt:number|null}
interface AuthorityState {hasFocus:boolean;visibilityState:DocumentVisibilityState;hidden:boolean;userActivation:{isActive:boolean;hasBeenActive:boolean}|null}
interface TrustedInputObservation extends AuthorityState {at:number;type:string;targetId:string;label:string;key:string|null;code:string|null;button:number|null}
interface ButtonClickObservation extends AuthorityState {sequence:number;at:number;id:string;label:string;trusted:true;starts:number;activeSourceIds:number[]}
interface NativeContextClock {context:number;state:AudioContextState;currentTime:number;sampleRate:number;baseLatency:number|null;outputTimestamp:{contextTime:number|null;performanceTime:number|null}|{error:string}|null}
interface NativeConstruction {context:number;superBeginAt:number;superReturnAt:number;state:AudioContextState;currentTime:number}
interface NativeOperation extends AuthorityState {id:number;parent:number|null;kind:'resume'|'suspend'|'close';origin:'resume-call'|'suspend-call'|'close-call'|'held-release';phase:'request'|'held'|'native-start'|'settled'|'rejected'|'threw'|'fault-rejected';at:number;context:number;state:AudioContextState;currentTime:number;error?:string}
interface ReleaseAudioProbe {
 contexts:AudioContext[];analysers:AnalyserNode[];active:Set<OscillatorNode>;nodes:NodeRecord[];
 edges:{from:number;to:number;at:number}[];sources:SourceRecord[];frequencies:number[];
 constructors:number;starts:number;stops:number;maxActive:number;resumeCalls:number;suspendCalls:number;closeCalls:number;
 deferred:boolean;faults:AudioFaults;releaseResume?:()=>Promise<void>;capture:AudioCapture;resetCapture():void;
 lifecycle:{at:number;type:string;trusted:boolean;hidden:boolean}[];
 states:{at:number;context:number;state:AudioContextState}[];
 buttonClicks:ButtonClickObservation[];trustedInputs:TrustedInputObservation[];readAuthority():AuthorityState;
 operations:NativeOperation[];constructions:NativeConstruction[];masterGainCalls:MasterGainCall[];readClocks():NativeContextClock[];
}
declare global {interface Window {v5ReleaseAudio:ReleaseAudioProbe}}

/** Self-contained initializer also serialized for the separately owned native Chrome/CDP consumer. */
export function initializeReleaseAudioProbe(faults:AudioFaults={}){
  const NativeContext=window.AudioContext;
  const authority=():AuthorityState=>{const activation=navigator.userActivation;return{hasFocus:document.hasFocus(),visibilityState:document.visibilityState,hidden:document.hidden,userActivation:activation?{isActive:activation.isActive,hasBeenActive:activation.hasBeenActive}:null};};
  const capture:AudioCapture={peak:0,samples:0,contacts:[],inputs:[],resetSerial:0,resetAt:performance.now(),resets:[],windows:[],peakWindow:null,maxSampleGapMs:0,lastSampleAt:null};
  const probe:ReleaseAudioProbe={contexts:[],analysers:[],active:new Set(),nodes:[],edges:[],sources:[],frequencies:[],constructors:0,starts:0,stops:0,maxActive:0,resumeCalls:0,suspendCalls:0,closeCalls:0,deferred:false,faults:{...faults},capture,lifecycle:[],states:[],buttonClicks:[],trustedInputs:[],readAuthority:authority,operations:[],constructions:[],masterGainCalls:[],readClocks(){return this.contexts.map((context,index)=>{
   let outputTimestamp:NativeContextClock['outputTimestamp']=null;
   try{if(typeof context.getOutputTimestamp==='function'){const stamp=context.getOutputTimestamp();outputTimestamp={contextTime:stamp.contextTime??null,performanceTime:stamp.performanceTime??null};}}catch(error){outputTimestamp={error:String(error)};}
   return{context:index+1,state:context.state,currentTime:context.currentTime,sampleRate:context.sampleRate,baseLatency:typeof context.baseLatency==='number'?context.baseLatency:null,outputTimestamp};
  });},resetCapture(){
   capture.peak=0;capture.samples=0;capture.contacts=[];capture.inputs=[];capture.resetSerial++;capture.resetAt=performance.now();capture.windows=[];capture.peakWindow=null;capture.maxSampleGapMs=0;capture.lastSampleAt=null;
   capture.resets.push({serial:capture.resetSerial,at:capture.resetAt,contexts:this.contexts.map((context,index)=>({context:index+1,currentTime:context.currentTime,state:context.state}))});if(capture.resets.length>128)capture.resets.shift();
  }};
  window.v5ReleaseAudio=probe;
  const ids=new WeakMap<AudioNode,number>(),masters=new WeakMap<AudioContext,GainNode>(),analyserOwners=new WeakMap<AnalyserNode,{context:AudioContext;id:number;master:GainNode}>();let serial=0,clickSequence=0,operationSerial=0;
  function masterCall(context:AudioContext,contextId:number,master:GainNode,method:string,args:number[],valueBefore:number,at:number){
   probe.masterGainCalls.push({resetSerial:capture.resetSerial,at,context:contextId,currentTime:context.currentTime,master:ids.get(master)!,method,args,valueBefore,valueAfter:master.gain.value});if(probe.masterGainCalls.length>1024)probe.masterGainCalls.shift();
  }
  function observeMaster(context:AudioContext,contextId:number,master:GainNode){
   const parameter=master.gain,cancel=parameter.cancelScheduledValues.bind(parameter),set=parameter.setValueAtTime.bind(parameter),target=parameter.setTargetAtTime.bind(parameter),linear=parameter.linearRampToValueAtTime.bind(parameter),exponential=parameter.exponentialRampToValueAtTime.bind(parameter);
   masterCall(context,contextId,master,'created',[],parameter.value,performance.now());
   parameter.cancelScheduledValues=time=>{const at=performance.now(),value=parameter.value,result=cancel(time);masterCall(context,contextId,master,'cancelScheduledValues',[time],value,at);return result;};
   parameter.setValueAtTime=(value,time)=>{const at=performance.now(),previous=parameter.value,result=set(value,time);masterCall(context,contextId,master,'setValueAtTime',[value,time],previous,at);return result;};
   parameter.setTargetAtTime=(value,time,constant)=>{const at=performance.now(),previous=parameter.value,result=target(value,time,constant);masterCall(context,contextId,master,'setTargetAtTime',[value,time,constant],previous,at);return result;};
   parameter.linearRampToValueAtTime=(value,time)=>{const at=performance.now(),previous=parameter.value,result=linear(value,time);masterCall(context,contextId,master,'linearRampToValueAtTime',[value,time],previous,at);return result;};
   parameter.exponentialRampToValueAtTime=(value,time)=>{const at=performance.now(),previous=parameter.value,result=exponential(value,time);masterCall(context,contextId,master,'exponentialRampToValueAtTime',[value,time],previous,at);return result;};
  }
  function sourcePath(source:OscillatorNode,master:GainNode|undefined):SourcePath{
   const oscillator=ids.get(source)!,envelope=probe.edges.find(edge=>edge.from===oscillator)?.to??null,masterId=master?ids.get(master)??null:null;
   const outputs=masterId===null?[]:probe.edges.filter(edge=>edge.from===masterId).map(edge=>edge.to);
   return{oscillator,envelope,master:masterId,analyser:outputs.find(id=>probe.nodes.some(node=>node.id===id&&node.kind==='post-master-analyser'))??null,destination:outputs.find(id=>probe.nodes.some(node=>node.id===id&&node.kind==='destination'))??null};
  }
  function operation(context:AudioContext,contextId:number,id:number,parent:number|null,kind:NativeOperation['kind'],origin:NativeOperation['origin'],phase:NativeOperation['phase'],error?:unknown){
   const entry:NativeOperation={id,parent,kind,origin,phase,at:performance.now(),context:contextId,state:context.state,currentTime:context.currentTime,...authority()};if(error!==undefined)entry.error=String(error);
   probe.operations.push(entry);if(probe.operations.length>512)probe.operations.shift();
  }
  function observeNative(context:AudioContext,contextId:number,id:number,parent:number|null,kind:NativeOperation['kind'],origin:NativeOperation['origin'],run:()=>Promise<void>){
   operation(context,contextId,id,parent,kind,origin,'native-start');let result:Promise<void>;
   try{result=run();}catch(error){operation(context,contextId,id,parent,kind,origin,'threw',error);throw error;}
   void result.then(()=>operation(context,contextId,id,parent,kind,origin,'settled'),error=>operation(context,contextId,id,parent,kind,origin,'rejected',error));
   return result;
  }
  function node<T extends AudioNode>(value:T,kind:string,context:number):T{
   const id=++serial;ids.set(value,id);probe.nodes.push({id,kind,context});
   const connect=value.connect;
   Object.defineProperty(value,'connect',{configurable:true,value:function(this:AudioNode,destination:AudioNode|AudioParam,...indices:number[]){
    const target=destination instanceof AudioNode?ids.get(destination):undefined;
    const result:unknown=Reflect.apply(connect,this,[destination,...indices]);
    if(target!==undefined)probe.edges.push({from:id,to:target,at:performance.now()});return result;
   }});
   return value;
  }
  class ObservedAudioContext extends NativeContext {
   private masterSeen=false;
   private readonly probeId:number;
   constructor(options?:AudioContextOptions){
    probe.constructors++;if(probe.faults.deny)throw new DOMException('Declared release-test AudioContext constructor refusal','NotSupportedError');
    const superBeginAt=performance.now();super(options);const superReturnAt=performance.now();probe.contexts.push(this);this.probeId=probe.contexts.length;
    probe.constructions.push({context:this.probeId,superBeginAt,superReturnAt,state:this.state,currentTime:this.currentTime});if(probe.constructions.length>128)probe.constructions.shift();
    node(this.destination,'destination',this.probeId);
    this.addEventListener('statechange',()=>probe.states.push({at:performance.now(),context:this.probeId,state:this.state}));
    if(probe.faults.defer&&!probe.deferred||probe.faults.rejectResume)void this.suspend();
   }
   override createGain(){
    const master=!this.masterSeen;this.masterSeen=true;
    const gain=node(super.createGain(),master?'master':'envelope',this.probeId);
    if(master){masters.set(this,gain);observeMaster(this,this.probeId,gain);const analyser=node(super.createAnalyser(),'post-master-analyser',this.probeId);analyser.fftSize=256;gain.connect(analyser);probe.analysers.push(analyser);analyserOwners.set(analyser,{context:this,id:this.probeId,master:gain});}
    return gain;
   }
   override createOscillator(){
    const source=node(super.createOscillator(),'oscillator',this.probeId),start=source.start.bind(source),stop=source.stop.bind(source),disconnect=source.disconnect.bind(source);
    const schedule=source.frequency.setValueAtTime.bind(source.frequency);
    const record:SourceRecord={id:ids.get(source)!,at:0,when:0,frequency:source.frequency.value,type:source.type,stopAt:null,ended:false,disconnected:false,context:this.probeId,resetSerial:capture.resetSerial,currentTime:this.currentTime,masterGainValue:null,path:{oscillator:ids.get(source)!,envelope:null,master:null,analyser:null,destination:null}};
    source.frequency.setValueAtTime=(frequency,when)=>{probe.frequencies.push(frequency);record.frequency=frequency;return schedule(frequency,when);};
    source.start=(when=0)=>{start(when);record.at=performance.now();record.when=when;record.type=source.type;record.resetSerial=capture.resetSerial;record.currentTime=this.currentTime;const master=masters.get(this);record.masterGainValue=master?.gain.value??null;record.path=sourcePath(source,master);probe.sources.push(record);probe.starts++;probe.active.add(source);probe.maxActive=Math.max(probe.maxActive,probe.active.size);};
    source.stop=(when=0)=>{stop(when);record.stopAt=when;probe.stops++;if(when<=this.currentTime+.001)probe.active.delete(source);};
    Object.defineProperty(source,'disconnect',{configurable:true,value:()=>{record.disconnected=true;return disconnect();}});
    source.addEventListener('ended',()=>{record.ended=true;probe.active.delete(source);},{once:true});return source;
   }
   override resume():Promise<void>{
    probe.resumeCalls++;const id=++operationSerial;operation(this,this.probeId,id,null,'resume','resume-call','request');
    if(probe.faults.rejectResume){operation(this,this.probeId,id,null,'resume','resume-call','fault-rejected');return Promise.reject(new DOMException('Declared release-test native resume rejection','NotAllowedError'));}
    if(probe.faults.defer&&!probe.deferred){
     probe.deferred=true;operation(this,this.probeId,id,null,'resume','resume-call','held');
     // Invoke native resume in this gesture; only its delivery to the caller is held.
     const native=observeNative(this,this.probeId,id,null,'resume','resume-call',()=>super.resume());
     let releaseGate:()=>void=()=>{};
     const gate=new Promise<void>(resolve=>{releaseGate=resolve;});
     const held=native.then(()=>gate,error=>gate.then(()=>{throw error;}));
     // Observe a possible native rejection immediately, without changing the returned rejection.
     void held.catch(()=>{});
     let releaseTicket:number|null=null;
     probe.releaseResume=()=>{
      if(releaseTicket===null){
       const releaseId=++operationSerial;releaseTicket=releaseId;
       operation(this,this.probeId,releaseId,id,'resume','held-release','request');
       void held.then(()=>operation(this,this.probeId,releaseId,id,'resume','held-release','settled'),error=>operation(this,this.probeId,releaseId,id,'resume','held-release','rejected',error));
       releaseGate();
      }
      return held;
     };
     return held;
    }
    return observeNative(this,this.probeId,id,null,'resume','resume-call',()=>super.resume());
   }
   override suspend(){probe.suspendCalls++;const id=++operationSerial;operation(this,this.probeId,id,null,'suspend','suspend-call','request');return observeNative(this,this.probeId,id,null,'suspend','suspend-call',()=>super.suspend());}
   override close(){probe.closeCalls++;const id=++operationSerial;operation(this,this.probeId,id,null,'close','close-call','request');return observeNative(this,this.probeId,id,null,'close','close-call',()=>super.close());}
  }
  window.AudioContext=ObservedAudioContext;
  const observer=new MutationObserver(records=>{
   for(const record of records)if(record.target instanceof HTMLElement&&record.target.id==='v4-scene'&&record.attributeName==='data-outcome'){
    const outcome=record.target.dataset.outcome;if(outcome)capture.contacts.push({at:performance.now(),outcome});
   }
   if(capture.contacts.length>128)capture.contacts.splice(0,capture.contacts.length-128);
  });
  const observe=()=>observer.observe(document,{subtree:true,attributes:true,attributeFilter:['data-outcome']});
  observe();
  for(const type of ['pointerdown','keydown','keyup'])window.addEventListener(type,event=>{
   if(event.isTrusted){
    const target=event.composedPath().find(value=>value instanceof HTMLElement),element=target instanceof HTMLElement?target:null;
    probe.trustedInputs.push({at:performance.now(),type,targetId:element?.id??'',label:(element?.textContent??'').replace(/\s+/g,' ').trim().slice(0,120),key:event instanceof KeyboardEvent?event.key:null,code:event instanceof KeyboardEvent?event.code:null,button:event instanceof MouseEvent?event.button:null,...authority()});if(probe.trustedInputs.length>256)probe.trustedInputs.shift();
   }
   if(!event.composedPath().some(target=>target instanceof HTMLElement&&['v4-hit','v4-strike'].includes(target.id)))return;
   capture.inputs.push({at:performance.now(),type,trusted:event.isTrusted,...authority()});if(capture.inputs.length>128)capture.inputs.shift();
  },true);
  window.addEventListener('click',event=>{
   if(!event.isTrusted)return;const button=event.composedPath().find(target=>target instanceof HTMLButtonElement);if(!(button instanceof HTMLButtonElement))return;
   probe.buttonClicks.push({sequence:++clickSequence,at:performance.now(),id:button.id,label:(button.textContent??'').replace(/\s+/g,' ').trim().slice(0,200),trusted:true,starts:probe.starts,activeSourceIds:[...probe.active].map(source=>ids.get(source)!),...authority()});
   if(probe.buttonClicks.length>256)probe.buttonClicks.shift();
  },true);
  for(const type of ['blur','focus','pagehide','pageshow'])window.addEventListener(type,event=>{probe.lifecycle.push({at:performance.now(),type,trusted:event.isTrusted,hidden:document.hidden});});
  document.addEventListener('visibilitychange',event=>{probe.lifecycle.push({at:performance.now(),type:event.type,trusted:event.isTrusted,hidden:document.hidden});});
  const sample=()=>{
   const at=performance.now(),gap=capture.lastSampleAt===null?null:at-capture.lastSampleAt;capture.lastSampleAt=at;if(gap!==null)capture.maxSampleGapMs=Math.max(capture.maxSampleGapMs,gap);
   for(const analyser of probe.analysers){
    const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);let peak=0;for(const value of data){const amplitude=Math.abs(value);capture.peak=Math.max(capture.peak,amplitude);peak=Math.max(peak,amplitude);}
    const owner=analyserOwners.get(analyser);if(!owner)continue;
    const observation:WaveformWindow={resetSerial:capture.resetSerial,at,gapMs:gap,context:owner.id,currentTime:owner.context.currentTime,state:owner.context.state,peak,activeSourceIds:[...probe.active].filter(source=>source.context===owner.context).map(source=>ids.get(source)!),masterGainValue:owner.master.gain.value,analyser:ids.get(analyser)!,fftSize:analyser.fftSize,windowDurationMs:analyser.fftSize/owner.context.sampleRate*1000};
    capture.windows.push(observation);if(capture.windows.length>512)capture.windows.shift();if(capture.peakWindow===null||peak>capture.peakWindow.peak)capture.peakWindow=observation;
   }
   capture.samples++;
  };
  let timer:ReturnType<typeof setInterval>|null=setInterval(sample,8);
  window.addEventListener('pagehide',()=>{if(timer!==null)clearInterval(timer);timer=null;observer.disconnect();});
  window.addEventListener('pageshow',()=>{if(timer===null){observe();timer=setInterval(sample,8);}});
}

/** Native nodes/output remain intact. Only the named constructor/resume faults alter platform behavior. */
export async function installReleaseAudioProbe(page:Page,options:AudioFaults={}){await page.addInitScript(initializeReleaseAudioProbe,options);}
export function releaseAudioProbeSource(options:AudioFaults={}){return `(${initializeReleaseAudioProbe.toString()})(${JSON.stringify(options)});`;}
export function readReleaseAudioSnapshot(){
  const p=window.v5ReleaseAudio;
  return{constructors:p.constructors,contexts:p.contexts.length,states:p.contexts.map(context=>context.state),contextClocks:p.readClocks(),constructions:p.constructions,starts:p.starts,stops:p.stops,active:p.active.size,maxActive:p.maxActive,resumeCalls:p.resumeCalls,suspendCalls:p.suspendCalls,closeCalls:p.closeCalls,frequencies:p.frequencies,nodes:p.nodes,edges:p.edges,sources:p.sources,statesObserved:p.states,lifecycle:p.lifecycle,inputAuthority:p.readAuthority(),trustedInputs:p.trustedInputs,buttonClicks:p.buttonClicks,operations:p.operations,masterGainCalls:p.masterGainCalls,captureResetSerial:p.capture.resetSerial,captureResetAt:p.capture.resetAt,captureResets:p.capture.resets,waveformWindows:p.capture.windows,peakWindow:p.capture.peakWindow,maxSampleGapMs:p.capture.maxSampleGapMs,capturedPeak:p.capture.peak,sampledWindows:p.capture.samples,contacts:p.capture.contacts,inputs:p.capture.inputs,deferred:p.deferred,hasDeferredResume:typeof p.releaseResume==='function',faults:p.faults};
}
export async function releaseAudioSnapshot(page:Page){return page.evaluate(readReleaseAudioSnapshot);}
export type ReleaseAudioSnapshot=Awaited<ReturnType<typeof releaseAudioSnapshot>>;
export async function resetReleaseAudioCapture(page:Page){await page.evaluate(()=>window.v5ReleaseAudio.resetCapture());}
export async function setReleaseAudioFaults(page:Page,faults:AudioFaults){await page.evaluate(next=>{Object.assign(window.v5ReleaseAudio.faults,next);},faults);}
export async function releaseDeferredAudio(page:Page){await page.evaluate(()=>{const release=window.v5ReleaseAudio.releaseResume;if(!release)throw Error('Expected explicitly held first native resume');void release().catch(()=>{});});}

/** One finite public-command witness earns Ember and the day-eight Wide Mouth; never a seed search. */
export function maximumBurstFixture(v5Sdk:typeof import('../../src/v5-sdk.js')){
 const made=v5Sdk.createRun({runId:'v5-release-max-four',seed:'v5-economy-0'});if(!made.ok)throw Error(made.error);let state=made.state;
 const send=(action:Action)=>{if(state.journal.length>=400)throw Error('Finite maximum-burst witness exceeded 400 legal commands');const result=v5Sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`Maximum-burst witness ${state.day}/${action.type}: ${result.error}`);state=result.state;return result;};
 const active=()=>state.blades.filter(blade=>blade.status==='active'&&blade.id!==state.reserveId);
 send({type:'continue'});
 for(let day=1;day<=8;day++){
  for(const original of active()){
   if(v5Sdk.commissionProgress(state).complete)break;
   for(let n=0;n<36;n++){
    const blade=state.blades.find(item=>item.id===original.id)!;
    if(blade.status!=='active'||v5Sdk.atCap(blade))break;
    if(v5Sdk.assessBlade(state,blade).qualifies){send({type:'deliver',pieceId:blade.id});break;}
    const routes=v5Sdk.commissionFor(state).routes;
    if(routes.every(route=>route.crack==='intact'&&blade.cracked||route.maxHits!==undefined&&blade.hits>=route.maxHits||route.age==='old'&&blade.suppliedDay>=state.day))break;
    send({type:'strike',pieceId:blade.id});
   }
  }
  if(state.gift==='available')send({type:'claimGift',traitId:'ember'});
  // Ember is the actual first gift. The day-three merchant can legally add Steady to preserve later materials.
  if(day===3&&!state.traits.includes('steady')&&state.shop.includes('steady'))for(const original of active()){
   for(let n=0;n<36;n++){
    const blade=state.blades.find(item=>item.id===original.id)!;if(blade.status!=='active'||v5Sdk.atCap(blade))break;
    if(v5Sdk.barterAssessment(state,blade).allowed){send({type:'buy',pieceId:blade.id,traitId:'steady'});break;}
    send({type:'strike',pieceId:blade.id});
   }
   if(state.traits.includes('steady'))break;
  }
  if(v5Sdk.getRunView(state).merchant?.canUpgrade)send({type:'upgrade'});
  if(v5Sdk.getRunView(state).merchant?.canRepair)send({type:'repair'});
  send({type:'settle'});if(state.phase==='defeat')throw Error('Finite legal maximum-burst witness lost before day eight; retain gap rather than inject seals');
  if(state.phase==='chapter')send({type:'chooseModification',modification:day===8?'wideMouth':'warmRack'});
  send({type:'advance'});
 }
 if(!state.traits.includes('ember')||!state.modifications.includes('wideMouth'))throw Error('Maximum-burst witness did not actually earn both Ember and Wide Mouth');
 for(const original of active())for(let n=0;n<36;n++){
  const blade=state.blades.find(item=>item.id===original.id)!;if(blade.status!=='active'||v5Sdk.atCap(blade))break;
  const action={type:'strike',pieceId:blade.id} as const;
  if(blade.charge===6){const before=state,result=send(action),strike=result.events.find(event=>event.type==='Strike');if(strike?.type!=='Strike'||!strike.burst||strike.hits.length!==4)throw Error('Earned maximum-burst command was not four real safe hits');const checked=v5Sdk.validateRun(before);if(!checked.ok)throw Error(checked.detail);return{before:checked.state,action,after:result.state,strike,events:result.events,witnessPrefix:before.journal.length};}
  send(action);
 }
 throw Error('No surviving maximum-burst sword in this one finite legal witness');
}
