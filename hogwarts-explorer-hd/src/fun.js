// Shared "delight" plumbing for the HD game (the ES-module sibling of v1's delight/core.js):
//   store      one persisted save, the SAME localStorage key as v1 (house, pet, secrets carry over)
//   sfx        silly procedural WebAudio sounds
//   toast / confetti / say / offer   big emoji banner, emoji rain, a bubble pinned to a 3D
//              point, and the single round "do it" prompt button
// It also publishes window.HPFun + a tiny window.HP shim, because the lesson mini-games are
// the very same scripts v1 runs (../hogwarts-explorer/lessons/*.js) and they speak to those.
import { Vector3 } from 'three';

const KEY = 'hpFun1';
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { store = {}; }
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private mode */ } };
export const today = () => { try { return new Date().toDateString(); } catch { return 'day'; } };
export { store };

// ---------------- sounds ----------------
let ac = null, master = null, isMuted = () => false;
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); } catch { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
['pointerdown', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, () => ctx(), { passive: true }));
const quiet = () => !ac || isMuted();
function tone(f, dur, type = 'sine', vol = 0.2, when = 0, slide = null) {
  if (quiet()) return;
  const t0 = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, vol = 0.2, when = 0, freq = 800, q = 1, type = 'bandpass') {
  if (quiet()) return;
  const t0 = ac.currentTime + when, len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t0);
}
export const sfx = {
  tone, noise,
  giggle: (hi) => { const b = hi ? 900 : 620; for (let i = 0; i < 6; i++) tone(b + (i % 2 ? 140 : 0) - i * 22, 0.09, 'triangle', 0.16, i * 0.085, b * 1.15); },
  raspberry: () => { for (let i = 0; i < 22; i++) tone(95 + Math.random() * 40, 0.035, 'sawtooth', 0.2, i * 0.03); noise(0.7, 0.07, 0, 300, 0.8); },
  ribbit: (v = 1) => { tone(190, 0.1, 'square', 0.1 * v, 0, 320); tone(240, 0.16, 'square', 0.1 * v, 0.13, 150); },
  zap: () => { tone(1400, 0.28, 'sawtooth', 0.09, 0, 240); tone(2100, 0.2, 'sine', 0.1, 0.02, 3200); noise(0.25, 0.06, 0, 3000, 2); },
  clank: () => { for (let i = 0; i < 4; i++) { tone(700 + Math.random() * 900, 0.07, 'square', 0.07, i * 0.11); noise(0.06, 0.12, i * 0.11, 2500, 3); } },
  burp: () => { tone(150, 0.32, 'sawtooth', 0.2, 0, 70); tone(210, 0.12, 'square', 0.08, 0.05, 120); },
  hic: () => tone(520, 0.07, 'sine', 0.2, 0, 1150),
  squeak: () => { tone(1500, 0.09, 'sine', 0.16, 0, 2300); tone(2000, 0.08, 'sine', 0.12, 0.1, 1500); },
  boing: () => tone(180, 0.4, 'sine', 0.24, 0, 640),
  poof: () => { noise(0.4, 0.18, 0, 500, 0.6); tone(260, 0.3, 'sine', 0.12, 0, 120); },
  tada: () => { [523, 659, 784, 1047, 1319].forEach((n, i) => { tone(n, i === 4 ? 0.6 : 0.16, 'triangle', 0.2, i * 0.09); tone(n / 2, 0.2, 'sine', 0.08, i * 0.09); }); },
  drum: () => { for (let i = 0; i < 14; i++) noise(0.05, 0.1 + i * 0.008, i * 0.075, 220, 1.2, 'lowpass'); },
  tink: (i = 0) => tone(1300 + i * 90 + Math.random() * 200, 0.2, 'sine', 0.1),
  yelp: () => { tone(500, 0.3, 'triangle', 0.2, 0, 1500); tone(1500, 0.25, 'triangle', 0.14, 0.28, 400); },
  munch: () => { for (let i = 0; i < 3; i++) noise(0.07, 0.18, i * 0.13, 900, 1.5); },
  heart: () => { tone(660, 0.14, 'sine', 0.16); tone(880, 0.3, 'sine', 0.16, 0.13); },
  tune: (notes, step = 0.2, type = 'triangle') => notes.forEach((n, i) => { if (n) tone(n, step * 0.9, type, 0.1, i * step); }),
  chime: () => { tone(880, 0.3, 'triangle', 0.22); tone(1760, 0.22, 'sine', 0.08, 0.04); },
  sparkle: () => { for (let i = 0; i < 4; i++) tone(1200 + Math.random() * 1400, 0.15, 'sine', 0.06, i * 0.05); },
  soft: () => { tone(392, 0.25, 'sine', 0.15); tone(330, 0.3, 'sine', 0.15, 0.12); },
  flip: () => tone(700, 0.08, 'triangle', 0.18, 0, 1000),
  pop: () => tone(500, 0.12, 'sine', 0.3, 0, 1100),
  whoosh: () => noise(0.4, 0.12, 0, 1200, 0.5),
  boom: () => { noise(0.6, 0.25, 0, 300, 0.6, 'lowpass'); },
  fanfare: () => { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((n, i) => { tone(n, i === 5 ? 0.7 : 0.2, 'triangle', 0.22, [0, 0.13, 0.26, 0.4, 0.62, 0.75][i]); }); },
  hoot: () => { tone(420, 0.18, 'sine', 0.25, 0, 357); tone(400, 0.32, 'sine', 0.25, 0.22, 315); },
  tweet: () => { for (let i = 0; i < 5; i++) tone(1500 + Math.random() * 600, 0.07, 'square', 0.04, i * 0.07, 2400); },
};

