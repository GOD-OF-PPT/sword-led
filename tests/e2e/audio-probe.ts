import type { Page } from '@playwright/test';

interface Probe {
  contexts: AudioContext[]; analysers: AnalyserNode[]; active: Set<OscillatorNode>;
  constructors: number; starts: number; stops: number; maxActive: number; frequencies: number[];
  deferred: boolean; releaseResume?: () => Promise<void>;
}
declare global { interface Window { audioTestProbe: Probe } }

export async function installAudioProbe(page: Page, options: { deny?: boolean; defer?: boolean; rejectResume?: boolean } = {}) {
  await page.addInitScript(({deny,defer,rejectResume}) => {
    const NativeContext = window.AudioContext;
    const probe: Probe = { contexts: [], analysers: [], active: new Set(), constructors: 0, starts: 0, stops: 0, maxActive: 0, frequencies: [], deferred: false };
    window.audioTestProbe = probe;
    class ObservedAudioContext extends NativeContext {
      private observedMaster = false;
      constructor(options?: AudioContextOptions) {
        probe.constructors++;if (deny) throw new DOMException('Audio unavailable','NotSupportedError');
        super(options);probe.contexts.push(this);if (defer || rejectResume) void this.suspend();
      }
      override createGain() {
        const gain = super.createGain();
        if (!this.observedMaster) { this.observedMaster = true;const analyser = this.createAnalyser();analyser.fftSize = 256;gain.connect(analyser);probe.analysers.push(analyser); }
        return gain;
      }
      override createOscillator() {
        const source = super.createOscillator(), start = source.start.bind(source), stop = source.stop.bind(source);
        const schedule = source.frequency.setValueAtTime.bind(source.frequency);
        source.frequency.setValueAtTime = (frequency,when) => { probe.frequencies.push(frequency);return schedule(frequency,when); };
        source.start = (when = 0) => {
          start(when);probe.starts++;probe.active.add(source);probe.maxActive = Math.max(probe.maxActive,probe.active.size);
          source.addEventListener('ended',()=>probe.active.delete(source),{once:true});
        };
        source.stop = (when = 0) => { stop(when);probe.stops++;if (when <= this.currentTime + .001) probe.active.delete(source); };
        return source;
      }
      override resume(): Promise<void> {
        if (rejectResume) return Promise.reject(new DOMException('Blocked by policy','NotAllowedError'));
        if (defer && !probe.deferred) {
          probe.deferred = true;
          return new Promise<void>((resolve,reject) => { probe.releaseResume = () => { const result=super.resume();result.then(resolve,reject);return result; }; });
        }
        return super.resume();
      }
    }
    window.AudioContext = ObservedAudioContext;
  },options);
}
export async function audioProbe(page: Page) {
  return page.evaluate(() => {
    const probe = window.audioTestProbe;
    let peak = 0;for (const analyser of probe.analysers) { const data = new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);for (const value of data) peak = Math.max(peak,Math.abs(value)); }
    return { contexts: probe.contexts.length, constructors: probe.constructors, states: probe.contexts.map(context=>context.state), active: probe.active.size,
      starts: probe.starts, stops: probe.stops, maxActive: probe.maxActive, frequencies: probe.frequencies, peak };
  });
}
