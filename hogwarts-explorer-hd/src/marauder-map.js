// The Marauder's Map parchment ("מפת הטרדנים"), book 3 piece B (briefs/2026-11-26-book3-piece-b.md). One DOM overlay
// (a parchment card + a 2D canvas, no 3D mesh, no GPU texture) shared by the `b3-map` quest and free play:
//   * oath: big tiles spell "אני נשבע" (quest level 1: the next tile glows; levels 2-3: shuffled, plus "בחגיגיות");
//     in free play one tap on "אני נשבע בחגיגיות..." is enough. The oath is read aloud (voice.js), then ink lines
//     spread and the castle plan draws itself.
//   * map: rooms as a simple hand-drawn plan with little labelled footprints: Harry where he is, the roaming teachers at
//     their logical places (roam.js state()), Ron and Hermione in the courtyard, Hagrid by the hut, Buckbeak by the
//     paddock; a pulsing dotted secret passage from the statue in the staircase hall to Honeydukes.
//   * manage: "השובבות הסתיימה" (Mischief managed): the ink fades and the parchment closes.
// Free play: a round 📜 button above the 📖 one opens it (hidden while an adventure, a lesson / course, Quidditch, the Floo
// or a modal runs). The existing 🗺️ travel map is untouched. Debug: window.__b3mm (state(), feet(), passageScreen(), ...).
import { speak as voiceSpeak } from './voice.js';

const FONT = "'Rubik','Arial Hebrew','Noto Sans Hebrew','Heebo',Arial,sans-serif";
const LW = 640, LH = 820;   // the plan's logical size (north up, east right)
// rooms on the plan: [x, y, w, h], label; `half` = the room's half size in metres (room-local x, z) for footprints
const ROOMS = {
  commonroom: { r: [215, 64, 210, 128], t: 'חדר המועדון', half: [9, 9] },
  classrooms: { r: [18, 222, 180, 160], t: 'הכיתות', half: [16, 11] },
  staircase: { r: [214, 222, 212, 160], t: 'המדרגות הנעות', half: [10, 11] },
  tower: { r: [442, 222, 160, 160], t: 'מגדל הכוכבים', half: [8, 8] },
  greathall: { r: [18, 410, 196, 140], t: 'האולם הגדול', half: [11, 18] },
  entrancehall: { r: [228, 410, 184, 140], t: 'אולם הכניסה', half: [8, 12] },
  library: { r: [426, 410, 176, 140], t: 'הספרייה', half: [11, 11] },
  dungeon: { r: [18, 578, 180, 110], t: 'מרתף השיקויים', half: [10, 10] },
  courtyard: { r: [228, 578, 184, 110], t: 'החצר', world: [0, 30, 22, 12] },
  hut: { r: [18, 714, 180, 86], t: 'הבקתה של האגריד' },
  paddock: { r: [228, 714, 184, 86], t: 'יצורי הפלא' },
  b3honey: { r: [446, 606, 176, 194], t: 'הוניידוקס', shop: true },
};
const STATUE = [404, 366];   // the one-eyed witch in the staircase hall (south-east corner of the hall)
const PASSAGE = [STATUE, [470, 394], [620, 398], [622, 540], [560, 572], [534, 612]];
const NAMES = { harry: 'הארי', ron: 'רון', hermione: 'הרמיוני', hagrid: 'האגריד', buckbeak: 'אבזם', mcgon: 'מקגונגל', flitwick: 'פליטוויק', snape: 'סנייפ', defence: 'טונקס', sinistra: 'סיניסטרה' };
const OATH = 'אני נשבע בחגיגיות שאני מתכנן רק שובבות!';

const S = { open: false, mode: 'free', phase: 'oath', lv: 1, opts: {}, typed: 0, words: [], tiles: [], ink: 0, fade: 0, t: 0, raf: 0, last: 0, feet: [], passTap: 0, wrong: 0, opens: 0, closes: 0, managed: 0,
  oaths: 0, scale: 1, built: false, btn: null, inited: false, deps: null, glow: false, err: 0 };
let ov = null, paper = null, head = null, cv = null, cx = null, tilesEl = null, lineEl = null, sayEl = null, mBtn = null, closeX = null;

