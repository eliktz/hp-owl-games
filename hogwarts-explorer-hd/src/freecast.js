// Free-play spells (the 🪄 wheel): in normal exploring the child picks a famous spell from a wheel
// and casts it with the existing 🪄 button (delight.js). Every spell shows a wand-tip effect anywhere,
// says its incantation in a bubble over Harry and speaks it in Hebrew (speechSynthesis, no audio files);
// near the little practice corner by the spawn (and on a few things that already exist) it really does
// something. With no spell-specific target in reach, a cast falls through to the wand's own delights
// (Pip loops, the Sorting Hat giggles, Trevor hops...).
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

const KEY = 'hpFreecast1';
export const SPELLS = [
  { key: 'lumos', icon: '💡', name: 'לוּמוֹס / נוֹקְס', words: 'לוּמוֹס!', off: 'נוֹקְס!', col: 0xfff0b0 },
  { key: 'leviosa', icon: '🪶', name: 'וִינְגַּרְדְיוּם לֵבְיוֹסָה', words: 'וִינְגַּרְדְיוּם לֵבְיוֹסָה!', col: 0xd8c8ff },
  { key: 'accio', icon: '🧲', name: 'אַצְיוֹ', words: 'אַצְיוֹ!', col: 0x9ad8ff },
  { key: 'alohomora', icon: '🔓', name: 'אָלוֹהוֹמוֹרָה', words: 'אָלוֹהוֹמוֹרָה!', col: 0xffd76a },
  { key: 'reparo', icon: '🏺', name: 'רֶפָּארוֹ', words: 'רֶפָּארוֹ!', col: 0x9affc8 },
  { key: 'incendio', icon: '🔥', name: 'אִינְסֶנְדְיוֹ', words: 'אִינְסֶנְדְיוֹ!', col: 0xff8a2a },
  { key: 'aguamenti', icon: '💧', name: 'אָגוּאָמֶנְטִי', words: 'אָגוּאָמֶנְטִי!', col: 0x5ab8ff },
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
  #fcWheel .grid{display:grid;grid-template-columns:repeat(4,150px);gap:12px}
  #fcWheel .sp{position:relative;height:140px;border-radius:24px;border:4px solid rgba(255,215,106,.55);background:rgba(40,25,95,.85);color:#fff;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:4px 6px;cursor:pointer;touch-action:manipulation;font-family:inherit}
  #fcWheel .sp .i{font-size:56px;line-height:1.05}
  #fcWheel .sp .n{font-size:19px;font-weight:bold;line-height:1.15;text-align:center;color:#ffe9a8}
  #fcWheel .sp.on{border-color:#fff3b0;background:radial-gradient(circle at 50% 30%,rgba(140,105,255,.95),rgba(60,35,140,.95));box-shadow:0 0 0 4px rgba(255,215,106,.5),0 0 22px rgba(255,215,106,.8)}
  #fcWheel .sp .st{position:absolute;top:4px;left:8px;font-size:20px}
  @media (max-aspect-ratio:1/1){#fcWheel .grid{grid-template-columns:repeat(2,min(42vw,190px))}}
  @media (max-height:520px){#fcWheel .pan{padding:8px 12px 10px;gap:6px} #fcWheel .hd{font-size:22px}
    #fcWheel .grid{grid-template-columns:repeat(4,min(21vw,170px));gap:8px} #fcWheel .sp{height:min(36vh,132px)} #fcWheel .sp .i{font-size:44px} #fcWheel .sp .n{font-size:16px}}
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

  // ================= targets (filled by the practice corner + world bits below) =================
  const TARGETS = [];   // { id, spells: [keys], at(outVec3), ok(), cast(spellKey) }
  const tv = new Vector3();
  function best(key, maxD = REACH) {
    const f = player.yaw, sx = Math.sin(f), sz = Math.cos(f);
    let bestT = null, bs = 1e9;
    for (const t of TARGETS) {
      if (!t.spells.includes(key) || !t.ok(key)) continue;
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
    tickStreams(dt);
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
    showCorner(on) { cornerOn = !!on; },
    _cool() { cool = 0; },
  };
  api._internal = { scene, emit, burst, stream, tip, tipBurst, TARGETS, SP, st, persist, glowTex, log };
  return api;
}
