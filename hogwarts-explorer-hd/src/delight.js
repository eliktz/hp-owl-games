// Delight for the HD castle — the little surprises that make a child laugh and come back.
// The same ideas (and the same save file) as v1's delight/*.js, rebuilt for the HD engine:
//   🪄 wand          one button that always does something: a bolt flies to the nearest
//                    enchantable thing (armour jigs, cauldrons burp, the globe whirls, the
//                    Sorting Hat grumbles…); with no target it is a little sparkle show
//   🎩 Sorting Hat   on a stool in the Entrance Hall: pick a crest, drum-roll, it SHOUTS your
//                    house; your scarf wears the colours and the four hourglasses by the stairs
//                    show the house points your lessons earn
//   🦉 Pip           a tiny owlet waiting in the Astronomy tower; walk up and he follows you
//   🫘 beans         a bowl in the common room: a random flavour + a silly spell (giant, tiny,
//                    rainbow, zoom) that wears off by itself
//   🐸 Trevor        the runaway toad hides somewhere new each time; follow the ribbits
//   🤡 Peeves        a cackling poltergeist pops up indoors now and then, pulls faces and
//                    dares you to catch him (run into him or zap him) for a shower of stars
//   🎁 owl post      once a day a ribboned parcel drops into the Great Hall
// Rooms stream in one at a time here, so each room's props are (re)built in roomEntered().
import {
  Group, Mesh, SphereGeometry, CylinderGeometry, BoxGeometry, ConeGeometry, TorusGeometry, PlaneGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, Color, Vector3, DoubleSide, SRGBColorSpace,
  Matrix4, Quaternion, Euler, BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FLOOR_Y } from './rooms.js';
import * as fun from './fun.js';

