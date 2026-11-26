// Book 3, adventure 6 (the finale): "מצילים את אבזם וסיריוס", helper Hermione. Data for adventures.js + the scene code.
// Decisions: briefs/2026-11-26-book3-piece-c.md. Kid-safe: NO executioner, axe, block, chains, cell or fear anywhere: the
// urgency is only in bubbles ("הם בדרך"), and a child who waits gets Hermione's Time-Turner (a sepia rewind: the step simply
// continues), never a fail. Spells act on the KNOT only (never on Buckbeak, the dog, Sirius, Hagrid: a kind bubble).
// Steps: 1 Hagrid's worried bubble by the paddock; Hermione has a plan -> 2 free Buckbeak: tap the knot on the post, or
// Alohomora / Diffindo at the KNOT (a wheel target; the ✂️ prompt is the fallback) -> 3 a quick bow (🙇, he bows back) and
// mount (🪽) -> 4 the flight: on rails, gentle, up from the paddock, round over the hut lawns and to the Astronomy tower top
// (the lens flies AHEAD of him looking back, so the castle stays behind the camera: the budget; nature tier LOW), then into
// the tower -> 5 on the tower the big black dog waits by the telescope (Sit_Wag): tap him: he trots over, a nod, hearts, a
// soft woof; tap again: a gold sparkle swirl and a kind stand-in for Sirius appears beside the dog's spot (chibi: long dark
// hair, a warm smile, a worn coat): "אני סיריוס, חבר של אבא שלך" -> 6 farewell: 🪽: Sirius becomes the dog again in a
// gold swirl, the dog sits on Buckbeak's back and they fly up out of the open tower into the starry sky; everyone waves.
// Reward: the chapter card + star, +25 house points once per save (q.bonus), the gold ⭐ on "ספר 3" when all six are done.
// The free-play Buckbeak and the free-play dog hand over synchronously when this quest's scene is created (never two), and
// come back by themselves after it ends. The flight is a quest takeover with safe aborts (an exception, a room change, a
// timeout: back on the lawn by the paddock, the step starts over).
// Debug: window.__game.adventures._ctx._save (knotW, bbW, dogW, siriusW, clock, jump, log, abort, throwOnce ...)
import { Vector3, Quaternion, AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import { loadAnimated } from './models.js';
import { BB, BB_SCALE, BOW, HOME, triCount } from './adventure-buckbeak-build.js';
import { buckbeakHandOver } from './adventure-buckbeak.js';
import { dogHandOver, loadDog, woof } from './dog-free.js';
import { getRewind } from './adventure-b3-timeturner-build.js';
import { POST, KNOT_Y, FSPEED, flightCurve, buildPost, buildRope, buildSirius, T_HARRY, T_DOG, T_BB, T_SIRIUS } from './adventure-b3-save-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const HERM_WHO = '👧 הרמיוני', HAG = '🧔 האגריד', SIR = '🖤 סיריוס';
const LATE = 60, FLY_TIMEOUT = 120, T_MOUNT = 1.2, T_OPEN = 1.5;
export const B3SAVE = {
  id: 'b3-save', book: 3, title: 'מצילים את אבזם וסיריוס', ico: '🦅', col: '#2a3a2a', col2: '#9ac8a0', helper: HERM, bonus: 25, confetti: ['✨', '⭐', '🦅', '🐾', '💛'],
  pic: [['🦅', 0.36, 0.56, 58], ['🐕', 0.72, 0.62, 44], ['⭐', 0.8, 0.26, 26]],
  intro: [
    'האגריד מודאג מאוד... רוצים לקחת את אבזם הלילה 😟',
    'אבל להרמיוני יש תוכנית, ויש לה גם מחזיר זמן ⏳',
    'נשחרר את אבזם, נטוס אל מגדל הכוכבים, ושם מחכה לנו חבר מיוחד מאוד 🐾✨',
  ],
  steps: [
    { line: 'לך אל המכלאה של האגריד 🐾', hints: ['האגריד מחכה ליד המכלאה, ליד הבקתה 🏡', 'לך אחרי החץ הזהוב', 'אפשר גם לטוס ברשת הפלו אל הבקתה 🔥'], glowL1: true },
    { line: 'שחרר את אבזם: גע בקשר או הטל לחש על הקשר 🪢', hints: ['החבל של אבזם קשור לעמוד. גע בקשר 🪢', 'אפשר גם אלוהומורה או דיפינדו על הקשר', 'הקשר על העמוד זוהר. גע בו, או לחץ ✂️'], spell: 'alohomora', glowL1: true },
    { line: 'קוד לאבזם ועלה על הגב שלו 🙇🪽', hints: ['קודם קידה: לחץ 🙇', 'אחרי שאבזם קד בחזרה, לחץ 🪽', 'הכפתור הזוהר מחכה לך 🪽'], glowL1: true },
    { line: 'טסים אל מגדל הכוכבים 🌙', hints: ['תחזיק חזק! אבזם יודע את הדרך 🌙', 'המגדל כבר קרוב', 'עוד רגע מגיעים ✨'] },
    { line: 'גע בכלב השחור הגדול 🐾', hints: ['כלב שחור וגדול מחכה ליד הטלסקופ 🐾', 'גע בו! הוא ידידותי מאוד', 'גע בכלב עוד פעם... משהו קסום יקרה ✨'], glowL1: true },
    { line: 'עזור להם לעוף אל החופש: לחץ 🪽', hints: ['סיריוס ואבזם מוכנים לעוף 🪽', 'לחץ על הכפתור 🪽', 'נופפים לשלום! 👋'] },
  ],
  create: (ctx) => { buckbeakHandOver(); dogHandOver(); return saveScene(ctx); },
  art: drawCard,
};

// the reward card: Buckbeak with the black dog on his back in a starry night sky over a tower
function drawCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  const g = x.createLinearGradient(0, cy - 150, 0, cy + 140); g.addColorStop(0, '#1e2a5a'); g.addColorStop(1, '#5a4a7a'); x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.fillStyle = '#fff4c8'; for (const [a, b, r] of [[-90, -120, 2.5], [-40, -100, 2], [30, -128, 2.5], [86, -96, 2], [60, -60, 1.6], [-70, -60, 1.6], [0, -80, 2]]) { x.beginPath(); x.arc(cx + a, cy + b, r, 0, 7); x.fill(); }
  x.fillStyle = '#3a3248'; x.fillRect(cx - 110, cy + 70, 46, 70); x.beginPath(); x.moveTo(cx - 118, cy + 70); x.lineTo(cx - 87, cy + 30); x.lineTo(cx - 56, cy + 70); x.fill();
  x.save(); x.translate(cx + 8, cy - 4);
  for (const s of [-1, 1]) { x.fillStyle = '#9a9a9e'; x.beginPath(); x.moveTo(s * 10, -10); x.quadraticCurveTo(s * 66, -76, s * 104, -44); x.quadraticCurveTo(s * 70, -26, s * 20, 10); x.closePath(); x.fill(); }
  E(0, 18, 46, 24, '#a4a4a8'); E(-34, -6, 15, 26, '#b8b8bc', -0.5); E(-50, -28, 16, 14, '#c4c4c8');
  x.fillStyle = '#e8b040'; x.beginPath(); x.moveTo(-62, -32); x.lineTo(-80, -25); x.lineTo(-62, -22); x.closePath(); x.fill();
  E(8, -10, 18, 14, '#1c1a1e'); E(-6, -24, 11, 10, '#1c1a1e'); E(-14, -22, 6, 4, '#2a2628'); E(-8, -27, 2, 2, '#f0d890');
  x.restore();
  x.save(); x.font = '26px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('💛', cx + 84, cy + 100); x.fillText('✨', cx - 20, cy + 104); x.restore();
}

