// Hogsmeade High Street, milestone 1 (briefs/2026-11-27-hogsmeade-film-look.md + 2026-11-27-hogsmeade-m1-decisions.md):
// one static street model, hm_street_01.glb (+ its sidecar hm_street_01.json: colliders, lanterns, windows, chimneys, signs,
// door, walk), authored in the Honeydukes room's own frame, shown in two ways and never both at once:
//  - 'window': behind the Honeydukes bow window in 'b3honey' (quest and free play): the house itself (Hm_Honeydukes_Body)
//    hidden, the street tinted cool so it reads blue-cold against the warm shop; the old painted card 'honey-street' stays
//    until the street is ready, and forever if it fails.
//  - 'street': the walkable interior 'b3hogsmeade' (free play only): colliders from the sidecar, dusk-cool light, warm windows,
//    lantern glow + light pools, chimney smoke, light falling snow (off on the LOW tier), one Filch strolling the far pavement.
// Ways in: a wooden door in the Honeydukes north wall (x 2.4; free play only: during the b3-map quest it only gives a kind
// bubble), and the travel-map card "הוגסמיד" 🏘️. Ways out: the shop door (x 3.6, z 4.8) back into Honeydukes, and 🏠.
// A missing / failed GLB is never fatal: the code-built fallback street (hogsmeade-street-build.js) takes its place.
// Hidden / inactive while an adventure (except the quest's own Honeydukes window), a lesson / course, Quidditch or the Floo runs.
// Debug: window.__game.hogsmeade / window.__b3hogsmeade: state(), doorW(), shopDoorW(), farW(), start(), home().
import { Group, Mesh, BoxGeometry, PlaneGeometry, MeshBasicMaterial, MeshStandardMaterial, Vector3, Matrix4, Quaternion, Color, AdditiveBlending } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { loadModel, modelInfo, MODELS_BASE } from './models.js';
import { roomLight, buildFilch, triCount, drawCount, place, paint, merge, softTex, FONT } from './adventure-b3-map-build.js';
import { fallbackStreet, buildSky, buildGlows, buildSmoke, buildSnow, buildSigns, canvasTex, quiet, PUFFS } from './hogsmeade-street-build.js';

export const HM_DOOR = { x: 2.4, z: -4.5 };                 // the door in the Honeydukes north wall (room frame)
const DOOR_SPOT = { x: 2.4, z: -3.95, r: 0.6 };             // where walking into it takes Harry out
export const HM_IN = { x: 2.4, z: -2.9, yaw: 0 };           // back inside the shop, by the north door, facing the counter / window
export const HM_OUT = { x: 3.6, z: 5.9, yaw: 0 };           // on the pavement in front of the shop door, facing the street (+z)
const SHOP_SPOT = { x: 3.6, z: 5.15, r: 0.55 };             // the shop door on the street
const FILCH_FAR = { z: 11.4, x0: -12, x1: 12 };
const QUEST_LINE = 'אחרי המשימה נצא לרחוב הוגסמיד 🏘️';
const SIDECAR = 'hm_street_01.json';

const ST = { promise: null, loaded: false, fallback: false, failed: null, mode: null, cur: null, errors: 0, lastErr: '', from: null, tap: false, emi: null, mats: [], visits: 0, door: null, bubbles: 0, going: false };
const _v = new Vector3(), _w = new Vector3(), _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), _c = new Color();
const warn = (what, e) => { ST.errors++; ST.lastErr = what + ': ' + String(e && e.message || e); if (ST.errors < 5) console.warn('[hogsmeade]', what, '-', String(e && e.message || e)); };
function freeBusy() {
  const c = document.body.classList;
  return c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || c.contains('inAdv') || c.contains('modalOn') || c.contains('mmOn') || c.contains('advBus') || !!(window.__game && window.__game.takeover);
}
const questOn = () => { try { return !!window.__game.adventures.state().quest; } catch { return false; } };
const tier = () => { try { return window.__game.stats().tier; } catch { return 'high'; } };
const G = () => window.__game;
const wrap = (v, a, s) => a + (((v - a) % s) + s) % s;

