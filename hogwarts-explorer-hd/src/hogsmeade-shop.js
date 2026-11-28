// Hogsmeade milestone 4 (briefs/2026-11-28-hogsmeade-m4-decisions.md): the shared framework of the enterable shops.
// A shop module calls registerShop(def): def = { id ('b3zonko'), key ('zonko', the street sidecar door key), model, node,
// frame { x0, x1, z0, z1, h }, door { x, w, h }, light {roomLight opts}, cols [colliders], cam { yaw, pitch, dist },
// fallback(g) -> builds the code-built room (stays as the fallback; its meshes are named in def.codeBuilt), signs [..],
// attach(R) (toys / people), tick(R, dt), taps(R) -> [{ id, w(out) world point, r?, spot {x, z, yaw}, fn() }], state(R) }.
// The room: light, the invisible shell (the lens's collision proxy, as in Honeydukes), wall colliders + the layout's
// colliders, the exit door (walking into it or tapping it returns to the street at that shop's door spot), tap-to-walk,
// the lazy interior model (timeout, any failure = the code-built room stays). Free play only. Debug: __game.hogsmeade.shop().
import { Group, Mesh, BoxGeometry, PlaneGeometry, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, BackSide, Vector3 } from 'three';
import { BUILDERS, FLOOR_Y } from './rooms.js';
import { loadModel, modelInfo } from './models.js';
import { roomLight, triCount, drawCount, place, FONT } from './adventure-b3-map-build.js';
import { signBoard, signText } from './hogsmeade-signs.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DOORS = { zonko: { x: 12.7, z: 5.35 }, broomsticks: { x: 18.0, z: 10.6 } };   // (the v2 sidecar's door spots: only a default)
const LAMP_MAX = 1.1, LOAD_MS = 30000;
const MIN_DIST = 1.3;   // the lens may come this close inside the small shops (camera.js: 2.2, which pushed it through the walls; Harry fades from MIN_DIST + 1.2)
const ST = { defs: {}, cur: null, tap: false, going: false, paid: {}, back: {}, errors: 0, lastErr: '', enters: 0, leaves: 0, last: '' };
const _v = new Vector3();
const G = () => window.__game;
const warn = (what, e) => { ST.errors++; ST.lastErr = what + ': ' + String(e && e.message || e); if (ST.errors < 6) console.warn('[hm-shop]', what, '-', String(e && e.message || e)); };
export function shopBusy() {
  const c = document.body.classList;
  if (c.contains('inSpell') || c.contains('inMatch') || c.contains('inFloo') || c.contains('inAdv') || c.contains('modalOn') || c.contains('mmOn') || c.contains('advBus')) return true;
  try { if (G().takeover || G().adventures.state().quest) return true; } catch { /* ok */ }
  return false;
}
export const roomY = () => { try { const r = G().interiors.room; return r && r.group ? r.group.position.y : FLOOR_Y; } catch { return FLOOR_Y; } };
export function say(pos, text, sec = 3.2) { ST.last = text; try { window.HPFun.say(pos, text, sec); } catch { /* ok */ } }
export function sayHarry(text, sec = 3.2) { const p = G().player.pos; say(_v.set(p.x, p.y + 2.2, p.z), text, sec); }
export const fx = (k, ...a) => { try { const fi = G().freecast && G().freecast._internal; if (fi && fi[k]) fi[k](...a); } catch { /* ok */ } };
export const sfx = (k, ...a) => { try { const s = window.HPFun && window.HPFun.sfx; if (s && s[k]) s[k](...a); } catch { /* no audio */ } };
// the small free-play reward (the Honeydukes sweets' +5), once per session per kind
export function reward(kind) {
  if (ST.paid[kind]) return false; ST.paid[kind] = true;
  try { window.HPLessons.progress.bonus(5); } catch { /* lessons not loaded */ }
  setTimeout(() => { try { window.HPFun.toast('✨⭐', '+5 נקודות לבית!', 1600); } catch { /* ok */ } }, 900);
  return true;
}
// Harry's head (the rigged hero's head bone, else the top of his bounding box), in world space: hats, the foam moustache
let _hb = null, _hbOf = null, _hy = 1.7;
export function headAt(out) {
  const pl = G().player;
  if (_hbOf !== pl.model.children.length) { _hbOf = pl.model.children.length; _hb = null; try { pl.model.traverse(o => { if (!_hb && o.isBone && /head$/i.test(o.name) && !/top|end/i.test(o.name)) _hb = o; }); } catch { /* ok */ } }
  if (_hb && _hb.parent) { _hb.getWorldPosition(out); return out; }
  return out.set(pl.pos.x, pl.pos.y + _hy - 0.2, pl.pos.z);
}
export function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; }
const quiet = (o) => { o.frustumCulled = false; o.raycast = () => {}; return o; };

