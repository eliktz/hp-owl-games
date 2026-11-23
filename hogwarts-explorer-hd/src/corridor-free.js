// The Forbidden Corridor in free play (kid feedback 23 Nov 2026, Part 2). The permanent door "המסדרון האסור / קומה שלישית"
// in the staircase hall (adventure-stone.js) leads into the SAME chambers interior quest 1 uses; when quest 1 is not
// running the interior is built for free play (buildChambers(0, { free: true })) and this module drives it:
// every room in any order, no tracker, no arrow, no steps, no hint ladder; everything resets on every new entry
// (the interior is rebuilt on enter). Objects only: spells and taps never act on Fluffy (a tap / spell on him gets a
// kind "ששש... הוא ישן"). Rooms:
//  0 Fluffy dozes with one eye half open; the harp (tap / the 🎵 prompt / a charm) puts him deep asleep (z z z) and the
//    trapdoor opens: step on it to hop down (again and again). Shut trapdoor: a kind bubble, nothing else.
//  1 Devil's Snare: Lumos / Lumos Maxima / Incendio (or the 💡 prompt) and it recoils. A rope ladder climbs back up.
//  2 Flying keys: tap the big key with the blue wing, or Accio / Leviosa it: it flies to Harry, then to the lock and the
//    door swings; or Alohomora on the lock opens it straight away.
//  3 Chess: lit knight-move squares, a tap hops the knight there (play, no win); a toppled white queen with a chipped
//    crown at the side: Reparo stands her up and mends the crown. The way on is open.
//  4 Potions: every bottle chimes and puffs its colour; the riddle bottle parts the purple flames; Aguamenti lowers
//    them for about 20 s.
//  5 The Mirror of Erised: walk up and look: Harry holds a pair of thick woollen socks (Dumbledore's joke).
// Going back is always possible: a barrier opens by itself when Harry comes at it from the far side, the ladder goes
// up from below the trapdoor, and the doorway to the staircase hall is always open. House points: +5 once per room per
// session (six at most), through the game's points helper; nothing new is saved.
// Budgets: no new textures beyond the mirror canvas already there; sparkles through freecast's pooled particles.
// Debug / tests: window.__game.corridor  state() screen(v) and world positions of things to tap.
import { Vector3, Object3D, Raycaster, Plane, Vector2 } from 'three';
import { speak as voiceSpeak } from './voice.js';
import { CORRIDOR } from './adventure-stone.js';
import { SPOTS, DOOR_Z, zc, sq, BOARD, COLOURS, N, FLOOR_Y, drawMirror } from './adventure-stone-build.js';

const PAID = new Set();   // rooms that gave +5 this session (memory only)
const OCCUPIED = new Set(['0,1', '4,1', '5,0', '3,1', '0,4', '4,4', '0,5', '5,4', '3,5']);   // squares with a piece on them (adventure-stone-build.js)
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const NOTES = [523, 587, 659, 698, 784, 880, 988];

