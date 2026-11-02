// Friendly inhabitants of the grounds. Ron, Hermione and Hedwig use the committed fan
// models (assets/models/, see MODELS-CREDITS.md); Harry and Hagrid are drawn in code to
// match the chibi style. Everyone has a gentle idle animation (bob / float) and a short
// set of friendly Hebrew lines shown when the player walks up (see main.js for the bubble).
import {
  Group, Mesh, SphereGeometry, CapsuleGeometry, ConeGeometry, TorusGeometry,
  MeshStandardMaterial, Color,
} from 'three';
import { loadModel, fitModel } from './models.js';
import { SPOTS } from './config.js';

const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.85, ...extra });

// A little chibi figure: robe cone + body + head, plus optional extras (glasses, beard…).
function chibi({ robe, skin = 0xe8c49a, scale = 1 }) {
  const g = new Group();
  const r = new Mesh(new ConeGeometry(0.55, 1.5, 14), mat(robe, { roughness: 0.9 }));
  r.position.y = 0.75; r.castShadow = true; g.add(r);
  const body = new Mesh(new CapsuleGeometry(0.28, 0.5, 4, 8), mat(robe));
  body.position.y = 1.35; body.castShadow = true; g.add(body);
  const head = new Mesh(new SphereGeometry(0.27, 18, 14), mat(skin, { roughness: 0.7 }));
  head.position.y = 1.92; head.castShadow = true; g.add(head);
  g.scale.setScalar(scale);
  g.userData.head = head;
  return g;
}

function buildHarry() {
  const g = chibi({ robe: 0x2a2140 });
  const head = g.userData.head;
  for (const sx of [-0.1, 0.1]) {                      // round glasses
    const ring = new Mesh(new TorusGeometry(0.07, 0.018, 8, 16), mat(0x101010, { metalness: 0.3 }));
    ring.position.set(sx, 1.92, 0.24); g.add(ring);
  }
  const hair = new Mesh(new SphereGeometry(0.29, 16, 12), mat(0x2a1a12, { roughness: 0.95 }));
  hair.position.set(0, 2.02, -0.03); hair.scale.set(1, 0.7, 1); g.add(hair);
  const scarf = new Mesh(new CapsuleGeometry(0.1, 0.5, 3, 6), mat(0x7a1020, { emissive: new Color(0x300008) }));
  scarf.position.set(0, 1.28, 0.16); g.add(scarf);
  void head; return g;
}

function buildHagrid() {
  const g = chibi({ robe: 0x4a3524, skin: 0xd9ad86, scale: 1.5 });
  const coat = new Mesh(new ConeGeometry(0.62, 1.6, 14), mat(0x30241a, { roughness: 0.95 }));
  coat.position.y = 0.8; coat.castShadow = true; g.add(coat);
  const beard = new Mesh(new ConeGeometry(0.3, 0.7, 12), mat(0x3b352f, { roughness: 1 }));
  beard.position.set(0, 1.72, 0.12); beard.rotation.x = Math.PI; g.add(beard);
  const hair = new Mesh(new SphereGeometry(0.34, 16, 12), mat(0x3b352f, { roughness: 1 }));
  hair.position.set(0, 2.0, -0.02); hair.scale.set(1, 0.9, 1); g.add(hair);
  return g;
}

// Model-backed figure: load, scale to height, face the player. Falls back to a chibi.
async function modelFigure(name, height, fallbackRobe) {
  const obj = await loadModel(name);
  if (!obj) return chibi({ robe: fallbackRobe });
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

  let t = 0;
  return {
    characters: chars,
    update(dt, playerPos) {
      t += dt;
      let near = null, best = 1e9;
      for (const c of chars) {
        const s = Math.sin(t * (c.kind === 'owl' ? 2.2 : 1.4) + c.phase);
        if (c.kind === 'owl') { c.group.position.y = c.baseY + s * 0.18 + 0.1; c.group.rotation.y += dt * 0.4; }
        else { c.group.position.y = c.baseY + Math.abs(s) * 0.04; c.group.rotation.y = Math.sin(t * 0.5 + c.phase) * 0.25; }
        if (playerPos) {
          const d = Math.hypot(playerPos.x - c.x, playerPos.z - c.z);
          if (d < 4.5 && d < best) { best = d; near = c; }
        }
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
