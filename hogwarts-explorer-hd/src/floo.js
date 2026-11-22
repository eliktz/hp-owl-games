// Floo Network: travel by fireplace, as in the books (Elik's son's ask, 22 Nov 2026; brief
// briefs/2026-11-22-floo-network.md in the art repo). Five Floo fireplaces: the Gryffindor common room (the
// existing hearth), the Great Hall, the Entrance Hall, the Potions dungeon (rooms.js builds them with
// floo-hearth.js) and a rough fieldstone hearth on the grounds by Hagrid's hut (built here).
//
// Walk up to one: a 🔥 prompt (fun.offer, the game's prompt). Tap: a Hebrew picker of destination cards.
// Pick: Harry steps into the grate, throws a pinch of glittering powder and says the place aloud; the flames
// burst emerald and roar up, sparkles spiral round him, he spins and is drawn up; a spinning tunnel of green
// fire with fireplaces rushing past (a 2D canvas over the game canvas, the same on WebGPU and WebGL2) hides
// the room change and stays up until the destination is ready; he spins down in the far grate, steps out,
// the fire fades back to orange, a soot puff, a sooty face and a sneeze.
//
// Budgets: one pooled InstancedMesh of 160 camera-facing quads for every particle (moved to whichever hearth
// is in use), nothing allocated per frame, one 64 px canvas texture, the tunnel canvas at ~360 px wide.
// Kid-safe: only ever Harry; never scary (bright emerald and gold, no darkness). Any failure is non-fatal.
// Debug: window.__game.floo  list() near() open() go(to) state() hold(phase) release()
import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, Object3D, Color, Vector3, Matrix4, Quaternion, MeshStandardMaterial } from 'three';
import { hutHearth, tickHearth } from './floo-hearth.js';
import { HUT } from './grounds-film.js';
import { FLOOR_Y } from './rooms.js';

export const FLOO = [
  { id: 'commonroom', room: 'commonroom', ico: '🦁', label: 'חדר המועדון של גריפינדור' },
  { id: 'greathall', room: 'greathall', ico: '🕯️', label: 'האולם הגדול' },
  { id: 'entrancehall', room: 'entrancehall', ico: '🏰', label: 'אולם הכניסה' },
  { id: 'dungeon', room: 'dungeon', ico: '⚗️', label: 'מרתף השיקויים' },
  { id: 'hut', room: null, ico: '🏡', label: 'הבקתה של האגריד' },
];
const BYID = Object.fromEntries(FLOO.map(f => [f.id, f]));
// The grounds hearth: in the hut's own frame (door toward local +z), behind the hut on the pumpkin side
// (-2.4 rad), 8 m from the hut's centre: 20 m from the paddock keep-out (the creatures lesson and its fence),
// 9.7 m from the hut spot, clear of the door path, the woodpile, the patch and the trees (the hut keep-out is 16 m);
// it faces round toward the patch and the front of the hut, so you see it as you walk round from the door.
const HUT_SPOT = { a: -2.4, r: 6.3, face: -0.2 };

const T_WALK = 0.9, T_THROW = 0.8, T_BURST = 1.4, T_TRANSIT = 2.0, T_ARRIVE = 1.9, T_SOOT = 6;