// ---------------- loading (once; a shared promise) ----------------
function withTimeout(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timed out after ' + ms / 1000 + ' s')), ms); })]).finally(() => clearTimeout(t)); }
export function loadStreet() {
  if (ST.promise) return ST.promise;
  ST.promise = (async () => {
    let info = null; try { info = await modelInfo('hm_street'); } catch { info = null; }
    if (info && info.file) {
      try {
        const v = info.v ? '?v=' + encodeURIComponent(info.v) : '';
        const [side, model] = await Promise.all([
          fetch(MODELS_BASE + (info.sidecar || SIDECAR) + v, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(new Error('sidecar HTTP ' + r.status)))),
          loadModel('hm_street'),
        ]);
        if (!model) throw new Error('the model did not load (see __game.models())');
        prepare(model);
        ST.loaded = true; ST.fallback = false;
        return { kind: 'glb', side };
      } catch (e) { ST.failed = String(e && e.message || e); warn('street model failed, using the code-built street', e); }
    } else ST.failed = 'not in models.json';
    ST.fallback = true;
    return { kind: 'fallback' };
  })();
  return ST.promise;
}
// once, on the shared (cached) materials: one shared warm window emissive, vertex colours on where COLOR_0 exists, raycast off
function prepare(model) {
  const seen = new Set();
  model.traverse(o => {
    if (!o.isMesh) return;
    const list = [].concat(o.material);
    for (let i = 0; i < list.length; i++) {
      let m = list[i]; if (!m) continue;
      if (/^EMI_Hm_Window_Warm/.test(m.name || '')) {
        if (!ST.emi) { ST.emi = m; if (m.emissive && m.emissive.getHex() === 0) m.emissive.setHex(0xffc870); m.emissiveIntensity = Math.max(1.2, m.emissiveIntensity || 1); m.toneMapped = true; }
        m = ST.emi; if (Array.isArray(o.material)) o.material[i] = m; else o.material = m;
      }
      if (o.geometry && o.geometry.attributes.color && !m.vertexColors) { m.vertexColors = true; m.needsUpdate = true; }
      if (!seen.has(m)) { seen.add(m); if (m.color && !m.userData.hmBase) m.userData.hmBase = m.color.getHex(); }
    }
  });
  ST.mats = [...seen];
}
const sourceMats = (root) => { const s = new Set(); root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) s.add(m); }); return [...s]; };
function tint(mats, hex) { _c.setHex(hex); for (const m of mats) { if (!m.color || /^EMI_/.test(m.name || '')) continue; if (m.userData.hmBase === undefined) m.userData.hmBase = m.color.getHex(); m.color.setHex(m.userData.hmBase).multiply(_c); } }

