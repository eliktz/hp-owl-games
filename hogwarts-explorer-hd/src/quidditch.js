// QUIDDITCH in the HD world: fly a broom over a pitch south of the gates. Since Nov 2026 the
// child picks a POSITION first (see briefs/quidditch-positions.md in the art workspace):
//   all     today's mixed match, unchanged: grab the Quaffle, score past a Keeper, dodge two
//           Bludgers, catch the Golden Snitch (+150) to end it.
//   seeker  the Snitch is out from the start and hides: hot/cold chime + a ✨ edge arrow; a rival
//           Seeker chases it too (always late on levels 1 to 3). Catch = win.
//   keeper  the camera sits behind the home hoops; the stick slides you across them; the rival
//           Chaser winds up (target hoop glows + dotted line) and you touch the ball to save. 8 shots.
//   chaser  Quaffle play without the Snitch, with a friendly team-mate Chaser: rival close → the
//           button is 🤝 (pass); the mate flies ahead and passes back (the ball homes onto you).
//           90 s or 5 goals; a team Beater saves you from half the Bludgers (🏏 toast).
//   beater  you carry a bat; Bludgers go for TEAM-MATES (a red arrow marks who); fly near and 🏏
//           (3.5 m, 0.4 s window) to bonk it away. The broom drifts to the danger when the stick is idle. 75 s.
// Structure: a small core (pitch, actors, HUD, flight, camera, end screen) + a ROLES table
// { id, he, emoji, setup(), update(dt, t), wantY(), fly, cam(dt), action, hint }.
// Thumb-friendly: one stick, at most one action button plus ⚡. Everything repeated is instanced,
// nothing casts shadows. Real models (balls, Nimbus, house riders) stream in from models.json and
// replace the code-drawn shapes; if a model fails, the code look simply stays.
import {
  Group, Mesh, InstancedMesh, Object3D, Color, Vector3, Quaternion, Box3, SphereGeometry, CylinderGeometry, BoxGeometry,
  ConeGeometry, TorusGeometry, CircleGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, DoubleSide, CanvasTexture, SRGBColorSpace,
  Sprite, SpriteMaterial, AdditiveBlending, AnimationMixer, LoopRepeat,
} from 'three';
import { buildChibi } from './chibi.js';
import { PLACES } from './config.js';
import { loadModel, loadAnimated } from './models.js';
import * as fun from './fun.js';

const STAND = { x: PLACES.pitch.x, z: PLACES.pitch.z + 2 };   // 32 m south of the centre: in front of the stadium towers (their fronts are at 28.6), on the path from the castle
const C = { x: PLACES.pitch.x, z: PLACES.pitch.z + 34 }, AX = 29, AZ = 21;
const HOOP_DZ = [-6, 0, 6], HOOP_Y = [10.5, 12.5, 10.5];
const GOAL_X = C.x + 20, HOME_X = C.x - 20;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const M = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.7, ...o });
// Model sizes in play (max extent, metres): the balls stay at the old readable code sizes.
const SIZE = { quaffle: 1.2, bludger: 1.24, snitch: 1.9, broom: 2.25, myBroom: 2.1, bat: 1.0 };
// House riders (posed on their own brooms, origin at the seat, facing +Z handle-first):
// scale 1.3 matches the hero (young Harry is 1.3x too); seatY puts the seat where the chibi's broom was.
const RIDER = { scale: 1.3, seatY: 0.72 };
const HOUSE = { gryf: 'gryffindor', slyt: 'slytherin', rave: 'ravenclaw', huff: 'hufflepuff' };
const CREST = { gryf: '🦁', slyt: '🐍', rave: '🦅', huff: '🦡' };
const POSITIONS = ['chaser', 'beater', 'keeper', 'seeker'];
const KEEPER = { shots: 8, windup: 1.2, saveR: 2.3, x: HOME_X + 2.6, zMax: 8, yMin: 9.3, yMax: 14 };
const CHASER = { len: 90, goals: 5, passR: 7, catchR: 2.4, save: 0.5 };
const BEATER = { len: 75, reach: 3.5, window: 0.4, swingT: 0.45, cd: 0.55 };
// Bludger look: iron-black (the model's own texture is the Quaffle's brown leather), and after
// dark a faint red smoulder so they still read against the night sky.
const IRON = { color: 0x2a2a30, metalness: 0.6, roughness: 0.45 };
const SMOULDER = { day: 0, dusk: 0, night: 0.015 };   // iron stays iron (a stronger ember read as the red Quaffle at night); the charge glow is the signal