export function createFloo({ scene, camera, player, interiors, fun, groundAt, colliders, registerOutdoor, setTakeover, setModal, isModal, isTakeover, freecast, map }) {
  const log = { trips: 0, relights: 0, opens: 0, offers: 0, spoken: [], lastTrip: null, errors: 0 };
  const sfx = (k, ...a) => { try { const s = window.HPFun && window.HPFun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };

  // ---------------- the grounds hearth by Hagrid's hut ----------------
  let hut = null;
  try {
    const th = Math.atan2(HUT.door[0], HUT.door[1]), cs = Math.cos(th), sn = Math.sin(th), S = HUT.S;
    const lx = Math.sin(HUT_SPOT.a) * HUT_SPOT.r, lz = Math.cos(HUT_SPOT.a) * HUT_SPOT.r;
    const x = HUT.x + S * (lx * cs + lz * sn), z = HUT.z + S * (-lx * sn + lz * cs);
    let stone = null; const hutRoot = scene.getObjectByName('hagrid-hut');
    if (hutRoot) hutRoot.traverse(o => { if (!stone && o.isMesh && o.material && o.material.name === 'hut-stone') stone = o.material; });
    if (!stone) stone = new MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95 });
    const h = hutHearth({ x, z, y: groundAt(x, z), rotY: th + HUT_SPOT.face, stone });
    scene.add(h.root); registerOutdoor && registerOutdoor(h.root);
    if (colliders) colliders.push({ ...h.info.collider, floo: true });
    h.info.k = { green: 0, roar: 0 }; h.info.y = groundAt(x, z);
    hut = { root: h.root, info: h.info, shown: true };
  } catch (e) { console.warn('[floo] hut hearth skipped -', e && e.message || e); hut = null; }
  if (map && map.setBadges) { try { map.setBadges(FLOO.map(f => f.id), '🔥'); } catch { /* map without badges */ } }

  // ---------------- pooled particles: one InstancedMesh, camera-facing quads ----------------
  const NP = 160;
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillRect(30, 4, 4, 56); x.fillRect(4, 30, 56, 4);            // a faint four-point glint
    const t = new CanvasTexture(c); t.colorSpace = 'srgb'; return t;
  })();
  const pMesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), NP);
  pMesh.frustumCulled = false; pMesh.count = 0; pMesh.visible = false; pMesh.raycast = () => {}; pMesh.renderOrder = 5; pMesh.name = 'floo-fx';
  const _c = new Color();
  for (let i = 0; i < NP; i++) pMesh.setColorAt(i, _c.setRGB(0, 0, 0));
  scene.add(pMesh);
  // struct of arrays (no per-particle objects)
  const A = (n) => new Float32Array(NP * n);
  const pp = A(3), pv = A(3), pl = A(2), ps = A(2), pc = A(3), po = A(5), pm = new Uint8Array(NP);   // pos, vel, life/max, size/grow, colour, orbit (cx, cz, ang, rad, w), mode
  let alive = 0;
  // mode 0 spark (ballistic, drag), 1 orbit (spirals round cx,cz, rising), 2 smoke (grows, slows)
  function emit(mode, x, y, z, vx, vy, vz, life, size, r, g, b, grow = 0) {
    let i = -1; for (let k = 0; k < NP; k++) if (pl[k * 2] <= 0) { i = k; break; }
    if (i < 0) return -1;
    pm[i] = mode; pp[i * 3] = x; pp[i * 3 + 1] = y; pp[i * 3 + 2] = z; pv[i * 3] = vx; pv[i * 3 + 1] = vy; pv[i * 3 + 2] = vz;
    pl[i * 2] = pl[i * 2 + 1] = life; ps[i * 2] = size; ps[i * 2 + 1] = grow; pc[i * 3] = r; pc[i * 3 + 1] = g; pc[i * 3 + 2] = b;
    alive++; return i;
  }
  function orbit(cx, cz, y, ang, rad, w, vy, vr, life, size, r, g, b) {
    const i = emit(1, cx + Math.cos(ang) * rad, y, cz + Math.sin(ang) * rad, 0, vy, vr, life, size, r, g, b);
    if (i >= 0) { po[i * 5] = cx; po[i * 5 + 1] = cz; po[i * 5 + 2] = ang; po[i * 5 + 3] = rad; po[i * 5 + 4] = w; }
  }
  const _m = new Matrix4(), _p = new Vector3(), _s = new Vector3(), _q = new Quaternion();
  function tickParticles(dt) {
    if (alive <= 0) { if (pMesh.visible) { pMesh.visible = false; pMesh.count = 0; } return; }
    let n = 0, a = 0; _q.copy(camera.quaternion);
    for (let i = 0; i < NP; i++) {
      if (pl[i * 2] <= 0) continue;
      pl[i * 2] -= dt; if (pl[i * 2] <= 0) continue;
      a++;
      const i3 = i * 3, l = pl[i * 2] / pl[i * 2 + 1], m = pm[i];
      if (m === 1) {
        po[i * 5 + 2] += po[i * 5 + 4] * dt; po[i * 5 + 3] = Math.max(0.05, po[i * 5 + 3] + pv[i3 + 2] * dt);
        pp[i3] = po[i * 5] + Math.cos(po[i * 5 + 2]) * po[i * 5 + 3]; pp[i3 + 2] = po[i * 5 + 1] + Math.sin(po[i * 5 + 2]) * po[i * 5 + 3]; pp[i3 + 1] += pv[i3 + 1] * dt;
      } else {
        const drag = m === 2 ? 1.6 : 0.9, k = Math.max(0, 1 - drag * dt);
        pv[i3] *= k; pv[i3 + 2] *= k; pv[i3 + 1] = pv[i3 + 1] * k + (m === 0 ? -1.2 : 0.25) * dt;
        pp[i3] += pv[i3] * dt; pp[i3 + 1] += pv[i3 + 1] * dt; pp[i3 + 2] += pv[i3 + 2] * dt;
      }
      let sz = ps[i * 2];
      if (m === 2) sz *= (0.45 + (1 - l) * (1 + ps[i * 2 + 1])) * Math.min(1, l * 3);
      else sz *= Math.min(1, l * 2.5) * (0.85 + 0.15 * Math.sin(l * 40 + i));
      _p.set(pp[i3], pp[i3 + 1], pp[i3 + 2]); _s.set(sz, sz, sz);
      _m.compose(_p, _q, _s); pMesh.setMatrixAt(n, _m);
      pMesh.setColorAt(n, _c.setRGB(pc[i3], pc[i3 + 1], pc[i3 + 2]));
      n++;
    }
    alive = a; pMesh.count = n; pMesh.visible = n > 0;
    pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  }

  // ---------------- which hearth is here ----------------
  function hereInfo() {
    if (interiors.active) {
      const r = interiors.room, f = r && r.group && r.group.userData.floo;
      if (!f) return null;
      if (!f.k) f.k = { green: 0, roar: 0 };
      f.y = FLOOR_Y; return f;
    }
    return hut ? hut.info : null;
  }
  const hereId = () => { const f = hereInfo(); if (!f) return null; if (f.outdoor && !interiors.active) return 'hut'; return f.id; };

  // ---------------- the picker (full-screen Hebrew cards, like the map) ----------------
  const css = document.createElement('style');
  css.textContent = `
  #flooPick{position:fixed;inset:0;z-index:36;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    background:radial-gradient(ellipse at 50% 38%,rgba(20,96,58,.96),rgba(4,22,16,.98));direction:rtl}
  #flooPick.on{display:flex}
  #flooPick h2{color:#b8ffcf;font-size:30px;margin:0;text-shadow:0 2px 0 #000,0 0 18px rgba(80,255,150,.6)}
  #flooPick .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;width:min(760px,90vw);max-height:62vh;overflow:auto;padding:4px;box-sizing:border-box}
  #flooPick .dest{position:relative;padding:16px 10px;border-radius:18px;border:3px solid #7dffb0;cursor:pointer;background:rgba(14,70,44,.78);color:#fff;
    font-size:20px;font-weight:bold;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center;font-family:inherit;box-shadow:0 0 14px rgba(60,255,140,.25)}
  #flooPick .dest:active{transform:scale(.95)}
  #flooPick .dest .ico{font-size:40px}
  #flooPick .dest.cur{opacity:.42;filter:grayscale(.85);cursor:default;border-color:#9aa}
  #flooPick .dest .here{font-size:14px;color:#dfe}
  #flooPick .close{padding:10px 30px;border-radius:22px;border:3px solid #7dffb0;background:rgba(20,90,56,.85);color:#e6ffee;font-size:22px;font-weight:bold;cursor:pointer;font-family:inherit}
  @media (max-width:560px){#flooPick .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:92vw}#flooPick .dest{font-size:17px;padding:12px 6px}#flooPick .dest .ico{font-size:34px}#flooPick h2{font-size:26px}}
  #flooTunnel{position:fixed;inset:0;width:100%;height:100%;z-index:34;pointer-events:none;display:none;opacity:0}
  body.inFloo #funPrompt,body.inFloo .gamebtn,body.inFloo #camctl,body.inFloo #fcBtn,body.inFloo #wandBtn,body.inFloo #bellBtn,body.inFloo #enterBtn,body.inFloo #joy,body.inFloo #joyKnob,body.inFloo #quest{display:none !important}`;
  document.head.appendChild(css);
  const pick = document.createElement('div'); pick.id = 'flooPick'; document.body.appendChild(pick);
  const title = document.createElement('h2'); title.textContent = '🔥 רשת הפלו'; pick.appendChild(title);
  const grid = document.createElement('div'); grid.className = 'grid'; pick.appendChild(grid);
  const cards = {};
  for (const f of FLOO) {
    const b = document.createElement('button'); b.className = 'dest'; b.dataset.id = f.id;
    b.innerHTML = `<span class="ico">${f.ico}</span><span>${f.label}</span><span class="here"></span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (b.classList.contains('cur')) return; close(); go(f.id); });
    grid.appendChild(b); cards[f.id] = b;
  }
  const back = document.createElement('button'); back.className = 'close'; back.textContent = '✨ חזרה למשחק';
  back.addEventListener('click', (e) => { e.stopPropagation(); close(); }); pick.appendChild(back);
  let pickOpen = false;
  function open() {
    if (S.phase !== 'idle' || isTakeover() || (isModal() && !pickOpen)) return false;
    const cur = hereId(); if (!cur) return false;
    for (const f of FLOO) { const c = cards[f.id], on = f.id === cur; c.classList.toggle('cur', on); c.disabled = on; c.querySelector('.here').textContent = on ? '📍 אתה כאן' : ''; }
    pick.classList.add('on'); pickOpen = true; setModal(true); log.opens++; sfx('flip');
    return true;
  }
  function close() { if (!pickOpen) return; pick.classList.remove('on'); pickOpen = false; setModal(false); }

  // ---------------- the tunnel (2D canvas over the game canvas) ----------------
  const tc = document.createElement('canvas'); tc.id = 'flooTunnel'; document.body.appendChild(tc);
  const tx = tc.getContext('2d');
  let CW = 360, CH = 250, bgGrad = null, vigGrad = null;
  const STREAK = Array.from({ length: 72 }, (_, i) => ({ a: (i / 72) * Math.PI * 2 + Math.sin(i * 12.9) * 0.2, ph: (i * 0.618) % 1, sp: 0.55 + ((i * 7) % 10) / 14, c: i % 5 }));
  const SPARK = Array.from({ length: 46 }, (_, i) => ({ a: i * 2.399, ph: (i * 0.377) % 1, sp: 0.4 + ((i * 3) % 7) / 9 }));
  const GRATES = [0, 1, 2, 3].map(i => ({ a: i * 1.7 + 0.6, ph: i / 4 }));
  const COLS = ['rgba(120,255,160,', 'rgba(60,230,120,', 'rgba(200,255,140,', 'rgba(255,220,110,', 'rgba(40,200,110,'];
  const grateImg = (() => {   // one brick fireplace opening with a warm glimpse inside (drawn once)
    const c = document.createElement('canvas'); c.width = 96; c.height = 104; const x = c.getContext('2d');
    x.fillStyle = '#8a6448'; x.beginPath(); x.moveTo(6, 104); x.lineTo(6, 34); x.quadraticCurveTo(48, -6, 90, 34); x.lineTo(90, 104); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(60,36,22,.7)'; x.lineWidth = 2;
    for (let y = 40; y < 104; y += 11) { x.beginPath(); x.moveTo(6, y); x.lineTo(90, y); x.stroke(); for (let k = (y / 11) % 2 ? 6 : 18; k < 90; k += 24) { x.beginPath(); x.moveTo(k, y); x.lineTo(k, y + 11); x.stroke(); } }
    const g = x.createRadialGradient(48, 82, 4, 48, 74, 40); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.35, '#ffb040'); g.addColorStop(0.8, '#c4501a'); g.addColorStop(1, '#5a2a14');
    x.fillStyle = g; x.beginPath(); x.moveTo(22, 104); x.lineTo(22, 52); x.quadraticCurveTo(48, 22, 74, 52); x.lineTo(74, 104); x.closePath(); x.fill();
    x.fillStyle = '#ffe08a'; for (const [fx, fh] of [[36, 26], [48, 36], [60, 24]]) { x.beginPath(); x.moveTo(fx - 7, 100); x.quadraticCurveTo(fx, 100 - fh * 1.4, fx + 7, 100); x.fill(); }
    x.fillStyle = '#3a2416'; x.fillRect(2, 22, 92, 7);   // mantel
    return c;
  })();
  function sizeTunnel() {
    const asp = Math.max(0.4, Math.min(2.6, innerHeight / Math.max(1, innerWidth)));
    CW = 360; CH = Math.round(360 * asp); tc.width = CW; tc.height = CH;
    const R = Math.hypot(CW, CH) / 2;
    bgGrad = tx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, R);
    bgGrad.addColorStop(0, '#f4ffe0'); bgGrad.addColorStop(0.08, '#9dffb8'); bgGrad.addColorStop(0.3, '#2fd270'); bgGrad.addColorStop(0.65, '#128a48'); bgGrad.addColorStop(1, '#0a5a34');
    vigGrad = tx.createRadialGradient(CW / 2, CH / 2, R * 0.45, CW / 2, CH / 2, R);
    vigGrad.addColorStop(0, 'rgba(10,80,48,0)'); vigGrad.addColorStop(1, 'rgba(8,70,40,0.75)');
  }
  function drawTunnel(t, flash = 0) {
    const cx = CW / 2, cy = CH / 2, R = Math.hypot(CW, CH) / 2;
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over'; tx.globalAlpha = 1;
    tx.fillStyle = bgGrad; tx.fillRect(0, 0, CW, CH);
    const roll = Math.sin(t * 1.1) * 0.16;
    tx.translate(cx, cy); tx.rotate(roll);
    // fireplace openings rushing past, from the centre outwards
    for (const G of GRATES) {
      const u = (G.ph + t * 0.42) % 1, z = 1 - u * 0.93, r = R * 0.1 / z, s = CH * 0.16 / z, a = G.a + t * 0.9;
      tx.globalAlpha = Math.min(1, u * 4) * (u > 0.82 ? Math.max(0, (1 - u) / 0.18) : 1) * 0.95;
      tx.save(); tx.rotate(a); tx.translate(r, 0); tx.rotate(Math.PI / 2); tx.drawImage(grateImg, -s / 2, -s * 0.54, s, s * 1.08); tx.restore();
    }
    // spinning streaks of green fire
    tx.globalCompositeOperation = 'lighter'; tx.lineCap = 'round';
    for (const L of STREAK) {
      const u = (L.ph + t * L.sp * 0.6) % 1, z = 1 - u * 0.95, r0 = R * 0.07 / z, r1 = r0 * (1.25 + u * 0.5), a = L.a + t * 1.7 + u * 0.9;
      const ca = Math.cos(a), sa = Math.sin(a), a2 = a - 0.12 - u * 0.1, ca2 = Math.cos(a2), sa2 = Math.sin(a2);
      tx.strokeStyle = COLS[L.c] + (0.25 + u * 0.6).toFixed(2) + ')'; tx.lineWidth = 1 + u * 7;
      tx.beginPath(); tx.moveTo(ca * r0, sa * r0); tx.quadraticCurveTo(ca2 * (r0 + r1) / 2, sa2 * (r0 + r1) / 2, ca * r1, sa * r1); tx.stroke();
    }
    // gold sparks
    tx.fillStyle = 'rgba(255,240,170,0.9)';
    for (const P of SPARK) {
      const u = (P.ph + t * P.sp * 0.7) % 1, z = 1 - u * 0.96, r = R * 0.05 / z, a = P.a + t * 2.2, s = 0.8 + u * 3.2;
      tx.globalAlpha = Math.min(1, u * 3); tx.fillRect(Math.cos(a) * r - s / 2, Math.sin(a) * r - s / 2, s, s);
    }
    tx.globalAlpha = 1; tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over';
    tx.fillStyle = vigGrad; tx.fillRect(0, 0, CW, CH);
    if (flash > 0) { tx.globalCompositeOperation = 'lighter'; tx.fillStyle = 'rgba(190,255,200,' + Math.min(1, flash).toFixed(2) + ')'; tx.fillRect(0, 0, CW, CH); tx.globalCompositeOperation = 'source-over'; }
  }
  function tunnel(op, t, flash) {
    if (op <= 0.001) { if (tc.style.display !== 'none') { tc.style.display = 'none'; tc.style.opacity = '0'; } return; }
    if (tc.style.display !== 'block') { sizeTunnel(); tc.style.display = 'block'; }
    tc.style.opacity = op.toFixed(3); drawTunnel(t, flash);
  }

  // ---------------- voice + bubble (as freecast.js) ----------------
  const muted = () => { try { return !!(window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()); } catch { return false; } };
  function speak(text) {
    log.spoken.push(text); if (log.spoken.length > 8) log.spoken.shift();
    try {
      if (muted() || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[—!/]/g, ' ')); u.lang = 'he-IL'; u.rate = 0.9; u.pitch = 1.15;
      const v = (speechSynthesis.getVoices() || []).find(x => /^(he|iw)/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech here */ }
  }
  const bub = new Vector3();
  function say(text, sec = 2.4) { try { fun.say(bub.set(player.pos.x, player.pos.y + 2.5 * (player.model.scale.y || 1), player.pos.z), text, sec, 'floo'); } catch { /* no bubble */ } }

  // ---------------- the trip ----------------
  const S = { phase: 'idle', pt: 0, vt: 0, from: null, to: null, src: null, dst: null, ready: false, hold: null, soot: 0, cough: 0, holdAt: 0, start: { x: 0, z: 0, yaw: 0 }, scale0: 1, err: null, sootPuff: 0 };
  const focus = new Vector3();
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
  const take = { spell: true, floo: true, update: (dt) => step(dt) };   // (spell: the castle theme keeps playing, music.js)

  function go(to) {
    if (S.phase !== 'idle' || !BYID[to]) return false;
    const src = hereInfo(), from = hereId();
    if (!src || from === to) return false;
    close();
    S.from = from; S.to = to; S.src = src; S.dst = null; S.ready = false; S.err = null;
    S.start = { x: player.pos.x, z: player.pos.z, yaw: player.yaw }; S.scale0 = player.model.scale.x || 1;
    S.phase = 'walk'; S.pt = 0; S.vt = 0; S.spun = 0;
    setTakeover(take); document.body.classList.add('inFloo');
    log.trips++; log.lastTrip = { from, to, t0: performance.now(), relit: false, ms: 0 };
    return true;
  }
  function setPhase(p) { S.phase = p; S.pt = 0; }
  function camOn(info, dt, dist = 5.4, off = 0.38, pitch = 0.1) {
    const c = player.cam; c.yaw = info.rotY + off; c.pitch = pitch; c.dist = dist; c.userControlled = false; c.idle = 0;
    focus.set(info.grate.x, info.y, info.grate.z);
    c.update(dt, focus, 0, false);
  }
  function placeHarry(x, y, z, yaw, scale) {
    player.pos.set(x, y, z); player.smoothY = y; player.yaw = yaw;
    player.model.position.set(x, y, z); player.model.rotation.y = yaw; player.model.scale.setScalar(scale);
  }
  function sparkleRing(info, y0, n, rad = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, gold = Math.random() < 0.3;
      orbit(info.grate.x, info.grate.z, y0 + Math.random() * 0.6, a, rad * (0.7 + Math.random() * 0.5), 3.5 + Math.random() * 2.5, 0.9 + Math.random() * 1.2, -0.25, 1.1 + Math.random() * 0.6, 0.12 + Math.random() * 0.12,
        gold ? 1.4 : 0.35, gold ? 1.2 : 1.45, gold ? 0.5 : 0.6);
    }
  }
  function flameBurst(info, y0, n) {   // tall emerald tongues of light roaring up out of the grate
    for (let i = 0; i < n; i++) {
      const s = (Math.random() - 0.5) * info.ow * 0.7, fx = info.front[0], fz = info.front[1], rx = fz, rz = -fx;
      emit(0, info.grate.x + rx * s - fx * 0.15, y0 + 0.2, info.grate.z + rz * s - fz * 0.15, (Math.random() - 0.5) * 0.4 + fx * 0.3, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.4 + fz * 0.3,
        0.7 + Math.random() * 0.4, 0.45 + Math.random() * 0.35, 0.25, 1.35, 0.55);
    }
  }
  function sootPuff(info, y0) {
    const fx = info.front[0], fz = info.front[1];
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.283, s = 0.6 + Math.random() * 1.2;
      emit(2, info.grate.x + fx * 0.4, y0 + 0.3 + Math.random() * 0.8, info.grate.z + fz * 0.4, Math.cos(a) * s + fx * 1.6, 0.3 + Math.random() * 0.9, Math.sin(a) * s + fz * 1.6, 1.4 + Math.random() * 0.8, 0.5 + Math.random() * 0.4, 0.34, 0.33, 0.32, 1.4);
    }
    for (let i = 0; i < 14; i++) emit(0, info.grate.x + fx * 0.3, y0 + 0.4, info.grate.z + fz * 0.3, (Math.random() - 0.5) * 2 + fx * 1.2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2 + fz * 1.2, 0.8 + Math.random() * 0.5, 0.07 + Math.random() * 0.06, 1.5, 0.75, 0.25);
  }

  async function travel() {   // behind the tunnel: change rooms (or go out to the grounds), then mark ready
    const to = S.to, dest = BYID[to];
    try {
      if (dest.room) {
        const hf = await new Promise((res) => {
          let tries = 0;
          interiors.enter(dest.room);   // spawn first (safe), then we place Harry in the grate ourselves
          const poll = () => { tries++; const r = interiors.room; if (interiors.active === dest.room && r && r.group && r.group.userData.floo) res(r.group.userData.floo); else if (tries > 1200) res(null); else setTimeout(poll, 50); };
          poll();
        });
        if (!hf) throw new Error('room did not arrive');
        if (!hf.k) hf.k = { green: 0, roar: 0 }; hf.y = FLOOR_Y; S.dst = hf;
      } else {
        if (interiors.active) interiors.exit();
        if (!hut) throw new Error('no hut hearth');
        S.dst = hut.info; hut.root.visible = true; hut.shown = true;
      }
      const d = S.dst; player.teleport(d.arrive.x, d.arrive.z);
      await new Promise(r => setTimeout(r, 400));   // a beat for the room's first frames (textures, film stone)
      S.ready = true;
    } catch (e) { console.warn('[floo] travel failed -', e && e.message || e); S.err = String(e && e.message || e); log.errors++; S.ready = true; }
  }

  function step(dt) {
    const hold = S.hold && S.hold === S.phase && S.pt >= S.holdAt;
    S.vt += dt; if (!hold) S.pt += dt;
    const t = S.pt, src = S.src, dst = S.dst;
    player.animate(dt, { moving: S.phase === 'walk' || (S.phase === 'arrive' && t > 0.9 && t < 1.6) }, 1.4);
    if (S.phase === 'walk') {
      const k = ease(t / T_WALK), gy = src.y;
      const x = S.start.x + (src.grate.x - S.start.x) * k, z = S.start.z + (src.grate.z - S.start.z) * k;
      const toward = Math.atan2(src.grate.x - S.start.x, src.grate.z - S.start.z);
      const yaw = k < 0.6 ? lerpAng(S.start.yaw, toward, Math.min(1, t * 4)) : lerpAng(toward, src.rotY, ease((k - 0.6) / 0.4));
      placeHarry(x, gy, z, yaw, S.scale0); camOn(src, dt);
      if (t >= T_WALK) setPhase('throw');
    } else if (S.phase === 'throw') {
      placeHarry(src.grate.x, src.y, src.grate.z, src.rotY, S.scale0); camOn(src, dt);
      if (!S.thrown && t > 0.15) {
        S.thrown = true; const label = BYID[S.to].label;
        say('!' + label, 2.6); speak('!' + label); sfx('whoosh');
        // a pinch of glittering powder from Harry's hand down into the flames
        const fx = src.front[0], fz = src.front[1], hx = src.grate.x + fx * 0.35 + fz * 0.25, hz = src.grate.z + fz * 0.35 - fx * 0.25;
        for (let i = 0; i < 16; i++) emit(0, hx, src.y + 1.25, hz, -fx * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.5, 0.9 + Math.random() * 0.8, -fz * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.5, 0.8 + Math.random() * 0.4, 0.07 + Math.random() * 0.05, 0.6, 1.5, 0.8);
        // a dead hearth lights first: the powder relights it (no dead ends)
        if (S.from === 'commonroom') { try { const R = freecast && freecast.real; if (R && R.fireLit && R.fireLit() === false && R.relight && R.relight()) { log.relights++; log.lastTrip.relit = true; } } catch { /* ok */ } }
      }
      if (t >= T_THROW) { setPhase('burst'); S.thrown = false; sfx('noise', 1.4, 0.22, 0, 600, 0.5); sfx('poof'); }
    } else if (S.phase === 'burst') {
      const k = t / T_BURST, lift = ease((k - 0.55) / 0.45);
      src.k.green = Math.min(1, src.k.green + dt * 6); src.k.roar = Math.min(1, ease(k * 3)) * (0.85 + 0.15 * Math.sin(S.vt * 9));
      S.spun += dt * (4 + 26 * k * k);
      placeHarry(src.grate.x, src.y + lift * 1.6, src.grate.z, src.rotY + S.spun, S.scale0 * (1 - lift * 0.85));
      camOn(src, dt, 5.4 - k * 0.6);
      if (Math.random() < dt * 30) sparkleRing(src, src.y + 0.1 + k * 1.2, 3);
      if (Math.random() < dt * 22) flameBurst(src, src.y, 2);
      tunnel(ease((k - 0.75) / 0.25), S.vt, 0);
      if (t >= T_BURST) { setPhase('transit'); S.ready = false; travel(); sfx('noise', 2.2, 0.12, 0, 900, 0.4); }
    } else if (S.phase === 'transit') {
      player.model.visible = false;
      tunnel(1, S.vt, 0);
      if (src && src.k) { src.k.green = 1; src.k.roar = 0.6; }
      if (S.ready && t >= T_TRANSIT) {
        if (src && src.k) { src.k.green = 0; src.k.roar = 0; }
        if (!dst || S.err) { finish(true); return; }
        setPhase('arrive'); S.landed = false; dst.k.green = 1; dst.k.roar = 0.8; sfx('whoosh');
      }
    } else if (S.phase === 'arrive') {
      player.model.visible = true;
      const fade = 1 - ease(t / 0.45), spinK = Math.max(0, 1 - t / 0.7), drop = ease(Math.min(1, t / 0.7));
      tunnel(fade, S.vt, fade * 0.9);
      S.spun += dt * 24 * spinK;
      let x = dst.grate.x, z = dst.grate.z, sc = S.scale0 * (0.25 + 0.75 * drop), y = dst.y + (1 - drop) * 1.2, yaw = dst.rotY + S.spun * spinK;
      if (t > 0.7 && !S.landed) { S.landed = true; sootPuff(dst, dst.y); sfx('poof'); }
      if (t > 0.9) { const k = ease((t - 0.9) / 0.7); x = dst.grate.x + (dst.arrive.x - dst.grate.x) * k; z = dst.grate.z + (dst.arrive.z - dst.grate.z) * k; yaw = dst.rotY; }
      placeHarry(x, y, z, yaw, sc);
      dst.k.green = t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 1.5); dst.k.roar = Math.max(0, 0.8 - t * 0.6);
      if (Math.random() < dt * 20 * spinK) sparkleRing(dst, dst.y + 0.2, 2, 0.7);
      camOn(dst, dt, 5.6, 0.45, 0.12);
      if (t >= T_ARRIVE) finish(false);
    }
  }
  function finish(failed) {
    tunnel(0, 0, 0);
    const d = failed ? null : S.dst;
    if (d) { placeHarry(d.arrive.x, d.y, d.arrive.z, d.rotY, S.scale0); try { player.teleport(d.arrive.x, d.arrive.z); } catch { /* ok */ } }
    else { player.model.scale.setScalar(S.scale0); player.model.visible = true; }
    player.model.visible = true;
    try { player.cam.reset(player.yaw); player.cam.yaw += 0.55; player.cam.pitch = 0.22; } catch { /* ok */ }
    document.body.classList.remove('inFloo'); setTakeover(null);
    if (log.lastTrip) log.lastTrip.ms = Math.round(performance.now() - log.lastTrip.t0);
    S.phase = 'idle'; S.pt = 0; S.from = null;
    if (!failed) { S.soot = T_SOOT; S.cough = 0.9; S.sootPuff = 0; S.arrivedAt = S.to; } else S.arrivedAt = null;
    S.dstKeep = d;   // keep fading its green after control returns
  }

  // ---------------- per frame ----------------
  const offerNear = { id: null, d: 99 };
  function near() {
    offerNear.id = null; offerNear.d = 99;
    const f = hereInfo(); if (!f) return offerNear;
    const fx = f.front[0], fz = f.front[1], cx = f.x + fx * (f.depth + 0.6), cz = f.z + fz * (f.depth + 0.6);
    const dx = player.pos.x - cx, dz = player.pos.z - cz, d = Math.hypot(dx, dz);
    if (d > 3.2) return offerNear;
    const facing = Math.sin(player.yaw) * -dx + Math.cos(player.yaw) * -dz;   // > 0: Harry looks toward the hearth
    if (facing < 0 && d > 1.6) return offerNear;
    offerNear.id = hereId(); offerNear.d = d; return offerNear;
  }
  const busyBody = () => { const c = document.body.classList; return c.contains('inSpell') || c.contains('inMatch') || c.contains('modalOn'); };
  let T = 0;
  function update(dt, inside) {
    T += dt;
    // the hut hearth: shown on the grounds within 70 m
    if (hut) {
      const on = !inside && Math.hypot(player.pos.x - hut.info.x, player.pos.z - hut.info.z) < 70;
      if (on !== hut.shown) { hut.shown = on; hut.root.visible = on; }
      if (on) tickHearth(hut.info, T, hut.info.k);
    }
    const f = inside ? hereInfo() : null;
    if (f && !f.selfDriven && f.fireMat) tickHearth(f, T, f.k);
    // after a trip: the destination fire finishes fading to orange; the sooty face and the sneeze
    const dk = S.dstKeep;
    if (S.phase === 'idle' && dk && dk.k) { dk.k.green = Math.max(0, dk.k.green - dt / 1.2); dk.k.roar = Math.max(0, dk.k.roar - dt); if (dk.k.green <= 0 && dk.k.roar <= 0) S.dstKeep = null; }
    if (S.soot > 0) {
      S.soot -= dt; S.sootPuff -= dt;
      if (S.sootPuff <= 0) { S.sootPuff = 0.45; const s = player.model.scale.y || 1; emit(2, player.pos.x + (Math.random() - 0.5) * 0.3, player.pos.y + 1.9 * s, player.pos.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.5, (Math.random() - 0.5) * 0.3, 1.2, 0.22, 0.3, 0.29, 0.28, 1.2); }
      if (S.cough > 0) { S.cough -= dt; if (S.cough <= 0) { say("!אפצ'י", 1.8); sfx('poof'); sfx('tone', 520, 0.12, 'triangle', 0.08, 0, 300); } }
      setSoot(S.soot > 0 ? Math.min(1, S.soot / 1.2) : 0);
    }
    // the 🔥 prompt
    if (S.phase === 'idle' && !pickOpen && !isModal() && !isTakeover() && !busyBody()) {
      const n = near();
      if (n.id) { fun.offer('floo', '🔥', n.d, open); log.offers++; }
      // a few idle glints over the powder pot when you are near
      if (n.id && Math.random() < dt * 5) { const h = hereInfo(); if (h && h.pot) emit(0, h.pot.x + (Math.random() - 0.5) * 0.2, h.y + h.pot.y - 0.05, h.pot.z + (Math.random() - 0.5) * 0.2, 0, 0.5 + Math.random() * 0.4, 0, 0.8, 0.06 + Math.random() * 0.05, 0.5, 1.5, 0.8); }
    }
    tickParticles(dt);
  }

  // ---------------- a sooty face (two dark smudges on Harry's cheeks, found by the head bone) ----------------
  let soot = null;
  function setSoot(k) {
    try {
      if (!soot) {
        let head = null; player.model.traverse(o => { if (!head && o.isBone && /head$/i.test(o.name)) head = o; });
        if (!head) { soot = { none: true }; return; }
        const geo = new PlaneGeometry(1, 1), mat = new MeshBasicMaterial({ color: 0x2a2624, transparent: true, opacity: 0.0, depthWrite: false, map: tex });
        const grp = new Object3D(); grp.name = 'floo-soot';
        const m = new InstancedMesh(geo, mat, 3); m.frustumCulled = false;
        const d = new Object3D(); [[0.045, 0.06, 0.095], [-0.045, 0.06, 0.095], [0.0, 0.12, 0.1]].forEach(([x, y, z], i) => { d.position.set(x, y, z); d.scale.setScalar(i === 2 ? 0.07 : 0.055); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
        grp.add(m); head.add(grp);
        // the bone may be in centimetres (Mixamo): undo its world scale so the smudges are real-size
        head.updateMatrixWorld(true); const ws = new Vector3(); head.getWorldScale(ws); const mk = player.model.scale.x || 1;
        grp.scale.setScalar(ws.x > 0 ? (1.3 * mk) / ws.x : 1);
        soot = { grp, mat };
      }
      if (soot.none) return;
      soot.mat.opacity = 0.75 * k; soot.grp.visible = k > 0.01;
    } catch { soot = { none: true }; }
  }

  const api = {
    list: () => FLOO.map(f => ({ id: f.id, label: f.label, ico: f.ico, room: f.room })),
    places: () => {
      const out = {}; if (hut) out.hut = { x: +hut.info.x.toFixed(2), z: +hut.info.z.toFixed(2), rotY: +hut.info.rotY.toFixed(3), arrive: hut.info.arrive, grate: hut.info.grate };
      const f = interiors.active && hereInfo(); if (f) out[f.id] = { x: f.x, z: f.z, rotY: +f.rotY.toFixed(3), arrive: f.arrive, grate: f.grate };
      return out;
    },
    near: () => { const n = near(); return { id: n.id, d: +n.d.toFixed(2), prompt: fun.promptId ? fun.promptId() : null }; },
    open, close, go,
    hold: (p, at = 0) => { S.hold = p || null; S.holdAt = at; return S.hold; },   // freeze a phase's clock at `at` s (screenshots at 2-4 fps); visuals keep moving
    release: () => { S.hold = null; return true; },
    state: () => ({
      phase: S.phase, t: +S.pt.toFixed(2), from: S.from, to: S.to, ready: S.ready, err: S.err, hold: S.hold, pickOpen, here: hereId(),
      soot: +S.soot.toFixed(2), particles: alive, trips: log.trips, relights: log.relights, opens: log.opens, offers: log.offers, spoken: log.spoken.slice(), lastTrip: log.lastTrip,
      arrivedAt: S.arrivedAt || null, tunnel: tc.style.display === 'block', errors: log.errors,
      green: (() => { const f = hereInfo(); return f && f.k ? +f.k.green.toFixed(2) : null; })(),
    }),
    hutInfo: () => (hut ? { x: hut.info.x, z: hut.info.z, rotY: hut.info.rotY, collider: hut.info.collider } : null),
  };
  return { update, api };
}