const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
const sfx = (k, ...a) => { try { const s = window.HPFun && window.HPFun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };
function speak(text) { try { if (S.opts.speak) S.opts.speak(text); else if (!muted()) voiceSpeak(text, { preset: 'narrator' }); } catch { /* no speech */ } }

function build() {
  if (S.built) return; S.built = true;
  const css = document.createElement('style'); css.id = 'b3mmCss';
  css.textContent = `
  #mmOv{position:fixed;inset:0;z-index:36;display:none;align-items:center;justify-content:center;background:rgba(24,14,6,.66);direction:rtl;font-family:${FONT};touch-action:manipulation}
  #mmOv.on{display:flex}
  #mmOv.q{z-index:14;top:calc(92px + env(safe-area-inset-top));background:rgba(24,14,6,.5)}
  #mmOv .paper{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 14px 12px;border-radius:18px;box-sizing:border-box;max-width:96vw;max-height:100%;
    background:radial-gradient(ellipse at 50% 40%,#f6e7c4,#e8d1a0 70%,#d4b47a);box-shadow:0 10px 40px rgba(0,0,0,.6),inset 0 0 40px rgba(120,70,20,.45);border:3px solid #b8862e}
  #mmOv .hd{font-size:26px;font-weight:bold;color:#5a2e0c;text-shadow:0 1px 0 rgba(255,240,200,.8);line-height:1.1}
  #mmOv canvas{display:block;border-radius:10px}
  #mmOv .line{min-height:1.2em;font-size:24px;font-weight:bold;color:#4a2408;text-align:center}
  #mmOv .say{min-height:1.1em;font-size:19px;font-weight:bold;color:#7a3a10;text-align:center;max-width:90vw}
  #mmOv .tiles{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;direction:rtl;min-height:10px}
  #mmOv .tile{min-width:118px;padding:12px 18px;border-radius:16px;border:4px solid #8a5a1a;background:linear-gradient(#fff4d6,#f0d8a4);color:#3a1c06;font:bold 34px ${FONT};cursor:pointer;touch-action:manipulation;box-shadow:0 4px 0 #8a5a1a}
  #mmOv .tile.used{opacity:.25;pointer-events:none}
  #mmOv .tile.next{animation:mmGlow 1s ease-in-out infinite}
  #mmOv .tile.wob{animation:mmWob .45s ease-in-out}
  #mmOv .tile.big{font-size:28px;padding:14px 22px}
  #mmOv .mng{padding:12px 26px;border-radius:24px;border:4px solid #fff;background:linear-gradient(#ffe48a,#ffb020);color:#4a2400;font:bold 28px ${FONT};cursor:pointer;touch-action:manipulation;box-shadow:0 0 22px rgba(255,200,90,.9);animation:mmGlow 1.3s ease-in-out infinite}
  #mmOv .x{position:absolute;top:6px;left:8px;width:44px;height:44px;border-radius:50%;border:3px solid #8a5a1a;background:#f6e3b8;color:#5a2e0c;font:bold 22px Arial;cursor:pointer;padding:0}
  @keyframes mmGlow{0%,100%{box-shadow:0 4px 0 #8a5a1a,0 0 0 rgba(255,200,80,0)}50%{box-shadow:0 4px 0 #8a5a1a,0 0 22px 8px rgba(255,200,80,.95)}}
  @keyframes mmWob{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}
  #mmBtn{right:calc(18px + env(safe-area-inset-right));bottom:calc(320px + env(safe-area-inset-bottom));font-size:38px;padding:0;cursor:pointer;touch-action:manipulation;
    background:radial-gradient(circle at 50% 35%,rgba(240,214,150,.97),rgba(150,96,36,.92))}
  body.modalOn #mmBtn,body.inAdv #mmBtn,body.inSpell #mmBtn,body.inMatch #mmBtn,body.inFloo #mmBtn,body.mmOn #mmBtn{display:none !important}
  @media (max-width:700px){#mmOv.q{top:calc(104px + env(safe-area-inset-top))} #mmOv .paper{padding:6px 6px 8px;max-width:99vw;gap:4px} #mmOv .tile{min-width:96px;font-size:28px;padding:10px 14px} #mmOv .hd{font-size:22px} #mmOv .line{font-size:20px} #mmOv .say{font-size:17px} #mmOv .mng{font-size:24px;padding:10px 20px}}`;
  document.head.appendChild(css);
  const mk = (tag, cls, parent, id) => { const e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; parent.appendChild(e); return e; };
  ov = mk('div', null, document.body, 'mmOv');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) ov.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  paper = mk('div', 'paper', ov);
  head = mk('div', 'hd', paper); head.textContent = '📜 מפת הטרדנים';
  closeX = mk('button', 'x', paper); closeX.textContent = '✕'; closeX.setAttribute('aria-label', 'סגירה');
  closeX.addEventListener('click', (e) => { e.stopPropagation(); if (S.mode === 'free') close(); });
  cv = mk('canvas', null, paper); cx = cv.getContext('2d');
  lineEl = mk('div', 'line', paper);
  sayEl = mk('div', 'say', paper);
  tilesEl = mk('div', 'tiles', paper);
  mBtn = document.createElement('button'); mBtn.className = 'mng'; mBtn.textContent = '🤫 השובבות הסתיימה';
  mBtn.addEventListener('click', (e) => { e.stopPropagation(); manage(); });
  cv.addEventListener('pointerup', (e) => { try { canvasTap(e); } catch { /* never break */ } });
  addEventListener('resize', () => { if (S.open) fit(); });
}

