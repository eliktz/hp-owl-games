// Buckbeak in FREE PLAY (Elik, 26 Nov 2026; briefs/2026-11-26-book3-azkaban-quests.md "Free explore mode"). From a fresh
// save he stands at his quest spot by Hagrid's paddock (BB in adventure-buckbeak-build.js), Idle, wings folded, 1.35x.
// No tracker, no steps, no hints, no fail. Within ~5 m two round prompts appear: 🙇 (Harry bows, Buckbeak bows back and
// a kind bubble) and 🪽 "לעוף" (mount and fly: the quest's own on-rails flight, chase camera, takeover, safe aborts, lake
// skim with 🙌 and landing, with no feathers and no reward; +5 house points once per session for the first flight).
// A tap on him = Nuzzle + hearts + a soft chirp. A spell near him = the quest's kind refusal bubble; no spell acts on him.
// Everything of Buckbeak himself is REUSED from adventure-buckbeak.js: buckbeakScene(ctx, { free: true }) builds the
// same model / clips / flight with its own DOM ids and object name ('bbfree-buckbeak'); this module drives the ground.
// Holds: hidden (a short fade if he is drawn) and the prompts off while a lesson, a course, Quidditch, a Floo trip, a
// modal or another takeover runs; while ANY adventure runs he is taken out of the world at once (the quest 'buckbeak'
// then has its own Buckbeak: never two). adventure-buckbeak.js calls our hand-over synchronously when that quest's scene
// is created. He comes back afterwards. Lazy: the model loads only when Harry first comes within LOAD_R outdoors; a load
// failure is silent. Visibility: the quest's distance rule (drawn within 70 m of Harry or the camera; no frustum test).
// Debug / tests: window.__game.buckbeak  state() fly() hold(on) ctx() (the scene's _bb debug handles: clock, jump, abort...)
import { Vector3 } from 'three';
import { speak as voiceSpeak } from './voice.js';
import { buckbeakScene, onBuckbeakQuest } from './adventure-buckbeak.js';
import { BB, BB_SCALE } from './adventure-buckbeak-build.js';

export const BB_FREE_ON = true;   // the single switch: false = no free-play Buckbeak at all (the quest is unaffected)
const LOAD_R = 75, PROMPT_R = 6, FADE = 0.45, BOW_LEAN = 1.3, BOW_BACK = 2.6;
let PAID = false;   // +5 for the first free flight: once per session (memory only)

