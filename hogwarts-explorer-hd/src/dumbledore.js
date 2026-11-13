// Professor Dumbledore on the Great Hall dais, behind the head table (rigged film-look GLB).
// He has NO chibi stand-in: if his model cannot load, the dais simply stays empty.
// Same room-lifetime rules as the GLB professors in lessons.js (upgradeProfessor): the
// "room was left meanwhile" guard, an onTeardown that stops the mixer and uncaches, the
// geometry shared with the models.js cache (never disposed), and no mixer work while the
// room is gone (its update stops) or hidden.
// Behaviour: Idle loop; Welcome once as you come into the hall and once more the first time
// you walk within ~10 m; Talk + a short gentle Hebrew line in the game's bubble while you
// stand within ~5.5 m (the dais edge is ~4.5 m from him).
import { AnimationMixer, LoopOnce, Group, Vector3 } from 'three';
import { loadAnimated } from './models.js';
import * as fun from './fun.js';

const SCALE = 1.3;                  // the cast's world scale (rest height 1.95 m -> ~2.5 m)
const HEAD = 1.95 * SCALE + 0.35;   // bubble height above his feet
const FADE = 0.3, NEAR = 10, TALK = 5.5, TALK_OFF = 7;
const LINES = [
  'בְּרוּכִים הַבָּאִים לְהוֹגווֹרטְס! 🌟',
  'הַקֶּסֶם הֲכִי גָּדוֹל הוּא חֲבֵרוּת. 💛',
  'אַל תִּשְׁכְּחוּ לְבַקֵּר בַּסִּפְרִיָּה! 📚',
  'כָּל אֶחָד יָכוֹל לִהְיוֹת אַמִּיץ. 🦁',
  'אֲנִי כָּל כָּךְ שָׂמֵחַ שֶׁבָּאתֶם! ✨',
];

// Adds him to the hall group `g` (room-local coords; feet at y = `y`, facing +Z toward the
// south doors). Returns a per-frame tick(dt) for the room's update (a no-op until loaded).
export function addDumbledore(g, x, y, z) {
  const holder = new Group(); holder.name = 'dumbledore'; holder.position.set(x, y, z); g.add(holder);
  const st = { mixer: null, acts: null, cur: null, welcomes: 0, nearDone: false, talking: false, line: -1 };
  holder.userData.dumbledore = st;
  const inScene = () => { let root = holder; while (root.parent) root = root.parent; return !!root.isScene; };
  const tmp = new Vector3(), wp = new Vector3();

  loadAnimated('dumbledore', inScene).then(r => {
    if (!r || !inScene()) { if (!r) console.warn('[dumbledore] GLB unavailable - the dais stays empty (see __game.models())'); return; }
    const clip = n => r.clips.find(a => a.name === n);
    if (!clip('Idle')) { console.warn('[dumbledore] GLB has no Idle clip - skipped'); return; }
    const obj = r.obj; obj.scale.setScalar(SCALE); obj.name = 'prof-dumbledore';
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false;
      o.userData.sharedGeo = true;                   // geometry is shared with the models.js cache
    });
    const mixer = new AnimationMixer(obj), acts = {};
    for (const n of ['Idle', 'Talk', 'Welcome']) { const a = clip(n); if (a) acts[n.toLowerCase()] = mixer.clipAction(a); }
    if (acts.welcome) { acts.welcome.setLoop(LoopOnce, 1); acts.welcome.clampWhenFinished = true; }
    mixer.addEventListener('finished', e => { if (e.action === acts.welcome) fadeTo(st.talking ? 'talk' : 'idle'); });
    acts.idle.play(); st.cur = 'idle';
    holder.add(obj);
    st.mixer = mixer; st.acts = acts;
    // room teardown (interiors.js) calls this before disposing the room's own geometry
    holder.userData.onTeardown = () => {
      mixer.stopAllAction(); mixer.uncacheRoot(obj);
      obj.traverse(o => { if (o.isSkinnedMesh) { try { o.skeleton.dispose(); } catch { /* backend quirk */ } } });
      st.mixer = null; st.acts = null;
    };
    welcome();                                       // the player has just come into the hall
  }).catch(e => console.warn('[dumbledore] GLB skipped -', e.message));

  function fadeTo(name) {
    if (!st.mixer || st.cur === name || !st.acts[name]) return;
    const next = st.acts[name], prev = st.acts[st.cur];
    next.reset().play();
    if (prev) prev.crossFadeTo(next, FADE, false);
    st.cur = name;
  }
  function welcome() { if (st.acts?.welcome) { fadeTo('welcome'); st.welcomes++; } }

  return function tick(dt) {
    if (!st.mixer) return;
    for (let o = holder; o; o = o.parent) if (!o.visible) return;   // hidden: no skinning work
    const pl = window.__game?.player?.pos;
    if (pl) {
      holder.getWorldPosition(wp);
      const dx = pl.x - wp.x, dz = pl.z - wp.z, d = Math.hypot(dx, dz);
      if (d < NEAR && !st.nearDone) { st.nearDone = true; if (st.cur !== 'welcome') welcome(); }
      if (!st.talking && d < TALK) { st.talking = true; st.line = (st.line + 1) % LINES.length; }
      else if (st.talking && d > TALK_OFF) st.talking = false;
      if (st.cur !== 'welcome') fadeTo(st.talking ? 'talk' : 'idle');
      if (st.talking) fun.say(tmp.set(wp.x, wp.y + HEAD, wp.z), LINES[st.line], 0.25, 'dumbledore');
      // a gentle turn toward a nearby child (never past the table's ends)
      const want = d < NEAR + 4 ? Math.max(-0.55, Math.min(0.55, Math.atan2(dx, dz))) : 0;
      holder.rotation.y += (want - holder.rotation.y) * Math.min(1, dt * 2.5);
    }
    st.mixer.update(dt);
  };
}