const M = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.7, ...o });
const mk = (par, geo, mat, x = 0, y = 0, z = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
const HOUSES = [
  { key: 'gryf', crest: '🦁', name: 'גְּרִיפִינְדּוֹר', field: 0x7a1420, gem: 0xff3b4e },
  { key: 'slyt', crest: '🐍', name: 'סְלִיתֶ׳רִין', field: 0x1a5236, gem: 0x2fe08a },
  { key: 'rave', crest: '🦅', name: 'רֵייבֶנְקְלוֹ', field: 0x1b3a6b, gem: 0x4d8dff },
  { key: 'huff', crest: '🦡', name: 'הַפְלְפַּאף', field: 0xb8902a, gem: 0xffd23f },
];
const HAT = { room: 'entrancehall', x: 5.2, z: 6.2 };
const PERCH = { room: 'tower', x: -5, z: 2.4 };
const BOWL = { room: 'commonroom', x: 0, z: 1.2 };
const TREVOR = [['entrancehall', 5.6, 8.6], ['greathall', -8, 13], ['greathall', 8, -12], ['library', 8.6, 8.8], ['commonroom', -6.5, -6.5], ['staircase', 7.5, 7.5],
  ['dungeon', 6.5, -7.5], ['classrooms', -12, 5.5], ['tower', 5.5, 5], [null, 8, 44], [null, -16, 52], [null, 22, 60]];

export function createDelight({ scene, camera, player, interiors, heightAt, setModal, isModal }) {
  const st = fun.store; st.magic = st.magic || []; st.beans = st.beans || 0; st.trevor = st.trevor || 0;
  const pos = player.pos, tmp = new Vector3(), tmp2 = new Vector3();
  let T = 0;
  const roomLive = { enchant: [], hat: null, perch: null, bowl: null };

  // ================= wand =================
  const css = document.createElement('style');
  css.textContent = `
  #wandBtn{right:calc(114px + env(safe-area-inset-right));bottom:calc(32px + env(safe-area-inset-bottom));background:radial-gradient(circle at 50% 35%,rgba(255,190,90,.95),rgba(150,70,20,.85))}
  #wandBtn.cool{filter:saturate(.4) brightness(.8)}
  #wandBtn.try{animation:wandTry 1.1s ease-in-out infinite}
  @keyframes wandTry{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.4)}50%{box-shadow:0 0 0 8px rgba(255,215,106,.55),0 0 28px rgba(255,215,106,.9)}}
  #sortOv{position:fixed;inset:0;z-index:47;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;
    background:radial-gradient(ellipse at center,rgba(40,24,90,.75),rgba(5,3,25,.94));font-family:'Rubik',sans-serif;direction:rtl;text-align:center}
  #sortOv.on{display:flex}
  #sortOv .hat{font-size:150px;line-height:1;transform-origin:50% 90%} #sortOv .hat.think{animation:sortThink .5s ease-in-out infinite}
  @keyframes sortThink{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg) scale(1.06)}}
  #sortOv .q{color:#ffe9a8;font-size:34px;font-weight:bold;text-shadow:0 3px 0 #000;min-height:44px;padding:0 16px}
  #sortOv .row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;width:min(92vw,640px)}
  @media (max-aspect-ratio:1/1){#sortOv .row{grid-template-columns:repeat(2,1fr);width:min(86vw,420px)}}
  #sortOv .crest{aspect-ratio:1;border-radius:26px;border:5px solid #ffd76a;font-size:74px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;touch-action:manipulation}
  #sortOv .big{font-size:min(15vw,96px);font-weight:bold;color:#fff;text-shadow:0 5px 0 #000,0 0 40px #ffd76a}
  #sortOv .x{position:absolute;top:calc(18px + env(safe-area-inset-top));right:18px;width:60px;height:60px;border-radius:50%;border:4px solid #ffd76a;background:#3a2060;color:#fff;font-size:28px}`;
  document.head.appendChild(css);
  const wandBtn = document.createElement('button'); wandBtn.id = 'wandBtn'; wandBtn.className = 'gamebtn'; wandBtn.textContent = '🪄'; wandBtn.setAttribute('aria-label', 'שרביט');
  document.body.appendChild(wandBtn);
  if (!st.wandUsed) wandBtn.classList.add('try');   // a gentle glow until the child has tried the wand once
  const bolt = mk(scene, new SphereGeometry(0.22, 10, 8), new MeshBasicMaterial({ color: 0xfff0a0 })); bolt.visible = false; bolt.raycast = () => {};
  let cool = 0, fly = null, duds = 0;
  const SILLY = [['🦆', ['🦆', '💦', '✨']], ['🦋', ['🦋', '🌸', '✨']], ['🫧', ['🫧', '🧼', '✨']], ['🍭', ['🍭', '🍬', '✨']]];
  const from = new Vector3(), to = new Vector3();
  const lastCast = { target: null };
  // out on the grounds the lake splashes, Hagrid's chimney puffs a rainbow, the hoops ring and
  // the greenhouse blooms — all emoji rain + sound, so they cost the scene nothing
  const OUT = [
    { id: 'lake', x: -52, z: -10, cast() { fun.confetti(['💦', '💧', '✨', '🐟'], 22); fun.sfx.noise(1.2, 0.2, 0, 1800, 0.6); return '⛲'; } },
    { id: 'hut', x: 86, z: 42, cast() { fun.confetti(['🌈', '☁️', '✨', '💜'], 20); fun.sfx.poof(); return '🌈'; } },
    { id: 'hoops', x: 0, z: 112, cast() { fun.sfx.tune([784, 988, 1175, 1568, 1175, 1568], 0.13, 'sine'); fun.confetti(['🔔', '✨', '⭐'], 14); return '🔔'; } },
    { id: 'greenhouse', x: -58, z: 63, cast() { fun.confetti(['🌸', '🌼', '🌿', '🦋'], 20); fun.sfx.giggle(true); return '🌸'; } },
  ];
  function targets() {
    const list = [];
    if (!interiors.active) for (const o of OUT) if (Math.hypot(o.x - pos.x, o.z - pos.z) < 16) list.push({ id: o.id, x: pos.x + (o.x - pos.x) * 0.5, y: pos.y + 2, z: pos.z + (o.z - pos.z) * 0.5, cast: o.cast });
    for (const e of roomLive.enchant) { e.obj.getWorldPosition(tmp2); list.push({ id: e.id, x: tmp2.x, y: tmp2.y, z: tmp2.z, cast: e.cast }); }
    if (roomLive.hat) list.push({ id: 'hat', x: HAT.x, y: FLOOR_Y + 1.5, z: HAT.z, cast: () => { roomLive.hat.talk = 2; fun.say(tmp.set(HAT.x, FLOOR_Y + 3.4, HAT.z), 'הֵי! זֶה מְדַגְדֵּג! 🎩', 2, 'hat'); return '🎩'; } });
    if (st.pet) list.push({ id: 'pip', x: owlPos.x, y: owlPos.y - 0.6, z: owlPos.z, cast: () => { pipLoop = 1.2; fun.sfx.heart(); fun.sfx.tweet(); return '💛'; } });
    if (pv.state === 'taunt') list.push({ id: 'peeves', x: pv.G.position.x, y: pv.G.position.y, z: pv.G.position.z, cast: () => { catchPeeves(); return '🤡'; } });
    if (trevor.here()) list.push({ id: 'toad', x: trevor.G.position.x, y: trevor.G.position.y, z: trevor.G.position.z, cast: () => { trevor.hop = 0.8; fun.sfx.ribbit(1.4); return '🐸'; } });
    return list;
  }
  function cast() {
    if (isModal() || cool > 0 || window.__game.takeover) return false;
    cool = 0.55; wandBtn.classList.add('cool'); fun.sfx.zap();
    if (!st.wandUsed) { st.wandUsed = true; fun.save(); } wandBtn.classList.remove('try');
    const f = player.yaw;
    from.set(pos.x + Math.sin(f) * 0.5, pos.y + 1.5, pos.z + Math.cos(f) * 0.5);
    let best = null, bs = 1e9;
    for (const tg of targets()) {
      const d = Math.hypot(tg.x - pos.x, tg.z - pos.z); if (d > 11) continue;
      const dot = d < 0.01 ? 1 : ((tg.x - pos.x) * Math.sin(f) + (tg.z - pos.z) * Math.cos(f)) / d;
      if (d - dot * 4 < bs) { bs = d - dot * 4; best = tg; }
    }
    if (best) to.set(best.x, best.y + 0.6, best.z); else to.set(pos.x + Math.sin(f) * 6, pos.y + 3.6, pos.z + Math.cos(f) * 6);
    fly = { t: 0, dur: Math.min(0.55, 0.18 + from.distanceTo(to) * 0.03), target: best };
    lastCast.target = best ? best.id : null;
    return true;
  }
  wandBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); cast(); });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'f' && !window.__game.takeover) cast(); });
  function land() {
    const tg = fly.target;
    if (tg) {
      const emoji = tg.cast() || '✨'; fun.sfx.giggle(true); fun.sfx.sparkle();
      if (!st.magic.includes(tg.id)) { st.magic.push(tg.id); fun.save(); fun.toast(emoji, 'קֶסֶם חָדָשׁ! ' + st.magic.length); }
    } else if (++duds % 6 === 0) {
      // oops! every sixth cast with nothing to enchant goes hilariously wrong
      const [e, set] = SILLY[(duds / 6) % SILLY.length | 0];
      fun.toast(e, 'אוּפְּס!', 1500); fun.confetti(set, 22); fun.sfx.squeak(); setTimeout(() => fun.sfx.giggle(true), 300);
    } else { fun.sfx.boom(); fun.sfx.sparkle(); }
  }

  // ================= Sorting Hat + hourglasses (Entrance Hall) =================
  const points = () => { try { return window.HPLessons.progress.points(); } catch { return 0; } };
  function housePts(key) { const mine = points(), i = HOUSES.findIndex(h => h.key === key); return st.house === key ? mine : Math.round(mine * [0.82, 0.9, 0.7, 0.76][i] + [25, 15, 35, 20][i]); }
  function numTex(n, crest) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '54px serif'; g.fillText(crest, 64, 34);
    g.font = 'bold 44px Rubik,sans-serif'; g.lineWidth = 8; g.strokeStyle = '#1a0f33'; g.strokeText(n, 64, 92); g.fillStyle = '#ffe9a8'; g.fillText(n, 64, 92);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }
  function buildHat(g) {
    const grp = new Group(); grp.position.set(HAT.x, 0, HAT.z);
    const wood = M(0x5a3a1e), felt = M(0x6b4a2a, { roughness: 1 });
    mk(grp, new CylinderGeometry(0.55, 0.55, 0.12, 14), wood, 0, 0.85, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; mk(grp, new CylinderGeometry(0.05, 0.07, 0.85, 6), wood, Math.cos(a) * 0.36, 0.42, Math.sin(a) * 0.36); }
    const hat = new Group(); hat.position.y = 0.92; grp.add(hat);
    mk(hat, new CylinderGeometry(0.75, 0.8, 0.09, 18), felt, 0, 0.05, 0);
    mk(hat, new CylinderGeometry(0.38, 0.54, 0.6, 14), felt, 0, 0.38, 0);
    const tipG = new Group(); tipG.position.y = 0.68; hat.add(tipG);
    mk(tipG, new CylinderGeometry(0.2, 0.38, 0.52, 12), felt, 0, 0.22, 0);
    const tip2 = new Group(); tip2.position.y = 0.46; tip2.rotation.z = 0.7; tipG.add(tip2); mk(tip2, new ConeGeometry(0.2, 0.6, 10), felt, 0, 0.27, 0);
    const dark = new MeshBasicMaterial({ color: 0x1c1108 });
    for (const s of [-1, 1]) { const e = mk(hat, new BoxGeometry(0.2, 0.07, 0.05), dark, s * 0.18, 0.54, 0.42); e.rotation.z = s * -0.35; }
    const mouth = mk(hat, new BoxGeometry(0.38, 0.08, 0.05), dark, 0, 0.28, 0.51);
    grp.userData.light = { k: 'glow', c: 0xffd98a, r: 2.6, a: 0.3 };
    grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(grp);
    // the four hourglasses by the stairs: gem piles = house points (yours is fed by your lessons)
    [-6.6, -4.6, 4.6, 6.6].forEach((x, i) => {
      const h = HOUSES[i], G = new Group(); G.position.set(x, 0, -10.6);
      const brass = M(0xb8902a, { metalness: 0.6, roughness: 0.4 });
      for (const y of [0.1, 3.7]) mk(G, new CylinderGeometry(0.62, 0.62, 0.2, 14), brass, 0, y, 0);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; mk(G, new CylinderGeometry(0.045, 0.045, 3.6, 6), brass, Math.cos(a) * 0.54, 1.9, Math.sin(a) * 0.54); }
      const gemM = M(h.gem, { emissive: new Color(h.gem), emissiveIntensity: 0.9, roughness: 0.3 });
      const k = Math.min(1, housePts(h.key) / 400), ph = 0.15 + k * 1.4;
      mk(G, new CylinderGeometry(0.22, 0.44, ph, 12), gemM, 0, 0.2 + ph / 2, 0);
      mk(G, new CylinderGeometry(0.44, 0.15, 0.7, 12), gemM, 0, 3.2, 0);
      const label = mk(G, new PlaneGeometry(1.3, 1.3), new MeshBasicMaterial({ map: numTex(housePts(h.key), h.crest), transparent: true, side: DoubleSide }), 0, 4.7, 0);
      G.userData.light = { k: 'glow', c: h.gem, r: 2, a: 0.25 }; G.userData.house = h.key; G.userData.label = label;
      g.add(G);
    });
    return { grp, hat, tipG, mouth, talk: 0, quip: 3 };
  }
  function dress() {
    const h = HOUSES.find(x => x.key === st.house); if (!h) return;
    const c = new Color(h.field).multiplyScalar(1.35);
    player.model.traverse(o => { if (o.isMesh && o.material && o.material.emissive && (o.userData.scarf || Math.abs(o.material.color.getHex() - 0x7a1020) < 2)) { o.userData.scarf = true; o.material.color.copy(c); o.material.emissive.copy(c).multiplyScalar(0.18); } });
  }
  if (st.house) dress();
  const sortOv = document.createElement('div'); sortOv.id = 'sortOv'; document.body.appendChild(sortOv);
  let busy = false;
  const hex = (n) => '#' + ('000000' + n.toString(16)).slice(-6);
  function openSort() {
    if (isModal()) return;
    setModal(true); busy = false; sortOv.innerHTML = '';
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.addEventListener('click', closeSort); sortOv.appendChild(x);
    const hatE = document.createElement('div'); hatE.className = 'hat'; hatE.textContent = '🎩'; sortOv.appendChild(hatE);
    const q = document.createElement('div'); q.className = 'q'; q.textContent = 'לְאָן הַלֵּב שֶׁלְּךָ הוֹלֵךְ?'; sortOv.appendChild(q);
    const row = document.createElement('div'); row.className = 'row'; sortOv.appendChild(row);
    HOUSES.forEach(h => {
      const b = document.createElement('button'); b.className = 'crest'; b.dataset.k = h.key; b.textContent = h.crest; b.style.background = 'radial-gradient(circle at 40% 30%,' + hex(h.field) + ',#150b30)';
      b.addEventListener('click', () => choose(h, hatE, q, row)); row.appendChild(b);
    });
    sortOv.classList.add('on'); fun.sfx.flip();
  }
  function choose(h, hatE, q, row) {
    if (busy) return; busy = true;
    row.style.visibility = 'hidden'; hatE.classList.add('think'); q.textContent = ['הממ... מעניין!', 'אני רואה אומץ...', 'ראש מלא רעיונות!'][(Math.random() * 3) | 0]; fun.sfx.drum();
    setTimeout(() => {
      hatE.classList.remove('think'); hatE.textContent = h.crest; q.className = 'big'; q.textContent = h.name + '!';
      st.house = h.key; fun.save(); dress(); fun.sfx.tada(); fun.confetti([h.crest, '✨', '🎉', '⭐'], 26);
      setTimeout(closeSort, 1900);
    }, 1400);
  }
  function closeSort() { sortOv.classList.remove('on'); setModal(false); }

  // ================= Pip the owlet =================
  const owl = new Group(); owl.name = 'pip';
  // Pip follows you everywhere, so he must be cheap: body, belly, eyes and beak are ONE merged,
  // vertex-coloured mesh (plus two wings that flap) — 3 draw calls instead of 7.
  {
    const parts = [], m4 = new Matrix4(), q = new Quaternion(), c = new Color();
    const part = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => {
      geo.applyMatrix4(m4.compose(new Vector3(x, y, z), q.setFromEuler(new Euler(rx, 0, 0)), new Vector3(sx, sy, sz)));
      c.setHex(color); const n = geo.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new BufferAttribute(col, 3)); parts.push(geo);
    };
    part(new SphereGeometry(0.2, 12, 10), 0x7a706c, 0, 0, 0, 1, 1.15, 0.95);
    part(new SphereGeometry(0.15, 10, 8), 0xbdb2a6, 0, -0.03, 0.08);
    for (const sgn of [-1, 1]) part(new SphereGeometry(0.06, 8, 8), 0xffb020, sgn * 0.08, 0.07, 0.16);
    part(new ConeGeometry(0.035, 0.08, 5), 0xff8a10, 0, 0.01, 0.21, 1, 1, 1, Math.PI / 2);
    owl.add(new Mesh(mergeGeometries(parts), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })));
  }
  const owlWings = [-1, 1].map(s => { const w = mk(owl, new BoxGeometry(0.26, 0.05, 0.16), M(0x6a605c), s * 0.26, 0.02, 0); w.userData.s = s; return w; });
  owl.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.raycast = () => {}; } });
  owl.visible = !!st.pet; scene.add(owl);
  const owlPos = new Vector3(pos.x, pos.y + 2.5, pos.z);
  let pipLoop = 0;                       // >0 → Pip is doing a happy loop-the-loop (wand cast at him)
  function buildPerch(g) {
    const s = new Group(); s.position.set(PERCH.x, 0, PERCH.z); const wood = M(0x5a3a1e);
    mk(s, new CylinderGeometry(0.06, 0.09, 1.6, 8), wood, 0, 0.8, 0); const bar = mk(s, new CylinderGeometry(0.05, 0.05, 0.9, 8), wood, 0, 1.6, 0); bar.rotation.z = Math.PI / 2;
    mk(s, new CylinderGeometry(0.38, 0.46, 0.12, 12), wood, 0, 0.06, 0); g.add(s);
    return { call: 0 };
  }
  function adopt() { st.pet = true; fun.save(); fun.sfx.heart(); fun.sfx.tweet(); fun.toast('🦉💛', 'פִּיפּ בָּא אִתְּךָ!'); fun.confetti(['💛', '🦉', '✨', '🪶'], 16); }

  // ================= beans =================
  const FLAV = [['🍓', 'תּוּת!', 1], ['🍫', 'שׁוֹקוֹלָד!', 1], ['🍋', 'חָמוּץ!!', 0], ['🧦', 'גַּרְבַּיִם?! אִיכְס', 0], ['🌶️', 'חָרִיף!!!', 0], ['🍉', 'אֲבַטִּיחַ!', 1], ['🥦', 'בְּרוֹקוֹלִי...', 0], ['👃', 'אוֹי לֹא... נַזֶּלֶת', 0]];
  const EFFECTS = ['giant', 'tiny', 'rainbow', 'zoom'], ICON = { giant: '🦒', tiny: '🐭', rainbow: '🌈', zoom: '⚡' };
  let fx = null, fxLeft = 0, lastFx = null;
  const robeMats = []; player.model.traverse(o => { if (o.isMesh && o.material && o.material.color.getHex() === 0x3a2d55 && !robeMats.includes(o.material)) robeMats.push(o.material); });
  function endBean() { if (!fx) return; fx = null; player.speedMul = 1; robeMats.forEach(m => m.color.setHex(0x3a2d55)); fun.sfx.poof(); }
  function eat(kind) {
    if (fx) endBean();
    const fl = FLAV[(Math.random() * FLAV.length) | 0], pool = EFFECTS.filter(e => e !== lastFx);
    fx = kind || pool[(Math.random() * pool.length) | 0]; lastFx = fx; fxLeft = 9;
    fun.sfx.munch(); setTimeout(() => (fl[2] ? fun.sfx.giggle(true) : fun.sfx.burp()), 380);
    fun.toast(fl[0] + ICON[fx], fl[1], 1900);
    player.speedMul = fx === 'zoom' ? 1.7 : fx === 'tiny' ? 1.25 : fx === 'giant' ? 0.9 : 1;
    st.beans++; fun.save();
  }
  function buildBowl(g) {
    const B = new Group(); B.position.set(BOWL.x, 0, BOWL.z);
    mk(B, new CylinderGeometry(0.5, 0.5, 0.1, 14), M(0x4a3016), 0, 0.62, 0); mk(B, new CylinderGeometry(0.09, 0.14, 0.6, 8), M(0x4a3016), 0, 0.3, 0);
    mk(B, new SphereGeometry(0.42, 16, 10, 0, 6.3, Math.PI / 2, Math.PI / 2), M(0xbfe8ff, { roughness: 0.15, transparent: true, opacity: 0.6, side: DoubleSide }), 0, 1.1, 0);
    const cols = [0xff5a6a, 0xffd23f, 0x4dd0ff, 0x7cf07c, 0xc58bff, 0xff9a3c];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.08 + (i % 3) * 0.09; mk(B, new SphereGeometry(0.09, 8, 6), M(cols[i % 6], { roughness: 0.35 }), Math.cos(a) * r, 0.84 + (i % 2) * 0.1, Math.sin(a) * r).scale.set(1, 0.75, 1.3); }
    B.userData.light = { k: 'glow', c: 0xff9ad5, r: 2, a: 0.3 }; g.add(B);
    return { armed: true };
  }

  // ================= Trevor =================
  const trevor = { G: new Group(), idx: -1, room: null, base: 0, found: 0, hop: 0, hopT: 3, rib: 2, here() { return this.room === (interiors.active || null) && this.G.visible; } };
  (function buildToad() {
    const gr = M(0x58b84a, { roughness: 0.55, emissive: new Color(0x143a10), emissiveIntensity: 0.6 }), G = trevor.G;
    mk(G, new SphereGeometry(0.3, 14, 12), gr, 0, 0.26, 0).scale.set(1.15, 0.8, 1.2);
    trevor.throat = mk(G, new SphereGeometry(0.14, 10, 8), M(0xd8e8a0), 0, 0.19, 0.26);
    for (const s of [-1, 1]) { mk(G, new SphereGeometry(0.1, 10, 8), M(0xfff6d8), s * 0.14, 0.47, 0.14); mk(G, new SphereGeometry(0.05, 8, 6), M(0x1a1420), s * 0.14, 0.49, 0.22); mk(G, new SphereGeometry(0.13, 8, 6), gr, s * 0.3, 0.1, -0.06).scale.set(0.9, 0.5, 1.35); }
    G.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.raycast = () => {}; } }); G.name = 'trevor'; scene.add(G);
  })();
  function hideTrevor() {
    let n; do { n = (Math.random() * TREVOR.length) | 0; } while (n === trevor.idx || TREVOR[n][0] === (interiors.active || null));
    trevor.idx = n; const [room, x, z] = TREVOR[n]; trevor.room = room;
    trevor.base = room ? FLOOR_Y : heightAt(x, z); trevor.G.position.set(x, trevor.base, z); trevor.G.rotation.set(0, Math.random() * 6.3, 0); trevor.found = 0;
  }
  hideTrevor();
  function findTrevor() {
    if (trevor.found > 0) return false;
    trevor.found = 1.6; st.trevor++; fun.save(); fun.sfx.ribbit(1.4); fun.sfx.tada();
    fun.toast('🐸', st.trevor === 1 ? 'מָצָאתָ אֶת טְרֶווֹר!' : 'שׁוּב מָצָאתָ! ×' + st.trevor); fun.confetti(['🐸', '💚', '✨', '🍀'], 16);
    try { window.__game.give('frog', 1); } catch { /* no quests */ }
    return true;
  }

  // ================= Peeves (indoors only, so he never costs the grounds a draw call) =================
  const TAUNTS = ['לֹא תִּתְפֹּס אוֹתִי! 😜', 'בּוּ!! 👻', 'נָה נָה נָה 🎵', 'פְּרְרְרְ! 😝'];
  const pv = { G: new Group(), state: 'gone', timer: 30, life: 0, spin: 0, pop: 0, razz: 0, vx: 0, vz: 0, b: null };
  (function buildPeeves() {
    const G = pv.G, skin = M(0xdff3ff, { emissive: new Color(0x4a6a8a), emissiveIntensity: 0.4 }), coat = M(0xff8a2a);
    const body = mk(G, new ConeGeometry(0.45, 1.0, 12), coat, 0, 0.15, 0); body.rotation.x = Math.PI;
    mk(G, new SphereGeometry(0.44, 14, 10), coat, 0, 0.65, 0).scale.set(1, 0.7, 0.9);
    const head = new Group(); head.position.y = 1.18; G.add(head); pv.head = head;
    mk(head, new SphereGeometry(0.4, 16, 12), skin);
    for (const s of [-1, 1]) { mk(head, new SphereGeometry(0.11, 10, 8), M(0xffffff), s * 0.15, 0.07, 0.33); mk(head, new SphereGeometry(0.05, 8, 6), M(0x101018), s * 0.15 + 0.02, 0.07, 0.42); const h = mk(head, new ConeGeometry(0.16, 0.55, 8), M(s < 0 ? 0xe8352e : 0x2ecf6a), s * 0.2, 0.5, 0); h.rotation.z = -s * 0.8; }
    pv.tongue = mk(head, new BoxGeometry(0.12, 0.2, 0.05), M(0xff6a9a), 0, -0.22, 0.38);
    G.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.raycast = () => {}; } });
    G.visible = false; G.name = 'peeves'; scene.add(G);
  })();
  function spawnPeeves() {
    const rm = interiors.room; if (pv.state !== 'gone' || !rm) return false;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const c of rm.colliders || []) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
    pv.b = { x0: x0 + 1.6, x1: x1 - 1.6, z0: z0 + 1.6, z1: z1 - 1.6 };
    const f = player.yaw, x = clamp(pos.x + Math.sin(f) * 5, pv.b.x0, pv.b.x1), z = clamp(pos.z + Math.cos(f) * 5, pv.b.z0, pv.b.z1);
    pv.G.position.set(x, FLOOR_Y + 1, z); pv.G.visible = true; pv.G.scale.setScalar(0.01);
    pv.state = 'taunt'; pv.life = 24; pv.pop = 0; pv.razz = 1.2; pv.room = interiors.active;
    fun.sfx.poof(); setTimeout(() => fun.sfx.giggle(), 250);
    return true;
  }
  function catchPeeves() {
    if (pv.state !== 'taunt') return false;
    pv.state = 'caught'; pv.spin = 1.5; st.peeves = (st.peeves || 0) + 1; fun.save(); fun.sfx.yelp();
    fun.toast('🤡', 'תָּפַסְתָּ אֶת פִּיבְס!'); fun.confetti(['🤡', '✨', '🎉', '🍬'], 16);
    try { window.__game.give('snitch', 2); } catch { /* no quests */ }
    return true;
  }
  function leavePeeves() { pv.state = 'gone'; pv.G.visible = false; pv.timer = 40 + Math.random() * 40; fun.sfx.poof(); }
  function tickPeeves(dt, t, room, modal) {
    if (pv.state === 'gone') { if (room && !modal) { pv.timer -= dt; if (pv.timer <= 0 && !spawnPeeves()) pv.timer = 5; } return; }
    if (room !== pv.room) return leavePeeves();
    const P = pv.G.position, dx = P.x - pos.x, dz = P.z - pos.z, d = Math.hypot(dx, dz) || 1;
    pv.pop = Math.min(1, pv.pop + dt * 4); pv.tongue.scale.y = 1 + Math.sin(t * 14) * 0.35; pv.head.rotation.z = Math.sin(t * 5) * 0.25;
    if (pv.state === 'caught') { pv.spin -= dt; pv.G.rotation.y += dt * 22; pv.G.scale.setScalar(Math.max(0.01, pv.spin / 1.5)); P.y += dt * 1.2; if (pv.spin <= 0) leavePeeves(); return; }
    pv.G.scale.setScalar(pv.pop); pv.life -= dt; pv.razz -= dt;
    if (pv.razz <= 0 && !modal) { pv.razz = 4.5 + Math.random() * 3; fun.say(tmp.set(P.x, P.y + 2.2, P.z), TAUNTS[(Math.random() * TAUNTS.length) | 0], 2.2, 'peeves'); Math.random() < 0.5 ? fun.sfx.raspberry() : fun.sfx.giggle(); }
    const flee = d < 8 ? 5.2 : 0, wob = Math.sin(t * 1.7) * 2;          // a touch slower than your walk, so he CAN be caught
    pv.vx += ((dx / d) * flee - (dz / d) * wob - pv.vx) * Math.min(1, dt * 4); pv.vz += ((dz / d) * flee + (dx / d) * wob - pv.vz) * Math.min(1, dt * 4);
    P.x = clamp(P.x + pv.vx * dt, pv.b.x0, pv.b.x1); P.z = clamp(P.z + pv.vz * dt, pv.b.z0, pv.b.z1);
    P.y = FLOOR_Y + 0.9 + Math.sin(t * 3) * 0.3; pv.G.rotation.y = Math.atan2(-dx, -dz);
    if (d < 1.9 && !modal) catchPeeves(); else if (pv.life <= 0) { fun.sfx.raspberry(); leavePeeves(); }
  }

  // ================= owl post (Great Hall, once a real day — the same day-stamp v1 uses) =================
  const gift = { G: null, state: st.giftDay === fun.today() ? 'done' : 'wait', fall: 0 };
  const DROP = { x: 0, z: 6 };
  function buildGift(g) {
    const B = new Group(); B.position.set(DROP.x, 9, DROP.z);
    const rib = M(0xffd23f, { metalness: 0.4, roughness: 0.35 });
    mk(B, new BoxGeometry(0.9, 0.75, 0.9), M([0xe8352e, 0x2e7de8, 0x2ecf6a, 0xb04de8][(Math.random() * 4) | 0]), 0, 0.38, 0);
    mk(B, new BoxGeometry(0.94, 0.78, 0.18), rib, 0, 0.38, 0); mk(B, new BoxGeometry(0.18, 0.78, 0.94), rib, 0, 0.38, 0);
    for (const s of [-1, 1]) { const bow = mk(B, new TorusGeometry(0.16, 0.06, 6, 12), rib, s * 0.16, 0.88, 0); bow.rotation.y = Math.PI / 2; bow.rotation.x = s * 0.5; }
    g.add(B); gift.G = B; gift.state = 'fall'; gift.fall = 0; fun.sfx.hoot();
  }
  function openGift() {
    if (gift.state !== 'landed') return false;
    gift.state = 'done'; st.giftDay = fun.today(); st.gifts = (st.gifts || 0) + 1; fun.save();
    if (gift.G) gift.G.visible = false;
    fun.sfx.tada(); fun.confetti(['🎁', '🎉', '✨', '🍬', '⭐'], 26); fun.toast('🎁', 'דֹּאַר יַנְשׁוּפִים! מָחָר יַגִּיעַ עוֹד 🦉', 2800);
    try { window.__game.give('snitch', 3); } catch { /* no quests */ }
    return true;
  }
  function tickGift(dt, t, room) {
    if (!gift.G || room !== 'greathall' || gift.state === 'done') return;
    const B = gift.G;
    if (gift.state === 'fall') { gift.fall += dt; const k = Math.min(1, gift.fall / 2.2); B.position.y = 9 * (1 - k * k); B.rotation.y = k * 9; if (k >= 1) { gift.state = 'landed'; B.position.y = 0; fun.sfx.boing(); } return; }
    B.position.y = Math.abs(Math.sin(t * 2.2)) * 0.15; B.rotation.z = Math.sin(t * 9) * (Math.sin(t * 1.5) > 0.6 ? 0.12 : 0);
    if (Math.hypot(pos.x - DROP.x, pos.z - DROP.z) < 1.7) openGift();
  }

  // ================= room streaming + per-frame =================
  function roomEntered(id, g) {
    roomLive.enchant = (g.userData.enchant || []).slice(); roomLive.hat = null; roomLive.perch = null; roomLive.bowl = null;
    if (id === HAT.room) roomLive.hat = buildHat(g);
    if (id === PERCH.room && !st.pet) roomLive.perch = buildPerch(g);
    if (id === BOWL.room) roomLive.bowl = buildBowl(g);
    gift.G = null; if (id === 'greathall' && gift.state !== 'done') buildGift(g);
  }
  function roomLeft() { roomLive.enchant = []; roomLive.hat = null; roomLive.perch = null; roomLive.bowl = null; }

  // a friendly hello the first time you play each day (with your 🔥 streak, if you have one)
  let helloDone = st.helloDay === fun.today();
  function hello() {
    helloDone = true; st.helloDay = fun.today(); fun.save();
    const h = new Date().getHours(), part = h < 12 ? ['🌅', 'בֹּקֶר טוֹב!'] : h < 18 ? ['☀️', 'צָהֳרַיִם טוֹבִים!'] : ['🌙', 'עֶרֶב טוֹב!'];
    let n = 0; try { n = window.HPLessons.progress.streak(); } catch { /* lessons not loaded */ }
    fun.toast(part[0] + '🦉', part[1] + (n >= 2 ? '  🔥×' + n : ''), 2600); fun.sfx.hoot();
  }
  function update(dt, inside) {
    T += dt; const t = T, room = interiors.active || null;
    if (!helloDone && T > 1.2 && !isModal()) hello();
    if (!room && (roomLive.hat || roomLive.enchant.length || roomLive.bowl || roomLive.perch)) roomLeft();
    if (cool > 0) { cool -= dt; if (cool <= 0) wandBtn.classList.remove('cool'); }
    if (fly) { fly.t += dt; const k = Math.min(1, fly.t / fly.dur); bolt.visible = true; bolt.position.lerpVectors(from, to, k); bolt.position.y += Math.sin(k * Math.PI) * 0.6; bolt.scale.setScalar(1 + Math.sin(fly.t * 40) * 0.3); if (k >= 1) { land(); fly = null; bolt.visible = false; } }
    const modal = isModal();
    // Sorting Hat
    const H = roomLive.hat;
    if (H && room === HAT.room) {
      H.tipG.rotation.z = Math.sin(t * 1.3) * 0.12; H.hat.scale.y = 1 + Math.sin(t * 2.2) * 0.025;
      if (H.talk > 0) { H.talk -= dt; H.mouth.scale.y = 1 + Math.abs(Math.sin(t * 16)) * 2.6; } else H.mouth.scale.y = 1;
      const d = Math.hypot(pos.x - HAT.x, pos.z - HAT.z);
      if (d < 8 && !modal) { H.quip -= dt; if (H.quip <= 0) { H.quip = 7 + Math.random() * 5; H.talk = 1.6; const h = HOUSES.find(x => x.key === st.house); fun.say(tmp.set(HAT.x, FLOOR_Y + 3.2, HAT.z), h ? h.crest + ' ' + h.name + '!' : 'פְּסְסְט... בּוֹא נְמַיֵּן אוֹתְךָ! 🎩', 2.6, 'hat'); } }
      if (d < 3.2 && !modal) fun.offer('sort', '🎩', d, openSort);
      // by the hourglasses when YOUR house is in the lead: a little house-cup moment (once a day)
      if (!modal && st.house && st.cupDay !== fun.today() && pos.z < -5) {
        const mine = housePts(st.house);
        if (mine > 0 && HOUSES.every(h => h.key === st.house || housePts(h.key) < mine)) {
          st.cupDay = fun.today(); fun.save();
          const h = HOUSES.find(x => x.key === st.house);
          fun.toast('🏆' + h.crest, h.name + ' מוֹבִיל!', 2800); fun.confetti([h.crest, '🏆', '✨', '⭐'], 26); fun.sfx.tada();
        }
      }
    }
    // Pip
    if (!st.pet) {
      const Pp = roomLive.perch;
      owl.visible = !!Pp && room === PERCH.room;
      if (owl.visible) {
        owl.position.set(PERCH.x, FLOOR_Y + 1.82 + Math.abs(Math.sin(t * 3)) * 0.08, PERCH.z); owl.rotation.y = Math.atan2(pos.x - PERCH.x, pos.z - PERCH.z);
        const d = Math.hypot(pos.x - PERCH.x, pos.z - PERCH.z);
        Pp.call -= dt; if (Pp.call <= 0 && d < 12) { Pp.call = 3.5; fun.sfx.tweet(); fun.say(tmp.set(PERCH.x, FLOOR_Y + 2.6, PERCH.z), '🥺💛', 2, 'pet'); }
        if (d < 2.1) { adopt(); owlPos.copy(owl.position); }
      }
    } else {
      owl.visible = true;
      const f = player.yaw, s = player.model.scale.y;
      tmp.set(pos.x + Math.cos(f) * 0.7 - Math.sin(f) * 0.3, pos.y + 2.25 * s + Math.sin(t * 2.4) * 0.12, pos.z - Math.sin(f) * 0.7 - Math.cos(f) * 0.3);
      if (owlPos.distanceTo(tmp) > 30) owlPos.copy(tmp); else owlPos.lerp(tmp, 1 - Math.exp(-dt * 5));
      owl.position.copy(owlPos);
      if (pipLoop > 0) { pipLoop -= dt; const a = (1 - pipLoop / 1.2) * Math.PI * 2; owl.position.y += Math.sin(a) * 0.7; owl.rotation.z = a; } else owl.rotation.z = 0;
      owl.rotation.y += (((f - owl.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);
    }
    for (const w of owlWings) w.rotation.z = w.userData.s * (st.pet ? Math.sin(t * 22) * 0.9 : 0.2);
    // beans
    const Bw = roomLive.bowl;
    if (Bw && room === BOWL.room && !modal) { const d = Math.hypot(pos.x - BOWL.x, pos.z - BOWL.z); if (d > 3) Bw.armed = true; if (d < 1.6 && Bw.armed) { Bw.armed = false; eat(); } }
    const want = fx === 'giant' ? 1.7 : fx === 'tiny' ? 0.45 : 1, sc = player.model.scale.x, ns = sc + (want - sc) * Math.min(1, dt * 6);
    if (Math.abs(ns - sc) > 1e-4) player.model.scale.setScalar(ns);
    if (fx) { fxLeft -= dt; if (fx === 'rainbow') robeMats.forEach(m => m.color.setHSL((t * 0.6) % 1, 0.85, 0.55)); if (fxLeft <= 0) endBean(); }
    tickPeeves(dt, t, room, modal); tickGift(dt, t, room);
    // Trevor
    const tv = trevor; tv.G.visible = tv.room === room && Math.hypot(pos.x - tv.G.position.x, pos.z - tv.G.position.z) < 30;
    if (tv.G.visible) {
      tv.throat.scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * 0.35);
      const d = Math.hypot(pos.x - tv.G.position.x, pos.z - tv.G.position.z);
      if (tv.found > 0) { tv.found -= dt; const k = 1 - tv.found / 1.6; tv.G.position.y = tv.base + Math.sin(k * Math.PI) * 2; tv.G.rotation.x = k * Math.PI * 4; if (tv.found <= 0) { tv.G.rotation.x = 0; fun.sfx.poof(); hideTrevor(); } }
      else {
        tv.hopT -= dt; if (tv.hopT <= 0) { tv.hopT = 2 + Math.random() * 3; tv.hop = 0.45; }
        if (tv.hop > 0) { tv.hop -= dt; tv.G.position.y = tv.base + Math.sin(Math.max(0, 1 - tv.hop / 0.45) * Math.PI) * 0.6; } else tv.G.position.y = tv.base;
        if (d < 18 && !modal) { tv.rib -= dt; if (tv.rib <= 0) { tv.rib = 1.6 + d * 0.12; fun.sfx.ribbit(clamp(1.5 - d / 13, 0.12, 1.4)); if (d < 10) fun.say(tmp.set(tv.G.position.x, tv.base + 1.4, tv.G.position.z), 'קְוָה! 🐸', 1.2, 'trevor'); } }
        if (d < 1.7 && !modal) findTrevor();
      }
    }
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const api = {
    update, roomEntered, cast, lastCast, helloDay: () => st.helloDay, found: () => st.magic.slice(),
    sorting: { open: openSort, pos: HAT, house: () => st.house, housePts },
    pet: { perch: PERCH, has: () => !!st.pet, owl, looping: () => pipLoop > 0 },
    beans: { eat, end: endBean, bowl: BOWL, current: () => fx, count: () => st.beans },
    peeves: { spawn: spawnPeeves, caught: catchPeeves, state: () => pv.state, pos: pv.G.position, count: () => st.peeves || 0, soon(sec) { pv.timer = sec == null ? 0.1 : sec; } },
    gift: { open: openGift, state: () => gift.state, drop: DROP, reset() { gift.state = 'wait'; st.giftDay = ''; } },
    trevor: { find: findTrevor, where: () => ({ i: trevor.idx, room: trevor.room, x: trevor.G.position.x, z: trevor.G.position.z }), count: () => st.trevor },
  };
  fun.mods.delight = api;
  return api;
}