export function createCorridorFree({ camera, player, interiors, fun, freecast, setTakeover, isModal, isTakeover }) {
  const FI = freecast && freecast._internal;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0) => sfx('tone', f, d, 'triangle', 0.12, w);
  const emit = (...a) => { try { FI.emit(...a); } catch { /* no particles */ } };
  const burst = (...a) => { try { FI.burst(...a); } catch { /* no particles */ } };
  const Y = () => FLOOR_Y;
  const W = (x, y, z, out = new Vector3()) => out.set(x, Y() + y, z);
  const v1 = new Vector3(), v2 = new Vector3(), dO = new Object3D(), mO = new Object3D(), _p = new Vector3();
  const log = { visits: 0, says: 0, lastSay: null, taps: 0, refusals: 0, acts: [], rebuilds: 0, climbs: 0, hops: 0, errors: 0 };
  let B = null, lastRoom = null, S = null, tt = 0, rebuildFor = null;

  const fresh = () => ({ played: false, harp: 0, hop: 0, hopArmed: true, trapSay: true, snare: 0, keyT: 0, keyHow: null, unlockT: 0, open2: false, knight: [1, 1], from: null, hopT: -1, moves: 0,
    mendT: 0, mended: false, flamesT: 0, parted: false, puff: [], answer: [0, 1, 2, 3, 4, 6][Math.floor(Math.random() * 6)], riddleSaid: false, look: 0, looked: false, lookArmed: true, ladderArmed: true, climb: 0, unlitSay: true, mtick: 0 });
  const active = () => interiors.active === 'chambers' && B && B.free && S && !CORRIDOR.quest;
  const room = () => Math.max(0, Math.min(N - 1, Math.round(-player.pos.z / 10)));
  const dist = (x, z) => Math.hypot(player.pos.x - x, player.pos.z - z);
  function screen(v, out = { x: 0, y: 0, on: false }) { _p.copy(v).project(camera); out.x = (_p.x * 0.5 + 0.5) * innerWidth; out.y = (-_p.y * 0.5 + 0.5) * innerHeight; out.on = _p.z < 1 && Math.abs(_p.x) <= 1.05 && Math.abs(_p.y) <= 1.05; return out; }
  const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
  function say(text, at = null, sec = 3.6) {
    log.says++; log.lastSay = text;
    try { fun.say(at || W(player.pos.x, 2.4, player.pos.z), text, sec, 'corridor'); } catch { /* no bubble */ }
    try { if (!muted()) voiceSpeak(text, { preset: 'narrator' }); } catch { /* no speech */ }
  }
  function award(i, what) {
    log.acts.push(i + ':' + what); if (log.acts.length > 30) log.acts.shift();
    if (PAID.has(i)) return false;
    PAID.add(i);
    try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ }
    try { fun.toast('✨⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ }
    burst(player.pos.x, player.pos.y + 1.3, player.pos.z, 0xffd76a, 18, 2.2, 1.0, 0.24, -1.2);
    return true;
  }

  // ---------------- room 0: the harp, Fluffy, the trapdoor ----------------
  function playHarp() {
    if (!active() || S.played) return; S.played = true; S.harp = 0.001;
    [523, 659, 784, 1047, 784, 659, 523, 392].forEach((f, i) => tone(f, 0.5, i * 0.28));
    say('הנבל מנגן... פלאפי נרדם עמוק 💤 הדלת ברצפה נפתחת!', W(SPOTS.harp.x, 2.2, SPOTS.harp.z));
    award(0, 'harp');
  }
  function fluffyNo(spell) {
    log.refusals++; sfx('soft');
    const f = B.P.fluffy.heads[1]; f.getWorldPosition(v1); v1.y += 0.9;
    say(spell ? 'ששש... לא מטילים לחשים על פלאפי. הוא ישן 💤' : 'ששש... הוא ישן 🐶💤', v1.clone(), 3);
  }
  const place = (x, y, z, yaw) => { player.pos.set(x, Y() + y, z); player.smoothY = Y() + y; player.yaw = yaw; player.model.position.copy(player.pos); player.model.rotation.y = yaw; };
  function hopDown() {   // Harry walks onto the open trapdoor, hops in, lands softly on the leaves
    if (S.hop) return; S.hop = 0.001; S.hopArmed = false; log.hops++;
    const start = { x: player.pos.x, z: player.pos.z }, tp = SPOTS.trap;
    let t = 0, landed = false;
    setTakeover({ spell: true, update(dt) {
      t += dt;
      if (t < 0.6) { const k = t / 0.6; place(start.x + (tp.x - start.x) * k, 0, start.z + (tp.z + 0.1 - start.z) * k, Math.atan2(tp.x - start.x, tp.z - start.z) || player.yaw); }
      else if (t < 1.1) { const k = (t - 0.6) / 0.5; place(tp.x, -k * 1.8 + Math.sin(k * Math.PI) * 0.6, tp.z, player.yaw); }
      else if (!landed) { landed = true; player.yaw = Math.PI; player.teleport(SPOTS.land.x, SPOTS.land.z); burst(player.pos.x, Y() + 0.5, player.pos.z, 0x6ac850, 22, 2.2, 1.0, 0.24, -1.5); sfx('boing'); say('וואו, נחיתה רכה על העלים! 🌿'); }
      else if (t > 1.4) { if (S) S.hop = 0; setTakeover(null); }
      player.animate(dt, { moving: t < 0.6 }, 1.4);
      player.cam.update(dt, player.pos, player.yaw, false);
    } });
  }
  function climbUp() {   // the rope ladder under the trapdoor: back up beside Fluffy
    if (S.climb) return; S.climb = 0.001; S.ladderArmed = false; log.climbs++;
    const L = SPOTS.ladder; let t = 0, up = false;
    sfx('whoosh');
    setTakeover({ spell: true, update(dt) {
      t += dt;
      if (t < 0.9) place(L.x, Math.min(1.6, t * 1.8), L.z - 0.45, 0);
      else if (!up) { up = true; player.yaw = Math.PI; player.teleport(2.0, 2.5); burst(player.pos.x, Y() + 0.6, player.pos.z, 0xffe9a0, 18, 2, 0.9, 0.22, -1); say('טיפסת בחזרה למעלה! 🪜'); }
      else if (t > 1.2) { if (S) { S.climb = 0; S.hopArmed = false; } setTakeover(null); }
      player.animate(dt, { moving: t < 0.9 }, 1.0);
      player.cam.update(dt, player.pos, player.yaw, false);
    } });
  }

  // ---------------- room 1: the snare ----------------
  function clearSnare(how, quiet) {
    if (!active() || S.snare) return; S.snare = 0.001;
    if (quiet) return;
    W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z, v1); burst(v1.x, v1.y, v1.z, 0xfff6c8, 26, 2.4, 1.2, 0.28, -0.4);
    sfx('sparkle'); say('הצמח בורח מהאור! הדרך פתוחה ✨');
    award(1, how);
  }
  // ---------------- room 2: the keys ----------------
  function catchKey(how) {
    if (!active() || S.keyT || S.open2) return; S.keyT = 0.001; S.keyHow = how;
    sfx('chime'); say(how === 'tap' ? 'תפסת אותו! המפתח עף אל המנעול 🔑' : 'המפתח עף אליך... ומשם אל המנעול! 🔑');
  }
  function unlock(quiet) {
    if (!active() || S.open2 || S.unlockT) return; S.unlockT = 0.001;
    if (quiet) { S.unlockT = 0.6; return; }
    W(SPOTS.lock.x, SPOTS.lock.y, SPOTS.lock.z, v1); burst(v1.x, v1.y, v1.z + 0.2, 0xffd76a, 22, 1.8, 0.9, 0.22, -0.6);
    sfx('clank'); say('אלוהומורה! המנעול נפתח 🔓'); award(2, 'alohomora');
  }
  // ---------------- room 3: chess ----------------
  const lit = () => { if (!S || S.hopT >= 0) return []; const [c0, r0] = S.knight; return KNIGHT.map(([a, b]) => [c0 + a, r0 + b]).filter(([c, r]) => c >= 0 && c < 6 && r >= 0 && r < 6 && !OCCUPIED.has(c + ',' + r)); };
  function moveKnight(c, r) {
    if (!active() || S.hopT >= 0) return false;
    if (!lit().some(([a, b]) => a === c && b === r)) { if (S.unlitSay) { S.unlitSay = false; say('הפרש קופץ למשבצות הזוהרות ✨'); } return true; }
    S.from = S.knight.slice(); S.knight = [c, r]; S.hopT = 0; S.moves++; sfx('boing');
    if (S.moves === 1) say('קפיצת פרש! ♞');
    award(3, 'knight'); return true;
  }
  function mendQueen() {
    if (!active() || S.mended || S.mendT) return; S.mendT = 0.001;
    const q = B.P.queen; q.g.getWorldPosition(v1); burst(v1.x, v1.y + 0.4, v1.z + 0.8, 0x9affc8, 22, 1.8, 1.0, 0.24, -0.6); sfx('sparkle');
  }
  // ---------------- room 4: potions ----------------
  function tapBottle(i) {
    if (!active()) return;
    const b = B.P.potions.bpos[i]; tone(NOTES[i], 0.45); burst(b.x, Y() + b.y + 0.55, b.z, COLOURS[i].hex, 14, 1.2, 0.9, 0.2, 0.4);
    S.puff[i] = 0.001;
    if (i === S.answer && !S.parted) { S.parted = true; sfx('sparkle'); say('גלוּם... הבקבוק ' + COLOURS[i].name + '! הלהבות נפתחות 💜'); award(4, 'bottle'); }
  }
  function riddle() { S.riddleSaid = true; say('החידה: הבקבוק ' + COLOURS[S.answer].name + ' יעביר אותך דרך האש ' + COLOURS[S.answer].e, W(SPOTS.table.x, 1.9, SPOTS.table.z), 5); }
  function douse() {
    if (!active()) return;
    const was = S.flamesT > 0 || S.parted; S.flamesT = 20;
    W(0, 1.3, DOOR_Z(4) + 0.6, v1); burst(v1.x, v1.y, v1.z, 0xbfe4ff, 26, 2, 1.1, 0.26, 0.6); sfx('whoosh');
    if (!was) say('אגואמנטי! הלהבות נמוכות עכשיו, אפשר לעבור 💧'); award(4, 'aguamenti');
  }
  // ---------------- room 5: the mirror ----------------
  function lookMirror() {
    if (S.look) return; S.look = 0.001; S.lookArmed = false;
    let t = 0; const focus = new Vector3(); let said = false;
    setTakeover({ spell: true, update(dt) {
      t += dt; if (!S) { setTakeover(null); return; } S.look = t;
      place(SPOTS.look.x, 0, SPOTS.look.z, Math.PI);
      const c = player.cam; c.yaw = 0.35; c.pitch = 0.12; c.dist = 3.6; c.userControlled = false; c.idle = 0;
      focus.set(0, Y(), SPOTS.look.z - 0.8); c.update(dt, focus, 0, false);
      player.animate(dt, { moving: false }, 0);
      if (t > 1.8 && !said) { said = true; S.looked = true; sfx('chime'); say('במראה: זוג גרבי צמר עבים! 🧦 בדיוק כמו דמבלדור', W(0, 3.2, SPOTS.mirror.z + 0.6), 5); award(5, 'mirror'); }
      if (t > 4.4) setTakeover(null);
    } });
  }

  // ---------------- spells (objects only) ----------------
  const T = [];
  const SPELLKEYS = (freecast && freecast.spells ? freecast.spells.map(s => s.key) : []).filter(k => !['lumos', 'maxima'].includes(k));
  if (FI && Array.isArray(FI.TARGETS)) {
    T.push({ id: 'free-harp', spells: ['leviosa', 'accio', 'alohomora', 'reparo', 'tarantallegra', 'engorgio', 'orchideous', 'rictusempra', 'avis', 'incendio', 'aguamenti'], at: (o) => W(SPOTS.harp.x, 1.2, SPOTS.harp.z, o),
      ok: () => active() && room() === 0 && !S.played, cast: () => playHarp() });
    T.push({ id: 'free-fluffy', spells: SPELLKEYS, at: (o) => W(SPOTS.fluffy.x, 1.3, SPOTS.fluffy.z + 1.6, o), ok: () => active() && room() === 0, cast: (k) => fluffyNo(k || true) });
    T.push({ id: 'free-snare', spells: ['incendio'], at: (o) => W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z, o), ok: () => active() && room() === 1 && !S.snare, cast: () => { S.castHit = true; clearSnare('incendio'); } });
    T.push({ id: 'free-key', spells: ['accio', 'leviosa'], at: (o) => { if (B && B.P) { B.P.keys.sk.getWorldPosition(o); return o; } return o.set(0, -999, 0); }, ok: () => active() && room() === 2 && !S.keyT && !S.open2 && !S.unlockT, cast: (k) => catchKey(k) });
    T.push({ id: 'free-lock', spells: ['alohomora'], at: (o) => W(SPOTS.lock.x, SPOTS.lock.y, SPOTS.lock.z, o), ok: () => active() && room() === 2 && !S.open2 && !S.unlockT && !S.keyT, cast: () => unlock() });
    T.push({ id: 'free-queen', spells: ['reparo'], at: (o) => W(SPOTS.topple.x, 0.4, SPOTS.topple.z + 0.8, o), ok: () => active() && room() === 3 && !S.mended && !S.mendT, cast: () => mendQueen() });
    T.push({ id: 'free-flames', spells: ['aguamenti'], at: (o) => W(0, 1.3, DOOR_Z(4) + 0.6, o), ok: () => active() && room() === 4, cast: () => douse() });
    for (const t of T) FI.TARGETS.push(t);
  }
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  let casts0 = casts();

  // ---------------- taps on the world ----------------
  const scr = { x: 0, y: 0, on: false };
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const near = (v, x, y) => { screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
  function tap(x, y) {
    if (!active()) return false;
    const cur = room(), P = B.P, rr = R();
    if (cur === 0) {
      const dh = near(W(SPOTS.harp.x, 1.1, SPOTS.harp.z, v1), x, y);
      let df = 1e9; for (const h of P.fluffy.heads) { h.getWorldPosition(v2); df = Math.min(df, near(v2, x, y)); }
      df = Math.min(df, near(W(SPOTS.fluffy.x, 1.0, SPOTS.fluffy.z - 0.4, v2), x, y));
      if (dh < rr * 1.3 && dh <= df) { if (!S.played) playHarp(); else tone(784, 0.4); return true; }
      if (df < rr * 2.2) { fluffyNo(false); return true; }
      return false;
    }
    if (cur === 1) { if (!S.snare && near(W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z, v1), x, y) < rr * 2) { say('הצמח בורח מאור! נסה לומוס 💡'); return true; } return false; }
    if (cur === 2) {
      if (!S.keyT && !S.open2) { P.keys.sk.getWorldPosition(v1); if (near(v1, x, y) < rr * 1.25) { catchKey('tap'); return true; } }
      for (let k = 0; k < P.keys.NK; k++) { P.keys.keys.getMatrixAt(k, mO.matrix); v2.setFromMatrixPosition(mO.matrix).add(B.g.position); if (near(v2, x, y) < rr) { sfx('tink', k); if (!S.open2 && !S.keyT) say('זה מפתח קטן 🙂 המפתח הגדול עם הכנף הכחולה פותח את הדלת'); return true; } }
      return false;
    }
    if (cur === 3) {
      if (!S.mended && !S.mendT) { P.queen.g.getWorldPosition(v1); v1.z += 0.8; v1.y += 0.3; if (near(v1, x, y) < rr * 1.4) { say('המלכה הלבנה נפלה והכתר שלה נסדק... 🏺'); return true; } }
      const ndc = new Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), rc = new Raycaster(); rc.setFromCamera(ndc, camera);
      const hit = rc.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -Y()), v1); if (!hit) return false;
      const c = Math.round((v1.x - BOARD.x0) / BOARD.s), r = Math.round((BOARD.z0 - v1.z) / BOARD.s);
      if (c < 0 || c > 5 || r < 0 || r > 5) return false;
      return moveKnight(c, r);
    }
    if (cur === 4) {
      let bi = -1, bd = 1e9; P.potions.bpos.forEach((b, i) => { const dd = near(v1.copy(b).add(B.g.position).setY(Y() + b.y + 0.3), x, y); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0 && bd < rr) { tapBottle(bi); return true; }
      if (near(W(SPOTS.table.x, 1.0, SPOTS.table.z + 0.3, v1), x, y) < rr) { riddle(); return true; }
      return false;
    }
    return false;
  }
  const view = document.getElementById('view');
  let down = null;
  if (view) {
    view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
    view.addEventListener('pointerup', (e) => {
      const d0 = down; down = null;
      if (!d0 || d0.id !== e.pointerId || !active() || isModal() || isTakeover()) return;
      if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      log.taps++;
      try { tap(e.clientX, e.clientY); } catch (er) { log.errors++; console.warn('[corridor] tap failed -', er && er.message || er); }
    }, { passive: true });
  }

  // ---------------- per frame ----------------
  function setBarrier(i, open) { const b = B.barriers[i]; if (b) { b.hw = open ? 0 : 1.2; b.hd = open ? 0 : 0.5; } }
  function update(dt) {
    tt += dt;
    const r = interiors.room;
    if (r !== lastRoom) {
      lastRoom = r; B = interiors.active === 'chambers' && r && r.group ? r.group.userData.adv || null : null;
      S = B && B.free ? fresh() : null; if (S) log.visits++;
    }
    if (!B) return;
    if (!B.free) {   // a quest-built interior after quest 1 stopped (paused / left / finished): rebuild it for free play where Harry stands
      if (!CORRIDOR.quest && rebuildFor !== r && !isTakeover() && !isModal()) { rebuildFor = r; log.rebuilds++; interiors.enter('chambers', { x: player.pos.x, z: player.pos.z, yaw: player.yaw }); }
      return;
    }
    if (CORRIDOR.quest || !S) return;   // quest 1 started while in here: it moves Harry itself
    const P = B.P, cur = room(), busy = isModal() || isTakeover();
    for (let i = 0; i < N; i++) B.rooms[i].visible = Math.abs(i - cur) <= 1;
    // spells watched by meaning: light in the snare room
    const n = casts();
    if (n !== casts0) {
      casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null, hit = S.castHit; S.castHit = false;
      if (cur === 1 && !S.snare && dist(SPOTS.snare.x, SPOTS.snare.z) < 8) { if (k === 'lumos' || k === 'maxima' || k === 'incendio') clearSnare(k); else if (!hit) say('הצמח אוהב חושך... נסה לחש של אור 💡'); }
    }

    // 0: Fluffy dozes (one eye half open, slow breaths) or sleeps deeply (z z z); the harp shimmers; the trapdoor
    const f = P.fluffy, deep = S.played, br = Math.sin(tt * (deep ? 1.1 : 1.5));
    f.body.scale.set(1, 1 + br * 0.035, 1 + br * 0.015);
    f.heads.forEach((h, i) => { const ph = Math.sin(tt * 1.3 + i * 2.1), up = i === 1 && !deep ? 0.18 : 0; h.position.y = h.userData.base.y + ph * 0.04 + up * 0.4; h.rotation.x += ((h.userData.base.rx - up) + ph * 0.04 - h.rotation.x) * Math.min(1, dt * 3); });
    if (f.eye) f.eye.visible = !deep && (tt % 4.6) > 0.18;   // a slow blink now and then
    if (B.rooms[0].visible) {
      P.zs.count = deep ? 6 : 0;
      if (deep) { for (let k = 0; k < 6; k++) { const u = ((tt * 0.35 + k / 6) % 1), hx = f.heads[k % 3]; hx.getWorldPosition(v1); v1.y -= Y(); dO.position.set(v1.x + u * 0.5 + Math.sin(u * 6 + k) * 0.15, v1.y + 0.4 + u * 1.4, v1.z + 0.2); dO.quaternion.copy(camera.quaternion); dO.scale.setScalar(0.5 + u * 0.9 * (1 - u)); dO.rotation.set(0, 0, 0); dO.quaternion.copy(camera.quaternion); dO.updateMatrix(); P.zs.setMatrixAt(k, dO.matrix); } P.zs.instanceMatrix.needsUpdate = true; }
    }
    if (S.harp > 0) { S.harp += dt; P.harp.strings.material.color.setHSL(0.13, 1, 0.75 + Math.sin(tt * 30) * 0.2); if (Math.random() < dt * 10) { P.harp.g.getWorldPosition(v1); emit(v1.x + (Math.random() - 0.5) * 0.6, v1.y + 1.4, v1.z, (Math.random() - 0.5) * 0.4, 0.6, 0, 1.4, 0.2, 0xffe070, 0); } if (S.harp > 4) { S.harp = 0; P.harp.strings.material.color.setHex(0xfff2c0); } }
    const lid = P.trap.pivot; lid.rotation.x += ((S.played ? -1.9 : 0) - lid.rotation.x) * Math.min(1, dt * 3);
    if (cur === 0) {
      const dT = dist(SPOTS.trap.x, SPOTS.trap.z);
      if (dT > 1.6) { S.hopArmed = true; S.trapSay = true; }
      if (S.played && S.hopArmed && !S.hop && !busy && dT < 0.75 && lid.rotation.x < -1.2) hopDown();
      else if (!S.played && S.trapSay && dT < 1.2) { S.trapSay = false; say('הדלת ברצפה סגורה 🙂 פלאפי צריך לישון עמוק... נגן בנבל 🎵', W(SPOTS.trap.x, 1.2, SPOTS.trap.z)); }
      if (!S.played && dist(SPOTS.harp.x, SPOTS.harp.z) < 2.2) fun.offer('free-harp', '🎵', 1, playHarp);
    }
    // 1: the snare curtain; the ladder back up
    const cg = P.snare.curtain;
    if (cur >= 2 && !S.snare && Math.abs(player.pos.z - DOOR_Z(1)) < 3.5) clearSnare('back', true);   // coming back from the far side
    if (S.snare > 0) { cg.scale.y += (0.06 - cg.scale.y) * Math.min(1, dt * 2); cg.position.y = 3.2 * (1 - cg.scale.y); P.snare.room.scale.y += (0.7 - P.snare.room.scale.y) * Math.min(1, dt * 2); }
    else { cg.scale.y = 1 + Math.sin(tt * 1.2) * 0.02; cg.position.y = 0; }
    setBarrier(1, cg.scale.y < 0.3);
    if (cur === 1) {
      if (!S.snare && dist(SPOTS.snare.x, SPOTS.snare.z) < 3.2) fun.offer('free-snare', '💡', 1, () => clearSnare('prompt'));
      const dL = dist(SPOTS.ladder.x, SPOTS.ladder.z - 0.45);
      if (dL > 1.8) S.ladderArmed = true;
      if (dL < 1.8) fun.offer('free-ladder', '🪜', 1.5, () => { if (!isTakeover()) climbUp(); });
      if (S.ladderArmed && !busy && dL < 0.6) climbUp();
    }
    // 2: keys fly; the special key comes to Harry then to the lock; Alohomora opens the lock straight away
    const K = P.keys;
    if (cur >= 3 && !S.open2 && !S.unlockT && !S.keyT && Math.abs(player.pos.z - DOOR_Z(2)) < 3.5) unlock(true);
    if (B.rooms[2].visible) {
      const Z2 = zc(2), sp = 0.6, ks = innerWidth <= 560 ? 1.3 : 1;
      for (let k = 0; k < K.NK; k++) {
        const a = tt * (0.25 + (k % 4) * 0.05) * sp + k * 0.57;
        dO.position.set(Math.sin(a * 1.3 + k) * 3.2, 1.6 + Math.sin(a * 2.1 + k * 0.7) * 1.2, Z2 + Math.cos(a + k * 0.3) * 3.0); dO.rotation.set(0, a * 2 + k, Math.sin(a * 3) * 0.3); dO.scale.setScalar(ks); dO.updateMatrix();
        K.keys.setMatrixAt(k, dO.matrix); dO.scale.set(ks, ks * (1 + Math.sin(tt * 18 + k) * 0.5), ks); dO.updateMatrix(); K.wings.setMatrixAt(k, dO.matrix);
      }
      K.keys.instanceMatrix.needsUpdate = true; K.wings.instanceMatrix.needsUpdate = true;
      if (!S.keyT) { if (!S.open2) { const a = tt * 0.3 * sp; K.sk.position.set(Math.sin(a) * 2.2, 1.5 + Math.sin(a * 1.7) * 0.35, Z2 + 0.8 + Math.cos(a * 0.8) * 1.6); K.sk.rotation.set(0, a * 2.5, Math.sin(tt * 2) * 0.2); K.sk.children[1].scale.y = 1 + Math.sin(tt * 14) * 0.4; K.sk.scale.setScalar(ks); } }
      else {
        S.keyT += dt; const t = S.keyT, L = SPOTS.lock;
        K.sk.children[1].scale.y = 1 + Math.sin(tt * 14) * 0.4;
        if (t < 1.6) { v1.set(player.pos.x + Math.sin(player.yaw) * 0.7, player.pos.y - Y() + 1.3 + Math.sin(tt * 4) * 0.08, player.pos.z + Math.cos(player.yaw) * 0.7); K.sk.position.lerp(v1, Math.min(1, dt * 4)); K.sk.rotation.y += dt * 3; }   // (room group is at FLOOR_Y: local y)
        else { K.sk.position.lerp(v1.set(L.x, L.y, L.z + 0.15), Math.min(1, dt * 4)); K.sk.rotation.set(0, Math.PI / 2, t > 2.6 ? Math.min(1.5, (t - 2.6) * 4) : 0); }
        if (t > 3.0 && !S.open2) { S.open2 = true; sfx('clank'); award(2, S.keyHow); }
        if (t > 4.2) K.sk.visible = false;
      }
    }
    if (S.unlockT > 0) { S.unlockT += dt; if (S.unlockT > 0.6) S.open2 = true; }
    if (S.open2) K.hinge.rotation.y += (1.7 - K.hinge.rotation.y) * Math.min(1, dt * 2.5);
    setBarrier(2, K.hinge.rotation.y > 1.0);
    // 3: chess: the knight's lit squares, the hop, the mended queen
    const C = P.chess;
    setBarrier(3, true);   // free play: the door rook stands aside, the way on is open
    if (B.rooms[3].visible) {
      const L = cur === 3 ? lit() : [];
      L.forEach(([c, r2], i) => { sq(c, r2, v1); dO.position.set(v1.x, 0.03, v1.z); dO.rotation.set(0, 0, 0); dO.scale.setScalar(1); dO.updateMatrix(); C.hl.setMatrixAt(i, dO.matrix); });
      C.hl.count = L.length; C.hl.instanceMatrix.needsUpdate = true; C.hl.material.opacity = 0.4 + Math.sin(tt * 4) * 0.2;
      if (S.hopT >= 0) {
        S.hopT += dt; const k = Math.min(1, S.hopT / 0.9); sq(S.from[0], S.from[1], v1); sq(S.knight[0], S.knight[1], v2);
        C.knightM.position.set(v1.x + (v2.x - v1.x) * k, Math.sin(k * Math.PI) * 0.8, v1.z + (v2.z - v1.z) * k);
        if (k >= 1) { S.hopT = -1; sfx('drum'); }
      }
      const Q = P.queen;
      if (Q && S.mendT > 0) {
        S.mendT += dt; const t = S.mendT;
        Q.g.rotation.x += (0 - Q.g.rotation.x) * Math.min(1, dt * 2.2);
        if (t > 0.5) { Q.g.updateMatrixWorld(); Q.g.localToWorld(v1.set(Math.sin(5.6) * 0.17, 1.69, Math.cos(5.6) * 0.17)); Q.g.parent.worldToLocal(v1); Q.chip.position.lerp(v1, Math.min(1, dt * 3)); Q.chip.rotation.x += dt * 6; }
        if (t > 1.8 && !S.mended) { S.mended = true; Q.chip.visible = false; Q.full.visible = true; Q.g.rotation.x = 0; Q.g.getWorldPosition(v1); burst(v1.x, v1.y + 1.7, v1.z, 0xffe070, 24, 1.8, 1.0, 0.24, -0.8); sfx('tada'); say('רפרו! המלכה הלבנה עומדת שוב, והכתר שלם 👑'); award(3, 'reparo'); }
      }
    }
    // 4: potions: flames down while Aguamenti lasts / after the riddle bottle / when Harry comes back from the mirror
    const Pp = P.potions;
    if (S.flamesT > 0) S.flamesT -= dt;
    const back4 = cur === 5 && Math.abs(player.pos.z - DOOR_Z(4)) < 3.5, inDoor = Math.abs(player.pos.z - DOOR_Z(4)) < 1.6;
    const low = S.parted || S.flamesT > 0 || back4 || (inDoor && Pp.flames[0].scale.x < 0.5);
    for (const fl of Pp.flames) { if (low) fl.scale.x += (0.02 - fl.scale.x) * Math.min(1, dt * 2); else { fl.scale.x += (1 - fl.scale.x) * Math.min(1, dt * 1.2); fl.scale.y = 1 + Math.sin(tt * 7 + fl.position.x) * 0.06; } }
    setBarrier(4, Pp.flames[0].scale.x < 0.2 || (inDoor && Pp.flames[0].scale.x < 0.5));
    if (B.rooms[4].visible) {
      let any = false;
      S.puff.forEach((p, i) => { if (!(p > 0)) return; any = true; S.puff[i] = p + dt; const b = Pp.bpos[i], k = Math.min(1, S.puff[i] / 0.8); dO.position.set(b.x, b.y + Math.sin(k * Math.PI) * 0.18, b.z); dO.rotation.set(0, (i === S.answer && S.parted) ? 0 : Math.sin(k * Math.PI * 2) * 0.3, 0); dO.scale.setScalar(1); dO.updateMatrix(); Pp.bottles.setMatrixAt(i, dO.matrix); if (k >= 1) S.puff[i] = 0; });
      if (any) Pp.bottles.instanceMatrix.needsUpdate = true;
      if (cur === 4 && !S.riddleSaid && player.pos.z < zc(4) + 2.5 && !busy) riddle();
    }
    // 5: the mirror: mist, the socks while Harry looks; walking up starts the look, walking away (3 m) re-arms it
    if (B.rooms[5].visible) {
      if (S.look && !isTakeover() && dist(SPOTS.look.x, SPOTS.look.z) > 3) { S.look = 0; S.lookArmed = true; }
      if ((S.mtick += dt) > 0.12) { S.mtick = 0; drawMirror(P.mirror.canvas, S.look ? Math.min(1, S.look / 1.5) : 0, tt, 'socks'); P.mirror.tex.needsUpdate = true; }
      if (cur === 5 && S.lookArmed && !busy && dist(SPOTS.look.x, SPOTS.look.z) < 1.3) lookMirror();
    }
  }

  const api = {
    state: () => {
      if (!S || !B) return { active: false, room: null, visits: log.visits, paid: [...PAID], quest: CORRIDOR.quest, ...log, acts: log.acts.slice() };
      const bar = B.barriers.map(b => (b ? b.hw === 0 : null));
      return { active: active(), free: !!B.free, quest: CORRIDOR.quest, room: room(), visits: log.visits, paid: [...PAID], played: S.played, asleep: S.played, eye: !!(B.P.fluffy.eye && B.P.fluffy.eye.visible), lid: +B.P.trap.pivot.rotation.x.toFixed(2),
        hop: !!S.hop, snare: S.snare > 0, curtain: +B.P.snare.curtain.scale.y.toFixed(2), key: S.keyT > 0, keyHow: S.keyHow, unlocked: S.unlockT > 0, door2: S.open2, hinge: +B.P.keys.hinge.rotation.y.toFixed(2),
        knight: S.knight.slice(), moves: S.moves, lit: lit(), mended: S.mended, mending: S.mendT > 0, flamesLow: S.flamesT > 0, flamesT: +Math.max(0, S.flamesT).toFixed(1), flames: +B.P.potions.flames[0].scale.x.toFixed(2), parted: S.parted, answer: S.answer, answerKey: COLOURS[S.answer].k,
        look: S.look > 0, looked: S.looked, open: bar, ...log, acts: log.acts.slice() };
    },
    screen,
    harpW: () => W(SPOTS.harp.x, 1.1, SPOTS.harp.z),
    fluffyW: () => { if (!B) return null; const o = new Vector3(); B.P.fluffy.heads[1].getWorldPosition(o); return o; },
    snareW: () => W(SPOTS.snare.x, SPOTS.snare.y, SPOTS.snare.z),
    keyW: () => { if (!B) return null; const o = new Vector3(); B.P.keys.sk.getWorldPosition(o); return o; },
    smallKeyW: (k = 0) => { if (!B) return null; const m = new Object3D(); B.P.keys.keys.getMatrixAt(k, m.matrix); return new Vector3().setFromMatrixPosition(m.matrix).add(B.g.position); },
    squareW: (c, r) => { const o = sq(c, r); return o.set(o.x, Y() + 0.02, o.z); },
    bottleW: (i) => { if (!B) return null; const b = B.P.potions.bpos[i]; return new Vector3(b.x, Y() + b.y + 0.3, b.z); },
    queenW: () => W(SPOTS.topple.x, 0.4, SPOTS.topple.z + 0.8),
    spots: SPOTS, doorZ: DOOR_Z,
    _tap: (x, y) => tap(x, y),
  };
  return { update, api };
}
