/* Room visibility culling — the single biggest iPad win indoors. The castle is one scene,
 * so without this every room in the view direction is drawn even when it sits behind solid
 * stone (1,500–2,700 draw calls a frame). Here every top-level object is bucketed into the
 * room its bounding-box centre falls in; each frame only the room you are in, the rooms
 * joined to it by a doorway, and near second-ring rooms (you can see down a corridor into
 * the next hall) stay visible. Doorway adjacency is derived from the nav walls themselves,
 * so it can never drift from the real floor plan. */
(function (HPI) {
  const T = HPI.T;

  HPI.Cull = function (scene) {
    const L = HPI.L;
    const rooms = [];
    for (const k in L) if (L[k] && typeof L[k] === 'object' && 'x0' in L[k]) rooms.push({ key: k, r: L[k], objs: [], adj: new Set(), on: true });
    // the enclosed moving-staircase shaft is scenery (not walkable), seen from the gallery
    rooms.push({ key: 'SH', r: { x0: -14, x1: 8, z0: -40, z1: -14.01 }, objs: [], adj: new Set(), on: true, scenery: true });
    const byKey = {}; rooms.forEach((m) => (byKey[m.key] = m));
    const rectDist = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

    // ---- doorway adjacency: walk each pair's shared edge and look for a spot no wall blocks ----
    const p = { x: 0, z: 0 };
    function open(x, z) { p.x = x; p.z = z; HPI.nav.collide(p, 0.45); return Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6; }
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j]; if (a.scenery || b.scenery) continue;
      let linked = false;
      const zl = Math.max(a.r.z0, b.r.z0), zh = Math.min(a.r.z1, b.r.z1), xl = Math.max(a.r.x0, b.r.x0), xh = Math.min(a.r.x1, b.r.x1);
      if ((Math.abs(a.r.x1 - b.r.x0) < 0.01 || Math.abs(b.r.x1 - a.r.x0) < 0.01) && zh - zl > 1) {
        const x = Math.abs(a.r.x1 - b.r.x0) < 0.01 ? a.r.x1 : a.r.x0;
        for (let z = zl + 0.6; z < zh - 0.5 && !linked; z += 0.5) linked = open(x, z);
      } else if ((Math.abs(a.r.z1 - b.r.z0) < 0.01 || Math.abs(b.r.z1 - a.r.z0) < 0.01) && xh - xl > 1) {
        const z = Math.abs(a.r.z1 - b.r.z0) < 0.01 ? a.r.z1 : a.r.z0;
        for (let x = xl + 0.6; x < xh - 0.5 && !linked; x += 0.5) linked = open(x, z);
      }
      if (linked) { a.adj.add(b); b.adj.add(a); }
    }
    if (byKey.GAL) { byKey.GAL.adj.add(byKey.SH); byKey.SH.adj.add(byKey.GAL); }

    // ---- bucket an object into its room(s) ----
    const box = new T.Box3(), c = new T.Vector3();
    function assign(o) {
      if (o.isLight || o.userData.cullSkip) return;
      let list = null;
      if (o.userData.room) list = [].concat(o.userData.room).map((k) => byKey[k]).filter(Boolean);
      else {
        box.setFromObject(o); if (box.isEmpty()) return;
        box.getCenter(c);
        list = rooms.filter((m) => c.x >= m.r.x0 - 0.7 && c.x <= m.r.x1 + 0.7 && c.z >= m.r.z0 - 0.7 && c.z <= m.r.z1 + 0.7);
        if (!list.length) {
          let best = null, bd = 4;
          for (const m of rooms) { const d = rectDist(m.r, c.x, c.z); if (d < bd) { bd = d; best = m; } }
          if (best) list = [best];
        }
      }
      if (!list || !list.length) return;          // unowned → simply always drawn
      o.userData._rooms = list;
      for (const m of list) m.objs.push(o);
    }
    scene.children.forEach(assign);

    let cur = byKey.EH || rooms[0], stamp = '';
    function update(pos) {
      // which room is the player in? (rect-inclusive; keep the last one in a doorway seam)
      if (!(pos.x >= cur.r.x0 && pos.x <= cur.r.x1 && pos.z >= cur.r.z0 && pos.z <= cur.r.z1)) {
        for (const m of rooms) if (!m.scenery && pos.x >= m.r.x0 && pos.x <= m.r.x1 && pos.z >= m.r.z0 && pos.z <= m.r.z1) { cur = m; break; }
      }
      for (const m of rooms) m.want = false;
      cur.want = true;
      for (const a of cur.adj) {
        a.want = true;
        // second ring: only when it is close enough to be seen through the fog down a doorway
        for (const b of a.adj) if (!b.want && rectDist(b.r, pos.x, pos.z) < 46) b.want = true;
      }
      let s = ''; for (const m of rooms) s += m.want ? '1' : '0';
      if (s === stamp) return; stamp = s;
      for (const m of rooms) m.on = m.want;
      // an object shared by two rooms (a wall on their seam) shows if either room does
      for (const m of rooms) for (const o of m.objs) {
        const rs = o.userData._rooms; let v = false;
        for (let i = 0; i < rs.length; i++) if (rs[i].on) { v = true; break; }
        if (!o.userData.cullHidden) o.visible = v;
        o.userData._cullOn = v;
      }
    }
    return {
      update, add: assign, rooms, byKey,
      roomOf(x, z) { for (const m of rooms) if (!m.scenery && x >= m.r.x0 && x <= m.r.x1 && z >= m.r.z0 && z <= m.r.z1) return m.key; return null; },
      get current() { return cur.key; },
      visible() { return rooms.filter((m) => m.on).map((m) => m.key); },
      adjacency() { const o = {}; rooms.forEach((m) => (o[m.key] = [...m.adj].map((a) => a.key))); return o; },
    };
  };
})(window.HPI);
