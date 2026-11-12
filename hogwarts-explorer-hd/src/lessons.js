// Hogwarts lessons in the HD world. The seven mini-games, the professor overlay and the
// progress store are the SAME files v1 runs (../hogwarts-explorer/lessons/*.js, loaded by
// index.html) — this module only gives them a home here: a professor standing in the right
// room (or out on the grounds), a walk-up ▶ prompt, and the always-open 🔔 lesson picker that
// whisks you to the classroom. Nothing is ever locked; progress is shared with v1.
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, Color, DoubleSide, InstancedMesh, Object3D, Vector3, SRGBColorSpace,
  AnimationMixer, LoopOnce,
} from 'three';
import { buildChibi, animateChibi } from './chibi.js';
import { loadAnimated } from './models.js';
import { FLOOR_Y } from './rooms.js';
import { PLACES } from './config.js';
import * as fun from './fun.js';

// who teaches what, and where they stand (room-local x,z indoors; world x,z outdoors)
const LOOK = {
  snape:    { robe: 0x14121a, trim: 0x2a2630, hair: 0x100c10, skin: 0xe8d6c4, house: 0x1a5236 },
  flitwick: { robe: 0x3a2f5e, trim: 0x2a2148, hair: 0xe8e4ea, skin: 0xf1d2b0, house: 0x1b3a6b, scale: 0.78 },
  mcgon:    { robe: 0x1a4030, trim: 0x8a1a2a, hair: 0x2a1d16, skin: 0xe6c3a0, house: 0x7a1420, hat: 0x14110c, glasses: true },
  defence:  { robe: 0x5a4a32, trim: 0x8a7a3a, hair: 0xbf9a5a, skin: 0xe8c6a0, house: 0x7a1420, wand: true },
  sinistra: { robe: 0x1b2456, trim: 0xb08a2e, hair: 0x14100c, skin: 0x8a5e44, house: 0x1b3a6b, hat: 0x1b2456 },
  sprout:   { robe: 0x5a4326, trim: 0x8a6a2a, hair: 0xb9b2a6, skin: 0xe9b58a, house: 0xb8902a, hat: 0x6a5330 },
};
// Film-look professors: a rigged GLB (feet origin, faces +Z like the chibi) swapped in over
// the chibi once it streams in. The chibi is the instant placeholder AND the silent fallback.
const GLB_PROF = { mcgon: { model: 'mcgonagall', scale: 1.3 } };   // 1.9 m -> 2.47 m: the chibi kids are 1.78 m (2.33 with hat)
const FADE = 0.25;
const GH = PLACES.greenhouse, PD = PLACES.paddock;
export const STATIONS = {
  potions:         { room: 'dungeon',    x: -2.6, z: -7.2, board: '⚗️' },
  charms:          { room: 'classrooms', x: -9,   z: -6.2, board: '🪶' },
  transfiguration: { room: 'classrooms', x: 0,    z: -6.2, board: '🐱' },
  spells:          { room: 'classrooms', x: 9,    z: -6.2, board: '🪄' },
  astronomy:       { room: 'tower',      x: -3.2, z: -4.6, board: '🔭' },
  herbology:       { room: null, x: GH.x, z: GH.z - 3.4 },
  creatures:       { room: null, x: PD.x, z: PD.z - 5 },
};
const M = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.75, ...o });
const mk = (par, geo, mat, x, y, z) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
function emojiTex(emoji, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.strokeRect(8, 8, 112, 112); }
  g.font = '84px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 70);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export function createLessons({ scene, player, interiors, heightAt, registerOutdoor, setModal }) {
  const HPL = window.HPLessons || {};
  const defs = {}; (HPL.LESSONS || []).forEach(l => (defs[l.key] = l));
  const live = [];                       // stations present right now: {key, x, z, y, chibi, world}
  let openKey = null;                    // the lesson whose overlay is open right now
  const outdoor = [];

  function professor(key, par, x, y, z, faceYaw) {
    const def = defs[key]; if (!def) return null;
    const look = LOOK[def.teacher]; if (!look) return null;
    const c = buildChibi(look); c.position.set(x, y, z); c.rotation.y = faceYaw; par.add(c);
    if (GLB_PROF[def.teacher]) upgradeProfessor(c, GLB_PROF[def.teacher]);
    return c;
  }

  // Swap the chibi for the rigged GLB when (if) it arrives. Any failure -> keep the chibi.
  function upgradeProfessor(c, spec) {
    const inScene = () => { let root = c; while (root.parent) root = root.parent; return !!root.isScene; };
    loadAnimated(spec.model, inScene).then(r => {
      if (!inScene()) return;                          // the room was left meanwhile
      if (!r) { console.warn('[lessons] professor', spec.model, 'GLB unavailable - keeping the chibi (see __game.models())'); return; }
      const clip = n => r.clips.find(a => a.name === n);
      if (!clip('Idle')) { console.warn('[lessons] professor', spec.model, 'GLB has no Idle clip - keeping the chibi'); return; }
      const obj = r.obj; obj.scale.setScalar(spec.scale); obj.name = 'prof-' + spec.model;
      obj.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false;
        o.userData.sharedGeo = true;                   // geometry is shared with the models.js cache
      });
      const mixer = new AnimationMixer(obj), acts = {};
      for (const n of ['Idle', 'Talk', 'Cast']) { const a = clip(n); if (a) acts[n.toLowerCase()] = mixer.clipAction(a); }
      if (acts.cast) { acts.cast.setLoop(LoopOnce, 1); acts.cast.clampWhenFinished = true; }
      acts.idle.play();
      const ud = c.userData;
      mixer.addEventListener('finished', e => { if (e.action === acts.cast) ud.casting = false; });
      for (const ch of c.children) ch.visible = false;
      c.add(obj);
      ud.rig = null;                                   // animateChibi() becomes a no-op
      ud.mixer = mixer; ud.acts = acts; ud.cur = 'idle'; ud.casting = false;
      // room teardown (interiors.js) calls this before disposing the room's geometry
      ud.onTeardown = () => {
        mixer.stopAllAction(); mixer.uncacheRoot(obj);
        obj.traverse(o => { if (o.isSkinnedMesh) { try { o.skeleton.dispose(); } catch { /* backend quirk */ } } });
        ud.mixer = null; ud.acts = null;
      };
    }).catch(e => console.warn('[lessons] professor GLB skipped -', e.message));
  }

  // Cross-fade a GLB professor to Idle / Talk / Cast (no-op for chibis).
  function fadeTo(c, name) {
    const ud = c.userData;
    if (!ud.mixer || ud.cur === name || !ud.acts[name]) return;
    const next = ud.acts[name], prev = ud.acts[ud.cur];
    next.reset().play();
    if (prev) prev.crossFadeTo(next, FADE, false);
    ud.cur = name; if (name === 'cast') ud.casting = true;
  }
  function animateFigure(s, dt, talking) {
    const ud = s.chibi.userData;
    if (!ud.mixer) return;
    for (let o = s.chibi; o; o = o.parent) if (!o.visible) return;   // hidden figure: no skinning work
    if (!ud.casting) fadeTo(s.chibi, talking ? 'talk' : 'idle');
    ud.mixer.update(dt);
  }

  // ---- indoors: called each time a room streams in ----
  function roomEntered(id, group) {
    for (let i = live.length - 1; i >= 0; i--) if (!live[i].world) live.splice(i, 1);
    for (const key of Object.keys(STATIONS)) {
      const s = STATIONS[key]; if (s.room !== id || !defs[key]) continue;
      const chibi = professor(key, group, s.x, 0, s.z, 0);           // faces +z, toward the class
      // a chalkboard with the subject's icon behind the professor + a row of little desks
      const board = new Group(); board.position.set(s.x, 0, s.z - 1.5);
      mk(board, new BoxGeometry(3.4, 2.2, 0.14), M(0x3a2614), 0, 2.5, 0);
      const slate = new Mesh(new PlaneGeometry(3.0, 1.8), new MeshStandardMaterial({ map: emojiTex(s.board, '#1c2a22'), roughness: 0.95 })); slate.position.set(0, 2.5, 0.08); board.add(slate);
      for (const sx of [-1.5, 1.5]) mk(board, new BoxGeometry(0.12, 3.4, 0.12), M(0x3a2614), sx, 1.7, 0);
      group.add(board);
      if (id === 'classrooms') {
        const desks = new InstancedMesh(new BoxGeometry(1.3, 0.1, 0.75), M(0x5a3a1e), 4), legs = new InstancedMesh(new BoxGeometry(1.1, 0.75, 0.08), M(0x3a2414), 4), d = new Object3D();
        [[-1.6, 3.2], [1.6, 3.2], [-1.6, 5.4], [1.6, 5.4]].forEach(([dx, dz], i) => { d.position.set(s.x + dx, 0.8, s.z + dz); d.updateMatrix(); desks.setMatrixAt(i, d.matrix); d.position.y = 0.38; d.updateMatrix(); legs.setMatrixAt(i, d.matrix); });
        group.add(desks, legs);
      }
      if (chibi) live.push({ key, x: s.x, z: s.z, y: FLOOR_Y, chibi, world: false });
    }
  }

  // ---- outdoors: the greenhouse (Herbology) and the creature paddock (Hagrid's lesson) ----
  (function buildOutdoor() {
    const gy = heightAt(GH.x, GH.z - 7), house = new Group(); house.position.set(GH.x, gy, GH.z - 7); house.name = 'greenhouse';
    const glass = M(0xbfe8df, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.32, side: DoubleSide });
    mk(house, new BoxGeometry(7, 3.6, 5), glass, 0, 1.8, 0);
    const roof = mk(house, new ConeGeometry(5.2, 2.2, 4), glass, 0, 4.7, 0); roof.rotation.y = Math.PI / 4;
    const frame = M(0x4a6a3e);
    // the four corner posts are one instanced mesh (the greenhouse is in view from the gates)
    const postsIM = new InstancedMesh(new BoxGeometry(0.2, 3.6, 0.2), frame, 4), pd = new Object3D();
    [[-3.5, -2.5], [-3.5, 2.5], [3.5, -2.5], [3.5, 2.5]].forEach(([sx, sz], i) => { pd.position.set(sx, 1.8, sz); pd.updateMatrix(); postsIM.setMatrixAt(i, pd.matrix); });
    house.add(postsIM);
    mk(house, new BoxGeometry(7.2, 0.2, 5.2), frame, 0, 3.6, 0);
    const plants = new InstancedMesh(new SphereGeometry(0.4, 10, 8), M(0xffffff, { roughness: 0.6 }), 8), d = new Object3D(), c = new Color();
    [0x8cff9e, 0xff9ad5, 0xffe08a, 0x9fd0ff].forEach((col, i) => { for (let k = 0; k < 2; k++) { d.position.set(-2.4 + i * 1.6, 0.7 + k * 0.9, k ? -1 : 1); d.scale.setScalar(k ? 0.8 : 1.1); d.updateMatrix(); plants.setMatrixAt(i * 2 + k, d.matrix); plants.setColorAt(i * 2 + k, c.setHex(col)); } });
    house.add(plants);
    const sign = new Mesh(new PlaneGeometry(1.5, 1.5), new MeshBasicMaterial({ map: emojiTex('🌿'), transparent: true, side: DoubleSide })); sign.position.set(0, 6.4, 0); house.add(sign);
    scene.add(house); registerOutdoor(house);
    const hs = STATIONS.herbology, sprout = professor('herbology', scene, hs.x, heightAt(hs.x, hs.z), hs.z, 0);
    if (sprout) { registerOutdoor(sprout); outdoor.push({ key: 'herbology', x: hs.x, z: hs.z, y: heightAt(hs.x, hs.z), chibi: sprout, world: true, bob: sign, root: house }); }

    const py = heightAt(PD.x, PD.z - 5), pen = new Group(); pen.position.set(PD.x, py, PD.z - 5); pen.name = 'paddock';
    const wood = M(0x7a5a36, { roughness: 1 }), posts = new InstancedMesh(new CylinderGeometry(0.11, 0.14, 1.2, 6), wood, 10);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; d.position.set(Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2); d.scale.setScalar(1); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }
    pen.add(posts);
    for (const h of [0.5, 1.0]) { const rail = mk(pen, new TorusGeometry(3.2, 0.06, 5, 30), wood, 0, h, 0); rail.rotation.x = Math.PI / 2; }
    const critters = [];
    [[0x4fbf5a, -1.1, -0.5], [0xff9ad0, 1.0, -0.8], [0x8a6ad8, 0.2, 1.1]].forEach(([col, x, z], i) => {
      const cr = new Group(); cr.position.set(x, 0, z);
      mk(cr, new SphereGeometry(0.48, 14, 12), M(col), 0, 0.5, 0).castShadow = true;
      for (const sx of [-0.17, 0.17]) { mk(cr, new SphereGeometry(0.11, 8, 8), M(0xffffff), sx, 0.66, 0.38); mk(cr, new SphereGeometry(0.055, 8, 6), M(0x15101a), sx, 0.67, 0.47); }
      if (i === 0) for (const sx of [-1, 1]) { const w = mk(cr, new ConeGeometry(0.26, 0.6, 4), M(0x2f8f3a), sx * 0.52, 0.75, -0.1); w.rotation.z = sx * -1.1; }
      if (i === 2) for (const sx of [-1, 1]) mk(cr, new ConeGeometry(0.1, 0.26, 5), M(col), sx * 0.25, 0.98, 0.04);
      pen.add(cr); critters.push({ cr, ph: i * 2.1 });
    });
    const psign = new Mesh(new PlaneGeometry(1.5, 1.5), new MeshBasicMaterial({ map: emojiTex('🐉'), transparent: true, side: DoubleSide })); psign.position.set(0, 3.6, 0); pen.add(psign);
    scene.add(pen); registerOutdoor(pen);
    outdoor.push({ key: 'creatures', x: PD.x, z: PD.z - 5, y: py, chibi: null, world: true, critters, bob: psign, r: 5.2, root: pen });
  })();

  // ---- start / go ----
  function start(key) {
    const def = defs[key]; if (!def || !HPL.overlay || window.__game.modal) return false;
    openKey = key;
    HPL.overlay.open(def, (stars, quit) => {
      openKey = null; refreshBell();
      // a finished lesson earns a flourish from a GLB professor (if her rig has a Cast clip)
      if (!quit && stars > 0) { const s = live.find(l => l.key === key); if (s?.chibi?.userData.acts?.cast) fadeTo(s.chibi, 'cast'); }
    });
    return true;
  }
  async function go(key) {
    const s = STATIONS[key]; if (!s) return false;
    if (s.room) {
      if (interiors.active !== s.room) await interiors.enter(s.room);
      player.pos.set(s.x, FLOOR_Y, s.z + 3.1); player.smoothY = FLOOR_Y; player._lastPos.copy(player.pos);
    } else {
      if (interiors.active) interiors.exit();
      player.teleport(s.x, s.z + (key === 'creatures' ? 4.6 : 3.2));
    }
    player.yaw = Math.PI; player.cam.reset(player.yaw);
    return true;
  }

  // ---- the picker ----
  const css = document.createElement('style');
  css.textContent = `
  #bellBtn{left:calc(18px + env(safe-area-inset-left));top:calc(52px + env(safe-area-inset-top));width:70px;height:70px;font-size:34px;
    background:radial-gradient(circle at 35% 30%,#ffcf6a,#b9651a)}
  #bellBtn .bd{position:absolute;top:-4px;right:-4px;background:#7CFC7C;color:#13351a;font-size:15px;font-weight:bold;min-width:22px;height:22px;border-radius:12px;border:2px solid #13351a;display:flex;align-items:center;justify-content:center;padding:0 3px}
  #pickOv{position:fixed;inset:0;z-index:46;display:none;align-items:center;justify-content:center;background:rgba(8,6,24,.82);font-family:'Rubik',sans-serif;direction:rtl}
  #pickOv.on{display:flex}
  .pickP{width:min(94vw,700px);background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 18px 20px;box-sizing:border-box}
  .pickT{text-align:center;color:#ffd76a;font-size:30px;font-weight:bold;text-shadow:0 2px 0 #7a3b00;margin:0 0 10px}
  .pickStreak{display:inline-block;background:linear-gradient(#ff9a3c,#e8352e);color:#fff;font-size:20px;border:2px solid #ffd76a;border-radius:14px;padding:0 9px;margin-inline-start:6px;direction:ltr;text-shadow:none;vertical-align:middle}
  .pickGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  @media (max-aspect-ratio:1/1){.pickGrid{grid-template-columns:repeat(2,1fr)}}
  .pickCard{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.07);border:3px solid rgba(255,215,106,.45);
    border-radius:20px;padding:12px 8px 10px;cursor:pointer;font-family:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
  .pickCard:active{transform:scale(.94)} .pickCard .ic{font-size:46px;line-height:1} .pickCard .nm{color:#fff;font-size:20px;font-weight:bold}
  .pickCard .st{font-size:16px;min-height:20px;color:#ffe9a8} .pickCard .rk{position:absolute;top:4px;right:6px;font-size:20px}
  .pickCard .lv{display:flex;gap:3px;justify-content:center;height:8px} .pickCard .lv i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.18)} .pickCard .lv i.on{background:#ffd76a;box-shadow:0 0 6px #ffd76a}
  .pickCard .go{margin-top:2px;background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:17px;font-weight:bold;border:3px solid #fff;border-radius:40px;padding:4px 14px}
  .pickClose{display:block;margin:14px auto 0;padding:8px 40px;border-radius:40px;border:4px solid #fff;background:linear-gradient(#b5a0ff,#7a52d6);color:#fff;font-size:22px;font-weight:bold;cursor:pointer;font-family:inherit}
  .pickClose.qCard{background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:24px;padding:10px 34px}`;
  document.head.appendChild(css);
  const bell = document.createElement('button'); bell.id = 'bellBtn'; bell.className = 'gamebtn'; bell.innerHTML = '🔔<span class="bd">0</span>'; bell.setAttribute('aria-label', 'בחרו שיעור');
  document.body.appendChild(bell);
  const ov = document.createElement('div'); ov.id = 'pickOv'; document.body.appendChild(ov);
  function refreshBell() { try { bell.querySelector('.bd').textContent = HPL.progress.total(); } catch { /* lessons not loaded */ } }
  HPL.onProgress = refreshBell; refreshBell();
  const extras = [];                     // extra picker buttons (Quidditch registers one)
  function openPicker() {
    const P = HPL.progress, p = document.createElement('div'); p.className = 'pickP';
    const stk = P.streak ? P.streak() : 0;
    p.innerHTML = '<div class="pickT">✨ בחרו שיעור ✨' + (stk ? ' <span class="pickStreak">🔥×' + stk + '</span>' : '') + '</div>';
    const grid = document.createElement('div'); grid.className = 'pickGrid';
    (HPL.LESSONS || []).forEach(l => {
      const stn = P.stars(l.key), lv = P.level(l.key), rk = P.rank(l.key);
      let dots = ''; for (let i = 1; i <= 8; i++) dots += '<i class="' + (i <= lv ? 'on' : '') + '"></i>';
      const card = document.createElement('button'); card.type = 'button'; card.className = 'pickCard'; card.dataset.k = l.key;
      card.innerHTML = '<div class="rk">' + rk.e + '</div><div class="ic">' + l.icon + '</div><div class="nm">' + l.subject + '</div><div class="lv">' + dots + '</div><div class="st">' + (P.doneToday(l.key) ? '<span style="color:#9effa0;font-weight:bold">✓ </span>' : '') + '⭐'.repeat(stn) + '☆'.repeat(3 - stn) + '</div><div class="go">➤ ללכת</div>';
      card.addEventListener('click', e => { e.stopPropagation(); closePicker(); go(l.key); });
      grid.appendChild(card);
    });
    p.appendChild(grid);
    for (const x of extras) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pickClose qCard'; b.textContent = x.label + (fun.store.qWins ? '  🏆×' + fun.store.qWins : ''); b.addEventListener('click', e => { e.stopPropagation(); closePicker(); setTimeout(x.fn, 60); }); p.appendChild(b); }
    const close = document.createElement('button'); close.className = 'pickClose'; close.textContent = 'סגור'; close.addEventListener('click', e => { e.stopPropagation(); closePicker(); }); p.appendChild(close);
    ov.innerHTML = ''; ov.appendChild(p); ov.classList.add('on'); setModal(true); fun.sfx.flip();
  }
  function closePicker() { ov.classList.remove('on'); setModal(false); fun.sfx.pop(); }
  bell.addEventListener('click', e => { e.stopPropagation(); if (!window.__game.modal) openPicker(); });
  ov.addEventListener('pointerdown', e => { if (e.target === ov) closePicker(); });

  // ---- per-frame: animate professors, offer ▶ near one ----
  const head = new Vector3();
  let t = 0, nearKey = null;
  function update(dt) {
    t += dt; nearKey = null;
    const inside = interiors.active, list = inside ? live : outdoor;
    let best = null, bd = 1e9;
    for (const s of list) {
      if (s.bob) { s.bob.position.y += Math.sin(t * 2) * 0.004; s.bob.rotation.y += dt * 0.8; }
      const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
      if (s.chibi) { animateChibi(s.chibi.userData.rig, dt, { moving: false }); animateFigure(s, dt, d < (s.r || 4.4)); }
      // far-away lesson spots cost nothing: the little figures stream in at 55 m, the buildings at 95 m
      if (s.world) { if (s.chibi) s.chibi.visible = d < 55; if (s.root) s.root.visible = d < 95; if (s.critters) for (const c of s.critters) c.cr.visible = d < 55; }
      if (s.critters) for (const c of s.critters) { const k = Math.max(0, Math.sin(t * (d < 14 ? 5 : 2.2) + c.ph)); c.cr.position.y = k * (d < 14 ? 0.5 : 0.18); }
      if (s.chibi && d < 9) s.chibi.rotation.y = Math.atan2(player.pos.x - s.x, player.pos.z - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (best && bd < (best.r || 4.4) && defs[best.key]) {
      nearKey = best.key; const def = defs[best.key];
      fun.offer('lesson:' + best.key, '▶', bd, () => start(best.key));
      fun.say(head.set(best.x, best.y + (best.chibi ? 2.6 : 3), best.z), def.icon + ' ' + def.subject, 0.25, 'lesson');
    }
  }
  // while a modal (lesson overlay, picker) freezes update(): keep GLB professors breathing,
  // talking if their lesson is the one open
  function anim(dt) { if (interiors.active) for (const s of live) if (s.chibi) animateFigure(s, dt, s.key === openKey); }
  // visibility only (used while a mini-game owns the frame)
  function cull() { for (const s of outdoor) { const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z); if (s.chibi) s.chibi.visible = d < 55; if (s.root) s.root.visible = d < 95; if (s.critters) for (const c of s.critters) c.cr.visible = d < 55; } }
  return { update, anim, cull, roomEntered, start, go, openPicker, closePicker, stations: STATIONS, near: () => nearKey, addPickerButton: (label, fn) => extras.push({ label, fn }) };
}