// ---------------- one street group for a mode ----------------
async function buildStreet(mode, src) {
  let root = null, side = null, kind = src.kind;
  if (kind === 'glb') {
    try {
      root = await loadModel('hm_street'); side = src.side;
      if (!root) throw new Error('clone failed');
      root.traverse(o => { if (o.isMesh) { o.userData.sharedGeo = true; o.raycast = () => {}; } });   // shared with the models.js cache: never disposed
    } catch (e) { warn('street clone failed', e); root = null; kind = 'fallback'; }
  }
  if (!root) { const F = fallbackStreet(); root = F.root; side = F.side; kind = 'fallback'; }
  side = Object.assign({ colliders: [], lanterns: [], windows: [], chimneys: [], signs: {}, walk: { x0: -30, x1: 30, z0: 4.8, z1: 12.2 } }, side || {});
  const g = new Group(); g.name = 'hm-street-' + mode; g.add(root);
  const body = root.getObjectByName('Hm_Honeydukes_Body'), bow = root.getObjectByName('Hm_Honeydukes_Bow');
  const mats = sourceMats(root);
  const S = { g, root, side, kind, mode, body, bow, mats, T: 0 };
  // dressing
  const sky = buildSky(); g.add(sky.g); S.sky = sky;
  const glows = buildGlows(side); g.add(glows.glows, glows.pools); S.glows = glows;
  const smoke = buildSmoke(side, mode === 'window' ? 6 : 10); g.add(smoke.mesh); S.smoke = smoke;
  const low = tier() === 'low';
  const nSnow = low ? 0 : mode === 'window' ? 90 : (tier() === 'medium' ? 140 : 220);
  const snow = buildSnow(nSnow); snow.mesh.visible = nSnow > 0; g.add(snow.mesh); S.snow = snow;
  if (low) smoke.mesh.visible = false;
  const signs = buildSigns(side); g.add(signs.g); S.signs = signs;
  if (mode === 'window') {
    if (body) body.visible = false;
    for (const k of ['honeydukes_fascia', 'honeydukes_hanging']) if (signs.out[k]) signs.out[k].visible = false;
    tint(mats, 0xb0c0ea);   // blue-cold outside against the warm shop (windows stay warm: emissive)
  } else {
    if (body) body.visible = true;
    tint(mats, 0xffffff);
    // colliders: building footprints, street ends, the walk box
    const cols = side.colliders.map(c => ({ type: 'box', x: c.x, z: c.z, hw: c.hw, hd: c.hd, angle: c.angle || 0 }));
    const w = side.walk;
    cols.push({ type: 'box', x: w.x0 - 0.5, z: (w.z0 + w.z1) / 2, hw: 0.5, hd: (w.z1 - w.z0) / 2 + 1, angle: 0 }, { type: 'box', x: w.x1 + 0.5, z: (w.z0 + w.z1) / 2, hw: 0.5, hd: (w.z1 - w.z0) / 2 + 1, angle: 0 });
    cols.push({ type: 'box', x: (w.x0 + w.x1) / 2, z: w.z0 - 0.5, hw: (w.x1 - w.x0) / 2 + 1, hd: 0.5, angle: 0 }, { type: 'box', x: (w.x0 + w.x1) / 2, z: w.z1 + 0.5, hw: (w.x1 - w.x0) / 2 + 1, hd: 0.5, angle: 0 });
    S.cols = cols;
    // the camera's spring arm stops on simple invisible boxes (not on the merged 70k-triangle street)
    const blk = new Group(); blk.name = 'hm-cam-blockers';
    const bm = new MeshBasicMaterial();
    for (const c of side.colliders) { const b = new Mesh(new BoxGeometry(c.hw * 2, 9, c.hd * 2), bm); b.position.set(c.x, 4.5, c.z); b.visible = false; blk.add(b); }
    // and two long walls just behind both rows of house fronts (from the walk box), so the lens never slips into a house
    const L = (w.x1 - w.x0) + 12;
    for (const [z, d] of [[w.z0 - 1.5, 3], [w.z1 + 1.5, 3]]) { const b = new Mesh(new BoxGeometry(L, 12, d), bm); b.position.set((w.x0 + w.x1) / 2, 6, z); b.visible = false; blk.add(b); }
    g.add(blk);
    // one Filch strolling the far pavement (he never reacts to spells; never two Filches)
    const F = buildFilch(); F.body.scale.setScalar(1.2); F.lantern.multiplyScalar(1.2); F.g.position.set(FILCH_FAR.x0, 0, FILCH_FAR.z); g.add(F.g); S.F = F; S.fx = -6; S.fdir = 1;
    S.fcol = { type: 'circle', x: S.fx, z: FILCH_FAR.z, r: 0.45 }; cols.push(S.fcol);
    S.flglow = quiet(new Mesh(new PlaneGeometry(1.1, 1.1), new MeshBasicMaterial({ map: softTex(), color: 0xffd070, transparent: true, depthWrite: false, blending: AdditiveBlending }))); S.flglow.name = 'hm-filch-glow'; g.add(S.flglow);
  }
  return S;
}

