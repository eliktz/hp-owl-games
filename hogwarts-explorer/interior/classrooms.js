/* Three teaching classrooms off the north corridor — Charms, Transfiguration and
 * Defence/Spells. Each shares the same bones (floor, ceiling, a chalkboard, rows of
 * little desks, a teacher's podium and a standing chibi professor) plus a few themed
 * props. Walls shared with the north corridor are owned by NCOR, so each room builds
 * only the walls it owns (see the floor-plan ownership notes in northwing.js). */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit, F = HPI.furnish;

  function shell(scene, R, ceilY, owned, stone) {
    kit.slab(scene, R, HPI.tex.stone(4), 0.02, true, 3.5);
    kit.slab(scene, R, stone, ceilY, false, 3);
    owned.forEach((w) => kit.wallNav(scene, { ...w, y0: 0, y1: ceilY }, stone));
  }
  function teacher(scene, who, x, z, face, key) {
    const c = HP.makeChibi(who); c.scale.setScalar(1.2);
    c.position.set(x, 0, z); c.rotation.y = face; scene.add(c);
    const ph = Math.random() * 7;
    HPI.builders.push((t, dt) => HP.animateChibi(c, dt, t + ph, 0));
    HPI.teachers.push({ key, chibi: c, x, z });
    return c;
  }

  // ---- Charms: an airy blue-stone room — day windows, a bronze rug, a bookcase, drifting
  //      feather sprites and Flitwick at the front, Ravenclaw banner by the board ----
  HPI.buildCharms = function (scene, light) {
    const R = L.CHA, stone = HPI.tex.stone(3, 'charm'), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    shell(scene, R, 7, [
      { axis: 'x', c: R.x0, lo: R.z0, hi: R.z1 },              // west
      { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1 },              // south
      { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1 },              // north
    ], stone);
    F.rug(scene, cx, cz, 8, 8, 0, '#223a6a', '#c9a94a');
    F.board(scene, R.x0 + 0.3, 3.4, cz, Math.PI / 2, 'סְוִיש!');
    F.deskRows(scene, cx + 2, R.z0 + 3, 0, 2, 3, -Math.PI / 2);
    F.podium(scene, R.x0 + 2.4, 0, cz, Math.PI / 2);
    teacher(scene, 'flitwick', R.x0 + 3.4, cz, Math.PI / 2, 'charms');
    // tall windows on the outer north wall (light spills over the desks), clock-driven
    F.window3(scene, light, R.x0 + 7, 3.7, R.z0 + 0.3, 'z', 1, 'auto', 2.2, 4);
    F.window3(scene, light, R.x1 - 5, 3.7, R.z0 + 0.3, 'z', 1, 'auto', 2.2, 4);
    // Ravenclaw banner (Flitwick's house) beside the board + a charms bookcase
    kit.banner(scene, HPI.tex.banner(0x1b3a6b, '🦅'), R.x0 + 0.45, 4.3, cz + 3.4, 2, 4, 0);
    F.bookshelf(scene, R.x1 - 4.5, 0, R.z1 - 0.4, Math.PI, 4, 3);
    // levitating feathers drifting above the class — crisp emoji sprites (no flat strips)
    const featherTex = HP.canvasTex(64, (g, s) => { g.font = '52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🪶', s / 2, s / 2); });
    for (let i = 0; i < 6; i++) {
      const fe = new T.Sprite(new T.SpriteMaterial({ map: featherTex, transparent: true, depthWrite: false }));
      fe.scale.setScalar(0.9);
      F.levitate(scene, fe, R.x0 + 7 + (i % 3) * 5, 2.6 + (i % 2) * 1.1, R.z0 + 4 + Math.floor(i / 3) * 3.5);
    }
    light.addTorch(R.x1 - 0.5, 4, R.z0 + 2, 0xbfd0ff, 6);
    light.addTorch(R.x1 - 0.5, 4, R.z1 - 2, 0xbfd0ff, 6);
    light.addDust(cx, 2, cz, R.x1 - R.x0, 6, R.z1 - R.z0, 70);
  };

  // ---- Transfiguration: a sage-stone studio — daylight windows, a crimson rug, a shelf of
  //      texts, a morph menagerie on pedestals, McGonagall + her tabby, Gryffindor banner --
  HPI.buildTransfiguration = function (scene, light) {
    const R = L.TRA, stone = HPI.tex.stone(3, 'sage'), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    shell(scene, R, 7, [
      { axis: 'x', c: R.x0, lo: R.z0, hi: R.z1 },              // west
      { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1 },              // south (north owned by owlery)
    ], stone);
    F.rug(scene, cx - 2, cz, 9, 7, 0, '#4a1824', '#c9a94a');
    F.board(scene, R.x0 + 0.3, 3.2, cz, Math.PI / 2, 'גִּלְגּוּל');
    F.deskRows(scene, cx + 2, R.z0 + 4, 0, 1, 3, -Math.PI / 2);
    F.podium(scene, R.x0 + 2.4, 0, cz, Math.PI / 2);
    teacher(scene, 'mcgon', R.x0 + 3.4, cz, Math.PI / 2, 'transfiguration');
    // daylight windows on the south wall + a Gryffindor banner + a shelf of texts
    // (clock-driven: a school-hours studio, not a midnight one)
    F.window3(scene, light, R.x0 + 7, 3.6, R.z1 - 0.3, 'z', -1, 'auto', 2.2, 3.8);
    F.window3(scene, light, R.x1 - 6, 3.6, R.z1 - 0.3, 'z', -1, 'auto', 2.2, 3.8);
    kit.banner(scene, HPI.tex.banner(0x7a1420, '🦁'), R.x0 + 0.45, 4.2, cz + 3.4, 2, 4, 0);
    F.bookshelf(scene, R.x0 + 8, 0, R.z0 + 0.4, 0, 4, 3);
    // a sleek tabby cat curled on the podium (McGonagall's Animagus form)
    const catM = new T.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.8 });
    const cat = new T.Group();
    cat.add(F.mesh(new T.SphereGeometry(0.32, 12, 10), catM, 0, 0, 0));
    cat.add(F.mesh(new T.SphereGeometry(0.2, 12, 10), catM, 0.3, 0.15, 0));
    [-1, 1].forEach((s) => cat.add(F.mesh(new T.ConeGeometry(0.07, 0.16, 6), catM, 0.3 + s * 0.08, 0.32, 0)));
    cat.position.set(R.x0 + 2.4, 1.55, (R.z0 + R.z1) / 2 - 0.5); cat.scale.setScalar(0.9); scene.add(cat);
    // display pedestals: teacup, matchstick, a little hedgehog — the morph menagerie
    const disp = [['🫖', 0xd8d2c4], ['🪵', 0x8a5a2a], ['🦔', 0x6a5236]];
    disp.forEach((d, i) => {
      const ped = F.mesh(new T.CylinderGeometry(0.4, 0.5, 1, 12), new T.MeshStandardMaterial({ color: 0x4a4668, roughness: 0.9 }), R.x1 - 3, 0.5, R.z0 + 3 + i * 3);
      scene.add(ped);
      const spr = new T.Sprite(new T.SpriteMaterial({ map: HP.canvasTex(64, (g, s) => { g.font = '52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d[0], s / 2, s / 2); }), transparent: true, depthWrite: false }));
      spr.scale.setScalar(1); spr.position.set(R.x1 - 3, 1.6, R.z0 + 3 + i * 3); scene.add(spr);
    });
    light.addTorch(R.x1 - 0.5, 4, R.z0 + 2, 0xffd0a0, 6);
    light.addTorch(R.x1 - 0.5, 4, R.z1 - 1.5, 0xffd0a0, 6);
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 6, R.z1 - R.z0, 60);
  };

  // ---- Defence / Spells: practice dummies, targets and a wand rack ----
  HPI.buildDefence = function (scene, light) {
    const R = L.DEF, stone = HPI.tex.stone(3);
    shell(scene, R, 7, [
      { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1 },              // east
      { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1 },              // south (north owned by owlery, west by NCOR)
    ], stone);
    F.board(scene, R.x1 - 0.3, 3.2, (R.z0 + R.z1) / 2, -Math.PI / 2, 'לוּמוֹס');
    F.podium(scene, R.x1 - 2.4, 0, (R.z0 + R.z1) / 2, -Math.PI / 2);
    teacher(scene, 'defence', R.x1 - 3.4, (R.z0 + R.z1) / 2, -Math.PI / 2, 'spells');
    // two straw practice dummies that bob when hexed
    const burlap = new T.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.95 });
    [[R.x0 + 4, R.z0 + 3], [R.x0 + 4, R.z1 - 3]].forEach(([x, z], i) => {
      const d = new T.Group();
      d.add(F.mesh(new T.CylinderGeometry(0.45, 0.55, 1.4, 12), burlap, 0, 1.2, 0));
      d.add(F.mesh(new T.SphereGeometry(0.34, 12, 10), burlap, 0, 2.1, 0));
      d.add(F.mesh(new T.BoxGeometry(1.5, 0.18, 0.18), burlap, 0, 1.7, 0));
      d.add(F.mesh(new T.CylinderGeometry(0.12, 0.15, 1, 8), new T.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 }), 0, 0.5, 0));
      d.position.set(x, 0, z); scene.add(d);
      const ph = i * 2;
      HPI.builders.push((t) => { d.rotation.z = Math.sin(t * 1.5 + ph) * 0.07; });
      // a round target behind each dummy
      const tgt = F.mesh(new T.CircleGeometry(0.8, 24), new T.MeshStandardMaterial({ color: 0xcf3a3a, roughness: 0.8 }), R.x0 + 0.35, 2, z);
      tgt.rotation.y = Math.PI / 2; scene.add(tgt);
      const ring = F.mesh(new T.RingGeometry(0.35, 0.5, 20), new T.MeshStandardMaterial({ color: 0xffffff, side: T.DoubleSide }), R.x0 + 0.36, 2, z); ring.rotation.y = Math.PI / 2; scene.add(ring);
    });
    light.addTorch(R.x0 + 0.5, 4, R.z0 + 2, 0x9fd0ff, 6);
    light.addTorch(R.x0 + 0.5, 4, R.z1 - 2, 0x9fd0ff, 6);
    light.addDust((R.x0 + R.x1) / 2, 2, (R.z0 + R.z1) / 2, R.x1 - R.x0, 6, R.z1 - R.z0, 60);
  };
})(window.HPI);
