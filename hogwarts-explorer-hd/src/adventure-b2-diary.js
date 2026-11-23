// Book 2, adventure 5: "היומן של טום רידל" (Tom Riddle's diary). Data for adventures.js + the scene code.
// Kind and never scary: Tom Riddle is only friendly-looking writing on a page (no figure, no threat lines); the memory
// is three warm sepia picture cards (young Hagrid hugging a box, a fuzzy big-eyed baby spider peeking out, Hagrid
// looking wistful). Spells never act on Myrtle or Hagrid (a kind bubble). Everything exists only while the quest runs.
// Steps: 1 Myrtle's bathroom (the troll quest's room in its Myrtle state, BATH.myrtle; the same Entrance Hall door):
// tap the little black book lying in a puddle -> 2 the common room's writing desk: a full-screen parchment page opens;
// write "שלום" with big letter tiles (level 1: the next tile glows; levels 2-3: shuffled, with 0 / 1 extra letters so
// the board has 4 / 5 tiles); the ink sinks in and the diary answers letter by letter, read aloud: "שלום הארי. אני טום."
// -> 3 write "סוד": the diary says it will show a memory: three sepia cards, tap to turn -> 4 Hermione doubts it: go to
// Hagrid's hut and tap the door lantern (knock): Hagrid's bubble says it was never him and his spider never hurt
// anyone -> 5 back in the common room the diary is gone: tap the clue it left, a red hair ribbon: "ג'יני?".
// Closing the page only pauses (the letters stay); a wrong tile wobbles kindly; nothing fails.
import { Vector3 } from 'three';
import { FLOOR_Y } from './rooms.js';
import { BATH } from './adventure-troll.js';
import { buildHallDoor, HALL_DOOR, SPAWN } from './adventure-troll-build.js';
import { buildMyrtle, MYRTLE } from './adventure-b2-polyjuice-build.js';
import { HUT } from './grounds-film.js';
import { buildDiary, buildPuddle, buildDesk, buildRibbon, drawMemory, triCount, PUDDLE, DESK, DESK_STAND, FONT } from './adventure-b2-diary-build.js';

const HERM = { ico: '👧', name: 'הרמיוני' };
const MYR = '👻 מיילי', HAG = '🧔 האגריד';
export const B2DIARY = {
  id: 'b2-diary', book: 2, title: 'היומן של טום רידל', ico: '📓', col: '#2a2a3a', col2: '#8a8ab0', helper: HERM, confetti: ['✨', '⭐', '📓', '✒️'],
  pic: [['📓', 0.5, 0.56, 66], ['✒️', 0.8, 0.3, 30], ['✨', 0.2, 0.3, 28]],
  intro: [
    'בשירותים של מיילי מישהו השאיר ספר קטן ושחור... 📓',
    'זה יומן קסום: כשכותבים בו, הוא עונה!',
    'בוא נגלה מה הוא יודע. אני הרמיוני, ואני אעזור לך ✨',
  ],
  steps: [
    { line: 'מצא את הספר השחור בשירותים של מיילי 📓', hints: ['השירותים ליד אולם הכניסה, דרך הדלת החדשה 🚪', 'הספר הקטן שוכב בשלולית על הרצפה 💧', 'לך אחרי החץ הזהוב וגע בספר 📓'], glowL1: true },
    { line: 'כתוב ביומן "שלום" ✒️', hints: ['היומן מחכה על השולחן בחדר המועדון ✒️', 'גע ביומן, ואז באותיות לפי הסדר: ש-ל-ו-ם', 'האות הבאה זוהרת. גע בה! ✨'], glowL1: true },
    { line: 'כתוב ביומן "סוד" 🤫', hints: ['עכשיו כותבים: ס-ו-ד 🤫', 'האות הראשונה היא ס', 'גע בתמונות כדי להפוך אותן ▶'] },
    { line: 'לך לבקתה של האגריד ודפוק בדלת 🏡', hints: ['הבקתה של האגריד בחוץ, ליד היער 🏡', 'אפשר לטוס במפה אל הבקתה של האגריד 🗺️', 'גע בפנס שליד הדלת כדי לדפוק 🏮'] },
    { line: 'חזור לחדר המועדון ומצא רמז 🎀', hints: ['היומן נעלם מהשולחן! אולי השאירו רמז 🔍', 'משהו אדום מונח על השולחן 🎀', 'גע בסרט האדום 🎀'], glowL1: true },
  ],
  create: (ctx) => diaryScene(ctx),
  art: drawDiaryCard,
};