// ---------------- opening / phases ----------------
// opts: { mode 'free'|'quest', phase 'oath'|'map'|'manage', level, speak(text), say(text), onOath(), onPassage(), onManaged(), onWrong(), onClose() }
export function openParchment(opts = {}) {
  build();
  S.opts = opts; S.mode = opts.mode || 'free'; S.lv = opts.level || 1; S.open = true; S.opens++; S.fade = 0; S.passTap = 0;
  ov.classList.toggle('q', S.mode === 'quest'); ov.classList.add('on'); document.body.classList.add('mmOn');
  closeX.style.display = S.mode === 'free' ? '' : 'none';
  setPhase(opts.phase || 'oath');
  sfx('flip');
  if (!S.raf) { S.last = performance.now(); S.raf = requestAnimationFrame(tick); }
  return true;
}
export function setPhase(ph) {
  if (!S.built) return;
  S.phase = ph; tilesEl.innerHTML = ''; sayEl.textContent = '';
  if (ph === 'oath') {
    S.ink = 0; S.typed = 0;
    if (S.mode === 'free') { S.words = [OATH]; lineEl.textContent = 'מה אומרים כדי שהמפה תתגלה?'; const b = tile('אני נשבע בחגיגיות... ✨', 0); b.classList.add('big', 'next'); }
    else {
      S.words = S.lv === 1 ? ['אני', 'נשבע'] : ['אני', 'נשבע', 'בחגיגיות'];
      const order = S.words.map((w, i) => i); if (S.lv > 1) { for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } if (order[0] === 0) order.push(order.shift()); }
      for (const i of order) tile(S.words[i], i);
      lineEl.textContent = '...'; markNext();
    }
  } else if (ph === 'map') {
    S.ink = Math.max(S.ink, 0.001); lineEl.textContent = S.mode === 'quest' ? 'גע במעבר הסודי המהבהב ✨' : '👣 מי איפה בטירה?';
    if (S.mode === 'free') tilesEl.appendChild(mBtn);
  } else if (ph === 'manage') {
    S.ink = 1; lineEl.textContent = 'סוגרים את המפה בסוד 🤫'; tilesEl.appendChild(mBtn);
  }
  fit();
}
function tile(text, i) {
  const b = document.createElement('button'); b.className = 'tile'; b.textContent = text; b.dataset.i = i;
  b.addEventListener('click', (e) => { e.stopPropagation(); pickTile(b, i); });
  tilesEl.appendChild(b); S.tiles = [...tilesEl.querySelectorAll('.tile')]; return b;
}
function markNext() { for (const b of S.tiles) b.classList.toggle('next', (S.lv === 1 || S.glow) && +b.dataset.i === S.typed && !b.classList.contains('used')); }
function pickTile(b, i) {
  if (S.phase !== 'oath' || S.ink > 0) return;
  if (S.mode === 'free') { S.typed = 1; b.classList.add('used'); oathDone(); return; }
  if (i !== S.typed) {
    S.wrong++; b.classList.remove('wob'); void b.offsetWidth; b.classList.add('wob'); sfx('soft');
    const t = 'כמעט! מתחילים ב"' + S.words[S.typed] + '" 😊'; sayEl.textContent = t; try { if (S.opts.onWrong) S.opts.onWrong(t); } catch { /* ok */ }
    return;
  }
  b.classList.add('used'); S.typed++; sfx('tink', S.typed); lineEl.textContent = S.words.slice(0, S.typed).join(' ') + '...'; markNext();
  if (S.typed >= S.words.length) oathDone();
}
function oathDone() {
  S.oaths++; lineEl.textContent = OATH; speak(OATH); sfx('sparkle');
  S.ink = 0.001; tilesEl.innerHTML = '';
  setTimeout(() => { if (!S.open || S.phase !== 'oath') return; try { if (S.opts.onOath) S.opts.onOath(); } catch (e) { console.warn('[b3-map] oath -', e && e.message || e); } if (S.mode === 'free' && S.phase === 'oath') setPhase('map'); }, 2600);
}
function manage() {
  if (S.fade > 0) return;
  S.fade = 0.001; S.managed++; speak('השובבות הסתיימה!'); sfx('soft'); mBtn.remove(); lineEl.textContent = 'השובבות הסתיימה 🤫';
}
export function close() {
  if (!S.open) return;
  S.open = false; S.closes++; ov.classList.remove('on'); document.body.classList.remove('mmOn'); cancelAnimationFrame(S.raf); S.raf = 0;
  const f = S.opts.onClose; S.opts = {}; if (f) { try { f(); } catch { /* ok */ } }
}
export function setOpts(o) { Object.assign(S.opts, o || {}); }
export function glowHint(on) { S.glow = !!on; if (S.built && S.phase === 'oath') markNext(); }
export function sayLine(t) { if (S.built) sayEl.textContent = t || ''; }

