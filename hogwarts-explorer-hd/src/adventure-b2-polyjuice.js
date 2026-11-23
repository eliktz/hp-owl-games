// Book 2, adventure 4: "שיקוי פולימיצי" (the Polyjuice Potion). Data for adventures.js + the scene code.
// Played in the girls' bathroom: the troll quest's 'trollroom' interior in a quest state of its own (BATH.myrtle: the
// same room, no troll), reached by the same Entrance Hall door. Moaning Myrtle is a friendly giggling ghost (tapped,
// never hexed: a spell near her gets a kind bubble). The change into "Goyle" is a comic tint + a wider build on Harry's
// model only, undone at the end, on pause / leave, and on any error: Harry is never left changed.
// Steps: 1 go into the bathroom and tap Myrtle (she giggles and whispers the password) -> 2 find three ingredients
// round the room (taps) -> 3 brew: add the ingredients in the order of the recipe card's colours (3 / 4 / 5 by level;
// a wrong one = a kind puff), then stir: tap the ladle three times -> 4 drink: tap the cauldron: poof, Harry is
// "Goyle" (Ron only a bubble) -> 5 Floo or walk to the dungeon: the stone door with the snake knocker asks for the
// password: tap the right one of three word cards. Inside is only a bubble scene; the potion wears off with a poof.
import { Vector3, Color, Object3D } from 'three';
import { FLOOR_Y } from './rooms.js';
import { BATH } from './adventure-troll.js';
import { buildHallDoor, HALL_DOOR, SPAWN, STALL_Z } from './adventure-troll-build.js';
import { buildMyrtle, buildCauldronSet, buildJars, buildRecipe, buildSnakeDoor, triCount, MYRTLE, CAULDRON, BENCH, SLOT_X, FIND, ING, SDOOR, FONT } from './adventure-b2-polyjuice-build.js';

const RON = { ico: '👦', name: 'רון' };
const MYR = '👻 מיילי';
export const B2POLY = {
  id: 'b2-polyjuice', book: 2, title: 'שיקוי פולימיצי', ico: '🧪', col: '#2a4a3a', col2: '#7ab09a', helper: RON, confetti: ['✨', '⭐', '🧪', '👻'],
  pic: [['🧪', 0.5, 0.55, 66], ['👻', 0.8, 0.3, 32], ['🐍', 0.2, 0.3, 28]],
  intro: [
    'הרמיוני מצאה בספר מתכון לשיקוי פולימיצי! 🧪',
    'מי ששותה אותו נראה כמו מישהו אחר... לשעה אחת בלבד.',
    'נבשל אותו בשירותי הבנות, איפה שאף אחד לא בא. חוץ ממיילי! אני רון, ואני אעזור לך ✨',
  ],
  steps: [
    { line: 'לך לשירותי הבנות ופגוש את מיילי 👻', hints: ['השירותים ליד אולם הכניסה, דרך הדלת החדשה 🚪', 'מיילי מרחפת ליד הכיורים. גע בה!', 'לך אחרי החץ הזהוב 👻'] },
    { line: 'מצא שלושה מרכיבים בחדר 🌿', hints: ['שלוש צנצנות צבעוניות מחכות בחדר 🫙', 'חפש ליד הכיורים, ליד החלון וליד הדלת', 'הצנצנות זוהרות עכשיו. גע בהן!'] },
    { line: 'בשל את השיקוי לפי המתכון 🧪', hints: ['הסתכל במתכון: איזה צבע ראשון? 🧪', 'גע בצנצנת בצבע של העיגול הראשון (מימין)', 'אחרי כל הצנצנות: גע בכף שלוש פעמים כדי לערבב 🥄'] },
    { line: 'שתה את השיקוי! 🥤', hints: ['השיקוי מוכן! גע בקלחת 🥤', 'גע בקלחת כדי לשתות', 'אל תדאג, זה רק לשעה! גע בקלחת 😄'], glowL1: true },
    { line: 'לך למרתף ואמור את הסיסמה 🐍', hints: ['הדלת עם הנחש נמצאת במרתף השיקויים 🐍', 'מה מיילי לחשה לך? משהו על נחש... 🤫', 'אפשר לטוס במפה אל מרתף השיקויים 🗺️'] },
  ],
  create: (ctx) => polyScene(ctx),
  art: drawPolyCard,
};

