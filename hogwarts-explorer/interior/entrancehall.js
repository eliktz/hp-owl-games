/* The Entrance Hall — polished marble floor, a red welcome carpet running from the
 * great doors to the foot of the grand staircase, stone walls with the four house
 * banners, torches and a couple of fake light-shafts. Collision + the staircase ramp
 * live in core/nav; this file is the look. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit;
  const CEIL = 11;

  HPI.buildEntranceHall = function (scene, light) {
    const EH = L.EH;
    // collision walls (doorways are the gaps): south=outside, west=Great Hall,
    // east=corridor, north=open over the staircase ramp.
    HPI.nav.room(EH, { s: [-2.6, 2.6], w: [22, 28], e: [[6, 12], [17, 23]], n: [-L.rampX, L.rampX] });

    kit.slab(scene, EH, HPI.tex.marble(2), 0.02, true, 4);          // marble floor
    kit.slab(scene, EH, HPI.tex.stone(3), CEIL, false, 3);          // stone ceiling

    const stone = HPI.tex.stone(3);
    // visual walls (this room owns the shared west & east walls)
    kit.wall(scene, { axis: 'z', c: EH.z1, lo: EH.x0, hi: EH.x1, y0: 0, y1: CEIL, gap: [-2.6, 2.6] }, stone); // south / doors
    kit.wall(scene, { axis: 'x', c: EH.x0, lo: EH.z0, hi: EH.z1, y0: 0, y1: CEIL, gap: [22, 28] }, stone);     // west -> GH
    kit.wall(scene, { axis: 'x', c: EH.x1, lo: EH.z0, hi: EH.z1, y0: 0, y1: CEIL, gap: [[6, 12], [17, 23]] }, stone); // east -> hospital + corridor
    // north wall exists only beside the staircase (the ramp gap is open to the gallery)
    kit.wall(scene, { axis: 'z', c: EH.z0, lo: EH.x0, hi: -L.rampX, y0: 0, y1: CEIL }, stone);
    kit.wall(scene, { axis: 'z', c: EH.z0, lo: L.rampX, hi: EH.x1, y0: 0, y1: CEIL }, stone);

    // red welcome carpet from the doors toward the stairs
    const carpet = new T.Mesh(new T.PlaneGeometry(4.2, 28),
      new T.MeshStandardMaterial({ color: 0x7a1420, roughness: 0.85 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.05, 18); scene.add(carpet);
    const trim = new T.Mesh(new T.PlaneGeometry(4.7, 28),
      new T.MeshStandardMaterial({ color: 0xcf9f3a, roughness: 0.7 }));
    trim.rotation.x = -Math.PI / 2; trim.position.set(0, 0.04, 18); scene.add(trim);

    // the great doors — twin oak leaves with iron bands, set in the south arch
    const oak = HPI.tex.wood(1, '#2e1d10');
    const doorMat = new T.MeshStandardMaterial({ map: oak.map, bumpMap: oak.bump, bumpScale: 0.3, roughness: 0.9 });
    [-1, 1].forEach((s) => {
      const d = new T.Mesh(new T.BoxGeometry(2.4, 6.2, 0.25), doorMat);
      d.position.set(s * 1.3, 3.1, EH.z1 - 0.15); scene.add(d);
      for (let b = 0; b < 3; b++) {
        const band = new T.Mesh(new T.BoxGeometry(2.4, 0.18, 0.32), new T.MeshStandardMaterial({ color: 0x20201e, metalness: 0.6, roughness: 0.5 }));
        band.position.set(s * 1.3, 1.4 + b * 1.9, EH.z1 - 0.1); scene.add(band);
      }
      const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.05, 8, 16), new T.MeshStandardMaterial({ color: 0x30302c, metalness: 0.7, roughness: 0.4 }));
      ring.position.set(s * 0.5, 3.1, EH.z1 - 0.02); scene.add(ring);
    });

    // four house banners high on the side walls (two per side)
    HPI.HOUSES.forEach((h, i) => {
      const tex = HPI.tex.banner(h.field, h.crest);
      const side = i < 2 ? EH.x0 + 0.4 : EH.x1 - 0.4;
      const z = 10 + (i % 2) * 14;
      kit.banner(scene, tex, side, 7.5, z, 2.4, 5, 0);
    });

    // torches down both long walls + light-shafts slanting in high up
    for (let z = 8; z <= 30; z += 7) {
      light.addTorch(EH.x0 + 0.5, 4.2, z, 0xffa848, 4);
      light.addTorch(EH.x1 - 0.5, 4.2, z, 0xffa848, 4);
      if (z % 14 === 8) { light.addShaft(EH.x0 + 4, 7, z, 10, 2.2, 0.5); light.addShaft(EH.x1 - 4, 7, z, 10, 2.2, -0.5); }
    }
    light.addDust(0, 2, 18, 20, 9, 26, 150);
  };
})(window.HPI);
