// Background students: generic first-years who make the castle feel lived in. Pure decoration:
// if a model, a clip or a texture fails, that place simply has no students and nothing throws.
//
// One rigged GLB per gender (student_boy / student_girl in models.json, KTX2 with a WebP
// fallback). House and hair are texture variants (assets/students/student_<g>_01_<house>_<hair>
// .ktx2|.webp, same UV layout): each variant is loaded once, and every student wearing it shares
// one cloned material, so a student costs 1 draw call (+1 shadow draw outdoors only).
//
// Where they are (brief: briefs/students.md, numbers in metres):
//   greathall  : 3 seated at each of the four house tables (Sit clip), on the benches, facing the table
//   classrooms : 2 standing behind the front desks of each teacher station (Idle / Talk)
//   courtyard  : 2 chatting pairs near Ron and Hermione (Talk / Idle), each waves once when the
//                player first comes within 6 m
// Rooms follow the GLB-professor lifetime rules (lessons.js upgradeProfessor): a 'room left
// meanwhile' guard, onTeardown stops the mixer and uncaches it, the shared geometry is never
// disposed. LOW tier: at most 2 per room and none in the courtyard.
import { AnimationMixer, LoopOnce, Group, Frustum, Matrix4, Sphere, Vector3 } from 'three';
import { loadAnimated, loadTexture, modelStatus } from './models.js';
import { SPOTS, TIER } from './config.js';
import * as fun from './fun.js';
import { BENCH_TOP } from './interior-kit.js';

const WORLD = 1.2;                        // the cast's world scale (Ron and Hermione are 1.2 x their rest height)
const SCALE_MIN = 0.94, SCALE_MAX = 1.0;  // students a little shorter than Ron and Hermione
const BODY_R = 0.35;                      // obstacle circle per student (player.js circle collider; + the hero's 0.4)
const ANIM_R = 40, CULL_R = 85, WAVE_R = 6, REARM_R = 20, FADE = 0.3;
const HOUSES = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
const FROM_STORE = { gryf: 'gryffindor', slyt: 'slytherin', rave: 'ravenclaw', huff: 'hufflepuff' };
const HAIR = { boy: ['brown', 'blond'], girl: ['black', 'blonde'] };
// Sit clip (brief): the thigh underside ("seat top") above the feet origin, in model metres.
// Measured in-engine (model metres): knee joint right above the origin, hip 0.26 (boy) / 0.31
// (girl) behind it, toes 0.13 in front. The brief's layout (bench edge 0.07 behind the origin,
// table edge 0.15 in front) assumes a 0.22 m bench-table gap; the Great Hall's is only 0.15, so
// the origin sits 0.17 m (world) in front of the bench edge: knees ~9 cm under the table top,
// hips still ~0.2 m onto the 0.5 m bench.
// Feet on the floor: every seated student keeps the seeded scale (scaleOf, 1.128..1.2) with the
// origin at y 0. Their thighs then meet the BENCH_TOP (0.39) bench within 3 cm: boys float
// 0..2.4 cm above it, girls press 0..2.3 cm into its top (SEAT_TOP * scale - BENCH_TOP).
const SEAT_TOP = { boy: 0.345, girl: 0.325 };
const BENCH_GAP = 0.17;

// The Great Hall's furniture (rooms.js greatHall + interior-kit.js longTable), room-local:
// tables at x = +-5, z = -6 / 9, 16 m long; table top 0.85..0.99 high, 1.5 m wide (edges at
// +-0.75 from the table axis); benches at +-1.15 from the axis, 0.5 deep (front edge 0.9),
// top at BENCH_TOP (interior-kit.js). House = the banner on the wall beside each table (rooms.js HOUSE order).
const HALL_TABLES = [
  { x: -5, z: -6, house: 'gryffindor' },
  { x: -5, z: 9,  house: 'ravenclaw' },
  { x: 5,  z: -6, house: 'hufflepuff' },
  { x: 5,  z: 9,  house: 'slytherin' },
];
const BENCH_X = 1.15, BENCH_HALF = 0.25;
// Three seats per table along its length: two on the aisle bench, one opposite (side -1 = the
// aisle side). A small per-table shift keeps the four tables from looking stamped.
const HALL_SEATS = [[1, -3.6], [1, 0.9], [-1, -1.3]];   // 2 on the wall bench (faces toward the aisle, seen from the door), 1 on the aisle bench
const HALL_SHIFT = [0, 1.2, -0.8, 0.5];
// Classrooms: lessons.js STATIONS (x, z) with desks at (x +-1.6, z + 3.2), 1.3 x 0.75 m.
const CLASS_STATIONS = [-9, 0, 9].map(x => ({ x, z: -6.2 }));
// Courtyard pairs, world x/z relative to SPOTS.courtyard (Ron at -4,-6; Hermione at 0,-8).
const C = SPOTS.courtyard;
const YARD_PAIRS = [
  [[5.2, -7.4], [6.3, -6.7]],
  [[-8.6, -2.2], [-7.6, -1.4]],
];

