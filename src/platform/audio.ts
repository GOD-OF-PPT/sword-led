import type { DomainEvent } from '../core/index.js';
import type { Preferences } from './settings.js';

export type Cue = 'light' | 'standard' | 'heavy' | 'damage' | 'broken' | 'heat' | 'delivery' | 'recycle' | 'purchase' | 'met' | 'missed' | 'victory' | 'defeat';
export type AudioMode = 'silent' | 'game' | 'preview';
export type AudioStatus = 'waiting' | 'ready' | 'muted' | 'blocked' | 'unavailable';
export function cueFor(events: readonly DomainEvent[]): Cue | null {
  const ending = events.find(event => event.type === 'RunEnded');
  if (ending?.type === 'RunEnded') return ending.outcome;
  const settled = events.find(event => event.type === 'RoundSettled');
  if (settled?.type === 'RoundSettled') return settled.summary.metQuota ? 'met' : 'missed';
  const strike = events.find(event => event.type === 'StrikeResolved');
  if (strike?.type === 'StrikeResolved') return strike.outcome === 'success' ? strike.mode : strike.outcome;
  if (events.some(event => event.type === 'PurchaseMade')) return 'purchase';
  if (events.some(event => event.type === 'PieceDelivered')) return 'delivery';
  if (events.some(event => event.type === 'PieceRecycled')) return 'recycle';
  return events.some(event => event.type === 'Heated') ? 'heat' : null;
}
export interface ForgeSound {readonly tones:readonly number[];readonly duration:number;readonly type?:OscillatorType;readonly fall?:number}
const SOUNDS: Record<Cue, ForgeSound> = {
  light: { tones: [1117,1733,2411], duration: .16 }, standard: { tones: [719,1193,1777], duration: .22 }, heavy: { tones: [431,731,1153], duration: .3 },
  damage: { tones: [183,271], duration: .2, type: 'triangle' }, broken: { tones: [677,359,193], duration: .38, fall: .3 },
  heat: { tones: [73,109], duration: .28, type: 'triangle' }, delivery: { tones: [523,784], duration: .32 },
  recycle: { tones: [311,467], duration: .18 }, purchase: { tones: [659,988], duration: .3 },
  met: { tones: [523,659,784], duration: .4 }, missed: { tones: [220,261], duration: .35, type: 'triangle' },
  victory: { tones: [523,659,784], duration: .65 }, defeat: { tones: [196,233,294], duration: .6, type: 'triangle', fall: .65 },
};