// ---------------- signs: ONE atlas per room, one mesh ----------------
// list: [{ text, w, h (metres), x, y, z, ry, kind: 'board' | 'chalk', px }]: stacked rows of a 1024-wide canvas
function buildSigns(list) {
  const AW = 1024, scale = list.map(s => Math.min(AW / s.w, 220 / s.h)), rh = list.map((s, i) => Math.round(s.h * scale[i])), rw = list.map((s, i) => Math.round(s.w * scale[i]));
  const AH = rh.reduce((a, b) => a + b + 4, 0);
  let y = 0; const R = [];
  const tex = canvasTex(AW, AH, (x) => {
    list.forEach((s, i) => {
      const r = { x: 0, y, w: rw[i], h: rh[i] }; R.push(r); y += rh[i] + 4;
      if (s.kind === 'chalk') { x.fillStyle = '#5a3a22'; x.fillRect(r.x, r.y, r.w, r.h); x.fillStyle = '#26302a'; x.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20); x.save(); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold ' + (s.px || 64) + 'px ' + FONT; x.fillStyle = '#ece6d4'; x.fillText(s.text, r.x + r.w / 2, r.y + r.h / 2 + 3); x.restore(); }
      else { signBoard(x, r, s.base || '#40281a', s.dark || '#2e1c10', i + 3); if (s.deco) s.deco(x, r); signText(x, s.text, r.x + r.w / 2, r.y + r.h / 2 + 4, r.w - (s.pad || 80), s.px || 84); }
    });
  });
  const geos = list.map((s, i) => { const r = R[i], g = new PlaneGeometry(s.w, s.h), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (r.x + uv.getX(k) * r.w) / AW, 1 - (r.y + (1 - uv.getY(k)) * r.h) / AH);
    return place(g, s.x, s.y, s.z, 0, s.ry || 0, 0); });
  const m = quiet(new Mesh(mergeGeometries(geos.map(q => q.toNonIndexed()), false), new MeshBasicMaterial({ map: tex, color: 0xd8d0c0 }))); m.name = 'shop-signs';
  return m;
}

