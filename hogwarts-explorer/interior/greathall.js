/* The Great Hall — four long house tables leading to a raised head table, a soaring
 * vaulted ceiling of pointed stone arches, thousands-of-candles floating in mid-air
 * (we float ~44), tall stained-glass windows throwing coloured light, four house
 * banners, and the enchanted night-sky ceiling overhead. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit;
  const CEIL = 20;

  HPI.buildGreatHall = function (scene, light) {
    const GH = L.GH;
    HPI.nav.room(GH, { e: [22, 28], n: [-50, -44] });                // door to Entrance Hall + stair down to the dungeon

    kit.slab(scene, GH, HPI.tex.stone(4), 0.02, true, 3.5);          // flagstone floor
    const stone = HPI.tex.stone(4);
    kit.wall(scene, { axis: 'x', c: GH.x0, lo: GH.z0, hi: GH.z1, y0: 0, y1: CEIL }, stone);              // west (head end)
    kit.wall(scene, { axis: 'z', c: GH.z0, lo: GH.x0, hi: GH.x1, y0: 0, y1: CEIL, gap: [-50, -44] }, stone); // north wall, dungeon stair gap
    kit.wall(scene, { axis: 'z', c: GH.z1, lo: GH.x0, hi: GH.x1, y0: 0, y1: CEIL }, stone);              // north long wall

    // ---- vaulted ceiling: columns + pointed-arch ribs across the span ----
    const colMat = new T.MeshStandardMaterial({ color: 0x3f3b5c, roughness: 0.95 });
    for (let x = GH.x0 + 4; x < GH.x1; x += 8) {
      kit.column(scene, x, GH.z0 + 1, 15, 0.6, colMat);
      kit.column(scene, x, GH.z1 - 1, 15, 0.6, colMat);
      kit.pointedArch(scene, x, (GH.z0 + GH.z1) / 2, GH.z1 - GH.z0 - 2, 6, 'x', colMat).position.y = 15;
    }
    // enchanted night-sky ceiling high overhead
    light.enchantedCeiling((GH.x0 + GH.x1) / 2, (GH.z0 + GH.z1) / 2, GH.x1 - GH.x0, GH.z1 - GH.z0, CEIL - 0.5);

    // ---- four long house tables with benches, each dressed in a house colour ----
    const wood = HPI.tex.wood(2, '#3a2412');
    const topMat = new T.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 0.3, roughness: 0.85 });
    const tz = [7, 15, 29, 37];
    tz.forEach((z, i) => {
      const tx0 = -50, tx1 = -17, len = tx1 - tx0, cx = (tx0 + tx1) / 2;
      const top = new T.Mesh(new T.BoxGeometry(len, 0.2, 2.2), topMat); top.position.set(cx, 0.95, z); scene.add(top);
      const runner = new T.Mesh(new T.BoxGeometry(len, 0.02, 0.6),
        new T.MeshStandardMaterial({ color: HPI.HOUSES[i].field, roughness: 0.8 })); runner.position.set(cx, 1.06, z); scene.add(runner);
      [-1, 1].forEach((s) => {
        const leg = new T.Mesh(new T.BoxGeometry(len - 2, 0.85, 0.3), topMat); leg.position.set(cx, 0.42, z + s * 0.9); scene.add(leg);
        const bench = new T.Mesh(new T.BoxGeometry(len, 0.14, 0.6), topMat); bench.position.set(cx, 0.5, z + s * 1.7); scene.add(bench);
        const bleg = new T.Mesh(new T.BoxGeometry(len - 2, 0.5, 0.2), topMat); bleg.position.set(cx, 0.25, z + s * 1.7); scene.add(bleg);
      });
      // golden plates + goblets dotted along the table
      for (let p = tx0 + 3; p < tx1; p += 5) {
        const plate = new T.Mesh(new T.CylinderGeometry(0.3, 0.26, 0.05, 14), new T.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.6, roughness: 0.35 }));
        plate.position.set(p, 1.08, z); scene.add(plate);
        const cup = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 0.26, 10), plate.material); cup.position.set(p + 1.4, 1.18, z - 0.5); scene.add(cup);
      }
    });

    // ---- raised head table on a dais at the west end ----
    const dais = new T.Mesh(new T.BoxGeometry(5, 0.5, 30), new T.MeshStandardMaterial({ color: 0x5a4668, roughness: 0.95 }));
    dais.position.set(GH.x0 + 4, 0.25, (GH.z0 + GH.z1) / 2); scene.add(dais);
    const head = new T.Mesh(new T.BoxGeometry(2.4, 0.2, 26), topMat); head.position.set(GH.x0 + 4, 1.45, (GH.z0 + GH.z1) / 2); scene.add(head);
    const headLeg = new T.Mesh(new T.BoxGeometry(2, 0.85, 26), topMat); headLeg.position.set(GH.x0 + 4, 0.9, (GH.z0 + GH.z1) / 2); scene.add(headLeg);
    // a great golden chair for the headmaster, centred
    const chairMat = new T.MeshStandardMaterial({ color: 0x9a7b2a, metalness: 0.5, roughness: 0.5 });
    const chair = new T.Group();
    chair.add(mkBox(0, 1.9, 0, 1.4, 0.16, 1.2, chairMat));
    chair.add(mkBox(0, 3.0, -0.5, 1.4, 2.6, 0.16, chairMat));
    chair.position.set(GH.x0 + 3, 0.5, (GH.z0 + GH.z1) / 2); scene.add(chair);

    // ---- tall stained-glass windows on both long walls + a rose window at the head end ----
    const hues = [12, 48, 210, 150, 300];
    for (let z = 8, k = 0; z <= 36; z += 7, k++) {
      stainedWindow(scene, light, GH.z0 + 0.3, 11, z, hues[k % hues.length], 'z', 1);
      stainedWindow(scene, light, GH.z1 - 0.3, 11, z, hues[(k + 2) % hues.length], 'z', -1);
    }
    const rose = new T.Mesh(new T.CircleGeometry(4, 24),
      new T.MeshBasicMaterial({ map: HPI.tex.stained(270), transparent: true, opacity: 0.95, side: T.DoubleSide, fog: false }));
    rose.position.set(GH.x0 + 0.4, 14, (GH.z0 + GH.z1) / 2); rose.rotation.y = Math.PI / 2; scene.add(rose);
    light.addShaft(GH.x0 + 4, 11, (GH.z0 + GH.z1) / 2, 14, 3, 0);

    // ---- four house banners between the windows ----
    HPI.HOUSES.forEach((h, i) => {
      const tex = HPI.tex.banner(h.field, h.crest);
      kit.banner(scene, tex, -24 - i * 7, 11, i % 2 ? GH.z1 - 0.6 : GH.z0 + 0.6, 2.6, 6, 0);
    });

    // ---- floating candles hovering between tables + aisle ----
    const NC = Math.round(44 * (HP.perf.quality || 1));
    const geo = new T.CylinderGeometry(0.07, 0.09, 0.6, 6);
    const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0x6a5020, emissiveIntensity: 0.6, roughness: 0.8 }), 44);
    scene.add(im);
    const candles = []; const d = new T.Object3D();
    for (let i = 0; i < 44; i++) {
      const x = -50 + Math.random() * 34, z = 4 + Math.random() * 34, base = 7 + Math.random() * 6;
      candles.push({ x, z, base, ph: Math.random() * 7 });
      const halo = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffd27a, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      halo.scale.setScalar(0.9); scene.add(halo); candles[i].halo = halo;
    }
    light.addDust((GH.x0 + GH.x1) / 2, 2, (GH.z0 + GH.z1) / 2, 40, 12, 36, 200);

    HPI.builders.push((t) => {
      for (let i = 0; i < 44; i++) {
        const c = candles[i], y = c.base + Math.sin(t * 1.1 + c.ph) * 0.4;
        d.position.set(c.x, y, c.z); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        c.halo.position.set(c.x, y + 0.45, c.z);
        c.halo.material.opacity = 0.7 + 0.25 * Math.sin(t * 9 + c.ph);
        c.halo.scale.setScalar(0.85 + 0.12 * Math.sin(t * 11 + c.ph));
      }
      im.instanceMatrix.needsUpdate = true;
    });
  };

  function mkBox(x, y, z, w, h, d, m) { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; }
  function stainedWindow(scene, light, c, y, z, hue, axis, dir) {
    const m = new T.Mesh(new T.PlaneGeometry(3, 9),
      new T.MeshBasicMaterial({ map: HPI.tex.stained(hue), transparent: true, opacity: 0.95, side: T.DoubleSide, fog: false }));
    m.position.set(c, y, z); m.rotation.y = Math.PI / 2; scene.add(m);
    if (Math.random() < 0.6) light.addShaft(c - dir * 3, y - 1, z, 12, 1.8, dir * 0.4);
  }
})(window.HPI);