// the reward card picture: a round cauldron bubbling green, a smiling ghost girl with round glasses beside it (canvas)
function drawPolyCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx - 30, cy + 30);
  E(0, 30, 70, 58, '#2e2b30'); E(0, -20, 64, 14, '#3c3840'); E(0, -22, 54, 9, '#7ab04a');
  for (const [bx, by, r] of [[-20, -40, 10], [10, -56, 8], [26, -36, 6], [-4, -74, 6]]) { E(bx, by, r, r, 'rgba(150,220,110,.9)'); }
  x.fillStyle = '#5e3e24'; x.fillRect(-60, 82, 120, 12);
  x.restore();
  x.save(); x.translate(cx + 66, cy - 20); x.globalAlpha = 0.85;
  E(0, 50, 34, 54, '#9cbcd8'); E(0, -14, 30, 30, '#b8d4e8'); E(-30, -10, 10, 22, '#7a9ab8', 0.4); E(30, -10, 10, 22, '#7a9ab8', -0.4);
  x.globalAlpha = 1; x.strokeStyle = '#3a4a6a'; x.lineWidth = 3; x.beginPath(); x.arc(-11, -16, 9, 0, 7); x.stroke(); x.beginPath(); x.arc(11, -16, 9, 0, 7); x.stroke();
  E(-11, -16, 3, 3, '#2a3448'); E(11, -16, 3, 3, '#2a3448'); x.beginPath(); x.arc(0, -2, 8, 0.2, Math.PI - 0.2); x.stroke();
  x.restore();
}

const NEED = { 1: 3, 2: 4, 3: 5 };
const PASS = 'נחש ישנוני';
const WORDS = [PASS, 'עוגת דלעת', 'גרב סגולה'];
const TINT = new Color(0.55, 1.0, 0.6);   // "Goyle": a comic green tint over Harry's robes (multiplied, restored exactly)
const MURK = new Color(0x3a3a30), READY = new Color(0x6a9a3a);

function polyScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera } = ctx;
  const S = { active: false, lastRoom: null, B: null, hall: null, dd: null, met: 0, found: 0, added: 0, stir: 0, stirT: 0, ready: 0, drank: 0, gk: null, pw: 0, open: 0, wrong: 0, giggles: 0, t: 0, glowHint: false, casts0: 0, done: {}, cards: null };
  const lv = () => ctx.level;
  const need = () => NEED[lv()] || 3;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inBath = () => interiors.active === 'trollroom' && interiors.room && interiors.room.group;
  const inDungeon = () => interiors.active === 'dungeon' && interiors.room && interiors.room.group;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3(), d0 = new Object3D();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const Y = FLOOR_Y;
  const RW = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(interiors.room.group.position);
  // the recipe: a shuffled order of the colours in use; jar k: 0..2 are found round the room, 3.. wait on the bench
  const order = Array.from({ length: need() }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const jar = order.map((_, k) => ({ k, st: k < 3 ? 'hide' : 'bench', t: 0, from: new Vector3(), to: new Vector3(), pos: new Vector3() }));
  const brewCol = MURK.clone();

  // ---------------- "Goyle": wider + a green tint on Harry's own model; always undone ----------------
  function goyleOn() {
    if (S.gk) return;
    const G = { kids: [], mats: new Map() };
    S.gk = G;
    try {
      for (const c of player.model.children) { G.kids.push([c, c.scale.clone()]); c.scale.set(c.scale.x * 1.45, c.scale.y * 1.04, c.scale.z * 1.4); }
      player.model.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || !m.color || G.mats.has(m)) continue; G.mats.set(m, [m.color.clone(), m.emissive ? m.emissive.clone() : null, m.emissiveIntensity]); m.color.multiply(TINT); if (m.emissive) { m.emissive.setHex(0x2a7a2a); m.emissiveIntensity = 0.45; } } });
    } catch (e) { goyleOff(); console.warn('[b2-polyjuice] goyle skipped -', e && e.message || e); }
  }
  function goyleOff() {
    const G = S.gk; if (!G) return; S.gk = null;
    for (const [c, s] of G.kids) { try { c.scale.copy(s); } catch { /* keep going */ } }
    for (const [m, [c, e, ei]] of G.mats) { try { m.color.copy(c); if (e && m.emissive) m.emissive.copy(e); if (ei !== undefined) m.emissiveIntensity = ei; } catch { /* keep going */ } }
  }

  // ---------------- the Entrance Hall door (the troll quest's door, our own copy + portal while we run) ----------------
  function dressHall() {
    const r = interiors.room; if (!r || !r.group || r.group.userData.advBathPJ) return;
    const door = buildHallDoor(); r.group.add(door);
    const p = { x: HALL_DOOR.x, z: HALL_DOOR.z - 0.9, r: 0.9, to: 'trollroom', at: { ...SPAWN }, locked: () => !S.active || ctx.step >= 4, armed: false };
    r.portals.push(p);
    r.colliders.push({ type: 'box', x: HALL_DOOR.x, z: HALL_DOOR.z - 0.1, hw: 1.1, hd: 0.15, angle: 0 });
    r.group.userData.advBathPJ = { door, p }; S.hall = { door, p };
  }

  // ---------------- the bathroom dressing ----------------
  function dressBath(step) {
    const r = interiors.room; if (!r || !r.group || S.B) return;
    const g = r.group, adv = g.userData.adv, B = { g };
    B.my = buildMyrtle(); B.my.root.position.set(MYRTLE.x, MYRTLE.y, MYRTLE.z); B.my.root.rotation.y = Math.PI / 2; g.add(B.my.root); B.myTris = triCount(B.my.root);
    B.set = buildCauldronSet(); g.add(B.set.g);
    B.jars = buildJars(need()); g.add(B.jars);
    B.rec = buildRecipe(); B.rec.m.position.set(CAULDRON.x - 0.1, 2.75, CAULDRON.z + 0.2); B.rec.m.scale.setScalar(1.3); g.add(B.rec.m);
    try { if (adv && adv.P && adv.P.doors && adv.P.doors[2]) adv.P.doors[2].rotation.y = 1.6; } catch { /* the stall stays shut */ }   // the open stall
    // a (re)visit or a resume: put the jars where the step says (found ones stay found, poured ones stay in)
    for (const J of jar) {
      if (step >= 3) J.st = 'in';
      else if (step === 2) J.st = (J.st === 'in' || J.st === 'pour') ? 'in' : 'bench';
      else if (step === 1) J.st = J.k >= 3 || J.st === 'bench' || J.st === 'fly' ? 'bench' : 'hide';
      else J.st = J.k < 3 ? 'hide' : 'bench';
      J.t = 1;
    }
    if (step >= 3) { S.added = need(); S.stir = 3; S.ready = 1; brewCol.copy(READY); }
    B.tris = [B.my.root, B.set.g, B.jars, B.rec.m].reduce((n, o) => n + triCount(o), 0);
    S.B = B; redraw();
  }
  function redraw() { if (S.B) try { S.B.rec.draw(order, S.added, S.stir); } catch { /* the card is optional */ } }
  function undress() {
    if (S.B) { for (const o of [S.B.my.root, S.B.set.g, S.B.jars, S.B.rec.m]) if (o.parent) o.parent.remove(o); S.B = null; }
    if (S.dd) { if (S.dd.g.parent) S.dd.g.parent.remove(S.dd.g); S.dd = null; }
    if (S.hall) { S.hall.door.visible = false; }
  }
  const jarHome = (J, out) => J.st === 'hide' ? out.set(FIND[J.k].x, FIND[J.k].y, FIND[J.k].z) : out.set(SLOT_X(J.k), BENCH.y, BENCH.z);

  // ---------------- the dungeon door + the password cards (DOM: big, readable, RTL) ----------------
  function dressDungeon() {
    const r = interiors.room; if (!r || !r.group || S.dd) return;
    const D = buildSnakeDoor(); r.group.add(D.g); S.dd = D; S.ddTris = triCount(D.g);
    r.colliders.push({ type: 'box', x: SDOOR.x - 0.1, z: SDOOR.z, hw: 0.25, hd: 1.15, angle: 0 });
  }
  const css = document.createElement('style');
  css.textContent = `#advPw{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);z-index:14;display:none;flex-direction:column;align-items:center;gap:10px;direction:rtl;font-family:${FONT};
    padding:14px 18px;border-radius:22px;border:4px solid #9aa4a8;background:rgba(20,40,30,.9);box-shadow:0 8px 28px rgba(0,0,0,.55);max-width:92vw;box-sizing:border-box}
  #advPw.on{display:flex} #advPw .q{color:#e8f4ea;font-size:22px;font-weight:bold;text-align:center}
  #advPw .row{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
  #advPw button{padding:12px 20px;border-radius:18px;border:3px solid #b8862e;background:linear-gradient(#fbf1d6,#ecd9ae);color:#3a2410;font:bold 24px ${FONT};cursor:pointer;touch-action:manipulation;min-width:140px}
  #advPw button.glow{animation:advPulse .9s ease-in-out infinite;border-color:#fff}
  body.modalOn #advPw,body.inSpell #advPw,body.inFloo #advPw{display:none !important}
  @media (max-width:700px){#advPw{top:calc(88px + env(safe-area-inset-top))} #advPw button{font-size:21px;min-width:120px;padding:10px 14px} #advPw .q{font-size:19px}}`;
  document.head.appendChild(css);
  const pw = document.createElement('div'); pw.id = 'advPw'; document.body.appendChild(pw);
  const q = document.createElement('div'); q.className = 'q'; q.textContent = '🐍 הנחש על הדלת שואל: מה הסיסמה?'; pw.appendChild(q);
  const row = document.createElement('div'); row.className = 'row'; pw.appendChild(row);
  const shown = WORDS.slice(); for (let i = shown.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shown[i], shown[j]] = [shown[j], shown[i]]; }
  const btns = shown.map((w) => { const b = document.createElement('button'); b.textContent = w; b.dataset.w = w; row.appendChild(b);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('click', (e) => { e.stopPropagation(); say(w); }); return b; });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) pw.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  // ---------------- step actions ----------------
  const GIG = ['היי-היי-היי! 😄 אף אחד לא בא לבקר אותי אף פעם!', 'הי-הי! אני מיילי. אתם מבשלים פה משהו? 🤭', 'היי-היי! הכיור הזה הוא הכיור שלי 😄'];
  function meet() {
    if (!S.B) return;
    S.giggles++; sfx('giggle', true); ctx.poke();
    RW(MYRTLE.x, MYRTLE.y + 1.3, MYRTLE.z, v1); burst(v1.x, v1.y, v1.z, 0xbfe0ff, 12, 1.2, 0.8, 0.18, -0.2);
    if (ctx.step === 0 && !S.met) {
      S.met = 0.001;
      ctx.say('היי-היי! 😄 אני מיילי. אתם רוצים להיכנס למרתף של סלית\'רין? הסיסמה היא: "' + PASS + '". ששש! 🤫', MYR, 6);
      return;
    }
    ctx.say(GIG[S.giggles % GIG.length], MYR, 3);
  }
  function findJar(J) {
    if (J.st !== 'hide' || ctx.step !== 1) return;
    J.st = 'fly'; J.t = 0; J.from.set(FIND[J.k].x, FIND[J.k].y, FIND[J.k].z); J.to.set(SLOT_X(J.k), BENCH.y, BENCH.z); S.found++; ctx.poke(); sfx('chime'); sfx('pop');
    RW(J.from.x, 0.3, J.from.z, v1); burst(v1.x, v1.y, v1.z, ING[J.k].hex, 14, 1.4, 0.8, 0.2, -0.6);
    const left = 3 - S.found;
    ctx.say(ING[J.k].name + '! ' + (left > 0 ? (left === 1 ? 'עוד מרכיב אחד 🫙' : 'עוד ' + left + ' 🫙') : 'יש לנו הכל! לקלחת 🧪'), null, 2.6);
    if (left <= 0) setTimeout(() => done(1), 1300);
  }
  function addJar(J) {
    if (ctx.step !== 2 || J.st !== 'bench' || S.added >= need()) return;
    const want = order[S.added];
    if (J.k !== want) {
      S.wrong++; sfx('poof'); RW(CAULDRON.x, 1.0, CAULDRON.z, v1); burst(v1.x, v1.y, v1.z, 0xd8d8d0, 18, 1.2, 0.9, 0.3, 0.4);
      ctx.oops('פוף! 💨 לא נורא. לפי המתכון עכשיו: ' + ING[want].short + ' (' + ING[want].name + ')');
      return;
    }
    J.st = 'pour'; J.t = 0; J.from.set(SLOT_X(J.k), BENCH.y, BENCH.z); J.to.set(CAULDRON.x, 1.05, CAULDRON.z); S.added++; ctx.poke(); sfx('pop');
  }
  function stir() {
    if (ctx.step !== 2 || S.added < need() || S.stir >= 3 || S.stirT > 0) return;
    S.stir++; S.stirT = 0.001; ctx.poke(); sfx('whoosh'); tone(300 + S.stir * 90, 0.3, 0.1, 'sine', 0.06, 600 + S.stir * 90); redraw();
    if (S.stir >= 3) { S.ready = 0.001; ctx.say('בלופ בלופ! השיקוי מוכן 🧪 הוא... ירוק-בוץ. איכס! 😝', null, 4); setTimeout(() => done(2), 2200); }
    else ctx.say(S.stir === 1 ? 'ערבוב אחד! עוד שניים 🥄' : 'עוד ערבוב אחד! 🥄', null, 2);
  }
  function drink() {
    if (ctx.step !== 3 || S.drank) return;
    S.drank = 0.001; ctx.poke(); sfx('burp');
    setTimeout(() => {
      if (!S.active) return;
      sfx('poof'); const s = player.model.scale.y || 1;
      burst(player.pos.x, player.pos.y + 1.0 * s, player.pos.z, 0xffffff, 30, 2.4, 1.1, 0.4, 0.3); burst(player.pos.x, player.pos.y + 1.0 * s, player.pos.z, 0x9ad070, 16, 1.6, 0.9, 0.3, 0.2);
      goyleOn(); tone(95, 0.5, 0.1, 'sawtooth', 0.06, 70);
      ctx.say('אוּוּה... אני גויל! 😜', '🧑 הארי (גויל)', 3.2);
      setTimeout(() => { if (S.active) ctx.say('ואני קראב! חה-חה! הקול שלך כל כך עבה! 😂', '👦 רון', 3.5); }, 3300);
      setTimeout(() => { if (S.active) done(3); }, 6400);
    }, 900);
  }
  function say(w) {
    if (S.pw || ctx.step !== 4 || !inDungeon()) return;
    ctx.poke();
    if (w !== PASS) { S.wrong++; sfx('soft'); ctx.oops('הנחש מנמנם... זאת לא הסיסמה 🙂 מה מיילי לחשה? משהו על נחש 🐍'); return; }
    S.pw = 0.001; pw.classList.remove('on'); sfx('chime'); tone(392, 0.4, 0, 'sine', 0.06, 523);
    ctx.say('"' + PASS + '"... הדלת נפתחת! 🐍✨', '🐍 הדלת', 3);
  }

  // ---------------- per frame ----------------
  function update(dt, step, busy) {
    try { tick(dt, step, busy); } catch (e) { goyleOff(); throw e; }   // any error: Harry goes back to himself first
  }
  function tick(dt, step, busy) {
    S.t += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) {
      S.lastRoom = r; S.B = null; S.dd = null; S.hall = null;
      if (interiors.active === 'entrancehall' && S.active) dressHall();
      if (interiors.active === 'entrancehall' && r && r.group && r.group.userData.advBathPJ) S.hall = r.group.userData.advBathPJ;
    }
    if (S.active && inBath() && step <= 3 && !S.B) dressBath(step);
    if (S.active && inDungeon() && step === 4 && !S.dd) dressDungeon();
    if (S.hall) S.hall.door.visible = S.active && interiors.active === 'entrancehall' && step <= 3;
    // casts: never on Myrtle (a kind word); potions are brewed by hand
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n;
      if (inBath() && S.B) { const g = S.B.g.position; if (Math.hypot(player.pos.x - g.x - MYRTLE.x, player.pos.z - g.z - MYRTLE.z) < 6 || step === 0) ctx.say('לא מטילים לחשים על מיילי 🙂 היא רק רוצה שיצחקו איתה! גע בה', null, 3.5); else ctx.say('שיקוי מבשלים ביד, בלי שרביט 🙂', null, 3); }
      else if (inDungeon() && step === 4 && !S.pw) ctx.say('הדלת לא נפתחת בלחש 🙂 היא רוצה את הסיסמה 🐍', null, 3);
    }
    // the password cards: by the door in the dungeon
    const nearDoor = inDungeon() && step === 4 && S.dd && !S.pw && !busy && (() => { const g = interiors.room.group.position; return Math.hypot(player.pos.x - g.x - SDOOR.x, player.pos.z - g.z - SDOOR.z) < 5.5; })();
    pw.classList.toggle('on', !!nearDoor);
    const gl = lv() === 1 || S.glowHint;
    for (const b of btns) b.classList.toggle('glow', !!(nearDoor && gl && b.dataset.w === PASS && (lv() === 1 ? true : S.glowHint)));
    tickBath(dt, step);
    tickDoor(dt, step);
  }
  function tickBath(dt, step) {
    const B = S.B; if (!B) return;
    // Myrtle: floats, bobs, sways, turns to Harry; giggles shake her
    const M = B.my.root, g = B.g.position;
    M.position.y = MYRTLE.y + Math.sin(S.t * 1.4) * 0.08;
    const face = Math.atan2(player.pos.x - g.x - MYRTLE.x, player.pos.z - g.z - MYRTLE.z); M.rotation.y += (face - M.rotation.y) * Math.min(1, dt * 2);
    M.rotation.z = Math.sin(S.t * 0.9) * 0.05 + (S.met > 0 && S.met < 2 ? Math.sin(S.t * 18) * 0.05 : 0);
    B.my.mat.opacity = 0.58 + Math.sin(S.t * 2.1) * 0.06;
    if (step === 0 && !S.met && (lv() === 1 || S.glowHint) && Math.random() < dt * 3) { RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.5, v1.y + Math.random() * 0.6, v1.z + (Math.random() - 0.5) * 0.5, 0, 0.3, 0, 0.8, 0.16, 0xbfe0ff, 0); }
    if (S.met > 0) { S.met += dt; if (S.met > 4.2) done(0); }
    // the jars
    const J1 = lv() === 1 || S.glowHint;
    const nextK = step === 2 && S.added < need() ? order[S.added] : -1;
    let c = 0;
    for (const J of jar) {
      J.t += dt;
      if (J.st === 'fly' || J.st === 'pour') {
        const k = Math.min(1, J.t / 0.8); J.pos.lerpVectors(J.from, J.to, k); J.pos.y += Math.sin(k * Math.PI) * 0.7;
        if (k >= 1) {
          if (J.st === 'fly') J.st = 'bench';
          else { J.st = 'in'; RW(CAULDRON.x, 0.9, CAULDRON.z, v1); burst(v1.x, v1.y, v1.z, ING[J.k].hex, 18, 1.4, 0.9, 0.22, -0.4); sfx('chime'); brewCol.lerp(new Color(ING[J.k].hex), S.added === 1 ? 0.8 : 0.55); redraw();
            if (S.added >= need()) ctx.say('כל המרכיבים בפנים! עכשיו לערבב: גע בכף שלוש פעמים 🥄', null, 3.5); else ctx.say('יופי! עכשיו ' + ING[order[S.added]].short + ' 🧪', null, 2); }
        }
      } else if (J.st === 'in') { d0.scale.setScalar(0); d0.position.set(0, -50, 0); d0.updateMatrix(); B.jars.setMatrixAt(c, d0.matrix); B.jars.setColorAt(c, new Color(ING[J.k].hex)); c++; continue; }
      else jarHome(J, J.pos);
      const bob = (J.st === 'hide' && step === 1 && J1) || (J.k === nextK && J.st === 'bench' && J1) ? Math.abs(Math.sin(S.t * 3 + J.k)) * 0.06 : 0;
      d0.position.copy(J.pos); d0.position.y += bob; d0.rotation.set(0, J.k * 0.7, J.st === 'pour' ? Math.min(1.6, J.t * 3) : 0); d0.scale.setScalar(1.35); d0.updateMatrix();
      B.jars.setMatrixAt(c, d0.matrix); B.jars.setColorAt(c, _jc.setHex(ING[J.k].hex)); c++;
      if (((J.st === 'hide' && step === 1) || (J.k === nextK && J.st === 'bench')) && J1 && Math.random() < dt * 2.5) { RW(J.pos.x, J.pos.y + 0.4, J.pos.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.2, v1.y, v1.z, 0, 0.35, 0, 0.8, 0.14, ING[J.k].hex, 0); }
    }
    B.jars.count = c; B.jars.instanceMatrix.needsUpdate = true; if (B.jars.instanceColor) B.jars.instanceColor.needsUpdate = true;
    // the brew: its colour, a gentle glow, bubbles; the ladle stirs round
    const bm = B.set.brew.material;
    if (S.ready > 0) { S.ready += dt; brewCol.lerp(READY, Math.min(1, dt * 1.5)); }
    bm.color.copy(brewCol).multiplyScalar(0.7); bm.emissive.copy(brewCol); bm.emissiveIntensity = 0.5 + Math.sin(S.t * 3) * 0.12 + (S.stirT > 0 ? 0.4 : 0);
    if (Math.random() < dt * (S.ready ? 8 : 3)) { RW(CAULDRON.x + (Math.random() - 0.5) * 0.4, 0.85, CAULDRON.z + (Math.random() - 0.5) * 0.4, v1); _bc.copy(brewCol).lerp(_w, 0.3); emit(v1.x, v1.y, v1.z, 0, 0.35 + Math.random() * 0.3, 0, 0.9, 0.13, _bc.getHex(), 0); }
    const L = B.set.ladle;
    if (S.stirT > 0) { S.stirT += dt; L.rotation.y += dt * 9; if (S.stirT > 0.8) S.stirT = 0; }
    else L.rotation.y += dt * 0.3;
    // step 4 (drink): the cauldron glows a little (level 1)
    if (step === 3 && !S.drank && J1 && Math.random() < dt * 3) { RW(CAULDRON.x, 1.2, CAULDRON.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.4, v1.y, v1.z, 0, 0.4, 0, 0.8, 0.16, 0xffe07a, 0); }
    // the recipe card faces the camera (from the brewing step on)
    B.rec.m.visible = step >= 1 && step <= 2; B.rec.m.quaternion.copy(camera.quaternion);
  }
  const _jc = new Color(), _bc = new Color(), _w = new Color(1, 1, 1);
  function tickDoor(dt, step) {
    if (!S.dd || !inDungeon()) return;
    if (S.pw > 0) {
      S.pw += dt; const t = S.pw;
      S.dd.hinge.rotation.y = -Math.min(1.3, t * 0.9);
      if (t - dt < 1.6 && t >= 1.6) ctx.say('ששש... בחדר המועדון של סלית\'רין שמענו את מאלפוי אומר: "אני לא יודע מי פתח את החדר!" 🤔', '👦 רון', 5.5);
      if (t - dt < 7.4 && t >= 7.4) { sfx('poof'); const s = player.model.scale.y || 1; burst(player.pos.x, player.pos.y + 1.0 * s, player.pos.z, 0xffffff, 30, 2.4, 1.1, 0.4, 0.3); goyleOff(); ctx.say('פוף! השיקוי נגמר והארי חזר להיות הארי! 😄 בוא נברח מכאן!', '👦 רון', 4); }
      if (t > 9.2) done(4);
    } else if (step === 4 && (lv() === 1 || S.glowHint) && Math.random() < dt * 2) { RW(SDOOR.x - 0.3, 1.0 + Math.random() * 1.4, SDOOR.z + (Math.random() - 0.5) * 1.2, v1); emit(v1.x, v1.y, v1.z, -0.1, 0.2, 0, 0.8, 0.14, 0x9ae0b0, 0); }
  }

  // ---------------- taps ----------------
  function tap(x, y, step) {
    const rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (inBath() && S.B) {
      const dM = near(RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z, v1));
      if (step === 1) { let best = null, bd = 1e9; for (const J of jar) { if (J.st !== 'hide') continue; const d = near(RW(J.pos.x, J.pos.y + 0.15, J.pos.z, v1)); if (d < bd) { bd = d; best = J; } } if (best && bd < rr * 1.5) { findJar(best); return true; } }
      if (step === 2) {
        if (S.added >= need()) { if (near(RW(CAULDRON.x, 0.9, CAULDRON.z, v1)) < rr * 2.2) { stir(); return true; } }
        else { let best = null, bd = 1e9; for (const J of jar) { if (J.st !== 'bench') continue; const d = near(RW(J.pos.x, J.pos.y + 0.15, J.pos.z, v1)); if (d < bd) { bd = d; best = J; } } if (best && bd < rr * 1.1) { addJar(best); return true; }
          if (near(RW(CAULDRON.x, 0.9, CAULDRON.z, v1)) < rr * 1.6) { ctx.say('קודם המרכיבים, לפי המתכון 🧪 גע בצנצנת', null, 2.6); return true; } }
      }
      if (step === 3 && near(RW(CAULDRON.x, 0.9, CAULDRON.z, v1)) < rr * 2.2) { drink(); return true; }
      if (dM < rr * 2.0) { meet(); return true; }
    }
    return false;
  }

  // ---------------- the arrow ----------------
  function goal(step, out) {
    if (step <= 3) {
      if (!inBath()) {
        if (interiors.active === 'entrancehall') return out.set(HALL_DOOR.x, Y + 1.95, HALL_DOOR.z - 0.7);
        return ctx.routeTo('entrancehall', out, ['entrancehall', 'staircase']);
      }
      if (!S.B) return null;
      if (step === 0) return S.met ? null : RW(MYRTLE.x + 0.2, MYRTLE.y + 0.55, MYRTLE.z, out);
      if (step === 1) { if (!(lv() === 1 || S.glowHint)) return null; let best = null, bd = 1e9; const g = S.B.g.position; for (const J of jar) { if (J.st !== 'hide') continue; const d = Math.hypot(player.pos.x - g.x - J.pos.x, player.pos.z - g.z - J.pos.z); if (d < bd) { bd = d; best = J; } } return best ? RW(best.pos.x, -0.5, best.pos.z, out) : null; }
      if (step === 2) { if (S.added >= need()) return S.stir >= 3 ? null : RW(CAULDRON.x, -0.2, CAULDRON.z, out); if (!(lv() === 1 || S.glowHint)) return RW(BENCH.x, -0.3, BENCH.z, out); const J = jar[order[S.added]]; return RW(J.pos.x, -0.3, J.pos.z, out); }
      if (step === 3) return S.drank ? null : RW(CAULDRON.x, -0.2, CAULDRON.z, out);
    }
    if (step === 4) {
      if (!inDungeon()) {
        if (inBath()) return ctx.routeTo('entrancehall', out);
        return ctx.routeTo('dungeon', out, ['greathall', 'entrancehall']);
      }
      return S.pw ? null : RW(SDOOR.x - 0.8, 0.9, SDOOR.z, out);
    }
    return null;
  }

  function begin(step, resumed) {
    S.active = true; BATH.myrtle = true;
    if (step === 4) goyleOn();
    if (step === 1 && !resumed) ctx.say('אנחנו צריכים שלושה מרכיבים. הם מוסתרים כאן בחדר 🫙', null, 4);
    if (step === 2 && !resumed) ctx.say('עכשיו לבשל! הצבעים במתכון אומרים מה לשים, מימין לשמאל 🧪', null, 4.5);
    if (step === 4 && !resumed) ctx.say('עכשיו נלך למרתף! הדלת של סלית\'רין שם. זוכר את הסיסמה? 🐍', null, 4.5);
    if (!resumed) return;
    // a resume (reload / the book): go to the right place; the step starts over
    if (step <= 3) { if (!inBath()) interiors.enter('trollroom', step === 0 ? { ...SPAWN } : { x: 1.2, z: 3.0, yaw: Math.PI }); }
    if (step === 4) { const at = { x: 5.6, z: 1.8, yaw: Math.PI / 2 }; if (!inDungeon()) interiors.enter('dungeon', at); else { player.yaw = at.yaw; player.teleport(at.x, at.z); } }
  }
  function glow(step, on) { S.glowHint = !!on; }
  function together(step, fast) {
    const inside = (fn, d = 1300) => { if (inBath() && S.B) fn(); else { interiors.enter('trollroom', { x: 1.2, z: 3.0, yaw: Math.PI }); setTimeout(fn, d); } };
    if (step === 0) { inside(() => { meet(); if (fast) S.met = Math.max(S.met, 4.1); }); return; }
    if (step === 1) { inside(() => jar.filter(J => J.st === 'hide').forEach((J, i) => setTimeout(() => findJar(J), fast ? 0 : i * 600))); return; }
    if (step === 2) { inside(() => { const run1 = (i) => { if (S.added < need()) { const J = jar[order[S.added]]; if (J.st === 'bench') addJar(J); } else stir(); };
      const n = need() - S.added + 3 - S.stir; for (let i = 0; i < n; i++) setTimeout(() => run1(i), fast ? i * 60 : i * 1000); }); return; }
    if (step === 3) { inside(drink); return; }
    if (step === 4) { const go = () => say(PASS); if (inDungeon() && S.dd) go(); else { interiors.enter('dungeon', { x: 5.6, z: 1.8, yaw: Math.PI / 2 }); setTimeout(go, 1500); } if (fast) setTimeout(() => { goyleOff(); done(4); }, 1700); }
  }
  function end() {
    S.active = false; BATH.myrtle = false;
    goyleOff();
    try { undress(); } catch { /* keep going */ }
    pw.classList.remove('on'); try { pw.remove(); css.remove(); } catch { /* ok */ }
  }
  function state() {
    return { room: interiors.active, bath: !!S.B, myrtle: !!(S.B && S.B.my), myTris: S.B ? S.B.myTris : null, bathTris: S.B ? S.B.tris : null, met: S.met > 0, found: S.found, need: need(), order: order.slice(), added: S.added, stir: S.stir, ready: S.ready > 0,
      drank: S.drank > 0, goyle: !!S.gk, door: !!S.dd, doorTris: S.ddTris || null, cards: pw.classList.contains('on'), pw: S.pw > 0, wrong: S.wrong, hallDoor: !!(S.hall && S.hall.door.visible), troll: !!(interiors.room && interiors.room.group && interiors.room.group.getObjectByName('adv-troll')) };
  }
  ctx._poly = {
    myrtleW: () => (inBath() ? RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z) : null),
    jarW: (k) => { const J = jar[k]; return inBath() && J ? RW(J.pos.x, J.pos.y + 0.15, J.pos.z) : null; },
    jarSt: () => jar.map(J => J.st),
    cauldronW: () => (inBath() ? RW(CAULDRON.x, 0.9, CAULDRON.z) : null),
    doorW: () => (inDungeon() ? RW(SDOOR.x, 1.3, SDOOR.z) : null),
    hallDoorW: () => new Vector3(HALL_DOOR.x, Y + 1.6, HALL_DOOR.z - 0.3),
    order: () => order.slice(), pass: PASS, sdoor: SDOOR, stallZ: STALL_Z,
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
