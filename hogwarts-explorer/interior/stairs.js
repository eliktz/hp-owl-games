/* The grand marble staircase (decorative steps over the walkable ramp), its carved
 * balustrades, the upper gallery floor + railings, and — through an archway to the
 * north — the famous moving staircases: several stone flights that slowly swing
 * between imaginary landings in a tall shaft. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit;
  const rampY = (z) => L.UP * HPI.clamp((L.rampZ1 - z) / (L.rampZ1 - L.rampZ0), 0, 1);

  HPI.buildStairs = function (scene, light) {
    const marbleMat = () => { const m = HPI.tex.marble(2); return new T.MeshStandardMaterial({ map: m.map, roughness: 0.5, metalness: 0.05 }); };
    const stepMat = marbleMat();

    // decorative steps climbing the ramp footprint
    const N = 13;
    for (let i = 0; i < N; i++) {
      const zc = L.rampZ1 - 0.5 - i * ((L.rampZ1 - L.rampZ0) / N);
      const y = rampY(zc);
      const step = new T.Mesh(new T.BoxGeometry(2 * L.rampX + 1, 0.3, (L.rampZ1 - L.rampZ0) / N + 0.2), stepMat);
      step.position.set(0, y - 0.15, zc); scene.add(step);
      const riser = new T.Mesh(new T.BoxGeometry(2 * L.rampX + 1, 0.6, 0.12), stepMat);
      riser.position.set(0, y - 0.3, zc + 0.5); scene.add(riser);
    }
    // carved balustrades either side of the staircase
    [-1, 1].forEach((s) => {
      for (let i = 0; i <= N; i++) {
        const zc = L.rampZ1 - i * ((L.rampZ1 - L.rampZ0) / N), y = rampY(zc);
        if (i % 2 === 0) { const post = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 1.1, 8), stepMat); post.position.set(s * (L.rampX + 0.3), y + 0.4, zc); scene.add(post); }
      }
      // sloped handrail
      const rail = new T.Mesh(new T.BoxGeometry(0.3, 0.25, Math.hypot(L.rampZ1 - L.rampZ0, L.UP)), stepMat);
      rail.position.set(s * (L.rampX + 0.3), rampY((L.rampZ0 + L.rampZ1) / 2) + 1.0, (L.rampZ0 + L.rampZ1) / 2);
      rail.rotation.x = Math.atan2(L.UP, L.rampZ1 - L.rampZ0); scene.add(rail);
    });

    // ---- upper gallery floor + walls + overlook railing ----
    const GAL = L.GAL;
    HPI.nav.room(GAL, { s: [-L.rampX, L.rampX], e: [-8, -2] });   // open to ramp (south), door east to common room
    kit.slab(scene, GAL, HPI.tex.stone(3), L.UP, true, 3);        // gallery floor at upper level
    kit.slab(scene, GAL, HPI.tex.stone(3), L.UP + 6, false, 3);   // its ceiling
    const stone = HPI.tex.stone(3);
    kit.wall(scene, { axis: 'x', c: GAL.x0, lo: GAL.z0, hi: GAL.z1, y0: L.UP, y1: L.UP + 6 }, stone);
    kit.wall(scene, { axis: 'x', c: GAL.x1, lo: GAL.z0, hi: GAL.z1, y0: L.UP, y1: L.UP + 6, gap: [-8, -2] }, stone);
    // north side: a grand arched overlook onto the enchanted stair hall. A low stone
    // balustrade closes the old floor-level void; a tall pointed arch frames the moving
    // staircases, which now live in a fully enclosed, starlit shaft (buildStairHall).
    kit.wall(scene, { axis: 'z', c: GAL.z0, lo: GAL.x0, hi: GAL.x1, y0: L.UP + 5, y1: L.UP + 6 }, stone); // header strip above the arch
    kit.pointedArch(scene, 0, GAL.z0, GAL.x1 - GAL.x0 - 1, 2.4, 'z', new T.MeshStandardMaterial({ color: 0x3a3658, roughness: 0.95 })).position.y = L.UP + 2.6;
    const balMat = new T.MeshStandardMaterial({ map: kit.cloneTex(stone.map), roughness: 0.95 });
    const railN = new T.Mesh(new T.BoxGeometry(GAL.x1 - GAL.x0, 0.28, 0.32), balMat);
    railN.position.set(0, L.UP + 1.15, GAL.z0 + 0.18); scene.add(railN);
    for (let bx = GAL.x0 + 0.6; bx <= GAL.x1 - 0.6; bx += 1.1) {
      const post = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 1.05, 8), balMat);
      post.position.set(bx, L.UP + 0.6, GAL.z0 + 0.18); scene.add(post);
    }
    // overlook railing along the south edge beside the ramp
    [[-7, -6.2], [6.2, 7]].forEach(([a, b]) => {
      const rail = new T.Mesh(new T.BoxGeometry(b - a, 0.9, 0.2), stone.map ? new T.MeshStandardMaterial({ map: kit.cloneTex(stone.map), roughness: 0.95 }) : stepMat);
      rail.position.set((a + b) / 2, L.UP + 0.45, GAL.z1); scene.add(rail);
    });
    light.addTorch(GAL.x0 + 0.4, L.UP + 3, -6, 0xffa848, 6);
    light.addTorch(GAL.x1 - 0.4, L.UP + 3, -10, 0xffa848, 6);

    // ---- the enchanted stair hall: an enclosed, starlit tower shaft to the north ----
    buildStairHall(scene, light, stone);
  };

  // A fully enclosed grand stair well behind the gallery arch: stone walls on every
  // side, a floor landing far below + a coffered ceiling high above, a tall arched
  // night-sky window (moonlight, never black void), stone landing ledges the flights
  // swing between, and the famous moving staircases. Visual only — the gallery's own
  // north wall already stops the player, so this needs no collision. Its footprint
  // (x[-14,8] z[-40,-14]) is empty space, clear of every walkable room.
  function buildStairHall(scene, light, stone) {
    const SH = { x0: -14, x1: 8, z0: -40, z1: -14 };
    const BOT = 0, TOP = L.UP + 16, cx = (SH.x0 + SH.x1) / 2, cz = (SH.z0 + SH.z1) / 2;
    kit.wall(scene, { axis: 'x', c: SH.x0, lo: SH.z0, hi: SH.z1, y0: BOT, y1: TOP }, stone);   // west
    kit.wall(scene, { axis: 'x', c: SH.x1, lo: SH.z0, hi: SH.z1, y0: BOT, y1: TOP }, stone);   // east
    kit.wall(scene, { axis: 'z', c: SH.z0, lo: SH.x0, hi: SH.x1, y0: BOT, y1: TOP }, stone);   // north (back)
    kit.wall(scene, { axis: 'z', c: SH.z1, lo: SH.x0, hi: -L.rampX, y0: BOT, y1: TOP }, stone); // south returns flanking the arch
    kit.wall(scene, { axis: 'z', c: SH.z1, lo: L.rampX, hi: SH.x1, y0: BOT, y1: TOP }, stone);
    kit.wall(scene, { axis: 'z', c: SH.z1, lo: -L.rampX, hi: L.rampX, y0: L.UP + 6, y1: TOP }, stone); // cap above the gallery arch
    kit.slab(scene, SH, HPI.tex.stone(4), BOT + 0.02, true, 3.5);   // bottom landing (no bottomless void)
    kit.slab(scene, SH, stone, TOP - 0.1, false, 3);                // top ceiling (no open top)

    // a near-full-height arched window of deep night on the back wall (fills the shaft
    // with moonlight so there is never a dark upper void) + a glowing moon
    const night = new T.Mesh(new T.PlaneGeometry(SH.x1 - SH.x0 - 3, TOP - 3),
      new T.MeshBasicMaterial({ map: HPI.tex.stained(230), transparent: true, opacity: 0.95, side: T.DoubleSide, fog: false }));
    night.position.set(cx, (BOT + TOP) / 2 + 1.2, SH.z0 + 0.25); scene.add(night);
    const moon = new T.Mesh(new T.CircleGeometry(1.9, 28), new T.MeshBasicMaterial({ color: 0xfff6d0, fog: false }));
    moon.position.set(cx + 4, TOP - 4.5, SH.z0 + 0.35); scene.add(moon);
    const moonGlow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xfff0c0, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    moonGlow.scale.setScalar(12); moonGlow.position.copy(moon.position); scene.add(moonGlow);
    light.addShaft(cx, TOP - 7, cz, 26, 4, 0);

    // stone landing ledges jutting from the side walls, each with a dark doorway so the
    // stairs visibly "go somewhere" between floors
    const stoneStep = new T.MeshStandardMaterial({ color: 0x5a5478, roughness: 0.95 });
    const doorM = new T.MeshBasicMaterial({ color: 0x0a0812, fog: false });
    [[SH.x0, 4, -20], [SH.x1, 8, -25], [SH.x0, 12, -31], [SH.x1, 15.5, -35]].forEach(([wx, y, z]) => {
      const dir = wx < 0 ? 1 : -1;
      const ledge = new T.Mesh(new T.BoxGeometry(4, 0.4, 4.2), stoneStep); ledge.position.set(wx + dir * 2, y, z); scene.add(ledge);
      const door = new T.Mesh(new T.PlaneGeometry(1.6, 2.6), doorM); door.position.set(wx + dir * 0.2, y + 1.5, z); door.rotation.y = dir * Math.PI / 2; scene.add(door);
    });

    // the moving staircases: flights slowly swinging between the landings
    const flights = [];
    [{ x: -8, y: 4.2, z: -20, len: 8, rot: 0.5, spd: 0.1 },
     { x: 2, y: 8.2, z: -25, len: 7, rot: -0.6, spd: -0.09 },
     { x: -8, y: 12.2, z: -31, len: 7, rot: 0.8, spd: 0.1 },
     { x: 1, y: 15.7, z: -35, len: 6, rot: -0.9, spd: -0.12 }].forEach((f) => {
      const g = new T.Group(); g.position.set(f.x, f.y, f.z); g.rotation.y = f.rot;
      for (let i = 0; i < f.len; i++) { const st = new T.Mesh(new T.BoxGeometry(3, 0.35, 1.1), stoneStep); st.position.set(0, i * 0.5, -f.len / 2 + i); g.add(st); }
      [-1, 1].forEach((s) => { const str = new T.Mesh(new T.BoxGeometry(0.25, 0.9, f.len * 1.05), stoneStep); str.position.set(s * 1.4, f.len * 0.25 - 0.3, 0); str.rotation.x = -Math.atan2(f.len * 0.5, f.len); g.add(str); });
      scene.add(g); flights.push({ g, base: f.rot, spd: f.spd, ph: Math.random() * 7 });
    });
    light.addTorch(SH.x0 + 0.5, 6, -20, 0xffb060, 5);
    light.addTorch(SH.x1 - 0.5, 10, -31, 0xffb060, 5);
    light.addDust(cx, (BOT + TOP) / 2, cz, SH.x1 - SH.x0, TOP - BOT, SH.z1 - SH.z0, 140);
    HPI.builders.push((t) => { for (const f of flights) { f.g.rotation.y = f.base + Math.sin(t * f.spd + f.ph) * 0.4; f.g.position.y += Math.sin(t * 0.3 + f.ph) * 0.003; } });
  }
})(window.HPI);