// ---------------- size ----------------
function fit() {
  if (!S.built) return;
  const r = ov.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const used = head.offsetHeight + lineEl.offsetHeight + sayEl.offsetHeight + tilesEl.offsetHeight + 52;
  const pad = innerWidth <= 700 ? 14 : 28, sc = Math.max(0.2, Math.min((Math.min(innerWidth * (innerWidth <= 700 ? 0.98 : 0.94), 760) - pad) / LW, (r.height - used - 16) / LH));
  S.scale = sc; cv.style.width = Math.round(LW * sc) + 'px'; cv.style.height = Math.round(LH * sc) + 'px';
  cv.width = Math.round(LW * sc * dpr); cv.height = Math.round(LH * sc * dpr); S.dpr = dpr;
}

// ---------------- people on the plan ----------------
function placeOf(id) {
  const G = window.__game;
  if (id === 'harry') {
    const a = G && G.interiors && G.interiors.active;
    if (a) { const p = G.player.pos; return { place: a, x: p.x, z: p.z, local: true }; }
    const p = G && G.player ? G.player.pos : { x: 0, z: 30 };
    const near = (q, d) => Math.hypot(p.x - q[0], p.z - q[1]) < d;
    return { place: near([86, 38], 18) ? 'hut' : near([74, 48], 16) ? 'paddock' : 'courtyard', x: p.x, z: p.z, world: true };
  }
  if (id === 'ron') return { place: 'courtyard', x: -4, z: 32, world: true };
  if (id === 'hermione') return { place: 'courtyard', x: 0, z: 30, world: true };
  if (id === 'hagrid') return { place: 'hut', fx: 0.35, fz: 0.5 };
  if (id === 'buckbeak') return { place: 'paddock', fx: 0.6, fz: 0.45 };
  return null;
}
function readFeet() {
  const out = [];
  for (const id of ['harry', 'ron', 'hermione', 'hagrid', 'buckbeak']) { const p = placeOf(id); if (p) out.push({ id, ...p }); }
  let rs = null; try { const r = window.__game && window.__game.roam; rs = r && r.state ? r.state() : null; } catch { rs = null; }
  if (rs && rs.on !== false) for (const id of Object.keys(rs)) { const q = rs[id]; if (!q || !q.place) continue; out.push({ id, place: q.place, x: q.x, z: q.z, local: true, teacher: true }); }
  return out;
}
function roomFor(place) { if (place === 'greathall_w') return 'greathall'; return ROOMS[place] ? place : null; }
function spotOf(f, i) {
  const room = roomFor(f.place); if (!room) return null;
  const R = ROOMS[room], [rx, ry, rw, rh] = R.r;
  let u = 0.5, v = 0.55;
  if (f.fx != null) { u = f.fx; v = f.fz; }
  else if (f.world && R.world && Number.isFinite(f.x)) { const [cx0, cz0, hx, hz] = R.world; u = 0.5 + (f.x - cx0) / (2 * hx); v = 0.5 + (f.z - cz0) / (2 * hz); }
  else if (f.local && R.half && Number.isFinite(f.x) && Number.isFinite(f.z)) { u = 0.5 + f.x / (2 * R.half[0]); v = 0.5 + f.z / (2 * R.half[1]); }
  else { u = 0.3 + ((i * 37) % 40) / 100; v = 0.45 + ((i * 53) % 30) / 100; }
  u = Math.max(0.16, Math.min(0.84, u)); v = Math.max(0.36, Math.min(0.8, v));
  return [rx + rw * u, ry + rh * v];
}