// ---------------- registering a shop: its room builder ----------------
export function registerShop(def) {
  ST.defs[def.key] = def;
  BUILDERS[def.id] = async () => {
    const F = def.frame, g = new Group(); g.name = def.id; g.position.y = FLOOR_Y;
    const L = roomLight(g, def.light);
    const R = { def, g, L, T: 0, state: 'loading', armed: false, walk: null, model: null, torn: false, tris: 0, draws: 0, framed: false };
    try { def.fallback(g, R); } catch (e) { warn('fallback room', e); }
    // the shell: the lens stops on it (its material is never drawn); 0.18 m inside the walls
    const k = 0.18, shell = new Mesh(new BoxGeometry(F.x1 - F.x0 - 2 * k, F.h - 0.1, F.z1 - F.z0 - 2 * k), new MeshBasicMaterial({ side: BackSide }));
    shell.material.visible = false; shell.name = 'shop-shell'; shell.position.set((F.x0 + F.x1) / 2, (F.h - 0.1) / 2, (F.z0 + F.z1) / 2); g.add(shell);
    try { g.add(buildSigns(def.signs.concat([{ text: 'לרחוב 🏘️', w: 1.1, h: 0.41, x: def.door.x, y: def.door.h + 0.42, z: F.z0 + 0.09, ry: 0, base: '#3a5a48', dark: '#2a4636', px: 120, pad: 60 }]))); } catch (e) { warn('signs', e); }
    const W = 0.5, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2, hw = (F.x1 - F.x0) / 2 + W, hd = (F.z1 - F.z0) / 2 + W;
    const cols = [{ type: 'box', x: F.x0 - W / 2, z: cz, hw: W / 2, hd, angle: 0 }, { type: 'box', x: F.x1 + W / 2, z: cz, hw: W / 2, hd, angle: 0 },
      { type: 'box', x: cx, z: F.z0 - W / 2, hw, hd: W / 2, angle: 0 }, { type: 'box', x: cx, z: F.z1 + W / 2, hw, hd: W / 2, angle: 0 }];
    for (const c of def.cols) cols.push({ angle: 0, ...c });
    R.cols = cols;
    try { def.attach && def.attach(R); } catch (e) { warn('attach', e); }
    const marker = g.children.find(o => o.name === 'b3-light');
    if (marker) { const r0 = marker.userData.onTeardown; marker.userData.onTeardown = () => { try { r0 && r0(); } finally { R.torn = true; stopWalk(R, false); if (R.minDist0 !== undefined) { try { G().player.cam.minDist = R.minDist0; } catch { /* ok */ } } if (ST.cur === R) ST.cur = null; try { def.teardown && def.teardown(R); } catch { /* ok */ } } }; }
    ST.cur = R; ST.enters++;
    attachModel(R);
    installTap();
    R.tris = triCount(g);
    const sp = { x: def.door.x, z: F.z0 + 1.6, y: FLOOR_Y, yaw: 0 };
    return { group: g, colliders: cols, portals: [], spawn: sp, update(dt) { try { tick(R, dt); } catch (e) { warn('tick', e); } } };
  };
}
function attachModel(R) {
  const def = R.def;
  const timeout = new Promise(res => setTimeout(() => res(null), LOAD_MS));
  (async () => { let info = null; try { info = await modelInfo(def.model); } catch { info = null; } if (!info || !info.file) { R.reason = 'not in models.json'; return null; } return Promise.race([loadModel(def.model), timeout]); })()
    .then(model => { if (R.torn) return; if (!model) { R.state = 'fallback'; return; } applyModel(R, model); })
    .catch(e => { if (!R.torn) { R.state = 'fallback'; warn('interior model failed, keeping the code-built room', e); } });
}
function applyModel(R, model) {
  try {
    model.traverse(o => {
      if (!o.isMesh) return;
      o.userData.sharedGeo = true; o.raycast = () => {};
      for (const m of [].concat(o.material)) if (m && !m.vertexColors && o.geometry && o.geometry.attributes.color) { m.vertexColors = true; m.needsUpdate = true; }
      for (const m of [].concat(o.material)) if (m && /^EMI_/.test(m.name || '') && !m.userData.hiLamp) { m.userData.hiLamp = true; m.emissiveIntensity = Math.min(m.emissiveIntensity || 1, LAMP_MAX); }
    });
    model.name = 'shop-interior-model'; R.g.add(model);
    for (const n of R.def.codeBuilt) { const o = R.g.getObjectByName(n); if (o) o.visible = false; }
    R.model = model; R.state = 'model'; R.tris = triCount(model); R.draws = drawCount(model);
    try { R.def.onModel && R.def.onModel(R); } catch { /* ok */ }
  } catch (e) {
    warn('interior model apply failed', e);
    try { if (model.parent) model.parent.remove(model); } catch { /* ok */ }
    for (const n of R.def.codeBuilt) { const o = R.g.getObjectByName(n); if (o) o.visible = true; }
    R.state = 'fallback';
  }
}

