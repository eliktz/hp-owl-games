/* A cosy upper-floor common room off the gallery: a great crackling fireplace, deep
 * armchairs around a round rug, a warm chandelier, a little bookshelf and a window.
 * Everything sits at the upper-floor height (L.UP). */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit;
  const Y = L.UP, CEIL = L.UP + 5.5;

  function armchair(col) {
    const g = new T.Group();
    const m = new T.MeshStandardMaterial({ color: col, roughness: 0.9 });
    g.add(mk(0, 0.5, 0, 1.3, 0.3, 1.2, m));          // seat
    g.add(mk(0, 1.1, -0.5, 1.3, 1.4, 0.3, m));        // back
    [-1, 1].forEach((s) => g.add(mk(s * 0.65, 0.8, 0, 0.3, 0.9, 1.2, m))); // arms
    return g;
  }
  function mk(x, y, z, w, h, d, m) { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; }

  HPI.buildCommonRoom = function (scene, light) {
    const CR = L.CR;
    HPI.nav.room(CR, { w: [-8, -2] });
    kit.slab(scene, CR, HPI.tex.wood(3, '#3a2616'), Y + 0.02, true, 4);
    kit.slab(scene, CR, HPI.tex.wood(2, '#2a1a10'), CEIL, false, 3);
    const stone = HPI.tex.stone(3);
    kit.wall(scene, { axis: 'z', c: CR.z0, lo: CR.x0, hi: CR.x1, y0: Y, y1: CEIL }, stone);  // north (fireplace)
    kit.wall(scene, { axis: 'z', c: CR.z1, lo: CR.x0, hi: CR.x1, y0: Y, y1: CEIL }, stone);  // south
    kit.wall(scene, { axis: 'x', c: CR.x1, lo: CR.z0, hi: CR.z1, y0: Y, y1: CEIL }, stone);  // east

    // warm round rug + hearth-side seating
    const rug = new T.Mesh(new T.CircleGeometry(4, 32), new T.MeshStandardMaterial({ color: 0x6a1f2c, roughness: 0.85 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(17, Y + 0.04, -7); scene.add(rug);
    const ring = new T.Mesh(new T.RingGeometry(3.5, 4, 32), new T.MeshStandardMaterial({ color: 0xcf9f3a, roughness: 0.7, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(17, Y + 0.05, -7); scene.add(ring);

    // the fireplace on the north wall
    const fp = new T.Group(); fp.position.set(17, Y, CR.z0 + 0.3);
    const brick = new T.MeshStandardMaterial({ color: 0x4a3a44, roughness: 0.95 });
    fp.add(mk(0, 2.4, 0, 5, 4.8, 0.6, brick));                      // chimney breast
    fp.add(mk(0, 1.1, 0.35, 3.4, 2.2, 0.5, new T.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 }))); // dark opening
    fp.add(mk(0, 2.5, 0.5, 4.4, 0.4, 0.8, new T.MeshStandardMaterial({ color: 0x6a5230, roughness: 0.8 }))); // mantel
    [-1, 1].forEach((s) => fp.add(mk(s * 1.9, 1.1, 0.4, 0.5, 2.4, 0.5, brick))); // jambs
    scene.add(fp);
    const fire = light.addFire(17, Y + 0.3, CR.z0 + 0.7, 1.3);
    // wave the wand at the hearth: the flames roar up emerald green (Floo powder!), then settle back to orange
    let greenT = 0, mix = 0;
    const parts = fire.children.map((c) => ({ m: c.material, from: c.material.color.clone(), to: new T.Color(c.isSprite ? 0x3dff8a : (c.material.color.g > 0.6 ? 0xc8ffb0 : 0x2fe070)) }));
    const upHere = () => { const g = window.__game, p = g && g.player.position; return !!p && p.y > Y - 1; };       // not through the floor from below
    HPI.enchantables.push({ id: 'fire', get x() { return upHere() ? 17 : 1e6; }, y: Y, z: CR.z0 + 0.7, r: 3, cast() { greenT = 5; try { window.HPFun.sfx.noise(1.4, 0.22, 0, 600, 0.5); window.HPFun.sfx.poof(); } catch (e) {} return '🔥'; } });
    HPI.greenFire = () => greenT;
    HPI.builders.push((t, dt) => {
      if (greenT <= 0 && mix <= 0) return;
      if (greenT > 0) greenT -= dt;
      mix = Math.max(0, Math.min(1, mix + (greenT > 0 ? dt * 4 : -dt * 1.2)));
      for (const q of parts) q.m.color.copy(q.from).lerp(q.to, mix);
      fire.scale.set(1 + mix * 0.25, 1 + mix * (0.7 + 0.2 * Math.sin(t * 11)), 1);
    });
    // a couple of logs
    [-0.4, 0.3].forEach((o) => { const log = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 1.2, 8), new T.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 })); log.rotation.z = Math.PI / 2; log.position.set(17 + o, Y + 0.25, CR.z0 + 0.7); scene.add(log); });

    // three armchairs facing the fire + a low table
    const chairCols = [0x5a2030, 0x244a3a, 0x234a6b];
    [[14, -6, 0.5], [20, -6, -0.5], [17, -10, Math.PI]].forEach(([x, z, r], i) => {
      const c = armchair(chairCols[i]); c.position.set(x, Y, z); c.rotation.y = r; scene.add(c);
    });
    const tbl = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.2, 16), new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#2e1d10').map, roughness: 0.8 }));
    tbl.position.set(17, Y + 0.7, -7); scene.add(tbl);
    const leg = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 0.7, 10), tbl.material); leg.position.set(17, Y + 0.35, -7); scene.add(leg);

    // warm chandelier
    const ch = new T.Group(); ch.position.set(17, CEIL - 1.2, -7);
    const ringG = new T.Mesh(new T.TorusGeometry(1, 0.08, 8, 20), new T.MeshStandardMaterial({ color: 0x5a4020, metalness: 0.5, roughness: 0.6 }));
    ringG.rotation.x = Math.PI / 2; ch.add(ringG); scene.add(ch);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; light.addTorch(17 + Math.cos(a), CEIL - 1.4, -7 + Math.sin(a), 0xffd27a, 3); }

    // a small bookshelf + window
    const shelf = new T.Group(); shelf.position.set(CR.x1 - 0.6, Y, -4);
    const sm = new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#2a1a0e').map, roughness: 0.85 });
    shelf.add(mk(0, 1.8, 0, 0.5, 3.6, 3, sm));
    const bk = new T.Mesh(new T.PlaneGeometry(2.6, 3), new T.MeshStandardMaterial({ map: HPI.tex.books(), roughness: 0.9 }));
    bk.rotation.y = -Math.PI / 2; bk.position.set(-0.3, 1.8, 0); shelf.add(bk); scene.add(shelf);
    const win = new T.Mesh(new T.PlaneGeometry(2.4, 3.2), new T.MeshBasicMaterial({ map: HPI.tex.stained(30), transparent: true, opacity: 0.9, side: T.DoubleSide, fog: false }));
    win.position.set(17, Y + 2.6, CR.z1 - 0.2); scene.add(win);
    light.addDust(17, Y + 1, -7, 18, 5, 14, 110);
  };
})(window.HPI);