// ---------------- drawing ----------------
function tick(now) {
  if (!S.open) { S.raf = 0; return; }
  const dt = Math.min(0.1, Math.max(0, (now - S.last) / 1000)); S.last = now; S.t += dt;
  try {
    if (S.ink > 0 && S.ink < 1) S.ink = Math.min(1, S.ink + dt / 2.2);
    if (S.fade > 0) { S.fade += dt / 1.6; if (S.fade >= 1) { S.fade = 1; const f = S.opts.onManaged; S.opts.onManaged = null; if (f) { try { f(); } catch (e) { console.warn('[b3-map] managed -', e && e.message || e); } } if (S.mode === 'free') close(); } }
    if (S.ink >= 1 || S.phase !== 'oath') S.feet = readFeet();
    draw();
  } catch (e) { if (!S.err++) console.warn('[b3-map] draw failed -', e && e.message || e); }
  if (S.open) S.raf = requestAnimationFrame(tick);
}
// on a small screen (a 390 px phone) the plan is drawn small: the words grow so they stay readable (and shrink to fit a room)
const FB = () => Math.min(1.6, Math.max(1, 0.8 / (S.scale || 1)));
function txt(s, x, y, size, col, maxW = 0) {
  cx.save(); cx.direction = 'rtl'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = `bold ${Math.round(size * FB())}px ${FONT}`; cx.fillStyle = col;
  if (maxW) { const m = cx.measureText(s).width; if (m > maxW) { cx.translate(x, y); cx.scale(maxW / m, 1); cx.translate(-x, -y); } }
  cx.fillText(s, x, y); cx.restore();
}
function draw() {
  const k = S.scale * (S.dpr || 1), x = cx;
  x.setTransform(k, 0, 0, k, 0, 0);
  // the paper
  const g = x.createRadialGradient(LW / 2, LH * 0.45, 40, LW / 2, LH / 2, LH * 0.7); g.addColorStop(0, '#f8ecce'); g.addColorStop(1, '#e2c690');
  x.fillStyle = g; x.fillRect(0, 0, LW, LH);
  x.strokeStyle = 'rgba(120,70,20,.35)'; x.lineWidth = 3; x.strokeRect(6, 6, LW - 12, LH - 12);
  const ink = S.ink, a = Math.max(0, 1 - S.fade);
  if (ink <= 0) {   // before the oath: only a faint swirl and "סוד"
    x.globalAlpha = 0.18 + 0.06 * Math.sin(S.t * 2); txt('🤫', LW / 2, LH * 0.42, 90, '#000'); txt('נשבעים... והמפה מתגלה', LW / 2, LH * 0.56, 30, '#6a3a10'); x.globalAlpha = 1; return;
  }
  x.globalAlpha = a;
  const INK = '#5a2a0a';
  // rooms draw themselves: each wall line grows with the ink, in order
  const ids = Object.keys(ROOMS); let i = 0;
  for (const id of ids) {
    const R = ROOMS[id], [rx, ry, rw, rh] = R.r, kk = Math.max(0, Math.min(1, (ink - (i / ids.length) * 0.7) / 0.3)); i++;
    if (kk <= 0) continue;
    x.strokeStyle = R.shop ? '#8a2a5a' : INK; x.lineWidth = 4; x.lineJoin = 'round';
    const per = 2 * (rw + rh), L = per * kk; x.beginPath(); x.moveTo(rx, ry);
    const seg = [[rx + rw, ry, rw], [rx + rw, ry + rh, rh], [rx, ry + rh, rw], [rx, ry, rh]]; let left = L, px = rx, py = ry;
    for (const [tx, ty, len] of seg) { if (left <= 0) break; const f = Math.min(1, left / len); x.lineTo(px + (tx - px) * f, py + (ty - py) * f); left -= len; px = tx; py = ty; }
    x.stroke();
    if (R.shop && kk > 0.95) { x.fillStyle = 'rgba(232,140,180,.18)'; x.fillRect(rx, ry, rw, rh); txt('🍬', rx + rw / 2, ry + rh * 0.62, 44, '#000'); }
    if (kk > 0.9) txt(R.t, rx + rw / 2, ry + 16 + 8 * FB(), R.t.length > 12 ? 19 : 22, R.shop ? '#7a1a4a' : INK, rw - 10);
  }
  // corridors between rooms (little doorways)
  if (ink > 0.7) { x.strokeStyle = INK; x.lineWidth = 3; x.setLineDash([2, 6]); x.beginPath();
    for (const [x1, y1, x2, y2] of [[320, 192, 320, 222], [198, 300, 214, 300], [426, 300, 442, 300], [320, 382, 320, 410], [214, 480, 228, 480], [412, 480, 426, 480], [320, 550, 320, 578], [108, 550, 108, 578], [320, 688, 320, 714]]) { x.moveTo(x1, y1); x.lineTo(x2, y2); }
    x.stroke(); x.setLineDash([]); }
  // the secret passage: a pulsing dotted line from the statue to Honeydukes
  if (ink >= 1) {
    const pu = 0.55 + 0.45 * Math.sin(S.t * 4);
    x.save(); x.strokeStyle = `rgba(200,40,110,${0.55 + 0.45 * pu})`; x.lineWidth = 5 + 2 * pu; x.setLineDash([10, 9]); x.lineDashOffset = -S.t * 30;
    x.beginPath(); PASSAGE.forEach(([px, py], j) => (j ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); x.restore();
    if (S.mode === 'quest' && S.phase === 'map') { x.fillStyle = `rgba(255,210,80,${0.25 * pu})`; x.beginPath(); x.arc(PASSAGE[3][0] - 30, PASSAGE[3][1] - 10, 46 + 10 * pu, 0, 7); x.fill(); }
    x.fillStyle = '#7a7470'; x.beginPath(); x.arc(STATUE[0], STATUE[1], 9, 0, 7); x.fill();   // the statue's dot
    txt('פסל המכשפה', STATUE[0] - 52, STATUE[1] - 14, 15, '#5a5050');
    txt('מעבר סודי 🍬', 530, 590, 17, '#9a1a5a');
  }
  // footprints with little name labels (they step in place)
  if (ink >= 1) {
    let j = 0; const placed = [];
    for (const f of S.feet) {
      const p = spotOf(f, j++); f.at = p; if (!p) continue;
      // friends in the same spot stand side by side (labels never pile up)
      const R = ROOMS[roomFor(f.place)].r;
      for (let t = 0; t < 8 && placed.some(q => Math.abs(q[0] - p[0]) < 56 * FB() && Math.abs(q[1] - p[1]) < 30 + 8 * FB()); t++) { p[0] += 58 * FB(); if (p[0] > R[0] + R[2] - 26) { p[0] = R[0] + 30; p[1] += 30 + 8 * FB(); } if (p[1] > R[1] + R[3] - 18) p[1] = R[1] + 44; }
      placed.push(p);
      const step = Math.floor(S.t * 2 + j) % 2, col = f.id === 'harry' ? '#a0201a' : f.teacher ? '#3a2a6a' : INK;
      x.fillStyle = col;
      for (const sd of [-1, 1]) { const up = (sd > 0) === !!step ? -5 : 3; x.beginPath(); x.ellipse(p[0] + sd * 6, p[1] + up, 4.2, 7, sd * 0.15, 0, 7); x.fill(); x.beginPath(); x.arc(p[0] + sd * 6, p[1] + up - 9, 2.4, 0, 7); x.fill(); }
      txt(NAMES[f.id] || f.id, p[0], p[1] + 12 + 8 * FB(), 17, col, 64);
    }
  }
  x.globalAlpha = 1;
}

// ---------------- taps on the plan ----------------
function toLogical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LW, (e.clientY - r.top) / r.height * LH]; }
function nearPassage(lx, ly) {
  let best = 1e9;
  for (let j = 1; j < PASSAGE.length; j++) { const [ax, ay] = PASSAGE[j - 1], [bx, by] = PASSAGE[j]; const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((lx - ax) * dx + (ly - ay) * dy) / L)); best = Math.min(best, Math.hypot(lx - ax - dx * u, ly - ay - dy * u)); }
  const [hx, hy, hw, hh] = ROOMS.b3honey.r; if (lx > hx && lx < hx + hw && ly > hy && ly < hy + hh) best = Math.min(best, 10);
  return best;
}
function canvasTap(e) {
  if (!S.open || S.ink < 1 || S.fade > 0) return;
  const [lx, ly] = toLogical(e);
  if (nearPassage(lx, ly) < 44) {
    if (S.mode === 'quest' && S.phase === 'map') { S.passTap++; sfx('sparkle'); const f = S.opts.onPassage; if (f) { try { f(); } catch (er) { console.warn('[b3-map] passage -', er && er.message || er); } } }
    else sayEl.textContent = 'המעבר הסודי מתחיל ליד הפסל במדרגות הנעות! 🍬';
  }
}

