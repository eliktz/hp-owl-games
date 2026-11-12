// Friendly inhabitants of the grounds. Ron, Hermione and Hedwig use the committed fan
// models (assets/models/, see MODELS-CREDITS.md); Harry is drawn in code. Hagrid starts as a
// code-drawn chibi (instant placeholder + silent fallback) and is swapped for the rigged
// film-look GLB once it streams in. Everyone has a gentle idle animation (bob / float) and a short
// set of friendly Hebrew lines shown when the player walks up (see main.js for the bubble).
import {
  Group, Mesh, SphereGeometry, ConeGeometry, MeshStandardMaterial, AnimationMixer, LoopOnce, Box3,
} from 'three';
import { loadModel, loadAnimated, fitModel } from './models.js';
import { buildChibi, animateChibi } from './chibi.js';
import { SPOTS } from './config.js';

const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.85, ...extra });

// Harry: Gryffindor chibi with round glasses, messy black hair and a red scarf.
function buildHarry() {
  return buildChibi({ robe: 0x2a2140, trim: 0x1a1430, house: 0x7a1020, hair: 0x1a120c, glasses: true, wand: true });
}

// Hagrid: a big, warm chibi in a brown coat with a huge bushy beard.
function buildHagrid() {
  const g = buildChibi({ robe: 0x4a3524, trim: 0x30241a, house: 0x5a4030, skin: 0xd9ad86, hair: 0x3b352f, scale: 1.5 });
  const head = g.userData.rig.head;
  const beard = new Mesh(new ConeGeometry(0.34, 0.8, 14), mat(0x3b352f, { roughness: 1 }));
  beard.position.set(0, -0.18, 0.14); beard.rotation.x = Math.PI; beard.castShadow = true; head.add(beard);
  const brow = new Mesh(new SphereGeometry(0.36, 16, 12), mat(0x3b352f, { roughness: 1 }));
  brow.position.set(0, 0.08, -0.02); brow.scale.set(1.05, 0.95, 1.05); head.add(brow);
  return g;
}

// Rigged Hagrid (models.json 'hagrid'): scaled to HAGRID_H metres standing, feet on the ground,
// facing +Z like the chibi. Idle loop; Wave once when the player first comes near (re-armed
// after they have been far away); Talk while his speech bubble is up. Any failure -> the chibi stays.
const HAGRID_H = 3.5, FADE = 0.3, WAVE_R = 8, REARM_R = 20, ANIM_R = 60;
function upgradeHagrid(c) {
  const g = c.group;
  loadAnimated('hagrid').then(r => {
    if (!r) { console.warn('[characters] hagrid GLB unavailable - keeping the chibi (see __game.models())'); return; }
    const clip = n => r.clips.find(a => a.name === n);
    if (!clip('Idle')) { console.warn('[characters] hagrid GLB has no Idle clip - keeping the chibi'); return; }
    const obj = r.obj; obj.name = 'char-hagrid-glb';
    // Bind-pose height from the skinned meshes' geometry (a SkinnedMesh's own bounding box needs
    // bone matrices that only exist after the first render).
    obj.updateMatrixWorld(true);
    const box = new Box3(), b = new Box3();
    obj.traverse(o => { if (o.isMesh) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(b); } });
    let h = box.max.y - box.min.y; if (!(h > 0.5 && h < 10)) h = 2.6;   // brief: 2.6 m at rest
    const k = HAGRID_H / h / (g.scale.x || 1);         // the chibi group itself is scaled 1.5: cancel it
    obj.scale.setScalar(k);
    obj.position.y = -(box.min.y > -0.5 && box.min.y < 0.5 ? box.min.y : 0) * k;   // feet origin; trust it unless odd
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false;   // beard/hair keep their MASK alphaTest
    });
    const mixer = new AnimationMixer(obj), acts = {};
    for (const n of ['Idle', 'Talk', 'Wave']) { const a = clip(n); if (a) acts[n.toLowerCase()] = mixer.clipAction(a); }
    if (acts.wave) { acts.wave.setLoop(LoopOnce, 1); acts.wave.clampWhenFinished = true; }
    acts.idle.play();
    mixer.addEventListener('finished', e => { if (e.action === acts.wave) c.waving = false; });
    for (const ch of g.children) ch.visible = false;
    g.add(obj); g.position.y = c.baseY;
    g.userData.rig = null;                             // animateChibi() becomes a no-op
    Object.assign(c, { mixer, acts, cur: 'idle', waving: false, waveArmed: true, glb: obj });
    g.userData.acts = acts;                            // debug/test probes read the clip weights here
    console.info('[characters] hagrid GLB in: rest height', h.toFixed(2), 'm, world scale', (HAGRID_H / h).toFixed(3));
  }).catch(e => console.warn('[characters] hagrid GLB skipped -', e.message));
}
function fadeTo(c, name) {
  if (c.cur === name || !c.acts[name]) return;
  const next = c.acts[name], prev = c.acts[c.cur];
  next.reset().play();
  if (prev) prev.crossFadeTo(next, FADE, false);
  c.cur = name; if (name === 'wave') c.waving = true;
}

// Model-backed figure: load, scale to height, face the player. Falls back to a chibi.
async function modelFigure(name, height, fallbackRobe) {
  const obj = await loadModel(name);
  if (!obj) return buildChibi({ robe: fallbackRobe });
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const g = new Group(); g.add(obj);
  fitModel(obj, { x: 0, z: 0, height, faceSouth: true });
  return g;
}

