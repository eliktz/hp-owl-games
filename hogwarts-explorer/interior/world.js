/* Assembles the whole castle interior into its own THREE.Scene and runs its life:
 * builds every room, scatters collectibles, pops in a few NPC cameos with gentle
 * quests, and drives all per-frame animation (candles, portraits, stairs, books,
 * lights, dust, ambient audio). The host page just swaps to this scene on entry. */
(function (HPI) {
  const T = HPI.T, L = HPI.L;

  // ---- a still-life "fruit bowl" painting for the secret kitchen passage ----
  function pearTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#2a2016'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#6a4a2a';
    g.beginPath(); g.moveTo(26, 78); g.quadraticCurveTo(64, 116, 102, 78); g.lineTo(96, 78); g.quadraticCurveTo(64, 104, 32, 78); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(64, 80, 40, 12, 0, 0, 7); g.fill();
    g.font = '38px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('🍎', 46, 60); g.fillText('🍇', 82, 58); g.fillText('🍐', 64, 46);
    return new T.CanvasTexture(c);
  }
  function buildSecretPainting(scene) {
    const g = new T.Group(); g.position.set(-23, 3.2, L.GH.z0 + 0.32);
    const gold = new T.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.5, roughness: 0.45, emissive: 0x3a2c08, emissiveIntensity: 0.4 });
    const fw = 2.0, fh = 2.4;
    [[0, fh / 2, fw, 0.28], [0, -fh / 2, fw, 0.28], [-fw / 2, 0, 0.28, fh], [fw / 2, 0, 0.28, fh]].forEach(([x, y, w, h]) => {
      const b = new T.Mesh(new T.BoxGeometry(w, h, 0.34), gold); b.position.set(x, y, 0); g.add(b);
    });
    const canvasM = new T.Mesh(new T.PlaneGeometry(fw - 0.3, fh - 0.3),
      new T.MeshStandardMaterial({ map: pearTex(), roughness: 0.9, emissive: 0x15110a, emissiveIntensity: 0.5 }));
    canvasM.position.z = 0.04; g.add(canvasM);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffe59a, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    glow.scale.set(3.4, 3.4, 1); glow.position.set(0, 0, 0.3); g.add(glow);
    scene.add(g); return { group: g, glow };
  }

  HPI.build = function (ctx) {
    HPI.nav.reset(); HPI.builders.length = 0; HPI.teachers.length = 0;
    const scene = new T.Scene();
    scene.fog = new T.Fog(0x1a1626, 18, 96);
    const light = HPI.Lighting(scene, { pool: 5 }); // +hemi +ambient; a bigger castle, a touch more light
    const audio = ctx.audio;

    HPI.buildEntranceHall(scene, light);
    HPI.buildGreatHall(scene, light);
    HPI.buildStairs(scene, light);
    HPI.buildCorridor(scene, light);
    HPI.buildLibrary(scene, light);
    HPI.buildCommonRoom(scene, light);
    // ---- the expanded castle: dungeon + kitchens, the north wing of classrooms,
    //      the Astronomy tower, the Owlery and three discovery rooms ----
    HPI.buildDungeon(scene, light);
    HPI.buildKitchens(scene, light);
    HPI.buildHospital(scene, light);
    HPI.buildNorthCorridor(scene, light);
    HPI.buildCharms(scene, light);
    HPI.buildTransfiguration(scene, light);
    HPI.buildAstronomy(scene, light);
    HPI.buildDefence(scene, light);
    HPI.buildTrophy(scene, light);
    HPI.buildOwlery(scene, light);
    HPI.buildClockTower(scene, light);

    const spawns = {
      entrance: { x: 0, z: 20, y: 0 },
      greatHall: { x: -30, z: 22, y: 0 },
      corridor: { x: 26, z: 20, y: 0 },
      library: { x: 55, z: 20, y: 0 },
      gallery: { x: 0, z: -4, y: L.UP },
      commonRoom: { x: 17, z: -6, y: L.UP },
      dungeon: { x: -45, z: -12, y: L.DN },
      kitchens: { x: -23, z: -11, y: L.DN },
      hospital: { x: 22, z: 10, y: 0 },
      ncorridor: { x: 35, z: 0, y: 0 },
      charms: { x: 20, z: -22, y: 0 },
      transfiguration: { x: 20, z: -37, y: 0 },
      astronomy: { x: 46, z: -22, y: 0 },
      spells: { x: 50, z: -38, y: 0 },
      trophy: { x: 53, z: -6, y: 0 },
      owlery: { x: 35, z: -50, y: 0 },
      clocktower: { x: 64, z: -8, y: 0 },
    };

    // ---- collectibles scattered through the rooms ----
    const items = [];
    function drop(type, x, z) {
      const o = type === 'snitch' ? HP.makeSnitch() : ctx.makeFrog();
      o.scale.setScalar(type === 'snitch' ? 0.8 : 1);
      const y = HPI.nav.floorH(x, z) + (type === 'snitch' ? 1.5 : 0.4);
      o.position.set(x, y, z); scene.add(o);
      items.push({ o, type, base: new T.Vector3(x, y, z), ph: Math.random() * 7, hop: 0 });
    }
    [[-20, 10], [-40, 30], [-30, 37], [-48, 7], [0, 20], [8, 28],
     [-50, -12], [12, -20], [55, -18], [49, -9], [14, -50], [35, -20], [64, -12]].forEach((p) => drop('snitch', ...p));
    [[55, 10], [50, 34], [64, 24], [26, 20], [17, -9], [2, -4],
     [-28, -20], [28, 12], [12, -40], [55, -40], [55, -4], [66, -3]].forEach((p) => drop('frog', ...p));

    // ---- hidden chocolate-frog cards: one per not-yet-found card, tucked across the castle.
    //      All are placed near guaranteed-reachable spawn points (see the reachability test). ----
    const cardSpots = { merlin: [42, 30], star: [46, -22], owl: [35, -48], dragon: [53, -8], potion: [-45, -12],
      cat: [20, -37], herb: [20, -22], broom: [22, 10], ghost: [64, -8] };
    if (window.HPICards) HPICards.CATALOG.forEach((c) => {
      if (HPICards.has(c.id)) return;                 // already collected → don't respawn
      const sp = cardSpots[c.id]; if (!sp) return;
      const o = HPICards.mesh(c);
      const y = HPI.nav.floorH(sp[0], sp[1]) + 0.1;
      o.position.set(sp[0], y, sp[1]); scene.add(o);
      items.push({ o, type: 'card', id: c.id, base: new T.Vector3(sp[0], y, sp[1]), ph: Math.random() * 7, hop: 0 });
    });

    // ---- NPC cameos with short greetings + tiny quests ----
    const npcs = [];
    const defs = [
      { who: 'harry', pos: [-30, 14], face: 0, type: 'snitch', need: 1, line: "ברוך הבא לאולם הגדול! 🦁", badge: 'harry' },
      { who: 'hermione', pos: [50, 20], face: Math.PI, type: 'frog', need: 1, line: 'תראה כמה ספרים! 📚', badge: 'hermione' },
      { who: 'ron', pos: [17, -10], face: Math.PI, y: L.UP, type: 'frog', need: 1, line: 'חם ונעים ליד האח 🔥', badge: 'ron' },
    ];
    defs.forEach((d) => {
      const c = HP.makeChibi(d.who); c.scale.setScalar(1.2);
      const y = d.y || 0; c.position.set(d.pos[0], y, d.pos[1]); c.rotation.y = d.face;
      scene.add(c);
      npcs.push({ ...d, chibi: c, done: false, wave: 0, y });
    });

    // ---- secret passage: tickle the pear still-life in the Great Hall to slip down to the
    //      Kitchens (a hidden shortcut; the frame glows when you're close). ----
    const secret = buildSecretPainting(scene);
    const secretState = { used: false };
    function secretUpdate(player, t, dt) {
      const sx = -23, sz = L.GH.z0;
      const d = Math.hypot(player.position.x - sx, player.position.z - sz);
      const tgt = d < 4.5 ? (0.5 + 0.4 * Math.sin(t * 3)) : 0;        // pulse brighter when near
      secret.glow.material.opacity += (tgt - secret.glow.material.opacity) * Math.min(1, dt * 5);
      if (d < 2.3 && !secretState.used) {
        secretState.used = true;
        try { HP.sfx.whoosh && HP.sfx.whoosh(); HP.sfx.sparkle && HP.sfx.sparkle(); } catch (e) {}
        ctx.fx.burst(new T.Vector3(sx, 3.2, sz + 0.5), [0xffe59a, 0xffffff, 0xffd76a], 28, 6, 0.8);
        try { localStorage.setItem('hpSecret1', '1'); } catch (e) {}
        setTimeout(() => { try { window.__game && __game.fastTravel && __game.fastTravel({ world: 'inside', key: 'kitchens', yaw: 0, pitch: 0.1 }); } catch (e) {} }, 220);
        setTimeout(() => { secretState.used = false; }, 2600);        // re-arm after a cooldown
      }
    }

    // fire position for audio proximity (common-room hearth)
    const firePos = new T.Vector3(17, L.UP, L.CR.z0 + 0.7);
    const tmp = new T.Vector3();

    function pickups(player, t, dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i], o = it.o;
        if (it.taken) { o.position.lerp(player.position, dt * 8); o.scale.multiplyScalar(1 - dt * 5); it.taken -= dt; if (it.taken <= 0) { scene.remove(o); items.splice(i, 1); } continue; }
        if (it.type === 'snitch') { HP.animateSnitch(o, t); o.position.y = it.base.y + Math.sin(t * 1.6 + it.ph) * 0.4; o.rotation.y += dt * 0.6; }
        else if (it.type === 'card') { o.position.y = it.base.y + Math.sin(t * 1.6 + it.ph) * 0.18; o.rotation.y += dt * 0.8; }
        else { it.hop -= dt; if (it.hop <= 0 && Math.random() < 0.01) it.hop = 0.5; o.position.y = it.base.y + (it.hop > 0 ? Math.sin((it.hop / 0.5) * Math.PI) * 0.6 : 0); o.rotation.y = Math.sin(t * 0.6 + it.ph) * 0.5; }
        if (Math.random() < 0.06) ctx.fx.trail(o.position, it.type === 'snitch' ? 0xffd34d : it.type === 'card' ? 0xffd76a : 0xffcf6a, 0.22);
        if (o.position.distanceTo(player.position) < 2.2) {
          it.taken = 0.25;
          if (it.type === 'card') {
            if (window.HPICards) HPICards.collect(it.id);
            HP.sfx.chime(); HP.sfx.sparkle();
            ctx.fx.burst(o.position, [0xffd76a, 0xffffff, 0xffe59a], 26, 6, 0.7);
          } else {
            ctx.inv[it.type]++; ctx.collected[it.type]++; ctx.onInvChange(it.type);
            HP.sfx.chime(); HP.sfx.sparkle();
            ctx.fx.burst(o.position, it.type === 'snitch' ? [0xffd34d, 0xffffff, 0xffef9a] : [0xffcf6a, 0xd59a5a, 0xfff0c0], 24, 6, 0.6);
            if (ctx.collected.snitch >= 6) ctx.award('snitch');
            if (ctx.collected.frog >= 6) ctx.award('frog');
          }
        }
      }
    }

    function npcUpdate(player, t, dt, camera) {
      let near = null, nd = 1e9;
      for (const n of npcs) {
        const c = n.chibi;
        const d = Math.hypot(player.position.x - n.pos[0], player.position.z - n.pos[1]);
        if (n.wave > 0) { n.wave -= dt; HP.animateChibi(c, dt, t, 1); }
        else { HP.animateChibi(c, dt, t, 0); if (d < 10) c.rotation.y = Math.atan2(player.position.x - n.pos[0], player.position.z - n.pos[1]); }
        if (d < nd) { nd = d; near = n; }
        if (!n.done && d < 4 && ctx.inv[n.type] >= n.need) { n.done = true; n.wave = 3; ctx.award(n.badge); HP.cheer(); ctx.fx.fireworks(new T.Vector3(n.pos[0], n.y + 4, n.pos[1]), 5, 4); }
      }
      // speech bubble over the nearest friend
      const b = ctx.bubble;
      if (near && nd < 8) {
        tmp.set(near.pos[0], near.y + 3.6, near.pos[1]); tmp.project(camera);
        if (tmp.z < 1) {
          b.style.left = (tmp.x * 0.5 + 0.5) * window.innerWidth + 'px';
          b.style.top = (-tmp.y * 0.5 + 0.5) * window.innerHeight + 'px';
          b.innerHTML = near.done ? 'תודה רבה! 🎉' : near.line;
          b.classList.add('on');
        } else b.classList.remove('on');
      } else b.classList.remove('on');
    }

    function update(player, t, dt, moving, speed, camera) {
      for (const fn of HPI.builders) fn(t, dt);
      light.update(player, t, dt);
      pickups(player, t, dt);
      npcUpdate(player, t, dt, camera);
      secretUpdate(player, t, dt);
      if (audio) audio.update(dt, moving, speed, player.position.distanceTo(firePos));
    }

    return {
      scene, spawns, light,
      spawn: L.spawn, exit: L.exit,
      floorH: (x, z) => HPI.nav.floorH(x, z),
      collide: (p, r) => HPI.nav.collide(p, r),
      update, items, npcs, teachers: HPI.teachers,
      secret: { x: -23, z: L.GH.z0, to: 'kitchens' },
    };
  };
})(window.HPI);
