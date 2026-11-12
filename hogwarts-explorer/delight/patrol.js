/* Teachers on corridor duty — friendly company in the halls, never a chase.
 *
 *   • Filch the caretaker shuffles up and down the portrait corridor with his lantern, and
 *     Mrs Norris the cat pads along behind him.
 *   • Professor Dumbledore strolls the long north corridor.
 *
 * Walk near one and they stop, turn to you, wave and say a few words (Filch grumbles "no
 * running!" in a friendly way; Dumbledore offers a lemon drop). A wand cast makes each react
 * in their own silly way — Filch sneezes bubbles and his lantern goes rainbow, Mrs Norris
 * chases her tail, Dumbledore chuckles and conjures a shower of stars. Nothing can go wrong:
 * there is no catching, no telling-off screen, no game over.
 *
 * They are drawn only while their corridor is visible (room culling), cost a handful of draw
 * calls each, and tests can park them with HPI.patrol.hold(true). */
(function () {
  const F = window.HPFun, T = window.THREE;
  F.boot(function (g) {
    const HPI = window.HPI; if (!HPI || !g.inside) return;
    const scene = g.inside.scene, L = HPI.L;
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));
    const mk = (par, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); par.add(m); return m; };
    const cz = (L.COR.z0 + L.COR.z1) / 2, nx = (L.NCOR.x0 + L.NCOR.x1) / 2;

    function walker(who, route, opt) {
      const c = HP.makeChibi(who); c.scale.setScalar(opt.scale || 1.25); c.userData.cullSkip = true;
      c.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
      c.position.set(route[0][0], F.floor(route[0][0], route[0][1]), route[0][1]); scene.add(c);
      return Object.assign({ who, c, route, i: 1, pause: 0, stop: 0, wave: 0, cool: 0, hop: 0, spin: 0, ph: Math.random() * 7, speed: 2.1, greets: 0, zaps: 0, home: route[0] }, opt);
    }
    // Filch: the portrait corridor, end to end, with a peek round the corner into the north corridor
    const filch = walker('filch', [[L.COR.x0 + 2.5, cz], [nx, cz], [nx, L.NCOR.z1 - 5], [nx, cz]], { id: 'filch', speed: 1.9, lines: ['🏮 לֹא לָרוּץ בַּמִּסְדְּרוֹן!', '🏮 מִי שָׁם? אָה, זֶה אַתָּה…', '🧹 רַק נִקִּיתִי כָּאן!'] });
    const lamp = new T.Group(); lamp.position.set(0.98, 1.05, 0.3);
    mk(lamp, new T.CylinderGeometry(0.02, 0.02, 0.35, 5), M(0x2a2a2e), 0, 0.3, 0);
    const lampGlass = mk(lamp, new T.BoxGeometry(0.26, 0.34, 0.26), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffa02a, emissiveIntensity: 0.75, roughness: 0.4 }), 0, 0, 0);
    const lampGlow = F.glow(0xffc86a, 2.6, 0.55); lamp.add(lampGlow); filch.c.add(lamp);
    // Mrs Norris: a small grey cat a couple of steps behind him
    const cat = new T.Group(); cat.userData.cullSkip = true;
    const fur = M(0x8a8690), furD = M(0x5e5a66);
    mk(cat, new T.SphereGeometry(0.34, 12, 10), fur, 0, 0.42, 0).scale.set(0.8, 0.75, 1.5);
    const catHead = mk(cat, new T.SphereGeometry(0.26, 12, 10), fur, 0, 0.72, 0.5);
    [-1, 1].forEach((s) => { mk(cat, new T.ConeGeometry(0.09, 0.2, 5), furD, s * 0.14, 0.98, 0.5); mk(cat, new T.SphereGeometry(0.045, 6, 5), new T.MeshBasicMaterial({ color: 0xffd23a }), s * 0.1, 0.76, 0.73); });
    [[-0.16, 0.3], [0.16, 0.3], [-0.16, -0.3], [0.16, -0.3]].forEach(([x, z]) => mk(cat, new T.CylinderGeometry(0.06, 0.06, 0.3, 6), furD, x, 0.15, z));
    const tail = mk(cat, new T.CylinderGeometry(0.045, 0.06, 0.7, 6), furD, 0, 0.75, -0.6); tail.rotation.x = -0.5;
    cat.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
    cat.position.copy(filch.c.position); scene.add(cat);
    const norris = { c: cat, spin: 0, cool: 0, zaps: 0 };
    // Dumbledore: the long north corridor
    const dumb = walker('dumbledore', [[nx, L.NCOR.z0 + 4], [nx, L.NCOR.z1 - 9]], { id: 'dumbledore', speed: 2.2, scale: 1.4, lines: ['🍋 סֻכָּרִיַּת לִימוֹן?', '🌟 שָׁלוֹם, קוֹסֵם צָעִיר!', '✨ אֵיזֶה יוֹם קָסוּם!'] });
    const walkers = [filch, dumb];

    let held = false;
    const tmp = new T.Vector3();
    const roomOn = (x, z) => { const cu = HPI.cull; if (!cu || !cu.byKey) return true; const k = z >= L.COR.z0 && x < L.NCOR.x0 ? 'COR' : (z >= L.NCOR.z1 ? 'COR' : 'NCOR'); return !cu.byKey[k] || cu.byKey[k].on; };

    function react(w, p) {                                           // you walked up: stop, turn, wave, a few words
      w.stop = 2.6; w.wave = 2.2; w.cool = 14; w.greets++;
      const line = w.lines[(w.greets - 1) % w.lines.length];
      F.say(tmp.set(w.c.position.x, w.c.position.y + 4.2, w.c.position.z).clone(), line, 2.6, 'patrol-' + w.id);
      if (w === filch) { F.sfx.tone(180, 0.18, 'sawtooth', 0.08, 0, 140); F.sfx.tone(150, 0.22, 'sawtooth', 0.08, 0.2, 120); }
      else { F.sfx.tune([784, 988, 1175], 0.12, 'sine'); g.fx.burst(tmp.set(w.c.position.x, w.c.position.y + 3, w.c.position.z), [0xfff2b0, 0xffffff, 0xc59bff], 14, 4, 0.6); }
    }
    function zap(w) {                                                // a wand cast: each has their own silly reaction
      w.stop = 2.8; w.hop = 1.4; w.zaps++; w.cool = Math.max(w.cool, 6);
      const top = tmp.set(w.c.position.x, w.c.position.y + 4.2, w.c.position.z).clone();
      if (w === filch) { w.rainbow = 3.2; F.say(top, '🫧 אַפְּצִ׳י!', 2.2, 'patrol-filch'); F.sfx.burp(); F.confetti(['🫧', '🫧', '✨'], 12); return '🏮'; }
      F.say(top, '😄 הוֹ הוֹ הוֹ!', 2.2, 'patrol-dumbledore'); F.sfx.tune([1047, 1319, 1568, 2093, 1568, 2093], 0.1, 'sine');
      for (let i = 0; i < 5; i++) setTimeout(() => g.fx.burst(new T.Vector3(w.c.position.x + (Math.random() - 0.5) * 4, w.c.position.y + 4 + Math.random() * 2, w.c.position.z + (Math.random() - 0.5) * 4), [0xfff27a, 0xffffff, 0x9fd0ff], 16, 5, 0.8, 1.2, -2), i * 160);
      return '🌟';
    }
    function zapCat() { norris.spin = 2; norris.zaps++; F.say(tmp.set(cat.position.x, cat.position.y + 2, cat.position.z).clone(), '🐱 מְיָאוּ!', 1.8, 'patrol-norris'); try { F.sfx.squeak(); } catch (e) {} return '🐱'; }

    if (F.enchant) F.enchant((world) => {
      if (world !== 'inside') return [];
      const p = g.player.position, out = [];
      for (const w of walkers) if (w.c.visible && Math.abs(w.c.position.y - p.y) < 3 && F.dist(p, w.c.position.x, w.c.position.z) < 6) out.push({ id: w.id, obj: w.c, r: 2, cast: () => zap(w) });
      if (cat.visible && Math.abs(cat.position.y - p.y) < 3 && F.dist(p, cat.position.x, cat.position.z) < 4) out.push({ id: 'norris', obj: cat, r: 1, cast: zapCat });
      return out;
    });

    F.inside(function (dt, t, player) {
      const p = player.position;
      for (const w of walkers) {
        const c = w.c, pos = c.position;
        c.visible = roomOn(pos.x, pos.z);
        if (w.cool > 0) w.cool -= dt;
        const d = F.dist(p, pos.x, pos.z), sameFloor = Math.abs(pos.y - p.y) < 3;
        if (!held && !g.modal && sameFloor && d < 4 && w.cool <= 0 && w.stop <= 0) react(w, p);
        let moving = false;
        if (w.stop > 0) {                                            // stopped to greet you (or sneezing): face the child
          w.stop -= dt;
          if (sameFloor && d < 12) { const a = Math.atan2(p.x - pos.x, p.z - pos.z); let dy = ((a - c.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; c.rotation.y += dy * Math.min(1, dt * 6); }
        } else if (w.pause > 0) w.pause -= dt;
        else if (!held) {
          const tg = w.route[w.i], dx = tg[0] - pos.x, dz = tg[1] - pos.z, dl = Math.hypot(dx, dz);
          if (dl < 0.15) { w.i = (w.i + 1) % w.route.length; w.pause = 1.2 + Math.random() * 1.5; }
          else {
            const st = Math.min(dl, w.speed * dt); pos.x += dx / dl * st; pos.z += dz / dl * st; moving = true;
            const a = Math.atan2(dx, dz); let dy = ((a - c.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; c.rotation.y += dy * Math.min(1, dt * 5);
          }
        }
        if (w.wave > 0) w.wave -= dt;
        if (w.hop > 0) w.hop -= dt;
        if (!c.visible) continue;
        HP.animateChibi(c, dt, t + w.ph, w.wave > 0 || w.hop > 0 ? 1 : 0);
        // a walking gait for a robed chibi: a little bob and sway in step
        const stride = moving ? Math.sin(t * 7 + w.ph) : 0;
        pos.y = F.floor(pos.x, pos.z) + (moving ? Math.abs(stride) * 0.09 : 0) + (w.hop > 0 ? Math.abs(Math.sin(w.hop * 9)) * 0.5 : 0);
        c.rotation.z = stride * 0.045;
      }
      // Filch's lantern: a warm flicker, rainbow for a moment after a zap
      if (filch.rainbow > 0) { filch.rainbow -= dt; lampGlass.material.emissive.setHSL((t * 0.9) % 1, 1, 0.55); lampGlow.material.color.copy(lampGlass.material.emissive); if (filch.rainbow <= 0) { lampGlass.material.emissive.setHex(0xffa02a); lampGlow.material.color.setHex(0xffc86a); } }
      lampGlow.material.opacity = 0.45 + 0.12 * Math.sin(t * 9); lamp.rotation.z = Math.sin(t * 2.4) * 0.12;
      // Mrs Norris pads along a couple of steps behind Filch
      const fc = filch.c, bx = fc.position.x - Math.sin(fc.rotation.y) * 1.7, bz = fc.position.z - Math.cos(fc.rotation.y) * 1.7;
      const cdx = bx - cat.position.x, cdz = bz - cat.position.z, cd = Math.hypot(cdx, cdz);
      cat.visible = fc.visible;
      if (norris.cool > 0) norris.cool -= dt;
      if (norris.spin > 0) { norris.spin -= dt; cat.rotation.y += dt * 11; }
      else if (cd > 0.25) { const st = Math.min(cd, (cd > 3 ? 4.5 : 2.2) * dt); cat.position.x += cdx / cd * st; cat.position.z += cdz / cd * st; cat.rotation.y = Math.atan2(cdx, cdz); }
      const trot = cd > 0.25 && norris.spin <= 0;
      cat.position.y = F.floor(cat.position.x, cat.position.z) + (trot ? Math.abs(Math.sin(t * 11)) * 0.05 : 0);
      tail.rotation.z = Math.sin(t * 3) * 0.35; catHead.rotation.z = Math.sin(t * 1.3) * 0.1;
      if (!held && !g.modal && norris.cool <= 0 && norris.spin <= 0 && Math.abs(cat.position.y - p.y) < 3 && F.dist(p, cat.position.x, cat.position.z) < 2.6) {
        norris.cool = 12; F.say(tmp.set(cat.position.x, cat.position.y + 2, cat.position.z).clone(), '🐱 פְּרְרְר…', 1.8, 'patrol-norris'); try { F.sfx.heart(); } catch (e) {}
      }
    });

    HPI.patrol = {
      walkers: walkers.map((w) => ({ id: w.id, who: w.who })),
      // tests: park everyone at their start point (far from the spots other checks cast from) or let them walk again
      hold(on) { held = on !== false; if (held) for (const w of walkers) { w.c.position.set(w.home[0], F.floor(w.home[0], w.home[1]), w.home[1]); w.i = 1; w.stop = 0; w.pause = 0; w.cool = 0; } },
      state: () => ({ held, cat: { x: cat.position.x, z: cat.position.z, spin: norris.spin > 0, zaps: norris.zaps, visible: cat.visible },
        list: walkers.map((w) => ({ id: w.id, x: w.c.position.x, y: w.c.position.y, z: w.c.position.z, visible: w.c.visible, stopped: w.stop > 0, waving: w.wave > 0, greets: w.greets, zaps: w.zaps, leg: w.i })) }),
      _put(id, x, z) { const w = walkers.find((q) => q.id === id); if (w) { w.c.position.set(x, F.floor(x, z), z); w.stop = 0; w.pause = 0; w.cool = 0; } },
      route: (id) => (walkers.find((q) => q.id === id) || {}).route,
    };
  });
})();
