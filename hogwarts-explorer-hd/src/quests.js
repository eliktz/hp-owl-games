// Gentle, no-fail quests for a small child: collect glowing stars ✨ scattered around the
// grounds, and pick up letters 💌 to deliver to friends. Walking into a star collects it;
// carrying a letter near any friend delivers it. Everything just counts up — you can never
// lose. The star/letter meshes glow (emissive) so the bloom pass makes them sparkle.
import {
  InstancedMesh, Object3D, OctahedronGeometry, BoxGeometry, MeshStandardMaterial, Color,
} from 'three';

const STAR_SPOTS = [
  [6, 40], [-20, 30], [-44, -6], [40, -4], [12, -22], [-8, 48],
  [64, 20], [84, 30], [-30, -30], [26, 34], [-50, 18], [0, -36],
];
const LETTER_SPOTS = [[-14, 12], [30, 18], [-38, 2], [58, 8], [4, 24]];

// All stars are ONE instanced mesh and all letters two (envelope + seal): 3 draw calls instead
// of 22, with the bob/spin written straight into the instance matrices.
function starMesh(n) {
  const m = new InstancedMesh(
    new OctahedronGeometry(0.42, 0),
    new MeshStandardMaterial({ color: 0xfff1a8, emissive: new Color(0xffcf4d), emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.2 }), n);
  m.castShadow = false; m.frustumCulled = false; m.name = 'star';
  return m;
}
function letterMeshes(n) {
  const env = new InstancedMesh(new BoxGeometry(0.5, 0.34, 0.06),
    new MeshStandardMaterial({ color: 0xfff6e2, emissive: new Color(0x6a5020), emissiveIntensity: 0.5, roughness: 0.6 }), n);
  const seal = new InstancedMesh(new BoxGeometry(0.12, 0.12, 0.08),
    new MeshStandardMaterial({ color: 0xc02030, emissive: new Color(0x401018), emissiveIntensity: 0.8 }), n);
  env.frustumCulled = seal.frustumCulled = false; env.name = 'letter'; seal.name = 'letter-seal';
  return { env, seal };
}

// Create the collectibles and quest state. `onToast(msg)` shows a child-friendly message.
// update(dt, playerPos, nearChar) spins/bobs items, collects on proximity, delivers letters
// to a nearby friend, and keeps the HUD counters in sync.
export function createQuests({ scene, heightAt, hud, onToast, sfx = {} }) {
  const ding = (k) => { try { sfx[k] && sfx[k](); } catch { /* ignore */ } };
  const ground = (x, z) => (heightAt ? heightAt(x, z) : 0) + 1.1;
  const starIM = starMesh(STAR_SPOTS.length); scene.add(starIM);
  const { env: envIM, seal: sealIM } = letterMeshes(LETTER_SPOTS.length); scene.add(envIM, sealIM);
  const stars = STAR_SPOTS.map(([x, z]) => ({ x, z, got: false }));
  const letters = LETTER_SPOTS.map(([x, z]) => ({ x, z, got: false }));
  const d = new Object3D();
  const put = (im, i, x, y, z, ry, s) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.setScalar(s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); };

  const state = { stars: 0, carrying: 0, delivered: 0 };
  const total = stars.length;
  let t = 0, deliverCd = 0;
  const setHud = () => {
    hud.set('stars', '⭐ ' + state.stars + '/' + total);
    hud.set('letters', '💌 ' + state.delivered + (state.carrying ? ' (+' + state.carrying + ')' : ''));
  };
  setHud();

  return {
    state, roots: [starIM, envIM, sealIM],
    bonus(n) { state.stars += n; setHud(); },          // prizes from lessons / mini-games
    update(dt, playerPos, nearChar) {
      t += dt; deliverCd = Math.max(0, deliverCd - dt);
      stars.forEach((s, i) => {
        if (s.got) return put(starIM, i, s.x, -999, s.z, 0, 0.0001);
        put(starIM, i, s.x, ground(s.x, s.z) + Math.sin(t * 2 + s.x) * 0.12, s.z, t * 1.6, 1);
        if (playerPos && Math.hypot(playerPos.x - s.x, playerPos.z - s.z) < 1.8) {
          s.got = true; state.stars++;
          setHud(); onToast('⭐ כוכב קסם! אספת ' + state.stars); ding('chime');
        }
      });
      letters.forEach((l, i) => {
        if (l.got) { put(envIM, i, l.x, -999, l.z, 0, 0.0001); return put(sealIM, i, l.x, -999, l.z, 0, 0.0001); }
        const y = ground(l.x, l.z) + Math.sin(t * 1.8 + l.z) * 0.1, ry = t * 1.2;
        put(envIM, i, l.x, y, l.z, ry, 1); put(sealIM, i, l.x + Math.sin(ry) * 0.03, y, l.z + Math.cos(ry) * 0.03, ry, 1);
        if (playerPos && Math.hypot(playerPos.x - l.x, playerPos.z - l.z) < 1.8) {
          l.got = true; state.carrying++;
          setHud(); onToast('💌 מצאת מכתב! מסרו אותו לחבר'); ding('letter');
        }
      });
      starIM.instanceMatrix.needsUpdate = true; envIM.instanceMatrix.needsUpdate = true; sealIM.instanceMatrix.needsUpdate = true;
      // deliver a carried letter to any friend we're standing next to
      if (nearChar && state.carrying > 0 && deliverCd === 0) {
        state.carrying--; state.delivered++; deliverCd = 2.5;
        setHud(); onToast('💌 מכתב נמסר ל' + (nearChar.heb || 'חבר') + '! תודה רבה'); ding('chime');
      }
    },
  };
}