// the reward card picture: the little diary open with soft golden writing, a quill and a red ribbon (canvas)
function drawDiaryCard(x, cx, cy) {
  const E = (px, py, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, 7); x.fill(); };
  x.save(); x.translate(cx, cy + 10);
  x.fillStyle = '#1e1a1e'; x.beginPath(); x.roundRect(-104, -66, 208, 140, 10); x.fill();
  x.fillStyle = '#f2e6c8'; x.beginPath(); x.roundRect(-96, -60, 92, 126, 6); x.fill(); x.beginPath(); x.roundRect(4, -60, 92, 126, 6); x.fill();
  x.strokeStyle = '#c89a3a'; x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-86, -36 + i * 26); x.quadraticCurveTo(-50, -44 + i * 26, -14, -36 + i * 26); x.stroke(); }
  x.fillStyle = '#8a5a1a'; x.font = `bold 22px ${FONT}`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('שלום', 50, -24); x.fillText('הארי', 50, 8);
  x.restore();
  x.save(); x.translate(cx + 70, cy - 90); x.rotate(-0.6); E(0, 0, 10, 46, '#f4ece0'); x.strokeStyle = '#8a7a60'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -44); x.lineTo(0, 50); x.stroke(); x.restore();
  x.save(); x.translate(cx - 70, cy + 96); E(-16, 0, 16, 10, '#c8282a', 0.3); E(16, 0, 16, 10, '#c8282a', -0.3); E(0, 0, 7, 7, '#a01c22'); x.restore();
  x.save(); x.font = '30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✨', cx - 80, cy - 90); x.fillText('✨', cx + 96, cy + 30); x.restore();
}

// the words and the answers (exactly as in the brief); level 2-3 boards get extra letters so they have 4 / 5 tiles
const WORDS = ['שלום', 'סוד'];
const ANSWERS = ['שלום הארי. אני טום.', 'אני אראה לך זיכרון.'];
const BOARD = { 1: 0, 2: 4, 3: 5 };
const EXTRA = ['א', 'ב', 'מ', 'נ', 'ר', 'ת', 'ק', 'פ'];
const CAPTIONS = ['פעם, לפני הרבה שנים, האגריד הצעיר שמר על קופסה קטנה.', 'בתוך הקופסה גר עכביש תינוק, קטן ופרוותי, עם עיניים גדולות.', 'האגריד נראה קצת עצוב... ואז הזיכרון נגמר.'];

