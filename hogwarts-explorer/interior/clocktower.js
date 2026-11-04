/* The Clock Tower — a tall, narrow tower room reached north through a door from the
 * Library. A giant glowing clock face fills the far wall with slowly sweeping hands, a
 * long brass pendulum swings overhead, a couple of toothed gears turn, and a tall
 * night-window spills moonlight down the blue night-stone. Original primitives + a
 * canvas clock texture; no third-party art. Its west + south walls are already built by
 * the Trophy/Astronomy rooms and the Library door, so it only raises its east + north. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit, F = HPI.furnish;
  const CEIL = 16;

  function clockFaceTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#161032'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#ffd76a'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke();
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? 112 : 102; g.strokeStyle = 'rgba(255,233,176,.6)'; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.stroke(); }
    g.fillStyle = '#ffe9b0'; g.font = 'bold 30px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g.fillText('' + i, 128 + Math.cos(a) * 94, 128 + Math.sin(a) * 94); }
    g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(128, 128, 8, 0, 7); g.fill();
    return new T.CanvasTexture(c);
  }

  HPI.buildClockTower = function (scene, light) {
    const R = L.CLK, stone = HPI.tex.stone(3, 'tower'), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    kit.slab(scene, R, HPI.tex.stone(4, 'tower'), 0.02, true, 3.5);
    kit.slab(scene, R, stone, CEIL, false, 3);
    // only the east + north walls are ours (west = Trophy/Astronomy backs, south = Library door)
    kit.wallNav(scene, { axis: 'x', c: R.x1, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone);
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);

    // ---- the giant clock face on the north wall (flat & bright so the dial reads),
    //      a gilded rim, and dark sweeping hands pinned just in front of it ----
    const face = new T.Mesh(new T.CircleGeometry(4, 40),
      new T.MeshBasicMaterial({ map: clockFaceTex(), fog: false }));
    face.position.set(cx, 9, R.z0 + 0.25); scene.add(face);
    const brass = new T.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.7, roughness: 0.3 });
    const rim = new T.Mesh(new T.TorusGeometry(4.1, 0.22, 10, 44), brass); rim.position.set(cx, 9, R.z0 + 0.3); scene.add(rim);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffe59a, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    glow.scale.setScalar(5); glow.position.set(cx, 9, R.z0 + 0.5); scene.add(glow);
    const handM = new T.MeshStandardMaterial({ color: 0x15120a, roughness: 0.5, emissive: 0x0a0804, emissiveIntensity: 0.3 });
    const hour = new T.Mesh(new T.BoxGeometry(0.28, 2.3, 0.12), handM); const minute = new T.Mesh(new T.BoxGeometry(0.2, 3.3, 0.12), handM);
    hour.geometry.translate(0, 0.85, 0); minute.geometry.translate(0, 1.35, 0);
    [hour, minute].forEach((h) => { h.position.set(cx, 9, R.z0 + 0.42); scene.add(h); });

    // ---- a long brass pendulum swinging below a little hub on the back wall ----
    const pend = new T.Group(); pend.position.set(cx, 9, R.z0 + 0.5);
    const rod = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 6.5, 8), brass); rod.position.y = -3.25; pend.add(rod);
    const bob = new T.Mesh(new T.SphereGeometry(0.75, 20, 16), brass); bob.position.y = -6.5; pend.add(bob);
    scene.add(pend);

    // ---- two toothed gears turning on the east wall ----
    const gears = [];
    [[R.x1 - 0.5, 6, cz - 3, 1.2, 0.03], [R.x1 - 0.5, 9.5, cz - 1.5, 0.8, -0.05]].forEach(([gx, gy, gz, rad, spd]) => {
      const g = new T.Group(); g.position.set(gx, gy, gz); g.rotation.y = Math.PI / 2;
      g.add(new T.Mesh(new T.CylinderGeometry(rad, rad, 0.3, 24), brass).rotateX(Math.PI / 2));
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const tooth = new T.Mesh(new T.BoxGeometry(0.25, 0.25, 0.3), brass); tooth.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0); g.add(tooth); }
      scene.add(g); gears.push({ g, spd });
    });

    // ---- tall night-window on the east wall (moonlight) ----
    const win = new T.Mesh(new T.PlaneGeometry(0.1, 9), new T.MeshBasicMaterial({ map: HPI.tex.stained(230), transparent: true, opacity: 0.9, side: T.DoubleSide, fog: false }));
    const win2 = new T.Mesh(new T.PlaneGeometry(2.4, 9), win.material); win2.position.set(R.x1 - 0.2, 8, cz + 3); win2.rotation.y = -Math.PI / 2; scene.add(win2);
    light.addShaft(R.x1 - 3, 7, cz + 3, 14, 2.4, -0.3);
    light.addTorch(R.x0 + 0.5, 4, R.z0 + 2, 0x9fb0ff, 6);
    light.addTorch(R.x1 - 0.5, 4, R.z1 - 3, 0x9fb0ff, 6);
    F.ghost(scene, [[R.x0 + 2, R.z0 + 2], [R.x1 - 2, R.z0 + 2], [R.x1 - 2, R.z1 - 2], [R.x0 + 2, R.z1 - 2]], 0);
    light.addDust(cx, 2, cz, R.x1 - R.x0, CEIL - 2, R.z1 - R.z0, 90);

    HPI.builders.push((t) => {
      hour.rotation.z = -t * 0.04; minute.rotation.z = -t * 0.5;
      pend.rotation.z = Math.sin(t * 1.1) * 0.35;
      for (const g of gears) g.g.rotation.z += g.spd;
      glow.material.opacity = 0.32 + 0.12 * Math.sin(t * 1.5);
    });
  };
})(window.HPI);
