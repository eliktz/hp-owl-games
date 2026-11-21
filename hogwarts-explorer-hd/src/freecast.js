// Free-play spells (the 🪄 wheel): in normal exploring the child picks a famous spell from a wheel
// and casts it with the existing 🪄 button (delight.js). Every spell shows a wand-tip effect anywhere,
// says its incantation in a bubble over Harry and speaks it in Hebrew (speechSynthesis, no audio files);
// near the little practice corner by the spawn (and on a few things that already exist) it really does
// something. With no spell-specific target in reach, a cast falls through to the wand's own delights
// (Pip loops, the Sorting Hat giggles, Trevor hops...). The four duelling spells (Expelliarmus, Stupefy,
// Protego, Riddikulus) act only on the dummies and the wardrobe of the duelling spot (freecast-duel.js) and
// never fall through to the wand's delights: nothing is cast on people or creatures.
//   hpFreecast1 (localStorage)  { sel, disc: [spell keys cast on a real target], chestPaid }
// Cost: nothing while idle (the corner hides beyond 70 m / indoors, effects are pooled and hidden when
// unused, nothing is allocated per frame).
import {
  Group, Mesh, InstancedMesh, PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry,
  LatheGeometry, ShapeGeometry, Shape, Vector2, Vector3, Quaternion, Euler, Matrix4, Color, BufferAttribute, Uint16BufferAttribute,
  MeshBasicMaterial, MeshStandardMaterial, CanvasTexture, SRGBColorSpace, AdditiveBlending, NormalBlending, DoubleSide,
  SkinnedMesh, Skeleton, Bone,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as fun from './fun.js';
import { buildCorner, CORNER, B } from './freecast-corner.js';
import { createDuel, DUEL } from './freecast-duel.js';
import { createCastle } from './freecast-castle.js';

const KEY = 'hpFreecast1';
export const SPELLS = [
  { key: 'lumos', icon: '💡', name: 'לוּמוֹס / נוֹקְס', words: 'לוּמוֹס!', off: 'נוֹקְס!', col: 0xfff0b0 },
  { key: 'maxima', icon: '☀️', name: 'לוּמוֹס מַקְסִימָה', words: 'לוּמוֹס מַקְסִימָה!', col: 0xfff6d0 },
  { key: 'leviosa', icon: '🪶', name: 'וִינְגַּרְדְיוּם לֵבְיוֹסָה', words: 'וִינְגַּרְדְיוּם לֵבְיוֹסָה!', col: 0xd8c8ff },
  { key: 'accio', icon: '🧲', name: 'אַצְיוֹ', words: 'אַצְיוֹ!', col: 0x9ad8ff },
  { key: 'alohomora', icon: '🔓', name: 'אָלוֹהוֹמוֹרָה', words: 'אָלוֹהוֹמוֹרָה!', col: 0xffd76a },
  { key: 'reparo', icon: '🏺', name: 'רֶפָּארוֹ', words: 'רֶפָּארוֹ!', col: 0x9affc8 },
  { key: 'incendio', icon: '🔥', name: 'אִינְסֶנְדְיוֹ', words: 'אִינְסֶנְדְיוֹ!', col: 0xff8a2a },
  { key: 'aguamenti', icon: '💧', name: 'אָגוּאָמֶנְטִי', words: 'אָגוּאָמֶנְטִי!', col: 0x5ab8ff },
  { key: 'engorgio', icon: '🐘', name: 'אֶנְגוֹרְגִיוֹ', words: 'אֶנְגוֹרְגִיוֹ!', col: 0xff9ae8 },
  { key: 'reducio', icon: '🐭', name: 'רֶדוּקְיוֹ', words: 'רֶדוּקְיוֹ!', col: 0x9af0ff },
  { key: 'orchideous', icon: '💐', name: 'אוֹרְכִידֵאוּס', words: 'אוֹרְכִידֵאוּס!', col: 0xff8ac0 },
  { key: 'avis', icon: '🐦', name: 'אָבִיס', words: 'אָבִיס!', col: 0x8ad0ff },
  { key: 'expelliarmus', icon: '🪃', name: 'אֶקְסְפֶּלִיאַרְמוּס', words: 'אֶקְסְפֶּלִיאַרְמוּס!', col: 0xff3a3a },
  { key: 'stupefy', icon: '💫', name: 'סְטוּפֶּפַי', words: 'סְטוּפֶּפַי!', col: 0xff6a2a },
  { key: 'petrificus', icon: '🧊', name: 'פֶּטְרִיפִיקוּס טוֹטָלוּס', words: 'פֶּטְרִיפִיקוּס טוֹטָלוּס!', col: 0x9ab8e8 },
  { key: 'protego', icon: '🛡️', name: 'פְּרוֹטֶגוֹ', words: 'פְּרוֹטֶגוֹ!', col: 0x7ac8ff },
  { key: 'riddikulus', icon: '😂', name: 'רִידִיקוּלוּס', words: 'רִידִיקוּלוּס!', col: 0xff9ad8 },
  { key: 'patronum', icon: '🦌', name: 'אֶקְסְפֶּקְטוֹ פַּטְרוֹנוּם', words: 'אֶקְסְפֶּקְטוֹ פַּטְרוֹנוּם!', col: 0xbfe4ff },
];
const BYKEY = Object.fromEntries(SPELLS.map(s => [s.key, s]));
const COOL = 0.8;                 // seconds of game time between casts (the wand's own is 0.55)
const REACH = 8;                  // metres: how far a spell finds its target

// ---- small geometry helpers (the same idea as spells.js paint/place/merge, copied: that file is not ours) ----
const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function paint(geo, hex, hex2 = null, axis = 'y') {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), a = new Color(hex), b = new Color(hex2 ?? hex);
  geo.computeBoundingBox(); const bb = geo.boundingBox, lo = bb.min[axis], span = (bb.max[axis] - lo) || 1, ax = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let i = 0; i < n; i++) { const k = (geo.attributes.position.getComponent(i, ax) - lo) / span; _c.copy(a).lerp(b, k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return geo.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
// a rod (cylinder) from point a to point b
function rod(a, b, r0, r1 = r0, seg = 6) {
  const d = _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const g = new CylinderGeometry(r1, r0, len, seg); g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  return g.applyMatrix4(_m4.compose(new Vector3(a[0], a[1], a[2]), _q, _s.set(1, 1, 1)));
}
const plain = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) n.deleteAttribute(k); return n; };
const merge = (parts) => mergeGeometries(parts.map(plain));
function bone(geo, idx) {   // every vertex of this part follows bone idx
  const g = plain(geo), n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = idx; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new BufferAttribute(sw, 4));
  return g;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.75)'); r.addColorStop(0.6, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createFreecast({ scene, camera, player, interiors, heightAt, delight, env, isModal, isTakeover, registerOutdoor }) {
  const pos = player.pos;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { saved = {}; }
  const st = { sel: BYKEY[saved.sel] ? saved.sel : 'lumos', disc: Array.isArray(saved.disc) ? saved.disc.filter(k => BYKEY[k]) : [], chestPaid: !!saved.chestPaid, opened: !!saved.opened };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ sel: st.sel, disc: st.disc, chestPaid: st.chestPaid, opened: st.opened })); } catch { /* private mode */ } };
  let speed = 1, cool = 0, T = 0;
  const log = { casts: 0, tipBursts: 0, spoken: [], lastWords: null, fallback: 0, lastTarget: null };
  const glowTex = glowTexture();

  // ================= HUD: the spell-choice button + the wheel =================
  const css = document.createElement('style');
  css.textContent = `
  #fcBtn{right:calc(210px + env(safe-area-inset-right));bottom:calc(32px + env(safe-area-inset-bottom));font-size:42px;
    background:radial-gradient(circle at 50% 35%,rgba(150,120,255,.95),rgba(50,25,120,.9));padding:0;cursor:pointer;touch-action:manipulation}
  #fcBtn.try{animation:wandTry 1.1s ease-in-out infinite}
  @media (max-width:900px){#fcBtn{right:calc(114px + env(safe-area-inset-right));bottom:calc(224px + env(safe-area-inset-bottom))}}
  #fcWheel{position:fixed;inset:0;z-index:46;display:none;align-items:center;justify-content:center;background:rgba(6,4,28,.55);
    font-family:'Rubik',sans-serif;direction:rtl;touch-action:manipulation;-webkit-user-select:none;user-select:none}
  #fcWheel.on{display:flex}
  #fcWheel .pan{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 16px 16px;border-radius:30px;border:4px solid #ffd76a;
    background:radial-gradient(ellipse at 50% 20%,rgba(70,45,150,.97),rgba(18,10,52,.97));box-shadow:0 12px 44px rgba(0,0,0,.6);max-width:96vw;box-sizing:border-box}
  #fcWheel .hd{display:flex;align-items:center;gap:18px;color:#ffe9a8;font-size:28px;font-weight:bold;text-shadow:0 2px 0 #000}
  #fcWheel .cnt{font-size:20px;padding:2px 12px;border-radius:16px;background:rgba(255,215,106,.18);border:2px solid rgba(255,215,106,.6)}
  #fcWheel .pan{max-height:calc(100vh - 12px);overflow-y:auto;-webkit-overflow-scrolling:touch}
  #fcWheel .grid{display:grid;grid-template-columns:repeat(6,min(150px,calc((96vw - 92px) / 6)));gap:10px}
  #fcWheel .sp{position:relative;height:min(132px,calc((100vh - 128px) / 3 - 10px));border-radius:22px;border:4px solid rgba(255,215,106,.55);background:rgba(40,25,95,.85);color:#fff;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px 5px;cursor:pointer;touch-action:manipulation;font-family:inherit;box-sizing:border-box}
  #fcWheel .sp .i{font-size:min(52px,calc((100vh - 128px) / 3 - 66px));line-height:1.05}
  #fcWheel .sp .n{font-size:17px;font-weight:bold;line-height:1.12;text-align:center;color:#ffe9a8}
  #fcWheel .sp.on{border-color:#fff3b0;background:radial-gradient(circle at 50% 30%,rgba(140,105,255,.95),rgba(60,35,140,.95));box-shadow:0 0 0 4px rgba(255,215,106,.5),0 0 22px rgba(255,215,106,.8)}
  #fcWheel .sp .st{position:absolute;top:3px;left:7px;font-size:18px}
  @media (max-aspect-ratio:1/1){#fcWheel .pan{padding:12px 10px 12px} #fcWheel .grid{grid-template-columns:repeat(3,min(calc((96vw - 44px) / 3),200px));gap:8px}
    #fcWheel .sp{height:min(124px,calc((100vh - 132px) / 6 - 8px));padding:3px 2px;border-width:3px} #fcWheel .sp .i{font-size:min(50px,11vw,calc((100vh - 132px) / 6 - 62px))} #fcWheel .sp .n{font-size:max(14px,min(18px,3.6vw))}}
  @media (max-height:520px){#fcWheel .pan{padding:6px 12px 8px;gap:5px} #fcWheel .hd{font-size:20px} #fcWheel .cnt{font-size:16px}
    #fcWheel .grid{grid-template-columns:repeat(6,min(150px,calc((96vw - 70px) / 6)));gap:6px} #fcWheel .sp{height:min(108px,calc((100vh - 70px) / 3 - 6px));border-radius:16px;gap:1px;border-width:3px}
    #fcWheel .sp .i{font-size:34px} #fcWheel .sp .n{font-size:14px}}
  body.modalOn #fcBtn,body.inMatch #fcBtn,body.inSpell #fcBtn,body.modalOn #fcWheel,body.inMatch #fcWheel,body.inSpell #fcWheel{display:none !important}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'fcBtn'; btn.className = 'gamebtn'; btn.setAttribute('aria-label', 'בְּחַר לַחַשׁ');
  document.body.appendChild(btn);
  if (!st.opened) btn.classList.add('try');
  const wheel = document.createElement('div'); wheel.id = 'fcWheel'; document.body.appendChild(wheel);
  const pan = document.createElement('div'); pan.className = 'pan'; wheel.appendChild(pan);
  const hd = document.createElement('div'); hd.className = 'hd'; pan.appendChild(hd);
  const ttl = document.createElement('span'); ttl.textContent = 'בְּחַר לַחַשׁ 🪄'; hd.appendChild(ttl);
  const cnt = document.createElement('span'); cnt.className = 'cnt'; hd.appendChild(cnt);
  const grid = document.createElement('div'); grid.className = 'grid'; pan.appendChild(grid);
  const tiles = {};
  for (const s of SPELLS) {
    const b = document.createElement('button'); b.className = 'sp'; b.dataset.k = s.key;
    b.innerHTML = '<span class="st"></span><span class="i">' + s.icon + '</span><span class="n">' + s.name + '</span>';
    b.addEventListener('click', e => { e.stopPropagation(); select(s.key); closeWheel(); fun.sfx.chime(); });
    grid.appendChild(b); tiles[s.key] = b;
  }
  const stop = e => e.stopPropagation();
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) wheel.addEventListener(ev, stop, { passive: true });
  wheel.addEventListener('click', e => { if (e.target === wheel) closeWheel(); });
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); });
  btn.addEventListener('click', e => { e.stopPropagation(); wheel.classList.contains('on') ? closeWheel() : openWheel(); });
  function refreshUI() {
    btn.textContent = BYKEY[st.sel].icon;
    cnt.textContent = '⭐ ' + st.disc.length + '/' + SPELLS.length;
    for (const s of SPELLS) { tiles[s.key].classList.toggle('on', s.key === st.sel); tiles[s.key].querySelector('.st').textContent = st.disc.includes(s.key) ? '⭐' : ''; }
  }
  function openWheel() {
    if (isModal() || isTakeover()) return false;
    refreshUI(); wheel.classList.add('on'); fun.sfx.flip();
    if (!st.opened) { st.opened = true; btn.classList.remove('try'); persist(); }
    return true;
  }
  function closeWheel() { wheel.classList.remove('on'); }
  function select(k) { if (!BYKEY[k]) return false; st.sel = k; persist(); refreshUI(); return true; }
  refreshUI();

  // ================= voice + bubble =================
  const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
  function speak(text) {
    log.spoken.push(text); if (log.spoken.length > 12) log.spoken.shift();
    try {
      if (muted() || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[—!/]/g, ' ')); u.lang = 'he-IL'; u.rate = 0.9; u.pitch = 1.15;
      const v = (speechSynthesis.getVoices() || []).find(x => /^(he|iw)/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech here */ }
  }
  const bubAt = new Vector3();
  function incant(text) {
    log.lastWords = text;
    fun.say(bubAt.set(pos.x, pos.y + 2.5 * player.model.scale.y, pos.z), text, 2.2, 'freecast');
    speak(text);
  }

  // ================= pooled particles (one InstancedMesh, additive, camera-facing) =================
  const NP = 220;
  const pMesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: AdditiveBlending }), NP);
  pMesh.frustumCulled = false; pMesh.visible = false; pMesh.raycast = () => {}; pMesh.renderOrder = 4; pMesh.name = 'freecast-fx';
  const P = []; for (let i = 0; i < NP; i++) { P.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.2, r: 1, g: 1, b: 1, grav: 0, drag: 0 }); pMesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
  pMesh.count = 0; scene.add(pMesh);
  let pAlive = 0;
  function emit(x, y, z, vx, vy, vz, life, size, hex, grav = 0, drag = 0) {
    let p = null; for (const q of P) if (q.life <= 0) { p = q; break; }
    if (!p) return;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life; p.size = size; p.grav = grav; p.drag = drag;
    _c.setHex(hex); p.r = _c.r; p.g = _c.g; p.b = _c.b;
    pAlive++;
  }
  function burst(x, y, z, hex, n = 14, spd = 2, life = 0.7, size = 0.22, grav = -1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = spd * (0.4 + Math.random() * 0.6), h = Math.sqrt(1 - u * u);
      emit(x, y, z, Math.cos(a) * h * s, u * s + spd * 0.3, Math.sin(a) * h * s, life * (0.6 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.7), hex, grav, 1.2); }
  }
  const pv = new Vector3(), ps = new Vector3();
  function tickParticles(dt) {
    if (pAlive <= 0) { if (pMesh.visible) { pMesh.visible = false; pMesh.count = 0; } return; }
    let n = 0, alive = 0;
    for (const p of P) {
      if (p.life <= 0) continue;
      p.life -= dt; if (p.life <= 0) continue;
      alive++;
      const k = Math.exp(-p.drag * dt); p.vx *= k; p.vz *= k; p.vy = p.vy * k + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = p.life / p.max, a = f < 0.3 ? f / 0.3 : 1, s = p.size * (0.5 + 0.5 * f);
      pMesh.setMatrixAt(n, _m4.compose(pv.set(p.x, p.y, p.z), camera.quaternion, ps.set(s, s, s)));
      pMesh.setColorAt(n, _c.setRGB(p.r * a, p.g * a, p.b * a));
      n++;
    }
    pAlive = alive; pMesh.count = n; pMesh.visible = n > 0;
    pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  }

  // ================= the wand tip =================
  const tipV = new Vector3(), fwd = new Vector3();
  function tip(out = tipV) {
    const f = player.yaw, s = player.model.scale.y;
    return out.set(pos.x + Math.sin(f) * 0.55 - Math.cos(f) * 0.22, pos.y + 1.25 * s, pos.z + Math.cos(f) * 0.55 + Math.sin(f) * 0.22);
  }
  function tipBurst(hex) {
    tip(); log.tipBursts++;
    burst(tipV.x, tipV.y, tipV.z, hex, 16, 1.6, 0.6, 0.2, -0.6);
    burst(tipV.x, tipV.y, tipV.z, 0xffffff, 5, 0.8, 0.35, 0.32, 0);
    // a short fan of sparks thrown forward, so a cast with nothing in front still reads as "magic went out"
    const f = player.yaw; fwd.set(Math.sin(f), 0, Math.cos(f));
    for (let i = 0; i < 10; i++) { const s = 3 + Math.random() * 3; emit(tipV.x, tipV.y, tipV.z, fwd.x * s + (Math.random() - 0.5) * 1.4, 0.6 + Math.random() * 1.4, fwd.z * s + (Math.random() - 0.5) * 1.4, 0.7 + Math.random() * 0.4, 0.18, hex, -2.2, 0.8); }
  }
  // a stream of sparks from the tip to a point (a "bolt" in the spell's colour)
  const streams = [];
  function stream(to, hex, dur = 0.45) { streams.push({ x: to.x, y: to.y, z: to.z, hex, t: 0, dur, acc: 0 }); }
  function tickStreams(dt) {
    for (let i = streams.length - 1; i >= 0; i--) {
      const s = streams[i]; s.t += dt; s.acc += dt; tip();
      while (s.acc > 0.012) {
        s.acc -= 0.012; const k = Math.min(1, s.t / s.dur) * Math.random();
        emit(tipV.x + (s.x - tipV.x) * k, tipV.y + (s.y - tipV.y) * k + Math.sin(k * Math.PI) * 0.5, tipV.z + (s.z - tipV.z) * k, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 0.35, 0.16, s.hex);
      }
      if (s.t >= s.dur) streams.splice(i, 1);
    }
  }

  // a fast bolt from the tip to a point: a bright head racing out with a trail (Expelliarmus, Stupefy, the bogart charm)
  const BOLTS = []; for (let i = 0; i < 4; i++) BOLTS.push({ on: false, x: 0, y: 0, z: 0, x0: 0, y0: 0, z0: 0, hex: 0, t: 0, dur: 0.3, acc: 0, fizzle: false });
  function bolt(to, hex, dur = 0.3, fizzle = false) {
    const b = BOLTS.find(q => !q.on) || BOLTS[0];
    tip(); b.on = true; b.x0 = tipV.x; b.y0 = tipV.y; b.z0 = tipV.z; b.x = to.x; b.y = to.y; b.z = to.z; b.hex = hex; b.t = 0; b.dur = dur; b.acc = 0; b.fizzle = fizzle;
  }
  function tickBolts(dt) {
    for (const b of BOLTS) {
      if (!b.on) continue;
      b.t += dt; b.acc += dt;
      const k = Math.min(1, b.t / b.dur);
      const hx = b.x0 + (b.x - b.x0) * k, hy = b.y0 + (b.y - b.y0) * k, hz = b.z0 + (b.z - b.z0) * k;
      emit(hx, hy, hz, 0, 0, 0, 0.09, 0.5, 0xffffff); emit(hx, hy, hz, 0, 0, 0, 0.12, 0.75, b.hex);
      while (b.acc > 0.01) { b.acc -= 0.01; const u = Math.random() * 0.25; emit(hx - (b.x - b.x0) * u * k, hy - (b.y - b.y0) * u * k, hz - (b.z - b.z0) * u * k, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.3, 0.2, b.hex, 0, 1); }
      if (k >= 1) { b.on = false; burst(b.x, b.y, b.z, b.hex, b.fizzle ? 10 : 18, b.fizzle ? 1 : 2.2, 0.5, b.fizzle ? 0.16 : 0.24, -1); }
    }
  }
  // a bolt thrown straight ahead that fizzles out (a duelling spell with nothing to hit)
  function boltAhead(hex, d = 6) { const f = player.yaw; tip(); bolt(_v.set(tipV.x + Math.sin(f) * d, tipV.y + 0.2, tipV.z + Math.cos(f) * d), hex, 0.45, true); }

  // ================= targets (filled by the practice corner + world bits below) =================
  const TARGETS = [];   // { id, spells: [keys], at(outVec3), ok(), cast(spellKey) }
  const tv = new Vector3();
  function best(key, maxD = REACH) {
    const f = player.yaw, sx = Math.sin(f), sz = Math.cos(f);
    let bestT = null, bs = 1e9;
    for (const t of TARGETS) {
      if (!t.spells.includes(key) || (t.corner && !(C && C.group.visible)) || (t.grp && !t.grp.visible) || !t.ok(key)) continue;
      t.at(tv); const dx = tv.x - pos.x, dz = tv.z - pos.z, d = Math.hypot(dx, dz);
      if (d > maxD || Math.abs(tv.y - pos.y) > 4) continue;
      const dot = d < 0.01 ? 1 : (dx * sx + dz * sz) / d, sc = d - dot * 3;
      if (sc < bs) { bs = sc; bestT = t; }
    }
    return bestT;
  }
  function discover(key) {
    if (st.disc.includes(key)) return;
    st.disc.push(key); persist(); refreshUI();
    const s = BYKEY[key];
    setTimeout(() => { fun.toast(s.icon + '⭐', 'לַחַשׁ חָדָשׁ! ' + st.disc.length + '/' + SPELLS.length, 2000); fun.sfx.chime(); }, 900);
  }

  // per-spell behaviour: return true when a real target took the spell
  const SP = {};   // key -> { cast() } (filled below)

  // ================= the practice corner =================
  let C = null;
  try { C = buildCorner({ scene, heightAt, colliders: player.colliders }); C.setFlameMaterialMap(glowTex); }
  catch (e) { console.warn('[freecast] corner skipped -', e && e.message || e); C = null; }
  let cornerOn = true;
  const cornerW = new Vector3();
  // world position of a bone (the group never rotates: local + group position)
  const boneW = (i, out) => out.copy(C.bones[i].position).add(C.group.position);
  SP._corner = {
    noFallback: true,
    tick(dt, inside) {
      if (!C) return;
      const near = !inside && cornerOn && Math.hypot(pos.x - CORNER.x, pos.z - CORNER.z) < 70;
      if (C.group.visible !== near) C.group.visible = near;
    },
  };


  // ================= spells on things =================
  const _qa = new Quaternion(), _qb = new Quaternion(), w0 = new Vector3(), w1 = new Vector3(), w2 = new Vector3();
  const resetBone = (i) => { const b = C.bones[i], r = C.rest[i]; b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); };
  const toLocal = (wv, out) => out.copy(wv).sub(C.group.position);
  const cornerTarget = (t) => { t.corner = true; TARGETS.push(t); return t; };
  // a spell that needs a target: the sparks fly there and the target's own cast() does the rest
  function targeted(key, extra = {}) {
    return {
      cast() {
        const t = best(key); if (!t) return false;
        t.at(tv);
        if (key === 'aguamenti') jet(tv); else stream(tv, BYKEY[key].col);
        t.cast(key); this.lastId = t.id; return true;
      },
      ...extra,
    };
  }

  // ---- Lumos / Nox: a warm light at the wand tip, a pool of light on the ground, a modest ambient lift ----
  const addMat = (hex, op = 1) => new MeshBasicMaterial({ map: glowTex, color: hex, transparent: true, opacity: op, depthWrite: false, blending: AdditiveBlending });
  const lumGlow = new Mesh(new PlaneGeometry(1, 1), addMat(0xfff0c8));
  const lumPool = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), addMat(0xffd690, 0.4));
  for (const m of [lumGlow, lumPool]) { m.visible = false; m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 5; scene.add(m); }
  let lumOn = false, lumK = 0, boost = 0, rDepth = 0, rSaved = null;
  // the lift exists only while a frame renders (scene before/after render), so nothing that saves or
  // restores the ambient (the interiors, a spell course's dimming) ever sees or keeps our boosted value
  const prevB = scene.onBeforeRender, prevA = scene.onAfterRender;
  scene.onBeforeRender = function (...a) { if (rDepth++ === 0 && boost > 0 && env && env.amb) { rSaved = env.amb.intensity; env.amb.intensity += boost; } return prevB && prevB.apply(this, a); };
  scene.onAfterRender = function (...a) { if (--rDepth <= 0) { rDepth = 0; if (rSaved !== null) { env.amb.intensity = rSaved; rSaved = null; } } return prevA && prevA.apply(this, a); };
  SP.lumos = {
    noFallback: true, isOn: () => lumOn, toggles: 0,
    cast() { lumOn = !lumOn; this.toggles++; this.lastId = lumOn ? 'lumos' : 'nox'; lumOn ? fun.sfx.chime() : fun.sfx.soft(); return true; },
    tick(dt, inside, busy) {
      if (rSaved !== null) { env.amb.intensity = rSaved; rSaved = null; rDepth = 0; }   // a render that never closed: put it back
      lumK += ((lumOn && !busy ? 1 : 0) - lumK) * Math.min(1, dt * 6);
      const vis = lumK > 0.01; lumGlow.visible = lumPool.visible = vis;
      if (!vis) { boost = 0; return; }
      const dark = inside || (env && env.time !== 'day');
      tip(); lumGlow.position.copy(tipV); lumGlow.quaternion.copy(camera.quaternion);
      lumGlow.scale.setScalar((dark ? 1.1 : 0.8) * lumK * (1 + Math.sin(T * 13) * 0.05));
      lumPool.position.set(pos.x, pos.y + 0.06, pos.z); lumPool.scale.setScalar((dark ? 8 : 5) * lumK);
      lumPool.material.opacity = (dark ? 0.5 : 0.22) * lumK;
      boost = (dark ? 0.38 : 0.12) * lumK;
    },
    state: () => ({ on: lumOn, k: +lumK.toFixed(2), boost: +boost.toFixed(2), toggles: SP.lumos.toggles }),
  };

  // ---- loose props: Wingardium Leviosa (float, bob, spin, set down) and Accio (fly to Harry, hover, go home) ----
  const props = {};
  function mkProp(id, bi, spells) {
    const p = { id, bi, mode: null, t: 0, maxRise: 0, floats: 0, accios: 0, reached: 0, reachD: null, returned: 0, from: new Vector3() };
    props[id] = p;
    cornerTarget({ id, spells, at: (o) => boneW(bi, o), ok: () => !p.mode, cast: (k) => { p.mode = k === 'accio' ? 'accio' : 'float'; p.t = -0.35; if (p.mode === 'float') p.maxRise = 0; } });
    return p;
  }
  if (C) { mkProp('feather', B.feather, ['leviosa']); mkProp('book', B.book, ['leviosa', 'accio']); mkProp('crate', B.crate, ['leviosa']); mkProp('broom', B.broom, ['accio']); }
  const FL = 5.9, AA = 0.9, AH = 3.0, AR = 1.1;
  function hoverPoint(out) { const f = player.yaw; tip(); return out.set(tipV.x + Math.sin(f) * 0.55, pos.y + 1.2 * player.model.scale.y, tipV.z + Math.cos(f) * 0.55); }
  function tickProp(p, dt) {
    if (!p.mode) return;
    p.t += dt; if (p.t < 0) return;
    const b = C.bones[p.bi], r = C.rest[p.bi], t = p.t;
    if (p.mode === 'float') {
      const y = t < 1 ? ease(t) * 1.3 : t < 4.6 ? 1.3 + Math.sin((t - 1) * 3) * 0.12 : 1.3 * (1 - ease((t - 4.6) / 1.3));
      b.position.copy(r.p); b.position.y += y; p.maxRise = Math.max(p.maxRise, y);
      const amp = Math.sin(Math.PI * Math.min(1, t / FL)), ang = Math.PI * 4 * ease(Math.min(t, FL) / FL);
      b.quaternion.copy(_qa.setFromEuler(_e.set(Math.sin(t * 2.3) * 0.3 * amp, ang, Math.cos(t * 1.7) * 0.2 * amp))).multiply(r.q);
      if (Math.random() < dt * 8) { boneW(p.bi, w0); emit(w0.x, w0.y, w0.z, (Math.random() - 0.5) * 0.4, -0.2, (Math.random() - 0.5) * 0.4, 0.8, 0.18, 0xd8c8ff); }
      if (t >= FL) { resetBone(p.bi); p.mode = null; p.floats++; fun.sfx.soft(); }
    } else {
      const restW = w1.copy(r.p).add(C.group.position);
      let ang;
      if (t < AA) {
        const k = ease(t / AA); hoverPoint(w2); w0.lerpVectors(restW, w2, k); w0.y += Math.sin(k * Math.PI) * 1.0; ang = k * Math.PI * 2;
      } else if (t < AA + AH) {
        if (!p.reachedNow) { p.reachedNow = true; p.reached++; hoverPoint(w2); p.reachD = +Math.hypot(w2.x - pos.x, w2.z - pos.z).toFixed(2); fun.sfx.pop(); burst(w2.x, w2.y, w2.z, 0x9ad8ff, 10, 1.2, 0.5, 0.18, 0); }
        hoverPoint(w0); w0.y += Math.sin((t - AA) * 3.2) * 0.08; ang = (t - AA) * 1.2;
        p.from.copy(w0);
      } else {
        const k = ease((t - AA - AH) / AR); w0.lerpVectors(p.from, restW, k); w0.y += Math.sin(k * Math.PI) * 0.9; ang = (1 - k) * AH * 1.2;
      }
      toLocal(w0, b.position);
      b.quaternion.copy(_qa.setFromEuler(_e.set(0, ang, 0))).multiply(r.q);
      if (Math.random() < dt * 10) { boneW(p.bi, w0); emit(w0.x, w0.y, w0.z, 0, 0.1, 0, 0.6, 0.16, 0x9ad8ff); }
      if (t >= AA + AH + AR) { resetBone(p.bi); p.mode = null; p.reachedNow = false; p.returned++; p.accios++; fun.sfx.soft(); }
    }
  }
  SP.leviosa = targeted('leviosa', { tick(dt) { if (C) for (const k in props) tickProp(props[k], dt); }, state: () => Object.fromEntries(Object.values(props).map(p => [p.id, { mode: p.mode, maxRise: +p.maxRise.toFixed(2), floats: p.floats, reached: p.reached, reachD: p.reachD, returned: p.returned, dy: C ? +(C.bones[p.bi].position.y - C.rest[p.bi].p.y).toFixed(2) : 0 }])) });
  SP.accio = targeted('accio');

  // ---- Alohomora: the chest's lock pops, the lid swings, a gold star rises (house points once) ----
  const chest = { state: 'locked', t: 0, opens: 0, paid: 0, rewarded: false };
  if (C) {
    C.bones[B.reward].scale.setScalar(0.001);
    cornerTarget({ id: 'chest', spells: ['alohomora'], at: (o) => boneW(B.lock, o), ok: () => chest.state === 'locked', cast: () => { chest.state = 'opening'; chest.t = -0.35; chest.opens++; chest.rewarded = false; } });
  }
  function tickChest(dt) {
    if (!C || chest.state === 'locked') return;
    chest.t += dt; const t = chest.t; if (t < 0) return;
    const lk = C.bones[B.lock], lr = C.rest[B.lock], ld = C.bones[B.lid], lrr = C.rest[B.lid], rw = C.bones[B.reward], rr = C.rest[B.reward];
    if (t < 3.2) {
      const k = Math.min(1, t / 0.7);
      lk.position.copy(lr.p); lk.position.y += Math.sin(k * Math.PI) * 0.45 + k * 0.1; lk.position.z += k * 0.45;
      lk.quaternion.copy(_qa.setFromEuler(_e.set(k * 9, 0, 0))).multiply(lr.q); lk.scale.setScalar(Math.max(0.001, 1 - ease((k - 0.5) * 2)));
      if (t > 0 && !chest.popped) { chest.popped = true; fun.sfx.clank(); boneW(B.lock, w0); burst(w0.x, w0.y, w0.z, 0xffd76a, 18, 2, 0.7, 0.2, -2); }
      ld.quaternion.copy(lrr.q).multiply(_qa.setFromEuler(_e.set(-1.9 * ease((t - 0.25) / 0.6), 0, 0)));
      if (t > 0.8) {
        const k2 = ease((t - 0.8) / 1.2), out = t > 2.6 ? 1 - ease((t - 2.6) / 0.5) : 1;
        rw.position.copy(rr.p); rw.position.y += k2 * 1.1; rw.quaternion.copy(_qa.setFromEuler(_e.set(0, t * 5, 0)));
        rw.scale.setScalar(Math.max(0.001, k2 * out * 1.3));
        if (Math.random() < dt * 14) { boneW(B.reward, w0); emit(w0.x + (Math.random() - 0.5) * 0.4, w0.y + (Math.random() - 0.5) * 0.4, w0.z, 0, 0.3, 0, 0.7, 0.2, 0xffe27a); }
      }
      if (t > 2.6 && !chest.rewarded) {
        chest.rewarded = true; boneW(B.reward, w0); burst(w0.x, w0.y, w0.z, 0xffe27a, 26, 2.4, 0.9, 0.24, -1.5); fun.sfx.tada();
        if (!st.chestPaid) {
          st.chestPaid = true; persist(); chest.paid++;
          try { window.HPLessons.progress.bonus(10); } catch { /* lessons not loaded */ }
          fun.toast('🔓⭐', '+10 נְקֻדּוֹת לַבַּיִת!', 2400); fun.confetti(['⭐', '✨', '🪙', '💛'], 18);
        } else fun.toast('🔓✨', 'נִפְתַּח!', 1400);
      }
    } else if (t < 10) {
      chest.state = 'open'; lk.scale.setScalar(0.001); rw.scale.setScalar(0.001);
      ld.quaternion.copy(lrr.q).multiply(_qa.setFromEuler(_e.set(-1.9, 0, 0)));
    } else if (t < 11.4) {
      ld.quaternion.copy(lrr.q).multiply(_qa.setFromEuler(_e.set(-1.9 * (1 - ease((t - 10) / 0.8)), 0, 0)));
      if (t > 10.8) { resetBone(B.lock); lk.scale.setScalar(Math.max(0.001, ease((t - 10.8) / 0.5))); }
    } else { resetBone(B.lid); resetBone(B.lock); chest.state = 'locked'; chest.popped = false; fun.sfx.tink(); }
  }
  SP.alohomora = targeted('alohomora', { tick: tickChest, state: () => ({ state: chest.state, opens: chest.opens, paid: chest.paid, paidEver: st.chestPaid }) });


  // ---- the Aguamenti water jet: droplets thrown on a ballistic arc from the tip to the target ----
  const jets = [];
  function jet(to, dur = 1.1) { jets.push({ x: to.x, y: to.y, z: to.z, t: 0, dur, acc: 0 }); fun.sfx.noise(dur, 0.12, 0, 1400, 0.4); }
  function tickJets(dt) {
    for (let i = jets.length - 1; i >= 0; i--) {
      const j = jets[i]; j.t += dt; j.acc += dt; tip();
      const tt = 0.55, g = -9;
      while (j.acc > 0.014) {
        j.acc -= 0.014;
        const vx = (j.x - tipV.x) / tt, vz = (j.z - tipV.z) / tt, vy = (j.y - tipV.y) / tt - 0.5 * g * tt, sp = 0.35;
        emit(tipV.x, tipV.y, tipV.z, vx + (Math.random() - 0.5) * sp, vy + (Math.random() - 0.5) * sp, vz + (Math.random() - 0.5) * sp, tt * (0.9 + Math.random() * 0.25), 0.16, Math.random() < 0.2 ? 0xe8f6ff : 0x4aa8ff, g, 0);
      }
      if (j.t >= j.dur) { jets.splice(i, 1); burst(j.x, j.y, j.z, 0x8ad0ff, 12, 1.4, 0.5, 0.16, -5); }
    }
  }

  // ---- Reparo: the smashed vase flies back together (and topples again after a while) ----
  const vase = { state: 'broken', t: 0, mends: 0, breaks: 0 };
  const shardIdx = (i) => B.shard0 + i;
  function poseShards(k, arc = 0) {   // k = 0 broken .. 1 whole
    for (let i = 0; i < C.NSHARD; i++) {
      const b = C.bones[shardIdx(i)], r = C.rest[shardIdx(i)], br = C.shardsBroken[i], kk = typeof k === 'function' ? k(i) : k;
      b.position.lerpVectors(br.p, r.p, kk); b.position.y += Math.sin(kk * Math.PI) * arc;
      b.quaternion.slerpQuaternions(br.q, r.q, kk);
    }
  }
  if (C) {
    poseShards(0);
    cornerTarget({ id: 'vase', spells: ['reparo'], at: (o) => o.set(C.PD.x, C.PD.y + 0.3, C.PD.z).add(C.group.position).setY(C.group.position.y + C.PD.y + 0.3), ok: () => vase.state === 'broken', cast: () => { vase.state = 'mending'; vase.t = -0.35; } });
  }
  function tickVase(dt) {
    if (!C || vase.state === 'broken') return;
    vase.t += dt; const t = vase.t;
    if (vase.state === 'mending') {
      if (t < 0) return;
      poseShards((i) => ease((t - i * 0.08) / 0.9), 0.6);
      if (Math.random() < dt * 20) { const b = C.bones[shardIdx((Math.random() * C.NSHARD) | 0)]; w0.copy(b.position).add(C.group.position); emit(w0.x, w0.y + 0.2, w0.z, 0, 0.4, 0, 0.6, 0.18, 0x9affc8); }
      if (t >= 1.45) { poseShards(1); vase.state = 'whole'; vase.t = 0; vase.mends++; w0.set(C.PD.x, C.PD.top + 0.3, C.PD.z).add(C.group.position); burst(w0.x, w0.y, w0.z, 0x9affc8, 22, 2, 0.8, 0.22, -1); fun.sfx.tink(0); fun.sfx.tink(3); fun.sfx.chime(); }
    } else if (vase.state === 'whole') {
      if (t > 30) { vase.state = 'wobble'; vase.t = 0; }
    } else if (vase.state === 'wobble') {
      const a = Math.sin(t * 16) * 0.12 * Math.min(1, t / 0.8);
      _qb.setFromEuler(_e.set(a * 0.5, 0, a));
      for (let i = 0; i < C.NSHARD; i++) { const b = C.bones[shardIdx(i)], r = C.rest[shardIdx(i)]; b.position.copy(r.p); b.quaternion.copy(_qb).multiply(r.q); }
      if (t > 1.0) { vase.state = 'falling'; vase.t = 0; }
    } else if (vase.state === 'falling') {
      poseShards(1 - ease(t / 0.45), 0.25);
      if (t >= 0.45) { poseShards(0); vase.state = 'broken'; vase.breaks++; fun.sfx.clank(); }
    }
  }
  SP.reparo = targeted('reparo', { tick: tickVase, state: () => ({ state: vase.state, mends: vase.mends, breaks: vase.breaks }) });

  // ---- Incendio lights the torches (they stay lit); Aguamenti puts one out ----
  const torches = C ? C.TORCH.map((t, i) => ({ i, lit: false, k: 0, pend: 0, out: 0, lights: 0, douses: 0 })) : [];
  torches.forEach((tc) => {
    const t = C.TORCH[tc.i];
    cornerTarget({ id: 'torch' + tc.i, spells: ['incendio', 'aguamenti'], at: (o) => o.set(t.x, t.flameY - 0.05, t.z).add(C.group.position),
      ok: (k) => (k === 'incendio' ? !tc.lit && !tc.pend : tc.lit && !tc.out),
      cast: (k) => { if (k === 'incendio') tc.pend = 0.4; else tc.out = 1.0; } });
  });
  let emberT = 0;
  function tickTorches(dt) {
    if (!C) return;
    let any = false;
    for (const tc of torches) {
      const t = C.TORCH[tc.i];
      if (tc.pend > 0) { tc.pend -= dt; if (tc.pend <= 0) { tc.pend = 0; tc.lit = true; tc.lights++; w0.set(t.x, t.flameY, t.z).add(C.group.position); burst(w0.x, w0.y, w0.z, 0xff9a30, 22, 2.2, 0.7, 0.24, 1); fun.sfx.whoosh(); fun.sfx.boom(); } }
      if (tc.out > 0) { tc.out -= dt; if (tc.out <= 0.45 && tc.lit) { tc.lit = false; tc.douses++; w0.set(t.x, t.flameY, t.z).add(C.group.position); for (let n = 0; n < 16; n++) emit(w0.x + (Math.random() - 0.5) * 0.3, w0.y, w0.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, 1.4, 0.4, 0x707a84, 0.2, 0.5); fun.sfx.noise(0.7, 0.14, 0, 3000, 0.8, 'highpass'); } if (tc.out < 0) tc.out = 0; }
      tc.k += ((tc.lit ? 1 : 0) - tc.k) * Math.min(1, dt * (tc.lit ? 5 : 8));
      if (tc.k > 0.01) any = true;
    }
    const F = C.flames;
    if (!any || !C.group.visible) { if (F.visible) F.visible = false; return; }
    F.visible = true;
    emberT -= dt; const ember = emberT <= 0; if (ember) emberT = 0.12;
    for (const tc of torches) {
      const t = C.TORCH[tc.i], k = tc.k, fl = 1 + Math.sin(T * 17 + tc.i * 2.1) * 0.08 + Math.sin(T * 29 + tc.i) * 0.05;
      F.setMatrixAt(tc.i, _m4.compose(w0.set(t.x, t.flameY + 0.04 * fl, t.z), camera.quaternion, w1.set(0.36 * k, 0.62 * k * fl, 1)));
      F.setMatrixAt(3 + tc.i, _m4.compose(w0.set(t.x, t.flameY - 0.02, t.z), camera.quaternion, w1.set(1.5 * k * fl, 1.5 * k * fl, 1)));
      if (ember && tc.lit) { w2.set(t.x, t.flameY + 0.1, t.z).add(C.group.position); emit(w2.x, w2.y, w2.z, (Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 0.9, 0.08, 0xffa040, 0.4); }
    }
    F.instanceMatrix.needsUpdate = true;
  }
  SP.incendio = targeted('incendio', { tick: tickTorches, state: () => ({ lit: torches.map(t => t.lit), lighting: torches.filter(t => t.pend > 0).length, lights: torches.reduce((a, t) => a + t.lights, 0), douses: torches.reduce((a, t) => a + t.douses, 0) }) });

  // ---- Aguamenti waters the flower bed: the flowers perk up, the pumpkin grows ----
  const bed = { wilt: 1, wiltTo: 1, pk: 1, pkTo: 1, last: -1e9, waters: 0, grows: 0, pend: 0 };
  if (C) cornerTarget({ id: 'bed', spells: ['aguamenti'], at: (o) => o.set(C.BD.x, C.BD.y + 0.3, C.BD.z).add(C.group.position), ok: () => !bed.pend, cast: () => { bed.pend = 0.8; } });
  function tickBed(dt) {
    if (!C) return;
    if (bed.pend > 0) {
      bed.pend -= dt;
      if (bed.pend <= 0) {
        bed.pend = 0; bed.waters++; bed.last = T; bed.wiltTo = 0;
        const n = Math.min(2.4, bed.pkTo * 1.35); if (n > bed.pkTo + 0.01) bed.grows++; bed.pkTo = n;
        w0.set(C.BD.x, C.BD.y + 0.5, C.BD.z).add(C.group.position); burst(w0.x, w0.y, w0.z, 0x9aff7a, 18, 1.6, 0.9, 0.22, -0.5); fun.sfx.giggle(true); fun.sfx.sparkle();
      }
    }
    if (T - bed.last > 45) { bed.wiltTo = 1; bed.pkTo = 1; }
    const fast = bed.wiltTo < bed.wilt;
    bed.wilt += (bed.wiltTo - bed.wilt) * Math.min(1, dt * (fast ? 2 : 0.3));
    bed.pk += (bed.pkTo - bed.pk) * Math.min(1, dt * (bed.pkTo > bed.pk ? 2.5 : 0.3));
    if (!C.group.visible) return;
    for (let i = 0; i < C.NFLOWER; i++) {
      const bi = C.flowers[i], b = C.bones[bi], r = C.rest[bi], w = bed.wilt, s = i % 2 ? 1 : -1;
      b.quaternion.copy(r.q).multiply(_qa.setFromEuler(_e.set(0.35 * w, 0, s * 1.15 * w + Math.sin(T * 2 + i) * 0.04 * (1 - w))));
      b.scale.set(1, 0.82 + 0.18 * (1 - w), 1);
    }
    C.bones[B.pumpkin].scale.setScalar(bed.pk);
  }
  SP.aguamenti = targeted('aguamenti', { tick(dt) { tickBed(dt); tickJets(dt); }, state: () => ({ wilt: +bed.wilt.toFixed(2), pumpkin: +bed.pk.toFixed(2), waters: bed.waters, grows: bed.grows }) });

  // ================= Expecto Patronum: a silver stag leaps out of the wand and circles Harry =================
  // ONE additive mesh (code-built, faces +z, feet at y 0, caught mid-leap) + the pooled particles for its light trail.
  function stagGeo() {
    const A = 0x7fc4ff, Bc = 0xe8f6ff, P = [];
    const part = (g) => P.push(paint(g, A, Bc));
    part(place(new SphereGeometry(0.36, 14, 10), 0, 1.08, 0, 0, 0, 0, 0.82, 0.86, 1.95));          // body
    part(place(new SphereGeometry(0.3, 12, 8), 0, 1.16, 0.42, 0, 0, 0, 0.8, 0.9, 1.0));           // chest
    part(rod([0, 1.22, 0.52], [0, 1.72, 0.86], 0.15, 0.09, 8));                                   // neck
    part(place(new SphereGeometry(0.13, 12, 8), 0, 1.78, 0.95, 0.25, 0, 0, 0.95, 0.9, 1.45));     // head
    part(place(new ConeGeometry(0.075, 0.2, 8), 0, 1.72, 1.15, Math.PI / 2 + 0.25, 0, 0));        // muzzle
    part(place(new ConeGeometry(0.05, 0.2, 6), 0, 1.02, -0.72, -2.2, 0, 0));                      // tail
    for (const sd of [-1, 1]) {
      part(place(new ConeGeometry(0.035, 0.16, 5), sd * 0.12, 1.9, 0.86, -0.3, 0, -sd * 0.9));    // ear
      // antler: a main beam sweeping up and back, three tines
      part(rod([sd * 0.06, 1.88, 0.9], [sd * 0.3, 2.3, 0.72], 0.028, 0.02));
      part(rod([sd * 0.3, 2.3, 0.72], [sd * 0.38, 2.68, 0.84], 0.02, 0.008));
      part(rod([sd * 0.16, 2.06, 0.82], [sd * 0.2, 2.34, 1.02], 0.018, 0.006));
      part(rod([sd * 0.26, 2.24, 0.75], [sd * 0.5, 2.46, 0.66], 0.018, 0.006));
      part(rod([sd * 0.34, 2.5, 0.78], [sd * 0.26, 2.74, 0.62], 0.014, 0.006));
      // legs mid-leap: the fore legs reach forward, the hind legs stretch back
      part(rod([sd * 0.15, 1.0, 0.5], [sd * 0.15, 0.62, 0.92], 0.075, 0.045));
      part(rod([sd * 0.15, 0.62, 0.92], [sd * 0.15, 0.2, 1.12], 0.045, 0.028));
      part(rod([sd * 0.16, 1.0, -0.52], [sd * 0.16, 0.66, -0.9], 0.085, 0.05));
      part(rod([sd * 0.16, 0.66, -0.9], [sd * 0.16, 0.22, -1.3], 0.05, 0.028));
    }
    return merge(P);
  }
  const PAT = { dur: 7.2, out: 0.7, fade: 1.2, R: 3.3, laps: 1.75 };
  let stag = null, patT = -1, patAcc = 0, patA0 = 0, patCasts = 0;
  const patP = new Vector3(), patPrev = new Vector3();
  function patStart() {
    if (!stag) {
      const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
      stag = new Mesh(stagGeo(), mat); stag.name = 'freecast-patronus'; stag.frustumCulled = false; stag.raycast = () => {}; stag.renderOrder = 3; stag.visible = false;
      scene.add(stag);
    }
    patT = 0; patAcc = 0; patA0 = player.yaw; patCasts++;
    tip(); patPrev.copy(tipV);
    burst(tipV.x, tipV.y, tipV.z, 0xbfe6ff, 26, 2.4, 0.9, 0.3, 0);
    fun.sfx.chime(); fun.sfx.tune([523, 659, 784, 1047, 1319], 0.16, 'sine');
  }
  function tickPatronus(dt, inside, busy) {
    if (patT < 0) return;
    patT += dt;
    if (patT >= PAT.dur || busy) { patT = -1; if (stag) stag.visible = false; return; }
    const k = patT / PAT.dur, grow = Math.min(1, patT / PAT.out), left = PAT.dur - patT, fade = Math.min(1, left / PAT.fade);
    const e = grow * grow * (3 - 2 * grow);
    // the circle is centred on Harry (it follows him if he walks); the stag starts at the wand and swings out to the radius
    const ang = patA0 + (patT / (PAT.dur - 0.4)) * PAT.laps * Math.PI * 2, R = PAT.R * e;
    const gx = pos.x + Math.sin(ang) * R, gz = pos.z + Math.cos(ang) * R;
    const ground = inside ? pos.y : heightAt(gx, gz);
    const leap = Math.abs(Math.sin(patT * 5.2)), rise = (1 - fade) * (1 - fade) * 2.4;
    tip();
    patP.set(gx, ground + leap * 0.45 * e + rise + (1 - e) * (tipV.y - ground - 1.0), gz);
    const s = (0.15 + 0.85 * e) * (0.9 + 0.1 * fade);
    stag.position.copy(patP); stag.scale.setScalar(s);
    // heading: along the circle (tangent), nose dips and lifts with each bound
    stag.rotation.set(Math.cos(patT * 5.2) * 0.16 * Math.sign(Math.sin(patT * 5.2) || 1) - (1 - fade) * 0.5, ang + Math.PI / 2, 0, 'YXZ');
    stag.material.opacity = 0.85 * fade * (0.85 + 0.15 * Math.sin(patT * 9));
    stag.visible = true;
    // the light trail: silver motes shed along its path, a few sparkles under the hooves at each landing
    patAcc += dt;
    while (patAcc > 0.03) {
      patAcc -= 0.03;
      const u = Math.random();
      emit(patPrev.x + (patP.x - patPrev.x) * u + (Math.random() - 0.5) * 0.3, patP.y + 0.5 + Math.random() * 1.1, patPrev.z + (patP.z - patPrev.z) * u + (Math.random() - 0.5) * 0.3,
        0, 0.15 + Math.random() * 0.3, 0, 0.9 + Math.random() * 0.7, 0.2 + Math.random() * 0.22, Math.random() < 0.3 ? 0xffffff : 0x9fd4ff, 0, 0.5);
    }
    if (leap < 0.12 && e > 0.9) emit(patP.x, ground + 0.08, patP.z, (Math.random() - 0.5) * 1.2, 0.8, (Math.random() - 0.5) * 1.2, 0.5, 0.18, 0xe8f6ff, -1.5, 1);
    patPrev.copy(patP);
  }
  SP.patronum = {
    noFallback: true, lastId: 'patronus',
    cast() { patStart(); return true; },
    tick: tickPatronus,
    state: () => ({ on: patT >= 0, t: +Math.max(0, patT).toFixed(2), casts: patCasts, visible: !!(stag && stag.visible),
      x: stag ? +stag.position.x.toFixed(2) : 0, y: stag ? +stag.position.y.toFixed(2) : 0, z: stag ? +stag.position.z.toFixed(2) : 0,
      d: stag ? +Math.hypot(stag.position.x - pos.x, stag.position.z - pos.z).toFixed(2) : 0 }),
  };

  // ================= the duelling spot (freecast-duel.js): Expelliarmus, Stupefy, Protego, Riddikulus =================
  let D = null;
  try { D = createDuel({ scene, camera, player, heightAt, fun, emit, burst, bolt, boltAhead, tip, tipV, glowTex, best }); }
  catch (e) { console.warn('[freecast] duelling spot skipped -', e && e.message || e); D = null; }
  if (D) { for (const t of D.targets) TARGETS.push(t); Object.assign(SP, D.SP); }
  // ================= batch 3 (freecast-castle.js): Lumos Maxima, Engorgio, Reducio, Avis, Orchideous + the castle spots =================
  let K = null;
  try { K = createCastle({ scene, camera, player, interiors, env, fun, emit, burst, stream, bolt, boltAhead, tip, tipV, glowTex, best, jet, BYKEY }); }
  catch (e) { console.warn('[freecast] castle spots skipped -', e && e.message || e); K = null; }
  if (K) { for (const t of K.targets) TARGETS.push(t); Object.assign(SP, K.SP); }
  for (const k of ['expelliarmus', 'stupefy', 'protego', 'riddikulus', 'petrificus']) if (!SP[k]) SP[k] = { noFallback: true, cast() { if (k === 'riddikulus' || k === 'protego') { tip(); burst(tipV.x, tipV.y, tipV.z, BYKEY[k].col, 16, 2, 0.8, 0.22, -1); if (k === 'riddikulus') fun.sfx.giggle(true); else fun.sfx.chime(); } else boltAhead(BYKEY[k].col); return false; } };

  // ================= casting =================
  function castSelected() {
    if (isModal() || isTakeover() || cool > 0) return false;
    const key = st.sel, s = BYKEY[key];
    cool = COOL; log.casts++;
    try { if (!fun.store.wandUsed) { fun.store.wandUsed = true; fun.save(); } const w = document.getElementById('wandBtn'); if (w) { w.classList.remove('try'); w.classList.add('cool'); } } catch { /* ignore */ }
    fun.sfx.zap();
    const h = SP[key];
    let words = s.words;
    if (key === 'lumos' && h && h.isOn && h.isOn()) words = s.off;
    incant(words);
    tipBurst(s.col);
    let hit = false;
    if (h) hit = !!h.cast();
    log.lastTarget = hit ? (h.lastId || key) : null;
    if (!hit && !(h && h.noFallback)) {
      // nothing for this spell here: the wand's own delights (Pip, the Hat, Trevor, Peeves, the lake...)
      log.fallback++;
      try { delight.cast(); } catch { /* ignore */ }
    }
    if (hit) discover(key);
    return true;
  }
  try { delight.onWand = castSelected; } catch { /* no wand */ }

  // ================= per-frame =================
  let hintT = 0;
  function update(dtRaw, inside) {
    const dt = dtRaw * speed; T += dt;
    const busy = isModal() || isTakeover();
    if (busy && wheel.classList.contains('on')) closeWheel();
    if (cool > 0) { cool -= dt; if (cool <= 0) { const w = document.getElementById('wandBtn'); if (w) w.classList.remove('cool'); } }
    for (const k in SP) if (SP[k].tick) SP[k].tick(dt, inside, busy);
    tickStreams(dt); tickBolts(dt);
    // hint: a soft sparkle on the thing the selected spell would act on
    hintT -= dt;
    if (hintT <= 0 && !busy) {
      hintT = 0.22;
      const t = best(st.sel, 6.5);
      if (t) { t.at(tv); emit(tv.x + (Math.random() - 0.5) * 0.6, tv.y + Math.random() * 0.4, tv.z + (Math.random() - 0.5) * 0.6, 0, 0.5, 0, 0.9, 0.24, 0xfff2b0); }
      hint = t ? t.id : null;
    }
    tickParticles(dt);
  }
  let hint = null;

  const api = {
    update, cast: castSelected, select, open: openWheel, close: closeWheel, spells: SPELLS,
    selected: () => st.sel,
    targets: () => TARGETS.map(t => { t.at(tv); return { id: t.id, spells: t.spells, ok: t.spells.some(k => t.ok(k)), x: +tv.x.toFixed(2), y: +tv.y.toFixed(2), z: +tv.z.toFixed(2), d: +Math.hypot(tv.x - pos.x, tv.z - pos.z).toFixed(2) }; }),
    best: (k) => { const t = best(k || st.sel); return t ? t.id : null; },
    state: () => {
      const o = { sel: st.sel, disc: st.disc.slice(), chestPaid: st.chestPaid, cool: +cool.toFixed(2), wheel: wheel.classList.contains('on'), hint, particles: pAlive, T: +T.toFixed(2), ...log, spoken: log.spoken.slice() };
      for (const k in SP) if (SP[k].state) o[k] = SP[k].state();
      return o;
    },
    _speed(k) { speed = k || 1; },
    corner: () => (C ? { x: CORNER.x, z: CORNER.z, y: C.Y0, visible: C.group.visible } : null),
    showCorner(on) { cornerOn = !!on; if (D) D.SP._duel.on = !!on; },
    duel: () => (D ? { x: DUEL.x, z: DUEL.z, y: D.Y0, visible: D.group.visible, show: { x: +(D.SHOW.x + DUEL.x).toFixed(2), z: +(D.SHOW.z + DUEL.z).toFixed(2) } } : null),
    _cool() { cool = 0; },
    castle: K ? K.api : null,
  };
  api._internal = { scene, emit, burst, stream, tip, tipBurst, TARGETS, SP, st, persist, glowTex, log, D, K };
  return api;
}
