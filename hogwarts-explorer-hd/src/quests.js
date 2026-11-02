// Gentle, no-fail quests for a small child: collect glowing stars ✨ scattered around the
// grounds, and pick up letters 💌 to deliver to friends. Walking into a star collects it;
// carrying a letter near any friend delivers it. Everything just counts up — you can never
// lose. The star/letter meshes glow (emissive) so the bloom pass makes them sparkle.
import {
  Group, Mesh, OctahedronGeometry, BoxGeometry, MeshStandardMaterial, Color,
} from 'three';

const STAR_SPOTS = [
  [6, 40], [-20, 30], [-44, -6], [40, -4], [12, -22], [-8, 48],
  [64, 20], [84, 30], [-30, -30], [26, 34], [-50, 18], [0, -36],
];
const LETTER_SPOTS = [[-14, 12], [30, 18], [-38, 2], [58, 8], [4, 24]];

function starMesh() {
  const m = new Mesh(
    new OctahedronGeometry(0.42, 0),
    new MeshStandardMaterial({ color: 0xfff1a8, emissive: new Color(0xffcf4d), emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.2 }),
  );
  m.castShadow = false;
  return m;
}

function letterMesh() {
  const g = new Group();
  const env = new Mesh(
    new BoxGeometry(0.5, 0.34, 0.06),
    new MeshStandardMaterial({ color: 0xfff6e2, emissive: new Color(0x6a5020), emissiveIntensity: 0.5, roughness: 0.6 }),
  );
  g.add(env);
  const seal = new Mesh(
    new BoxGeometry(0.12, 0.12, 0.08),
    new MeshStandardMaterial({ color: 0xc02030, emissive: new Color(0x401018), emissiveIntensity: 0.8 }),
  );
  seal.position.z = 0.03; g.add(seal);
  return g;
}

// Create the collectibles and quest state. `onToast(msg)` shows a child-friendly message.
// update(dt, playerPos, nearChar) spins/bobs items, collects on proximity, delivers letters
// to a nearby friend, and keeps the HUD counters in sync.
export function createQuests({ scene, heightAt, hud, onToast, sfx = {} }) {
  const ding = (k) => { try { sfx[k] && sfx[k](); } catch { /* ignore */ } };
  const ground = (x, z) => (heightAt ? heightAt(x, z) : 0) + 1.1;
  const stars = STAR_SPOTS.map(([x, z]) => {
    const m = starMesh(); m.position.set(x, ground(x, z), z); m.name = 'star';
    scene.add(m); return { mesh: m, x, z, got: false };
  });
  const letters = LETTER_SPOTS.map(([x, z]) => {
    const m = letterMesh(); m.position.set(x, ground(x, z), z); m.name = 'letter';
    scene.add(m); return { mesh: m, x, z, got: false };
  });

  const state = { stars: 0, carrying: 0, delivered: 0 };
  const total = stars.length;
  let t = 0, deliverCd = 0;
  const setHud = () => {
    hud.set('stars', '⭐ ' + state.stars + '/' + total);
    hud.set('letters', '💌 ' + state.delivered + (state.carrying ? ' (+' + state.carrying + ')' : ''));
  };
  setHud();

  return {
    state,
    update(dt, playerPos, nearChar) {
      t += dt; deliverCd = Math.max(0, deliverCd - dt);
      for (const s of stars) {
        if (s.got) continue;
        s.mesh.rotation.y += dt * 1.6;
        s.mesh.position.y = ground(s.x, s.z) + Math.sin(t * 2 + s.x) * 0.12;
        if (playerPos && Math.hypot(playerPos.x - s.x, playerPos.z - s.z) < 1.8) {
          s.got = true; scene.remove(s.mesh); state.stars++;
          setHud(); onToast('⭐ כוכב קסם! אספת ' + state.stars); ding('chime');
        }
      }
      for (const l of letters) {
        if (l.got) continue;
        l.mesh.rotation.y += dt * 1.2;
        l.mesh.position.y = ground(l.x, l.z) + Math.sin(t * 1.8 + l.z) * 0.1;
        if (playerPos && Math.hypot(playerPos.x - l.x, playerPos.z - l.z) < 1.8) {
          l.got = true; scene.remove(l.mesh); state.carrying++;
          setHud(); onToast('💌 מצאת מכתב! מסרו אותו לחבר'); ding('letter');
        }
      }
      // deliver a carried letter to any friend we're standing next to
      if (nearChar && state.carrying > 0 && deliverCd === 0) {
        state.carrying--; state.delivered++; deliverCd = 2.5;
        setHud(); onToast('💌 מכתב נמסר ל' + (nearChar.heb || 'חבר') + '! תודה רבה'); ding('chime');
      }
    },
  };
}