// small seeded RNG: the same room always seats the same faces
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const myHouse = () => FROM_STORE[fun.store?.house] || null;
const noRaycast = () => {};

export function createStudents({ scene, camera, player, heightAt, tier, registerOutdoor, colliders: yardCols }) {
  const live = [];                       // every placed student: { root, mixer, acts, cur, wx, wy, wz, outdoor, ... }
  const mats = new Map();                // gender_house_hair -> shared material
  const frustum = new Frustum(), pm = new Matrix4(), sph = new Sphere(new Vector3(), 1.1);
  const isLow = () => tier() === TIER.LOW;

  // Load the genders + variant textures a placement needs. All-or-nothing: null on any miss.
  async function prepare(specs, alive) {
    const genders = [...new Set(specs.map(s => s.g))];
    const models = await Promise.all(genders.map(g => loadAnimated('student_' + g, alive)));
    if (alive && !alive()) return null;
    if (models.some(m => !m)) { console.warn('[students] model unavailable - no students here (see __game.models())'); return null; }
    const src = {};
    genders.forEach((g, i) => { src[g] = models[i]; });
    for (const g of genders) for (const n of new Set(specs.filter(s => s.g === g).map(s => s.clip))) {
      if (!src[g].clips.find(a => a.name === n)) { console.warn('[students]', g, 'has no', n, 'clip - no students here'); return null; }
    }
    const keys = [...new Set(specs.map(s => s.g + '_01_' + s.house + '_' + s.hair))];
    const viaWebp = g => String(modelStatus()['student_' + g] || '').includes('_webp');
    const texs = await Promise.all(keys.map(k => loadTexture('students/student_' + k, { preferWebp: viaWebp(k.split('_')[0]) })));
    if (alive && !alive()) return null;
    if (texs.some(t => !t)) { console.warn('[students] a variant texture failed - no students here'); return null; }
    const tex = {}; keys.forEach((k, i) => { tex[k] = texs[i]; });
    return { src, tex };
  }

  function variantMaterial(base, key, tex) {
    let m = mats.get(key);
    if (!m) {
      m = base.clone(); m.name = 'student_' + key;
      if (base.map) { tex.wrapS = base.map.wrapS; tex.wrapT = base.map.wrapT; tex.anisotropy = base.map.anisotropy; }
      m.map = tex; m.needsUpdate = true;
      mats.set(key, m);
    }
    return m;
  }

  // Place a whole group of students under `parent` once everything they need is loaded.
  // `alive` says whether the parent still belongs to the scene (the room was not left meanwhile).
  // `cols`: the collider array the hero walks against there (the room's own, or the outdoor one):
  // each student adds a circle to it and takes it out again on teardown.
  async function place(specs, parent, alive, outdoor, cols) {
    const ready = await prepare(specs, alive);
    if (!ready || (alive && !alive())) return [];
    // each student gets its own skeleton clone (prepare() already made one per gender: reuse it
    // for the first, clone again from the cache for the rest); all of them before any is added
    const firsts = new Set();
    const clones = await Promise.all(specs.map(spec => {
      if (!firsts.has(spec.g)) { firsts.add(spec.g); return ready.src[spec.g]; }
      return loadAnimated('student_' + spec.g, alive);
    }));
    if (clones.some(c => !c) || (alive && !alive())) return [];
    const out = [];
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i], got = clones[i];
      const key = spec.g + '_01_' + spec.house + '_' + spec.hair;
      const obj = got.obj; obj.name = 'student-' + key;
      obj.scale.setScalar(spec.scale);
      obj.position.set(spec.x, spec.y, spec.z); obj.rotation.y = spec.yaw;
      obj.traverse(o => {
        if (!o.isMesh) return;
        o.material = variantMaterial(o.material, key, ready.tex[key]);
        o.frustumCulled = false;                  // skinned bounds lie; each student is culled as one sphere below
        o.castShadow = outdoor; o.receiveShadow = false;   // indoors no shadow draws
        o.userData.sharedGeo = true;              // geometry is shared with the models.js cache
        o.raycast = noRaycast;                    // the camera spring-arm must not bump into a student
      });
      const clip = n => got.clips.find(a => a.name === n);
      const mixer = new AnimationMixer(obj), acts = {};
      for (const n of ['Idle', 'Talk', 'Sit', 'Wave']) { const a = clip(n); if (a) acts[n.toLowerCase()] = mixer.clipAction(a); }
      if (acts.wave) { acts.wave.setLoop(LoopOnce, 1); acts.wave.clampWhenFinished = true; }
      const cur = spec.clip.toLowerCase();
      const a = acts[cur];
      a.play(); a.time = Math.random() * a.getClip().duration;          // desync: random phase ...
      mixer.timeScale = 0.9 + Math.random() * 0.2;                       // ... and a slightly different tempo
      parent.add(obj);
      obj.updateMatrixWorld(true);
      const wp = new Vector3(); obj.getWorldPosition(wp);
      const s = { root: obj, mixer, acts, cur, base: cur, wx: wp.x, wy: wp.y, wz: wp.z, yaw: spec.yaw, outdoor,
        waving: false, waveArmed: true, spec, col: null };
      if (cols) {
        // seated: centred over the hips (behind the feet origin, toward the bench); standing: on the feet
        const back = spec.clip === 'Sit' ? 0.15 : 0;
        s.col = { type: 'circle', x: wp.x - Math.sin(spec.yaw) * back, z: wp.z - Math.cos(spec.yaw) * back, r: BODY_R, student: true };
        s.cols = cols; cols.push(s.col);
      }
      mixer.addEventListener('finished', e => { if (e.action === acts.wave) { s.waving = false; fadeTo(s, s.base); } });
      s.teardown = () => {
        mixer.stopAllAction(); mixer.uncacheRoot(obj);
        obj.traverse(o => { if (o.isSkinnedMesh) { try { o.skeleton.dispose(); } catch { /* backend quirk */ } } });
        const i = live.indexOf(s); if (i >= 0) live.splice(i, 1);
        solid(s, false); s.col = null;
      };
      // room teardown (interiors.js disposeRoom) calls this before disposing the room's geometry
      obj.userData.onTeardown = s.teardown;
      out.push(s);
    }
    live.push(...out);
    return out;
  }

  // A student hidden by the LOW tier is no obstacle either (no invisible walls).
  function solid(s, on) {
    if (!s.col) return;
    const k = s.cols.indexOf(s.col);
    if (on && k < 0) s.cols.push(s.col); else if (!on && k >= 0) s.cols.splice(k, 1);
  }

  function fadeTo(s, name) {
    if (s.cur === name || !s.acts[name]) return;
    const next = s.acts[name], prev = s.acts[s.cur];
    next.reset().play();
    if (prev) prev.crossFadeTo(next, FADE, false);
    s.cur = name; if (name === 'wave') s.waving = true;
  }

  // Pick a variant: house given; gender and hair from the seeded RNG.
  function who(rand, house, g) {
    g = g || (rand() < 0.5 ? 'boy' : 'girl');
    return { g, house, hair: HAIR[g][rand() < 0.6 ? 0 : 1] };
  }
  const scaleOf = rand => WORLD * (SCALE_MIN + rand() * (SCALE_MAX - SCALE_MIN));
  // a mixed pair/group of houses that includes the child's own house (if sorted)
  function mixedHouses(rand, n) {
    const pool = HOUSES.slice().sort(() => rand() - 0.5);
    const mine = myHouse();
    if (mine) { pool.splice(pool.indexOf(mine), 1); pool.unshift(mine); }
    return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
  }

  // ---- placements -------------------------------------------------------------------------
  function hallSpecs() {
    const rand = rng(20261113), out = [];
    HALL_TABLES.forEach((t, ti) => {
      HALL_SEATS.forEach(([side, dz], si) => {
        // side -1 = the aisle bench (toward x = 0), +1 = the wall bench
        const benchSign = side === -1 ? -Math.sign(t.x) : Math.sign(t.x);   // local x sign of this bench
        const v = who(rand, t.house, (ti + si) % 2 ? 'girl' : 'boy');
        const scale = scaleOf(rand);                                   // each student's own seeded size (same sequence, same faces)
        const lx = benchSign * (BENCH_X - BENCH_HALF - BENCH_GAP);   // origin in front of the bench edge, knees under the table
        out.push({ ...v, clip: 'Sit', scale,
          x: t.x + lx, y: Math.max(0, BENCH_TOP - SEAT_TOP[v.g] * scale), z: t.z + dz + HALL_SHIFT[ti],   // feet on the floor; a student whose seat would sink into the bench is lifted onto it (<= 2.3 cm, hidden by the robe hem)
          yaw: benchSign > 0 ? -Math.PI / 2 : Math.PI / 2 });          // face the table (model faces +Z)
      });
    });
    return out;
  }
  function classSpecs() {
    const rand = rng(7031), out = [];
    CLASS_STATIONS.forEach((s, i) => {
      const houses = mixedHouses(rand, 2);
      [-1.6, 1.6].forEach((dx, k) => {
        const v = who(rand, houses[k], (i + k) % 2 ? 'girl' : 'boy');
        out.push({ ...v, clip: k === i % 2 ? 'Talk' : 'Idle', scale: scaleOf(rand),
          x: s.x + dx + (rand() - 0.5) * 0.2, y: 0, z: s.z + 3.2 + 0.375 + 0.45, yaw: Math.PI });   // behind the desk, facing the teacher
      });
    });
    return out;
  }
  function yardSpecs() {
    const rand = rng(424242), out = [];
    YARD_PAIRS.forEach((pair, i) => {
      const houses = mixedHouses(rand, 2);
      pair.forEach(([dx, dz], k) => {
        const [ox, oz] = pair[1 - k];
        const x = C.x + dx, z = C.z + dz;
        const v = who(rand, houses[k], (i + k) % 2 ? 'girl' : 'boy');
        out.push({ ...v, clip: k === 0 ? 'Talk' : 'Idle', scale: scaleOf(rand),
          x, y: heightAt ? heightAt(x, z) : 0, z, yaw: Math.atan2(C.x + ox - x, C.z + oz - z) });   // face the partner
      });
    });
    return out;
  }

  // ---- rooms: called each time a room streams in (main.js onEnter) ----
  function roomEntered(id, group) {
    let specs = id === 'greathall' ? hallSpecs() : id === 'classrooms' ? classSpecs() : null;
    if (!specs) return;
    if (isLow()) specs = specs.filter((s, i) => i % Math.ceil(specs.length / 2) === 0).slice(0, 2);
    const alive = () => { let root = group; while (root.parent) root = root.parent; return !!root.isScene; };
    const cols = player.colliders;         // the room's own array (interiors.js swaps it in before onEnter); dies with the room
    place(specs, group, alive, false, cols).catch(e => console.warn('[students] skipped -', e.message));
  }

  // ---- outdoors: the courtyard pairs (never on LOW) ----
  const yard = new Group(); yard.name = 'students-courtyard';
  scene.add(yard); registerOutdoor && registerOutdoor(yard);
  let yardTried = false;
  function ensureYard() {
    if (yardTried || isLow()) return;
    yardTried = true;
    place(yardSpecs(), yard, null, true, yardCols).catch(e => console.warn('[students] courtyard skipped -', e.message));
  }
  ensureYard();

  // ---- per frame ----
  function update(dt, inside) {
    if (!live.length) return;
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm, camera.coordinateSystem);
    const low = isLow(), px = player.pos.x, pz = player.pos.z;
    let indoorN = 0;
    for (const s of live) {
      if (s.outdoor && (inside || low)) { s.root.visible = false; if (low) solid(s, false); continue; }
      if (s.outdoor) solid(s, true);
      const d = Math.hypot(px - s.wx, pz - s.wz);
      sph.center.set(s.wx, s.wy + 0.9, s.wz);
      let vis = d < CULL_R && frustum.intersectsSphere(sph);
      if (!s.outdoor) { const kept = !low || indoorN++ < 2; if (!kept) vis = false; solid(s, kept); }   // tier dropped to LOW inside a room
      s.root.visible = vis;
      if (s.outdoor && s.acts.wave) {
        if (d < WAVE_R && s.waveArmed) { s.waveArmed = false; fadeTo(s, 'wave'); }
        else if (d > REARM_R) s.waveArmed = true;
        // turn toward the player while waving, back to the partner afterwards
        const want = s.waving ? Math.atan2(px - s.wx, pz - s.wz) : s.yaw;
        let dy = want - s.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        s.root.rotation.y += dy * Math.min(1, dt * 3);
      }
      if (vis && d < ANIM_R) s.mixer.update(dt);
    }
  }

  return {
    roomEntered, update,
    // test/debug probe
    list: () => live.map(s => ({ name: s.root.name, col: s.col ? { x: +s.col.x.toFixed(2), z: +s.col.z.toFixed(2), r: s.col.r } : null, clip: s.cur, outdoor: s.outdoor, visible: s.root.visible,
      x: +s.wx.toFixed(2), y: +s.wy.toFixed(3), z: +s.wz.toFixed(2), scale: +s.root.scale.x.toFixed(3), house: s.spec.house, g: s.spec.g })),
    get count() { return live.length; },
    get materials() { return mats.size; },
  };
}