function diaryScene(ctx) {
  const { interiors, player, fun, freecast, burst, emit, camera, scene } = ctx;
  const S = { active: false, lastRoom: null, B: null, C: null, hall: null, got: 0, open: false, autoOpen: false, glowHint: false, casts0: 0, done: {}, t: 0, giggles: 0,
    word: 0, typed: 0, phase: 'write', ans: null, card: 0, wrong: 0, knock: 0, ribbon: 0, page: null, pages: 0, closes: 0, answers: [], spoke: [] };
  const lv = () => ctx.level;
  const sfx = (k, ...a) => { try { fun.sfx[k](...a); } catch { /* no audio */ } };
  const tone = (f, d, w = 0, type = 'triangle', v = 0.1, to) => { try { fun.sfx.tone(f, d, type, v, w, to); } catch { /* no audio */ } };
  const done = (i) => { if (S.done[i]) return; S.done[i] = 1; ctx.done(i); };
  const inBath = () => interiors.active === 'trollroom' && interiors.room && interiors.room.group;
  const inCommon = () => interiors.active === 'commonroom' && interiors.room && interiors.room.group;
  const outdoors = () => !interiors.active;
  const R = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08);
  const scr = { x: 0, y: 0, on: false }, v1 = new Vector3(), v2 = new Vector3();
  const FI = freecast && freecast._internal;
  const casts = () => (FI && FI.log ? FI.log.casts : 0);
  S.casts0 = casts();
  const RW = (x, y, z, out = new Vector3()) => out.set(x, y, z).add(interiors.room.group.position);
  const knock = () => { for (let i = 0; i < 3; i++) { tone(140, 0.08, i * 0.22, 'square', 0.08, 90); tone(90, 0.1, i * 0.22 + 0.01, 'triangle', 0.08); } };
  function lanternW(out = new Vector3()) {
    const hut = scene.getObjectByName('hagrid-hut'), L = hut && hut.userData.lantern;
    if (hut && L) { hut.updateMatrixWorld(true); return hut.localToWorld(out.set(L.x, L.y, L.z)); }
    const dl = Math.hypot(HUT.door[0], HUT.door[1]) || 1; const x = HUT.x + HUT.door[0] / dl * 5.4, z = HUT.z + HUT.door[1] / dl * 5.4;
    return out.set(x, (player.heightAt ? player.heightAt(x, z) : 0) + 2.6, z);
  }
  function hutFront(out = { x: 0, z: 0, yaw: 0 }) { const dl = Math.hypot(HUT.door[0], HUT.door[1]) || 1, dx = HUT.door[0] / dl, dz = HUT.door[1] / dl; out.x = HUT.x + dx * 9.5; out.z = HUT.z + dz * 9.5; out.yaw = Math.atan2(-dx, -dz); return out; }

  // ---------------- the Entrance Hall door (our own copy + portal while step 1 runs) ----------------
  function dressHall() {
    const r = interiors.room; if (!r || !r.group || r.group.userData.advBathDiary) return;
    const door = buildHallDoor(); r.group.add(door);
    const p = { x: HALL_DOOR.x, z: HALL_DOOR.z - 0.9, r: 0.9, to: 'trollroom', at: { ...SPAWN }, locked: () => !S.active || ctx.step !== 0, armed: false };
    r.portals.push(p);
    r.colliders.push({ type: 'box', x: HALL_DOOR.x, z: HALL_DOOR.z - 0.1, hw: 1.1, hd: 0.15, angle: 0 });
    r.group.userData.advBathDiary = { door, p }; S.hall = { door, p };
  }
  // ---------------- the bathroom: Myrtle + the diary in its puddle ----------------
  function dressBath() {
    const r = interiors.room; if (!r || !r.group || S.B) return;
    const g = r.group, B = { g };
    B.my = buildMyrtle(); B.my.root.position.set(MYRTLE.x, MYRTLE.y, MYRTLE.z); B.my.root.rotation.y = Math.PI / 2; g.add(B.my.root);
    B.pud = buildPuddle(); B.pud.position.set(PUDDLE.x, 0.012, PUDDLE.z); g.add(B.pud);
    B.book = buildDiary(false); B.book.position.set(PUDDLE.x + 0.05, 0.035, PUDDLE.z); B.book.rotation.y = 0.5; B.book.visible = !S.got; g.add(B.book);
    B.tris = triCount(B.pud) + triCount(B.book); B.myTris = triCount(B.my.root);
    S.B = B;
  }
  // ---------------- the common room: the writing desk (+ the open diary or the ribbon) ----------------
  function dressCommon(step) {
    const r = interiors.room; if (!r || !r.group) return;
    const g = r.group;
    if (!S.C) {
      const C = { g }; C.desk = buildDesk(); C.desk.position.set(DESK.x, 0, DESK.z); g.add(C.desk);
      r.colliders.push({ type: 'box', x: DESK.x + 0.2, z: DESK.z, hw: 0.75, hd: 0.7, angle: 0 });
      C.book = buildDiary(true); C.book.position.set(DESK.x + 0.12, DESK.top + 0.01, DESK.z); C.book.rotation.y = -Math.PI / 2; g.add(C.book);
      C.rib = buildRibbon(); C.rib.position.set(DESK.x + 0.12, DESK.top + 0.005, DESK.z + 0.05); C.rib.rotation.y = 0.4; g.add(C.rib);
      C.tris = triCount(C.desk) + triCount(C.book) + triCount(C.rib);
      S.C = C;
    }
    S.C.book.visible = step === 1 || step === 2;
    S.C.rib.visible = step === 4 && !S.ribbon;
  }
  function undress() {
    for (const o of [S.B && S.B.my.root, S.B && S.B.pud, S.B && S.B.book, S.C && S.C.desk, S.C && S.C.book, S.C && S.C.rib]) if (o && o.parent) o.parent.remove(o);
    S.B = null; S.C = null;
    if (S.hall) S.hall.door.visible = false;
  }

  // ---------------- the writing page (DOM: a full-screen RTL parchment; the hint ladder stays on top of it) ----------------
  const css = document.createElement('style'); css.id = 'b2diaryCss';
  css.textContent = `#b2Page{position:fixed;inset:0;z-index:12;display:none;flex-direction:column;align-items:center;justify-content:flex-start;box-sizing:border-box;
    padding:calc(96px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom));direction:rtl;font-family:${FONT};touch-action:manipulation;
    background:radial-gradient(ellipse at 50% 45%,#f8edd2 0%,#ead7ae 62%,#c9a870 100%);color:#3a2410}
  #b2Page.on{display:flex}
  #b2Page .hd{font-size:24px;font-weight:bold;color:#7a4a1a;text-align:center;margin-bottom:4px}
  #b2Page .hd b{font-size:34px;color:#3a2410;letter-spacing:2px}
  #b2Page .ink{min-height:94px;width:min(820px,92vw);box-sizing:border-box;margin:6px 0 10px;padding:8px 14px;border-bottom:3px dashed rgba(122,74,26,.45);
    font:bold 60px/1.3 ${FONT};color:#1e2a5a;text-align:center;transition:opacity 1.2s, color 1.2s;word-break:keep-all}
  #b2Page .ink.sink{opacity:0;color:#6a5a3a}
  #b2Page .ink.ans{color:#8a4a12;font-style:italic;font-size:46px;text-shadow:0 0 12px rgba(255,210,120,.65)}
  #b2Page .tiles{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:6px;max-width:94vw}
  #b2Page .tile{width:clamp(66px,17vw,96px);height:clamp(66px,17vw,96px);border-radius:18px;border:4px solid #8a5a20;background:linear-gradient(#fffaf0,#efdcb4);color:#3a2410;
    font:bold clamp(40px,10vw,56px)/1 ${FONT};cursor:pointer;touch-action:manipulation;box-shadow:0 5px 0 #8a5a20,0 8px 16px rgba(60,30,10,.35);padding:0}
  #b2Page .tile.used{opacity:.25;box-shadow:none;transform:translateY(5px)}
  #b2Page .tile.glow{border-color:#fff;animation:advPulse .9s ease-in-out infinite;background:linear-gradient(#fff6c8,#ffd76a)}
  #b2Page .tile.wob{animation:b2wob .5s ease-in-out}
  @keyframes b2wob{0%,100%{transform:rotate(0)}20%{transform:rotate(-9deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(4deg)}}
  #b2Page .card{display:none;flex-direction:column;align-items:center;gap:8px;cursor:pointer}
  #b2Page.cards .card{display:flex} #b2Page.cards .tiles,#b2Page.cards .ink{display:none}
  #b2Page .card canvas{width:min(560px,90vw,calc((100vh - 290px) * 1.41));height:auto;border-radius:16px;box-shadow:0 8px 26px rgba(60,30,10,.45);animation:b2turn .5s ease-out}
  @keyframes b2turn{0%{transform:perspective(800px) rotateY(80deg);opacity:.2}100%{transform:none;opacity:1}}
  #b2Page .card .cap{font-size:23px;font-weight:bold;text-align:center;max-width:min(620px,90vw);line-height:1.3}
  #b2Page .card .nx{padding:8px 24px;border-radius:20px;background:#7a3a12;color:#ffe9a8;font-size:21px;font-weight:bold}
  #b2Page .cls{position:absolute;left:calc(12px + env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom));padding:10px 18px;border-radius:20px;border:3px solid #8a5a20;
    background:rgba(255,248,228,.95);color:#5a3010;font:bold 20px ${FONT};cursor:pointer;touch-action:manipulation}
  body.b2page .gamebtn,body.b2page #camctl,body.b2page #fcBtn,body.b2page #wandBtn,body.b2page #bellBtn,body.b2page #enterBtn,body.b2page #joy,body.b2page #joyKnob,
  body.b2page #quest,body.b2page #bubble,body.b2page #funPrompt,body.b2page #fcWheel,body.b2page #advEdge{display:none !important}
  body.modalOn #b2Page{display:none !important}
  @media (max-width:700px){#b2Page{padding-top:calc(84px + env(safe-area-inset-top))} #b2Page .hd{font-size:20px} #b2Page .hd b{font-size:28px}
    #b2Page .ink{font-size:46px;min-height:74px} #b2Page .ink.ans{font-size:32px} #b2Page .tiles{gap:9px} #b2Page .card .cap{font-size:19px}}`;
  document.head.appendChild(css);
  const page = document.createElement('div'); page.id = 'b2Page'; document.body.appendChild(page);
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'pointerup', 'wheel']) page.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const hd = document.createElement('div'); hd.className = 'hd'; page.appendChild(hd);
  const ink = document.createElement('div'); ink.className = 'ink'; page.appendChild(ink);
  const tiles = document.createElement('div'); tiles.className = 'tiles'; page.appendChild(tiles);
  const card = document.createElement('div'); card.className = 'card'; page.appendChild(card);
  const cardCv = document.createElement('canvas'); cardCv.width = 480; cardCv.height = 340; card.appendChild(cardCv);
  const cap = document.createElement('div'); cap.className = 'cap'; card.appendChild(cap);
  const cardNx = document.createElement('div'); cardNx.className = 'nx'; card.appendChild(cardNx);
  card.addEventListener('click', (e) => { e.stopPropagation(); turnCard(); });
  const cls = document.createElement('button'); cls.className = 'cls'; cls.textContent = '📕 לסגור את היומן'; page.appendChild(cls);
  cls.addEventListener('click', (e) => { e.stopPropagation(); closePage(true); });

  let board = [];   // the tiles of the current word: { l, el, used }
  function makeBoard() {
    const w = WORDS[S.word], letters = [...w], n = BOARD[lv()] || 0;
    let list = letters.slice();
    if (lv() > 1) {
      const pool = EXTRA.filter(l => !letters.includes(l));
      while (list.length < Math.max(n, letters.length + (lv() === 3 ? 1 : 0))) list.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      if (list.join('') === w) list.reverse();
    }
    tiles.innerHTML = '';
    board = list.map((l) => {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = l; b.dataset.l = l; tiles.appendChild(b);
      const T = { l, el: b, used: false };
      b.addEventListener('click', (e) => { e.stopPropagation(); tapTile(T); });
      return T;
    });
    // a word already part-written (closing the page keeps the letters)
    for (let i = 0; i < S.typed; i++) { const T = board.find(t => !t.used && t.l === letters[i]); if (T) { T.used = true; T.el.classList.add('used'); } }
  }
  function render() {
    page.classList.toggle('cards', S.phase === 'cards');
    if (S.phase === 'cards') { drawCard(); return; }
    hd.innerHTML = '';
    const a = document.createElement('span'); a.textContent = '📓 כתוב ביומן: '; hd.appendChild(a);
    const b = document.createElement('b'); b.textContent = WORDS[S.word]; hd.appendChild(b);
    if (S.phase === 'write') { ink.className = 'ink'; ink.textContent = WORDS[S.word].slice(0, S.typed) || ' '; }
    if (!board.length || board.wordIdx !== S.word) { makeBoard(); board.wordIdx = S.word; }
    glowTiles();
  }
  function glowTiles() {
    const want = S.phase === 'write' ? WORDS[S.word][S.typed] : null, on = lv() === 1 || S.glowHint;
    let lit = false;
    for (const T of board) { const g = !!(on && want && !T.used && T.l === want && !lit); if (g) lit = true; T.el.classList.toggle('glow', g); }
  }
  function openPage() {
    if (S.open || !S.active || (ctx.step !== 1 && ctx.step !== 2) || ctx.isModal()) return false;
    S.open = true; S.pages++; page.classList.add('on'); document.body.classList.add('b2page'); sfx('flip'); ctx.poke();
    if (S.phase === 'answer' || S.phase === 'sink') { /* keeps going */ }
    render();
    if (S.phase === 'write' && S.typed === 0) ctx.say(S.word === 0 ? 'כתוב "שלום": גע באותיות לפי הסדר, מימין לשמאל ✒️' : 'עכשיו כתוב "סוד" 🤫', null, 4);
    return true;
  }
  function closePage(byKid) {
    if (!S.open) return;
    S.open = false; page.classList.remove('on'); document.body.classList.remove('b2page');
    if (byKid) { S.closes++; sfx('flip'); ctx.say('היומן מחכה על השולחן. אפשר לחזור אליו מתי שרוצים 📓', null, 3); }
  }
  function tapTile(T) {
    if (!S.open || S.phase !== 'write' || T.used) return;
    ctx.poke();
    const want = WORDS[S.word][S.typed];
    if (T.l !== want) {
      S.wrong++; T.el.classList.remove('wob'); void T.el.offsetWidth; T.el.classList.add('wob'); sfx('soft');
      ctx.oops('כמעט! 🙂 עכשיו צריך את האות ' + want);
      return;
    }
    T.used = true; T.el.classList.add('used'); T.el.classList.remove('glow'); S.typed++; sfx('pop'); tone(520 + S.typed * 60, 0.12, 0, 'sine', 0.06);
    ink.textContent = WORDS[S.word].slice(0, S.typed);
    if (S.typed >= WORDS[S.word].length) { S.phase = 'sink'; S.sinkT = 0; sfx('sparkle'); }
    glowTiles();
  }
  function drawCard() {
    try { drawMemory(cardCv.getContext('2d'), S.card, 480, 340); } catch { /* the picture is optional */ }
    cardCv.style.animation = 'none'; void cardCv.offsetWidth; cardCv.style.animation = '';
    cap.textContent = CAPTIONS[S.card]; cardNx.textContent = S.card < 2 ? 'גע כדי להפוך ◀' : 'גע כדי לסגור ✨';
  }
  function turnCard() {
    if (!S.open || S.phase !== 'cards' || ctx.step !== 2) return;
    ctx.poke(); sfx('flip');
    if (S.card < 2) { S.card++; drawCard(); ctx.speak(CAPTIONS[S.card]); return; }
    S.phase = 'done'; closePage(false);
    ctx.say('הזיכרון נגמר... 🤔 היומן אומר שהאגריד פתח את החדר. אבל האגריד אף פעם לא היה עושה דבר כזה!', '👧 הרמיוני', 5.5);
    setTimeout(() => done(2), 1800);
  }

  // ---------------- step actions ----------------
  const GIG = ['היי-היי! 😄 מישהו זרק את הספר הזה לשירותים שלי!', 'הי-הי! הספר הזה רטוב, אבל הוא שלך עכשיו 😄', 'היי-היי! אף אחד לא בא לבקר אותי 😄'];
  function meet() { S.giggles++; sfx('giggle', true); ctx.say(GIG[S.giggles % GIG.length], MYR, 3); }
  function pickBook() {
    if (ctx.step !== 0 || S.got || !S.B) return;
    S.got = 0.001; ctx.poke(); sfx('chime'); sfx('pop');
    RW(PUDDLE.x, 0.3, PUDDLE.z, v1); burst(v1.x, v1.y, v1.z, 0xbfe0ff, 16, 1.4, 0.8, 0.2, -0.6);
    setTimeout(() => { if (S.active) ctx.say('היי-היי! מישהו זרק את הספר הזה לשירותים שלי! הוא רטוב, אבל הוא שלך 😄', MYR, 4.2); }, 700);
  }
  function knockDoor() {
    if (ctx.step !== 3 || S.knock) return;
    S.knock = 0.001; ctx.poke(); knock();
    setTimeout(() => { if (S.active) ctx.say('הארי! זה לא הייתי אני, אף פעם! והעכביש הקטן שלי אף פעם לא פגע באף אחד. הוא רק היה צריך בית חם 🕷️💛', HAG, 6.5); }, 1100);
    setTimeout(() => { if (S.active) ctx.say('ידעתי! האגריד טוב לב. מישהו אחר פתח את החדר 🤔', '👧 הרמיוני', 4); }, 7800);
    setTimeout(() => { if (S.active) done(3); }, 11500);
  }
  function findRibbon() {
    if (ctx.step !== 4 || S.ribbon || !S.C) return;
    S.ribbon = 0.001; ctx.poke(); sfx('chime'); sfx('sparkle');
    RW(DESK.x + 0.12, DESK.top + 0.2, DESK.z, v1); burst(v1.x, v1.y, v1.z, 0xff6a6a, 18, 1.6, 0.9, 0.2, -0.6);
    ctx.say('ג\'יני? 🎀', '🧑 הארי', 3);
    setTimeout(() => { if (S.active) ctx.say('זה הסרט של ג\'יני! היומן אצלה... צריך לעזור לה 💛', '👧 הרמיוני', 4.5); }, 3200);
    setTimeout(() => { if (S.active) done(4); }, 7200);
  }

  // ---------------- per frame ----------------
  function update(dt, step, busy) {
    S.t += dt;
    const r = interiors.room;
    if (r !== S.lastRoom) {
      S.lastRoom = r; S.B = null; S.C = null; S.hall = null;
      if (interiors.active === 'entrancehall' && S.active && step === 0) dressHall();
      if (interiors.active === 'entrancehall' && r && r.group && r.group.userData.advBathDiary) S.hall = r.group.userData.advBathDiary;
    }
    if (S.active && inBath() && step === 0 && !S.B) dressBath();
    if (S.active && inCommon() && step >= 1 && step !== 3 && !S.C) dressCommon(step);
    if (S.C) dressCommon(step);
    if (S.hall) S.hall.door.visible = S.active && interiors.active === 'entrancehall' && step === 0;
    // casts: never on Myrtle or Hagrid; the diary is written by hand
    const n = casts();
    if (n !== S.casts0) {
      S.casts0 = n;
      if (inBath() && S.B) ctx.say('לא מטילים לחשים על מיילי 🙂 הספר שוכב בשלולית. גע בו!', null, 3.5);
      else if (step === 3 && outdoors()) { const L = lanternW(v1); if (Math.hypot(player.pos.x - L.x, player.pos.z - L.z) < 14) ctx.say('לא צריך לחש 🙂 פשוט דופקים בדלת של האגריד. גע בפנס 🏮', null, 3.5); }
      else if (inCommon() && (step === 1 || step === 2)) ctx.say('ביומן כותבים ביד, בלי שרביט ✒️ גע ביומן', null, 3);
    }
    // the bathroom: Myrtle floats and turns to Harry; the book glows on level 1 / after the glow hint; picked: it flies to Harry
    if (S.B) {
      const B = S.B, M = B.my.root, g = B.g.position;
      M.position.y = MYRTLE.y + Math.sin(S.t * 1.4) * 0.08;
      const face = Math.atan2(player.pos.x - g.x - MYRTLE.x, player.pos.z - g.z - MYRTLE.z); M.rotation.y += (face - M.rotation.y) * Math.min(1, dt * 2);
      B.my.mat.opacity = 0.58 + Math.sin(S.t * 2.1) * 0.06;
      if (S.got > 0) {
        S.got += dt; const k = Math.min(1, S.got / 1.0);
        B.book.position.set(PUDDLE.x + (player.pos.x - g.x - PUDDLE.x) * k, 0.035 + Math.sin(k * Math.PI) * 1.2 + k * 1.0, PUDDLE.z + (player.pos.z - g.z - PUDDLE.z) * k); B.book.rotation.y += dt * 6;
        if (k >= 1) B.book.visible = false;
        if (S.got > 4.8) done(0);
      } else if ((lv() === 1 || S.glowHint) && Math.random() < dt * 3) { RW(PUDDLE.x, 0.15, PUDDLE.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.4, v1.y, v1.z + (Math.random() - 0.5) * 0.4, 0, 0.35, 0, 0.8, 0.14, 0xffe07a, 0); }
    }
    // the common room: the diary glows softly on its desk; the ribbon sparkles (level 1)
    if (S.C) {
      if ((step === 1 || step === 2) && !S.open && Math.random() < dt * 2.5) { RW(DESK.x + 0.12, DESK.top + 0.1, DESK.z, v1); emit(v1.x + (Math.random() - 0.5) * 0.3, v1.y, v1.z + (Math.random() - 0.5) * 0.3, 0, 0.3, 0, 0.8, 0.13, 0xffe07a, 0); }
      if (step === 4 && !S.ribbon && (lv() === 1 || S.glowHint) && Math.random() < dt * 3) { RW(DESK.x + 0.12, DESK.top + 0.1, DESK.z + 0.05, v1); emit(v1.x + (Math.random() - 0.5) * 0.25, v1.y, v1.z + (Math.random() - 0.5) * 0.25, 0, 0.3, 0, 0.8, 0.13, 0xff9a9a, 0); }
      if (S.ribbon > 0) { S.ribbon += dt; const k = Math.min(1, S.ribbon / 0.8); S.C.rib.position.y = DESK.top + 0.005 + k * 0.5; S.C.rib.rotation.y += dt * 4; if (S.ribbon > 2.6) S.C.rib.visible = false; }
      // close to the desk: the ✒️ prompt opens the page (a tap on the diary works too)
      const d = Math.hypot(player.pos.x - S.C.g.position.x - DESK.x, player.pos.z - S.C.g.position.z - DESK.z);
      if ((step === 1 || step === 2) && !S.open && !busy && d < 3.0) { try { fun.offer('adv-diary', '✒️', d, () => openPage()); } catch { /* ok */ } }
      if (S.autoOpen && (step === 1 || step === 2) && !busy && d < 3.4) { S.autoOpen = false; setTimeout(() => { if (S.active && inCommon()) openPage(); }, 900); }
    }
    // the hut: close to the door, the 🚪 prompt knocks (a tap on the lantern works too)
    if (step === 3 && outdoors() && !S.knock && !busy) { const L = lanternW(v1), d = Math.hypot(player.pos.x - L.x, player.pos.z - L.z); if (d < 5.5) { try { fun.offer('adv-knock', '🚪', d, knockDoor); } catch { /* ok */ } } }
    if (step === 3 && S.knock > 0) S.knock += dt;
    // the page: the ink sinks in, then the diary answers letter by letter (read aloud)
    if (S.phase === 'sink') {
      S.sinkT += dt;
      if (S.sinkT > 0.15 && !ink.classList.contains('sink')) ink.classList.add('sink');
      if (S.sinkT > 1.6) { S.phase = 'answer'; S.ans = { text: ANSWERS[S.word], i: 0, t: 0 }; ink.className = 'ink ans'; ink.textContent = ''; ctx.speak(ANSWERS[S.word]); S.answers.push(ANSWERS[S.word]); tone(660, 0.5, 0, 'sine', 0.04, 880); }
    } else if (S.phase === 'answer' && S.ans) {
      const A = S.ans; A.t += dt;
      while (A.t > 0.11 && A.i < A.text.length) { A.t -= 0.11; A.i++; ink.textContent = A.text.slice(0, A.i); if (A.text[A.i - 1] !== ' ' && A.i % 2) tone(1200 + Math.random() * 300, 0.04, 0, 'sine', 0.015); }
      if (A.i >= A.text.length) { A.t2 = (A.t2 || 0) + dt; if (A.t2 > 1.6) {
        S.ans = null;
        if (S.word === 0) { S.phase = 'wait'; done(1); }
        else { S.phase = 'cards'; S.card = 0; if (S.open) { render(); ctx.speak(CAPTIONS[0]); } }
      } }
    }
  }

  // ---------------- taps ----------------
  function tap(x, y, step) {
    const rr = R();
    const near = (v) => { ctx.screen(v, scr); return scr.on ? Math.hypot(scr.x - x, scr.y - y) : 1e9; };
    if (inBath() && S.B) {
      if (step === 0 && !S.got && near(RW(PUDDLE.x, 0.1, PUDDLE.z, v1)) < rr * 1.8) { pickBook(); return true; }
      if (near(RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z, v1)) < rr * 2.0) { meet(); return true; }
    }
    if (inCommon() && S.C) {
      if ((step === 1 || step === 2) && near(RW(DESK.x + 0.12, DESK.top, DESK.z, v1)) < rr * 2.2) { openPage(); return true; }
      if (step === 4 && !S.ribbon && near(RW(DESK.x + 0.12, DESK.top + 0.05, DESK.z + 0.05, v1)) < rr * 1.8) { findRibbon(); return true; }
    }
    if (step === 3 && outdoors() && !S.knock && near(lanternW(v1)) < rr * 2.4) { knockDoor(); return true; }
    return false;
  }

  // ---------------- the arrow ----------------
  function goal(step, out) {
    if (S.open) return null;
    if (step === 0) {
      if (!inBath()) {
        if (interiors.active === 'entrancehall') return out.set(HALL_DOOR.x, FLOOR_Y + 1.95, HALL_DOOR.z - 0.7);
        return ctx.routeTo('entrancehall', out, ['entrancehall', 'staircase']);
      }
      return S.B && !S.got ? RW(PUDDLE.x, -0.3, PUDDLE.z, out) : null;
    }
    if (step === 1 || step === 2 || step === 4) {
      if (!inCommon()) return ctx.routeTo('commonroom', out, ['staircase', 'entrancehall']);
      if (!S.C || (step === 4 && S.ribbon)) return null;
      return RW(DESK.x + 0.12, DESK.top - 0.4, DESK.z, out);
    }
    if (step === 3) {
      if (!outdoors()) return ctx.routeTo('__hut', out, ['out', 'entrancehall', 'staircase']);
      return S.knock ? null : lanternW(out).setY(lanternW(v2).y - 1.2);
    }
    return null;
  }

  function begin(step, resumed) {
    S.active = true; BATH.myrtle = step === 0;
    if (step === 2) { S.word = 1; S.typed = 0; S.phase = 'write'; S.card = 0; board = []; if (S.open) setTimeout(() => { if (S.open && ctx.step === 2) { render(); ctx.say('עכשיו כתוב "סוד" 🤫', null, 3.5); } }, 600); }
    if (step === 1) { S.word = 0; S.typed = 0; S.phase = 'write'; board = []; }
    if (step === 1 && !resumed) ctx.say('יש לנו את היומן! בוא נכתוב בו בחדר המועדון ✒️', '👧 הרמיוני', 4);
    if (step === 3) { closePage(false); if (!resumed) setTimeout(() => { if (S.active) ctx.say('אני לא מאמינה שזה האגריד! בוא נלך לבקתה שלו ונשאל אותו 🏡', '👧 הרמיוני', 4.5); }, 2400); }
    if (step === 4 && !resumed) ctx.say('בוא נחזור לחדר המועדון ונספר ליומן... 📓', '👧 הרמיוני', 3.5);
    if (!resumed) return;
    // a resume (reload / the book): go to the right place; the step starts over
    if (step === 0) { if (!inBath()) interiors.enter('trollroom', { ...SPAWN }); }
    if (step === 1 || step === 2 || step === 4) { if (!inCommon()) interiors.enter('commonroom', { ...DESK_STAND }); else { player.yaw = DESK_STAND.yaw; player.teleport(DESK_STAND.x, DESK_STAND.z); } if (step !== 4) S.autoOpen = true; }
    if (step === 3) { const f = hutFront(); if (interiors.active) interiors.exit(); player.yaw = f.yaw; player.teleport(f.x, f.z); }
  }
  function glow(step, on) { S.glowHint = !!on; if (S.open) glowTiles(); }
  function together(step, fast) {
    const soon = (ok, fn, n = 0) => { if (!S.active) return; if (ok()) { try { fn(); } catch (e) { console.warn('[b2-diary] together -', e && e.message || e); } return; } if (n < 80) setTimeout(() => soon(ok, fn, n + 1), 250); };   // waits for the room
    const toDesk = (fn) => { if (!(inCommon() && S.C)) interiors.enter('commonroom', { ...DESK_STAND }); soon(() => inCommon() && S.C, fn); };
    if (step === 0) { const go = () => { pickBook(); if (fast) S.got = Math.max(S.got, 4.7); }; if (!(inBath() && S.B)) interiors.enter('trollroom', { x: PUDDLE.x + 1.2, z: PUDDLE.z + 1.4, yaw: Math.PI }); soon(() => inBath() && S.B, go); return; }
    if (step === 1 || step === 2) {
      if (fast) { closePage(false); S.phase = step === 1 ? 'wait' : 'done'; done(step); return; }
      toDesk(() => {
        if (!S.open) openPage();
        const w = WORDS[S.word], left = w.length - S.typed;
        for (let i = 0; i < left; i++) setTimeout(() => { const want = w[S.typed]; const T = board.find(t => !t.used && t.l === want); if (T) tapTile(T); }, 500 + i * 550);
      });
      if (step === 2) { const flip = () => { if (S.phase === 'cards') { turnCard(); if (S.phase === 'cards') setTimeout(flip, 2600); } else if (ctx.step === 2 && S.active) setTimeout(flip, 700); }; setTimeout(flip, 4000); }
      return;
    }
    if (step === 3) { if (fast) { done(3); return; } if (!outdoors()) interiors.exit(); const f = hutFront(); setTimeout(() => { player.yaw = f.yaw; player.teleport(f.x, f.z); knockDoor(); }, 600); return; }
    if (step === 4) { toDesk(() => { findRibbon(); if (fast) S.ribbon = Math.max(S.ribbon, 2.7); if (fast) setTimeout(() => done(4), 100); }); }
  }
  function end() {
    S.active = false; BATH.myrtle = false;
    closePage(false);
    try { undress(); } catch { /* keep going */ }
    try { page.remove(); css.remove(); } catch { /* ok */ }
    document.body.classList.remove('b2page');
  }
  function state() {
    return { room: interiors.active, bath: !!S.B, myTris: S.B ? S.B.myTris : null, bathTris: S.B ? S.B.tris : null, got: S.got > 0, desk: !!S.C, deskTris: S.C ? S.C.tris : null,
      open: S.open, word: S.word, typed: S.typed, phase: S.phase, card: S.card, wrong: S.wrong, answers: S.answers.slice(), ink: ink.textContent, closes: S.closes, pages: S.pages,
      knock: S.knock > 0, ribbon: S.ribbon > 0, tiles: board.map(t => t.l + (t.used ? '*' : '')), hallDoor: !!(S.hall && S.hall.door.visible),
      troll: !!(interiors.room && interiors.room.group && interiors.room.group.getObjectByName('adv-troll')) };
  }
  ctx._diary = {
    bookW: () => (inBath() ? RW(PUDDLE.x, 0.1, PUDDLE.z) : null),
    myrtleW: () => (inBath() ? RW(MYRTLE.x, MYRTLE.y + 0.8, MYRTLE.z) : null),
    deskW: () => (inCommon() ? RW(DESK.x + 0.12, DESK.top, DESK.z) : null),
    ribbonW: () => (inCommon() ? RW(DESK.x + 0.12, DESK.top + 0.05, DESK.z + 0.05) : null),
    lanternW: () => lanternW(new Vector3()), hutFront: () => hutFront(),
    want: () => (S.phase === 'write' ? WORDS[S.word][S.typed] : null), word: () => WORDS[S.word], desk: DESK, deskStand: DESK_STAND, puddle: PUDDLE,
  };
  return { begin, update, goal, tap, glow, together, end, state };
}
