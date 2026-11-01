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
    // north wall carries an archway to view the moving staircases beyond
    kit.wall(scene, { axis: 'z', c: GAL.z0, lo: GAL.x0, hi: GAL.x1, y0: L.UP + 2.6, y1: L.UP + 6 }, stone);
    kit.pointedArch(scene, 0, GAL.z0, GAL.x1 - GAL.x0 - 1, 2.2, 'z', new T.MeshStandardMaterial({ color: 0x3a3658, roughness: 0.95 })).position.y = L.UP + 0.4;
    // overlook railing along the south edge beside the ramp
    [[-7, -6.2], [6.2, 7]].forEach(([a, b]) => {
      const rail = new T.Mesh(new T.BoxGeometry(b - a, 0.9, 0.2), stone.map ? new T.MeshStandardMaterial({ map: kit.cloneTex(stone.map), roughness: 0.95 }) : stepMat);
      rail.position.set((a + b) / 2, L.UP + 0.45, GAL.z1); scene.add(rail);
    });
    light.addTorch(GAL.x0 + 0.4, L.UP + 3, -6, 0xffa848, 6);
    light.addTorch(GAL.x1 - 0.4, L.UP + 3, -10, 0xffa848, 6);

    // ---- the moving staircases: flights swinging in the shaft to the north ----
    const stoneStep = new T.MeshStandardMaterial({ color: 0x5a5478, roughness: 0.95 });
    const flights = [];
    const spec = [
      { x: 0, y: 3.5, z: -22, len: 8, rot: 0, spd: 0.12 },
      { x: -6, y: 8, z: -26, len: 7, rot: 1.1, spd: -0.09 },
      { x: 6, y: 12, z: -24, len: 7, rot: -0.7, spd: 0.1 },
      { x: 0, y: 15, z: -28, len: 6, rot: 2.0, spd: -0.13 },
    ];
    spec.forEach((f) => {
      const g = new T.Group(); g.position.set(f.x, f.y, f.z); g.rotation.y = f.rot;
      const steps = f.len;
      for (let i = 0; i < steps; i++) {
        const st = new T.Mesh(new T.BoxGeometry(3, 0.35, 1.1), stoneStep);
        st.position.set(0, i * 0.7, -steps / 2 + i); g.add(st);
      }
      // side stringers
      [-1, 1].forEach((s) => { const str = new T.Mesh(new T.BoxGeometry(0.25, 0.9, steps * 1.05), stoneStep); str.position.set(s * 1.4, steps * 0.35 - 0.3, 0); str.rotation.x = -Math.atan2(steps * 0.7, steps); g.add(str); });
      scene.add(g); flights.push({ g, base: f.rot, spd: f.spd, ph: Math.random() * 7 });
    });
    light.addShaft(0, L.UP + 4, -24, 16, 3, 0);
    light.addDust(0, L.UP, -24, 14, 10, 14, 120);

    HPI.builders.push((t) => {
      for (const f of flights) { f.g.rotation.y = f.base + Math.sin(t * f.spd + f.ph) * 0.5; f.g.position.y += Math.sin(t * 0.3 + f.ph) * 0.004; }
    });
  };
})(window.HPI);