// ---------------- DOM bits ----------------
const css = document.createElement('style');
css.textContent = `
#funToast{position:fixed;left:50%;top:30%;transform:translate(-50%,-50%) scale(0);z-index:44;pointer-events:none;text-align:center;
  background:rgba(32,20,70,.95);border:4px solid #ffd76a;border-radius:26px;padding:12px 26px 14px;color:#fff;font-family:'Rubik',sans-serif;
  box-shadow:0 10px 36px rgba(0,0,0,.55);transition:transform .42s cubic-bezier(.3,1.8,.5,1);max-width:86vw;direction:rtl}
#funToast.on{transform:translate(-50%,-50%) scale(1)}
#funToast .e{font-size:70px;line-height:1.05;filter:drop-shadow(0 0 14px rgba(255,215,106,.7))}
#funToast .t{font-size:30px;font-weight:bold;color:#ffe9a8;text-shadow:0 2px 0 #000}
.funConf{position:fixed;top:-50px;z-index:43;pointer-events:none;font-size:34px;animation:funFall linear forwards;will-change:transform}
@keyframes funFall{0%{transform:translate3d(0,0,0) rotate(0)}100%{transform:translate3d(var(--dx),108vh,0) rotate(var(--rot))}}
.funBub{position:fixed;transform:translate(-50%,-100%) scale(.6);padding:8px 14px;border-radius:18px;background:rgba(255,248,228,.96);
  border:3px solid #ffd76a;color:#2a1a12;font:bold 24px 'Rubik',sans-serif;text-align:center;z-index:12;pointer-events:none;opacity:0;
  transition:opacity .18s,transform .25s cubic-bezier(.3,1.7,.5,1);max-width:56vw;white-space:nowrap;direction:rtl}
.funBub.on{opacity:1;transform:translate(-50%,-100%) scale(1)}
#funPrompt{position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%) scale(0);z-index:14;
  width:96px;height:96px;border-radius:50%;border:5px solid #fff;background:linear-gradient(#ffe48a,#ffb020);font-size:50px;
  display:flex;align-items:center;justify-content:center;box-shadow:0 0 26px rgba(255,210,90,.9);cursor:pointer;
  transition:transform .25s cubic-bezier(.3,1.7,.5,1);touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0}
#funPrompt.on{transform:translateX(-50%) scale(1)}
body.modalOn #funPrompt,body.modalOn .funBub,body.inMatch #funPrompt{display:none}`;
document.head.appendChild(css);

let toastEl = null, toastT = null;
export const last = { toast: null };
export function toast(emoji, text, ms = 2200) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'funToast'; document.body.appendChild(toastEl); }
  toastEl.innerHTML = '<div class="e">' + emoji + '</div>' + (text ? '<div class="t">' + text + '</div>' : '');
  toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms);
  last.toast = { emoji, text };
}
export function confetti(set = ['✨', '⭐', '🎉', '🌟', '💛', '🎊'], n = 18) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'funConf'; d.textContent = set[(Math.random() * set.length) | 0];
    d.style.left = (Math.random() * 100) + 'vw'; d.style.setProperty('--dx', ((Math.random() - 0.5) * 30) + 'vw'); d.style.setProperty('--rot', ((Math.random() - 0.5) * 900) + 'deg');
    d.style.animationDuration = (1.5 + Math.random() * 1.4) + 's'; d.style.animationDelay = (Math.random() * 0.4) + 's'; d.style.fontSize = (24 + Math.random() * 22) + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 3600);
  }
}
const bubs = [], v3 = new Vector3();
export function say(pos, text, sec = 2.4, key = null) {
  let b = key && bubs.find(x => x.key === key);
  if (!b) { b = { el: document.createElement('div'), key }; b.el.className = 'funBub'; document.body.appendChild(b.el); bubs.push(b); }
  b.pos = pos.clone ? pos.clone() : pos; b.t = sec; if (b.text !== text) { b.text = text; b.el.textContent = text; }
  return b;
}
let promptEl = null, offerNow = null, shown = null;
export function offer(id, emoji, dist, fn) { if (!offerNow || dist < offerNow.dist) offerNow = { id, emoji, dist, fn }; }
export const promptId = () => (shown ? shown.id : null);
export function tick(dt, camera) {
  for (let i = bubs.length - 1; i >= 0; i--) {
    const b = bubs[i]; b.t -= dt;
    if (b.t <= 0) { b.el.classList.remove('on'); if (b.t < -0.4) { b.el.remove(); bubs.splice(i, 1); } continue; }
    v3.copy(b.pos).project(camera);
    if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { b.el.classList.remove('on'); continue; }
    b.el.style.left = (v3.x * 0.5 + 0.5) * innerWidth + 'px'; b.el.style.top = (-v3.y * 0.5 + 0.5) * innerHeight + 'px'; b.el.classList.add('on');
  }
  if (!promptEl) {
    promptEl = document.createElement('button'); promptEl.id = 'funPrompt'; document.body.appendChild(promptEl);
    promptEl.addEventListener('click', e => { e.stopPropagation(); if (shown && shown.fn) { const f = shown.fn; sfx.squeak(); f(); } });
  }
  if (offerNow) { if (!shown || shown.id !== offerNow.id) promptEl.textContent = offerNow.emoji; shown = offerNow; promptEl.classList.add('on'); }
  else { shown = null; promptEl.classList.remove('on'); }
  offerNow = null;
}
export function bindMute(fn) { isMuted = fn; }

// ---- what the shared lesson scripts expect to find on window ----
const mods = {};
window.HPFun = { store, save, today, sfx, toast, confetti, say, offer, promptId, mods, ready: false, get lastToast() { return last.toast; } };
window.HP = window.HP || { sfx: { ...sfx, isMuted: () => isMuted() }, cheer() {}, perf: { fps: 60, quality: 1 } };
export { mods };