export function createBuckbeakFree({ scene, camera, player, interiors, fun, freecast, lessons, setTakeover, isModal, isTakeover, adventures, floo }) {
  const off = { tick() {}, api: { state: () => ({ on: false }), fly: () => false, hold: () => false } };
  if (!BB_FREE_ON) return off;
  const FI = freecast && freecast._internal;
  const emit = (...a) => { try { FI.emit(...a); } catch { /* no particles */ } };
  const burst = (...a) => { try { FI.burst(...a); } catch { /* no particles */ } };
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
  const outdoors = () => !interiors.active;
  const v1 = new Vector3(), _p = new Vector3();
  const log = { builds: 0, drops: 0, holds: 0, held: null, bows: 0, nuzzles: 0, flights: 0, landings: 0, paid: 0, says: 0, lastSay: null, spoken: [], taps: 0, errors: 0, failed: false };
  let sc = null, F = null, mats = null, fadeK = 1, hidden = false, debugHold = false, busy = null, busyT = 1, busyN = 0;
  let bub = null, bowT = 0, nuzT = 0, wasFlying = false, finalT = 0, lastWhy = null;

  // ---- the bubble (no helper box in free play: a world bubble over Buckbeak's head, following him in the air) ----
  function anchor(out) { const b = F && F.obj(); if (b) { F.headW(out); out.y += 0.9; return out; } return out.set(player.pos.x, player.pos.y + 2.4, player.pos.z); }
  function say(text, who, sec = 3.6) {
    log.says++; log.lastSay = text; log.spoken.push(text); if (log.spoken.length > 10) log.spoken.shift();
    try { bub = fun.say(anchor(v1), text, sec, 'bbfree'); } catch { /* no bubble */ }
    try { if (!muted()) voiceSpeak(text, { preset: 'narrator' }); } catch { /* no speech */ }
    void who;
  }
  function screen(v, out = { x: 0, y: 0, on: false }) { _p.copy(v).project(camera); out.x = (_p.x * 0.5 + 0.5) * innerWidth; out.y = (-_p.y * 0.5 + 0.5) * innerHeight; out.on = _p.z < 1 && Math.abs(_p.x) <= 1.05 && Math.abs(_p.y) <= 1.05; return out; }
  // the scene's context: the quest's flight runs as "step 3" at level 1 (no lanes); steps never complete here
  const ctx = { scene, camera, player, interiors, fun, freecast, emit, burst, setTakeover, isModal, isTakeover,
    level: 1, step: 3, done() {}, poke() {}, oops: (t) => say(t), say, screen, routeTo: () => null, speak: () => {} };

  // ---- the two prompts ----
  const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";
  const css = document.createElement('style'); css.id = 'bbfPromptCss';
  css.textContent = `#bbfPrompts{position:fixed;left:50%;bottom:calc(232px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:14;display:none;gap:18px;direction:ltr}
  #bbfPrompts.on{display:flex}
  #bbfPrompts button{width:96px;height:96px;border-radius:50%;border:5px solid #fff;background:linear-gradient(#ffe48a,#ffb020);padding:0;cursor:pointer;
    display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 26px rgba(255,210,90,.9);touch-action:manipulation;
    -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;animation:bbfIn .25s cubic-bezier(.3,1.7,.5,1)}
  #bbfPrompts button:active{transform:scale(.92)} #bbfPrompts button.busy{opacity:.55}
  #bbfPrompts i{font-style:normal;font-size:44px;line-height:1} #bbfPrompts span{font:bold 17px ${FONT};color:#5a2a00;line-height:1.1;direction:rtl}
  @keyframes bbfIn{0%{transform:scale(.3)}100%{transform:scale(1)}}
  body.modalOn #bbfPrompts,body.inSpell #bbfPrompts,body.inMatch #bbfPrompts,body.inFloo #bbfPrompts,body.inAdv #bbfPrompts,body.advBB #bbfPrompts{display:none !important}
  @media (max-width:700px){#bbfPrompts{bottom:calc(330px + env(safe-area-inset-bottom));gap:14px} #bbfPrompts button{width:88px;height:88px} #bbfPrompts i{font-size:40px} #bbfPrompts span{font-size:16px}}`;
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.id = 'bbfPrompts';
  const mk = (id, ico, lab, fn) => { const b = document.createElement('button'); b.id = id; b.innerHTML = '<i>' + ico + '</i><span>' + lab + '</span>'; b.setAttribute('aria-label', lab);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('click', (e) => { e.stopPropagation(); try { fn(); } catch (er) { log.errors++; console.warn('[buckbeak-free]', er && er.message || er); } }); wrap.appendChild(b); return b; };
  const bowBtn = mk('bbfBow', '🙇', 'קידה', () => bow());
  const flyBtn = mk('bbfFly', '🪽', 'לעוף', () => fly());
  document.body.appendChild(wrap);
  let promptsOn = false;
  function prompts(on) { on = !!on; if (on === promptsOn) return; promptsOn = on; wrap.classList.toggle('on', on); }

  // ---- hold rules (as roam.js): 4x a second, or every 3rd frame on a slow device; an adventure is checked every frame ----
  function busyWhy() {
    try {
      if (isTakeover() && !(F && F.flying())) return 'takeover';
      if (isModal()) return 'modal';
      if (lessons && lessons.openKey && lessons.openKey()) return 'lesson';
      const bc = document.body.classList;
      if (bc.contains('inSpell')) return 'course';
      if (bc.contains('inMatch')) return 'match';
      if (bc.contains('inFloo')) return 'floo';
      const fl = floo && floo(); if (fl) { const f = fl.state(); if (f.phase !== 'idle' || f.pickOpen) return 'floo'; }
    } catch { /* an api missing: not busy */ }
    if (debugHold) return 'debug';
    return null;
  }
  function adventureOn() {
    if (document.body.classList.contains('inAdv')) return true;
    try { const ad = adventures && adventures(); return !!(ad && ad.state().quest); } catch { return false; }
  }

  // ---- build / drop ----
  function build() {
    if (sc || log.failed) return;
    try { sc = buckbeakScene(ctx, { free: true }); F = sc.free; sc.begin(-1, false); log.builds++; mats = null; fadeK = 0; hidden = false; wasFlying = false; finalT = 0; bowT = 0; nuzT = 0; }
    catch (e) { console.warn('[buckbeak-free] build failed -', e && e.message || e); log.errors++; log.failed = true; sc = null; F = null; }
  }
  function drop() {
    if (!sc) return;
    try { sc.end(false); } catch (e) { console.warn('[buckbeak-free] end failed -', e && e.message || e); }
    if (mats) for (const m of mats) { try { m.dispose(); } catch { /* ok */ } }
    sc = null; F = null; mats = null; log.drops++; prompts(false); bowT = 0; nuzT = 0; finalT = 0; wasFlying = false;
    if (bub) { bub.t = Math.min(bub.t, 0); bub = null; }
  }
  onBuckbeakQuest(() => drop());   // the quest's scene is about to be created: our Buckbeak leaves first, synchronously

  // the fade: his own copies of the materials (made once per build, so the quest's shared ones are never touched)
  function ownMats() {
    if (mats) return mats; const b = F && F.obj(); if (!b) return null;
    mats = [];
    b.traverse(o => { if (!o.isMesh) return; const one = (m) => { const c = m.clone(); c.userData.bbfT = m.transparent; c.userData.bbfO = m.opacity; mats.push(c); return c; };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material); });
    return mats;
  }
  function setFade(k) {
    const ms = ownMats(); if (!ms) return;
    const solid = k >= 0.999;
    for (const m of ms) { const t = solid ? m.userData.bbfT : true; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = m.userData.bbfO * (solid ? 1 : k); }
  }

  // ---- the ground: the bow, the nuzzle, the flight, the landing ----
  const dist = () => { const b = F && F.obj(); return b ? Math.hypot(player.pos.x - b.position.x, player.pos.z - b.position.z) : 1e9; };
  function ready() { return !!(sc && F && F.obj() && outdoors() && !F.flying() && !hidden && !busy && !adventureOn()); }
  function bow() {
    if (!ready() || bowT > 0 || finalT > 0 || dist() > PROMPT_R + 1.5) return false;
    log.bows++; bowT = 0.001; F.faceBB(); F.bowCamera(); sfx('soft');
    return true;
  }
  function nuzzle() {
    if (!ready() || nuzT > 0) return false;
    if (dist() > 7.5) { say('בוא קרוב יותר לאבזם כדי ללטף אותו 🤚'); return true; }
    log.nuzzles++; nuzT = 0.7; F.replay('Nuzzle', 0.25); F.chirp();
    F.headW(v1); for (let i = 0; i < 10; i++) emit(v1.x + (Math.random() - 0.5) * 0.5, v1.y + 0.2 + Math.random() * 0.3, v1.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6, 1.3, 0.24, Math.random() < 0.5 ? 0xff7aa8 : 0xffb0cc, 0.1);
    return true;
  }
  function fly() {
    if (!ready() || bowT > 0 || finalT > 0 || dist() > PROMPT_R + 1.5) return false;
    prompts(false);
    const ok = F.fly(); if (ok) { log.flights++; wasFlying = true; }
    return ok;
  }
  // a tap on his head, neck or body (the screen distance, like the quest's pat)
  function tap(x, y) {
    if (!ready()) return false;
    const b = F.obj(), R = Math.max(46, Math.min(innerWidth, innerHeight) * 0.08), s = { x: 0, y: 0, on: false };
    const near = (v) => { screen(v, s); return s.on ? Math.hypot(s.x - x, s.y - y) : 1e9; };
    F.headW(v1); let d = near(v1);
    v1.copy(b.position); v1.y += 1.2 * BB_SCALE; d = Math.min(d, near(v1) * 0.8);
    if (d < R * 2.2) { nuzzle(); return true; }
    return false;
  }
  const view = document.getElementById('view');
  let down = null;
  if (view) {
    view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
    view.addEventListener('pointerup', (e) => {
      const d0 = down; down = null;
      if (!d0 || d0.id !== e.pointerId || !sc || isModal() || isTakeover()) return;
      if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      log.taps++;
      try { tap(e.clientX, e.clientY); } catch (er) { log.errors++; console.warn('[buckbeak-free] tap failed -', er && er.message || er); }
    }, { passive: true });
  }
  function landed() {
    log.landings++; finalT = 0.001; F.clearFinal();
    if (!PAID) { PAID = true; log.paid++; try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ }
      setTimeout(() => { try { fun.toast('✨⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ } }, 1800);
      burst(player.pos.x, player.pos.y + 1.3, player.pos.z, 0xffd76a, 18, 2.2, 1.0, 0.24, -1.2); }
  }

  // ---- per frame ----
  function tick(dt) {
    // an adventure: out of the world at once (no fade: the quest may bring its own Buckbeak)
    if (adventureOn()) { if (sc && !F.flying()) drop(); if (!sc) { if (lastWhy !== 'adventure') { lastWhy = 'adventure'; log.holds++; } log.held = 'adventure'; return; } }
    busyN++; busyT += dt;
    if (busyT > 0.25 || busyN >= 3) { busyT = 0; busyN = 0; busy = busyWhy(); }
    const why = busy;
    if (why !== lastWhy) { if (why) log.holds++; lastWhy = why; }
    log.held = why;
    if (!sc) {
      if (why || log.failed || !outdoors()) return;
      if (Math.hypot(player.pos.x - BB.x, player.pos.z - BB.z) > LOAD_R) return;
      build(); if (!sc) return;
    }
    const st = sc.state();
    if (st.failed && !st.loaded) { log.failed = true; drop(); return; }   // silent: no Buckbeak this session
    const flying = F.flying();
    if (flying) {
      if (why && why !== 'modal') F.abort('hold');   // (nothing can start during the flight; a modal freezes it instead)
      sc.update(dt, -1, false); prompts(false);
      if (bub && bub.t > 0) anchor(bub.pos);
      return;
    }
    if (wasFlying) { wasFlying = false; if (F.phase() === 'ground' && F.finalT() > 0) landed(); else F.clearFinal(); }
    // the hold: fade out (only if drawn), then not drawn; prompts off; back with a fade-in
    const b = F.obj();
    if (why) {
      prompts(false); bowT = 0; finalT = 0;
      if (!hidden) { hidden = true; if (!b || !b.visible) fadeK = 0; }
      if (b && fadeK > 0) { fadeK = Math.max(0, fadeK - dt / FADE); setFade(fadeK); sc.update(dt, -1, false); }
      if (b) b.visible = b.visible && fadeK > 0;
      return;
    }
    if (hidden) { hidden = false; fadeK = 0; F.syncCasts(); }   // (spells cast while he was away are not "at him")
    sc.update(dt, -1, false);
    if (!b) { prompts(false); return; }
    if (fadeK < 1) { fadeK = Math.min(1, fadeK + dt / FADE); setFade(fadeK); }
    if (bub && bub.t > 0) anchor(bub.pos);
    if (nuzT > 0) nuzT -= dt;
    const d = dist(), near = outdoors() && b.visible && d < PROMPT_R && !player.riding;
    // the bow: Harry leans while Buckbeak watches, then Buckbeak bows back and a kind bubble
    if (bowT > 0) {
      const t0 = bowT; bowT += dt;
      if (bowT < BOW_LEAN + 1.0) F.leanHarry(bowT < BOW_LEAN ? Math.min(1, bowT * 3) : Math.max(0, 1 - (bowT - BOW_LEAN)));
      if (t0 < BOW_LEAN && bowT >= BOW_LEAN) { F.replay('Bow', 0.35); sfx('chime'); say('אבזם אומר שלום 🦅💛'); }
      if (bowT >= BOW_LEAN + BOW_BACK) bowT = 0;
    }
    // after the landing: Buckbeak bows once more
    if (finalT > 0) {
      const t0 = finalT; finalT += dt;
      if (t0 < 0.5 && finalT >= 0.5) { F.replay('Bow', 0.35); sfx('chime'); }
      if (t0 < 1.2 && finalT >= 1.2) { say('איזו טיסה! אבזם גאה בך 🦅💛'); sfx('heart'); }
      if (finalT >= 3.6) finalT = 0;
    }
    prompts(near && bowT === 0 && finalT === 0);
  }

  function state() {
    const s = sc ? sc.state() : null;
    let skinned = 0; try { scene.traverse(o => { if (o.isSkinnedMesh && /buckbeak/.test(nameUp(o))) skinned++; }); } catch { /* ok */ }
    return { on: true, built: !!sc, loaded: !!(s && s.loaded), loading: !!(s && s.loading), failed: log.failed, visible: !!(s && s.visible), onScreen: !!(s && s.onScreen),
      mode: !sc ? (log.held === 'adventure' ? 'adventure' : 'none') : F.flying() ? 'flying' : hidden || log.held ? 'held' : bowT > 0 ? 'bowing' : finalT > 0 ? 'landed' : 'idle',
      held: log.held, hidden, fade: +fadeK.toFixed(2), prompts: promptsOn, dist: s && s.loaded ? +dist().toFixed(1) : null, clip: s ? s.clip : null, pos: s ? s.pos : null, ph: s ? s.ph : null,
      s: s ? s.s : 0, L: s ? s.L : 0, lake: !!(s && s.lake), cheered: !!(s && s.cheered), act: s ? s.act : null, takeover: !!(s && s.takeover), aborts: s ? s.aborts : 0, lastAbort: s ? s.lastAbort : null,
      maxTri: s ? s.maxTri : 0, maxDc: s ? s.maxDc : 0, tier: s ? s.tier : null, spellSays: s ? s.spellSays : 0, bbTris: s ? s.bbTris : null, paid: PAID, skinnedInScene: skinned,
      log: { ...log, spoken: log.spoken.slice() } };
  }
  // the skinned meshes of a Buckbeak (free or quest) carry no name of their own: look up the tree for 'buckbeak'
  function nameUp(o) { let n = ''; for (let p = o; p; p = p.parent) n += ' ' + (p.name || ''); return n; }
  const api = {
    state, fly: () => fly(), bow: () => bow(), nuzzle: () => nuzzle(), tap: (x, y) => tap(x, y),
    hold: (on = true) => { debugHold = !!on; return debugHold; },
    ctx: () => (sc ? ctx._bb : null),   // the scene's debug handles: clock(k), jump(s), abort(why), throwOnce(), timeoutNow(), logStart() log() ...
    headScreen: () => { if (!F || !F.obj()) return null; F.headW(v1); const s = screen(v1); return { x: Math.round(s.x), y: Math.round(s.y), on: s.on }; },
    resetPaid: () => { PAID = false; },
  };
  return { tick: (dt) => { try { tick(dt); } catch (e) { log.errors++; if (log.errors < 4) console.warn('[buckbeak-free] tick failed -', e && e.message || e); } }, api };
}
