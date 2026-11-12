/* The wand 🪄 — one big button that always does something lovely. A sparkling bolt flies
 * from the hero; if an enchantable thing is nearby (a suit of armour, a ghost, the floating
 * candles, the library books, a cauldron, a portrait, Peeves…) it reacts in its own silly
 * way. Each new kind of reaction is a "discovery" — find five for the 🪄 sticker. With no
 * target the spell is a little firework, so pressing the button is never a dud. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const KINDS = ['armour', 'ghost', 'candles', 'books', 'cauldron', 'portrait', 'peeves', 'friend', 'lake', 'hut', 'hoops', 'greenhouse', 'pip', 'feast', 'toad', 'pumpkins', 'hat', 'owl', 'chandelier', 'fire', 'globe', 'cup', 'pots', 'flock', 'clock', 'courtyard', 'telescope', 'wish', 'forest', 'potions', 'filch', 'norris', 'dumbledore'];
  const WIZARD = 10;
  // where each kind of magic hides — the map icon of its place (a tap on a ❔ in the spell book shows it)
  const WHERE = { armour: '🚪', ghost: '⏰', candles: '🍽️', books: '📚', cauldron: '⚗️', portrait: '🖼️', peeves: '🏰', friend: '🧒', lake: '🌊', hut: '🏠', hoops: '🧹', greenhouse: '🌿',
    pip: '🦉', feast: '🍽️', toad: '🐸', pumpkins: '🍽️', hat: '🚪', owl: '🍽️', chandelier: '🚪', fire: '🔥', globe: '📚', cup: '🏆', pots: '🍲', flock: '🦉', clock: '⏰', courtyard: '⛲', telescope: '🔭', wish: '✨', forest: '🌲', potions: '🛏️', filch: '🖼️', norris: '🖼️', dumbledore: '🧙' };
  const ICON = { armour: '🛡️', ghost: '👻', candles: '🕯️', books: '📚', cauldron: '🫧', portrait: '🖼️', peeves: '🤡', friend: '👋', lake: '⛲', hut: '🌈', hoops: '🔔', greenhouse: '🌸',
    pip: '💛', feast: '🍗', toad: '🐸', pumpkins: '🎃', hat: '🎩', owl: '🦉', chandelier: '🏮', fire: '🔥', globe: '🌍', cup: '🏆', pots: '🥘', flock: '🪶', clock: '🕰️', courtyard: '🎇', telescope: '🌠', wish: '💭', forest: '🧚', potions: '🧪', filch: '🏮', norris: '🐱', dumbledore: '🌟' };
  const NEED = 5;
  F.boot(function (g) {
    F.badge('wand', '🪄', 'קוסם');
    const st = F.store; st.magic = st.magic || [];

    const css = document.createElement('style');
    css.textContent = `#wandBtn{right:calc(22px + env(safe-area-inset-right));bottom:calc(138px + env(safe-area-inset-bottom));
      background:radial-gradient(circle at 50% 35%,rgba(255,190,90,.95),rgba(150,70,20,.85))}
      #wandBtn.cool{filter:saturate(.4) brightness(.8)}
      #wandBtn.try{animation:wandTry 1.1s ease-in-out infinite}
      @keyframes wandTry{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.4)}50%{box-shadow:0 0 0 8px rgba(255,215,106,.55),0 0 28px rgba(255,215,106,.9)}}`;
    document.head.appendChild(css);
    // ---- the spell book: a row in the 🎖️ sticker screen with every kind of magic found so far (❔ = still out there) ----
    css.textContent += `.spellRow{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin:12px 0 0}
      .spellRow span{width:30px;height:30px;font-size:21px;line-height:30px;text-align:center;border-radius:9px;background:rgba(20,12,50,.6)}
      .spellRow span.no{opacity:.35;filter:grayscale(1)} .spellRow span.no.hint{opacity:1;filter:none;transform:scale(1.35);background:rgba(255,215,106,.35)}
      .spellRow span{transition:transform .15s;touch-action:manipulation} .spellRow span.new{animation:spellNew .9s ease-out 3}
      @keyframes spellNew{0%{transform:scale(1)}40%{transform:scale(1.5)}100%{transform:scale(1)}}`;
    let spellRow = null;
    function renderSpells(fresh) {
      const panel = document.querySelector('#badges .bpanel'); if (!panel) return;
      if (!spellRow) { spellRow = document.createElement('div'); spellRow.className = 'spellRow'; panel.insertBefore(spellRow, panel.querySelector('#bclose')); }
      spellRow.innerHTML = '';
      KINDS.forEach((k) => { const has = st.magic.includes(k), c = document.createElement('span'); c.dataset.k = k; c.className = has ? (k === fresh ? 'new' : '') : 'no'; c.textContent = has ? ICON[k] : '❔'; spellRow.appendChild(c);
        // a hint for the ones still out there: tap ❔ and it flips to the map icon of the place to look
        if (!has) c.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (c.classList.contains('hint')) return; c.classList.add('hint'); c.textContent = WHERE[k]; F.sfx.squeak();
          setTimeout(() => { if (c.isConnected && c.classList.contains('hint')) { c.classList.remove('hint'); c.textContent = '❔'; } }, 2500); }); });
    }
    renderSpells();
    const btn = document.createElement('div'); btn.className = 'gamebtn'; btn.id = 'wandBtn'; btn.textContent = '🪄';
    document.body.appendChild(btn);
    if (!st.wandUsed) btn.classList.add('try');     // a gentle glow until the child has tried the wand once
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); cast(); });
    window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'e' || e.key === 'Enter') cast(); });

    // the flying bolt: one glow sprite per scene, re-used
    const bolts = {};
    function boltFor(world) {
      if (!bolts[world]) { const s = F.glow(0xfff0a0, 1.6, 0); s.userData.noCam = true; (world === 'inside' ? g.inside.scene : g.scene).add(s); bolts[world] = s; }
      return bolts[world];
    }
    let fly = null, cool = 0, duds = 0;
    const SILLY = [['🦆', ['🦆', '💦', '✨']], ['🦋', ['🦋', '🌸', '✨']], ['🫧', ['🫧', '🧼', '✨']], ['🍭', ['🍭', '🍬', '✨']]];
    const from = new T.Vector3(), to = new T.Vector3(), tmp = new T.Vector3();
    const extra = [];                       // modules may add live targets: fn(world) → [{id,obj|x,y,z,r,cast}]
    F.enchant = (fn) => extra.push(fn);

    function targets(world) {
      let list = [];
      if (world === 'inside') list = list.concat(HPI.enchantables);
      else list = list.concat(g.NPCS.map((n) => ({ id: 'friend', obj: n.chibi, r: 3, cast() { n.wave = 2.5; return '👋'; } })));
      if (world === 'inside') list = list.concat(g.inside.npcs.map((n) => ({ id: 'friend', obj: n.chibi, r: 3, cast() { n.wave = 2.5; return '👋'; } })));
      if (world === 'outside') list = list.concat(OUTDOOR);
      for (const fn of extra) list = list.concat(fn(world) || []);
      return list;
    }
    // ---- the grounds answer the wand too: the lake throws up a fountain, Hagrid's chimney
    //      puffs rainbow smoke, the Quidditch hoops ring like bells, the greenhouse blooms ----
    const V = (x, y, z) => new T.Vector3(x, y, z), gh = g.terrainH;
    function shower(x, y, z, cols, n, up) { for (let i = 0; i < n; i++) setTimeout(() => g.fx.burst(V(x + (Math.random() - 0.5) * 3, y + i * up, z + (Math.random() - 0.5) * 3), cols, 14, 6, 0.7, 1.4, -3), i * 110); }
    const OUTDOOR = [
      { id: 'lake', x: -62, y: 0.5, z: 6, r: 14, cast() { shower(-66, 1, 6, [0x74e6ff, 0xffffff, 0x9fd0ff], 9, 1.3); F.sfx.noise(1.2, 0.2, 0, 1800, 0.6); return '⛲'; } },
      { id: 'hut', x: 60, y: gh(60, 22) + 3, z: 22, r: 5, cast() { shower(62.2, gh(60, 22) + 8, 22, [0xff5a5a, 0xffd34d, 0x7cf07c, 0x7cf0ff, 0xc59bff], 8, 1.1); F.sfx.poof(); return '🌈'; } },
      { id: 'hoops', x: 64, y: gh(44, 66) + 8, z: 66, r: 6, cast() { F.sfx.tune([784, 988, 1175, 1568, 1175, 1568], 0.13, 'sine'); shower(64, gh(44, 66) + 11, 66, [0xffd34d, 0xffffff], 5, 0.4); return '🔔'; } },
      { id: 'hoops', x: 24, y: gh(44, 66) + 8, z: 66, r: 6, cast() { F.sfx.tune([784, 988, 1175, 1568, 1175, 1568], 0.13, 'sine'); shower(24, gh(44, 66) + 11, 66, [0xffd34d, 0xffffff], 5, 0.4); return '🔔'; } },
      // (overhead, so the target is "right above you" anywhere in the courtyard — but only while the candles are not already dancing, so friends there still get their wave)
      { id: 'courtyard', get x() { const p = g.player.position; return g.courtT <= 0 && Math.hypot(p.x, p.z + 42) < 20 ? p.x : 1e6; }, y: 5, get z() { return g.player.position.z; }, r: 3, cast() { g.courtyardDance(); F.sfx.tune([659, 784, 988, 1175, 988, 1175, 1319, 1568], 0.14, 'sine'); return '🎇'; } },
      { id: 'forest', x: -52, y: gh(-52, -58) + 2, z: -58, r: 7, cast() { for (let k = 0; k < 3; k++) shower(-56 + k * 4, gh(-52, -60) + 1.5, -61, [0x9effa0, 0xfff27a, 0xffffff], 7, 0.45); F.sfx.tune([1568, 2093, 1760, 2349, 2093, 2637], 0.12, 'sine'); try { HP.sfx.hoot(true); } catch (e) {} return '🧚'; } },
      { id: 'greenhouse', x: -34, y: gh(-34, -16) + 2, z: -16, r: 5, cast() { shower(-34, gh(-34, -16) + 3, -16, [0x8cff9e, 0xff9ad5, 0xffe08a], 7, 0.6); F.sfx.giggle(true); return '🌸'; } },
    ];
    function cast() {
      if (g.takeover) { if (g.started && !g.modal && g.takeover.action) g.takeover.action(); return false; }   // in a match the wand button throws the Quaffle
      if (!g.started || g.modal || cool > 0) return false;
      const p = g.player.position, world = g.world, f = g.facing;
      cool = 0.55; btn.classList.add('cool');
      if (!st.wandUsed) { st.wandUsed = true; F.save(); } btn.classList.remove('try');
      F.sfx.zap(); g.cheer(0.45);
      from.set(p.x + Math.sin(f) * 0.6, p.y + 2.1 * g.player.scale.y / 1.15, p.z + Math.cos(f) * 0.6);
      // nearest enchantable: anything within reach, preferring what the hero faces
      let best = null, bs = 1e9;
      for (const tg of targets(world)) {
        const tx = tg.obj ? tg.obj.position.x : tg.x, tz = tg.obj ? tg.obj.position.z : tg.z;
        const d = Math.hypot(tx - p.x, tz - p.z), reach = 9 + (tg.r || 2);
        if (tg.id === 'friend' && Math.abs(tg.obj.position.y - p.y) > 3) continue;      // not a friend on another floor
        if (d > reach) continue;
        const dot = d < 0.01 ? 1 : ((tx - p.x) * Math.sin(f) + (tz - p.z) * Math.cos(f)) / d;
        const score = d - dot * 4 - (tg.r > 8 ? -6 : 0) - (tg.pri || 0);      // big area effects (candles/books) lose to a close prop; `pri` lets a small living target (Trevor) win over furniture
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
          const n = st.magic.length; renderSpells(tg.id);
          F.toast(emoji, 'קסם חדש! ' + (n <= NEED ? n + '/' + NEED : n + ' ✨'));      // past the sticker the count keeps climbing
          if (n >= NEED) setTimeout(() => F.award('wand'), 900);
          // ten different things enchanted: a proper "real wizard" moment (once)
          // the whole spell book filled in: the grandest moment of all (once)
          if (!st.archmage && KINDS.every((k) => st.magic.includes(k))) {
            st.archmage = true; F.save();
            setTimeout(() => { F.toast('🧙📖', 'כָּל הַקְּסָמִים!', 3600); F.confetti(KINDS.map((k) => ICON[k]), 44); F.sfx.tada(); setTimeout(() => F.sfx.tada(), 700); g.cheer(4);
              for (let i = 0; i < 5; i++) setTimeout(() => g.fx.burst(to.clone().add(new T.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6)), [0xffd34d, 0xff9ad5, 0x9fd0ff, 0x8cff9e], 30, 8, 0.9, 1.3, -3), i * 260); }, 3200);
          }
          if (n >= WIZARD && !st.wizard) { st.wizard = true; F.save(); setTimeout(() => { F.toast('🪄🌟', 'קוֹסֵם אֲמִתִּי!', 3000); F.confetti(['🪄', '✨', '⭐', '🌟'], 30); F.sfx.tada(); g.cheer(3); }, 2300); }
        }
      } else if (++duds % 6 === 0) {
        // oops! every sixth cast with nothing to enchant goes hilariously wrong
        const [e, set] = SILLY[(duds / 6) % SILLY.length | 0];
        F.toast(e, 'אוּפְּס!', 1500); F.confetti(set, 22); F.sfx.squeak(); setTimeout(() => F.sfx.giggle(true), 300);
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
    F.mods.magic = { cast, kinds: KINDS, need: NEED, found: () => st.magic.slice(), wizard: () => !!st.wizard, archmage: () => !!st.archmage };
  });
})();