const C = SPOTS.courtyard, H = SPOTS.hut;
const HEB = { harry: 'הארי', ron: 'רון', hermione: 'הרמיוני', hagrid: 'האגריד', hedwig: 'הדוויג' };
const LINES = {
  harry:    ['שלום! אני הארי. בוא נחקור את הטירה יחד! ✨', 'כבר אספת כוכב קסם?', 'קווידיץ׳ זה הכי כיף בעולם!'],
  ron:      ['היי, אני רון! יש לך שוקולד צפרדע? 🐸', 'אל תדאג, הכול יהיה בסדר.', 'בוא נלך לאולם הגדול לאכול!'],
  hermione: ['שלום, אני הרמיוני. קראת ספר טוב היום? 📚', 'הספרייה היא המקום האהוב עליי.', 'אל תשכח ללמוד לחשים!'],
  hagrid:   ['אהלן! אני האגריד, אוהב חיות קסומות. 🐾', 'בוא לבקר אותי בבקתה!', 'שמור על עצמך ביער.'],
  hedwig:   ['הוווו! 🦉', 'הדוויג רוצה ללוות אותך.', 'יש לך מכתב למסור?'],
};

// Build & place everyone. Returns a manager with update(dt, playerPos) that animates
// the idle bob/float and returns the nearest character within talking range (or null).
export async function createCharacters({ scene, heightAt }) {
  const ground = (x, z) => (heightAt ? heightAt(x, z) : 0);
  const defs = [
    { name: 'harry',    kind: 'person', group: buildHarry(),  x: C.x + 4, z: C.z - 6 },
    { name: 'ron',      kind: 'person', group: await modelFigure('ron', 1.7, 0x9a3b1b),  x: C.x - 4, z: C.z - 6 },
    { name: 'hermione', kind: 'person', group: await modelFigure('hermione', 1.65, 0x6a3b1b), x: C.x, z: C.z - 8 },
    { name: 'hagrid',   kind: 'person', group: buildHagrid(), x: H.x - 5, z: H.z + 2 },
    { name: 'hedwig',   kind: 'owl',    group: await owlFigure(), x: C.x + 8, z: C.z - 3 },
  ];
  const chars = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const y = ground(d.x, d.z) + (d.kind === 'owl' ? 1.6 : 0);
    d.group.position.set(d.x, y, d.z);
    d.group.name = 'char-' + d.name;
    // Primitive/merged parts can get a bad bounding sphere and vanish at screen edges;
    // these figures are cheap, so never frustum-cull them.
    d.group.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(d.group);
    chars.push({ ...d, baseY: y, phase: i * 1.7, lines: LINES[d.name], heb: HEB[d.name] });
  }
  const hagrid = chars.find(c => c.name === 'hagrid');
  if (hagrid) upgradeHagrid(hagrid);

  let t = 0;
  return {
    characters: chars,
    update(dt, playerPos) {
      t += dt;
      let near = null, best = 1e9;
      for (const c of chars) {
        const s = Math.sin(t * (c.kind === 'owl' ? 2.2 : 1.4) + c.phase);
        if (c.kind === 'owl') { c.group.position.y = c.baseY + s * 0.18 + 0.1; c.group.rotation.y += dt * 0.4; }
        else if (c.mixer) {
          // rigged figure: no bob (feet stay planted); turn gently toward a player who comes close
          const d = playerPos ? Math.hypot(playerPos.x - c.x, playerPos.z - c.z) : 1e9;
          let want = Math.sin(t * 0.5 + c.phase) * 0.15;
          if (d < 10) want = Math.atan2(playerPos.x - c.x, playerPos.z - c.z);
          let dy = want - c.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          c.group.rotation.y += dy * Math.min(1, dt * 3);
          if (d < WAVE_R && c.waveArmed && c.acts.wave) { c.waveArmed = false; fadeTo(c, 'wave'); }
          else if (d > REARM_R) c.waveArmed = true;
        }
        else {
          c.group.position.y = c.baseY + Math.abs(s) * 0.04; c.group.rotation.y = Math.sin(t * 0.5 + c.phase) * 0.25;
          animateChibi(c.group.userData.rig, dt, { moving: false });   // breathing/head-tilt for code-drawn chibis
        }
        if (playerPos) {
          const d = Math.hypot(playerPos.x - c.x, playerPos.z - c.z);
          if (d < 4.5 && d < best) { best = d; near = c; }
        }
      }
      // rigged figures: talk while their bubble is up (main.js shows it for `near`); skin only
      // when the friend culling left them visible and they are close enough to matter
      for (const c of chars) {
        if (!c.mixer) continue;
        if (!c.waving) fadeTo(c, c === near ? 'talk' : 'idle');
        const d = playerPos ? Math.hypot(playerPos.x - c.x, playerPos.z - c.z) : 1e9;
        if (c.group.visible && d < ANIM_R) c.mixer.update(dt);
      }
      return near;
    },
  };
}

// Hedwig from the fan owl model (perched, wings tucked), or a simple white owl fallback.
async function owlFigure() {
  const obj = await loadModel('owl');
  const g = new Group();
  if (obj) {
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    fitModel(obj, { x: 0, z: 0, height: 0.55 });
    g.add(obj);
  } else {
    const body = new Mesh(new SphereGeometry(0.26, 16, 12), mat(0xf3f1ea, { roughness: 0.95 }));
    body.scale.set(1, 1.3, 1); body.castShadow = true; g.add(body);
    for (const sx of [-0.09, 0.09]) {
      const eye = new Mesh(new SphereGeometry(0.05, 8, 8), mat(0x1a1a1a));
      eye.position.set(sx, 0.12, 0.2); g.add(eye);
    }
  }
  return g;
}
