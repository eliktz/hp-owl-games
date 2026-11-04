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

  // ---- Kitchens (dungeon level): a big hearth, long work tables, hanging pots ----
  HPI.buildKitchens = function (scene, light) {
    const R = L.KIT, FY = L.DN, CEIL = L.DN + 8, stone = HPI.tex.stone(3, 'warm');
    kit.slab(scene, R, HPI.tex.stone(4, 'warm'), FY + 0.02, true, 3.5);
    kit.slab(scene, R, stone, CEIL, false, 3);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: FY, y1: CEIL }, stone); // east (west=dungeon, south=Great Hall)
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: FY, y1: CEIL }, stone); // north
    const woodM = new T.MeshStandardMaterial({ map: HPI.tex.wood(2, '#3a2412').map, roughness: 0.85 });
    // two long scrubbed work tables piled with golden plates
    [-18, -10].forEach((z) => {
      const top = F.mesh(new T.BoxGeometry(14, 0.2, 1.6), woodM, (R.x0 + R.x1) / 2, FY + 1, z); scene.add(top);
      const legs = F.mesh(new T.BoxGeometry(13, 0.9, 0.3), woodM, (R.x0 + R.x1) / 2, FY + 0.5, z); scene.add(legs);
      for (let p = R.x0 + 3; p < R.x1 - 2; p += 3) scene.add(F.mesh(new T.CylinderGeometry(0.28, 0.24, 0.05, 12), new T.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.6, roughness: 0.35 }), p, FY + 1.13, z));
    });
    // a great cooking hearth on the north wall
    light.addFire((R.x0 + R.x1) / 2, FY + 0.3, R.z0 + 0.8, 1.4);
    const hood = F.mesh(new T.BoxGeometry(5, 1, 2), new T.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.95 }), (R.x0 + R.x1) / 2, FY + 4.5, R.z0 + 1); scene.add(hood);
    // hanging copper pots over the tables
    const copper = new T.MeshStandardMaterial({ color: 0xc87a3a, metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 6; i++) { const pot = F.mesh(new T.CylinderGeometry(0.3, 0.26, 0.4, 12), copper, R.x0 + 4 + i * 3, FY + 5, -14); scene.add(pot); }
    // stacked barrels in a corner
    [[R.x1 - 2, -24], [R.x1 - 3.4, -24], [R.x1 - 2.7, -23]].forEach(([x, z], i) => scene.add(F.mesh(new T.CylinderGeometry(0.6, 0.6, 1.4, 12), woodM, x, FY + 0.7 + (i === 2 ? 1.4 : 0), z)));
    light.addTorch(R.x1 - 0.5, FY + 3.5, -10, 0xffb060, 5);
    light.addTorch(R.x1 - 0.5, FY + 3.5, -20, 0xffb060, 5);
    light.addDust((R.x0 + R.x1) / 2, FY + 1.5, (R.z0 + R.z1) / 2, R.x1 - R.x0, 7, R.z1 - R.z0, 90);
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
