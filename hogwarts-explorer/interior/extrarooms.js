/* Three discovery rooms off the main spine: a bright Hospital wing (central, reached
 * from the Entrance Hall and the portrait corridor), the warm Kitchens tucked beside
 * the dungeon, and a glittering Trophy room east of the Library. Each builds only the
 * walls it owns — the rest are shared with neighbouring rooms (see northwing.js). */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit, F = HPI.furnish;

  // ---- Hospital wing: rows of neat beds, screens, a shelf of healing potions ----
  HPI.buildHospital = function (scene, light) {
    const R = L.HOS, CEIL = 8, stone = HPI.tex.stone(3);
    kit.slab(scene, R, HPI.tex.marble(2), 0.02, true, 4);
    kit.slab(scene, R, stone, CEIL, false, 3);
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone); // south (other 3 owned by EH/COR/NCOR)
    const bedW = new T.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.85 });
    const frameM = new T.MeshStandardMaterial({ color: 0x8a7a6a, metalness: 0.4, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const x = R.x0 + 3 + i * 4, z = R.z0 + 2.4;
      const bed = new T.Group(); bed.position.set(x, 0, z);
      bed.add(F.mesh(new T.BoxGeometry(1.6, 0.5, 3), frameM, 0, 0.4, 0));
      bed.add(F.mesh(new T.BoxGeometry(1.5, 0.3, 2.9), bedW, 0, 0.75, 0));
      bed.add(F.mesh(new T.BoxGeometry(1.4, 0.3, 0.6), bedW, 0, 0.95, -1)); // pillow
      bed.add(F.mesh(new T.BoxGeometry(1.5, 0.2, 1.4), new T.MeshStandardMaterial({ color: 0x8aa6c0, roughness: 0.85 }), 0, 0.85, 0.7)); // blanket
      scene.add(bed);
    }
    // a shelf of coloured healing potions on the long wall
    const table = F.mesh(new T.BoxGeometry(R.x1 - R.x0 - 4, 0.2, 0.8), new T.MeshStandardMaterial({ map: HPI.tex.wood(2).map, roughness: 0.85 }), (R.x0 + R.x1) / 2, 1, R.z1 - 1);
    scene.add(table);
    const pc = [0xff7a9a, 0x8cff9e, 0x9fd0ff, 0xffe08a, 0xc89aff];
    for (let i = 0; i < 10; i++) {
      const c = pc[i % pc.length];
      const b = F.mesh(new T.CylinderGeometry(0.1, 0.13, 0.4, 8), new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.5, transparent: true, opacity: 0.85 }), R.x0 + 2.5 + i * 1.3, 1.3, R.z1 - 1);
      scene.add(b);
    }
    F.levitate(scene, F.mesh(new T.SphereGeometry(0.3, 12, 10), new T.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd76a, emissiveIntensity: 0.7, roughness: 0.5 }), 0, 0, 0), (R.x0 + R.x1) / 2, 4, (R.z0 + R.z1) / 2);
    light.addTorch(R.x0 + 0.5, 4, R.z1 - 2, 0xfff0d0, 5);
    light.addTorch(R.x1 - 0.5, 4, R.z1 - 2, 0xfff0d0, 5);
    light.addShaft((R.x0 + R.x1) / 2, 6, R.z0 + 2, 9, 2.4, 0);
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 6, R.z1 - R.z0, 70);
  };

  // ---- Kitchens (dungeon level): you spawn in a clear central aisle (x≈-23) looking
  //      north at a grand cooking hearth; two long work tables run lengthwise to either
  //      side so nothing blocks the view. A chimney breast climbs the whole north wall
  //      (no floating hood), copper pots + pans hang overhead, a plate dresser lines the
  //      east wall, and warm fire/torch light fills the room. ----
  HPI.buildKitchens = function (scene, light) {
    const R = L.KIT, FY = L.DN, CEIL = L.DN + 8, cx = (R.x0 + R.x1) / 2;
    const stone = HPI.tex.stone(3, 'warm'), warm = HPI.tex.stone(4, 'warm');
    kit.slab(scene, R, warm, FY + 0.02, true, 3.5);
    kit.slab(scene, R, stone, CEIL, false, 3);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: FY, y1: CEIL }, stone); // east (west=dungeon doorway)
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: FY, y1: CEIL }, stone); // north (hearth)
    // the Great-Hall owns the south wall from y0 up, but only above ground level — patch
    // the dungeon-level undercroft here so you never see a black void under the hall.
    kit.wall(scene, { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1, y0: FY, y1: 0.3 }, stone);
    const woodM = new T.MeshStandardMaterial({ map: HPI.tex.wood(2, '#3a2412').map, roughness: 0.85 });
    const darkW = new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#2e1d10').map, roughness: 0.9 });
    const plateM = new T.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.6, roughness: 0.35 });
    const copper = new T.MeshStandardMaterial({ color: 0xc87a3a, metalness: 0.6, roughness: 0.4 });
    const ironM = new T.MeshStandardMaterial({ color: 0x1b1b20, roughness: 0.7, metalness: 0.5 });

    // a woven runner down the open central aisle toward the hearth
    F.rug(scene, cx, -12, 4.5, 20, FY, '#5a3418', '#c9a94a');
    // daylight windows high on either side of the chimney breast
    F.window3(scene, light, R.x0 + 4, FY + 4.4, R.z0 + 0.3, 'z', 1, 'auto', 1.8, 2.4);
    F.window3(scene, light, R.x1 - 4, FY + 4.4, R.z0 + 0.3, 'z', 1, 'auto', 1.8, 2.4);

    // ---- the hearth: a stone chimney breast up the full north wall (grounds the hood) ----
    const breast = F.mesh(new T.BoxGeometry(6, CEIL - FY, 1.1), new T.MeshStandardMaterial({ map: HPI.tex.stone(3, 'warm').map, bumpMap: HPI.tex.stone(3, 'warm').bump, bumpScale: 0.25, roughness: 0.95 }), cx, (FY + CEIL) / 2, R.z0 + 0.55); scene.add(breast);
    const dark = new T.MeshStandardMaterial({ color: 0x120c07, roughness: 1 });
    scene.add(F.mesh(new T.BoxGeometry(3.6, 2.8, 0.4), dark, cx, FY + 1.4, R.z0 + 1.15));       // dark firebox recess
    const jamb = new T.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 });
    [-1, 1].forEach((s) => scene.add(F.mesh(new T.BoxGeometry(0.7, 3, 0.9), jamb, cx + s * 2.2, FY + 1.5, R.z0 + 1.1)));
    scene.add(F.mesh(new T.BoxGeometry(5.6, 0.55, 1.2), woodM, cx, FY + 3.1, R.z0 + 1.15));      // mantel beam
    scene.add(F.mesh(new T.BoxGeometry(5, 1.6, 1), jamb, cx, FY + 4.1, R.z0 + 1));                // stone hood, sat on the mantel
    // a glowing ember bed so the firebox is never a dark hole, then fire + logs + cauldron
    const embers = F.mesh(new T.BoxGeometry(3, 0.25, 0.7), new T.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.9, fog: false }), cx, FY + 0.18, R.z0 + 1.1); scene.add(embers);
    light.addFire(cx, FY + 0.35, R.z0 + 1.0, 1.6);
    [-0.4, 0.4].forEach((o) => { const log = F.mesh(new T.CylinderGeometry(0.16, 0.16, 1.8, 8), darkW, cx, FY + 0.25, R.z0 + 1.1); log.rotation.z = Math.PI / 2; log.position.x = cx + o; scene.add(log); });
    const crane = F.mesh(new T.BoxGeometry(0.12, 0.12, 1.6), ironM, cx - 1.4, FY + 2.4, R.z0 + 1.1); crane.rotation.y = Math.PI / 2; scene.add(crane);
    const pot = new T.Group(); pot.position.set(cx, FY + 1.5, R.z0 + 1.1);
    pot.add(F.mesh(new T.SphereGeometry(0.5, 14, 10, 0, 6.3, 0, 2.1), ironM, 0, 0.1, 0));
    pot.add(F.mesh(new T.CylinderGeometry(0.03, 0.03, 0.9, 6), ironM, 0, 0.55, 0)); scene.add(pot);
    const brew = F.mesh(new T.CircleGeometry(0.42, 16), new T.MeshBasicMaterial({ color: 0xffb259, transparent: true, opacity: 0.85, fog: false }), cx, FY + 1.56, R.z0 + 1.1); brew.rotation.x = -Math.PI / 2; scene.add(brew);
    // two brass candlesticks on the mantel
    [-1.7, 1.7].forEach((o) => { scene.add(F.mesh(new T.CylinderGeometry(0.06, 0.1, 0.5, 8), copper, cx + o, FY + 3.6, R.z0 + 1.1)); scene.add(F.mesh(new T.SphereGeometry(0.08, 8, 6), new T.MeshBasicMaterial({ color: 0xffe3a0, fog: false }), cx + o, FY + 3.95, R.z0 + 1.1)); });

    // ---- a plate dresser against the east wall (plates stood on edge) ----
    for (let s = 0; s < 3; s++) {
      scene.add(F.mesh(new T.BoxGeometry(0.5, 0.12, 6), darkW, R.x1 - 0.5, FY + 2 + s * 1.3, -14));
      for (let p = 0; p < 6; p++) { const pl = F.mesh(new T.CylinderGeometry(0.42, 0.42, 0.08, 16), plateM, R.x1 - 0.55, FY + 2.5 + s * 1.3, -17 + p * 1.1); pl.rotation.z = Math.PI / 2; scene.add(pl); }
    }

    // ---- two long work tables running lengthwise, flanking the open aisle ----
    [R.x0 + 2.6, R.x1 - 2.6].forEach((tx) => {
      scene.add(F.mesh(new T.BoxGeometry(1.5, 0.2, 13), woodM, tx, FY + 1, -13));
      scene.add(F.mesh(new T.BoxGeometry(0.3, 0.9, 12), woodM, tx, FY + 0.5, -13));
      for (let z = -18; z <= -8; z += 2.5) scene.add(F.mesh(new T.CylinderGeometry(0.26, 0.22, 0.05, 12), plateM, tx, FY + 1.13, z));
    });
    // a plump loaf + a wheel of cheese on the left table for life
    const loaf = F.mesh(new T.SphereGeometry(0.3, 10, 8), new T.MeshStandardMaterial({ color: 0xc08a46, roughness: 0.9 }), R.x0 + 2.6, FY + 1.3, -11); loaf.scale.set(1.5, 0.8, 1); scene.add(loaf);
    scene.add(F.mesh(new T.CylinderGeometry(0.34, 0.34, 0.22, 16), new T.MeshStandardMaterial({ color: 0xe8c860, roughness: 0.7 }), R.x0 + 2.6, FY + 1.25, -15));

    // ---- a hanging pot rack over the aisle: a tidy row of copper pots, with flat-bottomed
    //      pans hung edge-on by the handle to the sides (so they read as pans, not dark discs) ----
    const rail = F.mesh(new T.CylinderGeometry(0.06, 0.06, 11, 8), ironM, cx, FY + 5.3, -13); rail.rotation.x = Math.PI / 2; scene.add(rail);
    for (let i = 0; i < 5; i++) {
      const z = -18 + i * 2.5;
      scene.add(F.mesh(new T.CylinderGeometry(0.03, 0.03, 0.5, 6), ironM, cx, FY + 5.0, z));
      scene.add(F.mesh(new T.CylinderGeometry(0.3, 0.26, 0.42, 12), copper, cx, FY + 4.5, z)); // pot (rounded, reads well)
    }
    [-1, 1].forEach((s) => [-16, -11].forEach((z) => {
      const px = cx + s * 1.8;
      scene.add(F.mesh(new T.CylinderGeometry(0.03, 0.03, 0.6, 6), ironM, px, FY + 4.95, z));
      const pan = F.mesh(new T.CylinderGeometry(0.32, 0.32, 0.07, 14), copper, px, FY + 4.5, z); pan.rotation.z = Math.PI / 2; scene.add(pan); // face along x → edge-on from the aisle
      const handle = F.mesh(new T.BoxGeometry(0.06, 0.5, 0.06), ironM, px, FY + 4.78, z); scene.add(handle);
    }));

    // ---- stacked barrels in the SE corner ----
    [[R.x1 - 2, -24, 0], [R.x1 - 3.4, -24, 0], [R.x1 - 2.7, -23, 1.4]].forEach(([x, z, up]) => scene.add(F.mesh(new T.CylinderGeometry(0.6, 0.6, 1.4, 12), darkW, x, FY + 0.7 + up, z)));

    light.addTorch(R.x1 - 0.5, FY + 3.5, -8, 0xffb060, 5);
    light.addTorch(R.x0 + 0.5, FY + 3.5, -8, 0xffb060, 5);
    light.addTorch(R.x1 - 0.5, FY + 3.5, -22, 0xffb060, 5);
    F.lantern(scene, cx, FY + 6.2, -20, 0xffc070);
    light.addDust(cx, FY + 1.5, (R.z0 + R.z1) / 2, R.x1 - R.x0, 7, R.z1 - R.z0, 90);
  };

  // ---- Trophy room: glass cases of golden cups, shields and a championship cup ----
  HPI.buildTrophy = function (scene, light) {
    const R = L.TRO, CEIL = 8, stone = HPI.tex.stone(3, 'warm');
    kit.slab(scene, R, HPI.tex.wood(3, '#2e1d10'), 0.02, true, 4);
    kit.slab(scene, R, stone, CEIL, false, 3);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone); // east (others owned by NCOR/LIB/AST)
    const gold = new T.MeshStandardMaterial({ color: 0xe6b422, metalness: 0.7, roughness: 0.25, emissive: 0x3a2a00, emissiveIntensity: 0.4 });
    const glass = new T.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.18, side: T.DoubleSide });
    // two display cabinets along the walls, each with a row of little cups
    [[R.z0 + 1, 0], [R.z1 - 1, Math.PI]].forEach(([z]) => {
      const cab = F.mesh(new T.BoxGeometry(R.x1 - R.x0 - 4, 4, 1), glass, (R.x0 + R.x1) / 2, 2, z); scene.add(cab);
      const base = F.mesh(new T.BoxGeometry(R.x1 - R.x0 - 4, 1, 1.1), new T.MeshStandardMaterial({ map: HPI.tex.wood(1).map, roughness: 0.9 }), (R.x0 + R.x1) / 2, 0.5, z); scene.add(base);
      for (let i = 0; i < 5; i++) {
        const cup = new T.Group(); cup.position.set(R.x0 + 3 + i * 3, 1.4 + (i % 2) * 1.5, z);
        cup.add(F.mesh(new T.SphereGeometry(0.28, 12, 10, 0, 6.3, 0, 2.2), gold, 0, 0.25, 0));
        cup.add(F.mesh(new T.CylinderGeometry(0.08, 0.14, 0.4, 10), gold, 0, -0.1, 0));
        [-1, 1].forEach((s) => cup.add(F.mesh(new T.TorusGeometry(0.12, 0.03, 6, 10), gold, s * 0.28, 0.25, 0)));
        scene.add(cup);
      }
    });
    // the great championship cup on a central pedestal, slowly turning + glinting
    const ped = F.mesh(new T.CylinderGeometry(0.7, 0.9, 1.4, 16), new T.MeshStandardMaterial({ color: 0x4a4668, roughness: 0.9 }), (R.x0 + R.x1) / 2, 0.7, (R.z0 + R.z1) / 2); scene.add(ped);
    const bigCup = new T.Group();
    bigCup.add(F.mesh(new T.SphereGeometry(0.7, 16, 12, 0, 6.3, 0, 2.2), gold, 0, 0.6, 0));
    bigCup.add(F.mesh(new T.CylinderGeometry(0.2, 0.4, 0.9, 14), gold, 0, -0.1, 0));
    bigCup.position.set((R.x0 + R.x1) / 2, 1.6, (R.z0 + R.z1) / 2); scene.add(bigCup);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffe59a, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    glow.scale.setScalar(5); glow.position.copy(bigCup.position); scene.add(glow);
    HPI.builders.push((t) => { bigCup.rotation.y += 0.01; glow.material.opacity = 0.4 + 0.2 * Math.sin(t * 2); });
    light.addTorch(R.x0 + 0.5, 4, R.z0 + 2, 0xffe0a0, 6);
    light.addTorch(R.x0 + 0.5, 4, R.z1 - 2, 0xffe0a0, 6);
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 6, R.z1 - R.z0, 60);
  };
})(window.HPI);
