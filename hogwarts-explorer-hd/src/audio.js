// All sound is synthesised with WebAudio (no audio files, matching the v1 games): a soft
// ambient drone + wind, a gentle footstep tick while walking, a sparkle chime on collecting,
// and an owl hoot. The context is created lazily and resumed on the first user gesture
// (autoplay policy). The 🔊 button mutes everything via a master gain.
export function createAudio() {
  let ctx = null, master = null, ambientOn = false, muted = false, stepCd = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  // One short synthesised note: osc -> envelope -> master.
  function blip(freq, dur, type = 'sine', gain = 0.3, when = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function startAmbient() {
    if (ambientOn || !ensure()) return;
    ambientOn = true;
    // two detuned low pads for a warm, calm bed
    for (const f of [110, 110.5, 164.8]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.05;
      o.connect(g); g.connect(master); o.start();
    }
    // filtered noise = gentle wind
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const ng = ctx.createGain(); ng.gain.value = 0.03;
    noise.connect(lp); lp.connect(ng); ng.connect(master); noise.start();
  }

  return {
    resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); startAmbient(); },
    step(dt) { stepCd -= dt; if (stepCd <= 0) { stepCd = 0.34; blip(70 + Math.random() * 20, 0.09, 'triangle', 0.12); } },
    chime() { blip(880, 0.18, 'sine', 0.28); blip(1320, 0.22, 'sine', 0.2, 0.06); },
    letter() { blip(520, 0.14, 'triangle', 0.22); blip(780, 0.18, 'sine', 0.18, 0.07); },
    hoot() { blip(300, 0.3, 'sine', 0.25); blip(260, 0.35, 'sine', 0.2, 0.18); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
}
