// The game's own background theme: an ORIGINAL little waltz, synthesised with WebAudio from the
// note data below (no audio file is shipped, fetched or generated into the repository).
//
// ---- Composition (written for this game; please review) --------------------------------------
// Key / mode : F major with modal mixture (borrowed iv = B-flat minor with its D-flat, borrowed
//              bVII = E-flat) and a Lydian colour (E natural over B-flat maj7, bar 27).
// Metre/tempo: 3/4, 84 crotchets per minute; 32 bars = 68.6 s, then it loops to bar 1.
// Form       : A (1-8)  A' (9-16)  B (17-24)  A'' (25-32).
// Chords     : A   | F    | Dm7  | Bbmaj7 | C      | F/A | Bb  | Gm7   | C7sus4 |
//              A'  | F    | Am   | Bbmaj7 | Bbm6   | F/C | Dm  | C7    | F      |
//              B   | Dm   | Am   | Bb     | F      | Gm  | Eb  | Bbm   | C      |
//              A'' | F    | Dm7  | Bbmaj7 | Bbm6   | F/A | Ebmaj7 | Gm7 | C7sus4 |  -> bar 1
// Melody (celesta sounds an octave higher; h = half, q = quarter, h. = dotted half):
//   A   A4h Bb4q | C5h D5q | D5q C5q Bb4q | A4h G4q | F4q G4q A4q | Bb4h D5q | C5q Bb4q A4q | G4h.
//   A'  A4h Bb4q | C5h E5q | D5q E5q F5q | Db5h C5q | C5q A4q F4q | A4h D5q | C5q Bb4q G4q | F4h.
//   B   F5h E5q | E5q C5q A4q | D5h C5q | A4h C5q | Bb4q C5q D5q | Eb5h D5q | F5h Db5q | C5h.
//   A'' A4h Bb4q | C5h D5q | E5h D5q | Db5h C5q | A4q C5q F5q | G5h D5q | Bb4h A4q | G4h (rest q)
// How it differs from Hedwig's Theme: no pickup at all (every phrase starts on the downbeat), the
// opening is a rising half-step then whole-steps (A-Bb-C-D, mostly stepwise, answered by falling
// steps), never the rising perfect fourth / minor sixth leaps; the rhythm uses only "half +
// quarter" and "three even quarters" cells, never the dotted-quarter / eighth / quarter lilt; it is
// in F major (not E minor), with no raised-fourth or chromatic neighbour notes in the tune (the
// only chromatic notes are the borrowed D-flat and E-flat chords' tones), and no celesta motif of it.
// -------------------------------------------------------------------------------------------------
//
// Voices: celesta (sine + a fast-dying inharmonic partial), harp plucks (a soft custom wave),
// a string pad (detuned saws through one shared low-pass), a light bass, a few chimes, and one
// cheap feedback delay as "room". Two variations share the timeline and harmony and cross-fade:
//   castle    calm and sparse: two harp plucks a bar, darker pad, a chime every 8 bars
//   quidditch livelier: rolling harp quavers, a light bass pulse, harp doubling the tune,
//             brighter pad, a sparkle every 4 bars
//
// Engine: a look-ahead scheduler on the AudioContext clock, woken every 250 ms, schedules whole
// bars up to ~1 s ahead. Every note is its own oscillator + envelope gain, stopped and
// disconnected when it ends. No per-frame work, no ScriptProcessor/AudioWorklet. The same code
// renders into an OfflineAudioContext (renderAhead) for previews.
//
//   const th = createTheme(ctx, { destination })   th.out = master GainNode (caller sets level)
//   th.start()  th.stop()  th.setVariation('castle' | 'quidditch')  th.state()
//   th.renderAhead(seconds)   offline only: schedule everything up front (no timer)

