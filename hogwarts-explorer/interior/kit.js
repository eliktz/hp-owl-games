/* Shared building blocks for the rooms: floor/ceiling slabs, stone walls with door
 * gaps, gothic pointed arches, columns and hanging banners. Keeps each room file short. */
(function (HPI) {
  const T = HPI.T;

  function slab(scene, rect, matInfo, y, faceUp, rep = 3) {
    const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
    const mat = new T.MeshStandardMaterial({ map: matInfo.map, bumpMap: matInfo.bump || null, bumpScale: 0.25, roughness: 0.95 });
    if (matInfo.map) matInfo.map.repeat.set(w / rep, d / rep);
    if (matInfo.bump) matInfo.bump.repeat.set(w / rep, d / rep);
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat);
    m.rotation.x = faceUp ? -Math.PI / 2 : Math.PI / 2;
    m.position.set((rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2);
    scene.add(m); return m;
  }

  // a stone wall panel along one axis, optionally split around a door gap.
  // spec: {axis:'x'|'z', c, lo, hi, y0, y1, gap:[glo,ghi]}
  function wall(scene, spec, matInfo) {
    const { axis, c, lo, hi, y0 = 0, y1 = 10, gap } = spec;
    const segs = [];
    if (gap) { if (gap[0] > lo) segs.push([lo, gap[0]]); if (gap[1] < hi) segs.push([gap[1], hi]); if (gap[1] < y1) {/* lintel over door */ } }
    else segs.push([lo, hi]);
    const mat = new T.MeshStandardMaterial({ map: cloneTex(matInfo.map), bumpMap: cloneTex(matInfo.bump), bumpScale: 0.3, roughness: 0.95 });
    for (const [a, b] of segs) {
      const len = b - a, h = y1 - y0, th = 0.5;
      if (mat.map) mat.map.repeat.set(len / 3, h / 3);
      const geo = axis === 'x' ? new T.BoxGeometry(th, h, len) : new T.BoxGeometry(len, h, th);
      const m = new T.Mesh(geo, mat.clone());
      if (axis === 'x') m.position.set(c, (y0 + y1) / 2, (a + b) / 2);
      else m.position.set((a + b) / 2, (y0 + y1) / 2, c);
      scene.add(m);
    }
    if (gap) { // stone lintel bridging the doorway top
      const len = gap[1] - gap[0], th = 0.5, lh = 1.4, ly = y1 - lh / 2;
      const geo = axis === 'x' ? new T.BoxGeometry(th, lh, len) : new T.BoxGeometry(len, lh, th);
      const m = new T.Mesh(geo, mat.clone());
      if (axis === 'x') m.position.set(c, ly, (gap[0] + gap[1]) / 2);
      else m.position.set((gap[0] + gap[1]) / 2, ly, c);
      scene.add(m);
    }
  }

  function cloneTex(t) {
    if (!t) return null;
    const n = t.clone(); n.needsUpdate = true; n.wrapS = n.wrapT = T.RepeatWrapping; return n;
  }

  // a stone column with a flared base + capital
  function column(scene, x, z, h, r = 0.5, mat) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const m = mat || new T.MeshStandardMaterial({ color: 0x4a4668, roughness: 0.95 });
    const shaft = new T.Mesh(new T.CylinderGeometry(r, r * 1.1, h, 12), m); shaft.position.y = h / 2; g.add(shaft);
    const base = new T.Mesh(new T.CylinderGeometry(r * 1.5, r * 1.7, 0.5, 12), m); base.position.y = 0.25; g.add(base);
    const cap = new T.Mesh(new T.CylinderGeometry(r * 1.6, r * 1.2, 0.5, 12), m); cap.position.y = h - 0.25; g.add(cap);
    scene.add(g); return g;
  }

  // a gothic pointed arch between two columns, as a thin ribbed frame
  function pointedArch(scene, x, z, span, rise, axis, mat) {
    const m = mat || new T.MeshStandardMaterial({ color: 0x3a3658, roughness: 0.95 });
    const steps = 7, pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, ang = t * Math.PI; // left->right
      const px = Math.cos(ang) * (span / 2);
      const py = Math.sin(ang * 0.5) * rise; // pointed: half-sine gives a tall peak
      pts.push([px, py]);
    }
    const g = new T.Group();
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const seg = new T.Mesh(new T.BoxGeometry(0.35, len, 0.35), m);
      seg.position.set((ax + bx) / 2, (ay + by) / 2, 0);
      seg.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
      g.add(seg);
    }
    if (axis === 'x') g.rotation.y = Math.PI / 2;
    g.position.set(x, 0, z); scene.add(g); return g;
  }

  function banner(scene, tex, x, y, z, w = 2.4, h = 5, faceZ = 1) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({ map: tex, roughness: 0.9, side: T.DoubleSide }));
    m.position.set(x, y, z); if (faceZ === 0) m.rotation.y = Math.PI / 2;
    scene.add(m);
    // a little top pole
    const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, w + 0.4, 6), new T.MeshStandardMaterial({ color: 0x20201e, metalness: 0.5, roughness: 0.6 }));
    pole.rotation.z = Math.PI / 2; pole.position.set(x, y + h / 2, z); if (faceZ === 0) pole.rotation.y = Math.PI / 2;
    scene.add(pole); return m;
  }

  HPI.kit = { slab, wall, column, pointedArch, banner, cloneTex };
})(window.HPI);
