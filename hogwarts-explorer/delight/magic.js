/* The wand 🪄 — one big button that always does something lovely. A sparkling bolt flies
 * from the hero; if an enchantable thing is nearby (a suit of armour, a ghost, the floating
 * candles, the library books, a cauldron, a portrait, Peeves…) it reacts in its own silly
 * way. Each new kind of reaction is a "discovery" — find five for the 🪄 sticker. With no
 * target the spell is a little firework, so pressing the button is never a dud. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const KINDS = ['armour', 'ghost', 'candles', 'books', 'cauldron', 'portrait', 'peeves', 'friend'];
  const NEED = 5;
  F.boot(function (g) {
    F.badge('wand', '🪄', 'קוסם');
    const st = F.store; st.magic = st.magic || [];

    const css = document.createElement('style');
    css.textContent = `#wandBtn{right:calc(22px + env(safe-area-inset-right));bottom:calc(138px + env(safe-area-inset-bottom));
      background:radial-gradient(circle at 50% 35%,rgba(255,190,90,.95),rgba(150,70,20,.85))}
      #wandBtn.cool{filter:saturate(.4) brightness(.8)}`;
    document.head.appendChild(css);
    const btn = document.createElement('div'); btn.className = 'gamebtn'; btn.id = 'wandBtn'; btn.textContent = '🪄';
    document.body.appendChild(btn);
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); cast(); });
    window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'e' || e.key === 'Enter') cast(); });

    // the flying bolt: one glow sprite per scene, re-used
    const bolts = {};
    function boltFor(world) {
      if (!bolts[world]) { const s = F.glow(0xfff0a0, 1.6, 0); s.userData.noCam = true; (world === 'inside' ? g.inside.scene : g.scene).add(s); bolts[world] = s; }
      return bolts[world];
    }
    let fly = null, cool = 0;
    const from = new T.Vector3(), to = new T.Vector3(), tmp = new T.Vector3();
    const extra = [];                       // modules may add live targets: fn(world) → [{id,obj|x,y,z,r,cast}]
    F.enchant = (fn) => extra.push(fn);

    function targets(world) {
      let list = [];
      if (world === 'inside') list = list.concat(HPI.enchantables);
      else list = list.concat(g.NPCS.map((n) => ({ id: 'friend', obj: n.chibi, r: 3, cast() { n.wave = 2.5; return '👋'; } })));
      if (world === 'inside') list = list.concat(g.inside.npcs.map((n) => ({ id: 'friend', obj: n.chibi, r: 3, cast() { n.wave = 2.5; return '👋'; } })));
      for (const fn of extra) list = list.concat(fn(world) || []);
      return list;
    }
    function cast() {
      if (g.takeover) { if (g.started && !g.modal && g.takeover.action) g.takeover.action(); return false; }   // in a match the wand button throws the Quaffle
      if (!g.started || g.modal || cool > 0) return false;
      const p = g.player.position, world = g.world, f = g.facing;
      cool = 0.55; btn.classList.add('cool');
      F.sfx.zap(); g.cheer(0.45);
      from.set(p.x + Math.sin(f) * 0.6, p.y + 2.1 * g.player.scale.y / 1.15, p.z + Math.cos(f) * 0.6);
      // nearest enchantable: anything within reach, preferring what the hero faces
      let best = null, bs = 1e9;
      for (const tg of targets(world)) {
        const tx = tg.obj ? tg.obj.position.x : tg.x, tz = tg.obj ? tg.obj.position.z : tg.z;
        const d = Math.hypot(tx - p.x, tz - p.z), reach = 9 + (tg.r || 2);
        if (d > reach) continue;
        const dot = d < 0.01 ? 1 : ((tx - p.x) * Math.sin(f) + (tz - p.z) * Math.cos(f)) / d;
        const score = d - dot * 4 - (tg.r > 8 ? -6 : 0);      // big area effects (candles/books) lose to a close prop
        if (score < bs) { bs = score; best = tg; }
      }
      if (best) to.set(best.obj ? best.obj.position.x : best.x, (best.obj ? best.obj.position.y : best.y) + 1.6, best.obj ? best.obj.position.z : best.z);
      else to.set(p.x + Math.sin(f) * 7, p.y + 4.5, p.z + Math.cos(f) * 7);
      fly = { t: 0, dur: Math.min(0.55, 0.18 + from.distanceTo(to) * 0.03), world, target: best };
      F.lastCast = { target: best ? best.id : null };
      return true;
    }
    function land() {
      const tg = fly.target;
      if (tg) {
        const emoji = tg.cast() || '✨';
        g.fx.burst(to, [0xfff0a0, 0xffffff, 0xff9ad5, 0x9fd0ff], 26, 6, 0.7);
        F.sfx.giggle(true); try { HP.sfx.sparkle(); } catch (e) {}
        if (KINDS.includes(tg.id) && !st.magic.includes(tg.id)) {
          st.magic.push(tg.id); F.save();
          F.toast(emoji, 'קסם חדש! ' + Math.min(st.magic.length, NEED) + '/' + NEED);
          if (st.magic.length >= NEED) setTimeout(() => F.award('wand'), 900);
        }
      } else {
        g.fx.burst(to, [[0xff5a5a, 0xffd34d], [0x7cf0ff, 0xffffff], [0xff9ad5, 0xc59bff], [0x8cff9e, 0xffff8a]][(Math.random() * 4) | 0], 34, 8, 0.8, 1.2, -3);
        try { HP.sfx.boom(); } catch (e) {}
      }
    }
    F.always(function (dt, t, player, world) {
      if (cool > 0) { cool -= dt; if (cool <= 0) btn.classList.remove('cool'); }
      for (const w in bolts) if (!fly || fly.world !== w) bolts[w].material.opacity = 0;
      if (!fly) return;
      if (fly.world !== world) { fly = null; return; }
      fly.t += dt; const k = Math.min(1, fly.t / fly.dur), b = boltFor(world);
      tmp.lerpVectors(from, to, k); tmp.y += Math.sin(k * Math.PI) * 0.8;
      b.position.copy(tmp); b.material.opacity = 0.95; b.scale.setScalar(1.3 + Math.sin(fly.t * 40) * 0.3);
      g.fx.trail(tmp, 0xfff0a0, 0.4);
      if (k >= 1) { land(); fly = null; b.material.opacity = 0; }
    });
    F.mods.magic = { cast, kinds: KINDS, need: NEED, found: () => st.magic.slice() };
  });
})();
