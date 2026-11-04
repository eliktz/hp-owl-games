/* The Potions dungeon — a low, cool stone cellar reached down a ramp from the Great
 * Hall. Rows of bubbling cauldrons over little fires, shelves of glowing ingredient
 * jars, a teacher's lectern, and green-tinged torches for that under-the-castle chill.
 * The Potions lesson (a cauldron maths game) is launched by lessons/*; this is the set. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit;
  const DUN = L.DUN, FY = L.DN, CEIL = L.DN + 9;

  // a cast-iron cauldron on three stubby legs with a glowing brew + rising bubbles
  function cauldron(scene, x, z, scale, col, builders) {
    const g = new T.Group(); g.position.set(x, FY, z); g.scale.setScalar(scale);
    const iron = HPI.mat('cauldronIron', () => new T.MeshStandardMaterial({ color: 0x1b1b20, roughness: 0.7, metalness: 0.5 }));
    const pot = new T.Mesh(new T.SphereGeometry(0.7, 16, 12, 0, 6.3, 0, 2.1), iron);
    pot.scale.set(1, 0.85, 1); pot.position.y = 0.72; g.add(pot);
    const rim = new T.Mesh(new T.TorusGeometry(0.62, 0.09, 8, 18), iron); rim.rotation.x = Math.PI / 2; rim.position.y = 1.18; g.add(rim);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = new T.Mesh(new T.CylinderGeometry(0.06, 0.04, 0.4, 6), iron); leg.position.set(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4); g.add(leg); }
    // glowing brew surface
    const brew = new T.Mesh(new T.CircleGeometry(0.58, 18), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, fog: false }));
    brew.rotation.x = -Math.PI / 2; brew.position.y = 1.12; g.add(brew);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: col, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    glow.scale.setScalar(2.2); glow.position.y = 1.3; g.add(glow);
    // a fire tongue underneath
    const fire = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xff8a3a, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    fire.scale.setScalar(1.2); fire.position.y = 0.3; g.add(fire);
    // rising bubbles
    const bubbles = [];
    for (let i = 0; i < 5; i++) { const b = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, fog: false })); b.userData.ph = Math.random() * 1; g.add(b); bubbles.push(b); }
    scene.add(g);
    builders.push((t) => {
      glow.material.opacity = 0.45 + 0.2 * Math.sin(t * 4 + x);
      fire.scale.setScalar(1.0 + 0.2 * Math.abs(Math.sin(t * 9 + z)));
      for (const b of bubbles) { const k = (t * 0.6 + b.userData.ph) % 1; b.position.set((Math.random() - 0.5) * 0.3, 1.12 + k * 0.6, (Math.random() - 0.5) * 0.3); b.material.opacity = 0.7 * (1 - k); b.scale.setScalar(1 - k * 0.5); }
    });
    return g;
  }

  // a shelf of little glowing ingredient jars
  function shelf(scene, x, z, rotY) {
    const g = new T.Group(); g.position.set(x, FY, z); g.rotation.y = rotY;
    const wood = HPI.tex.wood(1, '#241812');
    const wm = new T.MeshStandardMaterial({ map: wood.map, roughness: 0.9 });
    for (let s = 0; s < 3; s++) { const plank = new T.Mesh(new T.BoxGeometry(3, 0.1, 0.5), wm); plank.position.set(0, 1 + s * 1.1, 0); g.add(plank); }
    [0, 1].forEach((s) => { const side = new T.Mesh(new T.BoxGeometry(0.1, 3.3, 0.5), wm); side.position.set(s ? 1.45 : -1.45, 2.15, 0); g.add(side); });
    const jarCols = [0x8cff9e, 0xff9ad5, 0xffe08a, 0x9fd0ff, 0xc89aff, 0xff7a5a];
    for (let s = 0; s < 3; s++) for (let j = 0; j < 4; j++) {
      const c = jarCols[(s * 4 + j) % jarCols.length];
      const jar = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 0.34, 8), new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.5, transparent: true, opacity: 0.85 }));
      jar.position.set(-1.1 + j * 0.74, 1.25 + s * 1.1, 0); g.add(jar);
    }
    scene.add(g);
  }

  HPI.buildDungeon = function (scene, light) {
    // nav: west/east/north walls; the south (z=2) wall is the Great Hall's (door cut there)
    HPI.nav.wallX(DUN.x0, DUN.z0, DUN.z1);
    HPI.nav.seg('x', DUN.x1, DUN.z0, DUN.z1, [-20, -8]);   // east wall, doorway through to the kitchens
    HPI.nav.wallZ(DUN.z0, DUN.x0, DUN.x1);

    const stone = HPI.tex.stone(3, 'dungeon');
    kit.slab(scene, DUN, HPI.tex.stone(4, 'dungeon'), FY + 0.02, true, 3.5);     // deep flagstone floor
    kit.slab(scene, DUN, stone, CEIL, false, 3);                       // low vaulted ceiling
    kit.wall(scene, { axis: 'x', c: DUN.x0, lo: DUN.z0, hi: DUN.z1, y0: FY, y1: CEIL }, stone);
    kit.wall(scene, { axis: 'x', c: DUN.x1, lo: DUN.z0, hi: DUN.z1, y0: FY, y1: CEIL, gap: [-20, -8] }, stone);
    kit.wall(scene, { axis: 'z', c: DUN.z0, lo: DUN.x0, hi: DUN.x1, y0: FY, y1: CEIL }, stone);
    // a short inner wall below the Great-Hall doorway so you don't see the void beside the ramp
    kit.wall(scene, { axis: 'z', c: DUN.z1, lo: DUN.x0, hi: -50, y0: FY, y1: 0.2 }, stone);
    kit.wall(scene, { axis: 'z', c: DUN.z1, lo: -44, hi: DUN.x1, y0: FY, y1: 0.2 }, stone);

    // the entry ramp (matches core.floorH): slopes from the doorway down into the cellar
    const rampLen = Math.hypot(L.DUN.z1 - L.dunFloorZ, -FY);
    const ramp = new T.Mesh(new T.BoxGeometry(6, 0.3, rampLen), new T.MeshStandardMaterial({ map: HPI.tex.stone(3, 'dungeon').map, roughness: 0.95 }));
    ramp.position.set(-47, FY / 2, (L.DUN.z1 + L.dunFloorZ) / 2);
    ramp.rotation.x = -Math.atan2(-FY, L.DUN.z1 - L.dunFloorZ); scene.add(ramp);

    // two rows of student cauldrons + one big teacher cauldron up front
    const brewCols = [0x7ef0a0, 0xa98aff, 0x8ad0ff, 0xffd86a, 0xff8ad0];
    let ci = 0;
    for (let z = -8; z >= -22; z -= 7) {
      for (let x = -52; x <= -38; x += 7) { cauldron(scene, x, z, 1, brewCols[ci % brewCols.length], HPI.builders); ci++; }
    }
    cauldron(scene, -45, -24, 1.5, 0x9effa0, HPI.builders);   // teacher's great cauldron

    // ingredient shelves against the walls
    shelf(scene, DUN.x0 + 0.6, -10, Math.PI / 2);
    shelf(scene, DUN.x0 + 0.6, -18, Math.PI / 2);
    shelf(scene, DUN.x1 - 0.6, -14, -Math.PI / 2);
    // a stout lectern for the professor
    const lect = new T.Mesh(new T.BoxGeometry(1.2, 1.3, 0.8), new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#241812').map, roughness: 0.9 }));
    lect.position.set(-45, FY + 0.65, -25.2); scene.add(lect);

    // green-tinged dungeon torches + cool dust
    for (let z = -6; z >= -24; z -= 6) {
      light.addTorch(DUN.x0 + 0.5, FY + 3, z, 0x8affba, 5);
      light.addTorch(DUN.x1 - 0.5, FY + 3, z, 0x8affba, 5);
    }
    light.addDust((DUN.x0 + DUN.x1) / 2, FY + 1.5, (DUN.z0 + DUN.z1) / 2, 20, 7, 24, 120);
  };
})(window.HPI);