export function createQuidditch({ scene, camera, player, heightAt, interiors, registerOutdoor, setTakeover, isModal, setModal, timeOfDay, colliders }) {
  const st = fun.store; st.qLevel = st.qLevel || 1; st.qWins = st.qWins || 0;
  const gy = heightAt(C.x, C.z) + 0.4;
  const d = new Object3D(), col = new Color(), tmp = new Vector3(), tmp2 = new Vector3(), tmp3 = new Vector3();
  const mk = (par, geo, mat, x = 0, y = 0, z = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; par.add(m); return m; };
  const clampArena = (p) => { const dx = (p.x - C.x) / AX, dz = (p.z - C.z) / AZ, k = Math.hypot(dx, dz); if (k > 1) { p.x = C.x + dx / k * AX; p.z = C.z + dz / k * AZ; return true; } return false; };
  const myHouse = HOUSE[st.house] || 'gryffindor', oppHouse = myHouse === 'slytherin' ? 'ravenclaw' : 'slytherin';
  const oppCrest = oppHouse === 'slytherin' ? '🐍' : '🦅';

  // ---------------- models (with the code look as the fallback) ----------------
  // Scale a loaded model so its largest extent is `size` and centre it on its parent's origin.
  function fitCentered(obj, size) {
    obj.updateMatrixWorld(true);
    const box = new Box3().setFromObject(obj), sz = box.getSize(tmp3), k = size / Math.max(sz.x, sz.y, sz.z, 1e-6);
    obj.scale.multiplyScalar(k); obj.updateMatrixWorld(true);
    box.setFromObject(obj); box.getCenter(tmp3); obj.position.sub(tmp3);
    return obj;
  }
  // Load `name`; on success hide the code-drawn children of `holder` (userData.code) and add the
  // model. On failure nothing changes (the code look stays) and models.js records why.
  function swapIn(holder, name, place) {
    loadModel(name).then(obj => {
      if (!obj) return;
      obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.userData.sharedGeo = true; } });
      place(obj);
      for (const c of holder.children) if (c.userData.code) c.visible = false;
      holder.add(obj); holder.userData.model = obj;
    }).catch(e => console.warn('[quidditch] model skipped:', name, e && e.message));
  }
  const code = (o) => { o.userData.code = true; return o; };

  // ---------------- the pitch (always there, cheap) ----------------
  const pitch = new Group(); pitch.name = 'quidditch-pitch';
  const oval = mk(pitch, new CircleGeometry(1, 44), M(0x3f8a45, { roughness: 1 }), C.x, gy, C.z); oval.rotation.x = -Math.PI / 2; oval.scale.set(AX - 2, AZ - 2, 1);
  const poles = new InstancedMesh(new CylinderGeometry(0.2, 0.2, 1, 8), M(0xcfc2a0), 6);
  const rings = new InstancedMesh(new TorusGeometry(1.5, 0.2, 8, 20), M(0xe6b422, { metalness: 0.5, roughness: 0.3, emissive: new Color(0x3a2a00) }), 6);
  let hi = 0;
  for (const gx of [GOAL_X, HOME_X]) for (let i = 0; i < 3; i++) {
    const h = HOOP_Y[i] - 1.5;
    d.position.set(gx, gy + h / 2, C.z + HOOP_DZ[i]); d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.updateMatrix(); poles.setMatrixAt(hi, d.matrix);
    d.position.set(gx, gy + HOOP_Y[i], C.z + HOOP_DZ[i]); d.rotation.set(0, Math.PI / 2, 0); d.scale.set(1, 1, 1); d.updateMatrix(); rings.setMatrixAt(hi, d.matrix); hi++;
  }
  const stands = new InstancedMesh(new BoxGeometry(46, 1, 1.9), M(0x6a4a2e, { roughness: 1 }), 6);
  const CROWD = [];
  let crowdInTowers = false;   // true once the stadium model is in and the fans sit in its tower boxes
  const crowd = new InstancedMesh(new SphereGeometry(0.55, 8, 6), M(0xffffff, { roughness: 0.8 }), 192);
  let si = 0;
  for (const [side, teamCol] of [[-1, 0xb8322e], [1, 0x2a7a4a]]) for (let tier = 0; tier < 3; tier++) {
    const z = C.z + side * (23.5 + tier * 1.9), hgt = 1.2 + tier * 1.5;
    d.position.set(C.x, gy + hgt / 2 - 0.2, z); d.rotation.set(0, 0, 0); d.scale.set(1, hgt, 1); d.updateMatrix(); stands.setMatrixAt(si++, d.matrix);
    for (let i = 0; i < 32; i++) CROWD.push({ x: C.x - 21.7 + i * 1.4, y: gy + 1 + tier * 1.5 + 0.75, z, ph: Math.random() * 7, c: i % 5 === 0 ? 0xffd76a : (Math.random() < 0.7 ? teamCol : 0xf2e2c8) });
  }
  function settleCrowd(amp = 0, f = 0, t = 0) {
    const k = crowdInTowers ? 0.3 : 1;   // in the tower boxes: smaller fans, smaller hops (the roof is 1 m above the top row)
    for (let i = 0; i < CROWD.length; i++) { const p = CROWD[i]; d.position.set(p.x, p.y + (amp ? Math.abs(Math.sin(t * f + p.ph)) * amp * k : 0), p.z); d.rotation.set(0, 0, 0); if (crowdInTowers) d.scale.set(0.55, 0.75, 0.55); else d.scale.set(1, 1.25, 1); d.updateMatrix(); crowd.setMatrixAt(i, d.matrix); }
    crowd.instanceMatrix.needsUpdate = true;
  }
  CROWD.forEach((p, i) => crowd.setColorAt(i, col.setHex(p.c))); settleCrowd();
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  for (const im of [poles, rings, stands, crowd]) { im.frustumCulled = false; im.castShadow = false; pitch.add(im); }
  // the broom stand (walk up → 🧹)
  const stand = new Group(); stand.position.set(STAND.x, heightAt(STAND.x, STAND.z), STAND.z);
  mk(stand, new BoxGeometry(2.6, 1.0, 0.9), M(0x6a4a2e), 0, 0.5, 0);
  for (let i = 0; i < 3; i++) { const b = mk(stand, new CylinderGeometry(0.05, 0.05, 2.4, 6), M(0x8a5a2e), -0.8 + i * 0.8, 2.0, 0); b.rotation.z = 0.12 * (i - 1); }
  const signTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(40,25,90,.9)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.strokeStyle = '#ffd76a'; g.lineWidth = 8; g.stroke(); g.font = '70px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🧹', 64, 68); return c; })();
  const signT = new CanvasTexture(signTex); signT.colorSpace = SRGBColorSpace;
  const sign = mk(stand, new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: signT, transparent: true, side: DoubleSide }), 0, 4.6, 0);
  pitch.add(stand); scene.add(pitch); registerOutdoor(pitch);

  // ---------------- the stadium model (q_pitch) ----------------
  // House towers + stand wall + changing hut + a painted pitch ground (art: briefs/quidditch_art.md):
  // origin = arena centre on the ground, inner wall a stadium at x ±32 (straight for |x| <= 19.4,
  // elliptical ends) and z ±24. While it is in, the code box stands and green oval hide (they stay as
  // the fallback) and the crowd moves into the tower boxes. Wall bottoms are draped down onto the
  // rolling terrain so nothing floats. The hoops, balls and riders stay the game's own.
  const PITCH_LIFT = 0.3;                          // the flat ground sits just above every terrain bump inside the wall
  const WALL = { ax: 32, az: 24, straight: 19.4, t: 0.8 };
  // Tower centres (arena space) measured from q_pitch_01; each faces the wall normal. The box seats
  // are raked steps 16..18 m up; four rows of four fans each = 192 = the crowd's instance count.
  const TOWERS = [[4.1, -26.55], [-5.25, -26.65], [-15.35, -27.25], [15.05, -27.95], [27.0, -24.3], [-29.1, -21.35],
    [-3.55, 26.8], [5.75, 26.95], [-14.35, 28.25], [15.65, 27.7], [28.6, 23.5], [-26.95, 24.45]];
  const towerYaw = (x, z) => {   // facing inward along the stadium's normal
    const ex = Math.abs(x) > WALL.straight ? (Math.abs(x) - WALL.straight) * Math.sign(x) / ((WALL.ax - WALL.straight) ** 2) : 0;
    return Math.atan2(-ex, -z / (WALL.az * WALL.az));
  };
  const SEATS = [[0.84, 16.1], [0.24, 16.6], [-0.36, 17.1], [-0.96, 17.7]];   // [metres forward of the tower centre, seat height]
  function towerCrowd() {
    CROWD.length = 0;
    for (const [tx, tz] of TOWERS) {
      const a = towerYaw(tx, tz), fx = Math.sin(a), fz = Math.cos(a), teamCol = tz < 0 ? 0xb8322e : 0x2a7a4a;
      for (const [u, sy] of SEATS) for (const l of [-1.26, -0.42, 0.42, 1.26]) {
        CROWD.push({ x: C.x + tx + fx * u + fz * l, y: gy + PITCH_LIFT + sy + 0.41, z: C.z + tz + fz * u - fx * l, ph: Math.random() * 7,
          c: CROWD.length % 5 === 0 ? 0xffd76a : (Math.random() < 0.7 ? teamCol : 0xf2e2c8) });
      }
    }
    crowdInTowers = true;
    CROWD.forEach((p, i) => crowd.setColorAt(i, col.setHex(p.c))); if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    settleCrowd();
  }
  // Walk-around colliders (outdoor array): towers, hut and chest are always solid; the wall ring is
  // one-way (solid while you are outside, switched off while you are inside so you can never be shut in).
  const wallCols = [], pitchCols = [];
  function addBox(list, x, z, hw, hd, angle) { list.push({ type: 'box', x, z, hw, hd, angle, pitch: true }); }
  function buildColliders() {
    if (!colliders) return;
    for (const [tx, tz] of TOWERS) addBox(pitchCols, C.x + tx, C.z + tz, 1.95, 1.95, -towerYaw(tx, tz));
    addBox(pitchCols, C.x - 0.3, C.z + 30.7, 5.4, 2.7, 0);                       // the changing hut
    const r = WALL.t / 2;
    for (const s of [-1, 1]) addBox(wallCols, C.x, C.z + s * (WALL.az + r), WALL.straight, r, 0);
    const N = 14, ea = WALL.ax - WALL.straight + r, eb = WALL.az + r;           // each end: N chords of the ellipse
    for (const s of [-1, 1]) for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + Math.PI * i / N, a1 = a0 + Math.PI / N;
      const x0 = s * (WALL.straight + Math.cos(a0) * ea), z0 = Math.sin(a0) * eb, x1 = s * (WALL.straight + Math.cos(a1) * ea), z1 = Math.sin(a1) * eb;
      addBox(wallCols, C.x + (x0 + x1) / 2, C.z + (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2 + 0.15, r, Math.atan2(z1 - z0, x1 - x0));
    }
    colliders.push(...pitchCols, ...wallCols);
  }
  let wallSolid = true;
  function setWallSolid(on) {
    if (!colliders || on === wallSolid) return; wallSolid = on;
    if (on) colliders.push(...wallCols); else for (const c of wallCols) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); }
  }
  // inside the stadium shape grown by `g` metres (0 = the inner wall face)
  const inStadium = (x, z, g = 0) => { const dx = Math.max(0, Math.abs(x - C.x) - WALL.straight) / (WALL.ax - WALL.straight + g), dz = (z - C.z) / (WALL.az + g); return dx * dx + dz * dz < 1; };
  // hysteresis: off as soon as you are inside the wall, on again only once you are clear of its band
  function gateWall(x, z) { if (inStadium(x, z)) setWallSolid(false); else if (!inStadium(x, z, WALL.t + 0.9)) setWallSolid(true); }
  let stadium = null;
  loadModel('q_pitch').then(obj => {
    if (!obj) return;
    obj.position.set(C.x, gy + PITCH_LIFT, C.z);
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false; o.userData.sharedGeo = true;
      if (o.name.startsWith('Pitch_Stands')) {   // drape every bottom vertex onto the terrain (one stadium in the game: editing the cached geometry is fine)
        const pa = o.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) if (pa.getY(i) < 0.05) pa.setY(i, Math.min(0, heightAt(C.x + pa.getX(i), C.z + pa.getZ(i)) - gy - PITCH_LIFT - 0.3));
        pa.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
      }
    });
    pitch.add(obj); stadium = obj; pitch.userData.model = obj;
    stands.visible = false; oval.visible = false;
    towerCrowd(); buildColliders();
  }).catch(e => console.warn('[quidditch] model skipped: q_pitch', e && e.message));
  // the ball chest by the broom stand (a prop): open side toward the path from the castle
  loadModel('q_chest').then(obj => {
    if (!obj) return;
    const cx = STAND.x - 2.1, cz = STAND.z - 1.1, yaw = Math.PI - 0.3;
    obj.scale.setScalar(1.3); obj.rotation.y = yaw;
    obj.position.set(cx - stand.position.x, heightAt(cx, cz) - stand.position.y, cz - stand.position.z);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.userData.sharedGeo = true; } });
    stand.add(obj); stand.userData.chest = obj;
    if (colliders) colliders.push({ type: 'box', x: cx, z: cz, hw: 0.68, hd: 0.42, angle: -yaw, pitch: true });
  }).catch(e => console.warn('[quidditch] model skipped: q_chest', e && e.message));

  // ---------------- match actors ----------------
  const actors = new Group(); actors.visible = false; scene.add(actors);
  // Quaffle: a group so the model can replace the code sphere in place.
  const quaffle = new Group(); actors.add(quaffle);
  code(mk(quaffle, new SphereGeometry(0.6, 14, 12), M(0xc8321e, { emissive: new Color(0x5a1008), emissiveIntensity: 0.8, roughness: 0.5 })));
  swapIn(quaffle, 'q_quaffle', o => fitCentered(o, SIZE.quaffle));
  // Bludgers: the charge glow goes on every material of the ball (code sphere or model clone).
  const bludgers = [0, 1].map(i => {
    const g = new Group(); actors.add(g);
    const cm = M(IRON.color, { metalness: IRON.metalness, roughness: IRON.roughness, emissive: new Color(0xff2a2a), emissiveIntensity: 0 });
    code(mk(g, new SphereGeometry(0.62, 14, 12), cm));
    const b = { g, pos: g.position, mats: [cm], ph: i * 3.1, state: 'roam', t: 6 + i * 5, dir: new Vector3(), hit: false, victim: null, glowV: 0 };
    swapIn(g, 'q_bludger', o => {
      fitCentered(o, SIZE.bludger);
      // a cloned material per ball (the cached one stays untouched): iron-black, no leather map
      o.traverse(m => { if (m.isMesh) { const mt = m.material = m.material.clone(); mt.map = null; mt.color.setHex(IRON.color); mt.metalness = IRON.metalness; mt.roughness = IRON.roughness;
        mt.emissive = new Color(0xff2a2a); mt.emissiveIntensity = Math.max(b.glowV, smoulder); mt.needsUpdate = true; b.mats.push(mt); } });
    });
    return b;
  });
  // the charge glow never drops below the time-of-day smoulder (0 by day)
  let smoulder = 0;
  const glow = (b, v) => { b.glowV = v; const e = Math.max(v, smoulder); for (const m of b.mats) m.emissiveIntensity = e; };
  function setSmoulder() {
    const k = SMOULDER[(timeOfDay && timeOfDay()) || 'day'] || 0;
    if (k === smoulder) return; smoulder = k; for (const b of bludgers) glow(b, b.glowV);
  }
  const snitch = new Group(); snitch.visible = false; actors.add(snitch);
  code(mk(snitch, new SphereGeometry(0.34, 12, 10), M(0xffd23f, { metalness: 0.6, roughness: 0.25, emissive: new Color(0xffb000), emissiveIntensity: 1.2 })));
  const wings = [-1, 1].map(s => { const w = code(mk(snitch, new PlaneGeometry(0.9, 0.3), M(0xfff6d8, { side: DoubleSide, emissive: new Color(0xfff0c0), emissiveIntensity: 0.6 }), s * 0.55, 0.1, 0)); w.userData.s = s; return w; });
  let snitchWings = null;   // the lite model's (transparent) wing mesh: fluttered by squashing it
  let snitchMixer = null;   // the rigged Snitch (q_snitch_rigged): its 'Flap' loop (10 Hz) on an AnimationMixer
  const snitchLite = () => swapIn(snitch, 'q_snitch', o => {
    fitCentered(o, SIZE.snitch);
    o.traverse(m => { if (m.isMesh && m.material.transparent) snitchWings = m; if (m.isMesh && !m.material.transparent) { m.material = m.material.clone(); m.material.emissive = new Color(0xffb000); m.material.emissiveIntensity = 0.5; } });
  });
  // The rigged Snitch first; if it is missing or fails, the lite one; if that fails too, the code Snitch.
  loadAnimated('q_snitch_rigged').then(r => {
    const clip = r && r.clips.find(c => c.name === 'Flap');
    if (!r || !clip) { snitchLite(); return; }
    const o = r.obj;
    o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; m.userData.sharedGeo = true;
      m.material = m.material.clone(); m.material.emissive = new Color(0xffb000); m.material.emissiveIntensity = 0.5; } });
    fitCentered(o, SIZE.snitch);
    snitchMixer = new AnimationMixer(o); const act = snitchMixer.clipAction(clip); act.setLoop(LoopRepeat, Infinity); act.play();
    for (const c of snitch.children) if (c.userData.code) c.visible = false;
    snitch.add(o); snitch.userData.model = o; snitch.userData.rigged = true;
  }).catch(e => { console.warn('[quidditch] model skipped: q_snitch_rigged', e && e.message); snitchLite(); });
  const snitchLast = new Vector3();
  // a soft sparkle that twinkles on the Snitch (Seeker: how you spot it from far away)
  const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,220,90,.7)'); gr.addColorStop(1, 'rgba(255,200,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
  const sparkle = new Sprite(new SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  sparkle.visible = false; sparkle.frustumCulled = false; snitch.add(sparkle);

  function broom() { const b = new Group(); const stick = code(mk(b, new CylinderGeometry(0.05, 0.06, 2.4, 8), M(0x7a4a22), 0, 0, 0.2)); stick.rotation.x = Math.PI / 2; const tail = code(mk(b, new ConeGeometry(0.26, 0.9, 10), M(0xc9a85a), 0, 0, -1.4)); tail.rotation.x = Math.PI / 2; b.position.y = 0.72; return b; }
  // A flyer: outer group (position + heading, driven by the game) > body (bob / bank / pitch, posed
  // in code) > chibi + code broom, replaced by the house rider GLB when it streams in.
  const flyers = [];
  function flyer(look, house) {
    const g = new Group(), body = new Group(); g.add(body); actors.add(g);
    const c = code(buildChibi(look)); c.traverse(o => { if (o.isMesh) o.castShadow = false; });
    body.add(c, code(broom()));
    g.userData = { body, ph: Math.random() * 7, last: new Vector3(), lastYaw: 0, bank: 0, pitch: 0, init: false };
    swapIn(body, 'q_rider_' + house, o => { o.scale.setScalar(RIDER.scale); o.position.y = RIDER.seatY; });
    flyers.push(g); return g;
  }
  const LOOK = { slytherin: { robe: 0x1a5236, trim: 0x123a26, house: 0xc9cdd2 }, gryffindor: { robe: 0x7a1420, trim: 0x4a0c14, house: 0xd9b24a }, ravenclaw: { robe: 0x1d3a7a, trim: 0x12244a, house: 0xb08a4a }, hufflepuff: { robe: 0xc9a22a, trim: 0x2a2416, house: 0x1a1a1a } };
  const rival = flyer({ ...LOOK[oppHouse], hair: 0xcf5a1e }, oppHouse);                  // rival Chaser
  const keepA = flyer({ ...LOOK[oppHouse], hair: 0x6a4322 }, oppHouse);                  // their Keeper (far hoops)
  const keepB = flyer({ ...LOOK[myHouse], hair: 0x14100c, glasses: true }, myHouse);     // our Keeper (home hoops)
  const mate = flyer({ ...LOOK[myHouse], hair: 0x8a3a1a }, myHouse);                     // our Chaser (helper)
  const rivalSeeker = flyer({ ...LOOK[oppHouse], hair: 0xe8d8a0 }, oppHouse);            // their Seeker
  // The player's broom: the Nimbus 2000 GLB (handle at +Z), code broom until/unless it loads.
  // player.ride() places it with RIDE_BROOM (player.js), measured from the hero's Ride clip.
  const myBroom = broom();
  swapIn(myBroom, 'q_broom', o => { fitCentered(o, SIZE.myBroom); });   // centred: RIDE_BROOM (player.js) puts the handle under Harry's fists
  // The Beater's bat: `bat` sits on the hero's right hand bone (hand_r) or, without the rigged hero,
  // on the wrapper at hand height. Its orientation is authored in WRAPPER space (rest over the
  // shoulder, a forehand swing) and converted to bone space every frame, so the bone's own axes
  // never matter. Code club (dark oak) until/unless q_bat streams in. Grip ~10 cm up the handle.
  const bat = new Group(); bat.name = 'beater-bat'; bat.visible = false;
  const batInner = new Group(); batInner.position.y = -0.1; bat.add(batInner);
  const club = code(new Group()); batInner.add(club);
  mk(club, new CylinderGeometry(0.032, 0.038, 0.36, 8), M(0x3a2616), 0, 0.18, 0);
  mk(club, new CylinderGeometry(0.08, 0.045, 0.56, 10), M(0x5a3b25), 0, 0.64, 0);
  swapIn(batInner, 'q_bat', o => {   // the GLB: 0.6 m along +Y, origin at the handle end
    o.updateMatrixWorld(true); const bx = new Box3().setFromObject(o), k = SIZE.bat / Math.max(bx.max.y - bx.min.y, 1e-3);
    o.scale.multiplyScalar(k); o.position.y -= bx.min.y * k;
  });
  bat.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  const BAT_DIR = (x, y, z) => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(x, y, z).normalize());
  // wrapper space: +Z forward, +Y up, the hero's right hand is on -X
  const BAT_REST = BAT_DIR(-0.75, 0.7, -0.1);   // up and well out to the right, so it reads from the chase camera
  const BAT_KEYS = [[0, BAT_REST], [0.1, BAT_DIR(-0.6, 0.45, -0.75)], [0.22, BAT_DIR(-0.95, 0.12, 0.3)], [0.32, BAT_DIR(-0.1, 0.2, 1)], [BEATER.swingT, BAT_REST]];
  const qD = new Quaternion(), qH = new Quaternion(), qM = new Quaternion(), vS = new Vector3(), vS2 = new Vector3();
  let batHero = null, batHand = null;
  function poseBat(swing) {   // swing: seconds into the swing, or < 0 at rest
    if (player.hero && player.hero.obj !== batHero) { batHero = player.hero.obj; batHand = batHero.getObjectByName('hand_r') || null; }
    const parent = batHand || player.model;
    if (bat.parent !== parent) parent.add(bat);
    if (swing < 0 || swing >= BEATER.swingT) qD.copy(BAT_REST);
    else for (let i = 0; i < BAT_KEYS.length - 1; i++) {
      const [t0, a] = BAT_KEYS[i], [t1, b] = BAT_KEYS[i + 1];
      if (swing <= t1) { const f = (swing - t0) / (t1 - t0); qD.slerpQuaternions(a, b, f * f * (3 - 2 * f)); break; }
    }
    if (batHand) {
      player.model.updateMatrixWorld(true);
      batHand.getWorldQuaternion(qH); player.model.getWorldQuaternion(qM);
      qH.premultiply(qM.invert());                       // the hand relative to the wrapper
      bat.quaternion.copy(qH.invert()).multiply(qD);     // so that wrapper-space orientation = qD
      batHand.getWorldScale(vS); player.model.getWorldScale(vS2);
      bat.scale.setScalar(vS2.x / (vS.x || 1)); bat.position.set(0, 0, 0);
    } else { bat.position.set(-0.36, 1.12, 0.3); bat.quaternion.copy(qD); bat.scale.setScalar(1); }
  }
  function dropBat() { bat.visible = false; if (bat.parent) bat.parent.remove(bat); }
  const aimRing = mk(actors, new TorusGeometry(1.9, 0.14, 8, 24), new MeshBasicMaterial({ color: 0x9effa0 })); aimRing.rotation.y = Math.PI / 2; aimRing.visible = false;
  const warn = mk(actors, new ConeGeometry(0.5, 1, 4), new MeshBasicMaterial({ color: 0xff3030 })); warn.rotation.x = Math.PI; warn.visible = false;
  // Keeper: the target hoop glows and a dotted line shows the coming shot (1 + 1 draw calls).
  const hoopGlow = mk(actors, new TorusGeometry(1.75, 0.32, 8, 24), new MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, depthWrite: false, blending: AdditiveBlending }));
  hoopGlow.rotation.y = Math.PI / 2; hoopGlow.visible = false;
  const DOTS = 12, dots = new InstancedMesh(new SphereGeometry(0.17, 8, 6), new MeshBasicMaterial({ color: 0xfff2a8 }), DOTS);
  dots.frustumCulled = false; dots.visible = false; actors.add(dots);

  // ---------------- HUD ----------------
  const css = document.createElement('style');
  css.textContent = `
  #qBoard{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:14;display:none;align-items:center;gap:12px;
    background:rgba(20,12,50,.86);border:4px solid #ffd76a;border-radius:22px;padding:6px 18px;color:#fff;font:bold 38px 'Rubik',sans-serif;direction:ltr;text-shadow:0 2px 0 #000}
  #qBoard .tm{display:flex;align-items:center;gap:8px} #qBoard .sn{font-size:30px;opacity:.25} #qBoard .sn.on{opacity:1;animation:qBlink .6s infinite}
  @keyframes qBlink{50%{transform:scale(1.35)}}
  #qExit{right:calc(18px + env(safe-area-inset-right));top:calc(14px + env(safe-area-inset-top));width:64px;height:64px;font-size:28px;display:none}
  #qThrow{right:calc(18px + env(safe-area-inset-right));bottom:calc(140px + env(safe-area-inset-bottom));width:104px;height:104px;font-size:52px;display:none;
    background:radial-gradient(circle at 50% 35%,rgba(255,190,90,.95),rgba(150,70,20,.85))}
  #qThrow.ready{box-shadow:0 0 0 6px #9effa0,0 0 30px #9effa0}
  #qBoost{right:calc(18px + env(safe-area-inset-right));bottom:calc(32px + env(safe-area-inset-bottom));display:none}
  #qHint{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);z-index:13;display:none;background:rgba(40,25,90,.85);border:3px solid #ffd76a;
    border-radius:20px;padding:4px 18px;color:#ffe9a8;font:bold 26px 'Rubik',sans-serif;white-space:nowrap;pointer-events:none}
  #qArrow{position:fixed;z-index:13;width:84px;height:84px;margin:-42px 0 0 -42px;display:none;pointer-events:none;font-size:44px;line-height:84px;text-align:center;
    border-radius:50%;background:radial-gradient(circle,rgba(255,230,120,.55),rgba(255,200,40,0) 70%)}
  #qArrow .ar{position:absolute;inset:0;font-size:40px;color:#ffd23f;text-shadow:0 0 8px #000}
  body.inMatch #qBoard,body.inMatch #qExit,body.inMatch #qHint,body.inMatch #qThrow,body.inMatch #qBoost{display:flex}
  body.inMatch.qNoThrow #qThrow{display:none}
  body.inMatch #qArrow.on{display:block}
  body.inMatch .pill,body.inMatch #quest,body.inMatch #mapBtn,body.inMatch #muteBtn,body.inMatch #timeBtn,body.inMatch #camctl,body.inMatch #bellBtn,body.inMatch #enterBtn,
  body.inMatch #exitBtn,body.inMatch #bubble,body.inMatch #wandBtn,body.inMatch .funBub{display:none !important}
  #qEnd,#qPick{position:fixed;inset:0;z-index:48;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.7),rgba(5,3,25,.92));font-family:'Rubik',sans-serif;direction:rtl}
  #qEnd.on,#qPick.on{display:flex}
  #qEnd .p{background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 26px 22px;text-align:center;color:#fff;width:min(90vw,520px);box-sizing:border-box}
  #qEnd .tr{font-size:110px;line-height:1.05} #qEnd .ti{font-size:44px;font-weight:bold;color:#ffd76a;text-shadow:0 3px 0 #7a3b00}
  #qEnd .sc{font-size:54px;font-weight:bold;direction:ltr;margin:6px 0} #qEnd .st{font-size:54px;letter-spacing:6px}
  #qEnd .row{display:flex;gap:14px;justify-content:center;margin-top:14px}
  #qEnd button{min-width:150px;min-height:76px;border-radius:40px;border:4px solid #fff;font:bold 30px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
  #qEnd .again{background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00} #qEnd .done{background:linear-gradient(#b5a0ff,#7a52d6);color:#fff}
  #qPick .p{position:relative;background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:14px 22px 18px;text-align:center;color:#fff;box-sizing:border-box;max-width:96vw;max-height:96vh}
  #qPick .ti{font-size:38px;font-weight:bold;color:#ffd76a;text-shadow:0 3px 0 #7a3b00;margin:0 54px 12px}
  #qPick .grid{display:grid;grid-template-columns:repeat(2,180px);gap:16px;justify-content:center}
  #qPick .card{position:relative;width:180px;height:180px;border-radius:26px;border:4px solid rgba(255,255,255,.75);background:linear-gradient(#4a3a9a,#2a1f66);color:#fff;
    font-family:'Rubik',sans-serif;cursor:pointer;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;transition:transform .15s}
  #qPick .card .em{font-size:66px;line-height:1;display:inline-block} #qPick .card .nm{font-size:30px;font-weight:bold} #qPick .card .sr{font-size:20px;letter-spacing:2px;direction:ltr}
  #qPick .card.sel{border-color:#ffd76a;box-shadow:0 0 0 5px #ffd76a,0 0 34px #ffd76a;transform:scale(1.05)}
  #qPick .card.soon{filter:saturate(.35) brightness(.8)} #qPick .card .bd{position:absolute;top:8px;left:8px;background:#ff8a3a;color:#fff;border-radius:12px;padding:1px 9px;font-size:17px;font-weight:bold}
  #qPick .card.no{animation:qNo .4s}
  @keyframes qNo{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
  #qPick .card[data-pos=chaser] .em{animation:qThr 1.6s ease-in-out infinite} @keyframes qThr{0%,100%{transform:translate(0,0)}50%{transform:translate(-14px,-12px) rotate(-15deg)}}
  #qPick .card[data-pos=beater] .em{animation:qSw 1.2s ease-in-out infinite;transform-origin:70% 90%} @keyframes qSw{0%,100%{transform:rotate(25deg)}50%{transform:rotate(-35deg)}}
  #qPick .card[data-pos=keeper] .em{animation:qSl 1.4s ease-in-out infinite} @keyframes qSl{0%,100%{transform:translateX(-16px)}50%{transform:translateX(16px)}}
  #qPick .card[data-pos=seeker] .em{animation:qFl 2s ease-in-out infinite} @keyframes qFl{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(12px,-10px) scale(1.15)}75%{transform:translate(-12px,6px) scale(.9)}}
  #qPick .row{display:flex;gap:14px;justify-content:center;align-items:center;margin-top:14px}
  #qPick .all,#qPick .go{min-height:66px;border-radius:36px;border:4px solid #fff;font:bold 26px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
  #qPick .all{min-width:130px;background:linear-gradient(#b5a0ff,#7a52d6);color:#fff} #qPick .all.sel{border-color:#ffd76a;box-shadow:0 0 0 4px #ffd76a,0 0 24px #ffd76a}
  #qPick .go{min-width:150px;background:linear-gradient(#9effa0,#2fae4a);color:#063;font-size:34px}
  #qPick .x{position:absolute;z-index:2;top:10px;left:10px;width:52px;height:52px;border-radius:50%;border:3px solid #fff;background:rgba(255,255,255,.12);color:#fff;font-size:24px;cursor:pointer;touch-action:manipulation}
  @media (max-height:560px){
    #qPick .p{padding:8px 16px 10px} #qPick .ti{font-size:26px;margin-bottom:6px}
    #qPick .grid{grid-template-columns:repeat(4,150px);gap:10px} #qPick .card{width:150px;height:150px}
    #qPick .card .em{font-size:54px} #qPick .card .nm{font-size:26px} #qPick .row{margin-top:8px} #qPick .all,#qPick .go{min-height:56px}
  }
  @media (max-height:520px){
    #qEnd .p{padding:8px 20px 10px} #qEnd .tr{font-size:56px} #qEnd .ti{font-size:30px} #qEnd .sc{font-size:32px;margin:2px 0} #qEnd .st{font-size:34px}
    #qEnd .row{margin-top:8px} #qEnd button{min-height:60px;min-width:130px;font-size:26px}
  }
  @media (max-width:700px) and (min-height:561px){ #qPick .grid{grid-template-columns:repeat(2,150px)} #qPick .card{width:150px;height:150px} }`;
  document.head.appendChild(css);
  const el = (tag, id, cls, html) => { const e = document.createElement(tag); e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const board = el('div', 'qBoard', '', '<span class="tm"><span class="me">🦁</span><span class="a">0</span></span><span>:</span><span class="tm"><span class="b">0</span><span class="op">' + oppCrest + '</span></span><span class="sn">✨</span>');
  const exitB = el('button', 'qExit', 'gamebtn', '✕'), throwB = el('button', 'qThrow', 'gamebtn', '🤾'), boostB = el('button', 'qBoost', 'gamebtn', '⚡');
  const hint = el('div', 'qHint'), endOv = el('div', 'qEnd'), pickOv = el('div', 'qPick');
  const arrow = el('div', 'qArrow', '', '✨<span class="ar">➤</span>'), arrowAr = arrow.querySelector('.ar');
  exitB.addEventListener('click', e => { e.stopPropagation(); quit(); });
  throwB.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); action(); });
  boostB.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); boost(); });
  addEventListener('keydown', e => { if (!S.on) return; if (e.key === ' ') boost(); if (e.key === 'Enter' || e.key.toLowerCase() === 'f') action(); });
  const elA = board.querySelector('.a'), elB = board.querySelector('.b'), elSn = board.querySelector('.sn'), elMe = board.querySelector('.me');
  const setHint = (t) => { if (hint.textContent !== t) hint.textContent = t; };
  // Spoken Hebrew (voice-first picker). Silent if muted or if the device has no speech.
  function speak(text) {
    try {
      if (window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()) return;
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text); u.lang = 'he-IL'; u.rate = 0.95; u.pitch = 1.2;
      const v = (speechSynthesis.getVoices() || []).find(x => /^(he|iw)/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech here */ }
  }

  // ---------------- state ----------------
  const S = { on: false };
  const P = player.pos, pv = new Vector3(), camPos = new Vector3(), camLook = new Vector3();
  let yaw = 0, bank = 0, T = 0, ROLE = null;
  function reset() {
    const lv = st.qLevel;
    Object.assign(S, { t: 0, a: 0, b: 0, holder: null, stun: 0, boost: 0, boostCd: 0, snitchOn: false, snitchSpd: 13 + lv * 0.9, juke: 0, goals: 0, over: false, shot: null,
      rivalSpd: 9.5 + lv * 1.3, keepSpd: 2.6 + lv * 0.55, save: Math.max(0.25, 0.6 - lv * 0.05), bludGap: Math.max(5, 12 - lv), cheer: 0, kick: 1.6, stealCd: 0, snTarget: new Vector3(), aim: 1, hits: 0, dodges: 0, saves: 0, calm: false, result: null,
      pos: ROLE.id, shots: 0, kp: null, help: { wait: 3, carrier: null, hoop: 1 }, chime: 1, best: 1e9, noProg: 0, arrowOn: false, caughtBy: null,
      passes: 0, catches: 0, myGoals: 0, passOk: false, mateRun: 0, rivalHold: 0, teamSaves: 0, bonks: 0, misses: 0, swing: -1, swingCd: 0, swings: 0, danger: null, nextVictim: 0, frozen: false, camOv: null, batPose: null });
    P.set(C.x - 10, gy + 5, C.z); yaw = Math.PI / 2; pv.set(0, 0, 0);
    quaffle.position.set(C.x, gy + 7, C.z);
    rival.position.set(C.x + 12, gy + 6, C.z); keepA.position.set(GOAL_X - 2.2, gy + 11, C.z); keepB.position.set(HOME_X + 2.2, gy + 11, C.z);
    keepA.rotation.y = -Math.PI / 2; keepB.rotation.y = Math.PI / 2;
    mate.position.set(C.x - 4, gy + 7, C.z - 6); mate.rotation.y = Math.PI / 2; rivalSeeker.position.set(C.x + 4, gy + 9, C.z + 8); rivalSeeker.rotation.y = -Math.PI / 2;
    for (const f of flyers) { f.userData.init = false; f.userData.spin = 0; }
    setSmoulder();
    bludgers.forEach((b, i) => { b.state = 'roam'; b.t = 5 + i * 4; b.victim = null; b.pos.set(C.x + (i ? 14 : -14), gy + 9, C.z + (i ? -10 : 10)); glow(b, 0); });
    throwB.textContent = ROLE.btn || '🤾'; throwB.classList.remove('ready'); warn.scale.setScalar(1);
    if (ROLE.id === 'beater') { bat.visible = true; poseBat(-1); } else dropBat();
    snitch.visible = false; sparkle.visible = false; warn.visible = false; aimRing.visible = false; hoopGlow.visible = false; dots.visible = false; arrow.classList.remove('on');
    elA.textContent = '0'; elB.textContent = '0'; elSn.classList.remove('on'); elMe.textContent = CREST[st.house] || '🦁';
    // `extra` flyers only appear as real riders: their code-chibi fallback would cost too many draw calls
    for (const f of flyers) f.visible = ROLE.cast.includes(f) || (!!ROLE.extra && ROLE.extra.includes(f) && !!f.userData.body.userData.model);
    document.body.classList.toggle('qNoThrow', !ROLE.action);
    ROLE.setup();
    camPos.set(P.x - 9, P.y + 5, P.z); camLook.copy(P);
    if (ROLE.cam) { ROLE.cam(1); }
  }
  function whistle() { fun.sfx.tone(2300, 0.35, 'square', 0.08, 0, 2500); fun.sfx.tone(2300, 0.5, 'square', 0.08, 0.4, 2100); }
  function roar(big) { fun.sfx.noise(big ? 2.4 : 1.3, big ? 0.3 : 0.2, 0, 900, 0.5); fun.sfx.noise(big ? 2.0 : 1.0, 0.12, 0.1, 2200, 0.7); S.cheer = big ? 6 : 2.4; }

  // ---------------- position picker ----------------
  const PICK = {
    chaser: { emoji: '🔴', he: 'רוֹדֵף' }, beater: { emoji: '🏏', he: 'חוֹבֵט' },
    keeper: { emoji: '🧤', he: 'שׁוֹעֵר' }, seeker: { emoji: '✨', he: 'מְחַפֵּשׂ' },
  };
  let pickSel = null;
  const pickOpen = () => pickOv.classList.contains('on');
  function starsOf(pos) { const n = (st.qStars && st.qStars[pos]) || 0; return '⭐'.repeat(n) + '☆'.repeat(3 - n); }
  function openPicker() {
    pickSel = st.qPos && ROLES[st.qPos] && !ROLES[st.qPos].soon ? st.qPos : 'all';
    const cards = POSITIONS.map(pos => {
      const r = ROLES[pos], p = PICK[pos];
      return '<button type="button" class="card' + (r.soon ? ' soon' : '') + '" data-pos="' + pos + '" aria-label="' + p.he + '"><span class="em">' + p.emoji + '</span><span class="nm">' + p.he + '</span><span class="sr">' + (r.soon ? '' : starsOf(pos)) + '</span>' + (r.soon ? '<span class="bd">בְּקָרוֹב</span>' : '') + '</button>';
    }).join('');
    pickOv.innerHTML = '<div class="p"><button type="button" class="x" aria-label="סגור">✕</button><div class="ti">בְּאֵיזֶה תַּפְקִיד נְשַׂחֵק?</div><div class="grid">' + cards
      + '</div><div class="row"><button type="button" class="all" data-pos="all">🎲 הַכֹּל</button><button type="button" class="go" aria-label="שַׂחֵק">▶</button></div></div>';
    pickOv.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); tapPick(b.dataset.pos, b); }));
    pickOv.querySelector('.go').addEventListener('click', e => { e.stopPropagation(); goPick(); });
    pickOv.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); closePicker(); fun.sfx.pop(); });
    markPick(); pickOv.classList.add('on'); if (setModal) setModal(true); fun.sfx.flip();
    speak('בְּאֵיזֶה תַּפְקִיד נְשַׂחֵק?');
  }
  function markPick() { pickOv.querySelectorAll('[data-pos]').forEach(b => b.classList.toggle('sel', b.dataset.pos === pickSel)); }
  function closePicker() { if (!pickOpen()) return; pickOv.classList.remove('on'); if (setModal) setModal(false); }
  function tapPick(pos, btn) {
    const r = ROLES[pos]; if (!r) return;
    if (r.soon) { fun.sfx.squeak(); speak(PICK[pos].he + ', בְּקָרוֹב!'); if (btn) { btn.classList.remove('no'); void btn.offsetWidth; btn.classList.add('no'); } return; }
    if (pickSel === pos) { goPick(); return; }   // second tap starts
    pickSel = pos; markPick(); fun.sfx.pop(); speak(pos === 'all' ? 'הַכֹּל' : PICK[pos].he);
  }
  function goPick() { if (!pickSel) return; const pos = pickSel; closePicker(); st.qPos = pos; fun.save(); begin(pos); }

  // start(): no position → opens the picker (returns true, as before). start(pos) → straight in.
  function start(pos) {
    if (S.on || pickOpen()) return false;
    if (pos == null) { if (isModal()) return false; openPicker(); return true; }
    return begin(pos);
  }
  function begin(pos) {
    if (S.on || isModal()) return false;
    const r = ROLES[pos]; if (!r || r.soon) return false;
    if (interiors.active) interiors.exit();
    ROLE = r; S.on = true; reset(); actors.visible = true; pitch.visible = true; player.ride(true, myBroom);
    document.body.classList.add('inMatch'); endOv.classList.remove('on');
    setTakeover({ update });
    whistle(); fun.toast(r.emoji === '🎲' ? '🧹' : r.emoji, 'קְוִוידִיץ׳!', 1500); setHint(r.hint0);
    return true;
  }
  function leave() {
    S.on = false; actors.visible = false; player.ride(false); player.model.rotation.set(0, 0, 0);
    document.body.classList.remove('inMatch', 'qNoThrow'); throwB.classList.remove('ready'); arrow.classList.remove('on');
    throwB.textContent = '🤾'; dropBat();
    setTakeover(null);
    player.yaw = Math.PI; player.teleport(STAND.x, STAND.z - 3); settleCrowd();
  }
  function quit() { if (!S.on) return; endOv.classList.remove('on'); leave(); }
  function boost() { if (!S.on || S.over || S.boostCd > 0 || S.stun > 0) return false; S.boost = 0.9; S.boostCd = 2.2; fun.sfx.zap(); return true; }
  function action() { return ROLE && ROLE.action ? ROLE.action() : false; }
  function nearestHoop() {
    let best = 1, bd = 1e9; const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let i = 0; i < 3; i++) { const dx = GOAL_X - P.x, dz = C.z + HOOP_DZ[i] - P.z, k = Math.hypot(dx, dz) || 1; const sc = Math.acos(clamp((dx * fx + dz * fz) / k, -1, 1)) + Math.abs(dz) * 0.02; if (sc < bd) { bd = sc; best = i; } }
    return best;
  }
  const inRange = () => S.holder === 'me' && GOAL_X - P.x < 20 && GOAL_X - P.x > 1.5;
  function throwQuaffle() {
    if (!S.on || S.over || S.holder !== 'me' || S.shot) return false;
    if (!inRange()) { setHint('➡️ קָרוֹב יוֹתֵר לַטַּבָּעוֹת!'); fun.sfx.squeak(); return false; }
    const i = S.aim; S.holder = null;
    S.shot = { from: quaffle.position.clone(), to: new Vector3(GOAL_X, gy + HOOP_Y[i], C.z + HOOP_DZ[i]), t: 0, dur: 0.55, by: 'me' };
    fun.sfx.boing(); return true;
  }
  function goal(mine) {
    S.goals++;
    if (mine) { S.a += 10; elA.textContent = S.a; fun.toast('🥅', '+10', 1100); fun.confetti(['🔴', '⭐', '🎉'], 12); roar(false); fun.sfx.tada(); }
    else { S.b += 10; elB.textContent = S.b; fun.sfx.tone(300, 0.4, 'sawtooth', 0.12, 0, 160); }
    S.holder = null; S.shot = null; quaffle.position.set(C.x, gy + 7, C.z); S.kick = 1.4; whistle();
    rival.position.set(C.x + 10, gy + 6, C.z + (Math.random() - 0.5) * 12);
  }
  // a helper goal (Seeker / Keeper matches): smaller fuss than the child's own goal
  function helperGoal(mine) {
    if (mine) { S.a += 10; elA.textContent = S.a; fun.toast('🥅', '+10', 900); roar(false); }
    else { S.b += 10; elB.textContent = S.b; fun.sfx.tone(300, 0.3, 'sawtooth', 0.08, 0, 180); }
  }
  function releaseSnitch() {
    if (S.snitchOn || S.over) return; S.snitchOn = true; snitch.visible = true;
    snitch.position.set(C.x + (Math.random() - 0.5) * 20, gy + 12, C.z + (Math.random() - 0.5) * 16); S.snTarget.copy(snitch.position);
    elSn.classList.add('on'); fun.toast('✨', 'הַסְּנִיץ׳ הַזָּהוֹב!', 1600); fun.sfx.tune([1568, 2093, 2637, 3136], 0.09, 'sine');
  }
  // The end of every match: trophy screen, stars, bonus, save. `stars` per position are kept (best).
  function endScreen(win, stars, levelUp) {
    st.qWins += win ? 1 : 0;
    if (ROLE.id !== 'all') { st.qStars = st.qStars || {}; st.qStars[ROLE.id] = Math.max(st.qStars[ROLE.id] || 0, stars); }
    if (levelUp) st.qLevel = Math.min(8, st.qLevel + 1); fun.save();
    try { window.HPLessons.progress.bonus(win ? 30 : 10); } catch { /* lessons not loaded */ }
    S.result = { a: S.a, b: S.b, win, stars, level: st.qLevel, pos: ROLE.id, saves: S.saves, shots: S.shots, t: Math.round(S.t), goals: S.myGoals, passes: S.passes, bonks: S.bonks };
    const extra = ROLE.id === 'keeper' ? '<div class="sc">🧤 ' + S.saves + ' / ' + KEEPER.shots + '</div>'
      : ROLE.id === 'chaser' ? '<div class="sc">🥅 ' + S.myGoals + ' &nbsp; 🤝 ' + S.passes + '</div>'
      : ROLE.id === 'beater' ? '<div class="sc">🏏 ' + S.bonks + '</div>' : '';
    setTimeout(() => {
      if (!S.on) return;
      endOv.innerHTML = '<div class="p"><div class="tr">🏆</div><div class="ti">' + (win ? 'נִצָּחוֹן!' : 'מִשְׂחָק מְצֻיָּן!') + '</div><div class="sc">' + elMe.textContent + ' ' + S.a + ' : ' + S.b + ' ' + oppCrest + '</div>' + extra + '<div class="st">' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars)
        + '</div><div class="row"><button class="again">🔁 שׁוּב</button><button class="done">סִיּוּם</button></div></div>';
      endOv.querySelector('.again').addEventListener('click', () => { endOv.classList.remove('on'); reset(); whistle(); setHint(ROLE.hint0); });
      endOv.querySelector('.done').addEventListener('click', () => { endOv.classList.remove('on'); leave(); });
      endOv.classList.add('on');
    }, 2600);
  }
  function finish() {   // 'all': the child caught the Snitch (unchanged rules)
    S.over = true; S.a += 150; elA.textContent = S.a; snitch.visible = false; elSn.classList.remove('on'); S.holder = null;
    roar(true); fun.sfx.tada(); fun.confetti(['✨', '🏆', '🎉', '⭐', '💛'], 34);
    const win = S.a > S.b, stars = S.a - S.b >= 150 ? 3 : win ? 2 : 1;
    endScreen(win, stars, win && stars >= 2);
  }
  function steer(obj, tx, ty, tz, spd, dt) {
    tmp.set(tx - obj.position.x, ty - obj.position.y, tz - obj.position.z); const k = tmp.length();
    if (k > 0.05) { obj.rotation.y = Math.atan2(tmp.x, tmp.z); tmp.multiplyScalar(Math.min(1, spd * dt / k)); obj.position.add(tmp); }
    return k;
  }

  // ---------------- shared pieces the roles use ----------------
  // Bludgers: roam, and (if `charge`) every so often glow, aim at you and charge. A hit = 1 s spin.
  // saveChance (Chaser): that share of the charges is stopped by a team Beater before it starts.
  function bludgerStep(dt, t, charge = true, gapMul = 1, saveChance = 0) {
    for (const b of bludgers) {
      b.t -= dt;
      if (b.state === 'roam') {
        b.pos.set(C.x + Math.sin(t * 0.5 + b.ph) * 22, gy + 9 + Math.sin(t * 0.9 + b.ph) * 3, C.z + Math.cos(t * 0.37 + b.ph * 2) * 15);
        if (charge && b.t <= 0 && !S.over && S.stun <= 0 && !S.calm) {
          if (saveChance > 0 && Math.random() < saveChance) { S.teamSaves++; b.t = S.bludGap * gapMul * (0.7 + Math.random() * 0.6); fun.sfx.boing(); fun.toast('🏏', 'הַחוֹבֵט שֶׁלָּנוּ הִצִּיל!', 1100); continue; }
          b.state = 'aim'; b.t = 1.15; fun.sfx.tone(700, 1.0, 'sawtooth', 0.07, 0, 1500);
        }
      } else if (b.state === 'aim') {
        glow(b, 1.5 + Math.sin(t * 30)); warn.visible = true; warn.position.set(P.x, P.y + 3.4, P.z); warn.rotation.y = t * 6;
        if (b.t <= 0) { b.dir.set(P.x - b.pos.x, P.y + 1 - b.pos.y, P.z - b.pos.z).normalize(); b.state = 'charge'; b.t = 1.5; b.hit = false; }
      } else {
        b.pos.addScaledVector(b.dir, 30 * dt); warn.visible = false;
        if (!b.hit && S.stun <= 0 && Math.hypot(b.pos.x - P.x, (b.pos.y - P.y - 1) * 0.5, b.pos.z - P.z) < 1.9) {   // forgiving in height: the broom picks its own altitude
          b.hit = true; S.stun = 1.0; S.hits++; fun.sfx.burp(); fun.sfx.yelp();
          if (S.holder === 'me') { S.holder = null; S.kick = 0.9; quaffle.position.set(P.x + 3, P.y, P.z + 3); clampArena(quaffle.position); }
        }
        if (b.t <= 0) { if (!b.hit) { S.dodges++; if (!S.over) { roar(false); fun.toast('💨', 'אוֹלֶה!', 800); } }   // the crowd loves a good dodge
          b.state = 'roam'; b.t = S.bludGap * gapMul * (0.7 + Math.random() * 0.6); glow(b, 0); }
      }
      b.g.rotation.y += dt * 2;
    }
    if (!bludgers.some(b => b.state === 'aim')) warn.visible = false;
  }
  // Scripted helper Chasers (Seeker/Keeper matches): one side carries the Quaffle to a hoop and
  // scores, then a pause. The team is favoured whenever it is not ahead, so the child's side is
  // usually level or in front. teamOnly: only our Chaser attacks (the rival is busy elsewhere).
  function helperPlay(dt, teamOnly) {
    const H = S.help;
    if (S.over) return;
    if (!H.carrier) {
      H.wait -= dt;
      if (!teamOnly) quaffle.position.set(C.x + Math.sin(T * 0.8) * 1.5, gy + 7 + Math.sin(T * 2) * 0.4, C.z);
      steer(mate, C.x - 6, gy + 7, C.z - 5 + Math.sin(T * 0.6) * 2, 5, dt);
      if (!teamOnly) steer(rival, C.x + 6, gy + 7, C.z + 5 + Math.cos(T * 0.6) * 2, 5, dt);
      if (H.wait <= 0) { H.carrier = teamOnly || S.a <= S.b ? 'mate' : (Math.random() < 0.6 ? 'mate' : 'rival'); H.hoop = (Math.random() * 3) | 0; }
      if (!teamOnly) S.holder = null;
      return;
    }
    const mine = H.carrier === 'mate', car = mine ? mate : rival, other = mine ? rival : mate;
    const gx = mine ? GOAL_X - 7 : HOME_X + 7, tz = C.z + HOOP_DZ[H.hoop], ty = gy + HOOP_Y[H.hoop];
    const k = steer(car, gx, ty, tz, 5.5, dt);
    if (!teamOnly || !mine) steer(other, car.position.x - (mine ? 3 : -3), car.position.y, car.position.z + 2.5, 5.2, dt);
    if (!teamOnly) { quaffle.position.set(car.position.x, car.position.y + 1.5, car.position.z); S.holder = H.carrier; }   // (Keeper match: the Quaffle is the shooter's)
    if (k < 0.8) { helperGoal(mine); H.carrier = null; H.wait = (mine ? 6 : 7) + Math.random() * 3; if (teamOnly && S.a <= S.b) H.wait = 3.5; }
  }
  function keepersIdle(t) {
    keepA.position.z = C.z + Math.sin(t * 0.8) * 5; keepA.position.y = gy + 11 + Math.sin(t * 2) * 0.3;
    keepB.position.z = C.z + Math.sin(t * 0.9 + 1) * 5; keepB.position.y = gy + 11 + Math.cos(t * 2) * 0.3;
  }
  function snitchWingsStep(t) {
    for (const w of wings) w.rotation.z = w.userData.s * Math.sin(t * 40) * 0.9;
    if (snitchWings) snitchWings.scale.set(1, 1, 0.35 + Math.abs(Math.sin(t * 40)) * 0.65);
  }

  // ---------------- the ROLES ----------------
  const ROLES = {};
  // 'all': today's mixed match, byte-for-byte the same rules.
  ROLES.all = {
    id: 'all', he: 'הַכֹּל', emoji: '🎲', hint0: '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!', cast: [rival, keepA, keepB],
    action: throwQuaffle, fly: true,
    setup() {},
    wantY() {
      if (S.holder === 'me') return gy + 7 + 4.5 * clamp(1 - (GOAL_X - P.x) / 22, 0, 1);
      const dq = quaffle.position.distanceTo(P), ds = S.snitchOn ? snitch.position.distanceTo(P) : 1e9;
      return ds < dq * 1.3 ? snitch.position.y : (S.holder === 'rival' ? rival.position.y : quaffle.position.y);
    },
    update(dt, t) {
      // ---- Quaffle ----
      if (S.shot) {
        const s = S.shot; s.t += dt; const k = Math.min(1, s.t / s.dur);
        quaffle.position.lerpVectors(s.from, s.to, k); quaffle.position.y += Math.sin(k * Math.PI) * 1.6;
        if (k >= 1) {
          if (s.by === 'me') { if (Math.abs(keepA.position.z - s.to.z) < 2.4) { S.shot = null; quaffle.position.set(GOAL_X - 6, gy + 8, C.z + (Math.random() - 0.5) * 10); fun.sfx.boing(); fun.toast('🧤', '', 800); S.saves++; setHint('הַשּׁוֹעֵר עָצַר! כַּוְּנוּ לְטַבַּעַת רֵיקָה'); S.kick = 0.6; } else goal(true); }
          else if (Math.random() < S.save) { S.shot = null; quaffle.position.set(HOME_X + 7, gy + 8, C.z); fun.sfx.boing(); S.kick = 0.5; } else goal(false);
        }
      } else if (S.holder === 'me') {
        quaffle.position.set(P.x + Math.sin(yaw) * 0.9, P.y + 1.5, P.z + Math.cos(yaw) * 0.9);
        S.aim = nearestHoop(); const ok = inRange(); throwB.classList.toggle('ready', ok);
        aimRing.visible = ok; if (ok) { aimRing.position.set(GOAL_X - 0.2, gy + HOOP_Y[S.aim], C.z + HOOP_DZ[S.aim]); aimRing.scale.setScalar(1 + Math.sin(t * 9) * 0.08); }
        setHint(ok ? '🤾 זִרְקוּ לַטַּבַּעַת!' : '➡️ טוּסוּ לַטַּבָּעוֹת!');
      } else {
        throwB.classList.remove('ready'); aimRing.visible = false;
        if (S.holder === 'rival') quaffle.position.set(rival.position.x, rival.position.y + 1.5, rival.position.z);
        else if (S.kick <= 0 && S.stun <= 0 && quaffle.position.distanceTo(P) < 2.4) { S.holder = 'me'; fun.sfx.pop(); }
        if (!S.over) setHint(S.snitchOn ? '✨ תִּפְסוּ אֶת הַסְּנִיץ׳!' : S.holder === 'rival' ? '💥 הִתְנַגְּשׁוּ בַּיָּרִיב לַחֲטֹף!' : '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!');
      }
      quaffle.rotation.y += dt * 3;
      // ---- rival Chaser ----
      if (!S.over && !S.calm) {
        if (S.holder === 'rival') {
          const k = steer(rival, HOME_X + 9, gy + 11, C.z + Math.sin(S.t * 0.7) * 5, S.rivalSpd * 0.9, dt);
          if (rival.position.x < HOME_X + 13 || k < 1) { S.holder = null; const i = (Math.random() * 3) | 0; S.shot = { from: quaffle.position.clone(), to: new Vector3(HOME_X, gy + HOOP_Y[i], C.z + HOOP_DZ[i]), t: 0, dur: 0.6, by: 'rival' }; }
          else if (S.stealCd <= 0 && S.stun <= 0 && rival.position.distanceTo(P) < 2.3) { S.holder = 'me'; S.stealCd = 1.5; fun.sfx.boing(); fun.toast('💪', '', 700); }
        } else if (S.holder === 'me') {
          steer(rival, P.x + pv.x * 0.4, P.y, P.z + pv.z * 0.4, S.rivalSpd * 0.8, dt);
          if (S.stealCd <= 0 && rival.position.distanceTo(P) < 1.7) { S.holder = 'rival'; S.stealCd = 1.6; fun.sfx.yelp(); }
        } else if (!S.shot && S.kick <= 0.4) {
          if (steer(rival, quaffle.position.x, quaffle.position.y - 1, quaffle.position.z, S.rivalSpd, dt) < 1.6 && S.kick <= 0) S.holder = 'rival';
        }
      }
      const kz = S.holder === 'me' ? C.z + HOOP_DZ[S.aim] : C.z + Math.sin(t * 0.8) * 5;
      keepA.position.z += clamp(kz - keepA.position.z, -S.keepSpd * dt, S.keepSpd * dt); keepA.position.y = gy + 11 + Math.sin(t * 2) * 0.3;
      keepB.position.z = C.z + Math.sin(t * 0.9 + 1) * 5; keepB.position.y = gy + 11 + Math.cos(t * 2) * 0.3;
      // ---- Bludgers ----
      bludgerStep(dt, t, true, 1);
      // ---- Golden Snitch ----
      if (!S.snitchOn && !S.over && !S.calm && (S.t > 55 || S.goals >= 3)) releaseSnitch();
      if (S.snitchOn && !S.over) {
        const ds = snitch.position.distanceTo(tmp.set(P.x, P.y + 1.2, P.z)); S.juke -= dt;
        if (snitch.position.distanceTo(S.snTarget) < 1.5 || (ds < 6 && S.juke <= 0)) {
          if (ds < 6) { S.juke = 1.3; S.snitchSpd = Math.max(9.5, S.snitchSpd * 0.95); }
          S.snTarget.set(C.x + (Math.random() - 0.5) * AX * 1.6, gy + 5 + Math.random() * 9, C.z + (Math.random() - 0.5) * AZ * 1.6); clampArena(S.snTarget);
        }
        if (S.t > 150) S.snitchSpd = Math.min(S.snitchSpd, 9);
        tmp2.subVectors(S.snTarget, snitch.position); const dl = tmp2.length() || 1;
        snitch.position.addScaledVector(tmp2, Math.min(1, S.snitchSpd * dt / dl));
        snitchWingsStep(t);
        if (ds < 2.1 && S.stun <= 0) finish();
      }
    },
  };

  // 'seeker': find and catch the Snitch. Hot/cold chime, ✨ edge arrow after 10 s without progress,
  // a rival Seeker who is always late on levels 1 to 3, helpers keep the score moving.
  function seekerEnd(mine) {
    S.over = true; S.caughtBy = mine ? 'me' : 'rival'; snitch.visible = false; elSn.classList.remove('on'); arrow.classList.remove('on'); S.holder = null;
    if (mine) { S.a += 150; elA.textContent = S.a; roar(true); fun.sfx.tada(); fun.confetti(['✨', '🏆', '🎉', '⭐', '💛'], 34); }
    else { S.b += 150; elB.textContent = S.b; roar(false); fun.toast('😮', 'הַמְחַפֵּשׂ שֶׁלָּהֶם תָּפַס!', 1600); }
    const stars = !mine ? 1 : S.t < 40 ? 3 : S.t < 70 ? 2 : 1;
    endScreen(mine && S.a > S.b, stars, mine && stars >= 2);
  }
  function newSnitchTarget(far) {
    for (let i = 0; i < 6; i++) {
      S.snTarget.set(C.x + (Math.random() - 0.5) * AX * 1.6, gy + 4 + Math.random() * 10, C.z + (Math.random() - 0.5) * AZ * 1.6); clampArena(S.snTarget);
      if (!far || S.snTarget.distanceTo(P) > 14) break;
    }
  }
  function placeArrow() {
    tmp.copy(snitch.position).project(camera);
    let x = tmp.x, y = tmp.y; const behind = tmp.z > 1;
    if (behind) { x = -x; y = -y; }
    const onScreen = !behind && Math.abs(x) < 0.85 && Math.abs(y) < 0.8;
    const ang = Math.atan2(-y, x);   // screen angle (y down)
    if (!onScreen) { const k = 0.86 / Math.max(Math.abs(x), Math.abs(y), 1e-3); x *= k; y *= k; }
    arrow.style.left = ((clamp(x, -0.9, 0.9) * 0.5 + 0.5) * innerWidth) + 'px';
    arrow.style.top = ((-clamp(y, -0.86, 0.86) * 0.5 + 0.5) * innerHeight) + 'px';
    arrowAr.style.transform = onScreen ? 'translateY(-46px) rotate(90deg)' : 'rotate(' + ang + 'rad) translateX(46px)';
  }
  ROLES.seeker = {
    id: 'seeker', he: 'מְחַפֵּשׂ', emoji: '✨', hint0: '✨ חַפְּשׂוּ אֶת הַסְּנִיץ׳!', cast: [rival, mate, rivalSeeker], extra: [keepA, keepB],
    action: null, fly: true,
    setup() {
      const lv = st.qLevel;
      S.snitchSpd = 6 + lv * 1.0; S.bludGap = Math.max(8, 14 - lv);
      bludgers.forEach((b, i) => { b.t = 12 + i * 7; });
      S.snitchOn = true; snitch.visible = true; sparkle.visible = true; elSn.classList.add('on');
      newSnitchTarget(true); snitch.position.copy(S.snTarget); newSnitchTarget(true);
      S.best = snitch.position.distanceTo(P);
    },
    wantY() { return snitch.position.y; },
    update(dt, t) {
      helperPlay(dt, false); keepersIdle(t); quaffle.rotation.y += dt * 3;
      bludgerStep(dt, t, true, 1.6);
      if (S.over) return;
      const lv = st.qLevel, ds = snitch.position.distanceTo(tmp.set(P.x, P.y + 1.2, P.z));
      // the Snitch: wanders, jukes away when you get close; slowed for little levels, crawls after 100 s
      S.juke -= dt;
      const crawl = S.t > 100;
      if (snitch.position.distanceTo(S.snTarget) < 1.5 || (!crawl && ds < 6.5 && S.juke <= 0)) {
        if (ds < 6.5) { S.juke = 1.6; S.snitchSpd = Math.max(5, S.snitchSpd * 0.95); }
        newSnitchTarget(false);
      }
      const spd = crawl ? Math.min(S.snitchSpd, 2.2) : S.snitchSpd;
      tmp2.subVectors(S.snTarget, snitch.position); const dl = tmp2.length() || 1;
      snitch.position.addScaledVector(tmp2, Math.min(1, spd * dt / dl));
      snitchWingsStep(t);
      sparkle.scale.setScalar(2.2 + Math.abs(Math.sin(t * 5)) * 2.4); sparkle.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.3));
      // hot / cold chime: faster and louder as you close in
      const close = clamp(1 - ds / 45, 0, 1);
      S.chime -= dt; if (S.chime <= 0) { fun.sfx.tone(1568 + close * 1600, 0.14, 'sine', 0.02 + close * 0.12); S.chime = 1.6 - close * 1.25; }
      // ✨ arrow at the screen edge after 10 s without getting 3 m closer
      if (ds < S.best - 3) { S.best = ds; S.noProg = 0; } else S.noProg += dt;
      S.arrowOn = S.noProg > 10 && ds > 7;
      arrow.classList.toggle('on', S.arrowOn); if (S.arrowOn) placeArrow();
      setHint(ds < 10 ? '🔥 חַם מְאוֹד! תִּפְסוּ!' : ds < 22 ? '🙂 חַם... קְרוֹבִים!' : '❄️ קַר... חַפְּשׂוּ אֶת הַ✨');
      // the rival Seeker: on levels 1 to 3 (and before 60 s) he always stays a few metres behind it
      const late = lv <= 3 || S.t < 60;
      tmp2.subVectors(rivalSeeker.position, snitch.position); const rd = tmp2.length() || 1;
      const hold = late ? 5 : 0;
      const tx = snitch.position.x + tmp2.x / rd * hold, ty = snitch.position.y + tmp2.y / rd * hold, tz = snitch.position.z + tmp2.z / rd * hold;
      steer(rivalSeeker, tx, ty, tz, Math.max(4, spd * (late ? 0.85 : 0.95)), dt);
      if (ds < 2.1 && S.stun <= 0) seekerEnd(true);
      else if (!late && rd < 1.4 && !S.calm) seekerEnd(false);
    },
  };

  // 'keeper': guard the home hoops. Camera behind the hoops; the stick slides you across them.
  function keeperEnd() {
    S.over = true; hoopGlow.visible = false; dots.visible = false; S.holder = null;
    roar(true); fun.sfx.tada(); fun.confetti(['🧤', '🏆', '🎉', '⭐'], 30);
    const stars = S.saves >= 7 ? 3 : S.saves >= 4 ? 2 : 1;
    endScreen(S.a > S.b, stars, stars >= 2);
  }
  function keeperShot(i) {   // the rival lines up a shot at hoop i (wind-up: glow + dotted line)
    S.kp = { phase: 'windup', t: KEEPER.windup, hoop: i };
    fun.sfx.tone(520, 0.5, 'triangle', 0.06, 0, 880);
  }
  function setDots(from, to, t) {
    for (let i = 0; i < DOTS; i++) {
      const k = (i + (t * 2.5) % 1) / DOTS;
      d.position.lerpVectors(from, to, k); d.position.y += Math.sin(k * Math.PI) * 1.0; d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); dots.setMatrixAt(i, d.matrix);
    }
    dots.instanceMatrix.needsUpdate = true;
  }
  ROLES.keeper = {
    id: 'keeper', he: 'שׁוֹעֵר', emoji: '🧤', hint0: '🧤 עִצְרוּ אֶת הַכַּדּוּר!', cast: [rival, mate, keepA],
    action: null, fly: false,
    setup() {
      P.set(KEEPER.x, gy + 11.5, C.z); yaw = Math.PI / 2;
      S.kp = { phase: 'approach', t: 2.4, hoop: (Math.random() * 3) | 0, sz: 0 };
      rival.position.set(C.x - 2, gy + 9, C.z); S.holder = 'rival';
      S.help.wait = 6;
    },
    move(dt, ax) {
      const sp = S.boost > 0 ? 17 : 8.5;
      if (S.stun > 0) { S.stun -= dt; pv.multiplyScalar(1 - dt * 3); }
      else if (!S.over) {
        pv.z += (ax.x * sp - pv.z) * Math.min(1, dt * 8);
        const wy = Math.abs(ax.y) > 0.1 ? ax.y * 5 : 0;
        pv.y += (wy - pv.y) * Math.min(1, dt * 8);
      } else pv.multiplyScalar(1 - dt * 4);
      P.z = clamp(P.z + pv.z * dt, C.z - KEEPER.zMax, C.z + KEEPER.zMax);
      P.y += pv.y * dt;
      // with the stick idle the broom drifts to the height of the glowing hoop (forgiving)
      const k = S.kp, home = gy + (k && k.phase !== 'approach' ? HOOP_Y[k.hoop] - 0.6 : 11.3);
      if (Math.abs(ax.y) < 0.1) P.y += (home - P.y) * Math.min(1, dt * 1.6);
      P.y = clamp(P.y, gy + KEEPER.yMin, gy + KEEPER.yMax);
      P.x += (KEEPER.x - P.x) * Math.min(1, dt * 4);
      yaw = Math.PI / 2; bank += (clamp(pv.z * 0.05, -0.5, 0.5) - bank) * Math.min(1, dt * 6);
    },
    update(dt, t) {
      helperPlay(dt, true); keepA.position.z = C.z + Math.sin(t * 0.8) * 5; keepA.position.y = gy + 11 + Math.sin(t * 2) * 0.3;
      bludgerStep(dt, t, false);
      const k = S.kp; if (!k || S.over) return;
      quaffle.rotation.y += dt * 3;
      const lv = st.qLevel, ring = tmp3.set(HOME_X, gy + HOOP_Y[k.hoop], C.z + HOOP_DZ[k.hoop]);
      if (k.phase === 'approach') {
        k.t -= dt;
        const sx = HOME_X + 13, sz = C.z + HOOP_DZ[k.hoop] * 0.6 + Math.sin(S.t) * 1.5, sy = gy + HOOP_Y[k.hoop] - 0.5;
        steer(rival, sx, sy, sz, 9 + lv, dt);
        quaffle.position.set(rival.position.x, rival.position.y + 1.5, rival.position.z); S.holder = 'rival';
        setHint('👀 לְאָן הוּא יִזְרֹק?');
        if (k.t <= 0 && rival.position.distanceTo(tmp.set(sx, sy, sz)) < 2.5) keeperShot(k.hoop);
      } else if (k.phase === 'windup') {
        k.t -= dt;
        rival.rotation.y = Math.atan2(ring.x - rival.position.x, ring.z - rival.position.z);
        rival.position.y += Math.sin(t * 14) * 0.02;
        quaffle.position.set(rival.position.x, rival.position.y + 1.5 + (1 - k.t / KEEPER.windup) * 0.8, rival.position.z);
        hoopGlow.visible = true; hoopGlow.position.copy(ring); hoopGlow.position.x += 0.2; hoopGlow.scale.setScalar(1 + Math.sin(t * 10) * 0.1);
        dots.visible = true; setDots(quaffle.position, ring, t);
        setHint('🧤 לַטַּבַּעַת הַזּוֹהֶרֶת!');
        if (k.t <= 0) { k.phase = 'shot'; k.from = quaffle.position.clone(); k.to = ring.clone(); k.t = 0; k.dur = Math.max(0.75, 1.5 - lv * 0.09); S.holder = null; S.shot = { by: 'rival' }; fun.sfx.boing(); }
      } else if (k.phase === 'shot') {
        k.t += dt; const f = Math.min(1, k.t / k.dur);
        quaffle.position.lerpVectors(k.from, k.to, f); quaffle.position.y += Math.sin(f * Math.PI) * 1.0;
        dots.visible = true; setDots(k.from, k.to, t);
        const me = tmp.set(P.x, P.y + 1.0, P.z);
        if (Math.hypot(quaffle.position.x - me.x, (quaffle.position.y - me.y) * 0.7, quaffle.position.z - me.z) < KEEPER.saveR && S.stun <= 0) {
          S.saves++; S.shots++; S.shot = null; fun.sfx.boing(); fun.sfx.pop(); fun.toast('🧤', 'עֲצִירָה!', 900); roar(false);
          k.phase = 'bounce'; k.from = quaffle.position.clone(); k.to = new Vector3(HOME_X + 16, gy + 6, C.z + (Math.random() - 0.5) * 10); k.t = 0; k.dur = 0.9;
          hoopGlow.visible = false; dots.visible = false;
        } else if (f >= 1) {
          S.shots++; S.shot = null; helperGoal(false); setHint('לֹא נוֹרָא! הַבָּא 💪');
          k.phase = 'rest'; k.t = 1.6; hoopGlow.visible = false; dots.visible = false;
        }
      } else if (k.phase === 'bounce') {
        k.t += dt; const f = Math.min(1, k.t / k.dur);
        quaffle.position.lerpVectors(k.from, k.to, f); quaffle.position.y += Math.sin(f * Math.PI) * 2.5;
        if (f >= 1) { k.phase = 'rest'; k.t = 1.0; }
      } else if (k.phase === 'rest') {
        k.t -= dt;
        steer(rival, C.x - 4, gy + 9, C.z, 8, dt);
        if (k.t <= 0) {
          if (S.shots >= KEEPER.shots) { keeperEnd(); return; }
          S.kp = { phase: 'approach', t: S.calm ? 1e9 : 1.4 + Math.random(), hoop: (Math.random() * 3) | 0 };
        }
      }
    },
    cam(dt) {
      const a = dt >= 1 ? 1 : 1 - Math.exp(-dt * 4);
      // high behind the hoops, looking over them at the pitch: you see yourself, the hoops and the shooter
      camPos.lerp(tmp.set(HOME_X - 9, P.y + 6.5, P.z), a);
      camLook.lerp(tmp2.set(P.x + 16, P.y - 1.5, C.z + (P.z - C.z) * 0.6), a);
    },
  };
  // 'chaser': Quaffle play without the Snitch, with our Chaser (`mate`) to pass to. A shot in
  // flight is S.shot { by, target?, from, to, t, dur }: no target = a throw at a hoop (as in 'all');
  // target 'mate' / 'me' = a pass that homes onto the receiver every frame.
  function chaserEnd() {
    S.over = true; S.holder = null; S.shot = null; aimRing.visible = false; throwB.classList.remove('ready');
    roar(true); fun.sfx.tada(); fun.confetti(['🔴', '🏆', '🎉', '⭐'], 30);
    const stars = S.myGoals >= 4 ? 3 : S.myGoals >= 2 ? 2 : 1;
    endScreen(S.a > S.b, stars, stars >= 3);   // easier role: only a 3-star match raises the shared level
  }
  function passTo(by, target, dur) {
    S.holder = null; S.shot = { by, target, from: quaffle.position.clone(), to: new Vector3(), t: 0, dur }; fun.sfx.boing();
  }
  function passToMate() {
    if (!S.on || S.over || ROLE.id !== 'chaser' || S.holder !== 'me' || S.shot) return false;
    passTo('me', 'mate', clamp(mate.position.distanceTo(P) / 20, 0.45, 1.1));
    S.passes++; S.stealCd = 1.5; S.mateRun = 0; fun.toast('🤝', '', 600); setHint('🤝 יָפֶה! עַכְשָׁו טוּסוּ לַטַּבָּעוֹת!');
    return true;
  }
  function chaserAction() {
    if (!S.on || S.over) return false;
    if (S.holder === 'me' && !inRange() && rival.position.distanceTo(P) < CHASER.passR) return passToMate();
    return throwQuaffle();
  }
  ROLES.chaser = {
    id: 'chaser', he: 'רוֹדֵף', emoji: '🔴', hint0: '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!', cast: [rival, keepA, keepB, mate],
    action: chaserAction, fly: true, btn: '🤾',
    setup() { S.bludGap = Math.max(9, 15 - st.qLevel); bludgers.forEach((b, i) => { b.t = 10 + i * 6; }); },
    wantY() {
      if (S.holder === 'me') return gy + 7 + 4.5 * clamp(1 - (GOAL_X - P.x) / 22, 0, 1);
      if (S.holder === 'mate') return mate.position.y;
      return S.holder === 'rival' ? rival.position.y : quaffle.position.y;
    },
    update(dt, t) {
      if (!S.over && (S.t >= CHASER.len || S.myGoals >= CHASER.goals)) chaserEnd();
      const lv = st.qLevel;
      // ---- Quaffle ----
      if (S.shot) {
        const s = S.shot; s.t += dt; let k = Math.min(1, s.t / s.dur);
        if (s.target === 'mate') s.to.set(mate.position.x, mate.position.y + 1.5, mate.position.z);
        else if (s.target === 'me') s.to.set(P.x, P.y + 1.5, P.z);
        quaffle.position.lerpVectors(s.from, s.to, k); quaffle.position.y += Math.sin(k * Math.PI) * (s.target ? 2.2 : 1.6);
        // a pass to you: flying into the ball catches it early
        if (s.target === 'me' && k > 0.2 && S.stun <= 0 && quaffle.position.distanceTo(tmp.set(P.x, P.y + 1.5, P.z)) < CHASER.catchR) k = 1;
        if (k >= 1) {
          if (s.target === 'mate') { S.shot = null; S.holder = 'mate'; S.mateRun = 0; fun.sfx.pop(); }
          else if (s.target === 'me') {
            S.shot = null;
            if (S.stun <= 0) { S.holder = 'me'; S.catches++; fun.sfx.pop(); fun.toast('🙌', '', 700); }
            else { S.kick = 0.8; quaffle.position.set(P.x + 2, P.y + 1, P.z + 2); clampArena(quaffle.position); }
          } else if (s.by === 'me') {
            if (Math.abs(keepA.position.z - s.to.z) < 2.4) { S.shot = null; quaffle.position.set(GOAL_X - 6, gy + 8, C.z + (Math.random() - 0.5) * 10); fun.sfx.boing(); fun.toast('🧤', '', 800); S.saves++; setHint('הַשּׁוֹעֵר עָצַר! כַּוְּנוּ לְטַבַּעַת רֵיקָה'); S.kick = 0.6; }
            else { S.myGoals++; goal(true); }
          } else if (Math.random() < S.save) { S.shot = null; quaffle.position.set(HOME_X + 7, gy + 8, C.z); fun.sfx.boing(); S.kick = 0.5; }
          else goal(false);
        }
      } else if (S.holder === 'me') {
        quaffle.position.set(P.x + Math.sin(yaw) * 0.9, P.y + 1.5, P.z + Math.cos(yaw) * 0.9);
        S.aim = nearestHoop(); const ok = inRange();
        S.passOk = !ok && rival.position.distanceTo(P) < CHASER.passR;
        const btn = S.passOk ? '🤝' : '🤾'; if (throwB.textContent !== btn) throwB.textContent = btn;
        throwB.classList.toggle('ready', ok || S.passOk);
        aimRing.visible = ok; if (ok) { aimRing.position.set(GOAL_X - 0.2, gy + HOOP_Y[S.aim], C.z + HOOP_DZ[S.aim]); aimRing.scale.setScalar(1 + Math.sin(t * 9) * 0.08); }
        if (!S.over) setHint(ok ? '🤾 זִרְקוּ לַטַּבַּעַת!' : S.passOk ? '🤝 מִסְרוּ לֶחָבֵר!' : '➡️ טוּסוּ לַטַּבָּעוֹת!');
      } else {
        S.passOk = false; throwB.classList.remove('ready'); aimRing.visible = false; if (throwB.textContent !== '🤾') throwB.textContent = '🤾';
        if (S.holder === 'rival') quaffle.position.set(rival.position.x, rival.position.y + 1.5, rival.position.z);
        else if (S.holder === 'mate') quaffle.position.set(mate.position.x, mate.position.y + 1.5, mate.position.z);
        else if (!S.over && S.kick <= 0 && S.stun <= 0 && quaffle.position.distanceTo(P) < 2.4) { S.holder = 'me'; fun.sfx.pop(); }
        if (!S.over) setHint(S.holder === 'mate' ? '➡️ טוּסוּ לַטַּבָּעוֹת, הַחָבֵר יִמְסֹר!' : S.holder === 'rival' ? '💥 הִתְנַגְּשׁוּ בַּיָּרִיב לַחֲטֹף!' : '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!');
      }
      quaffle.rotation.y += dt * 3;
      // ---- our Chaser (the mate) ----
      if (!S.over) {
        const side = P.z > C.z ? -1 : 1;
        if (S.holder === 'mate') {
          // runs ahead to the hoops, then passes back (the ball homes onto you)
          S.mateRun += dt;
          const k = steer(mate, GOAL_X - 10, gy + 10, C.z + side * 4, 13 + lv * 0.5, dt);
          const dMe = mate.position.distanceTo(P);
          if ((k < 2.5 && (dMe < 20 || S.mateRun > 6)) || S.mateRun > 8) {
            passTo('mate', 'me', clamp(dMe / 16, 0.6, 1.6)); setHint('🙌 תִּפְסוּ אֶת הַמְּסִירָה!');
          }
        } else if (!S.shot && !S.holder && S.kick <= 0.4 && quaffle.position.distanceTo(P) > 8) {
          // a loose ball you are far from: the mate goes for it too (a bit slower than the rival)
          if (steer(mate, quaffle.position.x, quaffle.position.y - 1, quaffle.position.z, S.rivalSpd * 0.75, dt) < 1.6 && S.kick <= 0) { S.holder = 'mate'; S.mateRun = 0; }
        } else if (S.holder === 'rival' && S.rivalHold > 4) {
          // the rival has had it a while: the mate tackles and takes it back
          if (steer(mate, rival.position.x, rival.position.y, rival.position.z, S.rivalSpd * 1.05, dt) < 1.7) { S.holder = 'mate'; S.mateRun = 0; S.stealCd = 1.5; fun.sfx.boing(); fun.toast('💪', '', 700); }
        } else {
          // support: a little ahead of you towards the hoops and off to the side, ready for a pass
          steer(mate, Math.min(P.x + 9, GOAL_X - 8), clamp(P.y + 0.5, gy + 5, gy + 13), clamp(P.z + side * 5, C.z - 14, C.z + 14), 14 + lv * 0.4, dt);
        }
      }
      // ---- rival Chaser (as in 'all'; it never steals from the mate) ----
      S.rivalHold = S.holder === 'rival' ? S.rivalHold + dt : 0;
      if (!S.over && !S.calm) {
        if (S.holder === 'rival') {
          const k = steer(rival, HOME_X + 9, gy + 11, C.z + Math.sin(S.t * 0.7) * 5, S.rivalSpd * 0.9, dt);
          if (rival.position.x < HOME_X + 13 || k < 1) { S.holder = null; const i = (Math.random() * 3) | 0; S.shot = { from: quaffle.position.clone(), to: new Vector3(HOME_X, gy + HOOP_Y[i], C.z + HOOP_DZ[i]), t: 0, dur: 0.6, by: 'rival' }; }
          else if (S.stealCd <= 0 && S.stun <= 0 && rival.position.distanceTo(P) < 2.3) { S.holder = 'me'; S.stealCd = 1.5; fun.sfx.boing(); fun.toast('💪', '', 700); }
        } else if (S.holder === 'me') {
          steer(rival, P.x + pv.x * 0.4, P.y, P.z + pv.z * 0.4, S.rivalSpd * 0.8, dt);
          if (S.stealCd <= 0 && rival.position.distanceTo(P) < 1.7) { S.holder = 'rival'; S.stealCd = 1.6; fun.sfx.yelp(); }
        } else if (S.holder === 'mate') {
          steer(rival, mate.position.x - 4, mate.position.y, mate.position.z + 3, S.rivalSpd * 0.55, dt);
        } else if (!S.shot && S.kick <= 0.4) {
          if (steer(rival, quaffle.position.x, quaffle.position.y - 1, quaffle.position.z, S.rivalSpd, dt) < 1.6 && S.kick <= 0) S.holder = 'rival';
        }
      }
      const kz = S.holder === 'me' ? C.z + HOOP_DZ[S.aim] : C.z + Math.sin(t * 0.8) * 5;
      keepA.position.z += clamp(kz - keepA.position.z, -S.keepSpd * dt, S.keepSpd * dt); keepA.position.y = gy + 11 + Math.sin(t * 2) * 0.3;
      keepB.position.z = C.z + Math.sin(t * 0.9 + 1) * 5; keepB.position.y = gy + 11 + Math.cos(t * 2) * 0.3;
      // ---- Bludgers: less often, and a team Beater stops half of them ----
      bludgerStep(dt, t, true, 1, CHASER.save);
    },
  };

  // 'beater': Bludgers go for our team-mates (mate = our Chaser, keepB = our Keeper). One at a
  // time: it glows (aim), then homes onto its victim. Swing 🏏 within BEATER.reach to bonk it away.
  const TEAM = [mate, keepB];
  function beaterEnd() {
    S.over = true; S.danger = null; warn.visible = false; throwB.classList.remove('ready');
    for (const b of bludgers) if (b.state !== 'fly') { b.state = 'roam'; glow(b, 0); }
    roar(true); fun.sfx.tada(); fun.confetti(['🏏', '🏆', '🎉', '⭐'], 30);
    const stars = S.bonks >= 8 ? 3 : S.bonks >= 4 ? 2 : 1;
    endScreen(S.a > S.b, stars, stars >= 3);   // easier role (auto-drift): only 3 stars raise the shared level
  }
  function bludgerReach(b) { return Math.hypot(b.pos.x - P.x, (b.pos.y - P.y - 1.2) * 0.7, b.pos.z - P.z); }
  function bonk(b) {
    const saved = b.state === 'aim' || b.state === 'charge';
    b.state = 'fly'; b.t = 1.3; b.victim = null; glow(b, 0);
    b.dir.set(b.pos.x - P.x, 0, b.pos.z - P.z); if (b.dir.lengthSq() < 1e-4) b.dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    b.dir.normalize(); b.dir.y = 0.35; b.dir.normalize();
    S.bonks++; fun.sfx.boing(); fun.sfx.tone(140, 0.25, 'square', 0.14, 0, 70);   // BONK
    roar(saved); fun.toast('🏏', saved ? 'בּוֹנְק! הִצַּלְתֶּם!' : 'בּוֹנְק!', 900);
    if (saved) fun.confetti(['💥', '⭐', '🏏'], 10);
  }
  function swingBat() {
    if (!S.on || S.over || ROLE.id !== 'beater' || S.swingCd > 0) return false;
    S.swing = 0; S.swingCd = BEATER.cd; S.swings++;
    fun.sfx.noise(0.22, 0.14, 0, 2600, 0.8);   // whoosh
    return true;
  }
  ROLES.beater = {
    id: 'beater', he: 'חוֹבֵט', emoji: '🏏', hint0: '🏏 שִׁמְרוּ עַל הַקְּבוּצָה!', cast: [rival, keepA, keepB, mate],
    action: swingBat, fly: true, btn: '🏏',
    setup() { bludgers.forEach((b, i) => { b.t = 3 + i * 4; }); },
    // stick idle: drift towards the Bludger that is going for a team-mate (stop ~2.5 m short)
    drift() { const b = bludgers.find(x => x.state === 'aim' || x.state === 'charge'); return b ? b.pos : null; },
    wantY() { const b = bludgers.find(x => x.state === 'aim' || x.state === 'charge'); return b ? b.pos.y - 1.2 : mate.position.y; },
    update(dt, t) {
      if (!S.over && S.t >= BEATER.len) beaterEnd();
      helperPlay(dt, false); keepersIdle(t); quaffle.rotation.y += dt * 3;
      const lv = st.qLevel;
      let busy = bludgers.some(b => b.state === 'aim' || b.state === 'charge');
      for (const b of bludgers) {
        b.t -= dt;
        if (b.state === 'roam') {
          b.pos.set(C.x + Math.sin(t * 0.5 + b.ph) * 22, gy + 9 + Math.sin(t * 0.9 + b.ph) * 3, C.z + Math.cos(t * 0.37 + b.ph * 2) * 15);
          if (!busy && b.t <= 0 && !S.over && !S.calm) { b.state = 'aim'; b.t = 1.0; b.victim = TEAM[S.nextVictim++ % TEAM.length]; busy = true; fun.sfx.tone(700, 1.0, 'sawtooth', 0.07, 0, 1500); }
        } else if (b.state === 'aim' || b.state === 'charge') {
          glow(b, ROLE && ROLE.id === 'beater' ? 0.35 + 0.3 * Math.sin(t * 12) : 1.5 + Math.sin(t * 30));   // Beater: stays a dark ball with a red pulse; the arrow marks it
          if (b.state === 'aim') { if (b.t <= 0) { b.state = 'charge'; b.t = 10; } }
          else {
            const v = b.victim.position; tmp.set(v.x - b.pos.x, v.y + 1 - b.pos.y, v.z - b.pos.z); const dl = tmp.length() || 1;
            b.pos.addScaledVector(tmp, Math.min(1, (6.5 + lv * 0.7) * dt / dl));
            if (dl < 1.3 || b.t <= 0) {   // it got there: the team-mate spins (the score is never reduced)
              b.victim.userData.spin = 1.2; S.misses++; fun.sfx.burp(); fun.toast('😵', '', 700);
              b.state = 'roam'; b.victim = null; b.t = 2.5 + Math.random() * 2; glow(b, 0);
            }
          }
        } else if (b.state === 'fly') {   // bonked: off it goes, then back to roaming
          b.pos.addScaledVector(b.dir, 30 * dt);
          if (b.t <= 0) { b.state = 'roam'; b.t = Math.max(2, 5 - lv * 0.3) + Math.random() * 2; }
        }
        b.g.rotation.y += dt * (b.state === 'fly' ? 14 : 2);
      }
      // the red arrow over whoever is in danger
      const db = bludgers.find(b => b.state === 'aim' || b.state === 'charge');
      S.danger = db ? (db.victim === mate ? 'mate' : 'keeper') : null;
      warn.visible = !!db && !S.over;
      if (warn.visible) { const v = db.victim.position; warn.position.set(v.x, v.y + 3.8 + Math.sin(t * 6) * 0.3, v.z); warn.scale.setScalar(1.9); warn.rotation.y = t * 4; }
      // the swing: a forgiving window; every Bludger within reach is bonked
      if (S.swingCd > 0) S.swingCd -= dt;
      if (S.swing >= 0) {
        S.swing += dt;
        if (S.swing <= BEATER.window && !S.over) for (const b of bludgers) if (b.state !== 'fly' && bludgerReach(b) < BEATER.reach) bonk(b);
        if (S.swing >= BEATER.swingT) S.swing = -1;
      }
      poseBat(S.swing);
      const near = bludgers.some(b => b.state !== 'fly' && bludgerReach(b) < BEATER.reach);
      throwB.classList.toggle('ready', near && !S.over);
      if (!S.over) setHint(near ? '🏏 עַכְשָׁו! חִבְטוּ!' : db ? (db.victim === mate ? '❗ הַכַּדּוּר הַשָּׁחֹר טָס לָרוֹדֵף!' : '❗ הַכַּדּוּר הַשָּׁחֹר טָס לַשּׁוֹעֵר!') : '🏏 שִׁמְרוּ עַל הַקְּבוּצָה!');
    },
  };

  // Fly the house riders: bank into turns, a gentle bob, lean forward with speed (no skeleton).
  function poseFlyers(dt, t) {
    for (const f of flyers) {
      if (!f.visible) continue;
      const u = f.userData;
      if (!u.init) { u.last.copy(f.position); u.lastYaw = f.rotation.y; u.init = true; }
      const dy = wrap(f.rotation.y - u.lastYaw) / Math.max(dt, 1e-3);
      const vx = (f.position.x - u.last.x) / Math.max(dt, 1e-3), vz = (f.position.z - u.last.z) / Math.max(dt, 1e-3);
      const side = vx * Math.cos(f.rotation.y) - vz * Math.sin(f.rotation.y);   // sideways drift (keepers)
      const fwd = Math.hypot(vx, vz);
      u.bank += (clamp(-dy * 0.35 - side * 0.05, -0.55, 0.55) - u.bank) * Math.min(1, dt * 4);
      u.pitch += (clamp(fwd * 0.012, 0, 0.18) - u.pitch) * Math.min(1, dt * 3);
      // hit by a Bludger (Beater match): two full turns, ending exactly where it started
      let spinA = 0; if (u.spin > 0) { u.spin = Math.max(0, u.spin - dt); spinA = (1 - u.spin / 1.2) * Math.PI * 4; }
      u.body.rotation.set(u.pitch, spinA, u.bank, 'YXZ');
      u.body.position.y = Math.sin(t * 2.2 + u.ph) * 0.12;
      u.last.copy(f.position); u.lastYaw = f.rotation.y;
    }
  }

  // ---------------- per-frame (owns the hero + camera while a match is on) ----------------
  function update(dt, ax) {
    if (!S.on) return;
    T += dt; const t = T;
    if (isModal()) { camera.position.copy(camPos); camera.lookAt(camLook); return; }
    if (S.frozen) {   // tests/screenshots only (_freeze): nothing moves; optional camera override; the bat can be posed
      if (ROLE.id === 'beater') poseBat(S.batPose != null ? S.batPose : S.swing);
      if (S.camOv) { camera.position.copy(S.camOv.p); camera.lookAt(S.camOv.l); } else { camera.position.copy(camPos); camera.lookAt(camLook); }
      return;
    }
    S.t += dt; if (S.kick > 0) S.kick -= dt;
    if (S.boostCd > 0) S.boostCd -= dt; if (S.boost > 0) S.boost -= dt; if (S.stealCd > 0) S.stealCd -= dt;
    const model = player.model, l = Math.min(1, Math.hypot(ax.x, ax.y));
    if (ROLE.fly) {
      if (S.stun > 0) { S.stun -= dt; yaw += dt * 16; pv.multiplyScalar(1 - dt * 3); }
      else if (!S.over) {
        const cy = Math.atan2(P.x - camPos.x, P.z - camPos.z);
        const mx = ax.y * Math.sin(cy) - ax.x * Math.cos(cy), mz = ax.y * Math.cos(cy) + ax.x * Math.sin(cy);
        // auto-help (Beater): with the stick idle the broom drifts to the role's target, stopping short
        const dg = l <= 0.05 && ROLE.drift && !S.calm ? ROLE.drift() : null, dgd = dg ? Math.hypot(dg.x - P.x, dg.z - P.z) : 0;
        const spd = (S.boost > 0 ? 31 : 20) * (S.holder === 'me' ? 0.92 : 1), want = l > 0.05 ? spd * l : dg ? clamp((dgd - 2.5) * 1.6, 0, 11) : (S.calm ? 0 : 2.5);   // (practice/calm mode: the broom hovers in place)
        if (l > 0.05) { const wy = Math.atan2(mx, mz); const dd = wrap(wy - yaw); yaw += dd * Math.min(1, dt * 5.5); bank += (-dd * 0.9 - bank) * Math.min(1, dt * 6); }
        else if (dg && dgd > 0.5) { const dd = wrap(Math.atan2(dg.x - P.x, dg.z - P.z) - yaw); yaw += dd * Math.min(1, dt * 3); bank += (-dd * 0.6 - bank) * Math.min(1, dt * 4); }
        else bank *= 1 - Math.min(1, dt * 4);
        pv.x += (Math.sin(yaw) * want - pv.x) * Math.min(1, dt * 4); pv.z += (Math.cos(yaw) * want - pv.z) * Math.min(1, dt * 4);
      }
      P.x += pv.x * dt; P.z += pv.z * dt;
      if (clampArena(P)) { const out = Math.atan2(P.x - C.x, P.z - C.z); const dd = wrap(out + Math.PI - yaw); yaw += dd * Math.min(1, dt * 2); }
      P.y += (clamp(ROLE.wantY(), gy + 2.5, gy + 18) - P.y) * Math.min(1, dt * 2.6);
    } else ROLE.move(dt, ax);
    model.position.copy(P); model.rotation.set(0.18, yaw, clamp(bank, -0.6, 0.6), 'YXZ'); model.visible = true;
    player.yaw = yaw; player.smoothY = P.y; player._lastPos.copy(P);
    player.animate(dt, { moving: false });   // riding: Harry's 'Ride' clip if he has one, else Idle (chibi: breathing)

    setSmoulder();
    ROLE.update(dt, t);
    poseFlyers(dt, t);
    if (snitch.visible) {   // the rigged Snitch flaps (10 Hz) and turns its face into the direction it flies
      if (snitchMixer) snitchMixer.update(dt);
      const vx = snitch.position.x - snitchLast.x, vz = snitch.position.z - snitchLast.z;
      if (vx * vx + vz * vz > 1e-4) snitch.rotation.y += wrap(Math.atan2(vx, vz) - snitch.rotation.y) * Math.min(1, dt * 8);
    }
    snitchLast.copy(snitch.position);
    if (S.cheer > 0) S.cheer -= dt;
    settleCrowd(S.cheer > 0 ? 0.9 : 0.12, S.cheer > 0 ? 9 : 2, t);

    if (ROLE.cam) ROLE.cam(dt);
    else {
      const back = S.boost > 0 ? 12 : 10;
      camPos.lerp(tmp.set(P.x - Math.sin(yaw) * back, P.y + 4.6, P.z - Math.cos(yaw) * back), 1 - Math.exp(-dt * 3.2));
      camLook.lerp(tmp2.set(P.x + Math.sin(yaw) * 5, P.y + 1.6, P.z + Math.cos(yaw) * 5), 1 - Math.exp(-dt * 6));
    }
    camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + 1.5);
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  // called every frame by main (when no match is on): the stand's 🧹 prompt + far-away culling
  function idle(dt, inside) {
    if (S.on || inside) return;
    T += dt;
    const dd = Math.hypot(player.pos.x - C.x, player.pos.z - C.z);
    pitch.visible = dd < 150;                        // far from the pitch it costs nothing
    if (wallCols.length) gateWall(player.pos.x, player.pos.z);   // one-way wall: you can always walk out
    stand.visible = Math.hypot(player.pos.x - STAND.x, player.pos.z - STAND.z) < 38;   // the little broom stand only when you are near it
    if (sign) { sign.position.y = 4.6 + Math.sin(T * 2) * 0.2; sign.rotation.y += dt * 0.8; }
    const k = Math.hypot(player.pos.x - STAND.x, player.pos.z - STAND.z);
    if (k < 5 && !isModal()) fun.offer('quidditch', '🧹', k, () => start());
  }

  const v3 = (p) => ({ x: p.x, y: p.y, z: p.z });
  const api = {
    start, quit, boost, throwQuaffle, releaseSnitch, idle, stand: STAND, centre: C, goalX: GOAL_X, homeX: HOME_X, hoopZ: HOOP_DZ.map(z => C.z + z), hoopY: HOOP_Y.map(y => gy + y),
    roles: () => Object.values(ROLES).map(r => ({ id: r.id, soon: !!r.soon })),
    pickerOpen: pickOpen, openPicker, closePicker,
    state: () => ({ on: S.on, over: !!S.over, a: S.a, b: S.b, holder: S.holder, stun: S.stun > 0, snitch: !!S.snitchOn, t: S.t, aim: S.aim, hits: S.hits, dodges: S.dodges, saves: S.saves, level: st.qLevel, result: S.result || null,
      me: v3(P), quaffle: v3(quaffle.position), snitchPos: v3(snitch.position),
      shot: !!S.shot, boosting: S.boost > 0, speed: Math.hypot(pv.x, pv.z), b0: { x: bludgers[0].pos.x, y: bludgers[0].pos.y, z: bludgers[0].pos.z, hit: bludgers[0].hit, t: bludgers[0].t }, keeperZ: keepA.position.z, inRange: inRange(), bludgers: bludgers.map(b => b.state), inArena: Math.hypot((P.x - C.x) / AX, (P.z - C.z) / AZ) <= 1.001,
      pos: S.on ? ROLE.id : null, picker: pickOpen(), shots: S.shots || 0, shotsLeft: KEEPER.shots - (S.shots || 0), kPhase: S.kp ? S.kp.phase : null, kHoop: S.kp ? S.kp.hoop : null,
      snitchDist: snitch.position.distanceTo(P), arrow: !!S.arrowOn, caughtBy: S.caughtBy || null, rivalSeeker: v3(rivalSeeker.position), qPos: st.qPos || null, qStars: st.qStars || {},
      // phase 2: Chaser / Beater (hits above = Bludger hits on YOU; bonks = your bat hits)
      passes: S.passes || 0, catches: S.catches || 0, goals: S.myGoals || 0, passOk: !!S.passOk, teamSaves: S.teamSaves || 0, btn: throwB.textContent,
      mate: v3(mate.position), rival: v3(rival.position), pass: S.shot && S.shot.target ? S.shot.target : null,
      bonks: S.bonks || 0, misses: S.misses || 0, swings: S.swings || 0, swinging: (S.swing ?? -1) >= 0, danger: S.danger || null,
      bludgerPos: bludgers.map(b => ({ x: b.pos.x, y: b.pos.y, z: b.pos.z, state: b.state, glow: b.mats[0].emissiveIntensity })),
      bat: { visible: bat.visible, on: bat.parent ? (bat.parent === batHand ? 'hand_r' : bat.parent === player.model ? 'wrapper' : 'other') : null, model: !!batInner.userData.model } }),
    _pick(pos) { closePicker(); if (ROLES[pos] && !ROLES[pos].soon) { st.qPos = pos; fun.save(); } return begin(pos); },   // tests: choose a position (picker or not)
    _tapPick(pos) { const b = pickOv.querySelector('[data-pos="' + pos + '"]'); tapPick(pos, b); return pickSel; },
    _place(x, y, z, yw) { P.set(x, y, z); pv.set(0, 0, 0); if (yw != null) yaw = yw; },
    _give() { S.holder = 'me'; S.shot = null; S.kick = 0; },      // tests: you are holding the Quaffle
    _quaffleAt(x, y, z) { S.holder = null; S.shot = null; S.kick = 0; quaffle.position.set(x, y, z); },
    _calm(on) { S.calm = !!on; if (S.calm && S.kp && S.kp.phase === 'approach') S.kp.t = 1e9; }, _rivalAway() { rival.position.set(C.x - 20, gy + 6, C.z - 14); S.stealCd = 5; },
    _keeperTo(z) { keepA.position.z = z; },
    _bludger() { const b = bludgers[0]; b.pos.set(P.x + pv.x * 0.2 + 7, P.y + 1, P.z + pv.z * 0.2); b.dir.set(-1, 0, 0); b.state = 'charge'; b.t = 1.5; b.hit = false; },   // tests: a Bludger already charging at you
    _snitchTo(x, y, z) { snitch.position.set(x, y, z); S.snTarget.set(x, y, z); S.juke = 5; },
    _freeze(on) { S.frozen = !!on; if (!on) { S.camOv = null; S.batPose = null; } },   // screenshots: stop the match in place
    _batPose(sec) { S.batPose = sec == null ? null : sec; },       // screenshots (frozen): hold the bat at `sec` into the swing
    _cam(p, l) { S.camOv = p ? { p: new Vector3(p.x, p.y, p.z), l: new Vector3(l.x, l.y, l.z) } : null; },   // screenshots (frozen): camera override
    _rivalAt(x, y, z) { rival.position.set(x, y, z); },           // tests: put the rival Chaser somewhere (stays there in calm mode)
    _pass() { return passToMate(); },                              // Chaser: pass to the mate now (rival close or not)
    _swing() { return swingBat(); },                               // Beater: swing the bat now
    _timeLeft(sec) { const len = { chaser: CHASER.len, beater: BEATER.len }[S.on && ROLE.id]; if (len) S.t = Math.max(S.t, len - sec); return !!len; },   // tests: jump to the last seconds (Chaser / Beater)
    _bludgerAt(who) {   // Beater: a Bludger goes for a team-mate now ('mate' / 'keeper', or 0 / 1); returns its position
      if (!S.on || ROLE.id !== 'beater' || S.over) return null;
      const v = who === 'keeper' || who === 1 ? keepB : mate, b = bludgers[0];
      bludgers[1].state = 'roam'; bludgers[1].victim = null; bludgers[1].t = 99; glow(bludgers[1], 0);
      b.victim = v; b.state = 'aim'; b.t = 0.4; b.pos.set(v.position.x + 9, v.position.y + 2, v.position.z + 4); clampArena(b.pos);
      return v3(b.pos);
    },
    pitchInfo: () => ({ model: !!stadium, chest: !!stand.userData.chest, snitch: snitch.userData.rigged ? 'rigged' : snitch.userData.model ? 'lite' : 'code', crowdInTowers, standsVisible: stands.visible, ovalVisible: oval.visible, colliders: pitchCols.length + wallCols.length, wallSolid }),
    _shotAt(i) { if (!S.on || ROLE.id !== 'keeper' || S.over) return false; rival.position.set(HOME_X + 13, gy + HOOP_Y[i] - 0.5, C.z + HOOP_DZ[i] * 0.6); keeperShot(i); return true; },   // tests: the rival winds up at hoop i now
  };
  fun.mods.quidditch = api;
  return api;
}
