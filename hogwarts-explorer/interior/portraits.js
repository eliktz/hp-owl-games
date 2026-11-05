/* A portrait corridor linking the Entrance Hall to the Library. Each portrait is an
 * ORIGINAL stylized painted figure built from primitives — a little bust in a gilded
 * frame over a hand-painted canvas backdrop — that waves and winks. No film stills or
 * ripped art: every face is generic and procedurally posed. */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit;
  // short, icon-heavy lines the portraits say when a child walks up (minimal Hebrew, RTL)
  const LINES = ['👋 שָׁלוֹם!', '🤫 סוֹד לְמַעְלָה 🪜', '📚 לַסִּפְרִיָּה ➡️', '✨ כָּל הַכָּבוֹד!', '🃏 אָסַפְתָּ כַּרְטִיסִים?'];
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // a billboard speech bubble (gold-rimmed violet, house style) baked to a sprite texture
  function talkTex(line) {
    const c = document.createElement('canvas'); c.width = 340; c.height = 120; const g = c.getContext('2d');
    g.fillStyle = 'rgba(40,25,90,.94)'; roundRect(g, 8, 8, 324, 88, 20); g.fill();
    g.strokeStyle = '#ffd76a'; g.lineWidth = 6; roundRect(g, 8, 8, 324, 88, 20); g.stroke();
    g.fillStyle = 'rgba(40,25,90,.94)'; g.beginPath(); g.moveTo(150, 94); g.lineTo(190, 94); g.lineTo(170, 116); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 44px Rubik,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    try { g.direction = 'rtl'; } catch (e) {}
    g.fillText(line, 170, 50);
    return new T.CanvasTexture(c);
  }
  const PAL = [
    { robe: 0x5a2740, skin: 0xe8b98a, hair: 0x2a1d12, bg: '#2a1830' },
    { robe: 0x234a6b, skin: 0xd9a26e, hair: 0x8a8a90, bg: '#162436' },
    { robe: 0x3a5a2e, skin: 0xf0c49a, hair: 0x6a4322, bg: '#1c2a18' },
    { robe: 0x6b4a1e, skin: 0xe8b98a, hair: 0xcf5a1e, bg: '#2e2412' },
    { robe: 0x4a2a5a, skin: 0xd9a26e, hair: 0x14100c, bg: '#241830' },
  ];

  function backdrop(bg) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 50, 10, 64, 64, 90);
    grd.addColorStop(0, '#5a4a30'); grd.addColorStop(1, bg); g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * 12, 0); g.lineTo(i * 12 + 10, 128); g.stroke(); }
    return new T.CanvasTexture(c);
  }

  function makePortrait(p) {
    const g = new T.Group();
    const gold = new T.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.5, roughness: 0.45, emissive: 0x3a2c08, emissiveIntensity: 0.4 });
    // gilded frame
    const fw = 2.2, fh = 2.9;
    [[0, fh / 2, fw, 0.3], [0, -fh / 2, fw, 0.3], [-fw / 2, 0, 0.3, fh], [fw / 2, 0, 0.3, fh]].forEach(([x, y, w, h]) => {
      const b = new T.Mesh(new T.BoxGeometry(w, h, 0.4), gold); b.position.set(x, y, 0); g.add(b);
    });
    const canvasM = new T.Mesh(new T.PlaneGeometry(fw - 0.3, fh - 0.3),
      new T.MeshStandardMaterial({ map: backdrop(p.bg), roughness: 0.9, emissive: 0x15110a, emissiveIntensity: 0.5 }));
    canvasM.position.z = -0.1; g.add(canvasM);

    // the painted figure (shallow bust)
    const fig = new T.Group(); fig.position.set(0, -0.3, 0.05); fig.scale.z = 0.55; g.add(fig);
    const robeM = new T.MeshStandardMaterial({ color: p.robe, roughness: 0.9, emissive: new T.Color(p.robe).multiplyScalar(0.15) });
    const skinM = new T.MeshStandardMaterial({ color: p.skin, roughness: 0.8, emissive: new T.Color(p.skin).multiplyScalar(0.12) });
    const body = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 16), robeM); body.position.y = 0.2; fig.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.42, 18, 14), skinM); head.position.y = 1.1; fig.add(head);
    const hair = new T.Mesh(new T.SphereGeometry(0.46, 16, 12, 0, 6.3, 0, 1.7), new T.MeshStandardMaterial({ color: p.hair, roughness: 0.95 }));
    hair.position.y = 1.18; fig.add(hair);
    const eyes = [];
    [-1, 1].forEach((s) => {
      const w = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      w.scale.set(1, 1.1, 0.5); w.position.set(s * 0.15, 1.12, 0.38); fig.add(w);
      const pu = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), new T.MeshStandardMaterial({ color: 0x1a140e })); pu.position.set(s * 0.15, 1.12, 0.44); fig.add(pu);
      const lid = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), skinM); lid.scale.set(1, 0.15, 0.6); lid.position.set(s * 0.15, 1.21, 0.4); fig.add(lid);
      eyes.push(lid);
    });
    // waving arm (pivots at the shoulder)
    const arm = new T.Group(); arm.position.set(-0.55, 0.7, 0.2); fig.add(arm);
    const sleeve = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 0.7, 8), robeM); sleeve.position.y = -0.3; arm.add(sleeve);
    const hand = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), skinM); hand.position.y = -0.65; arm.add(hand);

    g.userData = { arm, eyes, wavePh: Math.random() * 7, winkT: 1 + Math.random() * 4, lidBase: eyes[0].scale.y, winking: 0 };
    return g;
  }

  HPI.buildCorridor = function (scene, light) {
    const COR = L.COR;
    // doors: west→Entrance Hall, east→Library, north→Hospital wing + the north corridor
    HPI.nav.room(COR, { w: [17, 23], e: [17, 23], n: [[18, 26], [33, 39]] });
    kit.slab(scene, COR, HPI.tex.stone(3), 0.02, true, 3);
    kit.slab(scene, COR, HPI.tex.stone(3), 6, false, 3);
    const stone = HPI.tex.stone(3);
    kit.wall(scene, { axis: 'z', c: COR.z0, lo: COR.x0, hi: COR.x1, y0: 0, y1: 6, gap: [[18, 26], [33, 39]] }, stone);
    kit.wall(scene, { axis: 'z', c: COR.z1, lo: COR.x0, hi: COR.x1, y0: 0, y1: 6 }, stone);
    // runner carpet
    const rug = new T.Mesh(new T.PlaneGeometry(2.4, COR.x1 - COR.x0), new T.MeshStandardMaterial({ color: 0x5a1a28, roughness: 0.85 }));
    rug.rotation.set(-Math.PI / 2, 0, Math.PI / 2); rug.position.set((COR.x0 + COR.x1) / 2, 0.05, (COR.z0 + COR.z1) / 2); scene.add(rug);

    const portraits = [];
    let k = 0;
    for (let x = COR.x0 + 4; x < COR.x1; x += 5) {
      const north = k % 2 === 0;
      const p = makePortrait(PAL[k % PAL.length]);
      p.position.set(x, 3.2, north ? COR.z0 + 0.4 : COR.z1 - 0.4);
      p.rotation.y = north ? 0 : Math.PI; scene.add(p); portraits.push(p);
      // a walk-up speech bubble above the frame (hidden until a child comes close)
      const bub = new T.Sprite(new T.SpriteMaterial({ map: talkTex(LINES[k % LINES.length]), transparent: true, depthWrite: false, opacity: 0, fog: false }));
      bub.scale.set(3.4, 1.2, 1); bub.position.set(0, 2.05, 0.5); bub.renderOrder = 5; p.add(bub); p.userData.bubble = bub;
      light.addTorch(x, 4.2, north ? COR.z1 - 0.4 : COR.z0 + 0.4, 0xffa848, 5);
      k++;
    }
    // doorway signs + warm hanging lanterns so the corridor reads as a real place
    const F = HPI.furnish;
    F.sign(scene, COR.x1 - 0.3, 3.9, 20, -Math.PI / 2, 'הספרייה', '📚');     // east → Library
    F.sign(scene, COR.x0 + 0.3, 3.9, 20, Math.PI / 2, 'אולם הכניסה', '🚪');  // west → Entrance Hall
    F.sign(scene, 22, 3.9, COR.z0 + 0.3, 0, 'אגף החולים', '🛏️');            // north → Hospital
    F.sign(scene, 36, 3.9, COR.z0 + 0.3, 0, 'הכיתות', '🪄');                 // north → classrooms wing
    F.lantern(scene, 20, 4.3, 20); F.lantern(scene, 32, 4.3, 20);
    light.addDust((COR.x0 + COR.x1) / 2, 2, (COR.z0 + COR.z1) / 2, COR.x1 - COR.x0, 5, 7, 90);

    HPI.builders.push((t, dt) => {
      // which portrait is the child standing closest to? (only that one speaks)
      const g = window.__game, pp = (g && g.world === 'inside' && g.player) ? g.player.position : null;
      let near = null, nd = 1e9;
      if (pp) for (const p of portraits) { const d = Math.hypot(pp.x - p.position.x, pp.z - p.position.z); if (d < nd) { nd = d; near = p; } }
      for (const p of portraits) {
        const u = p.userData;
        const talking = (p === near && nd < 6.5);
        u.arm.rotation.z = 0.5 + Math.sin(t * (talking ? 6 : 3) + u.wavePh) * (talking ? 0.9 : 0.6);  // waves harder when talking
        u.winkT -= dt;
        if (u.winkT <= 0) { u.winking = 0.3; u.winkT = 3 + Math.random() * 5; }
        if (u.winking > 0) { u.winking -= dt; const w = Math.sin((1 - u.winking / 0.3) * Math.PI); u.eyes[0].scale.y = u.lidBase + w * 1.6; }
        else u.eyes[0].scale.y = u.lidBase;
        // fade the speech bubble in/out
        const b = u.bubble; if (b) b.material.opacity += ((talking ? 1 : 0) - b.material.opacity) * Math.min(1, dt * 10);
      }
    });
  };
})(window.HPI);
