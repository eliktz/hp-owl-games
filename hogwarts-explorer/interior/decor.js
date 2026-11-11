/* Set dressing that makes the big rooms feel lived-in: a feast laid along the Great Hall
 * tables, grinning pumpkins floating among the candles, the headmaster's golden owl
 * lectern, a purple aisle runner, a great iron chandelier and guard armours in the
 * Entrance Hall, and reading lamps + a spinning globe in the Library. Everything heavy is
 * instanced (one draw call per kind) so the extra charm costs the iPad almost nothing. */
(function (HPI) {
  const T = HPI.T, L = HPI.L;
  const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
  const mk = (par, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  const glow = (color, size, op) => { const s = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, fog: false })); s.scale.setScalar(size); return s; };

  HPI.buildDecor = function (scene, light) {
    const F = HPI.furnish, GH = L.GH, EH = L.EH, d = new T.Object3D(), c = new T.Color();

    // ---------------- Great Hall: the feast ----------------
    const foodCols = [0xd9622b, 0xe8c860, 0xb8322e, 0x7cc04a, 0xf2e2b0, 0x8a4a2a, 0xff9a3c, 0xa55ad0];
    const food = new T.InstancedMesh(new T.SphereGeometry(0.3, 10, 8), M(0xffffff, { roughness: 0.55 }), 72);
    let n = 0;
    [7, 15, 29, 37].forEach((z, ti) => {
      for (let x = -48.5; x < -18 && n < 72; x += 1.75) {
        const kind = (n + ti) % 4, s = kind === 0 ? 1.25 : 0.6 + ((n * 7) % 5) * 0.09;      // every 4th is a big roast / pie
        d.position.set(x + ((n * 13) % 7) * 0.08, 1.07 + 0.3 * s * (kind === 0 ? 0.55 : 0.8), z + (((n * 5) % 9) - 4) * 0.13);
        d.scale.set(s * (kind === 0 ? 1.3 : 1), s * (kind === 0 ? 0.6 : 0.85), s); d.rotation.set(0, n, 0); d.updateMatrix();
        food.setMatrixAt(n, d.matrix); food.setColorAt(n, c.setHex(kind === 0 ? (n % 8 < 4 ? 0x9a5a2a : 0xe0b060) : foodCols[(n * 3 + ti) % foodCols.length])); n++;
      }
    });
    food.count = n; food.userData.room = 'GH'; food.frustumCulled = false; scene.add(food);
    // wave the wand at a table and the whole feast hops and jiggles for a few seconds
    const base = []; { const m = new T.Matrix4(); for (let i = 0; i < n; i++) { food.getMatrixAt(i, m); base.push(m.clone()); } }
    let danceT = 0; const mm = new T.Matrix4(), hop = new T.Matrix4();
    [7, 15, 29, 37].forEach((z) => HPI.enchantables.push({ id: 'feast', x: -33, y: 0.4, z, r: 4, cast() { danceT = 3.2; try { window.HPFun.sfx.munch(); } catch (e) {} return '🍗'; } }));
    HPI.builders.push((t, dt) => {
      if (danceT <= 0) return;
      danceT -= dt; const k = danceT > 0 ? Math.min(1, danceT) : 0;
      for (let i = 0; i < n; i++) { hop.makeTranslation(0, k * Math.abs(Math.sin(t * 9 + i * 1.3)) * 0.55, 0); mm.multiplyMatrices(hop, base[i]); food.setMatrixAt(i, mm); }
      food.instanceMatrix.needsUpdate = true;
    });

    // a royal-purple runner down the centre aisle
    const run = F.rug(scene, -33, 22, 34, 3.4, 0, '#3b2370', '#d9b24a');
    run.userData.room = 'GH';

    // floating jack-o'-lanterns drifting among the candles
    const PN = 7, pumps = [];
    const pm = new T.InstancedMesh(new T.SphereGeometry(0.62, 12, 10), M(0xff8a1e, { emissive: 0xc04a00, emissiveIntensity: 0.55, roughness: 0.6 }), PN);
    pm.userData.room = 'GH'; pm.frustumCulled = false; scene.add(pm);
    const faceTex = HP.canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.fillStyle = '#ffe9a0'; g.beginPath(); g.moveTo(14, 20); g.lineTo(28, 20); g.lineTo(21, 32); g.closePath(); g.moveTo(36, 20); g.lineTo(50, 20); g.lineTo(43, 32); g.closePath(); g.fill(); g.beginPath(); g.moveTo(12, 40); g.lineTo(52, 40); g.lineTo(44, 52); g.lineTo(38, 46); g.lineTo(32, 54); g.lineTo(26, 46); g.lineTo(20, 52); g.closePath(); g.fill(); });
    for (let i = 0; i < PN; i++) {
      const p = { x: -48 + i * 4.6 + (i % 2) * 1.5, z: 9 + ((i * 11) % 26), y: 5 + (i % 3) * 1.1, ph: i * 1.7 };
      p.face = new T.Sprite(new T.SpriteMaterial({ map: faceTex, transparent: true, depthWrite: false, fog: false })); p.face.scale.setScalar(1.0); p.face.userData.room = 'GH'; scene.add(p.face);
      p.halo = glow(0xff9a3a, 3, 0.4); p.halo.userData.room = 'GH'; scene.add(p.halo);
      pumps.push(p);
    }
    let cam = null, spinT = 0;
    // wave the wand up the middle of the hall and the jack-o'-lanterns whirl about, cackling
    // (they float overhead, so the target is "straight above you" whenever you stand in the centre aisle)
    const inAisle = () => { const g = window.__game, p = g && g.player.position; return p && p.x > -41 && p.x < -15 && Math.abs(p.z - 22) < 3.4 ? p : null; };
    HPI.enchantables.push({ id: 'pumpkins', get x() { const p = inAisle(); return p ? p.x : 1e6; }, y: 5, get z() { const p = inAisle(); return p ? p.z : 1e6; }, r: 3, cast() { spinT = 3.5; try { window.HPFun.sfx.giggle(); setTimeout(() => window.HPFun.sfx.giggle(true), 500); } catch (e) {} return '🎃'; } });
    HPI.builders.push((t, dt) => {
      if (spinT > 0) spinT -= dt;
      if (HPI.cull && !HPI.cull.byKey.GH.on) return;
      const g = window.__game; if (g && !cam) cam = g.camera;
      for (let i = 0; i < PN; i++) {
        const p = pumps[i], x = p.x + Math.sin(t * 0.25 + p.ph) * 1.6, y = p.y + Math.sin(t * 0.9 + p.ph) * 0.35, z = p.z + Math.cos(t * 0.2 + p.ph) * 1.6;
        const sp = spinT > 0 ? Math.min(1, spinT) : 0;            // enchanted: they whirl and bob like mad
        d.position.set(x, y + sp * Math.abs(Math.sin(t * 8 + p.ph)) * 0.8, z); d.scale.set(1, 0.82, 1); d.rotation.set(0, sp * t * 9, Math.sin(t * 0.7 + p.ph) * 0.12); d.updateMatrix(); pm.setMatrixAt(i, d.matrix);
        // the carved face always grins toward the camera
        if (cam) { const dx = cam.position.x - x, dy = cam.position.y - y, dz = cam.position.z - z, l = Math.hypot(dx, dy, dz) || 1; p.face.position.set(x + dx / l * 0.6, y + dy / l * 0.6, z + dz / l * 0.6); }
        p.halo.position.set(x, y, z); p.halo.material.opacity = 0.32 + 0.12 * Math.sin(t * 7 + p.ph);
      }
      pm.instanceMatrix.needsUpdate = true;
    });

    // the headmaster's golden owl lectern before the head table
    const gold = M(0xe6b422, { metalness: 0.75, roughness: 0.25, emissive: 0x4a3400, emissiveIntensity: 0.45 });
    const lec = new T.Group(); lec.position.set(GH.x0 + 8.5, 0, 22);
    mk(lec, new T.CylinderGeometry(0.5, 0.75, 0.3, 14), gold, 0, 0.15, 0);
    mk(lec, new T.CylinderGeometry(0.13, 0.18, 1.6, 10), gold, 0, 1.1, 0);
    const owl = new T.Group(), wings = []; lec.add(owl);         // the bird is its own group so it can come alive
    const ob = mk(owl, new T.SphereGeometry(0.42, 14, 12), gold, 0, 2.15, 0); ob.scale.set(0.9, 1.15, 0.8);
    mk(owl, new T.SphereGeometry(0.3, 12, 10), gold, 0, 2.75, 0.06);
    [-1, 1].forEach((s) => { const w = mk(owl, new T.BoxGeometry(1.1, 0.75, 0.08), gold, s * 0.72, 2.35, -0.05); w.rotation.z = s * 0.5; w.rotation.y = s * -0.3; w.userData.s = s; wings.push(w); mk(owl, new T.ConeGeometry(0.07, 0.16, 6), gold, s * 0.11, 3.0, 0.06); });
    mk(owl, new T.ConeGeometry(0.06, 0.14, 6), M(0x5a3a00), 0, 2.72, 0.36).rotation.x = Math.PI / 2;
    // a wand cast wakes the golden owl: it beats its wings, hops on its perch, looks about and hoots
    let flapT = 0;
    HPI.enchantables.push({ id: 'owl', obj: lec, r: 3, cast() { flapT = 2.8; try { HP.sfx.hoot(); setTimeout(() => HP.sfx.hoot(), 900); } catch (e) {} return '🦉'; } });
    HPI.owlFlap = () => flapT;
    HPI.builders.push((t, dt) => {
      if (flapT <= 0) return;
      flapT -= dt; const k = flapT > 0 ? Math.min(1, flapT * 2) : 0;
      for (const w of wings) w.rotation.z = w.userData.s * (0.5 + k * (0.35 + Math.sin(t * 17) * 0.6));
      owl.position.y = k * Math.abs(Math.sin(t * 7)) * 0.3; owl.rotation.y = k * Math.sin(t * 4.5) * 0.6;
    });
    const lg = glow(0xffe08a, 4.5, 0.3); lg.position.y = 2.4; lec.add(lg); lec.rotation.y = Math.PI / 2;
    scene.add(lec);
    light.addPool(GH.x0 + 8.5, 22, 3.2, 0xffd76a, 0.35);

    // ---------------- Entrance Hall: chandelier + guards at the great doors ----------------
    const ch = new T.Group(); ch.position.set(0, 8.4, 21);
    const iron = M(0x20201e, { metalness: 0.6, roughness: 0.5 });
    const ring = mk(ch, new T.TorusGeometry(2.3, 0.1, 8, 28), iron, 0, 0, 0); ring.rotation.x = Math.PI / 2;
    const ring2 = mk(ch, new T.TorusGeometry(1.1, 0.07, 8, 20), iron, 0, 0.7, 0); ring2.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const chn = mk(ch, new T.CylinderGeometry(0.03, 0.03, 2.9, 5), iron, Math.cos(a) * 1.15, 1.25, Math.sin(a) * 1.15); chn.rotation.z = Math.cos(a) * 0.42; chn.rotation.x = -Math.sin(a) * 0.42; }
    const cand = new T.InstancedMesh(new T.CylinderGeometry(0.07, 0.08, 0.45, 6), M(0xfff2d6, { emissive: 0x6a5020, emissiveIntensity: 0.6 }), 14);
    const halos = [];
    for (let i = 0; i < 14; i++) {
      const outer = i < 9, a = i / (outer ? 9 : 5) * Math.PI * 2, r = outer ? 2.3 : 1.1, y = outer ? 0.3 : 1.0;
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r); d.scale.setScalar(1); d.rotation.set(0, 0, 0); d.updateMatrix(); cand.setMatrixAt(i, d.matrix);
      const h = glow(0xffd27a, 0.9, 0.85); h.position.set(Math.cos(a) * r, y + 0.4, Math.sin(a) * r); ch.add(h); halos.push(h);
    }
    ch.add(cand); cand.frustumCulled = false; scene.add(ch);
    light.addPool(0, 21, 9, 0xffc878, 0.42);
    // stand under the great chandelier and wave the wand: it rocks and jingles and its candles flare
    let swingT = 0;
    const underCh = () => { const g = window.__game, p = g && g.player.position; return !!p && Math.hypot(p.x, p.z - 21) < 4.5; };
    HPI.enchantables.push({ id: 'chandelier', get x() { return underCh() ? 0 : 1e6; }, y: 6.4, z: 21, r: 3, cast() { swingT = 4; try { window.HPFun.sfx.tune([1568, 1319, 1568, 1047, 1319, 1568, 2093], 0.11, 'sine'); } catch (e) {} return '🕯️'; } });
    HPI.chandelierSwing = () => swingT;
    HPI.builders.push((t, dt) => {
      if (swingT > 0) swingT -= dt;
      const k = swingT > 0 ? Math.min(1, swingT / 1.5) : 0;      // rocks hard, then settles
      ch.rotation.y = Math.sin(t * 0.3) * 0.06; ch.rotation.z = k * Math.sin(t * 2.7) * 0.2; ch.rotation.x = k * Math.cos(t * 2.2) * 0.12;
      for (let i = 0; i < halos.length; i++) { halos[i].material.opacity = Math.min(1, 0.7 + 0.25 * Math.sin(t * 9 + i * 1.9) + k * 0.3); halos[i].scale.setScalar(0.9 * (1 + k * (0.6 + 0.4 * Math.sin(t * 13 + i)))); }
    });
    F.armour(scene, -5.2, 0, EH.z1 - 1.6, Math.PI); F.armour(scene, 5.2, 0, EH.z1 - 1.6, Math.PI);

    // ---------------- Library: green reading lamps + a slowly spinning globe ----------------
    [[48, 34], [64, 8]].forEach(([x, z]) => {
      const lamp = new T.Group(); lamp.position.set(x - 1.2, 1.1, z);
      mk(lamp, new T.CylinderGeometry(0.16, 0.2, 0.06, 10), M(0xb8902a, { metalness: 0.6, roughness: 0.4 }), 0, 0.03, 0);
      mk(lamp, new T.CylinderGeometry(0.03, 0.03, 0.5, 6), M(0xb8902a, { metalness: 0.6, roughness: 0.4 }), 0, 0.28, 0);
      const sh = mk(lamp, new T.CylinderGeometry(0.14, 0.2, 0.2, 10), M(0x2fae6a, { emissive: 0x1f8a4a, emissiveIntensity: 0.9, roughness: 0.4 }), 0, 0.56, 0); sh.scale.z = 1.9; sh.rotation.y = Math.PI / 2;
      const lgl = glow(0x9effc0, 1.8, 0.45); lgl.position.y = 0.5; lamp.add(lgl); scene.add(lamp);
    });
    const globe = new T.Group(); globe.position.set(43.6, 0, 6.2);
    mk(globe, new T.CylinderGeometry(0.5, 0.65, 0.2, 12), M(0x4a3016), 0, 0.1, 0);
    mk(globe, new T.CylinderGeometry(0.08, 0.1, 1.3, 8), M(0x4a3016), 0, 0.8, 0);
    const gtex = HP.canvasTex(128, (g, s) => { g.fillStyle = '#2a6fb0'; g.fillRect(0, 0, s, s); g.fillStyle = '#7ab85a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse((i * 37) % s, 20 + (i * 53) % 90, 10 + (i * 7) % 16, 7 + (i * 5) % 12, i, 0, 7); g.fill(); } g.strokeStyle = 'rgba(255,255,255,.25)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(s, i * 32); g.stroke(); } });
    const ball = mk(globe, new T.SphereGeometry(0.75, 18, 14), new T.MeshStandardMaterial({ map: gtex, roughness: 0.5 }), 0, 2.0, 0); ball.rotation.z = 0.4;
    const arc = mk(globe, new T.TorusGeometry(0.86, 0.04, 6, 20, Math.PI), M(0xb8902a, { metalness: 0.6, roughness: 0.4 }), 0, 2.0, 0); arc.rotation.z = Math.PI / 2 + 0.4;
    scene.add(globe);
    HPI.builders.push((t, dt) => { ball.rotation.y += dt * 0.4; });
    HPI.enchantables.push({ id: 'globe', obj: globe, r: 2.5, cast() { let k = 0; const iv = setInterval(() => { ball.rotation.y += 0.5; if (++k > 40) clearInterval(iv); }, 16); return '🌍'; } });
  };
})(window.HPI);