// per frame (both modes): glow cards face the camera, smoke rises, snow falls, Filch strolls (street)
function tickStreet(S, dt, roomGroup) {
  S.T += dt; const T = S.T, cam = G().camera;
  const ox = roomGroup.position.x, oy = roomGroup.position.y, oz = roomGroup.position.z;
  const cx = cam.position.x - ox, cy = cam.position.y - oy, cz = cam.position.z - oz;
  const Gl = S.glows, gm = Gl.glows;
  for (let i = 0; i < Gl.pts.length; i++) { const o = Gl.pts[i], k = o.s * (1 + Math.sin(T * 5 + i * 1.7) * 0.05); _m.compose(_v.set(o.p[0], o.p[1], o.p[2]), cam.quaternion, _s.set(k, k, k)); gm.setMatrixAt(i, _m); }
  gm.instanceMatrix.needsUpdate = true;
  const Sm = S.smoke;
  if (Sm.mesh.visible) {
    for (let i = 0; i < Sm.list.length; i++) for (let j = 0; j < PUFFS; j++) {
      const c = Sm.list[i], u = ((T * 0.22 + j / PUFFS + i * 0.37) % 1), k = (0.5 + u * 1.6) * Math.sin(Math.PI * Math.min(1, u * 1.15));
      _m.compose(_v.set(c[0] + Math.sin(T * 0.5 + i + j) * 0.25 + u * 0.8, c[1] + u * 3.2, c[2]), cam.quaternion, _s.set(k, k, k)); Sm.mesh.setMatrixAt(i * PUFFS + j, _m);
    }
    Sm.mesh.instanceMatrix.needsUpdate = true;
  }
  const Sn = S.snow;
  if (Sn.mesh.visible && Sn.n) {
    const win = S.mode === 'window';
    // window: a box just outside the glass; street: a box round the camera (flakes never right in front of the lens)
    const X0 = win ? -7 : cx - 10, XS = win ? 14 : 20, Y0 = 0, YS = win ? 6 : 8, Z0 = win ? 5.4 : cz - 10, ZS = win ? 9 : 20;
    for (let i = 0; i < Sn.n; i++) {
      const f = Sn.flakes[i];
      f.y -= f.v * dt / YS; if (f.y < 0) f.y += 1;
      const sway = Math.sin(T * 0.6 + f.ph) * 0.3;
      const x = (win ? X0 + f.x * XS : wrap(f.x * XS, X0, XS)) + sway, z = win ? Z0 + f.z * ZS : wrap(f.z * ZS, Z0, ZS);
      const y = Y0 + f.y * YS;
      const d = Math.hypot(x - cx, y - cy, z - cz), k = d < 1.8 ? 0.0001 : f.s;
      _m.compose(_v.set(x, y, z), cam.quaternion, _s.set(k, k, k)); Sn.mesh.setMatrixAt(i, _m);
    }
    Sn.mesh.instanceMatrix.needsUpdate = true;
  }
  if (S.F) {
    S.fx += S.fdir * 0.8 * dt;
    if (S.fx > FILCH_FAR.x1) S.fdir = -1; else if (S.fx < FILCH_FAR.x0) S.fdir = 1;
    const F = S.F; F.g.position.set(S.fx, Math.abs(Math.sin(T * 4.2)) * 0.03, FILCH_FAR.z); F.g.rotation.set(0, S.fdir > 0 ? 0 : Math.PI, Math.sin(T * 4.2) * 0.04);
    S.fcol.x = S.fx;
    F.g.updateMatrix(); _v.copy(F.lantern).applyMatrix4(F.g.matrix); S.flglow.position.copy(_v); S.flglow.quaternion.copy(cam.quaternion);
  }
}