const TRIM = 1.6;   // internal make-up so the theme sits near a typical music file at the same level
const BPM = 84, BEAT = 60 / BPM, BAR = 3 * BEAT, BARS = 32;
export const LOOP_SECONDS = BARS * BAR;

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(name) {            // 'Bb4' -> Hz (A4 = 440)
  const m = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Chords: bass root, pad voicing (3 notes), harp arpeggio tones (4 notes, low to high).
const CH = {
  F:      ['F2',  'A3 C4 F4',   'F2 C3 F3 A3'],
  Dm7:    ['D3',  'F3 A3 C4',   'D3 A3 C4 F4'],
  Bbmaj7: ['Bb2', 'F3 A3 D4',   'Bb2 F3 A3 D4'],
  C:      ['C3',  'G3 C4 E4',   'C3 G3 C4 E4'],
  FA:     ['A2',  'A3 C4 F4',   'A2 F3 C4 F4'],
  Bb:     ['Bb2', 'F3 Bb3 D4',  'Bb2 F3 Bb3 D4'],
  Gm7:    ['G2',  'F3 Bb3 D4',  'G2 D3 F3 Bb3'],
  C7sus4: ['C3',  'G3 Bb3 F4',  'C3 G3 Bb3 F4'],
  Am:     ['A2',  'A3 C4 E4',   'A2 E3 A3 C4'],
  Bbm6:   ['Bb2', 'G3 Db4 F4',  'Bb2 F3 G3 Db4'],
  FC:     ['C3',  'A3 C4 F4',   'C3 F3 A3 C4'],
  Dm:     ['D3',  'A3 D4 F4',   'D3 A3 D4 F4'],
  C7:     ['C3',  'G3 Bb3 E4',  'C3 G3 Bb3 E4'],
  Gm:     ['G2',  'G3 Bb3 D4',  'G2 D3 G3 Bb3'],
  Eb:     ['Eb3', 'G3 Bb3 Eb4', 'Eb3 Bb3 Eb4 G4'],
  Bbm:    ['Bb2', 'F3 Bb3 Db4', 'Bb2 F3 Bb3 Db4'],
  Ebmaj7: ['Eb3', 'G3 Bb3 D4',  'Eb3 Bb3 D4 G4'],
};
const PROG = [
  'F', 'Dm7', 'Bbmaj7', 'C', 'FA', 'Bb', 'Gm7', 'C7sus4',
  'F', 'Am', 'Bbmaj7', 'Bbm6', 'FC', 'Dm', 'C7', 'F',
  'Dm', 'Am', 'Bb', 'F', 'Gm', 'Eb', 'Bbm', 'C',
  'F', 'Dm7', 'Bbmaj7', 'Bbm6', 'FA', 'Ebmaj7', 'Gm7', 'C7sus4',
];
// Melody per bar: 'note:beats' (beats in crotchets; '-' = rest).
const MEL = [
  'A4:2 Bb4:1', 'C5:2 D5:1', 'D5:1 C5:1 Bb4:1', 'A4:2 G4:1', 'F4:1 G4:1 A4:1', 'Bb4:2 D5:1', 'C5:1 Bb4:1 A4:1', 'G4:3',
  'A4:2 Bb4:1', 'C5:2 E5:1', 'D5:1 E5:1 F5:1', 'Db5:2 C5:1', 'C5:1 A4:1 F4:1', 'A4:2 D5:1', 'C5:1 Bb4:1 G4:1', 'F4:3',
  'F5:2 E5:1', 'E5:1 C5:1 A4:1', 'D5:2 C5:1', 'A4:2 C5:1', 'Bb4:1 C5:1 D5:1', 'Eb5:2 D5:1', 'F5:2 Db5:1', 'C5:3',
  'A4:2 Bb4:1', 'C5:2 D5:1', 'E5:2 D5:1', 'Db5:2 C5:1', 'A4:1 C5:1 F5:1', 'G5:2 D5:1', 'Bb4:2 A4:1', 'G4:2 -:1',
];

// Pre-parse to Hz once.
const SONG = PROG.map((c, i) => {
  const [b, p, a] = CH[c];
  let beat = 0;
  const mel = MEL[i].split(' ').map(tok => {
    const [n, d] = tok.split(':'); const ev = { f: n === '-' ? 0 : hz(n), at: beat, len: +d }; beat += +d; return ev;
  }).filter(e => e.f);
  return { chord: c, bass: hz(b), pad: p.split(' ').map(hz), arp: a.split(' ').map(hz), mel };
});

// Small deterministic "humanise" (so offline renders are reproducible).
function jitter(bar, k) { const x = Math.sin(bar * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }

export function createTheme(ctx, { destination } = {}) {
  const offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const out = ctx.createGain(); out.gain.value = 0;          // master level, set by music.js
  const bus = ctx.createGain(); bus.gain.value = 1;          // internal kill switch (stop/start)
  bus.connect(out); out.connect(destination || ctx.destination);
  const pan = v => {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(bus); return p; }
    const g = ctx.createGain(); g.connect(bus); return g;
  };
  // Layer buses.
  const celB = pan(-0.18), harpB = pan(0.22), chimeB = pan(0.05);
  const bassB = ctx.createGain(); bassB.connect(bus);
  const padLP = ctx.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 950; padLP.Q.value = 0.4;
  const padB = ctx.createGain(); padB.gain.value = 1; padLP.connect(padB); padB.connect(bus);
  // Room: one feedback delay fed by celesta, harp and chimes.
  const dly = ctx.createDelay(1.0); dly.delayTime.value = BEAT / 2 + 0.013;
  const fb = ctx.createGain(); fb.gain.value = 0.34;
  const dLP = ctx.createBiquadFilter(); dLP.type = 'lowpass'; dLP.frequency.value = 2400;
  const wet = ctx.createGain(); wet.gain.value = 0.28;
  dly.connect(dLP); dLP.connect(fb); fb.connect(dly); dLP.connect(wet); wet.connect(bus);
  for (const b of [celB, harpB, chimeB]) b.connect(dly);

  // Harp timbre: soft custom wave (harmonics falling ~1/n^2).
  const H = [0, 1, 0.42, 0.2, 0.1, 0.05, 0.025, 0.012];
  const harpWave = ctx.createPeriodicWave(new Float32Array(H.length), Float32Array.from(H));

  // ---- note bookkeeping (for the leak check and the voice budget) ----
  const live = new Set();      // {o, g, t0, t1}
  let created = 0, ended = 0, oscSeconds = 0;
  function voice(type, f, t0, dur, peak, dest, { attack = 0.004, release = null, detune = 0, wave = null, sustain = false } = {}) {
    peak *= TRIM;
    if (peak <= 0.0005) return;
    t0 = Math.max(t0, ctx.currentTime, 0);
    const o = ctx.createOscillator();
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.frequency.value = f; if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    if (sustain) {   // pad: slow attack, hold, release
      g.gain.linearRampToValueAtTime(peak, t0 + attack);
      g.gain.setValueAtTime(peak, t0 + dur);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur + release);
      dur += release;
    } else {         // struck / plucked: fast attack, exponential decay
      g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    o.connect(g); g.connect(dest);
    const rec = { o, g, t0, t1: t0 + dur + 0.02 };
    o.start(t0); o.stop(rec.t1);
    created++; oscSeconds += rec.t1 - t0;
    if (!offline) {
      live.add(rec);
      o.onended = () => { ended++; live.delete(rec); try { o.disconnect(); g.disconnect(); } catch { /* already */ } };
    }
  }
  const celesta = (f, t, v, dest = celB) => {
    voice('sine', f, t, 1.9, 0.20 * v, dest);
    voice('sine', f * 4.07, t, 0.32, 0.045 * v, dest);   // inharmonic bar partial, dies fast
  };
  const harp = (f, t, v, dur = 1.5) => voice(null, f, t, dur, 0.16 * v, harpB, { attack: 0.003, wave: harpWave });
  const chime = (f, t, v) => { voice('sine', f, t, 2.4, 0.055 * v, chimeB); voice('sine', f * 2.76, t, 0.6, 0.018 * v, chimeB); };
  const padNote = (f, t, dur, v, i) => voice('sawtooth', f, t, dur, 0.034 * v, padLP, { attack: 0.7, release: 0.9, detune: i % 2 ? 6 : -6, sustain: true });
  const bass = (f, t, dur, v) => voice('triangle', f, t, dur, 0.24 * v, bassB, { attack: 0.02 });

  // ---- variation mix: m = 0 castle .. 1 quidditch, linear over FADE from fadeT0 ----
  const FADE = 1.5;
  let mFrom = 0, mTo = 0, fadeT0 = 0, variation = 'castle';
  const mixAt = t => t <= fadeT0 ? mFrom : t >= fadeT0 + FADE ? mTo : mFrom + (mTo - mFrom) * (t - fadeT0) / FADE;
  function padCutoff(t, m) { try { padLP.frequency.setTargetAtTime(950 + 900 * m, t, 0.45); } catch { /* */ } }

  // ---- one bar ----
  function scheduleBar(i, t) {
    const S = SONG[i];
    const m = mixAt(t), c = 1 - m;                 // castle weight c, quidditch weight m
    const hj = k => (jitter(i, k) - 0.5) * 0.016;  // +-8 ms
    const vj = k => 0.88 + 0.24 * jitter(i, k + 50);
    // pad: whole bar, gently overlapping into the next bar
    S.pad.forEach((f, k) => padNote(f, t + 0.01 * k, BAR - 0.15, 1.0 + 0.15 * m, k));
    // bass: beat 1, long; quidditch adds a light pulse on beats 2 and 3
    bass(S.bass, t, BAR * 0.95, 1);
    if (m > 0.01) { bass(S.bass * 2, t + BEAT + hj(1), 0.22, 0.32 * m); bass(S.bass * 2, t + 2 * BEAT + hj(2), 0.22, 0.28 * m); }
    // melody: celesta an octave up (both); quidditch doubles it on the harp at written pitch
    S.mel.forEach((e, k) => {
      const tt = t + e.at * BEAT + hj(10 + k), len = e.len * BEAT;
      celesta(e.f * 2, tt, vj(10 + k) * (0.9 + 0.15 * m));
      if (m > 0.01) harp(e.f, tt, 0.75 * m * vj(20 + k), Math.max(0.7, len));
    });
    // harp accompaniment
    if (c > 0.01) {                                // castle: two plucks, beats 2 and 3
      harp(S.arp[1], t + BEAT + hj(30), 0.8 * c * vj(30), 1.8);
      harp(S.arp[2], t + 2 * BEAT + hj(31), 0.7 * c * vj(31), 1.8);
      if (i % 2 === 1) harp(S.arp[3], t + 2.5 * BEAT + hj(32), 0.45 * c * vj(32), 1.4);
    }
    if (m > 0.01) {                                // quidditch: rolling quavers up and down
      [0, 1, 2, 3, 2, 1].forEach((a, k) => harp(S.arp[a] * (k >= 3 && a === 1 ? 2 : 1), t + k * BEAT / 2 + hj(40 + k), (k ? 0.55 : 0.75) * m * vj(40 + k), 0.6));
    }
    // chimes: castle a soft high note every 8 bars, quidditch a 3-note sparkle every 4 bars
    if (c > 0.01 && i % 8 === 0) chime(S.pad[2] * 4, t + 2 * BEAT, 0.9 * c);
    if (m > 0.01 && i % 4 === 3) S.arp.slice(1).forEach((f, k) => chime(f * 4, t + 2 * BEAT + k * BEAT / 3, 0.7 * m));
  }

  // ---- scheduler ----
  const AHEAD = 1.0, WAKE = 250;
  let playing = false, timer = 0, bar = 0, nextBar = 0, barsScheduled = 0;
  function tick(horizon = ctx.currentTime + AHEAD) {
    const now = ctx.currentTime;
    if (!offline && nextBar < now + 0.02) nextBar = now + 0.06;     // fell behind (throttled / interrupted): resync
    while (nextBar < horizon) {
      scheduleBar(bar, nextBar);
      nextBar += BAR; bar = (bar + 1) % BARS; barsScheduled++;
    }
  }
  function silenceNow() {
    const now = ctx.currentTime;
    for (const r of live) { try { r.o.stop(Math.max(now + 0.12, r.t0 + 0.001)); } catch { /* */ } }
  }

  const api = {
    out,
    start(at) {
      if (playing) return;
      playing = true;
      const now = ctx.currentTime;
      try { bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(1, now + 0.05); } catch { bus.gain.value = 1; }
      nextBar = at !== undefined ? at : now + 0.08;
      if (!offline) { tick(); timer = setInterval(() => { if (playing) tick(); }, WAKE); }
    },
    stop() {               // pause: stop scheduling and silence (resumes from the same bar)
      if (!playing) return;
      playing = false; clearInterval(timer); timer = 0;
      const now = ctx.currentTime;
      try { bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.setTargetAtTime(0, now, 0.025); } catch { bus.gain.value = 0; }
      silenceNow();
      bar = (bar + BARS - 1) % BARS;   // the bar cut short replays from its start
    },
    setVariation(v, immediate = false) {
      v = v === 'quidditch' ? 'quidditch' : 'castle';
      if (v === variation && !immediate) return;
      variation = v;
      const t = immediate ? 0 : Math.max(ctx.currentTime, playing ? nextBar : ctx.currentTime);   // next bar boundary
      mFrom = immediate ? (v === 'quidditch' ? 1 : 0) : mixAt(t); mTo = v === 'quidditch' ? 1 : 0; fadeT0 = t;
      if (immediate) { padLP.frequency.value = 950 + 900 * mTo; } else padCutoff(t, mTo);
    },
    renderAhead(seconds) {   // offline: schedule [0, seconds) up front
      api.start(0); tick(seconds);
      return { bars: barsScheduled, notes: created, avgOscillators: oscSeconds / seconds };
    },
    state() {
      const now = ctx.currentTime;
      let sounding = 0; for (const r of live) if (r.t0 <= now && r.t1 > now) sounding++;
      return { playing, variation, mix: +mixAt(now).toFixed(3), bar, barsScheduled, notes: created, ended, live: live.size, sounding,
        out: +out.gain.value.toFixed(4), loopSeconds: +LOOP_SECONDS.toFixed(2), time: now };
    },
  };
  return api;
}

// A plain-text summary of the note data (for the preview notes).
export function describe() {
  const nice = c => c === 'FA' ? 'F/A' : c === 'FC' ? 'F/C' : c;
  return SONG.map((s, i) => `bar ${String(i + 1).padStart(2)}  ${nice(PROG[i]).padEnd(7)}  ${MEL[i]}`).join('\n');
}
