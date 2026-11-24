// Book 1, adventure 3: "נורברט הדרקון הקטן" (Norbert the baby dragon). Data for adventures.js + the scene code.
// Silly and warm, never scary. Spells act on OBJECTS only (the hearth, the hay); Norbert is only tapped (a spell cast
// near him gets a kind bubble). Everything of the quest exists only while it runs: the kettle + egg, the nest, the hay,
// the bowl, the bucket and the crate are added beside the fieldstone Floo hearth behind Hagrid's hut (< 3k tris); the
// hearth's own fire is out until Incendio lights it (and always burns during a Floo trip; back to normal at the end).
// Steps: 1 go to the hearth behind the hut (arrow; the Floo hearth works) -> 2 Incendio on the hearth (a real wheel
// target; the 🔥 prompt is the fallback): the egg rocks, cracks, Norbert pops out and sneezes tiny gold sparks -> 3 keep
// him happy: a thought bubble shows 3 / 4 / 5 wants (level 1 fixed order + glow, levels 2-3 random): 🍗 tap the bowl,
// 😄 tap his tummy (he giggles and rolls over), 🔥 hiccup: the hay smokes a little -> Aguamenti on it (or 💧) -> 4 tap
// the crate: he hops in with his teddy; the crate floats behind Harry up to the Astronomy Tower -> 5 Lumos / Periculum
// (or 💡) as the signal: four far broom riders with lanterns glide in, lift the crate on a harness, Norbert waves, away.
import { Vector3, Matrix4, Quaternion, Euler, Group } from 'three';
import { buildNorbert, buildEgg, buildHutProps, buildCrate, buildBubble, buildRiders, triCount,
  KETTLE, EGG_Y, NEST, HAY, BOWL, BUCKET, CRATE, SLAB_Y, NS, WANTS } from './adventure-norbert-build.js';

const RON = { ico: '👦', name: 'רון' };
const HAGRID = '🧔 האגריד';
const NORB = '🐉 נורברט';
const SUB = 'hpAdvNorbert1';   // { crate: 1 } while Norbert rides in the floating crate (a reload brings the crate back behind Harry)
export const NORBERT = {
  id: 'norbert', title: 'נורברט הדרקון הקטן', ico: '🐉', col: '#5a2a10', col2: '#d8803a', helper: RON, confetti: ['✨', '⭐', '🐉', '🥚'],
  pic: [['🐉', 0.5, 0.55, 74], ['🥚', 0.2, 0.3, 30], ['🏡', 0.82, 0.3, 30]],
  intro: [
    'להאגריד יש סוד גדול... 🤫',
    'הוא מצא ביצת דרקון אמיתית, והיא עומדת לבקוע!',
    'בוא נעזור לו מאחורי הבקתה. אני רון, ואני אעזור לך! ✨',
  ],
  steps: [
    { line: 'לך אל האח מאחורי הבקתה של האגריד 🏡', hints: ['הבקתה של האגריד ליד היער 🏡', 'לך אחרי החץ הזהוב אל האח מאחורי הבקתה', 'אפשר גם לטוס ברשת הפלו או במפה 🔥🗺️'], glowL1: true },
    { line: 'הטל אינסנדיו על האח מתחת לביצה 🔥', hints: ['הביצה צריכה חום! 🔥', 'בחר אינסנדיו בגלגל הלחשים ונופף בשרביט מול האח', 'הלחש הזוהר בגלגל: אינסנדיו 🔥 או לחץ על כפתור האש'], spell: 'incendio', glowL1: true },
    { line: 'תעשה את נורברט שמח: מה הוא רוצה? 💭', hints: ['תסתכל בבועה מעל נורברט 💭', '🍗 קערה, 😄 בטן, 🔥 קש מעשן', 'הדבר הנכון זוהר עכשיו. גע בו!'] },
    { line: 'שים את נורברט בארגז וקח אותו למגדל 📦', hints: ['גע בארגז, ונורברט יקפוץ פנימה 📦', 'עכשיו למגדל האסטרונומיה. הארגז ירחף אחריך', 'אפשר לטוס במפה אל מגדל הכוכבים 🔭'], glowL1: true },
    { line: 'הטל לומוס כדי לתת סימן לרוכבים 💡', hints: ['החברים של צ\'רלי מחכים לסימן באור 💡', 'בחר לומוס בגלגל ונופף בשרביט', 'הלחש הזוהר בגלגל: לומוס 💡 או לחץ על כפתור האור'], spell: 'lumos', glowL1: true },
  ],
  create: (ctx) => norbertScene(ctx),
  art: drawNorbertCard,
};

// the reward card picture: a round green baby dragon with big eyes sitting in a broken egg, a little gold spark (canvas)
function drawNorbertCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx, cy + 10);
  x.fillStyle = '#e0a050'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 30, 0); x.lineTo(s * 92, -40); x.quadraticCurveTo(s * 80, -10, s * 92, 10); x.quadraticCurveTo(s * 60, 10, s * 30, 30); x.fill(); }
  E(0, 30, 56, 52, '#5f9e4c'); E(0, 38, 36, 36, '#f0dca0');
  E(0, -36, 58, 52, '#5f9e4c'); E(0, -18, 32, 22, '#74b05c');
  for (const s of [-1, 1]) { E(s * 24, -46, 19, 22, '#ffffff'); E(s * 25, -45, 13, 15, '#3a2418'); E(s * 25, -45, 8, 10, '#1a1612'); E(s * 20, -51, 4, 4, '#ffffff'); E(s * 42, -24, 9, 5, '#f08a8a');
    x.fillStyle = '#f4e6c0'; x.beginPath(); x.moveTo(s * 18, -80); x.lineTo(s * 28, -102); x.lineTo(s * 34, -78); x.fill(); }
  x.strokeStyle = '#6a2a24'; x.lineWidth = 4; x.beginPath(); x.arc(0, -16, 14, 0.3, Math.PI - 0.3); x.stroke();
  x.fillStyle = '#eedcb4'; x.beginPath(); x.moveTo(-70, 40); for (let k = 0; k <= 10; k++) x.lineTo(-70 + k * 14, k % 2 ? 40 : 56); x.lineTo(70, 40); x.quadraticCurveTo(70, 110, 0, 112); x.quadraticCurveTo(-70, 110, -70, 40); x.fill();
  for (const [px, py] of [[-40, 80], [20, 90], [45, 66], [-12, 70]]) E(px, py, 5, 7, '#8a5a3a');
  x.restore();
  x.save(); x.fillStyle = '#ffd76a'; for (const [sx, sy] of [[cx + 60, cy - 70], [cx + 78, cy - 50], [cx + 50, cy - 92]]) { x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 3 : 8; x.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } x.fill(); } x.restore();
}

