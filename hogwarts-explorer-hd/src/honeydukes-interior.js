// Hogsmeade milestone 2 (briefs/2026-11-27-hogsmeade-m2-decisions.md): the real Honeydukes interior model hm_honey_int_01.glb
// (one node 'Honey_Interior', authored in the room frame of buildHoney(): x -5.5..5.5, z -4.5..4.5, floor y 0) replaces the
// code-built shop's LOOK when 'b3honey' is built. It is loaded lazily (once; the models.js cache shares it between visits).
// On success the code-built visuals are switched off, never removed:
//  - 'honey-floor', 'honey-jars', 'honey-lamps': visible = false (none of them takes part in a raycast: raycast is a no-op on all three)
//  - 'honey-shell': its MATERIAL is switched off (material.visible = false), the mesh itself stays visible. The camera's spring
//    arm (camera.js _castArm: Raycaster.intersectObjects on the room group) ignores visibility, and the debug / liftables lens
//    framing (SpringCamera.frame) collects meshes with traverseVisible: a material switched off keeps BOTH exactly as before,
//    so the shell is the invisible collision proxy for the lens. The model's meshes never take a raycast.
// On any failure (not in models.json, HTTP error, decode error, timeout) nothing changes: the code-built shop stays.
// The colliders, the sweets, Filch, the glows, the signs and the north door are untouched (they live in buildHoney / the street).
// A rebuilt room is a fresh buildHoney(): the hidden state starts over by itself. Debug: window.__game.honeyInt.state()
// (also inside __game.hogsmeade.state().interior): { interior: 'model' | 'fallback' | 'loading' | null, tris, draws, ... }.
import { loadModel, modelInfo } from './models.js';
import { triCount, drawCount } from './adventure-b3-map-build.js';

const CODE_BUILT = ['honey-floor', 'honey-jars', 'honey-lamps'];
const SIGN_OFF = 0.06;   // the counter sign moves this far off the east wall (along its normal) in the 'model' state
const LAMP_MAX = 1.1;   // the model's EMI_Honey_Lamp comes with emissiveStrength 2.5: too much bloom beside the old 0.9 lamps
const ST = { cur: null, loads: 0, builds: 0, errors: 0, lastErr: '', reason: '' };
const warn = (what, e) => { ST.errors++; ST.lastErr = what + ': ' + String(e && e.message || e); if (ST.errors < 5) console.warn('[honey-interior]', what, '-', String(e && e.message || e)); };

let _src = null;   // one shared promise: is the model available at all? (resolves true / false, never rejects)
function available() {
  if (_src) return _src;
  _src = (async () => {
    let info = null; try { info = await modelInfo('hm_honey_int'); } catch { info = null; }
    if (!info || !info.file) { ST.reason = 'not in models.json'; return false; }
    return true;
  })();
  return _src;
}

export function attachHoneyInterior(room, B) {
  const H = { room, B, g: B.g, state: 'loading', model: null, torn: false, tris: 0, draws: 0 };
  ST.cur = H; ST.builds++;
  const marker = room.group.children.find(o => o.name === 'b3-light');
  if (marker) { const r0 = marker.userData.onTeardown; marker.userData.onTeardown = () => { try { r0 && r0(); } finally { H.torn = true; if (ST.cur === H) ST.cur = null; } }; }
  (async () => {
    if (!(await available())) return null;
    ST.loads++;
    return loadModel('hm_honey_int');   // null on a miss / failure (models.js logs why; __game.models())
  })().then(model => {
    if (H.torn) return;
    if (!model) { H.state = 'fallback'; if (!ST.reason) ST.reason = 'the model did not load (see __game.models())'; return; }
    apply(H, model);
  }).catch(e => { if (!H.torn) { H.state = 'fallback'; ST.reason = String(e && e.message || e); warn('interior model failed, keeping the code-built shop', e); } });
  return H;
}

function apply(H, model) {
  try {
    const root = model.getObjectByName('Honey_Interior') || model;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.userData.sharedGeo = true;   // shared with the models.js cache: never disposed by the room teardown
      o.raycast = () => {};          // the lens keeps stopping on the (invisible) code-built shell, exactly as before
      for (const m of [].concat(o.material)) if (m && !m.vertexColors && o.geometry && o.geometry.attributes.color) { m.vertexColors = true; m.needsUpdate = true; }   // COLOR_0 = baked AO + paint
      for (const m of [].concat(o.material)) if (m && /^EMI_/.test(m.name || '') && !m.userData.hiLamp) { m.userData.hiLamp = true; m.emissiveIntensity = Math.min(m.emissiveIntensity || 1, LAMP_MAX); }   // the globes glow, modestly (the old code lamps: 0.9)
    });
    model.name = 'honey-interior-model';
    H.g.add(model);
    for (const n of CODE_BUILT) { const o = H.g.getObjectByName(n); if (o) o.visible = false; }
    const shell = H.g.getObjectByName('honey-shell'); if (shell && shell.material) shell.material.visible = false;
    // the counter sign on the east wall: the model's cream picture rail stands proud of the plaster and cut through it; 6 cm off the wall
    const sign = H.g.getObjectByName('honey-sign'); if (sign && !sign.userData.hiMoved) { sign.userData.hiMoved = true; sign.position.x -= SIGN_OFF; }
    H.model = model; H.root = root; H.state = 'model';
    H.tris = triCount(model); H.draws = drawCount(model);
  } catch (e) {
    warn('interior model apply failed, keeping the code-built shop', e);
    try { if (model.parent) model.parent.remove(model); } catch { /* ok */ }
    restore(H); H.state = 'fallback';
  }
}
function restore(H) {
  const sign = H.g.getObjectByName('honey-sign'); if (sign && sign.userData.hiMoved) { sign.userData.hiMoved = false; sign.position.x += SIGN_OFF; }
  for (const n of CODE_BUILT) { const o = H.g.getObjectByName(n); if (o) o.visible = true; }
  const shell = H.g.getObjectByName('honey-shell'); if (shell && shell.material) shell.material.visible = true;
}

export const HONEY_INT_API = {
  state: () => {
    const H = ST.cur; const g = H && H.g;
    const shell = g ? g.getObjectByName('honey-shell') : null;
    return {
      interior: H ? H.state : null, tris: H ? H.tris : 0, draws: H ? H.draws : 0,
      shellShown: shell ? shell.visible && shell.material.visible !== false : null,
      codeBuiltShown: g ? CODE_BUILT.map(n => { const o = g.getObjectByName(n); return o ? o.visible : null; }) : null,
      reason: ST.reason, loads: ST.loads, builds: ST.builds, errors: ST.errors, lastErr: ST.lastErr,
    };
  },
};
window.__honeyIntApi = HONEY_INT_API;   // (main.js: window.__game.honeyInt)
