/* The north wing: a long portrait-lined corridor branching off the gallery of
 * portraits, opening onto the Charms / Transfiguration / Defence classrooms, the
 * Astronomy tower and (at the very top) the Owlery.
 *
 * Floor-plan ownership (each shared wall is built by exactly ONE room so stone
 * panels never overlap and z-fight): the north corridor (NCOR) owns its two long
 * side walls — with every classroom doorway cut into them — while the classrooms,
 * tower and owlery build only their outward walls. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit, F = HPI.furnish;

  HPI.buildNorthCorridor = function (scene, light) {
    const R = L.NCOR, stone = HPI.tex.stone(3);
    kit.slab(scene, R, HPI.tex.stone(3), 0.02, true, 3);
    kit.slab(scene, R, stone, 6, false, 3);
    // west wall (classrooms CHA + TRA hang off it); east wall (AST + DEF + TRO)
    kit.wallNav(scene, { axis: 'x', c: R.x0, lo: R.z0, hi: R.z1, y0: 0, y1: 6, gap: [[-26, -18], [-42, -32]] }, stone);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: 2, y0: 0, y1: 6, gap: [[-28, -16], [-42, -34], [-10, -2]] }, stone);
    // runner carpet down the middle
    const rug = new T.Mesh(new T.PlaneGeometry(2.6, R.z1 - R.z0 - 2), new T.MeshStandardMaterial({ color: 0x244a6b, roughness: 0.85 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set((R.x0 + R.x1) / 2, 0.05, (R.z0 + R.z1) / 2); scene.add(rug);
    // chatty portraits + a drifting ghost + a suit of armour guarding the junction
    const JOKES = ['למה הקוסם לקח סולם? כדי להגיע לכיתה הגבוהה! 🪜', 'דלת, דלת, מי שם? אני פשוט ציור! 🖼️', 'שלום! חכה רגע, אני מסדר את הכובע 🎩'];
    for (let z = -4; z > -42; z -= 9) F.jokePortrait(scene, R.x0 + 0.35, 3, z, Math.PI / 2, JOKES);
    F.armour(scene, R.x1 - 1, 0, 4, -Math.PI / 2);
    F.ghost(scene, [[R.x0 + 2, 10], [R.x0 + 2, -40], [R.x1 - 2, -40], [R.x1 - 2, 10]], 0);
    for (let z = 8; z > -44; z -= 8) { light.addTorch(R.x0 + 0.5, 4, z, 0xffc070, 4); }
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, 8, 5, R.z1 - R.z0, 120);
  };

  // ---- Astronomy tower: a tall star-domed observatory with a brass telescope ----
  HPI.buildAstronomy = function (scene, light) {
    const R = L.AST, CEIL = 14, stone = HPI.tex.stone(3);
    kit.slab(scene, R, HPI.tex.stone(4), 0.02, true, 3.5);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone);           // east
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);           // north
    kit.wallNav(scene, { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);           // south
    // the enchanted night-sky dome overhead (reuses the Great Hall's ceiling shader)
    light.enchantedCeiling((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, R.z1 - R.z0, CEIL - 0.3);
    // a tall arched window of deep night over the east wall
    const win = new T.Mesh(new T.PlaneGeometry(5, 9), new T.MeshBasicMaterial({ map: HPI.tex.stained(230), transparent: true, opacity: 0.9, side: T.DoubleSide, fog: false }));
    win.position.set(R.x1 - 0.2, 6, (R.z0 + R.z1) / 2); win.rotation.y = -Math.PI / 2; scene.add(win);
    light.addShaft(R.x1 - 3, 7, (R.z0 + R.z1) / 2, 14, 3, -0.3);
    // brass telescope on a tripod, pointed up at the window
    const brass = new T.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.7, roughness: 0.3 });
    const scope = new T.Group(); scope.position.set((R.x0 + R.x1) / 2 + 2, 0, (R.z0 + R.z1) / 2);
    const tube = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, 2.4, 14), brass); tube.rotation.z = 0.7; tube.position.y = 2; scope.add(tube);
    [0, 2.1, 4.2].forEach((a) => { const leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.1, 8), brass); leg.position.set(Math.cos(a) * 0.4, 0.9, Math.sin(a) * 0.4); leg.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); scope.add(leg); });
    scene.add(scope);
    HPI.builders.push((t) => { scope.rotation.y = Math.sin(t * 0.2) * 0.3; });
    F.podium(scene, R.x0 + 1.6, 0, (R.z0 + R.z1) / 2, Math.PI / 2);
    pushTeacher(scene, 'sinistra', R.x0 + 2.6, (R.z0 + R.z1) / 2, Math.PI / 2, 'astronomy');
    light.addTorch(R.x0 + 0.5, 4, R.z0 + 2, 0x9fb0ff, 6);
    light.addTorch(R.x0 + 0.5, 4, R.z1 - 2, 0x9fb0ff, 6);
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 10, R.z1 - R.z0, 80);
  };

  // ---- Owlery: an open roost across the castle's north top, full of hooting owls ----
  HPI.buildOwlery = function (scene, light) {
    const R = L.OWL, CEIL = 9, stone = HPI.tex.stone(3);
    const straw = new T.MeshStandardMaterial({ map: HPI.tex.wood(4, '#8a6a2a').map, roughness: 1 });
    const floor = new T.Mesh(new T.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), straw);
    floor.rotation.x = -Math.PI / 2; floor.position.set((R.x0 + R.x1) / 2, 0.03, (R.z0 + R.z1) / 2); scene.add(floor);
    // south wall carries the one doorway to the north corridor; other three are solid
    kit.wallNav(scene, { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL, gap: [33, 38] }, stone);
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);
    kit.wallNav(scene, { axis: 'x', c: R.x0, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone);
    light.enchantedCeiling((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, R.z1 - R.z0, CEIL - 0.3);
    // a big round moon window on the north wall
    const moon = new T.Mesh(new T.CircleGeometry(2.4, 28), new T.MeshBasicMaterial({ color: 0xfff6d0, fog: false }));
    moon.position.set((R.x0 + R.x1) / 2, 6, R.z0 + 0.25); scene.add(moon);
    const moonGlow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xfff0c0, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    moonGlow.scale.setScalar(10); moonGlow.position.set((R.x0 + R.x1) / 2, 6, R.z0 + 1); scene.add(moonGlow);
    // perch beams with roosting owls that bob + hoot
    const beamM = new T.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
    const owls = [];
    for (let i = 0; i < 7; i++) {
      const x = R.x0 + 5 + i * 7, by = 3 + (i % 3) * 1.6;
      const beam = new T.Mesh(new T.BoxGeometry(2.4, 0.2, 0.2), beamM); beam.position.set(x, by, R.z0 + 1.2 + (i % 2) * 2); scene.add(beam);
      const owl = HP.makeOwl('hedwig'); owl.scale.setScalar(0.5); owl.position.set(x + (i % 2 ? 0.5 : -0.5), by + 0.4, beam.position.z); scene.add(owl);
      owls.push({ owl, ph: Math.random() * 7 });
    }
    HPI.builders.push((t, dt) => owls.forEach((o) => HP.animateOwl(o.owl, dt, t + o.ph, 0, 0.6)));
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 7, R.z1 - R.z0, 90);
  };

  function pushTeacher(scene, who, x, z, face, key) {
    const c = HP.makeChibi(who); c.scale.setScalar(1.2); c.position.set(x, 0, z); c.rotation.y = face; scene.add(c);
    const ph = Math.random() * 7; HPI.builders.push((t, dt) => HP.animateChibi(c, dt, t + ph, 0));
    HPI.teachers.push({ key, chibi: c, x, z });
  }
})(window.HPI);
