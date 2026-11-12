/* The Room of Requirement: a hidden chamber west of the Owlery that never looks the
 * same twice. Each time you step in from the roost, it re-imagines itself as a different
 * little wonderland — sweets, toys, a gold hoard, a friendly dragon's nook — with a
 * sparkle and a chime, and a banner over the door names what it has become. Pure
 * delight; nothing to collect, everything to discover.
 * Owns only its west/north/south walls — the east wall + the secret doorway belong to
 * the Owlery (see northwing.js). */
(function (HPI) {
  const T = HPI.T, L = HPI.L, kit = HPI.kit, F = HPI.furnish;

  // small material helpers (bright, toy-like — this room is meant to feel magical)
  const solid = (c, extra) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, extra));
  const glowMat = (c) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.4 });
  function sprinkle(g, cx, cz) {   // a few sparkle motes so every theme twinkles
    for (let i = 0; i < 6; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffe9a8, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      const a = i * 1.7; s.scale.setScalar(0.8); s.position.set(cx + Math.cos(a) * 5, 1 + (i % 3) * 1.5, cz + Math.sin(a) * 3.5); g.add(s);
    }
  }

  // ---- the four things the room can decide to become ----
  function candyRoom(cx, cz) {        // 🍭 giant lollipops + candy canes
    const g = new T.Group();
    const cols = [0xff5fa2, 0x7ad6ff, 0x9aff73, 0xffd24a, 0xc98aff];
    [[-7, -5], [-2, -6], [3, -4], [-5, 2], [1, 3]].forEach((p, i) => {
      const stick = F.mesh(new T.CylinderGeometry(0.1, 0.1, 2.2, 8), solid(0xfff4ea), cx + p[0], 1.1, cz + p[1]); g.add(stick);
      const pop = F.mesh(new T.SphereGeometry(0.75, 18, 14), glowMat(cols[i % cols.length]), cx + p[0], 2.5, cz + p[1]); g.add(pop);
      pop.scale.z = 0.4;
    });
    // two striped candy canes leaning in a corner
    [[-9, 3], [-9, 1.4]].forEach((p) => { const c = F.mesh(new T.TorusGeometry(0.5, 0.16, 8, 16, Math.PI), solid(0xff5577), cx + p[0], 2.6, cz + p[1]); c.rotation.z = Math.PI; g.add(c); g.add(F.mesh(new T.CylinderGeometry(0.16, 0.16, 2.4, 8), solid(0xffe9ee), cx + p[0] + 0.5, 1.4, cz + p[1])); });
    sprinkle(g, cx, cz); return g;
  }

  function toyRoom(cx, cz) {          // 🧸 stacked building blocks + a big bouncy ball
    const g = new T.Group();
    const cols = [0xff6b6b, 0x4ec3ff, 0x7bd957, 0xffcf3f, 0xb07bff];
    for (let i = 0; i < 6; i++) {     // a little tower of alphabet blocks
      const s = 1 - i * 0.06;
      g.add(F.mesh(new T.BoxGeometry(s, s, s), solid(cols[i % cols.length]), cx - 4, 0.5 + i * 0.95, cz - 3));
    }
    [[2, -4, 0xff79c0], [4, 1, 0x4ec3ff]].forEach(([x, z, c]) => g.add(F.mesh(new T.SphereGeometry(1.1, 18, 14), glowMat(c), cx + x, 1.1, cz + z)));
    // a toy train: a boxy engine with round wheels
    const eng = new T.Group(); eng.position.set(cx - 1, 0, cz + 3);
    eng.add(F.mesh(new T.BoxGeometry(1.6, 0.8, 0.9), solid(0xd94f4f), 0, 0.7, 0));
    eng.add(F.mesh(new T.CylinderGeometry(0.22, 0.22, 0.95, 10), solid(0x2e2e3a), 0.4, 1.3, 0));
    [-0.5, 0.5].forEach((x) => [-0.5, 0.5].forEach((z) => { const w = F.mesh(new T.CylinderGeometry(0.3, 0.3, 0.16, 12), solid(0x1f1f27), x, 0.3, z); w.rotation.x = Math.PI / 2; eng.add(w); }));
    g.add(eng); sprinkle(g, cx, cz); return g;
  }

  function treasureRoom(cx, cz) {     // 💎 gold coin piles, gem crystals + a chest
    const g = new T.Group();
    const gold = new T.MeshStandardMaterial({ color: 0xffcf3f, metalness: 0.75, roughness: 0.25, emissive: 0x3a2a00, emissiveIntensity: 0.35 });
    [[-5, -4], [2, -5], [-2, 2], [4, 1]].forEach((p) => {    // coin piles (stacked discs)
      for (let k = 0; k < 4; k++) { const c = F.mesh(new T.CylinderGeometry(0.9 - k * 0.14, 0.95 - k * 0.14, 0.3, 18), gold, cx + p[0], 0.2 + k * 0.26, cz + p[1]); g.add(c); }
    });
    const gems = [0xff5577, 0x5fd0ff, 0x8affa0, 0xd58aff];
    [[-7, 1], [0, -2], [5, -3], [-4, 4]].forEach((p, i) => g.add(F.mesh(new T.OctahedronGeometry(0.55), glowMat(gems[i % gems.length]), cx + p[0], 1, cz + p[1])));
    // an open treasure chest glowing from within
    const chest = new T.Group(); chest.position.set(cx - 1, 0, cz + 4);
    chest.add(F.mesh(new T.BoxGeometry(2, 1, 1.2), solid(0x6a4321), 0, 0.5, 0));
    const lid = F.mesh(new T.BoxGeometry(2, 0.5, 1.2), solid(0x5a3519), 0, 1.1, -0.5); lid.rotation.x = -0.9; chest.add(lid);
    chest.add(F.mesh(new T.BoxGeometry(1.8, 0.4, 1), new T.MeshBasicMaterial({ color: 0xffe06a, fog: false }), 0, 0.9, 0));
    g.add(chest); sprinkle(g, cx, cz); return g;
  }

  function dragonRoom(cx, cz) {       // 🐉 a friendly chibi dragon guarding glowing eggs
    const g = new T.Group();
    const scaleM = solid(0x4fbf6a, { metalness: 0.2 }), belly = solid(0xd6f5c0);
    const d = new T.Group(); d.position.set(cx - 1, 0, cz - 3);
    d.add(F.mesh(new T.SphereGeometry(1.1, 18, 14), scaleM, 0, 1.2, 0));          // body
    d.add(F.mesh(new T.SphereGeometry(0.75, 16, 12), scaleM, 1.1, 2, 0));         // head
    d.add(F.mesh(new T.SphereGeometry(0.5, 12, 10), belly, 0, 0.9, 0.7));         // tummy
    [-0.3, 0.3].forEach((x) => d.add(F.mesh(new T.SphereGeometry(0.12, 8, 8), new T.MeshBasicMaterial({ color: 0xfff0a0, fog: false }), 1.5, 2.2, x)));  // eyes
    [-1, 1].forEach((s) => { const wing = F.mesh(new T.ConeGeometry(0.7, 1.6, 4), solid(0x3a9c55), 0, 1.6, s * 1); wing.rotation.z = Math.PI / 2; wing.rotation.x = s * 0.5; wing.scale.set(0.5, 1, 1); d.add(wing); });
    const tail = F.mesh(new T.ConeGeometry(0.35, 1.8, 8), scaleM, -1.3, 0.9, 0); tail.rotation.z = Math.PI / 2.2; d.add(tail);
    g.add(d);
    // a clutch of glowing dragon eggs in a straw nest
    const eggCols = [0xffd36a, 0xff9ac0, 0x9ad0ff];
    [[2.5, 1], [3.4, 0], [3, 1.9]].forEach((p, i) => { const e = F.mesh(new T.SphereGeometry(0.5, 14, 12), glowMat(eggCols[i % 3]), cx + p[0], 0.6, cz + p[1]); e.scale.y = 1.35; g.add(e); });
    sprinkle(g, cx, cz); return g;
  }

  const THEMES = [
    { n: 'חֲדַר הַמַּמְתַּקִּים', e: '🍭', col: 0xff8ec0, make: candyRoom },
    { n: 'חֲדַר הַצַּעֲצוּעִים', e: '🧸', col: 0x7ec8ff, make: toyRoom },
    { n: 'אוֹצַר הַזָּהָב', e: '💎', col: 0xffd76a, make: treasureRoom },
    { n: 'פִּנַּת הַדְּרָקוֹן', e: '🐉', col: 0x9affc0, make: dragonRoom },
  ];

  // ---- a banner over the door that repaints itself to name the current wonder ----
  function paintBanner(mesh, th) {
    const c = mesh.userData.canvas, g = c.getContext('2d');
    g.clearRect(0, 0, 360, 120);
    g.fillStyle = 'rgba(40,25,90,.92)'; g.strokeStyle = '#ffd76a'; g.lineWidth = 7;
    g.beginPath(); g.roundRect(6, 6, 348, 108, 22); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '58px serif'; g.fillText(th.e, 64, 62);
    g.fillStyle = '#ffe9b0'; g.font = 'bold 40px Rubik, sans-serif'; g.fillText(th.n, 210, 64);
    mesh.material.map.needsUpdate = true;
  }
  function makeBanner() {
    const c = document.createElement('canvas'); c.width = 360; c.height = 120;
    const m = new T.Mesh(new T.PlaneGeometry(4.6, 1.5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, side: T.DoubleSide, fog: false }));
    m.userData.canvas = c; return m;
  }

  function disposeGroup(group) {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } });
  }

  HPI.buildRoomOfRequirement = function (scene, light, ctx) {
    const R = L.ROR, CEIL = 9, stone = HPI.tex.stone(3, 'tower');
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    kit.slab(scene, R, HPI.tex.stone(4, 'tower'), 0.02, true, 3);     // floor
    kit.slab(scene, R, stone, CEIL, false, 3);                         // ceiling
    // west / north / south walls (east wall + doorway are built by the Owlery)
    kit.wallNav(scene, { axis: 'x', c: R.x0, lo: R.z0, hi: R.z1, y0: 0, y1: CEIL }, stone);
    kit.wallNav(scene, { axis: 'z', c: R.z0, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);
    kit.wallNav(scene, { axis: 'z', c: R.z1, lo: R.x0, hi: R.x1, y0: 0, y1: CEIL }, stone);
    light.enchantedCeiling(cx, cz, R.x1 - R.x0, R.z1 - R.z0, CEIL - 0.3);
    light.addTorch(R.x0 + 0.5, 4, cz - 4, 0xffd0a0, 6);
    light.addTorch(R.x0 + 0.5, 4, cz + 4, 0xffd0a0, 6);
    light.addDust(cx, 2, cz, R.x1 - R.x0, 6, R.z1 - R.z0, 80);

    const banner = makeBanner(); banner.position.set(cx, 6.2, R.z0 + 0.25); scene.add(banner);

    let current = null, idx = 0;
    try { idx = (+localStorage.getItem('hpRoR1') || 0) % THEMES.length; } catch (e) {}
    function setTheme(i) {
      idx = ((i % THEMES.length) + THEMES.length) % THEMES.length;
      if (current) { scene.remove(current); disposeGroup(current); }
      const th = THEMES[idx]; current = th.make(cx, cz); scene.add(current); paintBanner(banner, th);
    }
    setTheme(idx);
    // gentle idle sway of whatever has manifested + a twinkling banner
    HPI.builders.push((t) => { if (current) { current.rotation.y = Math.sin(t * 0.3) * 0.1; current.position.y = 0.1 + Math.sin(t * 1.1) * 0.12; } banner.position.y = 6.2 + Math.sin(t * 1.5) * 0.08; });

    // for tests: inspect + force the current wonder
    HPI.roomReq = { setTheme, count: THEMES.length, index: () => idx, name: () => THEMES[idx].n };

    // wave the wand inside and the room re-imagines itself on the spot — wish again, as often as you like
    const inRoom = () => { const g = window.__game, p = g && g.player.position; return !!p && p.x > R.x0 + 0.5 && p.x < R.x1 - 0.5 && p.z > R.z0 + 0.5 && p.z < R.z1 - 0.5 && p.y < 4; };
    HPI.enchantables.push({ id: 'wish', get x() { return inRoom() ? cx : 1e6; }, y: 1.5, z: cz, r: 4, cast() {
      setTheme(idx + 1);
      try { localStorage.setItem('hpRoR1', String(idx)); } catch (e) {}
      try { window.HPFun.sfx.poof(); HP.sfx.chime(); } catch (e) {}
      if (ctx && ctx.fx) ctx.fx.burst(new T.Vector3(cx, 2.6, cz), [THEMES[idx].col, 0xffffff, 0xffe59a], 40, 8, 0.9);
      return '💭'; } });

    // step in from the roost and the room re-imagines itself — once per entry
    let wasIn = false;
    return function rorUpdate(player) {
      const p = player.position;
      const inNow = p.x > R.x0 + 0.5 && p.x < R.x1 - 0.5 && p.z > R.z0 + 0.5 && p.z < R.z1 - 0.5;
      if (inNow && !wasIn) {
        setTheme(idx + 1);
        try { localStorage.setItem('hpRoR1', String(idx)); } catch (e) {}
        try { HP.sfx.sparkle && HP.sfx.sparkle(); HP.sfx.chime && HP.sfx.chime(); } catch (e) {}
        if (ctx && ctx.fx) ctx.fx.burst(new T.Vector3(cx, 2.6, cz), [THEMES[idx].col, 0xffffff, 0xffe59a], 32, 7, 0.9);
      }
      wasIn = inNow;
    };
  };
})(window.HPI);
