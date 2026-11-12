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
    // doorway signs to every classroom/tower + warm hanging lanterns down the long run
    F.sign(scene, R.x0 + 0.3, 4, -22, Math.PI / 2, 'כיתת הלחשים', '🪶');     // west → Charms
    F.sign(scene, R.x0 + 0.3, 4, -37, Math.PI / 2, 'שינוי צורה', '🐱');      // west → Transfiguration
    F.sign(scene, R.x1 - 0.3, 4, -22, -Math.PI / 2, 'מגדל הכוכבים', '🔭');   // east → Astronomy
    F.sign(scene, R.x1 - 0.3, 4, -38, -Math.PI / 2, 'כיתת ההגנה', '🪄');     // east → Defence
    F.sign(scene, R.x1 - 0.3, 4, -6, -Math.PI / 2, 'חדר הגביעים', '🏆');     // east → Trophy
    F.sign(scene, 35.5, 4, R.z0 + 0.4, 0, 'מגדל הינשופים', '🦉');           // north → Owlery
    [10, -8, -26, -42].forEach((z) => F.lantern(scene, (R.x0 + R.x1) / 2, 4.3, z));
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, 8, 5, R.z1 - R.z0, 120);
  };

  // ---- Astronomy tower: a tall star-domed observatory with a brass telescope ----
  HPI.buildAstronomy = function (scene, light) {
    const R = L.AST, CEIL = 14, stone = HPI.tex.stone(3, 'tower');
    kit.slab(scene, R, HPI.tex.stone(4, 'tower'), 0.02, true, 3.5);
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
    // wave the wand at the telescope: it whirls round to scan the sky and a shower of shooting stars streaks across the dome
    let starT = 0, whirl = 0;
    const cxA = (R.x0 + R.x1) / 2, czA = (R.z0 + R.z1) / 2, shots = [];
    for (let i = 0; i < 7; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: i % 2 ? 0xfff2b0 : 0xbfe0ff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      sp.scale.set(2.6, 0.7, 1); sp.visible = false; scene.add(sp); shots.push({ sp, t: -1 });
    }
    HPI.enchantables.push({ id: 'telescope', obj: scope, r: 3, cast() { starT = 4.5; try { window.HPFun.sfx.tune([1319, 1175, 988, 784, 0, 1568, 1319, 1047], 0.1, 'sine'); } catch (e) {} return '🌠'; } });
    HPI.shootingStars = () => starT;
    HPI.builders.push((t, dt) => {
      if (starT > 0) starT -= dt;
      const k = starT > 0 ? Math.min(1, starT) : 0;
      whirl += k * dt * 5; scope.rotation.y = Math.sin(t * 0.2) * 0.3 + whirl;
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        if (s.t < 0) { if (starT > 0.8 && Math.random() < dt * 2.2) { s.t = 0; s.x = cxA - 7 + Math.random() * 8; s.z = czA - 6 + Math.random() * 12; s.sp.visible = true; } continue; }
        s.t += dt * 1.3;
        if (s.t >= 1) { s.t = -1; s.sp.visible = false; continue; }
        s.sp.position.set(s.x + s.t * 9, CEIL - 1.2 - s.t * 3.5, s.z); s.sp.material.opacity = Math.sin(s.t * Math.PI) * 0.95; s.sp.material.rotation = -0.37;
      }
    });
    F.podium(scene, R.x0 + 1.6, 0, (R.z0 + R.z1) / 2, Math.PI / 2);
    pushTeacher(scene, 'sinistra', R.x0 + 2.6, (R.z0 + R.z1) / 2, Math.PI / 2, 'astronomy');
    light.addTorch(R.x0 + 0.5, 4, R.z0 + 2, 0x9fb0ff, 6);
    light.addTorch(R.x0 + 0.5, 4, R.z1 - 2, 0x9fb0ff, 6);
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 10, R.z1 - R.z0, 80);
  };

  // ---- Owlery: an open roost across the castle's north top, full of hooting owls ----
  HPI.buildOwlery = function (scene, light) {
    const R = L.OWL, CEIL = 9, stone = HPI.tex.stone(3, 'tower');
    const straw = new T.MeshStandardMaterial({ map: HPI.tex.wood(4, '#8a6a2a').map, roughness: 1 });
    const floor = new T.Mesh(new T.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), straw);
    floor.rotation.x = -Math.PI / 2; floor.position.set((R.x0 + R.x1) / 2, 0.03, (R.z0 + R.z1) / 2); scene.add(floor);
    // south wall carries the one doorway to the north corridor; other three are solid
    kit.wallNav(scene, { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL, gap: [33, 38] }, stone);
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);
    // west wall carries a single doorway to the hidden Room of Requirement; east is solid
    kit.wallNav(scene, { axis: 'x', c: R.x0, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL, gap: [-53, -49] }, stone);
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone);
    // a wayfinding sign by the hidden west door: the room that is whatever you need
    F.sign(scene, R.x0 + 0.3, 4, -51, Math.PI / 2, 'חדר הבקשות', '✨');
    light.enchantedCeiling((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, R.z1 - R.z0, CEIL - 0.3);
    // a big round night-window on the north wall: a dark starry sky pane with a softly
    //      shaded moon (not a flat blown-out disc), set behind a stone ring frame
    const mx = (R.x0 + R.x1) / 2, my = 6;
    const skyPane = new T.Mesh(new T.CircleGeometry(2.4, 32), new T.MeshBasicMaterial({ color: 0x0b0d2e, fog: false }));
    skyPane.position.set(mx, my, R.z0 + 0.22); scene.add(skyPane);
    const moon = new T.Mesh(new T.CircleGeometry(0.95, 24), new T.MeshBasicMaterial({ color: 0xfff6d0, fog: false }));
    moon.position.set(mx + 0.7, my + 0.55, R.z0 + 0.25); scene.add(moon);
    [[-0.3, 0.2, 0.18], [0.25, -0.25, 0.14], [0.1, 0.35, 0.1]].forEach(([dx, dy, r]) => { // soft craters so it reads as a moon
      const cr = new T.Mesh(new T.CircleGeometry(r, 12), new T.MeshBasicMaterial({ color: 0xe6dcae, fog: false }));
      cr.position.set(mx + 0.7 + dx, my + 0.55 + dy, R.z0 + 0.26); scene.add(cr);
    });
    // a scatter of tiny stars across the pane
    for (let k = 0; k < 14; k++) {
      const a = k * 2.399, rr = 0.4 + (k % 7) * 0.28, st = new T.Mesh(new T.CircleGeometry(0.04 + (k % 3) * 0.015, 6), new T.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
      st.position.set(mx + Math.cos(a) * rr * 0.8 - 0.8, my + Math.sin(a) * rr - 0.3, R.z0 + 0.24); scene.add(st);
    }
    // a chunky stone ring frame around the window
    const ring = new T.Mesh(new T.TorusGeometry(2.5, 0.26, 10, 32), new T.MeshStandardMaterial({ color: 0x3a3658, roughness: 0.95 }));
    ring.position.set(mx, my, R.z0 + 0.28); scene.add(ring);
    const moonGlow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xfff0c0, transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    moonGlow.scale.setScalar(5); moonGlow.position.set(mx + 0.7, my + 0.55, R.z0 + 1); scene.add(moonGlow);
    // perch beams with roosting owls that bob + hoot
    const beamM = new T.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
    const owls = [];
    for (let i = 0; i < 7; i++) {
      // roost the owls high up and tucked against the far north wall, so none loom at the
      // follow-camera's eye level near the mid-room spawn — they read as a distant flock.
      const x = R.x0 + 5 + i * 7, by = 5.2 + (i % 3) * 1.1;
      const beam = new T.Mesh(new T.BoxGeometry(2.4, 0.2, 0.2), beamM); beam.position.set(x, by, R.z0 + 1 + (i % 2) * 0.9); scene.add(beam);
      const owl = HP.makeOwl('hedwig'); owl.scale.setScalar(0.5); owl.position.set(x + (i % 2 ? 0.5 : -0.5), by + 0.4, beam.position.z); scene.add(owl);
      owls.push({ owl, ph: Math.random() * 7, home: owl.position.clone() });
    }
    // wave the wand in the Owlery: the whole flock takes off, wheels once round the roost hooting, and settles again
    let flockT = 0; const FLOCK = 6, cz = (R.z0 + R.z1) / 2;
    const inOwlery = () => { const g = window.__game, p = g && g.player.position; return !!p && p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1 && p.y < 4; };
    HPI.enchantables.push({ id: 'flock', get x() { return inOwlery() ? window.__game.player.position.x : 1e6; }, y: 5, z: R.z0 + 2, r: 6, cast() {
      if (flockT <= 0) flockT = FLOCK;
      try { for (let i = 0; i < 5; i++) setTimeout(() => HP.sfx.hoot(i % 2 === 0), i * 420); } catch (e) {}
      return '🪶'; } });
    HPI.flockFlying = () => flockT; HPI.flockHome = () => owls.every((o) => o.owl.position.distanceTo(o.home) < 0.01);
    HPI.builders.push((t, dt) => {
      if (flockT > 0) flockT -= dt;
      const k = flockT > 0 ? Math.sin(Math.min(1, flockT / FLOCK) * Math.PI) : 0, e = Math.min(1, k * 2.2);     // ease out to the lap and back to the perch
      owls.forEach((o, i) => {
        HP.animateOwl(o.owl, dt, t + o.ph, e > 0.05 ? 1 : 0, e > 0.05 ? 3 : 0.6);
        if (e <= 0) { if (o.owl.position.x !== o.home.x) { o.owl.position.copy(o.home); o.owl.rotation.y = 0; } return; }
        const a = t * 1.5 + i * 0.9, lx = mx + Math.cos(a) * 16, ly = 5.6 + Math.sin(t * 2.3 + i) * 0.8, lz = cz + Math.sin(a) * 3.6;
        o.owl.position.set(o.home.x + (lx - o.home.x) * e, o.home.y + (ly - o.home.y) * e, o.home.z + (lz - o.home.z) * e);
        o.owl.rotation.y = e * (Math.atan2(-Math.sin(a) * 16, Math.cos(a) * 3.6));
      });
    });
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 7, R.z1 - R.z0, 90);
  };

  function pushTeacher(scene, who, x, z, face, key) {
    const c = HP.makeChibi(who); c.scale.setScalar(1.2); c.position.set(x, 0, z); c.rotation.y = face; scene.add(c);
    const ph = Math.random() * 7; HPI.builders.push((t, dt) => HP.animateChibi(c, dt, t + ph, 0));
    HPI.teachers.push({ key, chibi: c, x, z });
  }
})(window.HPI);