// ---------------- per frame: light, the first framing, the exit door, Harry walking himself ----------------
function tick(R, dt) {
  R.L.apply(); R.T += dt;
  const g = G(), def = R.def, F = def.frame, p = g.player.pos;
  if (!R.framed) { R.framed = true; try { const C = g.player.cam, ph = innerWidth / innerHeight < 0.8, c = def.cam; if (R.minDist0 === undefined) { R.minDist0 = C.minDist; C.minDist = MIN_DIST; } C.yaw = c.yaw; C.pitch = ph ? c.pitch + 0.04 : c.pitch; C.dist = ph ? c.dist * 0.9 : c.dist; C.userControlled = false; } catch { /* ok */ } }
  const busy = shopBusy();
  if (R.walk) walkTick(R, dt, busy);
  const d = Math.hypot(p.x - def.door.x, p.z - (F.z0 + 0.45));
  if (d > 1.7) R.armed = true;
  if (R.armed && d < 0.5 && !R.walk) { R.armed = false; leave(); }
  if (def.tick) def.tick(R, dt, busy);
}
export function walkTo(R, spot, fn) {
  stopWalk(R, false);
  const p = G().player.pos;
  if (Math.hypot(spot.x - p.x, spot.z - p.z) < 0.5) { try { if (spot.yaw !== undefined) G().player.yaw = spot.yaw; } catch { /* ok */ } if (fn) fn(); return; }
  R.walk = { ...spot, fn, t: 0, best: 1e9, still: 0 };
}
function stopWalk(R, arrived) {
  const W = R.walk; if (!W) return; R.walk = null;
  try { G().walk(0, 0); } catch { /* ok */ }
  if (arrived) { try { if (W.yaw !== undefined) G().player.yaw = W.yaw; } catch { /* ok */ } if (W.fn) try { W.fn(); } catch (e) { warn('tap action', e); } }
}
function walkTick(R, dt, busy) {
  const W = R.walk; if (busy) { stopWalk(R, false); return; }
  const g = G(), p = g.player.pos, dx = W.x - p.x, dz = W.z - p.z, d = Math.hypot(dx, dz);
  W.t += dt; if (d < W.best - 0.05) { W.best = d; W.still = 0; } else W.still += dt;
  if (d < 0.4 || W.still > 1.6 || W.t > 12) { stopWalk(R, true); return; }
  const cy = g.player.cam.yaw, nx = dx / d, nz = dz / d, k = Math.min(1, 0.35 + d / 2.2);
  const fx0 = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
  g.walk((nx * rx + nz * rz) * k, (nx * fx0 + nz * fz) * k);
}