// ---------------- the soft fade (cool dusk) ----------------
function fadeIn() {
  let d = document.getElementById('hmfade');
  if (!d) { d = document.createElement('div'); d.id = 'hmfade'; d.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;background:radial-gradient(ellipse at 50% 60%,#f4f0ff,#a8b4d8);opacity:0;transition:opacity .6s'; document.body.appendChild(d); }
  d.style.transition = 'none'; d.style.opacity = '1'; void d.offsetWidth; d.style.transition = 'opacity 1.1s'; setTimeout(() => { d.style.opacity = '0'; }, 250);
}
function goStreet(from) {
  if (ST.going) return false; ST.going = true; setTimeout(() => { ST.going = false; }, 2500);
  ST.from = from; fadeIn();
  try { G().interiors.enter('b3hogsmeade', { ...HM_OUT }); } catch (e) { warn('enter street', e); return false; }
  return true;
}
function goShop() {
  if (ST.going) return false; ST.going = true; setTimeout(() => { ST.going = false; }, 2500);
  fadeIn(); try { G().interiors.enter('b3honey', { ...HM_IN }); } catch (e) { warn('enter shop', e); return false; }
  return true;
}
function goHome() {
  const f = ST.from, I = G().interiors; ST.from = null; fadeIn();
  if (f && f.room && f.room !== 'b3hogsmeade') I.enter(f.room, { x: f.x, z: f.z, yaw: f.yaw });
  else { if (I.active) I.exit(); if (f) { G().player.yaw = f.yaw; G().player.teleport(f.x, f.z); } }
}
// the travel-map card "הוגסמיד" (free play; the same holds as the lake card)
export function startStreet() {
  const g = G(), A = g && g.adventures, base = A && A._ctx; if (!g || !base) return false;
  try { if (A.state().quest || base.isModal() || base.isTakeover() || freeBusy()) { base.fun.toast('🏘️', 'הוגסמיד יחכה לך אחר כך', 1800); return false; } } catch { return false; }
  if (g.interiors.active === 'b3hogsmeade') return true;
  return goStreet({ room: g.interiors.active || null, x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw });
}

// ---------------- Honeydukes: the north door (always there) + the street behind the window (when ready) ----------------
export function attachHoneyStreet(room, B) {
  const H = { room, B, S: null, torn: false, armed: false, bubbleT: 0 };
  try { addDoor(room, H); } catch (e) { warn('honey door', e); }
  const marker = room.group.children.find(o => o.name === 'b3-light');
  if (marker) { const r0 = marker.userData.onTeardown; marker.userData.onTeardown = () => { try { r0 && r0(); } finally { H.torn = true; if (ST.cur === H.S) { ST.cur = null; ST.mode = null; } if (ST.door === H) ST.door = null; } }; }
  ST.door = H;
  const up = room.update;
  room.update = (dt, t) => { if (up) up(dt, t); try { honeyTick(H, dt); } catch (e) { warn('honey tick', e); } };
  loadStreet().then(src => (H.torn ? null : buildStreet('window', src))).then(S => {
    if (!S || H.torn) return;
    room.group.add(S.g); H.S = S; ST.cur = S; ST.mode = 'window';
    const card = B.g.getObjectByName('honey-street'); if (card) card.visible = false;
  }).catch(e => warn('window street', e));
  installTap();
}
function addDoor(room, H) {
  const P = [], OAK = 0x6a4228, DK = 0x4a2e1a, x = HM_DOOR.x, z = HM_DOOR.z + 0.04;
  P.push(paint(place(new BoxGeometry(1.36, 2.36, 0.1), x, 1.18, z), 0x8a6a4a));                    // the frame
  P.push(paint(place(new BoxGeometry(1.1, 2.15, 0.08), x, 1.075, z + 0.05), OAK));                    // the door
  for (const dx of [-0.36, 0, 0.36]) P.push(paint(place(new BoxGeometry(0.02, 1.2, 0.01), x + dx * 0.9, 0.62, z + 0.095), DK));   // plank lines
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {                                           // small snowy panes
    const px = x - 0.3 + j * 0.3, py = 1.55 + i * 0.32;
    P.push(paint(place(new BoxGeometry(0.24, 0.26, 0.01), px, py, z + 0.096), 0xb8c8e4));
    P.push(paint(place(new BoxGeometry(0.24, 0.05, 0.012), px, py - 0.105, z + 0.098), 0xeef0f6));    // a little snow on each pane's sill
  }
  P.push(paint(place(new BoxGeometry(0.96, 0.05, 0.03), x, 1.38, z + 0.1), DK));
  P.push(paint(place(new BoxGeometry(0.08, 0.08, 0.06), x + 0.4, 1.02, z + 0.12), 0xd8b050));        // a brass knob
  const door = quiet(new Mesh(merge(P), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }))); door.name = 'hm-honey-door'; room.group.add(door);
  const t = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#3a5a48'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 18); c.fill(); c.strokeStyle = '#e8c860'; c.lineWidth = 5; c.stroke();
    c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 44px ' + FONT; c.fillStyle = '#fff0c0'; c.fillText('לרחוב 🏘️', w / 2, h / 2 + 3); });
  const sign = quiet(new Mesh(new PlaneGeometry(1.1, 0.41), new MeshBasicMaterial({ map: t, toneMapped: false, alphaTest: 0.5 }))); sign.name = 'hm-honey-door-sign'; sign.position.set(x, 2.62, z + 0.08); room.group.add(sign);
  H.door = door; H.sign = sign;
}
const doorW = (out = new Vector3()) => out.set(HM_DOOR.x, roomY() + 1.2, HM_DOOR.z + 0.1);
const shopW = (out = new Vector3()) => out.set(SHOP_SPOT.x, roomY() + 1.2, 4.85);
function roomY() { try { const r = G().interiors.room; return r && r.group ? r.group.position.y : FLOOR_Y; } catch { return FLOOR_Y; } }
function bubble(text) { ST.bubbles++; try { const p = G().player.pos; window.HPFun.say(_w.set(p.x, p.y + 2.2, p.z), text, 3.5); } catch { /* ok */ } }
function honeyTick(H, dt) {
  if (H.S) tickStreet(H.S, dt, H.room.group);
  const p = G().player.pos, d = Math.hypot(p.x - DOOR_SPOT.x, p.z - DOOR_SPOT.z);
  if (d > DOOR_SPOT.r + 1.2) H.armed = true;
  if (H.armed && d < DOOR_SPOT.r) {
    H.armed = false;
    if (questOn()) bubble(QUEST_LINE);
    else if (!freeBusy()) goStreet({ room: 'b3honey', x: HM_IN.x, z: HM_IN.z, yaw: HM_IN.yaw });
  }
}