export function createForgeAudio(createContext: () => AudioContext = () => new AudioContext({ latencyHint: 'interactive' }),palette:Readonly<Partial<Record<Cue,ForgeSound>>> = {}) {
  interface Activation {context:AudioContext;epoch:number;serial:number}
  interface PendingActivation extends Activation {promise:Promise<boolean>}
  let context: AudioContext | null = null, master: GainNode | null = null, pending: PendingActivation | null = null;
  let activationSerial=0,latest:Activation|null=null,suspending:{context:AudioContext;promise:Promise<void>}|null=null;
  let mode: AudioMode = 'silent', muted = false, volume = 55, epoch = 0, disposed = false;
  let identity = '';
  let failure: 'blocked' | 'unavailable' | null = null;
  interface PendingCue {cue:Cue;context:AudioContext;epoch:number;mode:'game'}
  const waitingCues=new Set<PendingCue>();
  const voices = new Set<{ stop(): void }>(), listeners = new Set<(status: AudioStatus) => void>();
  const enabled = () => !disposed && !muted && volume > 0;
  const status = (): AudioStatus => !enabled() ? 'muted' : failure ?? (context?.state === 'running' && mode !== 'silent' ? 'ready' : 'waiting');
  const publish = () => { if (!disposed) for (const listener of listeners) listener(status()); };
  const stop = () => { waitingCues.clear();for (const voice of [...voices]) voice.stop(); };
  const suspendContext = (own:AudioContext) => {
    if(own.state==='closed')return;
    const operation=own.suspend().catch(()=>{}),ticket={context:own,promise:operation};
    if(own===context)suspending=ticket;
    void operation.finally(()=>{if(suspending===ticket)suspending=null;});
  };
  const suspend = () => { stop();if(context)suspendContext(context); };
  const gain = () => {
    if (!context || !master) return;
    const now = context.currentTime;master.gain.cancelScheduledValues(now);
    if (!enabled()) master.gain.setValueAtTime(0, now);
    else master.gain.setTargetAtTime(.6 * (volume / 100) ** 2, now, .01);
  };
  const onState = () => { if ((!enabled() || mode === 'silent') && context?.state === 'running') suspend();publish(); };
  function gesture(): Promise<boolean> {
    if (!enabled() || mode === 'silent') return Promise.resolve(false);
    if (pending?.context===context && pending.epoch===epoch) return pending.promise;
    try {
      if (!context || context.state === 'closed') {
        context?.removeEventListener('statechange', onState);master?.disconnect();context = null;master = null;
        const created = createContext();
        try {
          const createdMaster = created.createGain();createdMaster.gain.value = 0;createdMaster.connect(created.destination);
          context = created;master = createdMaster;context.addEventListener('statechange', onState);gain();
        } catch { void created.close().catch(() => {});throw new Error('Audio output unavailable'); }
      }
      const own=context,activation:Activation={context:own,epoch,serial:++activationSerial};latest=activation;
      // A native suspend can still be queued while state reports running. A fresh
      // activation must queue resume after it instead of optimistically succeeding.
      if (own.state==='running' && suspending?.context!==own && pending?.context!==own) {
        failure=null;publish();return Promise.resolve(true);
      }
      let attempt:PendingActivation;
      const promise=own.resume().then(()=>{
        if(disposed||activation.epoch!==epoch||!enabled()||mode==='silent'||context!==own||latest!==activation){
          const newer=latest?.context===own&&latest.epoch===epoch&&latest.serial>activation.serial&&enabled()&&mode!=='silent'&&context===own;
          if(!newer)suspendContext(own);
          return false;
        }
        failure=own.state==='running'?null:'blocked';publish();return own.state==='running';
      }).catch(()=>{if(!disposed&&activation.epoch===epoch&&latest===activation){failure='blocked';publish();}return false;})
        .finally(()=>{if(pending===attempt)pending=null;});
      attempt={...activation,promise};pending=attempt;return promise;
    } catch { failure = context ? 'blocked' : 'unavailable';publish();return Promise.resolve(false); }
  }
  function play(cue: Cue) {
    if (!enabled() || mode === 'silent' || !context || !master || context.state !== 'running') return;
    while (voices.size >= 4) voices.values().next().value?.stop();
    const sound = palette[cue]??SOUNDS[cue], sources: OscillatorNode[] = [], gains: GainNode[] = [];
    let ended = 0, cleaned = false;
    const cleanup = () => {
      if (cleaned) return;cleaned = true;
      for (const source of sources) { source.onended = null;source.disconnect(); }
      for (const envelope of gains) envelope.disconnect();voices.delete(voice);
    };
    const voice = { stop() { for (const source of sources) { try { source.stop(); } catch { /* Already ended or failed to start. */ } }cleanup(); } };
    voices.add(voice);
    try {
      const now = context.currentTime;
      for (const frequency of sound.tones) {
        const source = context.createOscillator(), envelope = context.createGain();sources.push(source);gains.push(envelope);
        source.type = sound.type ?? 'sine';source.frequency.setValueAtTime(frequency, now);
        if (sound.fall) source.frequency.exponentialRampToValueAtTime(frequency * sound.fall, now + sound.duration);
        envelope.gain.setValueAtTime(0, now);envelope.gain.linearRampToValueAtTime(.22 / sound.tones.length, now + .003);
        envelope.gain.exponentialRampToValueAtTime(.0001, now + sound.duration);
        source.connect(envelope);envelope.connect(master);source.onended = () => { if (++ended === sources.length) cleanup(); };
        source.start(now);source.stop(now + sound.duration + .01);
      }
    } catch { voice.stop();failure = 'blocked';publish(); }
  }
  function acceptedCue(cue:Cue){
    if(!enabled()||mode!=='game'||!context||!master)return;
    const activation=pending;
    if(!activation||activation.context!==context||activation.epoch!==epoch){if(context.state==='running')play(cue);return;}
    const request:PendingCue={cue,context,epoch,mode};
    while(waitingCues.size>=4){const oldest=waitingCues.values().next().value;if(oldest)waitingCues.delete(oldest);}
    waitingCues.add(request);
    void activation.promise.then(ready=>{
      if(!waitingCues.delete(request)||!ready||!enabled()||mode!==request.mode||epoch!==request.epoch||context!==request.context)return;
      play(request.cue);
    }).catch(()=>{waitingCues.delete(request);});
  }
  return {
    getStatus: status,
    identify(next: string) { if (identity !== next && !disposed) { identity = next;epoch++;stop(); } },
    subscribe(listener: (status: AudioStatus) => void) { listeners.add(listener);listener(status());return () => { listeners.delete(listener); }; },
    configure(value: Pick<Preferences, 'muted' | 'volume'>) {
      muted = value.muted;volume = Number.isFinite(value.volume) ? Math.min(100, Math.max(0, value.volume)) : 0;const cancelling = muted || volume === 0;
      if (cancelling) { epoch++;suspend(); }gain();publish();
    },
    setMode(next: AudioMode) { if (mode === next || disposed) return;epoch++;stop();mode = next;if (mode === 'silent') suspend();publish(); },
    gesture,
    silence() { epoch++;stop(); },
    accepted(events: readonly DomainEvent[]) { if (mode !== 'game') return;const cue = cueFor(events);if (cue) acceptedCue(cue); },
    acceptedCue,
    async preview() { const token = epoch;if (mode === 'preview' && await gesture() && token === epoch) play('standard'); },
    async dispose() {
      if (disposed) return;disposed = true;epoch++;mode = 'silent';stop();listeners.clear();
      if (context) { context.removeEventListener('statechange', onState);master?.disconnect();try { await context.close(); } catch { /* Closing must not delay releasing the game lease. */ } }
      context = null;master = null;
    },
  };
}