const NEED = { 1: 3, 2: 4, 3: 5 };
const WANT_HE = { hungry: 'רעב 🍗', tickle: 'רוצה דגדוגים 😄', hiccup: 'עם שיהוקים 🔥' };
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const readSub = () => { try { const o = JSON.parse(localStorage.getItem(SUB)); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
const writeSub = (o) => { try { if (o) localStorage.setItem(SUB, JSON.stringify(o)); else localStorage.removeItem(SUB); } catch { /* private mode */ } };

function norbertScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera, scene } = ctx;
  const S = { active: false, G: null, hearth: null, fire: null, props: null, egg: null, nor: null, crate: null, bubble: null, riders: null,
    fireLit: false, hatch: 0, hatched: false, eggGone: false, wants: [], wi: 0, want: null, wantT: 0, gap: 0, react: null, smoke: false, hicT: 0, hics: 0, wrong: 0,
    inCrate: false, hop: 0, follow: false, parked: false, towerT: 0, sig: 0, arrived: 0, stepT: 0, t: 0, glowHint: false, casts0: 0, castHit: false, done: {}, tris: {}, sneeze: 0 };
  const lv = () => ctx.level;
  const need = () => NEED[lv()] || 3;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const outdoors = () => !interiors.active;
  const inTower = () => interiors.active === 'tower' && interiors.room && interiors.room.group;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const say = (t, who = HAGRID, sec = 4) => ctx.say(t, who, sec);

  // ---- the hearth behind the hut (floo.js builds it; we only find it by name and never change its code) ----
  function findHearth() {
    if (S.hearth && S.hearth.parent) return S.hearth;
    const h = scene.getObjectByName('floo-hut-hearth'); S.hearth = h || null;
    S.fire = h ? h.getObjectByName('floo-fire') : null;
    return S.hearth;
  }
  // hearth frame -> world (the props group copies the hearth's place and turn)
  const HW = (x, y, z, out = new Vector3()) => { if (!S.G) { const h = findHearth(); if (!h) return out.set(player.pos.x, player.pos.y, player.pos.z); h.updateMatrixWorld(); return out.set(x, y, z).applyMatrix4(h.matrixWorld); } return out.set(x, y, z).applyMatrix4(S.G.matrixWorld); };
  const front = (out = new Vector3()) => HW(-0.4, 0, 3.6, out);   // where Harry stands to see the hearth, the nest and the bowl (a high lens over his shoulder: he never hides the kettle)
  const lookAt = (out = new Vector3()) => HW(-0.3, 0, 0.9, out);
  // a closer lens by the hearth, once per arrival (the player can still zoom); a teleport arms it again
  const lastP = new Vector3(1e9, 0, 0);
  function frameHut(dt) {
    const jump = Math.hypot(player.pos.x - lastP.x, player.pos.z - lastP.z) > 3; lastP.copy(player.pos);
    if (jump) S.framed = false;
    if (S.framed || !S.G || !outdoors() || ctx.step < 0 || ctx.step > 3 || S.follow) return;
    front(v1); if (Math.hypot(player.pos.x - v1.x, player.pos.z - v1.z) > 4) return;
    S.framed = true;
    try { const c = player.cam; if (!c.userControlled) { c.dist = Math.min(c.dist, 6.8); c.pitch = 0.5; } } catch { /* ok */ }
  }
  // the hint bubble moves up while a quest prompt button (🔥 / 💧 / 💡) shows, so it never covers it
  const css = document.createElement('style'); css.id = 'advNorbertCss';
  css.textContent = '@media (min-width:701px){body.inAdv:has(#funPrompt.on) #advHint{bottom:calc(236px + env(safe-area-inset-bottom))}}';
  document.head.appendChild(css);

  // ---- spells: Incendio on the hearth, Aguamenti on the smoking hay (objects only) ----
  const T = [];
  if (FI && Array.isArray(FI.TARGETS)) {
    T.push({ id: 'adv-hearth', spells: ['incendio'], at: (o) => HW(0, 0.7, 0.5, o), ok: () => S.active && outdoors() && ctx.step === 1 && !S.fireLit && !!S.G, cast: () => { S.castHit = true; light(); } });
    T.push({ id: 'adv-hay', spells: ['aguamenti'], at: (o) => HW(HAY.x, SLAB_Y + 0.2, HAY.z, o), ok: () => S.active && outdoors() && ctx.step === 2 && S.want === 'hiccup' && S.smoke && !S.react, cast: () => { S.castHit = true; douse(true); } });
    for (const t of T) FI.TARGETS.push(t);
  }

  // ---- building the hut corner (only while the quest runs, only outdoors) ----
  function dressHut(step) {
    if (S.G || !findHearth()) return;
    const h = S.hearth, G = new Group(); G.name = 'adv-norbert-hut';
    G.position.copy(h.position); G.rotation.y = h.rotation.y; scene.add(G); G.updateMatrixWorld(true); S.G = G;
    S.props = buildHutProps(); G.add(S.props);
    S.tris.props = triCount(S.props);
    if (step <= 1) { S.egg = buildEgg(); S.egg.mesh.position.set(KETTLE.x, EGG_Y, KETTLE.z); G.add(S.egg.mesh); S.tris.egg = triCount(S.egg.mesh); }
    if (!S.crate) { S.crate = buildCrate(); S.tris.crate = triCount(S.crate.g); }
    if (!S.follow) { G.add(S.crate.g); placeCrateAtHut(); }
    S.bubble = buildBubble(); S.bubble.mesh.visible = false; G.add(S.bubble.mesh);
    if (step >= 2 && !S.inCrate) { makeNorbert(); sitInNest(); }
    if (step >= 2) { S.fireLit = true; S.hatched = true; }
  }
  function placeCrateAtHut() {
    const c = S.crate.g; HW(CRATE.x, 0, CRATE.z, v1);
    const gy = player.heightAt ? player.heightAt(v1.x, v1.z) : S.G.position.y;
    c.position.set(CRATE.x, Math.max(-0.2, Math.min(0.6, gy - S.G.position.y)) + 0.0, CRATE.z); c.rotation.set(0, 0.25, 0); c.scale.setScalar(1);
  }
  function makeNorbert() {
    if (S.nor) return S.nor;
    S.nor = buildNorbert(); S.nor.root.scale.setScalar(NS); S.tris.norbert = triCount(S.nor.root);
    return S.nor;
  }
  function sitInNest() { const n = S.nor; if (!n || !S.G) return; S.G.add(n.root); n.root.position.set(NEST.x, SLAB_Y + 0.05, NEST.z); n.root.scale.setScalar(NS); }
  function undressHut() {
    if (S.G && S.G.parent) S.G.parent.remove(S.G);
    S.G = null; S.props = null; S.egg = null; S.bubble = null;
    if (S.nor && !S.inCrate) S.nor = null;
    if (S.crate && !S.follow) S.crate = null;
  }
  // the hearth's own fire: out until Incendio (always lit during a Floo trip, so travel looks right)
  function fireCtl() {
    findHearth(); if (!S.fire) return;
    const floo = document.body.classList.contains('inFloo');
    const want = !S.active || S.fireLit || floo;
    if (S.fire.visible !== want) S.fire.visible = want;
    // the quest's fire is a gentle one under the kettle: the flames sit lower (the Floo's own fire is back for a trip)
    if (S.fireY === undefined) S.fireY = S.fire.position.y;
    const y = S.active && !floo ? S.fireY - 0.55 : S.fireY;
    if (S.fire.position.y !== y) S.fire.position.y = y;
  }

  // while the egg / Norbert / the crate wait at the hut hearth (steps 2-4) the Floo's own 🔥 prompt there stays hidden
  // (a child would open the Floo picker by mistake); Floo travel to and from the hut still works
  function flooMute(on) {
    if (S.flooMuted === on) return;
    try { const f = window.__game && window.__game.floo; if (f && f.suppressPrompt) { f.suppressPrompt('hut', on); S.flooMuted = on; } } catch { /* no Floo */ }
  }
  // ---- step 2: the hatch ----
  function light() {
    if (S.fireLit || ctx.step !== 1) return;
    S.fireLit = true; S.hatch = 0.001; fireCtl(); ctx.poke(); sfx('whoosh'); sfx('chime');
    HW(0, 0.5, 0.5, v1); burst(v1.x, v1.y, v1.z, 0xffa040, 22, 1.6, 0.9, 0.24, -0.4);
    say('אש נעימה! עכשיו מחכים... הביצה זזה! 🥚', HAGRID, 3.5);
  }
  function tickHatch(dt) {
    if (!(S.hatch > 0) || S.hatched) return;
    const t0 = S.hatch; S.hatch += dt; const t = S.hatch, e = S.egg;
    if (e && !S.eggGone) {
      if (t < 2.6) { const a = Math.min(1, t / 2.0); e.mesh.rotation.set(0, 0, Math.sin(t * (6 + t * 3)) * 0.18 * a); if (Math.floor(t0 * 2.2) !== Math.floor(t * 2.2)) sfx('tink', Math.floor(t * 2)); }
    }
    if (t >= 2.6 && !S.nor && S.G) {   // crack! the top flies off as shell bits, Norbert pops up (also when "together" jumps the clock past it)
      if (e && !S.eggGone) { e.mesh.geometry = e.broken; e.mesh.rotation.set(0, 0, 0); }
      sfx('pop'); sfx('sparkle');
      HW(KETTLE.x, EGG_Y + 0.15, KETTLE.z, v1); burst(v1.x, v1.y, v1.z, 0xf4e4c0, 18, 1.8, 1.0, 0.16, -3); burst(v1.x, v1.y + 0.1, v1.z, 0xffd76a, 14, 1.4, 0.9, 0.2, -0.5);
      makeNorbert(); S.G.add(S.nor.root); S.nor.root.position.set(KETTLE.x, EGG_Y - 0.1, KETTLE.z); S.nor.root.scale.setScalar(0.01);
      say('קראק! 🐣 הנה הוא!', HAGRID, 2.5);
    }
    const n = S.nor; if (!n || t < 2.6) return;
    if (t < 3.4) { const k = ease((t - 2.6) / 0.8); n.root.scale.setScalar(NS * (0.2 + 0.8 * k + Math.sin(k * Math.PI) * 0.15)); n.root.position.set(KETTLE.x, EGG_Y - 0.1 + k * 0.12, KETTLE.z); }
    else if (t < 3.9) { n.root.scale.setScalar(NS); }
    else if (t < 5.0) {   // one big hop out of the kettle down into the nest
      const k = ease((t - 3.9) / 1.1);
      n.root.position.set(KETTLE.x + (NEST.x - KETTLE.x) * k, (EGG_Y + 0.02) * (1 - k) + (SLAB_Y + 0.05) * k + Math.sin(k * Math.PI) * 0.6, KETTLE.z + (NEST.z - KETTLE.z) * k);
      if (t0 < 3.9) sfx('boing');
    } else { sitInNest(); }
    if (t0 < 5.4 && t >= 5.4) { S.sneeze = 0.001; }
    if (t0 < 6.4 && t >= 6.4) { say('הוא מכיר את אמא שלו! 💛', HAGRID, 4); sfx('heart'); }
    if (t >= 9.0) { S.hatched = true; done(1); }
  }
  // a sneeze: "אפצ'י!" and a few TINY gold twinkles from his snout (never a flame)
  function sneeze() { const p = snoutW(v1); for (let i = 0; i < 9; i++) emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8, 0.8, 0.09, 0xffd76a, -0.5); sfx('squeak'); }

  // ---- step 3: the wants ----
  function initWants() {
    if (S.wants.length) return;
    const n = need();
    if (lv() === 1) { for (let i = 0; i < n; i++) S.wants.push(WANTS[i % 3]); }
    else {   // levels 2-3: the three kinds in a random order first, then extra wants, never the same twice in a row
      const f = WANTS.slice(); for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [f[i], f[j]] = [f[j], f[i]]; }
      S.wants = f.slice(0, Math.min(3, n));
      while (S.wants.length < n) { const pool = WANTS.filter(w => w !== S.wants[S.wants.length - 1]); S.wants.push(pool[Math.floor(Math.random() * pool.length)]); }
    }
  }
  function nextWant() {
    if (S.wi >= S.wants.length) return;
    S.want = S.wants[S.wi]; S.wantT = 0; S.smoke = false; S.hics = 0; S.hicT = 0.6; ctx.poke();
    if (S.bubble) { S.bubble.set(S.want); }
    sfx('flip');
    const line = { hungry: 'נורברט רעב! 🍗', tickle: 'נורברט רוצה דגדוגים! 😄', hiccup: 'אוי, לנורברט יש שיהוקים! 🔥' }[S.want];
    say(line + (lv() === 1 ? '' : ' מה הוא רוצה?'), HAGRID, 3);
  }
  function choose(kind) {
    if (ctx.step !== 2 || S.react || !S.want) return;
    if (kind === S.want && kind !== 'hiccup') { react(kind); return; }
    S.wrong++;
    if (S.want === 'hungry') ctx.oops('נורברט רעב! 🍗 גע בקערה');
    else if (S.want === 'tickle') ctx.oops('הוא לא רעב עכשיו 🙂 הוא רוצה דגדוגים בבטן! 😄');
    else ctx.oops(S.smoke ? 'הקש מעשן! צריך מים: אגואמנטי על הקש 💧' : 'שיהוק! היק! 🙂 חכה רגע...');
  }
  function react(kind) {
    S.react = { kind, t: 0 }; ctx.poke(); if (S.bubble) S.bubble.mesh.visible = false;
    if (kind === 'hungry') { sfx('munch'); setTimeout(() => sfx('munch'), 450); setTimeout(() => sfx('burp'), 1300); say('ממם! נורברט אוכל הכול! 🍗', HAGRID, 2.6); }
    if (kind === 'tickle') { sfx('giggle', true); setTimeout(() => sfx('giggle', true), 600); say('הי הי הי! 😄 הוא מתגלגל מצחוק!', HAGRID, 2.6); }
    if (kind === 'hiccup') { sfx('chime'); say('השיהוקים עברו! והקש כבר לא מעשן 💧', HAGRID, 2.6); }
  }
  function douse(viaSpell) {
    if (ctx.step !== 2 || S.want !== 'hiccup' || !S.smoke || S.react) return;
    S.smoke = false;
    HW(HAY.x, SLAB_Y + 0.3, HAY.z, v1);
    if (!viaSpell) { const s = player.model.scale.y || 1; for (let i = 0; i < 26; i++) { const k = Math.random(); emit(player.pos.x + (v1.x - player.pos.x) * k, player.pos.y + 1.3 * s + (v1.y - player.pos.y - 1.3 * s) * k + Math.sin(k * Math.PI) * 0.6, player.pos.z + (v1.z - player.pos.z) * k, 0, -0.3, 0, 0.7, 0.14, 0x5ab8ff, -2); } }
    burst(v1.x, v1.y, v1.z, 0x8ad0ff, 18, 1.2, 0.8, 0.16, -3); sfx('noise', 0.5, 0.1, 0, 2400, 0.8);
    react('hiccup');
  }
  function tickWants(dt) {
    if (ctx.step !== 2 || !S.hatched || !S.G) return;
    initWants();
    if (!S.want && !S.react && S.wi < S.wants.length) { S.gap -= dt; if (S.gap <= 0) nextWant(); return; }
    if (S.react) {
      S.react.t += dt;
      const p = noseW(v1);
      if (S.react.kind === 'hungry' && Math.random() < dt * 12) emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6, 0.6, 0.06, 0xa8682a, -3);
      if (S.react.t > 1.0 && S.react.t < 2.2 && Math.random() < dt * 5) emit(p.x, p.y + 0.3, p.z, (Math.random() - 0.5) * 0.3, 0.6, 0, 0.9, 0.16, 0xff8aa0, 0);
      if (S.react.t > 2.8) {
        S.react = null; S.want = null; S.wi++; S.gap = 1.0;
        HW(NEST.x, 1.2, NEST.z, v1); burst(v1.x, v1.y, v1.z, 0xffd76a, 14, 1.4, 0.8, 0.2, -0.6); sfx('sparkle');
        const left = S.wants.length - S.wi;
        try { fun.toast('💚', S.wi + ' / ' + S.wants.length, 900); } catch { /* ok */ }
        if (left <= 0) { say('נורברט כל כך שמח! 💚 אתה מטפל בו נהדר', HAGRID, 4); setTimeout(() => done(2), 1500); }
      }
      return;
    }
    S.wantT += dt;
    if (S.want === 'hiccup') {   // hic! a hop and a few tiny gold sparks that land on the hay; after two the hay smokes a little
      S.hicT -= dt;
      if (S.hicT <= 0) {
        S.hicT = 1.5; S.hics++; sfx('hic'); S.hicJump = 0.25;
        const p = snoutW(v1), hq = HW(HAY.x, SLAB_Y + 0.25, HAY.z, v2);
        for (let i = 0; i < 5; i++) emit(p.x, p.y, p.z, (hq.x - p.x) * 1.2 + (Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.4, (hq.z - p.z) * 1.2 + (Math.random() - 0.5) * 0.3, 0.8, 0.07, 0xffd76a, -2.5);
        if (S.hics >= 2 && !S.smoke) { S.smoke = true; say('אוי! הניצוצות הקטנים נחתו על הקש, והוא מעשן קצת. אגואמנטי! 💧', HAGRID, 4); }
      }
      if (S.smoke && Math.random() < dt * 5) { HW(HAY.x + (Math.random() - 0.5) * 0.15, SLAB_Y + 0.3, HAY.z + (Math.random() - 0.5) * 0.15, v1); emit(v1.x, v1.y, v1.z, (Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.15, (Math.random() - 0.5) * 0.08, 1.8, 0.22, 0x8a8a8a, 0.05); }   // one small grey wisp
    }
  }

  // ---- step 4: the crate ----
  function hopIn() {
    if (S.inCrate || S.hop || ctx.step !== 3 || !S.nor || !S.crate) return;
    S.hop = 0.001; ctx.poke(); sfx('boing');
    say('נורברט קופץ לארגז עם הדובי שלו! 🧸', HAGRID, 3);
  }
  function tickHop(dt) {
    if (!(S.hop > 0) || S.inCrate) return;
    S.hop += dt; const k = ease(Math.min(1, S.hop / 1.1)), n = S.nor, c = S.crate.g;
    const cy = c.position.y + 0.08;
    n.root.position.set(NEST.x + (c.position.x - 0.12 - NEST.x) * k, (SLAB_Y + 0.05) * (1 - k) + cy * k + Math.sin(k * Math.PI) * 0.9, NEST.z + (c.position.z - NEST.z) * k);
    if (S.hop >= 1.1) { putInCrate(); startFollow(true); }
  }
  function putInCrate() {
    makeNorbert(); const n = S.nor, c = S.crate.g; c.add(n.root); n.root.position.set(-0.12, 0.06, 0.02); n.root.rotation.set(0, 0, 0); n.root.scale.setScalar(NS * 0.85 / (c.scale.x || 1)); S.inCrate = true;
  }
  function startFollow(fresh) {
    const c = S.crate.g; c.updateMatrixWorld(true); c.getWorldPosition(v1);
    scene.add(c); c.position.copy(v1); c.rotation.set(0, 0, 0); S.follow = true; writeSub({ crate: 1 });
    if (fresh) { sfx('sparkle'); burst(v1.x, v1.y + 0.4, v1.z, 0xffd76a, 18, 1.4, 0.9, 0.2, -0.4); say('עכשיו למגדל האסטרונומיה! הארגז ירחף אחריך 📦✨', HAGRID, 4); }
  }
  // the floating crate: a little behind and beside Harry, bobbing; in the tower it settles on its spot for the riders
  const towerSpot = (out) => out.set(0, 0, -1.6).add(interiors.room.group.position);
  function tickCrate(dt) {
    if (!S.follow || !S.crate) return;
    const c = S.crate.g;
    if (S.sig > 0) return;   // the riders own it now
    let tx, ty, tz, yaw;
    if (inTower() && ctx.step === 4) { towerSpot(v1); tx = v1.x; ty = v1.y + (S.parked ? 0 : 0.4); tz = v1.z; yaw = 0; S.towerT += dt; if (S.towerT > 2.0 && !S.parked) { S.parked = true; sfx('pop'); } }
    else { const f = player.yaw, s = player.model.scale.y || 1; tx = player.pos.x - Math.sin(f) * 1.7 + Math.cos(f) * 0.7; tz = player.pos.z - Math.cos(f) * 1.7 - Math.sin(f) * 0.7; ty = player.pos.y + 0.55 * s + Math.sin(S.t * 2.2) * 0.08; yaw = f; S.parked = false; S.towerT = 0; }
    const d = Math.hypot(tx - c.position.x, tz - c.position.z) + Math.abs(ty - c.position.y);
    if (d > 9) c.position.set(tx, ty, tz);
    else { const k = 1 - Math.exp(-3 * dt); c.position.x += (tx - c.position.x) * k; c.position.y += (ty - c.position.y) * k; c.position.z += (tz - c.position.z) * k; }
    c.rotation.y += (yaw - c.rotation.y) * Math.min(1, dt * 2);
    if (!S.parked && Math.random() < dt * 4) emit(c.position.x + (Math.random() - 0.5) * 0.7, c.position.y - 0.05, c.position.z + (Math.random() - 0.5) * 0.5, 0, -0.2, 0, 0.7, 0.12, 0xffe07a, 0);
  }

  // ---- step 5: the signal and the riders ----
  function signal() {
    if (S.sig || ctx.step !== 4 || !inTower() || !S.crate) return;
    S.sig = 0.001; ctx.poke(); sfx('chime');
    towerSpot(v1); S.crate.g.position.set(v1.x, v1.y, v1.z); S.crate.g.rotation.set(0, 0, 0); S.parked = true;
    if (!S.riders) { S.riders = buildRiders(4); scene.add(S.riders.g); S.tris.riders = triCount(S.riders.g); }
    // turn Harry to the crate and put the lens low behind him, looking up a little at the sky over the far wall
    try { const dx = v1.x - player.pos.x, dz = v1.z - player.pos.z; if (Math.hypot(dx, dz) > 0.5) player.yaw = Math.atan2(dx, dz); const c = player.cam; c.reset(player.yaw); c.pitch = -0.15; c.dist = 6; c.userControlled = false; } catch { /* ok */ }
    HW(0, 0, 0, v2); void v2;
    say('הסימן! תראה, הם מגיעים מהשמיים! 🧹🏮', RON.ico + ' ' + RON.name, 3.5);
  }
  const RO = [[-1.0, -0.7], [1.0, -0.7], [-1.0, 0.7], [1.0, 0.7]];
  const _M = new Matrix4(), _Q = new Quaternion(), _E = new Euler(), _S = new Vector3(1, 1, 1), _P = new Vector3();
  function tickRiders(dt) {
    if (!(S.sig > 0) || !S.riders) return;
    const t0 = S.sig; S.sig += dt; const t = S.sig, Rd = S.riders, c = S.crate.g;
    if (!inTower()) return;
    towerSpot(v1);   // the crate's spot on the floor
    const HOV = 4.6;
    let liftY = 0;
    for (let i = 0; i < Rd.n; i++) {
      const [ox, oz] = RO[i];
      let x, y, z, yaw = 0, pitch = 0;
      if (t < 5.5) {   // glide in from far and high over the far wall, in a gentle curve
        const k = ease(t / 5.5), side = (i % 2 ? 1 : -1) * (1 - k) * 8;
        x = v1.x + ox + side; y = v1.y + HOV + (1 - k) * 22; z = v1.z + oz - (1 - k) * 34; yaw = 0; pitch = (1 - k) * 0.35;
      } else if (t < 10.5) {   // hover over the crate
        x = v1.x + ox + Math.sin(t * 1.3 + i) * 0.08; y = v1.y + HOV + Math.sin(t * 2 + i * 1.7) * 0.1; z = v1.z + oz; yaw = 0;
      } else {   // and away to the reserve: up and over the far wall, getting small
        const k = ease((t - 10.5) / 5.5);
        x = v1.x + ox; y = v1.y + HOV + k * 26; z = v1.z + oz - k * 42; yaw = Math.PI; pitch = -0.3 * k;
      }
      _E.set(pitch, yaw, Math.sin(t * 1.7 + i) * 0.06); _Q.setFromEuler(_E); _P.set(x, y, z);
      _M.compose(_P, _Q, _S); Rd.riders.setMatrixAt(i, _M);
      // the lantern hangs at the broom's front
      v2.set(0, -0.25, 0.65).applyQuaternion(_Q).add(_P); _M.compose(v2, _Q, _S); Rd.lantern.setMatrixAt(i, _M);
      // the harness rope: from the broom down to a corner of the crate
      const ropeK = t < 5.5 ? 0 : Math.min(1, (t - 5.5) / 1.2);
      const cx = c.position.x + ox * 0.4, cy = c.position.y + 0.5, cz = c.position.z + oz * 0.28;
      Rd.pos[i * 6] = x; Rd.pos[i * 6 + 1] = y - 0.1; Rd.pos[i * 6 + 2] = z;
      Rd.pos[i * 6 + 3] = x + (cx - x) * ropeK; Rd.pos[i * 6 + 4] = y - 0.1 + (cy - y + 0.1) * ropeK; Rd.pos[i * 6 + 5] = z + (cz - z) * ropeK;
      if (i === 0) liftY = y;
    }
    Rd.riders.instanceMatrix.needsUpdate = true; Rd.lantern.instanceMatrix.needsUpdate = true; Rd.ropes.geometry.attributes.position.needsUpdate = true;
    Rd.ropes.visible = t > 5.5;
    // the crate: lifted on the harness from 7 s, then carried away under them
    if (t > 7.0) { const k = ease(Math.min(1, (t - 7.0) / 2.0)); const want = v1.y + k * 2.4 + (t > 10.5 ? (liftY - (v1.y + HOV)) : 0); c.position.y = want; if (t > 10.5) { const k2 = ease((t - 10.5) / 5.5); c.position.z = v1.z - k2 * 42; } }
    if (t0 < 5.5 && t >= 5.5) { say('ארבעה רוכבים עם פנסים! החברים של צ\'רלי 🏮', RON.ico + ' ' + RON.name, 3); sfx('whoosh'); }
    if (t0 < 7.2 && t >= 7.2) { say('להתראות, הארי! 👋🐉', NORB, 3); sfx('squeak'); }
    if (t0 < 11.0 && t >= 11.0) { say('סניף... 🥲 להתראות, נורברט! תהיה דרקון טוב! 💚', HAGRID, 4.5); tone(392, 0.4, 0, 'sine', 0.08, 330); }
    if (t > 15.0 && !S.gone) { S.gone = true; c.visible = false; Rd.g.visible = false; }
    if (t > 16.0) done(4);
  }

  // ---- Norbert's little life: breathing, looking at Harry, wings, reactions ----
  const local = new Vector3();
  function snoutW(out) { const n = S.nor; if (!n) return out.set(0, 0, 0); n.root.updateMatrixWorld(); return out.set(0, 0.45, 0.32).applyMatrix4(n.root.matrixWorld); }
  function noseW(out) { return snoutW(out); }
  function tummyW(out = new Vector3()) { const n = S.nor; if (!n) return null; n.root.updateMatrixWorld(); return out.set(0, 0.2, 0.15).applyMatrix4(n.root.matrixWorld); }
  function animNorbert(dt) {
    const n = S.nor; if (!n) return;
    const b = n.body, br = Math.sin(S.t * 2.4);
    b.position.set(0, 0.2, 0); b.rotation.set(0, 0, 0); b.scale.set(1 + br * 0.02, 1 - br * 0.02, 1 + br * 0.02);
    n.wings.scale.set(1 + Math.sin(S.t * 3) * 0.12, 1, 1); n.wings.rotation.set(Math.sin(S.t * 3) * 0.1, 0, 0);
    // face Harry (only while he sits in the nest)
    if (n.root.parent === S.G && S.G && !(S.hop > 0)) { local.copy(player.pos); S.G.worldToLocal(local); const face = Math.atan2(local.x - n.root.position.x, local.z - n.root.position.z); let d = face - n.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); n.root.rotation.y += d * Math.min(1, dt * 3); }
    if (S.sneeze > 0) { S.sneeze += dt; const s = S.sneeze; if (s < 0.6) b.rotation.x = -0.3 * (s / 0.6); else if (s < 0.9) { b.rotation.x = 0.35; if (!S.sneezed) { S.sneezed = 1; sneeze(); say('אפצ\'י! ✨', NORB, 1.8); } } else if (s < 1.4) b.rotation.x = 0.35 * (1 - (s - 0.9) / 0.5); else S.sneeze = 0; }
    if (S.hicJump > 0) { S.hicJump -= dt; b.position.y = 0.2 + Math.sin((0.25 - S.hicJump) / 0.25 * Math.PI) * 0.06; }
    const r = S.react;
    if (r) {
      if (r.kind === 'hungry') { b.rotation.x = r.t < 2.0 ? 0.15 + Math.sin(r.t * 16) * 0.1 : 0; }
      if (r.kind === 'tickle') { const k = ease(Math.min(1, r.t / 1.6)); b.rotation.z = k * Math.PI * 2; b.position.y = 0.2 + Math.sin(k * Math.PI) * 0.12; n.wings.scale.x = 1 + Math.sin(r.t * 20) * 0.3; }
      if (r.kind === 'hiccup') { b.position.y = 0.2 + Math.abs(Math.sin(r.t * 6)) * 0.08; }
    }
    if (S.sig > 5.5) { n.wings.scale.x = 1 + Math.sin(S.t * 12) * 0.35; n.wings.rotation.x = Math.sin(S.t * 12) * 0.25; }   // waving goodbye
  }

  // ---- per frame ----
  function update(dt, step, busy) {
    S.t += dt; S.stepT += dt;
    frameHut(dt);
    if (S.active && outdoors() && !S.G && step <= 3) dressHut(step);
    if (S.G) S.G.visible = outdoors();
    fireCtl();
    flooMute(S.active && step >= 1 && step <= 3);
    // step 1: arriving at the hearth
    if (S.active && step === 0 && outdoors() && S.G) {
      front(v1); const d = Math.hypot(player.pos.x - v1.x, player.pos.z - v1.z);
      if (d < 4.5) { S.arrived += dt; if (S.arrived > 0.8) { say('הארי! תראה מה יש לי: ביצת דרקון! 🥚 היא צריכה חום', HAGRID, 4.5); done(0); } } else S.arrived = 0;
    }
    tickHatch(dt);
    tickWants(dt);
    tickHop(dt);
    tickCrate(dt);
    tickRiders(dt);
    animNorbert(dt);
    if (step >= 2 && S.egg && !S.eggGone && S.G) { S.eggGone = true; S.G.remove(S.egg.mesh); }   // the shell goes once he is happy in his nest (one draw call less)
    // the thought bubble over his head
    if (S.bubble) {
      const on = step === 2 && !!S.want && !S.react && outdoors();
      S.bubble.mesh.visible = on;
      if (on) { S.bubble.mesh.position.set(NEST.x + 0.3, SLAB_Y + 1.62 + Math.sin(S.t * 2) * 0.04, NEST.z); S.bubble.mesh.quaternion.copy(camera.quaternion); if (S.G) { _Q.copy(S.G.quaternion).invert(); S.bubble.mesh.quaternion.premultiply(_Q); } }
    }
    // level 1 (or the glow hint): the right thing twinkles
    if (S.G && outdoors() && (lv() === 1 || S.glowHint) && Math.random() < dt * 4) {
      let p = null;
      if (step === 1 && !S.fireLit) p = HW(0, 0.5, 0.6, v1);
      else if (step === 2 && S.want && !S.react) p = S.want === 'hungry' ? HW(BOWL.x, SLAB_Y + 0.3, BOWL.z, v1) : S.want === 'tickle' ? tummyW(v1) : (S.smoke ? HW(HAY.x, SLAB_Y + 0.35, HAY.z, v1) : null);
      else if (step === 3 && !S.inCrate && S.crate && S.crate.g.parent === S.G) p = HW(S.crate.g.position.x, S.crate.g.position.y + 0.6, S.crate.g.position.z, v1);
      if (p) emit(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3, 0, 0.4, 0, 0.8, 0.16, 0xffe07a, 0);
    }
    // the prompt-button fallbacks (level 1 at once; levels 2-3 after a little while)
    if (S.active && !busy) {
      const late = lv() === 1 || S.stepT > 12;
      if (step === 1 && !S.fireLit && S.G && outdoors()) { HW(0, 0, 1.2, v1); const d = Math.hypot(player.pos.x - v1.x, player.pos.z - v1.z); if (d < 7 && late) { try { fun.offer('adv-incendio', '🔥', 0.05, () => { sparkTo(HW(0, 0.5, 0.5, v3), 0xff8a2a); light(); }); } catch { /* ok */ } } }
      if (step === 2 && S.want === 'hiccup' && S.smoke && !S.react && outdoors()) { HW(HAY.x, 0, HAY.z, v1); const d = Math.hypot(player.pos.x - v1.x, player.pos.z - v1.z); if (d < 8 && (lv() === 1 || S.wantT > 10)) { try { fun.offer('adv-aguamenti', '💧', 0.05, () => douse(false)); } catch { /* ok */ } } }
      if (step === 4 && inTower() && S.follow && !S.sig && S.towerT > 1.0 && late) { try { fun.offer('adv-lumos', '💡', 0.05, () => { sparkUp(); signal(); }); } catch { /* ok */ } }
    }
    if (step === 3 && S.inCrate && inTower() && S.active) { S.arrivedT = (S.arrivedT || 0) + dt; if (S.arrivedT > 1.0) { say('הגענו לראש המגדל! 🔭 עכשיו צריך לתת סימן', HAGRID, 3.5); done(3); } } else if (step === 3) S.arrivedT = 0;
    // casts: a spell is for objects; a spell near Norbert gets a kind word
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n; const k = freecast && freecast.selected ? freecast.selected() : null, hit = S.castHit; S.castHit = false;
      if (!hit && S.active) onCast(k, step);
    }
  }
  function nearNorbert(r = 9) { if (!S.nor || !S.nor.root.parent) return false; S.nor.root.getWorldPosition(v2); return Math.hypot(player.pos.x - v2.x, player.pos.z - v2.z) < r && Math.abs(player.pos.y - v2.y) < 4; }
  function onCast(k, step) {
    if (step === 1 && outdoors() && S.G && !S.fireLit) {
      HW(0, 0, 1.2, v1); const d = Math.hypot(player.pos.x - v1.x, player.pos.z - v1.z);
      if (d < 12) { if (k === 'incendio') light(); else ctx.oops('האח קרה... הביצה צריכה אש: אינסנדיו 🔥'); }
      return;
    }
    if (step === 2 && S.want === 'hiccup' && S.smoke && !S.react && outdoors() && nearNorbert(12)) { if (k === 'aguamenti') douse(true); else ctx.oops('לא מטילים לחשים על נורברט 🙂 את הקש מכבים באגואמנטי 💧'); return; }
    if (step === 4 && inTower() && !S.sig) { if (k === 'lumos' || k === 'periculum') signal(); else ctx.oops('הסימן הוא אור! נסה לומוס 💡'); return; }
    if (nearNorbert(9) || (S.inCrate && S.crate && S.crate.g.parent && !S.sig)) ctx.say('לא מטילים לחשים על נורברט 🙂 ' + (step === 2 ? 'רק נוגעים בו!' : 'הוא רק תינוק!'), null, 3);
  }
  function sparkTo(p, hex) { const s = player.model.scale.y || 1; for (let i = 0; i < 18; i++) { const k = Math.random(); emit(player.pos.x + (p.x - player.pos.x) * k, player.pos.y + 1.3 * s + (p.y - player.pos.y - 1.3 * s) * k, player.pos.z + (p.z - player.pos.z) * k, 0, 0.2, 0, 0.6, 0.14, hex, 0); } }
  function sparkUp() { const s = player.model.scale.y || 1; for (let i = 0; i < 20; i++) emit(player.pos.x, player.pos.y + 1.4 * s, player.pos.z, (Math.random() - 0.5) * 0.8, 3 + Math.random() * 2, (Math.random() - 0.5) * 0.8, 1.2, 0.2, 0xfff0b0, -0.5); }

  // ---- taps ----
  function tap(x, y, step) {
    const rr = R();
    const near = (v) => { if (!v) return 1e9; ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (outdoors() && S.G) {
      if (step === 2 && S.nor && S.want && !S.react) {
        const dB = near(HW(BOWL.x, SLAB_Y + 0.2, BOWL.z, v1)), dT = near(tummyW(v2)), dH = near(HW(HAY.x, SLAB_Y + 0.2, HAY.z, v3));
        const m = Math.min(dB, dT, dH);
        if (m < rr * 1.5) {
          if (m === dT) choose('tickle');
          else if (m === dB) choose('hungry');
          else if (S.want === 'hiccup') ctx.say(S.smoke ? 'הקש מעשן! צריך מים: אגואמנטי 💧' : 'היק! 🙂 חכה רגע...', null, 2.6); else choose('hay');
          return true;
        }
        if (near(HW(BUCKET.x, SLAB_Y + 0.3, BUCKET.z, v1)) < rr * 1.2) { ctx.say(S.want === 'hiccup' ? 'רעיון טוב! מים: הטל אגואמנטי על הקש 💧' : 'זה דלי מים 🪣 נורברט ' + WANT_HE[S.want], null, 2.6); return true; }
      }
      if (step === 3 && !S.inCrate && S.crate && S.crate.g.parent === S.G) {
        if (near(HW(S.crate.g.position.x, S.crate.g.position.y + 0.35, S.crate.g.position.z, v1)) < rr * 1.7) { hopIn(); return true; }
        if (S.nor && near(tummyW(v2)) < rr * 1.4) { ctx.say('נורברט רוצה לנסוע בארגז עם הדובי שלו 🧸 גע בארגז', null, 2.6); return true; }
      }
      if (step === 1 && !S.fireLit && near(HW(KETTLE.x, EGG_Y, KETTLE.z, v1)) < rr * 1.5) { ctx.say('הביצה צריכה חום מהאש! אינסנדיו על האח 🔥', null, 2.6); return true; }
    }
    if (step === 4 && inTower() && !S.sig && S.crate && near(v1.copy(S.crate.g.position).setY(S.crate.g.position.y + 0.4)) < rr * 1.6) { ctx.say('נורברט מחכה לרוכבים. הטל לומוס כסימן 💡', null, 2.6); return true; }
    return false;
  }

  // ---- the arrow ----
  function routeOut(out) {
    const r = interiors.room;
    if (interiors.active === 'entrancehall') { const p = (r.portals || []).find(p => p.to === 'out'); return p ? out.set(p.x, r.group.position.y, p.z) : null; }
    return ctx.routeTo('entrancehall', out, ['staircase', 'entrancehall']);
  }
  function goal(step, out) {
    if (step <= 3 && !(step === 3 && S.inCrate)) {
      if (interiors.active) return routeOut(out);
      if (!S.G) { const h = findHearth(); return h ? out.set(h.position.x, h.position.y, h.position.z) : null; }
      if (step === 0) return HW(0, 0, 1.6, out);
      if (step === 1) return S.fireLit ? null : HW(0, -0.45, 1.45, out);   // the arrow points into the fire bed, below the kettle (it never hides the egg)
      if (step === 2) {
        if (!S.want || S.react) return null;
        if (lv() === 1 || S.glowHint) { if (S.want === 'hungry') return HW(BOWL.x, SLAB_Y + 0.2, BOWL.z, out); if (S.want === 'tickle') return tummyW(out).setY(out.y + 0.25); return S.smoke ? HW(HAY.x, SLAB_Y + 0.25, HAY.z, out) : null; }
        return HW(NEST.x, SLAB_Y + 0.6, NEST.z, out);
      }
      if (step === 3) return S.hop ? null : HW(S.crate ? S.crate.g.position.x : CRATE.x, (S.crate ? S.crate.g.position.y : 0) + 0.55, S.crate ? S.crate.g.position.z : CRATE.z, out);
    }
    if (step === 3) { if (inTower()) return null; return ctx.routeTo('tower', out, ['staircase', 'entrancehall']); }
    if (step === 4) { if (!inTower()) return ctx.routeTo('tower', out, ['staircase', 'entrancehall']); if (S.sig) return null; return towerSpot(out).setY(out.y + 0.6); }
    return null;
  }

  function begin(step, resumed) {
    S.active = true; S.stepT = 0; findHearth();
    const sub = readSub();
    if (step === 0 && !resumed) writeSub(null);
    if (step >= 2) { S.fireLit = true; S.hatched = true; }
    if (step === 2) { initWants(); S.gap = 1.2; }
    if (step === 3 && resumed && sub.crate && !S.inCrate) { if (!S.crate) S.crate = buildCrate(); putInCrate(); startFollow(false); S.crate.g.position.set(player.pos.x, player.pos.y + 0.6, player.pos.z); }
    if (step === 4 && !S.inCrate) { if (!S.crate) { S.crate = buildCrate(); S.tris.crate = triCount(S.crate.g); } if (S.G && S.nor && S.nor.root.parent === S.G) S.G.remove(S.nor.root); putInCrate(); if (!S.follow) startFollow(false); S.crate.g.position.set(player.pos.x, player.pos.y + 0.6, player.pos.z); }
    if (step === 4) { undressHut(); writeSub({ crate: 1 }); }
    if (!resumed) {
      if (step === 1) say('הביצה בקומקום צריכה חום. הטל אינסנדיו על האח 🔥', HAGRID, 4.5);
      if (step === 3) say('נורברט גדל מהר! הוא צריך לגור בשמורת דרקונים, אצל צ\'רלי. גע בארגז 📦', HAGRID, 5);
      if (step === 4) say('הגענו! הטל לומוס כדי לתת סימן לחברים של צ\'רלי 💡', HAGRID, 4);
      return;
    }
    // a resume (reload / the book): go to the right place; the step starts over
    if (step >= 1 && step <= 3 && !S.follow) { if (interiors.active) interiors.exit(); const h = findHearth(); if (h) { front(v1); lookAt(v2); player.yaw = Math.atan2(v2.x - v1.x, v2.z - v1.z); player.teleport(v1.x, v1.z); setTimeout(() => { try { player.cam.reset(player.yaw); } catch { /* ok */ } }, 50); } }
    if (step === 4 && !inTower()) interiors.enter('tower');
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    const atHut = (fn, d = 900) => { if (outdoors() && S.G && Math.hypot(player.pos.x - front(v1).x, player.pos.z - v1.z) < 8) { fn(); return; } if (interiors.active) interiors.exit(); setTimeout(() => { const h = findHearth(); if (h) { front(v1); lookAt(v2); player.yaw = Math.atan2(v2.x - v1.x, v2.z - v1.z); player.teleport(v1.x, v1.z); } setTimeout(fn, d); }, interiors.active ? 900 : 0); };
    if (step === 0) atHut(() => {}, 0);
    else if (step === 1) atHut(() => { light(); if (fast) S.hatch = Math.max(S.hatch, 8.95); });
    else if (step === 2) atHut(() => {
      const run1 = () => { if (ctx.step !== 2) return; initWants(); if (!S.want && !S.react) nextWant(); if (S.react) return; if (S.want === 'hiccup') { S.smoke = true; douse(false); } else react(S.want); };
      if (fast) { const loop = () => { if (ctx.step !== 2) return; run1(); if (S.react) S.react.t = Math.max(S.react.t, 2.79); setTimeout(loop, 120); }; loop(); }
      else { const loop = () => { if (ctx.step !== 2) return; if (!S.react) run1(); setTimeout(loop, 700); }; loop(); }
    });
    else if (step === 3) { const go = () => { if (!inTower()) interiors.enter('tower'); }; if (S.inCrate) go(); else atHut(() => { hopIn(); setTimeout(go, fast ? 1300 : 2200); }); }
    else if (step === 4) { const fire = () => { S.towerT = Math.max(S.towerT, 2.1); signal(); if (fast) S.sig = Math.max(S.sig, 15.9); }; if (inTower()) fire(); else { interiors.enter('tower'); setTimeout(fire, 1500); } }
  }
  function end(finished) {
    S.active = false;
    flooMute(false);
    undressHut();
    if (S.crate && S.crate.g.parent) S.crate.g.parent.remove(S.crate.g);
    if (S.riders && S.riders.g.parent) S.riders.g.parent.remove(S.riders.g);
    S.crate = null; S.nor = null; S.riders = null; S.follow = false; S.inCrate = false;
    fireCtl(); if (S.fire) { S.fire.visible = true; if (S.fireY !== undefined) S.fire.position.y = S.fireY; }   // the hearth back to its normal burning self
    if (FI && Array.isArray(FI.TARGETS)) for (const t of T) { const i = FI.TARGETS.indexOf(t); if (i >= 0) FI.TARGETS.splice(i, 1); }
    if (finished) writeSub(null);
    if (css.parentNode) css.parentNode.removeChild(css);
  }
  function state() {
    return { room: interiors.active, hut: !!S.G, fireLit: S.fireLit, hearthFire: S.fire ? S.fire.visible : null, hatch: +S.hatch.toFixed(2), hatched: S.hatched, egg: !!(S.egg && !S.eggGone), norbert: !!S.nor,
      wants: S.wants.slice(), wi: S.wi, want: S.want, react: S.react ? S.react.kind : null, smoke: S.smoke, wrong: S.wrong, bubble: !!(S.bubble && S.bubble.mesh.visible),
      inCrate: S.inCrate, follow: S.follow, parked: S.parked, sig: +S.sig.toFixed(2), riders: !!(S.riders && S.riders.g.visible), tris: { ...S.tris },
      crateD: S.crate && S.follow ? +Math.hypot(S.crate.g.position.x - player.pos.x, S.crate.g.position.z - player.pos.z).toFixed(2) : null };
  }
  ctx._norbert = {
    front: () => { if (!findHearth()) return null; front(v1); lookAt(v2); return { x: v1.x, z: v1.z, yaw: Math.atan2(v2.x - v1.x, v2.z - v1.z) }; },
    hearthW: () => HW(0, 0.7, 0.5),
    eggW: () => HW(KETTLE.x, EGG_Y, KETTLE.z),
    bowlW: () => HW(BOWL.x, SLAB_Y + 0.2, BOWL.z),
    hayW: () => HW(HAY.x, SLAB_Y + 0.2, HAY.z),
    tummyW: () => tummyW(new Vector3()),
    crateW: () => (S.crate ? (S.crate.g.parent === S.G ? HW(S.crate.g.position.x, S.crate.g.position.y + 0.35, S.crate.g.position.z) : S.crate.g.position.clone().setY(S.crate.g.position.y + 0.4)) : null),
    ridersW: () => (S.riders ? towerSpot(new Vector3()).setY(interiors.room.group.position.y + 4.6) : null),
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