function saveScene(ctx) {
  const { interiors, player, fun, freecast, camera, scene } = ctx;
  const RW = getRewind({ scene, camera, player, fun, emit: ctx.emit });
  const S = { active: false, ended: false, done: {}, t: 0, bb: null, bmix: null, bacts: {}, bcur: null, bones: {}, bLoading: false, bFailed: false, bTris: 0,
    dog: null, dLoading: false, dFailed: false, dcur: null, sirius: null, siriusOn: 0, sirFade: 0,
    post: null, rope: null, untied: false, untieT: 0, arrive: 0, said: {}, act: null, bowT: 0, bowed: false, stepClock: 0, late: 0,
    ph: 'ground', phT: 0, curve: null, L: 0, s: 0, yaw: BB.yaw, pitch: 0, bank: 0, tk: null, flyT: 0, ft: 0, clk: 1, camP: new Vector3(), camL: new Vector3(), camInit: false, from: new Vector3(),
    aborts: 0, lastAbort: null, maxTri: 0, maxDc: 0, log: null, fade: 0, fadeTo: 0, inTower: false, prevTier: null, prevQ: null, boom: false,
    dogMode: 'sit', dogX: T_DOG.x, dogZ: T_DOG.z, dogYaw: T_DOG.yaw, dogTaps: 0, nod: 0, swirl: 0, fare: 0, fareOn: false, glowHint: false, castHit: false, casts0: 0, spellSays: 0, onRider: false, ftk: null };
  const lv = () => ctx.level;
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const outdoors = () => !interiors.active;
  const inTower = () => interiors.active === 'tower' && interiors.room && interiors.room.group;
  const groundAt = (x, z) => (player.heightAt ? player.heightAt(x, z) : 0);
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3(), q1 = new Quaternion(), qa = new Quaternion(), qi = new Quaternion(), ax = new Vector3(), up = new Vector3(0, 1, 0);
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

  // ---------------- DOM: the round action button (🙇 / 🪽) + the fade veil ----------------
  const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";
  const css = document.createElement('style'); css.id = 'b3sCss';
  css.textContent = `#b3sAct{position:fixed;left:50%;top:calc(98px + env(safe-area-inset-top));width:120px;height:120px;margin-left:-60px;z-index:14;display:none;border-radius:50%;border:5px solid #fff;padding:0;
    background:radial-gradient(circle at 50% 35%,#ffe48a,#ffb020);box-shadow:0 0 26px rgba(255,210,90,.9);cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none}
  #b3sAct.on{display:flex;flex-direction:column;align-items:center;justify-content:center} #b3sAct i{font-style:normal;font-size:46px;line-height:1} #b3sAct span{font:bold 19px ${FONT};color:#5a2a00;direction:rtl}
  #b3sAct.pulse{animation:b3sPulse 1s ease-in-out infinite} #b3sAct:active{transform:scale(.93)}
  @keyframes b3sPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,230,120,0)}50%{box-shadow:0 0 0 12px rgba(255,230,120,.8),0 0 36px rgba(255,220,100,.95)}}
  body.modalOn #b3sAct,body.inSpell #b3sAct,body.inMatch #b3sAct,body.inFloo #b3sAct{display:none !important}
  body:has(#advTogether.on) #b3sAct{top:calc(186px + env(safe-area-inset-top))}
  #b3sVeil{position:fixed;inset:0;z-index:12;pointer-events:none;opacity:0;background:radial-gradient(circle,#fff6d8,#e8c070);transition:none}
  body.b3sFly .gamebtn,body.b3sFly #camctl,body.b3sFly #fcBtn,body.b3sFly #wandBtn,body.b3sFly #bellBtn,body.b3sFly #enterBtn,body.b3sFly #joy,body.b3sFly #joyKnob,body.b3sFly #funPrompt,body.b3sFly #fcWheel{display:none !important}
  @media (max-width:700px){#b3sAct,body:has(#advTogether.on) #b3sAct{top:auto;bottom:calc(330px + env(safe-area-inset-bottom));width:108px;height:108px;margin-left:-54px} #b3sAct i{font-size:40px} #b3sAct span{font-size:17px}}`;
  document.head.appendChild(css);
  const act = document.createElement('button'); act.id = 'b3sAct'; act.innerHTML = '<i></i><span></span>';
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) act.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  act.addEventListener('click', (e) => { e.stopPropagation(); press(); });
  document.body.appendChild(act);
  const veil = document.createElement('div'); veil.id = 'b3sVeil'; document.body.appendChild(veil);
  function showAct(kind, pulse = true) {
    if (kind !== S.act) { S.act = kind; act.classList.toggle('on', !!kind);
      if (kind) { const L = { bow: ['🙇', 'קידה'], fly: ['🪽', 'לעלות'], free: ['🪽', 'לחופש!'] }[kind]; act.querySelector('i').textContent = L[0]; act.querySelector('span').textContent = L[1]; act.setAttribute('aria-label', L[1]); } }
    act.classList.toggle('pulse', !!kind && pulse);
  }

  // ---------------- Buckbeak (the live GLB, the quest's own copy) ----------------
  function ensureBB() {
    if (S.bb || S.bLoading || S.bFailed) return;
    S.bLoading = true;
    loadAnimated('buckbeak', () => S.active && !S.ended).then((r) => {
      S.bLoading = false;
      if (!S.active || S.ended) return;
      if (!r || !r.clips || !r.clips.find(c => c.name === 'Idle')) { S.bFailed = true; return; }
      const o = r.obj; o.name = 'b3save-buckbeak'; o.scale.setScalar(BB_SCALE);
      o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = false; m.raycast = () => {}; m.userData.sharedGeo = true; } if (m.isBone) S.bones[m.name] = m; });
      const mixer = new AnimationMixer(o), acts = {};
      for (const c of r.clips) acts[c.name] = mixer.clipAction(c);
      for (const n of ['Bow', 'Nuzzle', 'WingsOpen']) if (acts[n]) { acts[n].setLoop(LoopOnce, 1); acts[n].clampWhenFinished = true; }
      for (const n of ['Idle', 'Fly', 'Walk']) if (acts[n]) acts[n].setLoop(LoopRepeat, Infinity);
      mixer.addEventListener('finished', (e) => { if ((e.action === acts.Bow || e.action === acts.Nuzzle) && S.ph === 'ground') bplay('Idle', 0.5); });
      S.bb = o; S.bmix = mixer; S.bacts = acts; S.bcur = null; bplay('Idle', 0); S.bTris = triCount(o);
      placeBB();
    }).catch(() => { S.bLoading = false; S.bFailed = true; });
  }
  function bplay(name, fade = 0.35) { const a = S.bacts[name]; if (!a || S.bcur === name) return; const prev = S.bcur ? S.bacts[S.bcur] : null; a.reset(); a.setEffectiveWeight(1); a.play(); if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop(); S.bcur = name; }
  const breplay = (n, f = 0.3) => { if (S.bcur === n) S.bcur = 'Idle'; bplay(n, f); };
  // where he belongs for the current step: by the paddock (outdoors) or in the tower (room-local, in the room group)
  function placeBB() {
    if (!S.bb || S.tk || S.fareOn) return;
    if (inTower() && ctx.step >= 4) {
      const g = interiors.room.group; if (S.bb.parent !== g) { if (S.bb.parent) S.bb.parent.remove(S.bb); g.add(S.bb); }
      S.bb.traverse(m => { if (m.isMesh) m.castShadow = false; });
      S.bb.position.set(T_BB.x, 0, T_BB.z); S.bb.rotation.set(0, T_BB.yaw, 0); S.yaw = T_BB.yaw; S.bb.visible = true; return;
    }
    if (S.bb.parent !== scene) { if (S.bb.parent) S.bb.parent.remove(S.bb); scene.add(S.bb); S.bb.traverse(m => { if (m.isMesh) m.castShadow = true; }); }
    const yaw = BB.yaw, fx = Math.sin(yaw) * 0.9 * BB_SCALE, fz = Math.cos(yaw) * 0.9 * BB_SCALE, yf = groundAt(BB.x + fx, BB.z + fz), yb = groundAt(BB.x - fx, BB.z - fz);
    S.bb.position.set(BB.x, Math.min(yf, yb) + Math.abs(yf - yb) * 0.5 - 0.02, BB.z); S.bb.rotation.set(0, yaw, 0); S.yaw = yaw;
  }
  const headW = (out) => { const h = S.bones.head; if (h) { h.getWorldPosition(out); return out; } return out.set(BB.x - 1.2 * BB_SCALE, groundAt(BB.x, BB.z) + 2 * BB_SCALE, BB.z); };
  function seatW(out) {
    const a = S.bones.wing_l_01, b = S.bones.wing_r_01;
    if (a && b) { a.getWorldPosition(v2); b.getWorldPosition(v3); out.copy(v2).add(v3).multiplyScalar(0.5); } else out.set(0, 1.5, 0).applyMatrix4(S.bb.matrixWorld);
    out.x += Math.sin(S.yaw) * -0.42 * BB_SCALE; out.z += Math.cos(S.yaw) * -0.42 * BB_SCALE; out.y += 0.22 * BB_SCALE; return out;
  }

  // ---------------- the post, the knot, the rope (outdoors, steps 1-2 only) ----------------
  function propsTick(step) {
    const want = S.active && outdoors() && step <= 2;
    if (want && !S.post) { S.post = buildPost(); S.post.position.set(POST.x, groundAt(POST.x, POST.z), POST.z); scene.add(S.post); S.rope = buildRope(); scene.add(S.rope); }
    else if (!want && S.post) dropProps();
    if (S.rope) {
      const show = !S.untied && !!S.bb && step <= 1;
      S.rope.visible = show;
      if (show) { knotW(v1); S.bb.updateMatrixWorld(true); headW(v2); v2.y -= 0.55; v3.subVectors(v2, v1); const L = v3.length(); S.rope.position.copy(v1); q1.setFromUnitVectors(up, v3.normalize()); S.rope.quaternion.copy(q1); S.rope.scale.set(1, L, 1); }
    }
  }
  function dropProps() { for (const o of [S.post, S.rope]) if (o) { if (o.parent) o.parent.remove(o); try { o.geometry.dispose(); } catch { /* ok */ } } S.post = null; S.rope = null; }
  const knotW = (out) => out.set(POST.x, groundAt(POST.x, POST.z) + KNOT_Y, POST.z);
  // the wheel target on the knot (Alohomora / Diffindo): never on Buckbeak
  const T = [];
  if (FI && Array.isArray(FI.TARGETS)) {
    T.push({ id: 'b3save-knot', spells: ['alohomora', 'diffindo'], at: (o) => knotW(o), ok: () => S.active && ctx.step === 1 && !S.untied && outdoors(), cast: () => { S.castHit = true; untie('spell'); } });
    for (const t of T) FI.TARGETS.push(t);
  }
  function untie(how) {
    if (S.untied || ctx.step !== 1) return;
    S.untied = true; S.untieT = 0.001; S.untieHow = how; ctx.poke(); sfx('pop'); setTimeout(() => sfx('sparkle'), 150);
    knotW(v1); ctx.burst(v1.x, v1.y, v1.z, 0xffd76a, 24, 2.2, 0.9, 0.24, -0.8);
    if (S.bb) breplay('Nuzzle', 0.25);
    ctx.say('החבל נפתח! אבזם חופשי 🦅💛', HAG, 3.2);
    setTimeout(() => done(1), 1700);
  }

  // ---------------- the dog + Sirius (tower) ----------------
  function ensureDog() {
    if (S.dog || S.dLoading || S.dFailed) return;
    S.dLoading = true;
    loadDog('b3save-blackdog', () => S.active && !S.ended).then((r) => {
      S.dLoading = false;
      if (!S.active || S.ended) return;
      if (!r) { S.dFailed = true; return; }
      r.obj.traverse(m => { if (m.isMesh) { m.castShadow = false; m.userData.sharedGeo = true; } });
      S.dog = r; S.dcur = null; dplay('Sit_Wag', 0);
    }).catch(() => { S.dLoading = false; S.dFailed = true; });
  }
  function dplay(name, fade = 0.35, ts = 1) { const d = S.dog; if (!d) return; const a = d.acts[name]; if (!a) return; a.timeScale = ts; if (S.dcur === name) return; const prev = S.dcur ? d.acts[S.dcur] : null; a.reset(); a.setEffectiveWeight(1); a.play(); if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop(); S.dcur = name; }
  function dogTick(dt, step) {
    const want = S.active && inTower() && step >= 4;
    if (!want) { if (S.dog && S.dog.obj.parent && !S.onRider) S.dog.obj.parent.remove(S.dog.obj); if (S.sirius && S.sirius.parent) S.sirius.parent.remove(S.sirius); return; }
    ensureDog(); if (!S.dog) return;
    const g = interiors.room.group, o = S.dog.obj;
    if (!S.onRider) {
      if (o.parent !== g) { if (o.parent) o.parent.remove(o); g.add(o); }
      const gp = g.position;
      if (S.dogMode === 'come') {   // trot to Harry and sit before him
        const a = Math.atan2(S.dogX - (player.pos.x - gp.x), S.dogZ - (player.pos.z - gp.z)), tx = player.pos.x - gp.x + Math.sin(a) * 1.6, tz = player.pos.z - gp.z + Math.cos(a) * 1.6;
        const dx = tx - S.dogX, dz = tz - S.dogZ, d = Math.hypot(dx, dz);
        if (d < 0.2) { S.dogMode = 'by'; woof(fun, 1); S.nod = 1; hearts(); }
        else { const s = Math.min(d, 1.8 * dt); S.dogX += dx / d * s; S.dogZ += dz / d * s; S.dogYaw = Math.atan2(dx, dz); dplay('Run', 0.3, 0.55); }
      } else { dplay('Sit_Wag', 0.4); if (S.dogMode === 'by') { const ty = Math.atan2(player.pos.x - gp.x - S.dogX, player.pos.z - gp.z - S.dogZ); S.dogYaw = wrapA(S.dogYaw + wrapA(ty - S.dogYaw) * Math.min(1, dt * 4)); } }
      o.position.set(S.dogX, 0, S.dogZ); o.rotation.set(0, S.dogYaw, 0); o.visible = true;
    }
    try { S.dog.mixer.update(dt); } catch { /* ok */ }
    if (S.nod > 0) { S.nod -= dt; const h = S.dog.bones.head; if (h && h.parent) { const k = Math.sin(Math.max(0, S.nod) * Math.PI * 2) * 0.28; ax.set(Math.cos(S.dogYaw), 0, -Math.sin(S.dogYaw)); h.parent.updateWorldMatrix(true, false); h.parent.getWorldQuaternion(q1); qa.setFromAxisAngle(ax, k); qi.copy(q1).invert(); qa.premultiply(qi).multiply(q1); h.quaternion.premultiply(qa); h.updateMatrixWorld(true); } }
    // Sirius: appears in a gold swirl (step 5), stays for the farewell, turns back into the dog
    if (S.siriusOn) {
      if (!S.sirius) S.sirius = buildSirius();
      if (S.sirius.parent !== g) { if (S.sirius.parent) S.sirius.parent.remove(S.sirius); g.add(S.sirius); }
      S.sirFade = Math.min(1, S.sirFade + dt * 1.4);
      const k = S.siriusOn === 2 ? 1 - S.sirFade : S.sirFade;
      S.sirius.visible = k > 0.02; S.sirius.scale.setScalar(1.12 * Math.max(0.02, ease(k)));
      S.sirius.position.set(T_SIRIUS.x, 0, T_SIRIUS.z); S.sirius.rotation.y = Math.atan2(player.pos.x - g.position.x - T_SIRIUS.x, player.pos.z - g.position.z - T_SIRIUS.z);
      const arm = S.sirius.userData.arm; if (arm) arm.rotation.z = S.waveSir > 0 ? 2.4 + Math.sin(S.t * 9) * 0.35 : 0.08;
      if (S.waveSir > 0) S.waveSir -= dt;
      if (S.siriusOn === 2 && S.sirFade >= 1) { S.siriusOn = 0; S.sirius.visible = false; }
    }
    if (S.swirl > 0) { S.swirl -= dt; const c = S.swirlAt; for (let i = 0; i < 3; i++) { const a = S.t * 7 + i * 2.1, r = 0.4 + S.swirl * 0.5; ctx.emit(c.x + Math.cos(a) * r, c.y + 0.2 + (1.6 - S.swirl) * 1.0 + i * 0.2, c.z + Math.sin(a) * r, -Math.sin(a) * 1.2, 0.6, Math.cos(a) * 1.2, 0.8, 0.24, i ? 0xffd76a : 0xfff4c8, 0); } }
  }
  function hearts() { dogW(v1); for (let i = 0; i < 12; i++) ctx.emit(v1.x + (Math.random() - 0.5) * 0.5, v1.y + 0.3 + Math.random() * 0.3, v1.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6, 1.3, 0.24, Math.random() < 0.5 ? 0xff7aa8 : 0xffb0cc, 0.1); }
  function dogW(out) { if (S.dog && S.dog.bones.head && S.dog.obj.parent) { S.dog.bones.head.getWorldPosition(out); return out; } const gp = interiors.room ? interiors.room.group.position : v3.set(0, 0, 0); return out.set(gp.x + S.dogX, gp.y + 1.0, gp.z + S.dogZ); }
  function siriusW(out) { if (!S.sirius || !S.sirius.parent) return null; S.sirius.getWorldPosition(out); out.y += 1.4; return out; }
  function swirl(x, y, z, kind) { S.swirl = 1.6; S.swirlKind = kind; S.swirlAt = { x, y, z }; sfx('sparkle'); setTimeout(() => sfx('chime'), 300); }
  function tapDogTower() {
    if (ctx.step !== 4 || !S.dog) return false;
    ctx.poke(); S.dogTaps++;
    if (S.dogTaps === 1) { S.dogMode = 'come'; woof(fun, 2); hearts(); ctx.say('הכלב השחור הגדול שמח לראות אותך! 🐾 גע בו עוד פעם...', HERM_WHO, 3.5); return true; }
    if (S.siriusOn) return true;
    const gp = interiors.room.group.position; swirl(gp.x + T_SIRIUS.x, gp.y, gp.z + T_SIRIUS.z, 'in');
    S.dogMode = 'by'; S.nod = 1; woof(fun, 1);
    setTimeout(() => { if (!S.active) return; S.siriusOn = 1; S.sirFade = 0; S.waveSir = 2.5; sfx('heart'); ctx.say('אני סיריוס, חבר של אבא שלך 😊 חיכיתי לך כאן למעלה', SIR, 5); }, 900);
    setTimeout(() => done(4), 5200);
    return true;
  }

  // ---------------- the bow (Harry leans: his spine bones, after his mixer) ----------------
  let spine = null;
  function leanHarry(k) {
    if (k <= 0.001) return;
    if (!spine) { spine = []; try { player.model.traverse(o => { if (o.isBone && /spine/i.test(o.name)) spine.push(o); }); } catch { /* ok */ } spine = spine.slice(0, 3); }
    const y = player.model.rotation.y; ax.set(Math.cos(y), 0, -Math.sin(y));
    for (const b of spine) { if (!b.parent) continue; b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(q1); qa.setFromAxisAngle(ax, 0.24 * k); qi.copy(q1).invert(); qa.premultiply(qi).multiply(q1); b.quaternion.premultiply(qa); b.updateMatrixWorld(true); }
  }
  function faceBB() { if (!S.bb) return; player.yaw = Math.atan2(S.bb.position.x - player.pos.x, S.bb.position.z - player.pos.z); }
  function press() {
    ctx.poke();
    if (S.act === 'bow') { if (ctx.step !== 2 || S.bowT > 0 || S.bowed) return; S.bowT = 0.001; faceBB(); sfx('soft'); ctx.say('קידה יפה... מחכים שאבזם יקוד בחזרה 🙇', HAG, 2.6); }
    else if (S.act === 'fly') { if (ctx.step === 2) { done(2); } else if (ctx.step === 3) startFlight(); }
    else if (S.act === 'free') farewell();
  }

  // ---------------- the flight (a quest takeover) ----------------
  const tk = { adv: true, spell: true, update: (dt) => { try { sim(dt); } catch (e) { console.warn('[b3-save] flight failed -', e && e.message || e); abort('error'); } } };
  const qTier = () => { try { return window.__game.stats().tier; } catch { return null; } };
  function lowTier(on) {
    const nat = window.__game && window.__game.nature;
    try {
      if (on) { if (S.prevTier === null && nat) { S.prevTier = nat.stats().tier; S.prevQ = qTier(); nat.setTier('low'); } }
      else { if (S.prevTier !== null && nat && nat.stats().tier === 'low' && qTier() === S.prevQ) nat.setTier(S.prevTier); S.prevTier = null; }
    } catch (e) { console.warn('[b3-save] tier -', e && e.message || e); }
  }
  function startFlight() {
    if (ctx.step !== 3 || S.tk || !S.bb || !outdoors()) return false;
    showAct(null); placeBB();
    S.curve = flightCurve(groundAt); S.L = S.curve.getLength(); S.s = 0; S.ph = 'mount'; S.phT = 0; S.flyT = 0; S.camInit = false; S.bank = 0; S.fadeTo = 0; S.fade = 0;
    S.from.copy(player.pos); lowTier(true);
    player.ride(true); player._moving = false;
    S.tk = tk; ctx.setTakeover(tk); document.body.classList.add('b3sFly');
    sfx('pop'); ctx.say('תחזיק חזק! טסים אל מגדל הכוכבים! 🌙', HERM_WHO, 3);
    return true;
  }
  function release(put) {
    const had = !!S.tk;
    if (S.tk) { S.tk = null; try { if (window.__game && window.__game.takeover === tk) ctx.setTakeover(null); } catch { ctx.setTakeover(null); } }
    document.body.classList.remove('b3sFly'); lowTier(false);
    try { player.ride(false); } catch { /* ok */ }
    player.model.rotation.set(0, 0, 0); player.model.visible = true;
    veil.style.opacity = '0';
    if (put && had) { player.yaw = Math.atan2(BB.x - HOME.x, BB.z - HOME.z); player.teleport(HOME.x, HOME.z); }
    return had;
  }
  function abort(why) {
    if (!S.tk) return;
    S.aborts++; S.lastAbort = why;
    if (interiors.active) { try { interiors.exit(); } catch { /* ok */ } }
    release(true); S.ph = 'ground'; placeBB(); bplay('Idle', 0.3);
    if (!S.ended) ctx.say('אבזם נחת לנוח רגע ליד המכלאה. אפשר לטוס שוב! 🪽', HAG, 4);
  }
  function sim(dt) {
    if (!S.tk) return;
    dt *= S.clk;
    if (S.boom) { S.boom = false; throw new Error('test: a forced flight error'); }
    if (!outdoors()) { abort('room'); return; }
    if (!S.bb || !S.bb.parent) { abort('model'); return; }
    S.flyT += dt; if (S.flyT > FLY_TIMEOUT) { abort('timeout'); return; }
    const frozen = ctx.isModal();
    if (!frozen) {
      S.phT += dt;
      if (S.ph === 'mount' && S.phT >= T_MOUNT) { S.ph = 'open'; S.phT = 0; breplay('WingsOpen', 0.3); sfx('whoosh'); }
      else if (S.ph === 'open' && S.phT >= T_OPEN) { S.ph = 'fly'; S.phT = 0; bplay('Fly', 0.35); sfx('whoosh'); }
      else if (S.ph === 'fly') flyStep(dt);
      try { player.animate(dt, { moving: false }); } catch { /* ok */ }
      ctx.poke();
      S.ft += dt;
    }
    seatHarry();
    camStep(frozen ? 0 : dt);
    // the fade into the tower
    if (S.fadeTo > 0) { S.fade = Math.min(1, S.fade + dt / 0.7); veil.style.opacity = S.fade.toFixed(2); if (S.fade >= 1) arrive(); }
    Promise.resolve().then(measure);
  }
  function flyStep(dt) {
    const k0 = ease(S.phT / 2.5), kEnd = ease((S.L - S.s) / 12);
    S.s = Math.min(S.L, S.s + FSPEED * (0.35 + 0.65 * k0) * (0.45 + 0.55 * kEnd) * dt);
    const u = S.s / S.L; S.curve.getPointAt(u, v1); S.curve.getTangentAt(Math.min(1, u), v2);
    const hl = Math.hypot(v2.x, v2.z) || 1, yaw = Math.atan2(v2.x / hl, v2.z / hl), dyaw = wrapA(yaw - S.yaw);
    S.yaw = wrapA(S.yaw + dyaw * Math.min(1, dt * 4)); const turn = dyaw / Math.max(dt, 1e-3);
    S.bank += (Math.max(-0.3, Math.min(0.3, -turn * 0.25)) - S.bank) * Math.min(1, dt * 2.5);
    S.pitch = Math.max(-0.12, Math.min(0.22, Math.atan2(v2.y, hl) * 0.8));
    S.bb.position.set(v1.x, v1.y + Math.sin(S.t * 5) * 0.06, v1.z); S.bb.rotation.set(-S.pitch, S.yaw, S.bank, 'YXZ');
    if (!S.said.mid && u > 0.45) { S.said.mid = 1; ctx.say('רואה את המגדל? שם מחכה לנו חבר 🌙✨', HERM_WHO, 3); }
    S.flapT = (S.flapT || 0) - dt; if (S.flapT <= 0) { S.flapT = 1.21; tone(140, 0.25, 0, 'sine', 0.03, 90); }
    if (u >= 0.96 && !S.fadeTo) { S.fadeTo = 1; sfx('sparkle'); }
  }
  function seatHarry() {
    S.bb.updateMatrixWorld(true); seatW(v1);
    if (S.ph === 'mount') { const k = ease(S.phT / T_MOUNT); v1.y -= 0.73; v2.copy(S.from).lerp(v1, k); v2.y += Math.sin(k * Math.PI) * 1.2; player.model.position.copy(v2); }
    else player.model.position.set(v1.x, v1.y - 0.73, v1.z);
    player.model.rotation.set(-S.pitch || 0, S.yaw, 0, 'YXZ'); player.model.rotation.z = S.bank * 0.8;
    player.pos.copy(player.model.position);
  }
  // the lens flies AHEAD of him and looks back at his face (the castle stays behind the camera); a side view while mounting
  function camStep(dt) {
    const narrow = innerWidth / Math.max(1, innerHeight) < 1, p = S.bb.position, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    let px, py, pz;
    if (S.ph === 'mount' || S.ph === 'open') { const d = (narrow ? 11 : 8.5) * BB_SCALE, sa = S.yaw + 0.8; px = p.x + Math.sin(sa) * d; pz = p.z + Math.cos(sa) * d; py = p.y + 2.6 * BB_SCALE; }
    else { const d = (narrow ? 11.5 : 8.5) * BB_SCALE, side = 2.6; px = p.x + fx * d + fz * side; pz = p.z + fz * d - fx * side; py = p.y + (narrow ? 2.2 : 1.6) * BB_SCALE; }
    py = Math.max(py, groundAt(px, pz) + 1.4);
    v1.set(px, py, pz); v2.set(p.x, p.y + 1.3 * BB_SCALE + (narrow ? -0.6 : 0), p.z);
    if (!S.camInit) { S.camP.copy(v1); S.camL.copy(v2); S.camInit = true; }
    const k = Math.min(1, dt * 3); S.camP.lerp(v1, k); S.camL.lerp(v2, k);
    camera.position.copy(S.camP); camera.lookAt(S.camL); camera.updateMatrixWorld();
  }
  function measure() {
    try { const r = window.__game && window.__game.renderer; const inf = r && r.info && r.info.render; if (inf && S.tk) { const t = inf.triangles | 0, d = inf.drawCalls !== undefined ? inf.drawCalls | 0 : inf.calls | 0; if (t > S.maxTri) S.maxTri = t; if (d > S.maxDc) S.maxDc = d;
      if (S.log && S.log.length < 4000) { const c = camera.position; S.log.push([+S.ft.toFixed(2), S.ph, +S.s.toFixed(1), t, d, +c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)]); } } } catch { /* ok */ }
  }
  function arrive() {
    release(false); S.ph = 'ground'; S.inTowerArr = true;
    bplay('Idle', 0.3);
    interiors.enter('tower', T_HARRY);
    soon(() => inTower(), () => { placeBB(); veil.style.opacity = '0'; done(3); });
  }
  function soon(test, fn, n = 0) { if (test()) { try { fn(); } catch (e) { console.warn('[b3-save]', e && e.message || e); } return; } if (n < 80 && S.active) setTimeout(() => soon(test, fn, n + 1), 150); }

  // ---------------- the farewell (tower): a short cinematic lens looking up at the starry sky ----------------
  const ftk = { adv: true, update: (dt) => { try { fareStep(dt); } catch (e) { console.warn('[b3-save] farewell -', e && e.message || e); fareEnd(); } } };
  function farewell() {
    if (ctx.step !== 5 || S.fareOn || !inTower() || !S.bb || !S.dog) return false;
    showAct(null); S.fareOn = true; S.fare = 0; ctx.poke();
    S.waveSir = 1.8; ctx.say('תודה, הארי! נתראה בקרוב 💛', SIR, 3);
    S.ftk = ftk; ctx.setTakeover(ftk);
    return true;
  }
  function fareStep(dt) {
    const g = interiors.room && interiors.room.group; if (!g || !inTower()) { fareEnd(); return; }
    const t0 = S.fare; S.fare += dt;
    const gp = g.position;
    if (t0 < 1.8 && S.fare >= 1.8) { swirl(gp.x + T_SIRIUS.x, gp.y, gp.z + T_SIRIUS.z, 'back'); S.siriusOn = 2; S.sirFade = 0; }
    if (t0 < 2.8 && S.fare >= 2.8) { S.onRider = true; dplay('Sit_Wag', 0.3); sfx('boing'); breplay('WingsOpen', 0.3); }
    if (t0 < 4.2 && S.fare >= 4.2) { bplay('Fly', 0.4); try { player.play('Wave'); } catch { /* ok */ } ctx.say('הם חופשיים! להתראות, סיריוס! להתראות, אבזם! 👋💛', HERM_WHO, 5); sfx('fanfare'); }
    // Buckbeak rises out of the open tower toward the stars, the dog sitting on his back
    if (S.fare > 4.2) { const k = Math.min(1, (S.fare - 4.2) / 6); S.bb.position.set(T_BB.x + k * 4, ease(k) * 16 + Math.sin(S.t * 5) * 0.08, T_BB.z - k * 10); S.bb.rotation.set(-0.15, T_BB.yaw - 0.6 * k, 0, 'YXZ'); S.yaw = T_BB.yaw - 0.6 * k;
      if (Math.random() < dt * 20) { S.bb.getWorldPosition(v1); ctx.emit(v1.x, v1.y + 1, v1.z, 0, -0.3, 0, 1.2, 0.26, 0xfff4c8, 0); } }
    if (S.onRider && S.dog) { const o = S.dog.obj; if (o.parent !== g) { if (o.parent) o.parent.remove(o); g.add(o); } S.bb.updateMatrixWorld(true); seatW(v1); g.worldToLocal(v1); o.position.set(v1.x, v1.y - 0.35, v1.z); o.rotation.set(0, S.yaw, 0); }
    // the lens: from the south end of the room, low, looking up past them into the sky
    v1.set(gp.x + 0.6, gp.y + 2.2, gp.z + 6.2); S.bb.getWorldPosition(v2); v2.y += 1.2;
    v3.set(gp.x - 1.5, gp.y + 6 + S.fare * 0.6, gp.z - 3).lerp(v2, 0.6);
    camera.position.copy(v1); camera.lookAt(v3); camera.updateMatrixWorld();
    if (S.fare > 10.8) { fareEnd(); done(5); }
  }
  function fareEnd() { if (S.ftk) { S.ftk = null; try { if (window.__game && window.__game.takeover === ftk) ctx.setTakeover(null); } catch { ctx.setTakeover(null); } } }

  // ---------------- per frame ----------------
  function update(dt, step, busy) {
    S.t += dt;
    if (!S.active) return;
    ensureBB(); propsTick(step);
    if (!busy || RW.on) RW.update(dt);
    if (S.bb && S.bmix) { try { S.bmix.update(dt); } catch { /* ok */ } }
    // visibility: a distance rule outdoors (70 m, as the Buckbeak quest), always in the tower; no frustum test
    if (S.bb && !S.tk && !S.fareOn) {
      if (outdoors()) { if (step <= 3) { if (S.bb.parent !== scene) placeBB(); const d = Math.min(Math.hypot(player.pos.x - BB.x, player.pos.z - BB.z), Math.hypot(camera.position.x - BB.x, camera.position.z - BB.z)); S.bb.visible = d < 70; } else S.bb.visible = false; }
      else if (inTower() && step >= 4) { if (S.bb.parent !== interiors.room.group) placeBB(); S.bb.visible = true; }
      else if (S.bb.parent === scene) S.bb.visible = false;
    }
    if (S.tk && !outdoors()) abort('room');
    dogTick(dt, step);
    // a spell near Buckbeak / the dog / Sirius: a kind word (only the knot takes a spell)
    const n = casts();
    if (n !== S.casts0) { S.casts0 = n; if (S.castHit) S.castHit = false; else if ((outdoors() && S.bb && Math.hypot(player.pos.x - BB.x, player.pos.z - BB.z) < 18) || inTower()) { S.spellSays++; ctx.say(inTower() ? 'לא מטילים לחשים על חברים 🙂 מלטפים את הכלב!' : 'לא מטילים לחשים על אבזם 🙂 רק על הקשר!', HERM_WHO, 3); } }
    if (busy || S.tk || S.fareOn) { if (S.tk || S.fareOn) showAct(null); return; }
    const p = player.pos, dBB = outdoors() ? Math.hypot(p.x - BB.x, p.z - BB.z) : 1e9;
    // 1: Hagrid's worried bubble, then Hermione's plan (urgency only in words: "הם בדרך")
    if (step === 0) {
      showAct(null);
      if (outdoors() && dBB < 16) { S.arrive += dt;
        if (S.arrive > 0.8 && !S.said.hag) { S.said.hag = 1; ctx.say('הם רוצים לקחת את אבזם הלילה... 😟 הם בדרך.', HAG, 4.2); sfx('soft'); }
        if (S.arrive > 4.6 && !S.said.plan) { S.said.plan = 1; ctx.say('אל דאגה, האגריד! יש לי תוכנית! ⏳', HERM_WHO, 3.4); }
        if (S.arrive > 7.2) done(0); }
      return;
    }
    // 2: the knot (a tap, a spell, or the ✂️ prompt)
    if (step === 1) {
      showAct(null);
      if (S.untieT > 0) return;
      S.stepClock += dt;
      if (outdoors() && (lv() === 1 || S.stepClock > 8) && Math.hypot(p.x - POST.x, p.z - POST.z) < 9) { try { fun.offer('adv-knot', '✂️', 0.05, () => untie('prompt')); } catch { /* ok */ } }
      if ((lv() === 1 || S.glowHint) && Math.random() < dt * 6) { knotW(v1); ctx.emit(v1.x + (Math.random() - 0.5) * 0.4, v1.y + (Math.random() - 0.5) * 0.3, v1.z + (Math.random() - 0.5) * 0.4, 0, 0.3, 0, 0.7, 0.2, 0xffe07a, 0); }
      return;
    }
    // 3: the bow, then 🪽; a long wait: Hermione's Time-Turner (a sepia rewind; the step just continues)
    if (step === 2) {
      if (!outdoors() || !S.bb) { showAct(null); return; }
      S.stepClock += dt;
      if (S.stepClock > LATE && !RW.on) { S.stepClock = 0; S.late++; RW.start({ secs: 2.5, sepiaOnly: true, onEnd: () => { ctx.say('הנה, החזרנו קצת זמן. עכשיו יש לנו מספיק! 🪽', HERM_WHO, 3.5); } }); ctx.say('יש לי רעיון! ⏳', HERM_WHO, 2.5); if (!S.bowed) { S.bowed = true; } }
      if (S.bowT > 0) {
        const t0 = S.bowT; S.bowT += dt;
        leanHarry(S.bowT < 1.3 ? Math.min(1, S.bowT * 3) : Math.max(0, 1 - (S.bowT - 1.3)));
        if (t0 < 1.3 && S.bowT >= 1.3) { breplay('Bow', 0.35); sfx('chime'); ctx.say('הוא קד בחזרה! 🦅 עכשיו אפשר לעלות', HAG, 3); }
        if (S.bowT >= 3.4) { S.bowT = 0; S.bowed = true; }
        showAct(null); return;
      }
      showAct(dBB < 9 ? (S.bowed ? 'fly' : 'bow') : null, lv() === 1 || S.glowHint || S.bowed);
      return;
    }
    // 4: on the ground before the flight (a resume / an abort): 🪽 starts it
    if (step === 3) { if (S.inTowerArr && inTower()) { showAct(null); return; } showAct(outdoors() && S.bb && dBB < 10 ? 'fly' : null); return; }
    // 5: the dog on the tower; Sirius
    if (step === 4) { showAct(null); if (S.dog && S.dogTaps < 2 && (lv() === 1 || S.glowHint) && Math.random() < dt * 4) { dogW(v1); ctx.emit(v1.x + (Math.random() - 0.5) * 0.6, v1.y + (Math.random() - 0.5) * 0.4, v1.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.8, 0.2, 0xffe07a, 0); } return; }
    // 6: the farewell button
    if (step === 5) { showAct(inTower() && S.bb && S.dog ? 'free' : null); }
  }

  // ---------------- framework hooks ----------------
  function begin(step, resumed) {
    S.active = true; S.ended = false; S.stepClock = 0; ensureBB();
    if (step >= 4) ensureDog();
    if (step === 2) { S.bowT = 0; S.bowed = false; }
    if (step === 1 && !resumed) ctx.say('החבל קשור לעמוד. גע בקשר, או הטל עליו לחש 🪢', HERM_WHO, 4);
    if (step === 2 && !resumed) ctx.say('עכשיו קידה קטנה, ואז עולים 🙇🪽', HAG, 3.5);
    if (step === 3 && !resumed && !S.tk) { setTimeout(() => { if (S.active && ctx.step === 3 && !S.tk) startFlight(); }, 400); }
    if (step === 4 && !resumed) ctx.say('שששש... תראה מי מחכה ליד הטלסקופ 🐾', HERM_WHO, 4);
    if (step === 5) { S.siriusOn = 1; S.sirFade = 1; S.dogMode = 'by'; if (!resumed) ctx.say('הגיע הזמן שסיריוס ואבזם יעופו אל החופש 🪽', HERM_WHO, 4); }
    if (!resumed) return;
    if (step === 5) S.dogTaps = 2;
    // a resume (reload / the book): the step starts over at its place
    if (step >= 4) { if (!inTower()) interiors.enter('tower', T_HARRY); S.dogX = step === 5 ? T_HARRY.x + 1.4 : T_DOG.x; S.dogZ = step === 5 ? T_HARRY.z - 1.4 : T_DOG.z; return; }
    if (step >= 1) {
      if (interiors.active) interiors.exit();
      const at = step === 1 ? { x: POST.x - 2.4, z: POST.z + 1.2 } : step === 2 ? { x: BOW.x, z: BOW.z } : HOME;
      player.yaw = Math.atan2(BB.x - at.x, BB.z - at.z); player.teleport(at.x, at.z);
    }
  }
  function goal(step, out) {
    if (step <= 3) {
      if (interiors.active) { if (step === 3 && S.inTowerArr) return null; const r = interiors.room; if (interiors.active === 'entrancehall') { const pp = ((r && r.portals) || []).find(q => q.to === 'out'); return pp ? out.set(pp.x, r.group.position.y, pp.z) : null; } return ctx.routeTo('entrancehall', out, ['staircase', 'entrancehall']); }
      if (step === 0) return out.set(BB.x, groundAt(BB.x, BB.z) + 1.6, BB.z);
      if (step === 1) return S.untied ? null : knotW(out).setY(out.y - 0.4);
      if (step === 2 || step === 3) return S.tk || !S.bb ? null : out.set(BB.x, groundAt(BB.x, BB.z) + 1.4, BB.z);
      return null;
    }
    if (!inTower()) return ctx.routeTo('tower', out, ['staircase', 'entrancehall']);
    if (step === 4) return S.dog && S.dogTaps < 2 ? dogW(out).setY(out.y - 0.8) : null;
    return null;
  }
  function tap(x, y, step) {
    if (S.tk || S.fareOn) return true;
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 1 && outdoors() && !S.untied) { knotW(v1); if (near(v1) < R() * 2.2) { if (Math.hypot(player.pos.x - POST.x, player.pos.z - POST.z) > 10) { ctx.say('בוא קרוב יותר אל העמוד 🪢', HERM_WHO, 2.4); return true; } untie('tap'); return true; } }
    if (step === 4 && inTower() && S.dog) { dogW(v1); const d = near(v1); v2.set(v1.x, v1.y - 0.5, v1.z); if (Math.min(d, near(v2)) < R() * 2.4) { tapDogTower(); return true; } }
    if (step === 5 && inTower() && S.bb) { S.bb.getWorldPosition(v1); v1.y += 1.6; if (near(v1) < R() * 2.4) { farewell(); return true; } }
    return false;
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    if (step === 0) { if (interiors.active) interiors.exit(); player.yaw = Math.atan2(BB.x - BOW.x + 2, 0); player.teleport(BOW.x - 3, BOW.z + 1); if (fast) done(0); else S.arrive = Math.max(S.arrive, 4.7); return; }
    if (step === 1) { if (interiors.active) interiors.exit(); if (Math.hypot(player.pos.x - POST.x, player.pos.z - POST.z) > 8) { player.yaw = Math.atan2(POST.x - (POST.x - 2.4), 0); player.teleport(POST.x - 2.4, POST.z + 1.2); } untie('together'); if (fast) done(1); return; }
    if (step === 2) { if (fast || !S.bb) { done(2); return; } if (!S.bowed && S.bowT === 0) { S.act = 'bow'; press(); setTimeout(() => { if (ctx.step === 2) done(2); }, 3800); } else done(2); return; }
    if (step === 3) { if (!S.tk) { if (interiors.active && inTower()) { done(3); return; } if (interiors.active) interiors.exit(); if (Math.hypot(player.pos.x - BB.x, player.pos.z - BB.z) > 10) { player.yaw = Math.atan2(BB.x - HOME.x, BB.z - HOME.z); player.teleport(HOME.x, HOME.z); } startFlight(); }
      if (fast && S.tk) { S.ph = 'fly'; S.phT = 5; bplay('Fly', 0); S.s = Math.max(S.s, S.L * 0.95); } return; }
    if (step === 4) { const go = () => { if (fast) { S.dogTaps = 1; tapDogTower(); done(4); return; } tapDogTower(); setTimeout(() => { if (ctx.step === 4) tapDogTower(); }, 2600); }; if (!inTower()) { interiors.enter('tower', T_HARRY); soon(() => !!S.dog && inTower(), go); } else soon(() => !!S.dog, go); return; }
    if (step === 5) { const go = () => { if (!S.fareOn) farewell(); if (fast) S.fare = Math.max(S.fare, 10.7); }; if (!inTower()) { interiors.enter('tower', T_HARRY); soon(() => !!S.dog && !!S.bb && inTower(), go); } else soon(() => !!S.dog && !!S.bb, go); }
  }
  function end(finished) {
    S.ended = true; S.active = false;
    if (S.tk) release(true);
    fareEnd(); lowTier(false); document.body.classList.remove('b3sFly');
    if (FI && Array.isArray(FI.TARGETS)) for (const t of T) { const i = FI.TARGETS.indexOf(t); if (i >= 0) FI.TARGETS.splice(i, 1); }
    if (S.bb) { if (S.bb.parent) S.bb.parent.remove(S.bb); try { S.bmix.stopAllAction(); S.bmix.uncacheRoot(S.bb); } catch { /* ok */ } }
    if (S.dog) { const o = S.dog.obj; if (o.parent) o.parent.remove(o); try { S.dog.mixer.stopAllAction(); S.dog.mixer.uncacheRoot(o); } catch { /* ok */ } }
    if (S.sirius) { if (S.sirius.parent) S.sirius.parent.remove(S.sirius); S.sirius.traverse(m => { if (m.isMesh) { try { m.geometry.dispose(); } catch { /* ok */ } } }); }
    S.bb = null; S.dog = null; S.sirius = null; dropProps(); RW.drop();
    try { act.remove(); veil.remove(); css.remove(); } catch { /* ok */ }
    void finished;
  }
  function state() {
    const on = (v) => { if (!v) return false; ctx.screen(v, scr); return !!(scr.on && scr.x > 0 && scr.x < innerWidth && scr.y > 0 && scr.y < innerHeight); };
    const b = S.bb, d = S.dog && S.dog.obj;
    const bbV = !!(b && b.visible && b.parent), dV = !!(d && d.visible && d.parent), sV = !!(S.sirius && S.sirius.visible && S.sirius.parent);
    let bbOn = false; if (bbV) { b.getWorldPosition(v1); v1.y += 1.4; bbOn = on(v1); }
    return { bb: { loaded: !!b, visible: bbV, onScreen: bbOn, clip: S.bcur, tris: S.bTris, inTower: !!(b && interiors.room && b.parent === interiors.room.group) },
      dog: { loaded: !!d, visible: dV, onScreen: dV && on(dogW(v2)), clip: S.dcur, mode: S.dogMode, taps: S.dogTaps, rider: S.onRider, tris: S.dog ? S.dog.tris : null },
      sirius: { on: S.siriusOn, visible: sV, onScreen: sV && on(siriusW(v3)) },
      knot: { untied: S.untied, how: S.untieHow || null, post: !!S.post, rope: !!(S.rope && S.rope.visible), onScreen: !!S.post && on(knotW(new Vector3())) },
      act: S.act, bowed: S.bowed, late: S.late, ph: S.ph, s: +S.s.toFixed(1), L: +S.L.toFixed(1), u: S.L ? +(S.s / S.L).toFixed(3) : 0, takeover: !!S.tk, fade: +S.fade.toFixed(2), flyT: +S.flyT.toFixed(1), aborts: S.aborts, lastAbort: S.lastAbort,
      maxTri: S.maxTri, maxDc: S.maxDc, fare: +S.fare.toFixed(2), fareOn: S.fareOn, spellSays: S.spellSays, rewind: RW.state(), inTower: !!inTower(), tier: S.prevTier !== null ? 'low (was ' + S.prevTier + ')' : null };
  }
  ctx._save = {
    knotW: () => knotW(new Vector3()), bbW: () => (S.bb ? S.bb.getWorldPosition(new Vector3()).setY(S.bb.getWorldPosition(new Vector3()).y + 1.4) : null), dogW: () => (S.dog ? dogW(new Vector3()) : null), siriusW: () => siriusW(new Vector3()),
    clock: (k) => { S.clk = Math.max(0.1, Math.min(20, +k || 1)); return S.clk; }, jump: (s) => { if (S.tk && S.ph === 'fly') { S.s = Math.max(0, Math.min(S.L, s)); return S.s; } return null; },
    logStart: () => { S.log = []; S.ft = 0; }, log: () => S.log, abort: (w) => abort(w || 'test'), throwOnce: () => { S.boom = true; }, timeoutNow: () => { S.flyT = FLY_TIMEOUT - 0.01; },
    late: () => { S.stepClock = LATE + 1; }, resetMax: () => { S.maxTri = 0; S.maxDc = 0; },
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
