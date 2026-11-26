// The Time-Turner as a FREE-PLAY toy (book 3 piece C, briefs/2026-11-26-book3-piece-c.md). A round ⏳ button in the right
// column (above the 📜 one), from a fresh save. A tap: the Time-Turner spins above Harry's hand and a 3-second gold / sepia
// rewind plays: the screen warms to sepia, a clock runs backwards, sparkles fly inward, and a translucent GOLD Harry (the
// hero model, glowing warm) retraces Harry's last ~6 seconds backwards while the real Harry stands (the controls are locked
// for those 3 s only); a soft falling chime run; then the gold Harry waves and fades in sparkles. No puzzle, no fail; a
// cooldown of 8 s. Hidden during adventures (the quest 'b3-timeturner' has its own ⏳), lessons, courses, Quidditch, Floo
// trips, the free rides / flights and any takeover or modal. The path is a small preallocated ring buffer (no per-frame
// allocation); the effect is the shared one in adventure-b3-timeturner-build.js.
// Debug / tests: window.__game.timeturner  state() spin() hold(on)
import { Vector3 } from 'three';
import { getRewind, buildTimeTurner } from './adventure-b3-timeturner-build.js';

export const TT_FREE_ON = true;   // the single switch: false = no ⏳ toy (the quest is unaffected)
const SECS = 3, BACK = 6, COOL = 8;