// ---------------- the walkable street ----------------
BUILDERS.b3hogsmeade = async () => {
  let src; try { src = await withTimeout(loadStreet(), 40000); } catch (e) { warn('street load', e); src = { kind: 'fallback' }; }
  let S; try { S = await buildStreet('street', src); } catch (e) { warn('street build, using the code-built street', e); S = await buildStreet('street', { kind: 'fallback' }); }
  const g = new Group(); g.name = 'b3hogsmeade'; g.position.y = FLOOR_Y; g.add(S.g);
  const L = roomLight(g, { amb: 0.95, ambC: 0xdce4ff, hemi: 1.1, sky: 0xd0dcf8, ground: 0xa0a6bc, fogC: 0x9ea8cc, fogD: 0.009, bg: 0x8a96c0 });
  const R = { S, L, armed: false, btn: null, css: null };
  const marker = g.children.find(o => o.name === 'b3-light');
  if (marker) { const r0 = marker.userData.onTeardown; marker.userData.onTeardown = () => { try { r0 && r0(); } finally { dropButton(R); document.body.classList.remove('hmStreetOn'); if (ST.cur === S) { ST.cur = null; ST.mode = null; } } }; }
  document.body.classList.add('hmStreetOn');
  ST.cur = S; ST.mode = 'street'; ST.visits++;
  installTap();
  return {
    group: g, colliders: S.cols, portals: [], spawn: { x: HM_OUT.x, z: HM_OUT.z, y: FLOOR_Y, yaw: HM_OUT.yaw },
    update(dt) { try { streetTick(R, dt); } catch (e) { warn('street tick', e); } },
  };
};
function streetTick(R, dt) {
  R.L.apply();
  const g = G(), room = g.interiors.room; if (!room) return;
  if (!R.framed) { R.framed = true; try { const p = g.player, C = p.cam, ph = innerWidth / innerHeight < 0.8; C.yaw = p.yaw + Math.PI + (ph ? 0.25 : 0.5); C.pitch = ph ? 0.16 : 0.2; C.dist = ph ? 4.6 : 5.2; C.userControlled = false; } catch { /* ok */ } }
  tickStreet(R.S, dt, room.group);
  const busy = freeBusy() || questOn();
  if (!busy && !R.btn) makeButton(R); else if (busy && R.btn) dropButton(R);
  const p = g.player.pos, d = Math.hypot(p.x - SHOP_SPOT.x, p.z - SHOP_SPOT.z);
  if (d > SHOP_SPOT.r + 1.2) R.armed = true;
  if (R.armed && d < SHOP_SPOT.r && !busy) { R.armed = false; goShop(); }
}
function makeButton(R) {
  const back = document.createElement('button'); back.id = 'hmBack'; back.textContent = '🏠 חזרה'; back.setAttribute('aria-label', 'חזרה');
  const css = document.createElement('style'); css.id = 'hmBackCss';
  css.textContent = `#hmBack{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:15;padding:10px 26px;border-radius:24px;border:3px solid #ffd76a;
    background:rgba(40,60,120,.9);color:#ffe9a8;font:bold 24px ${FONT};cursor:pointer;touch-action:manipulation;box-shadow:0 4px 14px rgba(0,0,0,.45)}
    @media (max-width:560px){#hmBack{top:calc(132px + env(safe-area-inset-top));left:calc(14px + env(safe-area-inset-left));transform:none;width:78px;font-size:17px;line-height:1.2;padding:6px 4px;border-radius:18px}}`;
  document.head.appendChild(css); document.body.appendChild(back);
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) back.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  back.addEventListener('click', (e) => { e.stopPropagation(); goHome(); });
  R.btn = back; R.css = css;
}
function dropButton(R) { try { if (R.btn) R.btn.remove(); if (R.css) R.css.remove(); } catch { /* ok */ } R.btn = null; R.css = null; }

