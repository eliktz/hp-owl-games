// Book 1 adventure "קידה לאבזם" (Buckbeak the hippogriff): data for adventures.js + the scene code
// (brief: briefs/2026-11-24-quest-buckbeak.md in the art repo). Played outdoors in the REAL grounds by Hagrid's paddock.
// Buckbeak is the rigged GLB 'buckbeak' (models.json; KTX2 with a WebP fallback), loaded lazily when the quest begins
// and taken out of the world when it ends; if it cannot load, Hagrid says so kindly and the quest pauses (nothing breaks).
// Proud and gentle, never frightening: no rearing, no snapping, no fail state; a spell cast near him only gets a kind
// bubble (spells never act on him). Steps:
// 1 go to the paddock (arrow; the Floo to the hut works) -> 2 stand on the glowing spot 4 m in front of him, press 🙇:
// Harry bows while a ring fills (3 / 4 / 5 s; levels 2-3 pause while Harry moves); Buckbeak bows back, Hagrid cheers
// -> 3 pat his beak or neck three times (Nuzzle, a soft chirp, hearts) -> 4 press 🪽: Harry climbs on, wings open, an
// on-rails flight (~45 s, smooth and slow, never a dive): over the lawns, a toe-skim over the lake with a sparkle line
// and a 🙌 button, a wide bank and home; gold feathers on the way (level 1: on the path, collected by themselves;
// levels 2-3: three lanes with ◀ ▶, a missed one comes round again) -> 5 he lands, walks a few steps, Harry hops off,
// Buckbeak bows once more, Hagrid's line; the chapter card + star.
// The flight is a quest takeover ({ adv: true }) with a safe abort: an exception, a room change or a timeout restores
// control and puts Harry on the ground by the paddock. Pausing mid-flight does the same; a resume restarts the step.
// Budgets: the camera stays low and close (the grounds' far half is never in a wide view) and the nature tier drops to
// LOW for the flight (restored after). Buckbeak: 6,249 tris, 3 draw calls; feathers one InstancedMesh; the rest pooled.
// NOT WIRED YET (24 Nov 2026): the card in adventure-stone.js QUESTS is still the "בקרוב" stub because the full iPad
// test did not finish inside the helper's time cap. To open it: import { BUCKBEAK } from './adventure-buckbeak.js' there
// and replace the stub line `{ id: 'buckbeak', ... soon: true ... }` with `BUCKBEAK,`.
import { Vector3, Quaternion, Euler, Matrix4, AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import { loadAnimated } from './models.js';
import { BB, BB_SCALE, BOW, LAND, HOME, WATER, SPEED, LANES, flightCurve, overLake, buildBowSpot, buildFeathers, triCount } from './adventure-buckbeak-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const HAG = '🧔 האגריד';
export const BUCKBEAK = {
  id: 'buckbeak', title: 'קידה לאבזם', ico: '🦅', col: '#3a3a2a', col2: '#a0a070', helper: HERM, confetti: ['✨', '⭐', '🪶', '🦅'],
  pic: [['🦅', 0.5, 0.55, 72], ['🙇', 0.8, 0.3, 30], ['🪶', 0.2, 0.3, 28]],
  intro: [
    'האגריד מלמד היום שיעור מיוחד ליד המכלאה! 🐾',
    'הוא הביא את אבזם, ההיפוגריף: חצי סוס, חצי נשר, ומאוד מאוד גאה.',
    'עם היפוגריף צריך להיות מנומסים: קודם קדים לו, ומחכים שיקוד בחזרה. בוא! ✨',
  ],
  steps: [
    { line: 'לך אל המכלאה של האגריד 🐾', hints: ['אבזם מחכה ליד המכלאה, ליד הבקתה של האגריד 🏡', 'לך אחרי החץ הזהוב', 'אפשר גם לטוס ברשת הפלו אל הבקתה 🔥'], glowL1: true },
    { line: 'עמוד על העיגול הזוהר וקוד לאבזם 🙇', hints: ['עמוד על העיגול הזהוב מול אבזם 🙇', 'לחץ על הכפתור 🙇 ועמוד בשקט', 'מחכים בשקט עד שאבזם קד בחזרה 🙇'], glowL1: true },
    { line: 'לטף את אבזם: גע במקור שלו 3 פעמים 🤚', hints: ['אבזם קד לך! עכשיו אפשר ללטף אותו 🤚', 'גע בראש או בצוואר של אבזם', 'גע במקור של אבזם, שלוש פעמים 💗'], glowL1: true },
    { line: 'טוס על אבזם ואסוף נוצות זהב 🪶', hints: ['לחץ על הכפתור 🪽 כדי לעלות על הגב של אבזם', 'הנוצות הזהובות מחכות בדרך 🪶', 'זוז עם ◀ ▶ אל הנוצה הזהובה 🪶'] },
    { line: 'נוחתים ליד המכלאה 🛬', hints: ['אבזם נוחת. תחזיק חזק! 🛬', 'עוד רגע על הדשא', 'כמעט שם!'] },
  ],
  create: (ctx) => buckbeakScene(ctx),
  art: drawCard,
};

// the reward card picture: a grey hippogriff with spread wings over a lake, a gold feather
function drawCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  const g = x.createLinearGradient(0, cy - 140, 0, cy + 130); g.addColorStop(0, '#8ab4dc'); g.addColorStop(0.62, '#e8dcc0'); g.addColorStop(0.63, '#4a7a8a'); g.addColorStop(1, '#2a4a5a');
  x.fillStyle = g; x.fillRect(cx - 120, cy - 150, 240, 290);
  x.save(); x.translate(cx, cy - 6);
  for (const s of [-1, 1]) { x.fillStyle = '#9a9a9e'; x.beginPath(); x.moveTo(s * 10, -10); x.quadraticCurveTo(s * 70, -80, s * 112, -46); x.quadraticCurveTo(s * 80, -30, s * 92, -12); x.quadraticCurveTo(s * 60, -6, s * 20, 10); x.closePath(); x.fill();
    x.strokeStyle = '#6e6e74'; x.lineWidth = 2; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(s * (30 + k * 18), -20 - k * 6); x.lineTo(s * (44 + k * 16), -2 - k * 4); x.stroke(); } }
  E(0, 18, 48, 26, '#a4a4a8'); E(-30, 46, 7, 18, '#8a8a8e'); E(24, 46, 7, 18, '#8a8a8e');
  E(-36, -6, 16, 28, '#b8b8bc', -0.5); E(-52, -30, 17, 15, '#c4c4c8');
  x.fillStyle = '#e8b040'; x.beginPath(); x.moveTo(-64, -34); x.lineTo(-84, -26); x.lineTo(-64, -24); x.closePath(); x.fill();
  E(-54, -34, 4, 4, '#e86a20'); E(-54, -34, 2, 2, '#1a1a1a');
  x.restore();
  x.save(); x.font = '34px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🪶', cx + 80, cy + 90); x.fillText('✨', cx - 86, cy - 100); x.restore();
}