export function createTimeTurnerFree({ scene, camera, player, interiors, fun, freecast, lessons, isModal, isTakeover, adventures, floo }) {
  const off = { tick() {}, api: { state: () => ({ on: false }), spin: () => false, hold: () => false } };
  if (!TT_FREE_ON) return off;
  const FI = freecast && freecast._internal;
  const emit = (...a) => { try { FI.emit(...a); } catch { /* no particles */ } };
  const RW = getRewind({ scene, camera, player, fun, emit });
  const log = { spins: 0, refused: 0, holds: 0, held: null, errors: 0, lastWhy: null, locked: 0 };
  const S = { cool: 0, run: false, t: 0, prop: null, lockedInput: false, debugHold: false, busyT: 1, busy: null };
  const v1 = new Vector3();

  const css = document.createElement('style'); css.id = 'ttFreeCss';
  css.textContent = `#ttBtn{right:calc(18px + env(safe-area-inset-right));bottom:calc(416px + env(safe-area-inset-bottom));font-size:40px;padding:0;cursor:pointer;touch-action:manipulation;
    background:radial-gradient(circle at 50% 35%,rgba(255,232,160,.97),rgba(170,120,30,.92))}
  #ttBtn.cool{filter:grayscale(.6) brightness(.85)}
  body.modalOn #ttBtn,body.inAdv #ttBtn,body.inSpell #ttBtn,body.inMatch #ttBtn,body.inFloo #ttBtn,body.mmOn #ttBtn,body.advBB #ttBtn,body.ttHide #ttBtn{display:none !important}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'ttBtn'; btn.className = 'gamebtn'; btn.textContent = '⏳'; btn.setAttribute('aria-label', 'מחזיר הזמן');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) btn.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  btn.addEventListener('click', (e) => { e.stopPropagation(); try { spin(); } catch (er) { log.errors++; console.warn('[timeturner-free]', er && er.message || er); } });
  document.body.appendChild(btn);

  function busyWhy() {
    try {
      if (document.body.classList.contains('inAdv')) return 'adventure';
      try { const ad = adventures && adventures(); if (ad && ad.state().quest) return 'adventure'; } catch { /* ok */ }
      if (isTakeover()) return 'takeover';
      if (isModal()) return 'modal';
      if (lessons && lessons.openKey && lessons.openKey()) return 'lesson';
      const bc = document.body.classList;
      if (bc.contains('inSpell')) return 'course';
      if (bc.contains('inMatch')) return 'match';
      if (bc.contains('inFloo')) return 'floo';
      if (bc.contains('advBB')) return 'ride';
      const fl = floo && floo(); if (fl) { const f = fl.state(); if (f.phase !== 'idle' || f.pickOpen) return 'floo'; }
    } catch { /* an api missing: not busy */ }
    if (S.debugHold) return 'debug';
    return null;
  }
  function lock(on) {
    const inp = window.__game && window.__game.input;
    if (on && !S.lockedInput) { S.lockedInput = true; log.locked++; try { inp.setEnabled(false); } catch { /* ok */ } }
    else if (!on && S.lockedInput) { S.lockedInput = false; try { if (!isModal()) inp.setEnabled(true); } catch { /* ok */ } }
  }
  function prop(on) {
    if (on) { if (!S.prop) { S.prop = buildTimeTurner(); S.prop.name = 'ttfree-turner'; } if (!S.prop.parent) scene.add(S.prop); S.prop.visible = true; }
    else if (S.prop && S.prop.parent) S.prop.parent.remove(S.prop);
  }
  function spin() {
    if (S.run || RW.on) return false;
    if (S.busy || busyWhy()) { log.refused++; return false; }
    if (S.cool > 0) { log.refused++; try { fun.toast('⏳', 'מחזיר הזמן נח רגע...', 1200); } catch { /* ok */ } return false; }
    const ok = RW.start({ secs: SECS, back: BACK, mode: 'free', parent: interiors.active && interiors.room ? interiors.room.group : null, onEnd: () => { S.run = false; lock(false); prop(false); S.cool = COOL; } });
    if (!ok) return false;
    S.run = true; S.t = 0; log.spins++; lock(true); prop(true); btn.classList.add('cool');
    try { player.play('Cheer'); } catch { /* ok */ }
    return true;
  }
  function tick(dt) {
    S.busyT += dt; if (S.busyT > 0.25) { S.busyT = 0; S.busy = busyWhy(); }
    const why = S.busy; if (why !== log.lastWhy) { if (why) log.holds++; log.lastWhy = why; } log.held = why;
    if (why === 'adventure') { if (S.run) { S.run = false; lock(false); prop(false); } return; }   // (the quest owns the shared effect then)
    if (S.cool > 0) { S.cool -= dt; if (S.cool <= 0) btn.classList.remove('cool'); }
    if (!S.run) { if (!why) RW.record(dt); RW.update(dt); return; }
    S.t += dt;
    if (why && why !== 'modal' && S.t > 0.2) { RW.drop(); S.run = false; lock(false); prop(false); S.cool = COOL; return; }   // anything else takes the screen: the toy simply stops
    if (S.prop) {   // spinning above Harry's hand, in front of him
      const s = player.model ? player.model.scale.y || 1 : 1, f = player.yaw;
      v1.set(player.pos.x + Math.sin(f) * 0.42 * s + Math.cos(f) * 0.12, player.pos.y + 1.05 * s + Math.sin(S.t * 3) * 0.04, player.pos.z + Math.cos(f) * 0.42 * s - Math.sin(f) * 0.12);
      S.prop.position.copy(v1); S.prop.rotation.set(0.25, S.t * 7, 0);
    }
    RW.update(dt);
  }
  function state() {
    const st = RW.state();
    let onScreen = false; try { if (st.ghostVisible) { RW.ghostW(v1); v1.project(camera); onScreen = v1.z < 1 && Math.abs(v1.x) <= 1 && Math.abs(v1.y) <= 1; } } catch { /* ok */ }
    const b = btn.getBoundingClientRect();
    return { on: true, run: S.run, cool: +Math.max(0, S.cool).toFixed(2), held: log.held, locked: S.lockedInput, btn: b.width > 0 && getComputedStyle(btn).display !== 'none', btnBox: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)],
      prop: !!(S.prop && S.prop.parent && S.prop.visible), visible: st.ghostVisible, onScreen, rewind: st, log: { ...log } };
  }
  const api = { state, spin: () => spin(), hold: (on = true) => { S.debugHold = !!on; S.busyT = 1; return S.debugHold; } };
  return { tick: (dt) => { try { tick(dt); } catch (e) { log.errors++; if (log.errors < 4) console.warn('[timeturner-free] tick failed -', e && e.message || e); } }, api };
}