// taps: the Honeydukes north door (free play: out; quest: the kind bubble) and the shop door on the street
const tapR = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08) * 1.6;
function installTap() {
  if (ST.tap) return; const view = document.getElementById('view'); if (!view) return;
  ST.tap = true; let down = null;
  view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
  view.addEventListener('pointerup', (e) => {
    const d0 = down; down = null;
    try {
      if (!d0 || d0.id !== e.pointerId || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      const g = G(), c = g.adventures && g.adventures._ctx; if (!c) return;
      const act = g.interiors.active, p = g.player.pos;
      if (act === 'b3honey') {
        const s = c.screen(doorW(_v)); if (!s.on || Math.hypot(s.x - e.clientX, s.y - e.clientY) > tapR() || Math.hypot(p.x - HM_DOOR.x, p.z - HM_DOOR.z) > 9) return;
        if (questOn()) bubble(QUEST_LINE); else if (!freeBusy()) goStreet({ room: 'b3honey', x: HM_IN.x, z: HM_IN.z, yaw: HM_IN.yaw });
      } else if (act === 'b3hogsmeade') {
        if (freeBusy() || questOn()) return;
        const s = c.screen(shopW(_v)); if (!s.on || Math.hypot(s.x - e.clientX, s.y - e.clientY) > tapR() || Math.hypot(p.x - SHOP_SPOT.x, p.z - SHOP_SPOT.z) > 9) return;
        goShop();
      }
    } catch { /* never break the game's own taps */ }
  }, { passive: true });
}

// ---------------- debug ----------------
export const HM_API = {
  state: () => {
    const S = ST.cur, g = G();
    return {
      loaded: ST.loaded, fallback: ST.fallback, failed: ST.failed, mode: ST.mode, kind: S ? S.kind : null, room: g && g.interiors ? g.interiors.active : null,
      visible: S ? (() => { let v = !!S.g.parent; for (let o = S.g; o && v; o = o.parent) if (o.visible === false) v = false; return v; })() : false,
      bodyVisible: S && S.body ? S.body.visible : null, card: (() => { try { const c = g.interiors.room.group.getObjectByName('honey-street'); return c ? c.visible : null; } catch { return null; } })(),
      draws: S ? drawCount(S.g) : 0, tris: S ? triCount(S.g) : 0,
      lanterns: S ? S.side.lanterns.length : 0, windows: S ? S.side.windows.length : 0, chimneys: S ? S.smoke.list.length : 0,
      snow: S ? (S.snow.mesh.visible ? S.snow.n : 0) : 0, smoke: S ? S.smoke.mesh.visible : false, filch: S && S.F ? { x: +S.fx.toFixed(2), z: FILCH_FAR.z, visible: S.F.g.visible } : null,
      colliders: S && S.cols ? S.cols.length : 0, from: ST.from, visits: ST.visits, bubbles: ST.bubbles, busy: freeBusy(), quest: questOn(),
      door: ST.door ? { on: !!ST.door.door && !!ST.door.door.parent, armed: ST.door.armed } : null, button: !!document.getElementById('hmBack'),
      errors: ST.errors, lastErr: ST.lastErr,
    };
  },
  ready: () => loadStreet().then(() => HM_API.state()),
  doorW: () => doorW(new Vector3()),
  doorSpot: () => ({ ...DOOR_SPOT }),
  shopDoorW: () => shopW(new Vector3()),
  shopSpot: () => ({ ...SHOP_SPOT }),
  farW: () => new Vector3(0.0, roomY() + 2.0, 12.4),
  start: () => startStreet(),
  home: () => { goHome(); return true; },
  side: () => (ST.cur ? ST.cur.side : null),
};
window.__hmApi = HM_API;   // (main.js: window.__game.hogsmeade)
try { if (/[?&]debug=1/.test(location.search)) window.__b3hogsmeade = HM_API; } catch { /* ok */ }