// ---------------- the free-play 📜 button ----------------
function freeBusy() {
  const c = document.body.classList;
  return c.contains('inAdv') || c.contains('modalOn') || c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || !!(window.__game && window.__game.takeover);
}
export function openFree() {
  if (S.open || freeBusy()) return false;
  return openParchment({ mode: 'free', phase: 'oath' });
}
export function initMarauder() {
  if (S.inited) return; S.inited = true; build();
  const b = document.createElement('button'); b.id = 'mmBtn'; b.className = 'gamebtn'; b.textContent = '📜'; b.setAttribute('aria-label', 'מפת הטרדנים');
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  b.addEventListener('click', (e) => { e.stopPropagation(); openFree(); });
  document.body.appendChild(b); S.btn = b;
  // the free parchment gives way at once if anything else takes the screen (an adventure, a lesson, a takeover)
  setInterval(() => { try { if (S.open && S.mode === 'free' && freeBusy()) close(); } catch { /* ok */ } }, 500);
}

// ---------------- debug / tests ----------------
const toScreen = (p) => { if (!p || !cv) return null; const r = cv.getBoundingClientRect(); return { x: r.left + p[0] / LW * r.width, y: r.top + p[1] / LH * r.height }; };
export const MM = {
  state: () => ({ open: S.open, mode: S.mode, phase: S.phase, lv: S.lv, typed: S.typed, words: S.words.slice(), ink: +S.ink.toFixed(2), fade: +S.fade.toFixed(2), wrong: S.wrong, opens: S.opens, closes: S.closes, managed: S.managed, oaths: S.oaths, passTap: S.passTap,
    visible: !!(ov && ov.classList.contains('on') && getComputedStyle(ov).display !== 'none'), btn: !!(S.btn && getComputedStyle(S.btn).display !== 'none'), err: S.err }),
  feet: () => S.feet.map(f => ({ id: f.id, place: f.place, room: roomFor(f.place), scr: toScreen(f.at) })),
  passageScreen: () => toScreen([PASSAGE[3][0] - 4, PASSAGE[3][1] - 40]),
  tileScreen: (word) => { const b = S.tiles.find(t => t.textContent === word && !t.classList.contains('used')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  open: openFree, close,
};
try { if (/[?&]debug=1/.test(location.search)) window.__b3mm = MM; } catch { /* ok */ }
