/* The Library — tall oak bookcases lining the walls and two freestanding islands,
 * reading tables lit by candles, drifting dust, and a dozen enchanted books that
 * float and gently flap their glowing pages in the central aisle. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit, F = HPI.furnish;
  const CEIL = 13;

  function bookcase(w, h) {
    const g = new T.Group();
    const wood = HPI.tex.wood(1, '#2a1a0e');
    const caseMat = new T.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 0.3, roughness: 0.85 });
    const back = new T.Mesh(new T.BoxGeometry(w, h, 0.5), caseMat); back.position.y = h / 2; g.add(back);
    const books = HPI.tex.books();
    const shelves = Math.max(3, Math.round(h / 1.6));
    for (let i = 0; i < shelves; i++) {
      const y = 0.6 + i * (h - 0.8) / shelves;
      const row = new T.Mesh(new T.PlaneGeometry(w - 0.3, (h - 0.8) / shelves - 0.2),
        new T.MeshStandardMaterial({ map: kit.cloneTex(books), roughness: 0.9 }));
      row.material.map.repeat.set(w / 2, 1);
      row.position.set(0, y, 0.28); g.add(row);
      const plank = new T.Mesh(new T.BoxGeometry(w, 0.1, 0.55), caseMat); plank.position.set(0, y - (h - 0.8) / shelves / 2, 0.05); g.add(plank);
    }
    return g;
  }

  HPI.buildLibrary = function (scene, light) {
    const LIB = L.LIB;
    HPI.nav.room(LIB, { w: [17, 23], n: [61, 67] });   // west → corridor, north → clock tower
    kit.slab(scene, LIB, HPI.tex.wood(3, '#3a2616'), 0.02, true, 4);
    kit.slab(scene, LIB, HPI.tex.stone(3, 'warm'), CEIL, false, 3);
    const stone = HPI.tex.stone(3, 'warm');
    kit.wall(scene, { axis: 'x', c: LIB.x1, lo: LIB.z0, hi: LIB.z1, y0: 0, y1: CEIL }, stone);
    kit.wall(scene, { axis: 'z', c: LIB.z0, lo: LIB.x0, hi: LIB.x1, y0: 0, y1: CEIL, gap: [61, 67] }, stone); // north wall, door to the clock tower
    F.sign(scene, 59, 4.4, LIB.z0 + 0.3, 0, 'מגדל השעון', '⏰');   // beside the door, points north to the tower
    kit.wall(scene, { axis: 'z', c: LIB.z1, lo: LIB.x0, hi: LIB.x1, y0: 0, y1: CEIL }, stone);

    // perimeter bookcases flush to the three walls
    for (let x = LIB.x0 + 3; x < LIB.x1 - 2; x += 4) {
      const s = bookcase(3.6, 9); s.position.set(x, 0, LIB.z0 + 0.6); scene.add(s);
      const n = bookcase(3.6, 9); n.position.set(x, 0, LIB.z1 - 0.6); n.rotation.y = Math.PI; scene.add(n);
    }
    for (let z = LIB.z0 + 5; z < LIB.z1 - 3; z += 4) {
      const e = bookcase(3.6, 9); e.position.set(LIB.x1 - 0.6, 0, z); e.rotation.y = -Math.PI / 2; scene.add(e);
    }
    // two freestanding island shelves (double-sided) with collision
    [[52, 14], [60, 28]].forEach(([x, z]) => {
      const a = bookcase(7, 7); a.position.set(x, 0, z - 0.5); a.rotation.y = Math.PI / 2; scene.add(a);
      const b = bookcase(7, 7); b.position.set(x, 0, z + 0.5); b.rotation.y = -Math.PI / 2; scene.add(b);
      HPI.nav.wallX(x - 1, z - 3.5, z + 3.5); HPI.nav.wallX(x + 1, z - 3.5, z + 3.5);
      HPI.nav.wallZ(z - 3.5, x - 1, x + 1); HPI.nav.wallZ(z + 3.5, x - 1, x + 1);
    });

    // reading tables with a candle each
    const wood = HPI.tex.wood(2, '#3a2412');
    const topMat = new T.MeshStandardMaterial({ map: wood.map, roughness: 0.85 });
    [[48, 34], [64, 8]].forEach(([x, z]) => {
      const top = new T.Mesh(new T.BoxGeometry(4, 0.2, 2), topMat); top.position.set(x, 1, z); scene.add(top);
      [-1, 1].forEach((s) => { const leg = new T.Mesh(new T.BoxGeometry(0.2, 1, 1.6), topMat); leg.position.set(x + s * 1.7, 0.5, z); scene.add(leg); });
      light.addTorch(x, 1.3, z, 0xffe0a0, 8);
    });

    // tall windows + shafts
    for (let z = 8; z <= 34; z += 9) {
      const win = new T.Mesh(new T.PlaneGeometry(2.4, 7), new T.MeshBasicMaterial({ map: HPI.tex.stained(45 + z), transparent: true, opacity: 0.9, side: T.DoubleSide, fog: false }));
      win.position.set(LIB.x1 - 0.2, 8, z); win.rotation.y = -Math.PI / 2; scene.add(win);
      light.addShaft(LIB.x1 - 3, 7, z, 11, 2, -0.4);
    }

    // enchanted floating books flapping their glowing pages
    const books = [];
    const pageMat = new T.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe08a, emissiveIntensity: 0.8, roughness: 0.6, side: T.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const g = new T.Group();
      const L1 = new T.Mesh(new T.PlaneGeometry(0.5, 0.65), pageMat); L1.position.x = -0.25; g.add(L1);
      const R1 = new T.Mesh(new T.PlaneGeometry(0.5, 0.65), pageMat); R1.position.x = 0.25; g.add(R1);
      const spine = new T.Mesh(new T.BoxGeometry(0.06, 0.65, 0.08), new T.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.7 })); g.add(spine);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffe59a, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      halo.scale.setScalar(1.6); g.add(halo);
      const bx = 44 + Math.random() * 24, bz = 6 + Math.random() * 30, by = 3 + Math.random() * 6;
      g.position.set(bx, by, bz); scene.add(g);
      books.push({ g, L1, R1, base: by, ph: Math.random() * 7, dx: (Math.random() - 0.5) * 2, dz: (Math.random() - 0.5) * 2, x: bx, z: bz });
    }
    light.addDust((LIB.x0 + LIB.x1) / 2, 2, (LIB.z0 + LIB.z1) / 2, 26, 11, 34, 180);

    HPI.builders.push((t) => {
      for (const b of books) {
        b.g.position.set(b.x + Math.sin(t * 0.3 + b.ph) * b.dx, b.base + Math.sin(t * 0.8 + b.ph) * 0.5, b.z + Math.cos(t * 0.25 + b.ph) * b.dz);
        b.g.rotation.y = t * 0.3 + b.ph;
        const flap = 0.4 + 0.5 * Math.abs(Math.sin(t * 3 + b.ph));
        b.L1.rotation.y = flap; b.R1.rotation.y = -flap;
      }
    });
  };
})(window.HPI);
