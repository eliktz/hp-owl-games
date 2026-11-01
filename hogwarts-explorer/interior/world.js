/* Assembles the whole castle interior into its own THREE.Scene and runs its life:
 * builds every room, scatters collectibles, pops in a few NPC cameos with gentle
 * quests, and drives all per-frame animation (candles, portraits, stairs, books,
 * lights, dust, ambient audio). The host page just swaps to this scene on entry. */
(function (HPI) {
  const T = HPI.T, L = HPI.L;

  HPI.build = function (ctx) {
    HPI.nav.reset(); HPI.builders.length = 0;
    const scene = new T.Scene();
    scene.fog = new T.Fog(0x1a1626, 18, 96);
    const light = HPI.Lighting(scene, { pool: 5 });
    const audio = ctx.audio;

    HPI.buildEntranceHall(scene, light);
    HPI.buildGreatHall(scene, light);
    HPI.buildStairs(scene, light);
    HPI.buildCorridor(scene, light);
    HPI.buildLibrary(scene, light);
    HPI.buildCommonRoom(scene, light);

    const spawns = {
      entrance: { x: 0, z: 30, y: 0 },
      greatHall: { x: -30, z: 22, y: 0 },
      corridor: { x: 26, z: 20, y: 0 },
      library: { x: 55, z: 20, y: 0 },
      gallery: { x: 0, z: -4, y: L.UP },
      commonRoom: { x: 17, z: -6, y: L.UP },
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
    [[-20, 10], [-40, 30], [-30, 37], [-48, 7], [0, 20], [8, 28]].forEach((p) => drop('snitch', ...p));
    [[55, 10], [50, 34], [64, 24], [26, 20], [17, -9], [2, -4]].forEach((p) => drop('frog', ...p));

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

    // fire position for audio proximity (common-room hearth)
    const firePos = new T.Vector3(17, L.UP, L.CR.z0 + 0.7);
    const tmp = new T.Vector3();

    function pickups(player, t, dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i], o = it.o;
        if (it.taken) { o.position.lerp(player.position, dt * 8); o.scale.multiplyScalar(1 - dt * 5); it.taken -= dt; if (it.taken <= 0) { scene.remove(o); items.splice(i, 1); } continue; }
        if (it.type === 'snitch') { HP.animateSnitch(o, t); o.position.y = it.base.y + Math.sin(t * 1.6 + it.ph) * 0.4; o.rotation.y += dt * 0.6; }
        else { it.hop -= dt; if (it.hop <= 0 && Math.random() < 0.01) it.hop = 0.5; o.position.y = it.base.y + (it.hop > 0 ? Math.sin((it.hop / 0.5) * Math.PI) * 0.6 : 0); o.rotation.y = Math.sin(t * 0.6 + it.ph) * 0.5; }
        if (Math.random() < 0.06) ctx.fx.trail(o.position, it.type === 'snitch' ? 0xffd34d : 0xffcf6a, 0.22);
        if (o.position.distanceTo(player.position) < 2.2) {
          it.taken = 0.25; ctx.inv[it.type]++; ctx.collected[it.type]++; ctx.onInvChange(it.type);
          HP.sfx.chime(); HP.sfx.sparkle();
          ctx.fx.burst(o.position, it.type === 'snitch' ? [0xffd34d, 0xffffff, 0xffef9a] : [0xffcf6a, 0xd59a5a, 0xfff0c0], 24, 6, 0.6);
          if (ctx.collected.snitch >= 6) ctx.award('snitch');
          if (ctx.collected.frog >= 6) ctx.award('frog');
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
      if (audio) audio.update(dt, moving, speed, player.position.distanceTo(firePos));
    }

    return {
      scene, spawns, light,
      spawn: L.spawn, exit: L.exit,
      floorH: (x, z) => HPI.nav.floorH(x, z),
      collide: (p, r) => HPI.nav.collide(p, r),
      update, items, npcs,
    };
  };
})(window.HPI);
