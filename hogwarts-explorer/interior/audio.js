/* Ambient interior audio, all synthesised with WebAudio (no sound files): an echoey
 * footstep per stride, a soft distant murmur/room-tone bed, and a crackling fire that
 * swells as you approach the common-room hearth. Shares the global mute (HP.sfx). */
(function (HPI) {
  HPI.Audio = function () {
    let ctx = null, master = null, verb = null, murmurGain = null, fireGain = null, started = false;

    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = HP.sfx.isMuted() ? 0 : 0.5; master.connect(ctx.destination);
        // cheap "stone hall" echo: a feedback delay the footsteps run through
        const delay = ctx.createDelay(); delay.delayTime.value = 0.17;
        const fb = ctx.createGain(); fb.gain.value = 0.38;
        const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1400;
        delay.connect(damp); damp.connect(fb); fb.connect(delay);
        const vg = ctx.createGain(); vg.gain.value = 0.5; delay.connect(vg); vg.connect(master);
        verb = delay;
      } catch (e) { ctx = null; }
    }

    // looping beds built from filtered noise
    function noiseSource(dur = 2) {
      const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; return src;
    }

    function startBeds() {
      if (!ctx || started) return; started = true;
      // distant murmur: band-passed noise, slowly wavering
      const mSrc = noiseSource(3), mf = ctx.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 500; mf.Q.value = 0.8;
      murmurGain = ctx.createGain(); murmurGain.gain.value = 0.015;
      mSrc.connect(mf); mf.connect(murmurGain); murmurGain.connect(master); mSrc.start();
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.01;
      lfo.connect(lg); lg.connect(murmurGain.gain); lfo.start();
      // fire crackle bed (gain driven by proximity in update)
      const fSrc = noiseSource(2), ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 900;
      fireGain = ctx.createGain(); fireGain.gain.value = 0;
      fSrc.connect(ff); ff.connect(fireGain); fireGain.connect(master); fSrc.start();
    }

    function step() {
      if (!ctx || HP.sfx.isMuted()) return;
      const t0 = ctx.currentTime, len = Math.floor(ctx.sampleRate * 0.12), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260 + Math.random() * 120;
      const g = ctx.createGain(); g.gain.value = 0.18;
      src.connect(f); f.connect(g); g.connect(master); if (verb) g.connect(verb);
      src.start(t0);
    }

    let crackleT = 0, stepT = 0;
    function update(dt, moving, speed, fireDist) {
      if (!ctx) return;
      if (master) master.gain.value += ((HP.sfx.isMuted() ? 0 : 0.5) - master.gain.value) * Math.min(1, dt * 4);
      // footsteps paced by movement speed
      if (moving) { stepT -= dt * (0.6 + speed); if (stepT <= 0) { step(); stepT = 1; } } else stepT = 0;
      // fire proximity: louder + occasional pops near the hearth
      if (fireGain) {
        const near = HPI.clamp(1 - (fireDist || 99) / 16, 0, 1);
        fireGain.gain.value += (near * 0.05 - fireGain.gain.value) * Math.min(1, dt * 3);
        crackleT -= dt;
        if (near > 0.2 && crackleT <= 0 && !HP.sfx.isMuted()) {
          crackleT = 0.08 + Math.random() * 0.25;
          const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'square'; o.frequency.value = 80 + Math.random() * 120;
          g.gain.setValueAtTime(near * 0.08, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
          o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.08);
        }
      }
    }

    return { init, startBeds, step, update };
  };
})(window.HPI);