const BOW_T = { 1: 3, 2: 4, 3: 5 }, NFEATH = { 1: 3, 2: 4, 3: 5 };
const FLY_FAR = 0;   // a shorter far plane for the flight (0 = keep the game's)
const T_MOUNT = 1.2, T_OPEN = 1.5, FLY_TIMEOUT = 150, PATS = 3;
const CASTLE = { x: 0, z: 4 };   // the castle's centre (castle.js footprint x -35..35, z -32..41)
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the lanes narrow by the broadleaf crown south of the strip at (-56, 40) (its edge is ~5.3 m from the rail: the outer
// lane came within ~3.1 m of it): near it every lane glides in toward the rail, so a wing never brushes the leaves
const CROWN = { x: -56, z: 40 };
const laneK = (x, z) => { const d = Math.hypot(x - CROWN.x, z - CROWN.z); return 0.14 + 0.86 * ease((d - 12.6) / 7.4); };

function buckbeakScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera, scene } = ctx;
  const S = { active: false, ended: false, bb: null, mixer: null, acts: {}, cur: null, loading: false, failed: false, bones: {}, t: 0,
    arrived: 0, onSpot: false, camSet: -1, bowing: false, bow: 0, bowAuto: false, bowBack: 0, pats: 0, patT: 0, glowHint: false, said: {},
    ph: 'ground', phT: 0, clk: 1, camSide: 1, log: null, ft: 0, s: 0, L: 0, curve: null, lane: 1, lx: 0, axPrev: 0, feathers: [], got: 0, autop: false, flyT: 0, tk: null, bank: 0,
    from: new Vector3(), seatOff: new Vector3(), camP: new Vector3(), camL: new Vector3(), camInit: false, cheer: 0, cheered: false, lakeOn: false, cheerUntil: 0,
    stepDoneAt: 0, prevTier: null, prevFar: null, done: {}, casts0: 0, aborts: 0, lastAbort: null, maxTri: 0, maxDc: 0, endT: 0, lastP: new Vector3(), moveAcc: 0,
    yaw: BB.yaw, pitch: 0, walkT: 0, offT: 0, finalT: 0 };
  const lv = () => ctx.level;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const chirp = () => { tone(1250, 0.09, 0, 'sine', 0.05, 1800); tone(1500, 0.12, 0.12, 'sine', 0.045, 2200); tone(1900, 0.08, 0.28, 'sine', 0.035, 1600); };
  const whoop = () => { tone(380, 0.45, 0, 'triangle', 0.06, 920); tone(620, 0.3, 0.42, 'triangle', 0.05, 1100); };
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const outdoors = () => !interiors.active;
  const groundAt = (x, z) => (player.heightAt ? player.heightAt(x, z) : 0);
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const SHOW_R = 70;   // metres: Buckbeak is drawn when Harry or the camera is within this distance of him
  const nearBB = () => { const b = S.bb.position, dp = Math.hypot(player.pos.x - b.x, player.pos.z - b.z), dc = Math.hypot(camera.position.x - b.x, camera.position.z - b.z); return Math.min(dp, dc) < SHOW_R; };
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3(), q1 = new Quaternion(), e1 = new Euler(), M4 = new Matrix4();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();

  // ---------------- DOM: the big action button (🙇 with its ring, 🪽, 🙌), the lane buttons ----------------
  const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew',Arial,sans-serif";
  const css = document.createElement('style'); css.id = 'bbCss';
  css.textContent = `#bbAct{position:fixed;left:50%;top:calc(98px + env(safe-area-inset-top));width:128px;height:128px;margin-left:-64px;z-index:14;display:none;border-radius:50%;border:none;padding:0;
    background:none;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none}
  #bbAct.on{display:block} #bbAct svg{width:100%;height:100%;display:block;pointer-events:none}
  #bbAct .lab{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 21px ${FONT};color:#fff8d8;text-shadow:0 2px 0 #000,0 0 10px rgba(255,200,90,.9);pointer-events:none;direction:rtl}
  #bbAct .lab i{font-style:normal;font-size:46px;line-height:1.05}
  #bbAct.pulse svg .bg{animation:bbPulse 1.1s ease-in-out infinite} #bbAct:active{transform:scale(.94)}
  @keyframes bbPulse{0%,100%{stroke:rgba(255,230,140,.35)}50%{stroke:rgba(255,240,170,.95)}}
  #bbL,#bbR{position:fixed;bottom:calc(24px + env(safe-area-inset-bottom));width:96px;height:96px;border-radius:50%;border:4px solid #fff;padding:0;
    background:radial-gradient(circle at 50% 35%,rgba(240,220,150,.96),rgba(150,110,40,.94));color:#fff;font:bold 46px/88px Arial;display:none;z-index:14;touch-action:manipulation;
    box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer;text-shadow:0 2px 0 rgba(0,0,0,.4)}
  #bbL{left:calc(22px + env(safe-area-inset-left))} #bbR{right:calc(22px + env(safe-area-inset-right))} #bbL:active,#bbR:active{transform:scale(.9)}
  body.advBB.bbLanes #bbL,body.advBB.bbLanes #bbR{display:block}
  body.bbAct #enterBtn{display:none !important}
  body.advBB .gamebtn,body.advBB #camctl,body.advBB #fcBtn,body.advBB #wandBtn,body.advBB #bellBtn,body.advBB #enterBtn,body.advBB #joy,body.advBB #joyKnob,
  body.advBB #quest,body.advBB #bubble,body.advBB #funPrompt,body.advBB #fcWheel{display:none !important}
  body.modalOn #bbAct,body.inSpell #bbAct,body.inMatch #bbAct,body.inFloo #bbAct{display:none !important}
  body:has(#advTogether.on) #bbAct{top:calc(186px + env(safe-area-inset-top))}
  #bbCount{position:fixed;left:50%;top:calc(100px + env(safe-area-inset-top));transform:translateX(-50%);z-index:14;display:none;padding:3px 14px;border-radius:16px;border:2px solid #ffd76a;
    background:rgba(40,22,10,.82);color:#ffe9a8;font:bold 20px ${FONT};direction:ltr;white-space:nowrap;pointer-events:none;box-shadow:0 3px 10px rgba(0,0,0,.4)}
  #bbCount.on{display:block} #bbCount.pop{animation:bbPop .5s cubic-bezier(.3,1.6,.5,1)}
  @keyframes bbPop{0%{transform:translateX(-50%) scale(1.5)}100%{transform:translateX(-50%) scale(1)}}
  body.modalOn #bbCount{display:none !important}
  @media (max-width:700px){#bbCount{font-size:17px;padding:2px 12px} body.advBB #bbAct,body.advBB:has(#advTogether.on) #bbAct{bottom:calc(30px + env(safe-area-inset-bottom))}}
  @media (max-width:700px){#bbAct,body:has(#advTogether.on) #bbAct{top:auto;bottom:calc(330px + env(safe-area-inset-bottom));width:112px;height:112px;margin-left:-56px} #bbAct .lab i{font-size:40px} #bbAct .lab{font-size:18px}}`;
  document.head.appendChild(css);
  const act = document.createElement('button'); act.id = 'bbAct';
  act.innerHTML = '<svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="60" fill="rgba(70,46,20,.78)"/><circle class="bg" cx="66" cy="66" r="52" fill="none" stroke="rgba(255,230,140,.35)" stroke-width="12"/>'
    + '<circle class="fg" cx="66" cy="66" r="52" fill="none" stroke="#ffd76a" stroke-width="12" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7" transform="rotate(-90 66 66)"/></svg><div class="lab"><i></i><span></span></div>';
  document.body.appendChild(act);
  const ring = act.querySelector('.fg'), actI = act.querySelector('.lab i'), actT = act.querySelector('.lab span');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) act.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  act.addEventListener('click', (e) => { e.stopPropagation(); press(); });
  let actKind = null;
  function showAct(kind) {
    if (kind === actKind) return; actKind = kind;
    document.body.classList.toggle('bbAct', !!kind);
    if (!kind) { act.classList.remove('on'); return; }
    const L = { bow: ['🙇', 'קידה'], fly: ['🪽', 'לעלות'], cheer: ['🙌', 'וואו!'] }[kind];
    actI.textContent = L[0]; actT.textContent = L[1]; act.setAttribute('aria-label', L[1]);
    act.classList.add('on', 'pulse'); drawRing(kind === 'bow' ? S.bow : 0);
  }
  const drawRing = (k) => ring.setAttribute('stroke-dashoffset', (326.7 * (1 - Math.max(0, Math.min(1, k)))).toFixed(1));
  const mkBtn = (id, txt, dir) => { const b = document.createElement('button'); b.id = id; b.textContent = txt; b.setAttribute('aria-label', dir < 0 ? 'שמאלה' : 'ימינה');
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('click', (e) => { e.stopPropagation(); steer(dir); }); document.body.appendChild(b); return b; };
  const bL = mkBtn('bbL', '◀', -1), bR = mkBtn('bbR', '▶', 1);
  // the feather count while flying: a small pill just under the tracker (a big toast covered the hint bubble on a phone)
  const pill = document.createElement('div'); pill.id = 'bbCount'; document.body.appendChild(pill);
  function showCount(on, popIt = false) {
    if (!on) { pill.classList.remove('on'); return; }
    pill.textContent = '🪶 ' + S.got + ' / ' + needF();
    const tr = document.getElementById('advTrack'), b = tr && tr.classList.contains('on') ? tr.getBoundingClientRect() : null;
    pill.style.top = b && b.height ? Math.round(b.bottom + 6) + 'px' : '';
    pill.classList.add('on');
    if (popIt) { pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop'); }
  }
  const cls = (k, on) => document.body.classList.toggle(k, !!on);
  const lanesOn = () => lv() > 1;

  // ---------------- props (in the world only while the quest needs them) ----------------
  const bowSpot = buildBowSpot(); bowSpot.visible = false;
  const fe = buildFeathers(5); fe.visible = false;
  let propsIn = false;
  function addProps() { if (propsIn) return; propsIn = true; scene.add(bowSpot); scene.add(fe); }
  function dropProps() { propsIn = false; if (bowSpot.parent) bowSpot.parent.remove(bowSpot); if (fe.parent) fe.parent.remove(fe); }

  // ---------------- Buckbeak: the lazily loaded rigged GLB ----------------
  function ensureModel() {
    if (S.bb || S.loading || S.failed) return;
    S.loading = true;
    loadAnimated('buckbeak', () => S.active && !S.ended).then((r) => {
      S.loading = false;
      if (!S.active || S.ended) return;
      if (!r || !r.clips || !r.clips.find(c => c.name === 'Idle')) { modelFailed(); return; }
      const obj = r.obj; obj.name = 'adv-buckbeak'; obj.scale.setScalar(BB_SCALE);
      obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; o.raycast = () => {}; } if (o.isBone) S.bones[o.name] = o; });
      const mixer = new AnimationMixer(obj), acts = {};
      for (const c of r.clips) acts[c.name] = mixer.clipAction(c);
      for (const n of ['Bow', 'Nuzzle', 'WingsOpen']) if (acts[n]) { acts[n].setLoop(LoopOnce, 1); acts[n].clampWhenFinished = true; }
      for (const n of ['Idle', 'Fly', 'Walk']) if (acts[n]) acts[n].setLoop(LoopRepeat, Infinity);
      mixer.addEventListener('finished', (e) => { if ((e.action === acts.Bow || e.action === acts.Nuzzle) && S.ph === 'ground') play('Idle', 0.5); });
      S.bb = obj; S.mixer = mixer; S.acts = acts; S.cur = null;
      play('Idle', 0); scene.add(obj); placeStanding();
      S.bbTris = triCount(obj);
    }).catch((e) => { S.loading = false; console.warn('[buckbeak] model failed -', e && e.message || e); modelFailed(); });
  }
  function modelFailed() {
    if (S.failed) return; S.failed = true;
    ctx.say('אוי, אבזם לא הצליח להגיע היום... ננסה שוב בפעם אחרת 💛', HAG, 5);
    setTimeout(() => { try { if (S.active && !S.ended && window.__game && window.__game.adventures) window.__game.adventures.leave(); } catch { /* ok */ } }, 2500);
  }
  function play(name, fade = 0.35) {
    const a = S.acts[name]; if (!a || S.cur === name) return;
    const prev = S.cur ? S.acts[S.cur] : null;
    a.reset(); a.setEffectiveWeight(1); a.play();
    if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop();
    S.cur = name;
  }
  function replay(name, fade = 0.3) { if (S.cur === name) S.cur = 'Idle'; play(name, fade); }
  // standing by the paddock: feet on the lawn (average of the ground under the front and back feet), facing yaw
  function placeStanding(x = BB.x, z = BB.z, yaw = BB.yaw) {
    if (!S.bb) return;
    const fx = Math.sin(yaw) * 0.9 * BB_SCALE, fz = Math.cos(yaw) * 0.9 * BB_SCALE;
    const yf = groundAt(x + fx, z + fz), yb = groundAt(x - fx, z - fz);
    S.bb.position.set(x, Math.min(yf, yb) + Math.abs(yf - yb) * 0.5 - 0.02, z);
    S.bb.rotation.set(0, yaw, 0); S.yaw = yaw;
  }
  const headW = (out) => { const h = S.bones.head; if (h) { h.getWorldPosition(out); return out; } return out.set(S.bb.position.x + Math.sin(S.yaw) * 1.2 * BB_SCALE, S.bb.position.y + 2.0 * BB_SCALE, S.bb.position.z + Math.cos(S.yaw) * 1.2 * BB_SCALE); };
  // the seat: between the wing roots, a little behind them, on top of the back
  const SEAT = { up: 0.22 * BB_SCALE, back: -0.42 * BB_SCALE };
  function seatW(out) {
    const a = S.bones.wing_l_01, b = S.bones.wing_r_01;
    if (a && b) { a.getWorldPosition(v2); b.getWorldPosition(v3); out.copy(v2).add(v3).multiplyScalar(0.5); }
    else out.set(0, 1.5, 0).applyMatrix4(S.bb.matrixWorld);   // (local: the scale applies)
    out.x += Math.sin(S.yaw) * SEAT.back; out.z += Math.cos(S.yaw) * SEAT.back; out.y += SEAT.up;
    return out;
  }

  // ---------------- the player's bow (no Bow clip on the hero: the spine leans forward after his mixer ran) ----------------
  let spine = null;
  function spineBones() {
    if (spine) return spine;
    spine = []; try { player.model.traverse(o => { if (o.isBone && /spine/i.test(o.name)) spine.push(o); }); } catch { /* ok */ }
    spine = spine.slice(0, 3); return spine;
  }
  const qa = new Quaternion(), qp = new Quaternion(), ax = new Vector3();
  function bendWorld(b, axis, ang) { if (!b.parent) return; b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(qp); qa.setFromAxisAngle(axis, ang); qa.premultiply(qp.clone().invert()).multiply(qp); b.quaternion.premultiply(qa); b.updateMatrixWorld(true); }
  function leanHarry(k) {
    if (k <= 0.001) return; const sb = spineBones(); if (!sb.length) return;
    const y = player.model.rotation.y; ax.set(Math.cos(y), 0, -Math.sin(y));   // up x facing: a positive turn bends forward
    for (const b of sb) bendWorld(b, ax, 0.24 * k);
    const nk = spineNeck(); if (nk) bendWorld(nk, ax, 0.2 * k);
  }
  let neck = undefined;
  function spineNeck() { if (neck !== undefined) return neck; neck = null; try { player.model.traverse(o => { if (!neck && o.isBone && /^neck/i.test(o.name)) neck = o; }); } catch { /* ok */ } return neck; }
  let arms = null;
  function armsUp(k) {
    if (k <= 0.001) return;
    if (!arms) { arms = []; try { player.model.traverse(o => { if (o.isBone && /upper_?arm/i.test(o.name)) arms.push(o); }); } catch { /* ok */ } }
    const y = player.model.rotation.y, fx = Math.sin(y), fz = Math.cos(y);
    for (const b of arms) { const left = /_l$|left/i.test(b.name); const sx = left ? fz : -fz, sz = left ? -fx : fx;   // the arm's side (character left = up x facing... flipped)
      ax.set(0, -1, 0).cross(v3.set(sx, 0, sz)).normalize(); bendWorld(b, ax, 1.5 * k); }
  }
  function faceBB() { const p = player.pos; player.yaw = Math.atan2(S.bb ? S.bb.position.x - p.x : BB.x - p.x, S.bb ? S.bb.position.z - p.z : BB.z - p.z); }
  // the game camera for the bow / pat: behind Harry, a little to the side, low, so both faces read
  function bowCamera() {
    faceBB();
    const c = player.cam; if (!c) return;
    try { c.reset(player.yaw); c.yaw += 0.65; c.pitch = 0.16; c.dist = Math.max(7.5, Math.min(10.5, 7.5 * 1.4 / Math.max(0.6, Math.min(1.4, innerWidth / innerHeight)))); c.userControlled = false; c.idle = 0; } catch { /* ok */ }
  }

  // ---------------- step actions ----------------
  function press() {
    ctx.poke();
    if (actKind === 'bow') startBow();
    else if (actKind === 'fly') startFlight();
    else if (actKind === 'cheer') cheerUp();
  }
  function startBow() {
    if (ctx.step !== 1 || S.bowing || S.bowBack || !S.bb) return;
    S.bowing = true; faceBB(); sfx('soft');
    ctx.say(lv() === 1 ? 'יופי! עכשיו מחכים בשקט... 🙇' : 'עכשיו עומדים בשקט, בלי לזוז... 🙇', HAG, 3);
  }
  function bowedBack() {
    S.bowing = false; S.bowBack = 0.001; showAct(null);
    replay('Bow', 0.35); sfx('chime');
  }
  function pat() {
    if (ctx.step !== 2 || S.pats >= PATS || !S.bb || S.patT > 0) return;
    S.pats++; S.patT = 0.6; ctx.poke(); replay('Nuzzle', 0.25); chirp();
    headW(v1); for (let i = 0; i < 10; i++) emit(v1.x + (Math.random() - 0.5) * 0.5, v1.y + 0.2 + Math.random() * 0.3, v1.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6, 1.3, 0.24, Math.random() < 0.5 ? 0xff7aa8 : 0xffb0cc, 0.1);
    try { fun.toast('💗', S.pats + ' / ' + PATS, 900); } catch { /* ok */ }
    if (S.pats >= PATS) { ctx.say('הוא אוהב אותך! 💗 תראה איך הוא מתכרבל', HAG, 3.5); setTimeout(() => done(2), 1800); }
    else ctx.say(S.pats === 1 ? 'עדין... יופי! 🤚' : 'עוד פעם אחת! 💗', HAG, 2);
  }
  function cheerUp() {
    if (S.ph !== 'fly' || S.cheered) return;
    S.cheered = true; S.cheer = 1.6; showAct(null); whoop(); sfx('sparkle');
    ctx.say('ווהוווו! 🙌', '⚡ הארי', 2.2);
    seatW(v1); burst(v1.x, v1.y + 1.2, v1.z, 0xfff2b0, 22, 2.4, 1.0, 0.28, -0.4);
  }

  // ---------------- the flight (a quest takeover) ----------------
  const tk = { adv: true, spell: true, update: (dt, axis) => { try { sim(dt, axis); } catch (e) { console.warn('[buckbeak] flight failed -', e && e.message || e); abort('error'); } } };
  function steer(dir) {
    if (!S.tk || S.ph !== 'fly' || !lanesOn()) return;
    const n = Math.max(0, Math.min(2, S.lane + dir)); if (n !== S.lane) { S.lane = n; sfx('whoosh'); ctx.poke(); }
  }
  function startFlight(auto = false) {
    if (ctx.step !== 3 || S.tk || !S.bb || !outdoors()) return false;
    showAct(null);
    S.curve = flightCurve(groundAt); S.L = S.curve.getLength();
    S.ph = 'mount'; S.phT = 0; S.s = 0; S.lane = 1; S.lx = 0; S.flyT = 0; S.autop = auto; S.cheered = false; S.cheer = 0; S.cheerUntil = 0; S.camInit = false; S.sideInit = false; S.bank = 0;
    S.from.copy(player.pos);
    placeStanding();
    setupFeathers();
    lowTier(true);
    player.ride(true); player._moving = false;
    S.tk = tk; ctx.setTakeover(tk); cls('advBB', true); cls('bbLanes', lanesOn());
    sfx('pop'); ctx.say('תחזיק חזק בנוצות של הצוואר! ממריאים! 🪽', HAG, 3);
    return true;
  }
  function setupFeathers() {
    const n = NFEATH[lv()] || 3, L = S.L, fr = n === 3 ? [0.2, 0.43, 0.64] : n === 4 ? [0.16, 0.34, 0.52, 0.7] : [0.14, 0.29, 0.44, 0.59, 0.74];
    S.feathers = fr.map((f, i) => ({ s: f * L, lane: lanesOn() ? [2, 0, 1, 2, 0][i] : 1, got: false, spin: Math.random() * 6 }));
    S.got = 0; fe.count = 0; fe.visible = true; showCount(true);
  }
  const needF = () => NFEATH[lv()] || 3;
  const qTier = () => { try { return window.__game.stats().tier; } catch { return null; } };
  // nature LOW (half the trees, no reeds) + a shorter far plane for the flight; given back after
  function lowTier(on) {
    const nat = window.__game && window.__game.nature;
    try {
      if (on) {
        if (S.prevTier === null && nat) { S.prevTier = nat.stats().tier; S.prevQ = qTier(); nat.setTier('low'); }
        if (S.prevFar === null && FLY_FAR) { S.prevFar = camera.far; camera.far = Math.min(camera.far, FLY_FAR); camera.updateProjectionMatrix(); }
      } else {
        // give it back only if it is still the one we set: the quality manager may have chosen a tier mid-flight
        if (S.prevTier !== null && nat && nat.stats().tier === 'low' && qTier() === S.prevQ) nat.setTier(S.prevTier);
        S.prevTier = null;
        if (S.prevFar !== null) { camera.far = S.prevFar; camera.updateProjectionMatrix(); }
        S.prevFar = null;
      }
    } catch (e) { console.warn('[buckbeak] tier -', e && e.message || e); }
  }
  // back on the ground by the paddock, control restored (the end of the flight, a pause, an abort)
  function release(put = true) {
    const had = !!S.tk;
    if (S.tk) { S.tk = null; try { if (window.__game && window.__game.takeover === tk) ctx.setTakeover(null); } catch { ctx.setTakeover(null); } }
    cls('advBB', false); cls('bbLanes', false);
    lowTier(false);
    try { player.ride(false); } catch { /* ok */ }
    player.model.rotation.set(0, 0, 0); player.model.visible = true;
    fe.visible = false; fe.count = 0; showCount(false);
    if (put && had) { player.yaw = Math.atan2(BB.x - HOME.x, BB.z - HOME.z); player.teleport(HOME.x, HOME.z); }
    return had;
  }
  function abort(why) {
    if (!S.tk) return;
    S.aborts++; S.lastAbort = why;
    if (interiors.active) { try { interiors.exit(); } catch { /* ok */ } }   // a room change mid-air: back outside first
    release(true);
    S.ph = 'ground'; S.phT = 0; placeStanding(); play('Idle', 0.3);
    if (ctx.step === 4) { setTimeout(() => done(4), 400); return; }
    if (!S.ended) ctx.say('אבזם נחת לנוח רגע ליד המכלאה. אפשר לטוס שוב! 🪽', HAG, 4);
  }

  function sim(dt, axis) {
    if (!S.tk) return;
    dt *= S.clk;   // 1 in play; a test / debug fast-forward of the flight clock (frames still drawn)
    if (S.boom) { S.boom = false; throw new Error('test: a forced flight error'); }   // the abort-safety test
    if (!outdoors()) { abort('room'); return; }
    if (!S.bb || !S.bb.parent) { abort('model'); return; }
    S.flyT += dt; if (S.flyT > FLY_TIMEOUT) { abort('timeout'); return; }
    const frozen = ctx.isModal();
    if (!frozen) {
      S.phT += dt;
      const ax = axis ? axis.x : 0, dir = ax > 0.5 ? 1 : ax < -0.5 ? -1 : 0;
      if (dir && dir !== S.axPrev) steer(dir); S.axPrev = dir;
      if (S.ph === 'mount') stepMount();
      else if (S.ph === 'open') stepOpen();
      else if (S.ph === 'fly' || S.ph === 'land') stepFly(dt);
      else if (S.ph === 'walk') stepWalk();
      else if (S.ph === 'off') stepOff();
      try { player.animate(dt, { moving: false }); } catch { /* ok */ }
      if (lv() === 1 || S.ph !== 'fly') ctx.poke();   // level 1 flies by itself: no idle hints mid-air
    }
    if (S.ph !== 'off' && S.ph !== 'ground') seatHarry();
    if (S.cheer > 0) { S.cheer -= dt; armsUp(Math.min(1, S.cheer / 0.4, (1.6 - S.cheer) / 0.3)); }
    placeCamera(frozen ? 0 : dt);
    if (!frozen) S.ft += dt;
    Promise.resolve().then(measure);   // after this frame has drawn (the renderer resets its info at the frame start)
  }
  function seatHarry() {
    S.bb.updateMatrixWorld(true);
    seatW(v1);
    if (S.ph === 'mount') { const k = ease(S.phT / T_MOUNT); v1.y -= 0.73; v2.copy(S.from).lerp(v1, k); v2.y += Math.sin(k * Math.PI) * 1.2; player.model.position.copy(v2); }
    else { player.model.position.set(v1.x, v1.y - 0.73, v1.z); }
    player.model.rotation.set(-S.pitch || 0, S.yaw, 0, 'YXZ'); player.model.rotation.z = S.bank * 0.8;
    player.pos.set(player.model.position.x, player.model.position.y, player.model.position.z);
  }
  function stepMount() { if (S.phT >= T_MOUNT) { S.ph = 'open'; S.phT = 0; replay('WingsOpen', 0.3); sfx('whoosh'); } }
  function stepOpen() { if (S.phT >= T_OPEN) { S.ph = 'fly'; S.phT = 0; play('Fly', 0.35); sfx('whoosh'); } }
  function stepFly(dt) {
    const L = S.L, endStep3 = L - 42;
    // speed: a gentle start and a gentle touchdown, never a rush
    const k0 = ease(S.phT / 3), kEnd = ease((L - S.s) / 26);
    let v = SPEED * (0.35 + 0.65 * k0) * (0.3 + 0.7 * kEnd);
    if (S.autop && S.ph === 'fly') autopilot();
    S.s = Math.min(L, S.s + v * dt);
    // lanes: a smooth lateral glide (levels 2-3), always back to the middle for the lake skim end and the landing
    const tx = S.ph === 'land' || !lanesOn() ? 0 : LANES[S.lane];
    S.lx += (tx - S.lx) * Math.min(1, dt * 3.5);
    // the pose on the rail
    const u = S.s / L;
    S.curve.getPointAt(u, v1);
    S.curve.getTangentAt(Math.min(1, u), v2);
    const hx = v2.x, hz = v2.z, hl = Math.hypot(hx, hz) || 1, yaw = Math.atan2(hx / hl, hz / hl);
    const dyaw = wrapA(yaw - S.yaw); S.yaw = wrapA(S.yaw + dyaw * Math.min(1, dt * 5));
    const turn = dyaw / Math.max(dt, 1e-3);
    S.bank += (Math.max(-0.32, Math.min(0.32, -turn * 0.28)) - S.bank) * Math.min(1, dt * 2.5);
    S.pitch = Math.max(-0.12, Math.min(0.2, Math.atan2(v2.y, hl) * 0.8));   // nose up a little when climbing, barely down when descending
    const rx = -hz / hl, rz = hx / hl;   // right of the heading
    const y = v1.y + (S.ph === 'land' && u > 0.985 ? 0 : Math.sin(S.t * 5.2) * 0.06);
    S.lk = laneK(v1.x, v1.z); const ox = S.lx * S.lk;
    S.bb.position.set(v1.x + rx * ox, y, v1.z + rz * ox);
    // keep clear of the ground (and the lake surface) whatever the curve does between its points
    const g = groundAt(S.bb.position.x, S.bb.position.z), wet = overLake(S.bb.position.x, S.bb.position.z, g), floor = wet ? Math.max(g, WATER + 0.05) : g;
    if (S.bb.position.y < floor && S.ph !== 'land') S.bb.position.y = floor;
    if (S.ph === 'land' && u > 0.96) S.bb.position.y = Math.max(S.bb.position.y, g - 0.02);
    S.bb.rotation.set(-S.pitch, S.yaw, S.bank, 'YXZ');
    // the lake: a toe-skim sparkle line on the water, the 🙌 moment
    const lake = wet && S.bb.position.y < WATER + 1.0;
    if (lake) {
      for (let i = 0; i < 2; i++) { const back = -Math.random() * 1.2; emit(S.bb.position.x + Math.sin(S.yaw) * back + (Math.random() - 0.5) * 0.5, WATER + 0.06, S.bb.position.z + Math.cos(S.yaw) * back + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 0.9, 0.22, Math.random() < 0.5 ? 0xffffff : 0xbfe8ff, -1.4); }
      if (!S.lakeOn) { S.lakeOn = true; S.cheerUntil = S.ft + 6; sfx('sparkle'); ctx.say('רואה? הרגליים של אבזם נוגעות במים! ✨', HAG, 3); }
    } else S.lakeOn = false;
    if (S.ph === 'fly') showAct((lake || S.ft < (S.cheerUntil || 0)) && !S.cheered ? 'cheer' : null);   // the 🙌 stays a few seconds after the skim
    // feathers
    tickFeathers(dt);
    // a slow wing whoosh now and then
    S.flapT = (S.flapT || 0) - dt; if (S.flapT <= 0) { S.flapT = 1.21; if (S.ph === 'fly') tone(140, 0.25, 0, 'sine', 0.03, 90); }
    // the end of the flight step (all feathers in), then the landing step continues on the same rail
    if (S.ph === 'fly' && S.s >= endStep3 && S.got >= needF()) { S.ph = 'land'; showAct(null); cls('bbLanes', false); done(3); }
    if (S.ph === 'land' && S.s >= L - 0.01) { S.ph = 'walk'; S.phT = 0; S.walkFrom = { x: S.bb.position.x, z: S.bb.position.z, yaw: S.yaw }; play('Walk', 0.4); sfx('boing'); burst(S.bb.position.x, groundAt(S.bb.position.x, S.bb.position.z) + 0.2, S.bb.position.z, 0xc8e8a0, 16, 1.8, 0.9, 0.26, -1.2); }
  }
  function tickFeathers(dt) {
    const L = S.L; let n = 0;
    for (const f of S.feathers) {
      if (f.got) continue;
      f.spin += dt * 2.2;
      // passing it: collected if in its lane (level 1: always in it)
      if (S.s >= f.s - 0.6) {
        const inLane = !lanesOn() || Math.abs(S.lx - LANES[f.lane]) * (S.lk || 1) < 1.3;   // in metres (the lanes narrow by the crown)
        if (inLane) { f.got = true; S.got++; ctx.poke(); fPos(f, v3); burst(v3.x, v3.y, v3.z, 0xffd76a, 20, 2.2, 0.9, 0.28, -0.5); sfx('tink', S.got); sfx('sparkle');
          showCount(true, true);
          if (S.got >= needF()) ctx.say('כל נוצות הזהב! אבזם גאה בך 🪶', HAG, 2.8); continue; }
        // missed: it comes round again a little further on (near the end it waits right in Buckbeak's lane)
        const next = S.s + 46;
        f.s = Math.min(next, L - 50); f.lane = f.s >= L - 60 ? S.lane : (f.lane + 1 + Math.floor(Math.random() * 2)) % 3;
        if (f.s <= S.s + 4) { f.s = S.s + 8; f.lane = S.lane; }
        ctx.say('הנוצה עפה הלאה... היא תחזור! 🪶', HAG, 2);
      }
      if (f.s - S.s < 140) { fPos(f, v3); M4.compose(v3, q1.setFromEuler(e1.set(0.3 * Math.sin(f.spin * 0.7), f.spin, 0.25)), v2.set(1, 1, 1)); fe.setMatrixAt(n++, M4);
        if (lv() === 1 && Math.random() < dt * 5) emit(v3.x + (Math.random() - 0.5) * 0.8, v3.y + (Math.random() - 0.5) * 0.8, v3.z + (Math.random() - 0.5) * 0.8, 0, 0.3, 0, 0.6, 0.2, 0xffe07a, 0); }
    }
    fe.count = n; fe.instanceMatrix.needsUpdate = true;
  }
  // a feather floats on the rail, about 1.4 m above Buckbeak's back line (scaled with him), in its lane
  function fPos(f, out) {
    const u = Math.min(1, f.s / S.L); S.curve.getPointAt(u, out); S.curve.getTangentAt(u, v2);
    const hl = Math.hypot(v2.x, v2.z) || 1, lx = lanesOn() ? LANES[f.lane] * laneK(out.x, out.z) : 0;
    out.x += -v2.z / hl * lx; out.z += v2.x / hl * lx; out.y += 1.9 * BB_SCALE + Math.sin(f.spin) * 0.12;
    return out;
  }
  function autopilot() {
    const f = S.feathers.filter(x => !x.got && x.s > S.s).sort((a, b) => a.s - b.s)[0];
    if (f && lanesOn()) S.lane = f.lane;
  }
  function stepWalk() {
    const T = 2.8, k = ease(S.phT / T), f = S.walkFrom;
    const x = f.x + (BB.x - f.x) * k, z = f.z + (BB.z - f.z) * k;
    S.yaw = f.yaw + wrapA(BB.yaw - f.yaw) * k;
    placeStanding(x, z, S.yaw); S.bank = 0; S.pitch = 0;
    if (S.phT >= T) { placeStanding(); play('Idle', 0.4); S.ph = 'off'; S.phT = 0; S.from.copy(player.model.position); sfx('pop'); }
  }
  function stepOff() {
    const T = 1.0, k = ease(S.phT / T);
    const ox = HOME.x, oz = HOME.z, oy = groundAt(ox, oz);
    v1.set(ox, oy, oz); v2.copy(S.from).lerp(v1, k); v2.y += Math.sin(k * Math.PI) * 0.9;
    player.model.position.copy(v2); player.model.rotation.set(0, Math.atan2(BB.x - ox, BB.z - oz), 0);
    if (S.phT >= T) {
      release(false);
      player.yaw = Math.atan2(BB.x - HOME.x, BB.z - HOME.z); player.teleport(HOME.x, HOME.z);
      S.ph = 'ground'; S.finalT = 0.001; bowCamera();
    }
  }
  // the chase camera: low and close behind him, a little above; a longer arm on a narrow phone
  function placeCamera(dt) {
    const aspect = innerWidth / Math.max(1, innerHeight), narrow = aspect < 1;
    const p = S.bb.position, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    let px, py, pz, lx, ly, lz;
    if (S.ph === 'mount' || S.ph === 'open' || S.ph === 'walk' || S.ph === 'off') {   // a side three-quarter view
      const d = (narrow ? 11 : 8.5) * BB_SCALE, sa = S.yaw + 0.8;   // in front of him, to his left: his face, the hut and the forest behind (not the castle)
      px = p.x + Math.sin(sa) * d; pz = p.z + Math.cos(sa) * d; py = p.y + 2.6 * BB_SCALE; lx = p.x; ly = p.y + 1.5 * BB_SCALE; lz = p.z;
    } else {
      const back = (narrow ? 10.5 : 8) * BB_SCALE, up = (narrow ? 3.6 : 3.0) * BB_SCALE;
      // the budget: a three-quarter chase from the castle's side, looking a little away from it, so the castle (the
      // heaviest thing in the grounds) stays at or past the edge of the frame; the side eases over when it changes
      const rx = fz, rz = -fx, side = (CASTLE.x - p.x) * rx + (CASTLE.z - p.z) * rz >= 0 ? 1 : -1;
      if (!S.sideInit) { S.sideInit = true; S.camSide = side; }
      S.camSide += (side - S.camSide) * Math.min(1, dt * 0.8);
      // a narrow phone: the look point is on the line through him, so he stays in the middle of the narrow frame
      const off = 5 * S.camSide, away = narrow ? off * 9 / back : 6.5 * S.camSide;
      px = p.x - fx * back + rx * off; pz = p.z - fz * back + rz * off; py = p.y + up;
      lx = p.x + fx * 9 - rx * away; ly = p.y + 0.4 * BB_SCALE + (narrow ? 2.4 : 0); lz = p.z + fz * 9 - rz * away;   // a phone: he sits lower, under the hint bubble
    }
    const g = groundAt(px, pz), fl = overLake(px, pz, g) ? Math.max(g, WATER) : g; py = Math.max(py, fl + 1.4);
    v1.set(px, py, pz); v2.set(lx, ly, lz);
    if (!S.camInit) { S.camP.copy(v1); S.camL.copy(v2); S.camInit = true; }
    const k = Math.min(1, dt * 3); S.camP.lerp(v1, k); S.camL.lerp(v2, k);
    camera.position.copy(S.camP); camera.lookAt(S.camL); camera.updateMatrixWorld();
  }
  // the budget along the flight (renderer.info of the frame drawn before this one)
  function measure() {
    try { const r = window.__game && window.__game.renderer; const inf = r && r.info && r.info.render; if (inf) { const t = inf.triangles | 0, d = inf.drawCalls !== undefined ? inf.drawCalls | 0 : inf.calls | 0; if (t > S.maxTri) S.maxTri = t; if (d > S.maxDc) S.maxDc = d;
      if (S.log && S.log.length < 4000 && S.bb) { const c = camera.position, b = S.bb.position; S.log.push([+S.ft.toFixed(2), S.ph, +S.s.toFixed(1), t, d, +c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1), +b.x.toFixed(1), +b.y.toFixed(1), +b.z.toFixed(1)]); } } } catch { /* ok */ }
  }

  // ---------------- per frame (the framework's hook) ----------------
  function update(dt, step, busy) {
    S.t += dt;
    if (!S.active) return;
    // He is on screen whenever Harry or the lens is anywhere near him (the approach, the bow, the pat, the mount, the flight).
    // Only far away (the main gates view, 82 m off) he is not drawn, so that view keeps its triangle budget. No frustum test.
    if (S.bb) S.bb.visible = outdoors() && (!!S.tk || nearBB());
    if (S.tk && !outdoors()) abort('room');
    if (S.bb && S.mixer) { try { S.mixer.update(dt); } catch { /* ok */ } }
    bowSpot.visible = !!S.bb && outdoors() && step === 1 && !S.bowBack;
    if (bowSpot.visible) { bowSpot.position.set(BOW.x, groundAt(BOW.x, BOW.z) + 0.06, BOW.z); const s = 1 + Math.sin(S.t * 4) * 0.06; bowSpot.scale.set(s, 1, s); bowSpot.material.opacity = 0.75 + Math.sin(S.t * 4) * 0.25; }
    // a spell near Buckbeak: a kind word (he is bowed to and patted, never charmed)
    const n = casts();
    if (n !== S.casts0) { S.casts0 = n; if (S.bb && outdoors() && Math.hypot(player.pos.x - S.bb.position.x, player.pos.z - S.bb.position.z) < 16) { S.spellSays = (S.spellSays || 0) + 1; ctx.say('לא מטילים לחשים על אבזם 🙂 קדים לו ומלטפים אותו!', HAG, 3.2); } }
    if (S.patT > 0) S.patT -= dt;
    if (busy || S.tk) { if (S.tk && step === 3 && S.ph === 'fly') { /* the action button is driven by the flight */ } return; }
    if (!outdoors() || !S.bb) { if (actKind) showAct(null); return; }
    const p = player.pos, dBB = Math.hypot(p.x - S.bb.position.x, p.z - S.bb.position.z);
    // 1: arriving by the paddock
    if (step === 0) { if (dBB < 15) { S.arrived += dt; if (S.arrived > 1.0 && !S.done[0]) { ctx.say('הנה אבזם! 🦅 הוא גאה מאוד. תמיד מתחילים בקידה', HAG, 4); done(0); } } else S.arrived = 0; return; }
    // 2: the bow
    if (step === 1) {
      const dS = Math.hypot(p.x - BOW.x, p.z - BOW.z), on = dS < 1.5;
      if (on && !S.onSpot && S.camSet !== 1) { S.camSet = 1; bowCamera(); }
      S.onSpot = on;
      if (S.bowAuto && !S.bowing && !S.bowBack) startBow();
      if (S.bowing) {
        const moved = Math.hypot(p.x - S.lastP.x, p.z - S.lastP.z) > 0.02;
        const paused = lv() > 1 && (moved || !on);
        if (!paused) S.bow = Math.min(1, S.bow + dt / (BOW_T[lv()] || 3));
        else if (!S.said.still || S.t - S.said.still > 4) { S.said.still = S.t; ctx.say('עומדים בשקט... אבזם מחכה 🙇', HAG, 2.2); }
        drawRing(S.bow);
        if (!paused) faceBB();
        if (S.bow >= 1) bowedBack();
      }
      if (!S.bowBack) showAct(on || S.bowing ? 'bow' : null);
      if (S.bowing || (S.bowBack && S.bowBack < 2.2)) leanHarry(S.bowing ? ease(Math.min(1, S.bow * 4)) : Math.max(0, 1 - S.bowBack / 2.2));
      if (S.bowBack) {
        const t0 = S.bowBack; S.bowBack += dt;
        if (t0 < 1.4 && S.bowBack >= 1.4) ctx.say('הוא קד בחזרה! 🦅 כל הכבוד! עכשיו אפשר ללטף אותו', HAG, 3.5);
        if (S.bowBack >= 3.1) done(1);
      }
      S.lastP.copy(p);
      return;
    }
    // 3: the pat (taps); level 1: a soft glow of sparkles round his head
    if (step === 2) {
      showAct(null);
      if ((lv() === 1 || S.glowHint) && S.pats < PATS && Math.random() < dt * 4) { headW(v1); emit(v1.x + (Math.random() - 0.5) * 0.6, v1.y + (Math.random() - 0.5) * 0.5, v1.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.8, 0.2, 0xffe07a, 0); }
      return;
    }
    // 4: on the ground, the 🪽 button when Harry is near him
    if (step === 3) { showAct(dBB < 10 ? 'fly' : null); return; }
    // 5: after hopping off (or a resume at this step): the last bow + Hagrid's line
    if (step === 4) {
      showAct(null);
      if (!S.finalT) { S.finalT = 0.001; bowCamera(); }
      const t0 = S.finalT; S.finalT += dt;
      if (t0 < 0.5 && S.finalT >= 0.5) { replay('Bow', 0.35); sfx('chime'); }
      if (t0 < 1.6 && S.finalT >= 1.6) { ctx.say('כל הכבוד! טסת על היפוגריף! אבזם קד לך שוב, הוא גאה בך 🦅💛', HAG, 5); sfx('heart'); }
      if (S.finalT >= 4.2) done(4);
    }
  }

  // ---------------- framework hooks ----------------
  function begin(step, resumed) {
    S.active = true; S.ended = false; addProps(); ensureModel();
    S.bowing = false; S.bowBack = 0; S.bow = 0; S.bowAuto = false; S.camSet = -1; S.onSpot = false; S.arrived = 0; S.pats = 0; S.finalT = step === 4 && !S.tk ? 0 : S.finalT;
    if (!S.tk) S.ph = 'ground';
    if (step === 1 && !resumed) ctx.say('עמוד על העיגול הזוהר מול אבזם, ולחץ 🙇', HAG, 4);
    if (step === 2 && !resumed) S.lastP.copy(player.pos);
    if (step === 3 && !resumed) ctx.say('אבזם מרשה לך לעלות על הגב שלו! לחץ 🪽', HAG, 4);
    if (step === 4 && S.tk) ctx.say('עכשיו נוחתים בעדינות ליד המכלאה 🛬', HAG, 3);
    if (!resumed) return;
    // a resume (reload / the book): go to the paddock; the step starts over
    if (step >= 1) {
      if (interiors.active) interiors.exit();
      const at = step === 1 ? { x: BOW.x - 4.5, z: BOW.z + 1.5 } : step === 2 ? { x: BOW.x + 1.2, z: BOW.z } : HOME;
      player.yaw = Math.atan2(BB.x - at.x, BB.z - at.z); player.teleport(at.x, at.z);
      if (step === 2 || step === 4) setTimeout(() => { try { bowCamera(); } catch { /* ok */ } }, 50);
    }
  }
  function goal(step, out) {
    if (interiors.active) { const r = interiors.room; if (interiors.active === 'entrancehall') { const pp = ((r && r.portals) || []).find(q => q.to === 'out'); return pp ? out.set(pp.x, r.group.position.y, pp.z) : null; } return ctx.routeTo('entrancehall', out, ['staircase', 'entrancehall']); }
    if (step === 0) return out.set(BB.x, groundAt(BB.x, BB.z) + 1.6, BB.z);
    if (!S.bb) return null;
    if (step === 1) return S.bowing || S.bowBack ? null : out.set(BOW.x, groundAt(BOW.x, BOW.z), BOW.z);
    if (step === 2) return S.pats >= PATS ? null : headW(out).setY(out.y - 0.9);
    if (step === 3) { if (S.tk) { if (!lanesOn() || S.ph !== 'fly') return null; const f = S.feathers.filter(x => !x.got && x.s > S.s).sort((a, b) => a.s - b.s)[0]; if (!f || f.s - S.s > 60) return null; return fPos(f, out).setY(out.y - 1.2); } return out.set(S.bb.position.x, S.bb.position.y + 1.4, S.bb.position.z); }
    return null;
  }
  function tap(x, y, step) {
    if (S.tk) { if (S.ph === 'fly' && lanesOn()) { steer(x < innerWidth / 2 ? -1 : 1); return true; } return true; }
    if (!S.bb || !outdoors()) return false;
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (step === 2) {
      headW(v1); const dh = near(v1);
      v2.copy(v1).lerp(S.bb.position, 0.35); v2.y = v1.y - 0.5; const dn = near(v2);   // the neck, a little lower and back
      if (Math.min(dh, dn) < R() * 2.0) {
        if (Math.hypot(player.pos.x - S.bb.position.x, player.pos.z - S.bb.position.z) > 7.5) { ctx.say('בוא קרוב יותר לאבזם כדי ללטף אותו 🤚', HAG, 2.4); return true; }
        pat(); return true;
      }
      v2.copy(S.bb.position); v2.y += 1.2; if (near(v2) < R() * 2.6) { ctx.say('גע בראש או במקור של אבזם 🤚', HAG, 2.2); return true; }
      return false;
    }
    if (step === 1 && !S.bowing && !S.bowBack) { v2.copy(S.bb.position); v2.y += 1.2; if (near(v2) < R() * 2.6) { ctx.say('קודם קדים לו! עמוד על העיגול הזוהר 🙇', HAG, 2.6); return true; } }
    return false;
  }
  function glow(step, on) { S.glowHint = !!on; }
  // hints while flying are about the feathers (the 🪽 hint is for the ground)
  function hintText(step, n) {
    if (step !== 3 || !S.tk) return null;
    return ['', 'הנוצות הזהובות מחכות בדרך 🪶', lanesOn() ? 'זוז עם ◀ ▶ אל הנוצה הזהובה 🪶' : 'אבזם עף אל הנוצות בעצמו 🪶', 'החץ הזהוב מראה איפה הנוצה 🪶'][n] || null;
  }
  function together(step, fast) {
    if (step === 0) { if (interiors.active) interiors.exit(); player.yaw = Math.atan2(BB.x - BOW.x + 2, 0); player.teleport(BOW.x - 3, BOW.z + 1); if (fast) done(0); return; }
    if (step === 1) {
      if (interiors.active) interiors.exit();
      if (Math.hypot(player.pos.x - BOW.x, player.pos.z - BOW.z) > 1.2) { player.yaw = Math.atan2(BB.x - BOW.x, BB.z - BOW.z); player.teleport(BOW.x, BOW.z); }
      S.bowAuto = true; if (fast) { if (!S.bb) { done(1); return; } if (!S.bowing && !S.bowBack) startBow(); S.bow = 1; bowedBack(); S.bowBack = 3.0; }
      return;
    }
    if (step === 2) { if (fast || !S.bb) { S.pats = PATS; done(2); return; } for (let i = S.pats; i < PATS; i++) setTimeout(() => { S.patT = 0; pat(); }, (i - S.pats) * 800); return; }
    if (step === 3) {
      if (!S.tk) { if (!S.bb) { if (fast) done(3); return; } if (interiors.active) interiors.exit(); if (Math.hypot(player.pos.x - BB.x, player.pos.z - BB.z) > 10) { player.yaw = Math.atan2(BB.x - HOME.x, BB.z - HOME.z); player.teleport(HOME.x, HOME.z); } startFlight(true); }
      else S.autop = true;
      if (fast && S.tk) { S.ph = 'fly'; S.phT = 5; play('Fly', 0); for (const f of S.feathers) if (!f.got) { f.got = true; S.got++; } S.s = Math.max(S.s, S.L - 43); }
      return;
    }
    if (step === 4) { if (fast) { if (S.tk) { S.ph = 'land'; S.s = S.L; } else S.finalT = Math.max(S.finalT, 4.1); } }
  }
  function end(finished) {
    S.ended = true; S.active = false;
    if (S.tk) release(true);
    showAct(null); cls('bbAct', false); cls('advBB', false); cls('bbLanes', false); lowTier(false);
    if (S.bb) { if (S.bb.parent) S.bb.parent.remove(S.bb); try { S.mixer.stopAllAction(); S.mixer.uncacheRoot(S.bb); } catch { /* ok */ } }
    S.bb = null; S.mixer = null; S.acts = {};
    dropProps();
    try { act.remove(); bL.remove(); bR.remove(); pill.remove(); css.remove(); } catch { /* ok */ }
    void finished;
  }
  function state() {
    const b = S.bb;
    let onScreen = false; if (b) { try { ctx.screen(v1.copy(b.position).setY(b.position.y + 1.2 * BB_SCALE), scr); onScreen = !!scr.on; } catch { /* no lens yet */ } }
    return { loaded: !!b, visible: !!(b && b.visible), onScreen, distPlayer: b ? +Math.hypot(player.pos.x - b.position.x, player.pos.z - b.position.z).toFixed(1) : null, loading: S.loading, failed: S.failed, clip: S.cur, bbTris: S.bbTris || null, pos: b ? { x: +b.position.x.toFixed(2), y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(2), yaw: +S.yaw.toFixed(2) } : null,
      ground: b ? +groundAt(b.position.x, b.position.z).toFixed(2) : null, onSpot: S.onSpot, bowing: S.bowing, bow: +S.bow.toFixed(2), bowBack: S.bowBack > 0, pats: S.pats, act: actKind,
      ph: S.ph, s: +S.s.toFixed(1), L: +S.L.toFixed(1), u: S.L ? +(S.s / S.L).toFixed(3) : 0, lane: S.lane, lx: +S.lx.toFixed(2), lk: +(S.lk || 1).toFixed(2), got: S.got, need: needF(), feathers: S.feathers.map(f => ({ s: +f.s.toFixed(1), lane: f.lane, got: f.got })),
      takeover: !!S.tk, lanes: document.body.classList.contains('bbLanes'), lake: S.lakeOn, cheered: S.cheered, autop: S.autop, flyT: +S.flyT.toFixed(1), aborts: S.aborts, lastAbort: S.lastAbort,
      maxTri: S.maxTri, maxDc: S.maxDc, spellSays: S.spellSays || 0, tier: S.prevTier !== null ? 'low (was ' + S.prevTier + ')' : null, finalT: +S.finalT.toFixed(2) };
  }
  // test / debug handles (window.__game.adventures._ctx._bb)
  ctx._bb = {
    headW: () => (S.bb ? headW(new Vector3()) : null),
    bbW: () => (S.bb ? S.bb.position.clone().setY(S.bb.position.y + 1.2) : null),
    seatW: () => (S.bb ? seatW(new Vector3()) : null),
    bow: () => ({ ...BOW }), bb: () => ({ ...BB }), home: () => ({ ...HOME }),
    jump: (s) => { if (S.tk && (S.ph === 'fly' || S.ph === 'land')) { S.s = Math.max(0, Math.min(S.L, s)); return S.s; } return null; },   // the flight clock (metres along the rail)
    phase: () => S.ph, abort: (why) => abort(why || 'test'), throwOnce: () => { S.boom = true; }, timeoutNow: () => { S.flyT = FLY_TIMEOUT - 0.01; },
    nextLane: () => { const f = S.feathers.filter(x => !x.got && x.s > S.s).sort((a, b) => a.s - b.s)[0]; return f ? f.lane : null; },
    resetMax: () => { S.maxTri = 0; S.maxDc = 0; },
    clock: (k) => { S.clk = Math.max(0.1, Math.min(20, +k || 1)); return S.clk; },   // debug: run the flight clock k x faster
    logStart: () => { S.log = []; S.ft = 0; }, log: () => S.log, logStop: () => { const l = S.log; S.log = null; return l; },
    path: () => { if (!S.curve) S.curve = flightCurve(groundAt); const L = S.curve.getLength(), out = []; for (let i = 0; i <= 80; i++) { const p = S.curve.getPointAt(i / 80); out.push([+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), +groundAt(p.x, p.z).toFixed(1)]); } return { L, pts: out }; },
  };
  return { begin, update, goal, tap, glow, together, end, state, hintText };
}