// ---------------- in and out ----------------
function fadeIn() {
  let d = document.getElementById('hmShopFade');
  if (!d) { d = document.createElement('div'); d.id = 'hmShopFade'; d.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;background:radial-gradient(ellipse at 50% 60%,#fff6e4,#d8b888);opacity:0'; document.body.appendChild(d); }
  d.style.transition = 'none'; d.style.opacity = '1'; void d.offsetWidth; d.style.transition = 'opacity 1.1s'; setTimeout(() => { d.style.opacity = '0'; }, 250);
}
// from the street (after the M2 bubble): spot = that shop's door spot on the street (where Harry comes back out)
export function enterShop(key, spot) {
  const def = ST.defs[key]; if (!def || ST.going || shopBusy()) return false;
  ST.going = true; setTimeout(() => { ST.going = false; }, 2500);
  const d = spot || DOORS[key]; ST.back[key] = { x: d.x, z: d.z, yaw: d.z > 8.5 ? Math.PI : 0 };
  fadeIn(); try { G().interiors.enter(def.id, null); } catch (e) { warn('enter shop', e); return false; }
  return true;
}
export function leave() {
  const R = ST.cur; if (!R || ST.going) return false; const key = R.def.key;
  ST.going = true; setTimeout(() => { ST.going = false; }, 2500); ST.leaves++;
  const b = ST.back[key] || { ...DOORS[key], yaw: DOORS[key].z > 8.5 ? Math.PI : 0 };
  fadeIn(); try { G().interiors.enter('b3hogsmeade', { x: b.x, z: b.z, yaw: b.yaw }); } catch (e) { warn('leave shop', e); return false; }
  return true;
}

// ---------------- taps (free play): the exit door + the shop's own tappables; Harry walks next to it first ----------------
export const tapR = () => Math.max(46, Math.min(innerWidth, innerHeight) * 0.08) * 1.6;
function tappables(R) {
  const F = R.def.frame, list = [{ id: 'door', w: (o) => o.set(R.def.door.x, roomY() + 1.2, F.z0 + 0.1), spot: null, fn: () => leave() }];
  try { for (const t of R.def.taps(R)) list.push(t); } catch (e) { warn('taps', e); }
  return list;
}
export function tapAt(x, y) {
  const R = ST.cur; if (!R || R.torn || shopBusy()) return null;
  const c = G().adventures && G().adventures._ctx; if (!c) return null;
  let best = null, bd = 1e9;
  for (const t of tappables(R)) {
    if (t.on && !t.on()) continue;
    const s = c.screen(t.w(_v)); if (!s.on) continue;
    const d = Math.hypot(s.x - x, s.y - y) / (t.r || 1); if (d < bd) { bd = d; best = t; }
  }
  if (!best || bd > tapR()) return null;
  if (best.spot) walkTo(R, best.spot, best.fn); else best.fn();
  return best.id;
}
function installTap() {
  if (ST.tap) return; const view = document.getElementById('view'); if (!view) return;
  ST.tap = true; let down = null;
  view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; if (ST.cur && ST.cur.walk) stopWalk(ST.cur, false); }, { passive: true });
  view.addEventListener('pointerup', (e) => {
    const d0 = down; down = null;
    try {
      if (!d0 || d0.id !== e.pointerId || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 18 || performance.now() - d0.t > 900) return;
      const R = ST.cur; if (!R || G().interiors.active !== R.def.id) return;
      ST.lastTap = tapAt(e.clientX, e.clientY);
    } catch { /* never break the game's own taps */ }
  }, { passive: true });
}

// ---------------- debug: __game.hogsmeade.shop() ----------------
export const SHOP_API = {
  state: () => {
    const R = ST.cur, g = G(), on = !!(R && g && g.interiors.active === R.def.id);
    const out = { room: g && g.interiors ? g.interiors.active : null, shop: on ? R.def.key : null, interior: on ? R.state : null, reason: R ? R.reason || '' : '',
      draws: on ? drawCount(R.g) : 0, tris: on ? triCount(R.g) : 0, modelTris: R ? R.tris : 0, modelDraws: R ? R.draws : 0,
      walking: !!(R && R.walk), enters: ST.enters, leaves: ST.leaves, paid: { ...ST.paid }, lastBubble: ST.last, lastTap: ST.lastTap || null, busy: shopBusy(), errors: ST.errors, lastErr: ST.lastErr };
    try { if (on && R.def.state) Object.assign(out, R.def.state(R)); } catch (e) { out.stateErr = String(e && e.message || e); }
    return out;
  },
  enter: (key) => enterShop(key, null),
  leave: () => leave(),
  tapW: (id) => { const R = ST.cur; if (!R) return null; const t = tappables(R).find(q => q.id === id); return t ? t.w(new Vector3()) : null; },
  ids: () => (ST.cur ? tappables(ST.cur).map(t => t.id) : []),
  cur: () => ST.cur,
};
