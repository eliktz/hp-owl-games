// Batch 8 (spells on the castle's REAL objects): build-time helper for the rooms.
// A room hands the few objects that Wingardium Leviosa / Accio may move (a chair, books, goblets, brooms...)
// to liftables() INSTEAD of its static merge / prop mesh. They are drawn exactly as before (same geometry,
// same colours, the same material settings) but as ONE SkinnedMesh per material with one bone per object,
// so each object can move on its own while the room costs at most +1 draw call per material when idle
// (+1 or +2 per room). freecast-real-objects.js poses the bones; nothing here runs per frame.
//   L = liftables(g, { ceil })            ceil = the room's ceiling height (m), for the Leviosa cap
//   L.add(id, { kind, mat, material, pivot: [x, y, z], parts, h, slide, heavy, furniture, rattle, loop })
//     mat 'vc'    parts [[geometry, hex]]  (vertex colours, like propMesh / vcMesh: roughness 0.75)
//     mat 'tex'   parts [geometry]          (keeps its uv: a textured material such as woodMat, passed as `material`)
//     mat 'plain' parts [geometry]          (no uv / colours: e.g. the gold of the goblets, passed as `material`)
//     geometry is in ROOM coordinates (where the object stands now); pivot is its base centre.
//     noLift, b9   batch 9: a broken piece / a dish to grow / flowers to bloom (freecast-real-things.js), not lifted
//   L.finish()  builds the meshes and leaves g.userData.lift = { items, meshes, ceil }
import { SkinnedMesh, Skeleton, Bone, MeshStandardMaterial, Float32BufferAttribute, BufferAttribute, Uint16BufferAttribute, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP = { vc: ['position', 'normal', 'color'], tex: ['position', 'normal', 'uv'], plain: ['position', 'normal'] };

export function liftables(g, { ceil = 9 } = {}) {
  const groups = new Map();   // key -> { mat, material, geos: [], items: [] }
  const items = [];
  const c = new Color();
  function add(id, o) {
    const mat = o.mat || 'vc';
    const key = mat === 'vc' ? 'vc' : mat + ':' + o.material.uuid;
    let G = groups.get(key); if (!G) groups.set(key, G = { mat, material: o.material || null, geos: [], items: [] });
    const bi = G.items.length;
    for (const p of o.parts) {
      const geo0 = mat === 'vc' ? p[0] : p;
      const n = geo0.index ? geo0.toNonIndexed() : geo0.clone();
      if (mat === 'vc') {
        const col = new Float32Array(n.attributes.position.count * 3); c.setHex(p[1]);
        for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
        n.setAttribute('color', new Float32BufferAttribute(col, 3));
      }
      for (const k of Object.keys(n.attributes)) if (!KEEP[mat].includes(k)) n.deleteAttribute(k);
      if (mat === 'tex' && !n.attributes.uv) n.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      const cnt = n.attributes.position.count, si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
      for (let i = 0; i < cnt; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      n.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4)); n.setAttribute('skinWeight', new BufferAttribute(sw, 4));
      G.geos.push(n);
    }
    const it = { id, kind: o.kind || 'thing', pivot: o.pivot, h: o.h || 0.3, slide: o.slide || null, heavy: !!o.heavy, furniture: !!o.furniture,
      rattle: !!o.rattle, loop: o.loop || null, size: o.size || 0.3, bone: null,
      noLift: !!o.noLift, b9: o.b9 || null };   // batch 9 (freecast-real-things.js): noLift = not a Leviosa / Accio target; b9 = { fix | grow | bloom }
    G.items.push(it); items.push(it);
    return it;
  }
  function finish() {
    const meshes = [];
    for (const G of groups.values()) {
      if (!G.items.length) continue;
      const geo = mergeGeometries(G.geos, false); if (!geo) continue;
      const material = G.mat === 'vc' ? new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }) : G.material.clone();
      const skin = new SkinnedMesh(geo, material);
      skin.name = 'liftables'; skin.castShadow = false; skin.frustumCulled = false;   // (no shadow pass: idle cost +1 draw call per material)
      const bones = G.items.map(it => { const b = new Bone(); b.position.set(it.pivot[0], it.pivot[1], it.pivot[2]); it.bone = b; skin.add(b); return b; });
      g.add(skin);
      skin.updateMatrixWorld(true);
      skin.bind(new Skeleton(bones));
      meshes.push(skin);
    }
    for (const it of items) it.rest = { p: it.bone.position.clone(), q: it.bone.quaternion.clone() };
    g.userData.lift = { items, meshes, ceil };
    return g.userData.lift;
  }
  return { add, finish };
}

// DEBUG / TEST ONLY: after an aim() helper parks Harry facing a target, swing the camera so the target is in clear view
// (SpringCamera.frame) and place the lens now. Indoors the room's meshes are checked; outdoors the arm's obstacles.
export function frameShot(player, interiors, at) {
  const cam = player.cam; if (!cam || !cam.frame) return null;
  const roots = interiors.active && interiors.room && interiors.room.group ? [interiors.room.group] : (cam.obstacles || []);
  let r = null, moved = 0;
  try {
    // Harry must not stand inside a small prop (the library globe sits where aim() puts him for a shelf book): the lens
    // would see only the prop. Step sideways (across the line to the target) until his head and shoulders are clear.
    const props = [];
    for (const g of roots) if (g) g.traverseVisible(o => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const bs = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
      if (bs.radius < 1.5) props.push(bs);
    });
    const P = player.pos, fx = at.x - P.x, fz = at.z - P.z, L = Math.hypot(fx, fz) || 1, sx = -fz / L, sz = fx / L;
    const inside = (x, z) => props.some(b => { for (const hy of [1.25, 1.6]) if (Math.hypot(b.center.x - x, b.center.y - (P.y + hy), b.center.z - z) < b.radius + 0.25) return true; return false; });
    if (inside(P.x, P.z)) {
      const x0 = P.x, z0 = P.z;
      for (const k of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4]) {
        const x = x0 + sx * k, z = z0 + sz * k; if (inside(x, z)) continue;
        player.yaw = Math.atan2(at.x - x, at.z - z);
        try { player.teleport(x, z); } catch { /* plain move */ }
        P.x = x; P.z = z; moved = k; break;
      }
    }
    r = cam.frame(player.pos, player.yaw, at, roots, [player.model].filter(Boolean));
    cam.update(0.016, player.pos, player.yaw, false); player.camera.updateMatrixWorld(true);
  } catch (e) { return { err: String(e && e.message || e) }; }
  return r && { off: +r.off.toFixed(2), dist: r.dist, clear: r.clear, moved };
}
