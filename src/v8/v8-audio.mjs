// V9.0 Multi-Track Chinese Pentatonic BGM Sequencer & 20-Cue Physical Action SFX Engine (100% Web Audio API)

export const BGM_TRACKS = [
  { id: 'ch1', title: '山夜引灯', subtitle: '羽调 · 古筝夜溪（河谷篇）' },
  { id: 'forge', title: '千锤百炼', subtitle: '徵调 · 炉火羯鼓（铸剑篇）' },
  { id: 'ch2', title: '风雪孤驿', subtitle: '商调 · 洞箫寒山（雪线篇）' },
  { id: 'ch3', title: '绝顶护炉', subtitle: '宫调 · 战鼓编钟（山口篇）' },
  { id: 'ending', title: '万家灯明', subtitle: '合奏 · 流水钟磬（终章篇）' },
];

export function createV8Audio() {
  let ctx = null;
  let master = null;
  let bgmGain = null;
  let sfxGain = null;
  let ambGain = null;
  let ambNode = null;
  let ambFilter = null;
  let ambLfo = null;

  let muted = false;
  let bgmVol = 0.58;
  let sfxVol = 0.85;
  let currentMood = 'ch1';
  let manualTrack = null;
  let bgmTimer = null;
  let stepIdx = 0;
  let lastHoverAt = 0;

  const SCORES = {
    ch1: {
      stepMs: 280,
      lead: [440, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25, 440, 392, 329.63, 0, 293.66, 329.63, 440, 0],
      arp: [220, 329.63, 440, 329.63, 261.63, 392, 523.25, 392, 293.66, 440, 587.33, 440, 220, 329.63, 392, 329.63],
      bass: [110, 0, 0, 0, 130.81, 0, 0, 0, 146.83, 0, 0, 0, 110, 0, 164.81, 0],
      perc: [1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 2, 0],
      leadInstrument: 'guzheng',
      ambFreq: 420,
      ambLevel: 0.025,
    },
    forge: {
      stepMs: 225,
      lead: [392, 440, 523.25, 0, 587.33, 523.25, 440, 392, 293.66, 392, 440, 523.25, 587.33, 0, 392, 0],
      arp: [196, 293.66, 392, 293.66, 261.63, 392, 523.25, 392, 293.66, 440, 293.66, 220, 196, 293.66, 392, 293.66],
      bass: [98, 0, 98, 0, 130.81, 0, 130.81, 0, 146.83, 0, 110, 0, 98, 0, 146.83, 0],
      perc: [1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 2, 3, 0, 2, 0],
      leadInstrument: 'pipa',
      ambFreq: 680,
      ambLevel: 0.032,
    },
    ch2: {
      stepMs: 320,
      lead: [440, 0, 0, 523.25, 587.33, 0, 523.25, 440, 392, 0, 349.23, 392, 293.66, 0, 0, 0],
      arp: [146.83, 220, 293.66, 349.23, 174.61, 261.63, 349.23, 261.63, 196, 293.66, 392, 293.66, 146.83, 220, 293.66, 220],
      bass: [73.42, 0, 0, 0, 87.31, 0, 0, 0, 98.0, 0, 0, 0, 73.42, 0, 0, 0],
      perc: [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
      leadInstrument: 'xiao',
      ambFreq: 920,
      ambLevel: 0.048,
    },
    ch3: {
      stepMs: 215,
      lead: [523.25, 0, 587.33, 659.25, 783.99, 0, 659.25, 587.33, 523.25, 440, 392, 523.25, 587.33, 0, 523.25, 0],
      arp: [261.63, 392, 523.25, 392, 293.66, 440, 587.33, 440, 329.63, 493.88, 659.25, 493.88, 261.63, 392, 523.25, 392],
      bass: [65.41, 0, 65.41, 65.41, 73.42, 0, 73.42, 0, 82.41, 0, 82.41, 82.41, 98.0, 0, 65.41, 0],
      perc: [1, 0, 1, 2, 3, 0, 2, 0, 1, 0, 1, 2, 3, 0, 1, 2],
      leadInstrument: 'bell_lead',
      ambFreq: 540,
      ambLevel: 0.036,
    },
    ending: {
      stepMs: 260,
      lead: [523.25, 659.25, 783.99, 880, 783.99, 659.25, 523.25, 659.25, 587.33, 523.25, 440, 523.25, 392, 523.25, 659.25, 0],
      arp: [261.63, 329.63, 392, 523.25, 659.25, 523.25, 392, 329.63, 220, 261.63, 329.63, 440, 523.25, 440, 392, 329.63],
      bass: [130.81, 0, 0, 0, 196.0, 0, 0, 0, 110.0, 0, 0, 0, 130.81, 0, 196.0, 0],
      perc: [3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0],
      leadInstrument: 'guzheng',
      ambFreq: 360,
      ambLevel: 0.016,
    },
  };

  function activeMood() {
    return manualTrack || currentMood || 'ch1';
  }

  function ensureContext() {
    if (muted) return false;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        bgmGain = ctx.createGain();
        sfxGain = ctx.createGain();
        ambGain = ctx.createGain();

        master.gain.value = 0.92;
        bgmGain.gain.value = bgmVol * 0.52;
        sfxGain.gain.value = sfxVol * 0.92;
        ambGain.gain.value = 0.02;

        bgmGain.connect(master);
        sfxGain.connect(master);
        ambGain.connect(bgmGain);
        master.connect(ctx.destination);

        startAmbienceBed();
        restartSequencer();
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx.state === 'running' || ctx.state === 'suspended';
    } catch (_e) {
      return false;
    }
  }

  function startAmbienceBed() {
    if (!ctx || ambNode) return;
    try {
      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.04 * white) / 1.04;
        ch[i] = last * 2.2;
      }
      ambNode = ctx.createBufferSource();
      ambNode.buffer = buf;
      ambNode.loop = true;

      ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'bandpass';
      ambFilter.frequency.value = 480;
      ambFilter.Q.value = 1.6;

      ambLfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      ambLfo.frequency.value = 0.22;
      lfoGain.gain.value = 180;
      ambLfo.connect(lfoGain);
      lfoGain.connect(ambFilter.frequency);

      ambNode.connect(ambFilter);
      ambFilter.connect(ambGain);
      ambNode.start();
      ambLfo.start();
    } catch (_e) {
      // Ignore
    }
  }

  function updateAmbienceProfile() {
    if (!ctx || !ambFilter || !ambGain) return;
    const sc = SCORES[activeMood()] || SCORES.ch1;
    const now = ctx.currentTime;
    ambFilter.frequency.setTargetAtTime(sc.ambFreq, now, 0.4);
    ambGain.gain.setTargetAtTime(muted ? 0 : sc.ambLevel, now, 0.4);
  }

  function synthPluck(freq, dur, vol, bright = 4.5, dest = bgmGain) {
    if (!ctx || muted || !dest || freq <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq * 1.003, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.035);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now);

      const g2 = ctx.createGain();
      g2.gain.value = 0.28;

      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(Math.min(7000, freq * bright), now);
      flt.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.15), now + dur);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc1.connect(flt);
      osc2.connect(g2);
      g2.connect(flt);
      flt.connect(g);
      g.connect(dest);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur + 0.03);
      osc2.stop(now + dur + 0.03);
    } catch (_e) {
      // Ignore
    }
  }

  function synthXiao(freq, dur, vol, dest = bgmGain) {
    if (!ctx || muted || !dest || freq <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.985, now);
      osc.frequency.linearRampToValueAtTime(freq, now + 0.08);

      vib.type = 'sine';
      vib.frequency.value = 5.2;
      vibGain.gain.setValueAtTime(0, now);
      vibGain.gain.linearRampToValueAtTime(freq * 0.014, now + 0.22);
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      flt.type = 'lowpass';
      flt.frequency.value = freq * 2.6;

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.09);
      g.gain.setValueAtTime(vol * 0.85, now + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(flt);
      flt.connect(g);
      g.connect(dest);

      osc.start(now);
      vib.start(now);
      osc.stop(now + dur + 0.04);
      vib.stop(now + dur + 0.04);
    } catch (_e) {
      // Ignore
    }
  }

  function synthBell(freq, dur, vol, dest = bgmGain) {
    if (!ctx || muted || !dest || freq <= 0) return;
    try {
      const now = ctx.currentTime;
      [1, 2.0, 2.98].forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq * ratio, now);
        const amp = vol / (idx * 1.4 + 1);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(amp, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur / (idx * 0.6 + 1));
        osc.connect(g);
        g.connect(dest);
        osc.start(now);
        osc.stop(now + dur + 0.03);
      });
    } catch (_e) {
      // Ignore
    }
  }

  function synthPerc(kind, dest = bgmGain) {
    if (!ctx || muted || !dest || !kind) return;
    try {
      const now = ctx.currentTime;
      if (kind === 1) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(118, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
        g.gain.setValueAtTime(0.24, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.connect(g);
        g.connect(dest);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (kind === 2) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(760, now);
        osc.frequency.exponentialRampToValueAtTime(340, now + 0.055);
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g);
        g.connect(dest);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (kind === 3) {
        synthBell(1046.5, 0.75, 0.12, dest);
      }
    } catch (_e) {
      // Ignore
    }
  }

  function playNoiseBurst(dur, filterFreq, gainVal, filterType = 'bandpass', qVal = 1.8) {
    if (!ctx || muted || !sfxGain) return;
    try {
      const now = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.3);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = filterType;
      flt.frequency.setValueAtTime(filterFreq, now);
      flt.Q.value = qVal;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainVal, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(flt);
      flt.connect(g);
      g.connect(sfxGain);
      src.start(now);
    } catch (_e) {
      // Ignore
    }
  }

  function tickSequencer() {
    if (muted || !ctx || ctx.state !== 'running') return;
    const mood = activeMood();
    const score = SCORES[mood] || SCORES.ch1;
    const i = stepIdx % 16;

    const leadFreq = score.lead[i] || 0;
    const arpFreq = score.arp[i] || 0;
    const bassFreq = score.bass[i] || 0;
    const percKind = score.perc[i] || 0;

    if (leadFreq > 0) {
      if (score.leadInstrument === 'xiao') synthXiao(leadFreq, 0.85, 0.22, bgmGain);
      else if (score.leadInstrument === 'bell_lead') synthBell(leadFreq, 0.65, 0.2, bgmGain);
      else if (score.leadInstrument === 'pipa') synthPluck(leadFreq, 0.42, 0.21, 5.5, bgmGain);
      else synthPluck(leadFreq, 0.72, 0.22, 4.2, bgmGain);
    }
    if (arpFreq > 0) synthPluck(arpFreq, 0.36, 0.1, 3.0, bgmGain);
    if (bassFreq > 0) synthPluck(bassFreq, 0.82, 0.18, 2.1, bgmGain);
    if (percKind > 0) synthPerc(percKind, bgmGain);
    stepIdx++;
  }

  function restartSequencer() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (muted) return;
    const score = SCORES[activeMood()] || SCORES.ch1;
    updateAmbienceProfile();
    bgmTimer = setInterval(tickSequencer, score.stepMs);
  }

  function setMood(mood) {
    const target = SCORES[mood] ? mood : 'ch1';
    if (currentMood === target && bgmTimer) return;
    currentMood = target;
    if (!manualTrack && ctx) restartSequencer();
  }

  function setManualTrack(trackId) {
    manualTrack = trackId === 'auto' ? null : trackId;
    ensureContext();
    stepIdx = 0;
    restartSequencer();
  }

  function unlock() {
    const ok = ensureContext();
    if (ok && !bgmTimer && !muted) restartSequencer();
  }

  function sfx(kind) {
    if (!ensureContext() || !ctx || muted || sfxVol <= 0.01) return;
    const now = ctx.currentTime;
    switch (kind) {
      case 'hover': {
        if (now - lastHoverAt < 0.06) return;
        lastHoverAt = now;
        synthPluck(987.77, 0.045, 0.04, 2.5, sfxGain);
        break;
      }
      case 'click': {
        synthPluck(659.25, 0.11, 0.14, 3.2, sfxGain);
        synthPluck(987.77, 0.09, 0.1, 3.0, sfxGain);
        break;
      }
      case 'scroll': {
        playNoiseBurst(0.14, 1500, 0.12, 'bandpass', 1.2);
        synthPluck(523.25, 0.18, 0.12, 2.8, sfxGain);
        break;
      }
      case 'bellows': {
        playNoiseBurst(0.38, 420, 0.24, 'lowpass', 1.0);
        synthPluck(220, 0.35, 0.16, 2.5, sfxGain);
        break;
      }
      case 'hammer_perfect': {
        synthBell(880, 0.65, 0.36, sfxGain);
        synthBell(1760, 0.55, 0.28, sfxGain);
        playNoiseBurst(0.1, 3600, 0.24, 'highpass', 1.5);
        [1174.66, 1318.51, 1760, 2349.32].forEach((f, idx) => {
          setTimeout(() => synthPluck(f, 0.32, 0.14, 4.5, sfxGain), 45 + idx * 36);
        });
        break;
      }
      case 'hammer_good': {
        synthBell(587.33, 0.32, 0.3, sfxGain);
        synthPluck(1174.66, 0.22, 0.2, 4.0, sfxGain);
        playNoiseBurst(0.08, 2200, 0.2, 'bandpass', 1.8);
        break;
      }
      case 'hammer_cold': {
        synthPluck(293.66, 0.2, 0.24, 2.0, sfxGain);
        playNoiseBurst(0.07, 850, 0.16, 'lowpass', 1.2);
        break;
      }
      case 'crack': {
        synthPluck(311.13, 0.36, 0.34, 6.0, sfxGain);
        synthPluck(155.56, 0.45, 0.32, 5.0, sfxGain);
        playNoiseBurst(0.25, 1350, 0.3, 'bandpass', 2.2);
        break;
      }
      case 'quench': {
        playNoiseBurst(0.68, 2800, 0.34, 'bandpass', 1.1);
        setTimeout(() => {
          synthBell(1046.5, 0.85, 0.28, sfxGain);
          synthBell(1567.98, 0.75, 0.22, sfxGain);
        }, 110);
        break;
      }
      case 'slash': {
        playNoiseBurst(0.15, 2200, 0.3, 'bandpass', 1.4);
        synthPluck(440, 0.22, 0.3, 5.5, sfxGain);
        synthPluck(659.25, 0.18, 0.24, 4.5, sfxGain);
        break;
      }
      case 'sword_art': {
        // Signature Sword Art: twin whoosh + harmonic ring!
        playNoiseBurst(0.22, 3100, 0.34, 'bandpass', 1.3);
        synthBell(659.25, 0.55, 0.32, sfxGain);
        setTimeout(() => {
          synthBell(987.77, 0.65, 0.3, sfxGain);
          synthPluck(1318.5, 0.45, 0.24, 5.5, sfxGain);
        }, 70);
        break;
      }
      case 'dual_ult': {
        // Dual-Blade Celestial Cross Ultimate!
        synthPerc(1, sfxGain);
        playNoiseBurst(0.35, 2600, 0.36, 'bandpass', 1.2);
        [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((f, idx) => {
          setTimeout(() => synthBell(f, 0.95, 0.28, sfxGain), idx * 45);
        });
        break;
      }
      case 'parry_perfect': {
        // Razor-sharp Sekiro/Wukong metallic riposte ring!
        playNoiseBurst(0.08, 4800, 0.34, 'highpass', 2.2);
        synthBell(1174.66, 0.85, 0.4, sfxGain);
        synthBell(1760.0, 0.75, 0.32, sfxGain);
        synthPerc(1, sfxGain);
        break;
      }
      case 'stagger': {
        synthBell(196, 0.95, 0.42, sfxGain);
        synthBell(587.33, 0.75, 0.32, sfxGain);
        synthPerc(1, sfxGain);
        playNoiseBurst(0.28, 2900, 0.32, 'highpass', 1.6);
        break;
      }
      case 'guard': {
        synthBell(392, 0.32, 0.28, sfxGain);
        synthBell(587.33, 0.35, 0.22, sfxGain);
        break;
      }
      case 'swap': {
        playNoiseBurst(0.09, 4200, 0.22, 'highpass', 2.0);
        synthBell(880, 0.25, 0.22, sfxGain);
        synthBell(1318.5, 0.28, 0.18, sfxGain);
        break;
      }
      case 'assist':
      case 'relic': {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          setTimeout(() => synthPluck(f, 0.4, 0.22, 4.2, sfxGain), idx * 42);
        });
        break;
      }
      case 'compendium': {
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, idx) => {
          setTimeout(() => synthBell(f, 0.75, 0.24, sfxGain), idx * 60);
        });
        break;
      }
      case 'damage': {
        try {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(195, now);
          osc.frequency.exponentialRampToValueAtTime(64, now + 0.36);
          g.gain.setValueAtTime(0.32, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(now);
          osc.stop(now + 0.4);
        } catch (_e) {
          // Ignore
        }
        break;
      }
      case 'relit': {
        [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, idx) => {
          setTimeout(() => synthBell(f, 1.5, 0.26, sfxGain), idx * 70);
        });
        break;
      }
      default: {
        synthPluck(523.25, 0.14, 0.16, 3.0, sfxGain);
        break;
      }
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.92, ctx.currentTime);
    if (muted && bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    } else if (!muted) {
      ensureContext();
      restartSequencer();
    }
    updateAmbienceProfile();
    return muted;
  }

  function setBgmVolume(v) {
    bgmVol = Math.max(0, Math.min(1, v));
    if (bgmGain && ctx) bgmGain.gain.setTargetAtTime(bgmVol * 0.52, ctx.currentTime, 0.04);
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, v));
    if (sfxGain && ctx) sfxGain.gain.setTargetAtTime(sfxVol * 0.92, ctx.currentTime, 0.04);
  }

  function getTrackTitle() {
    const id = activeMood();
    return BGM_TRACKS.find((t) => t.id === id)?.title || '山夜引灯';
  }

  function dispose() {
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = null;
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
  }

  return {
    unlock,
    setMood,
    setManualTrack,
    getManualTrack: () => manualTrack || 'auto',
    getTrackTitle,
    sfx,
    toggleMute,
    setBgmVolume,
    setSfxVolume,
    getBgmVolume: () => bgmVol,
    getSfxVolume: () => sfxVol,
    isMuted: () => muted,
    dispose,
  };
}
