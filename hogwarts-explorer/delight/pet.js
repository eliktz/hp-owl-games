/* Pip the owlet — a tiny, excitable owl who is waiting on a perch in the Owlery. Walk up
 * and he adopts you (hearts!), then flutters at your shoulder for ever after, indoors and
 * out. He is also a gentle hint system: when something collectable or secret is nearby he
 * zips over to it, hovers and tweets, then comes back. He loops-the-loop when you win. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const PERCH = { x: 44, z: -52 };
  F.boot(function (g) {
    const st = F.store;
    F.badge('pet', '🦉', 'פִּיפּ');
    const owl = HP.makeOwl('pig'); owl.scale.setScalar(0.3); owl.userData.noCam = true;
    owl.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; m.raycast = function () {}; } });
    const fy = F.floor(PERCH.x, PERCH.z);
    // his perch: a little T-stand
    const stand = new T.Group(); stand.position.set(PERCH.x, fy, PERCH.z);
    const wood = new T.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
    const pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 1.9, 8), wood); pole.position.y = 0.95; stand.add(pole);
    const bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.1, 8), wood); bar.rotation.z = Math.PI / 2; bar.position.y = 1.9; stand.add(bar);
    const base = new T.Mesh(new T.CylinderGeometry(0.45, 0.55, 0.14, 12), wood); base.position.y = 0.07; stand.add(base);
    F.addInside(stand);
    F.poi('pet', PERCH.x, PERCH.z + 1.4);
    const perchPos = new T.Vector3(PERCH.x, fy + 2.25, PERCH.z);
    const pos = perchPos.clone(), want = new T.Vector3(), tmp = new T.Vector3();
    owl.position.copy(pos); g.inside.scene.add(owl);
    let hintT = 0, hintCd = 4, loopT = 0, lastScore = g.score, tweetT = 2, callT = 0;
    const hints = [];                         // other modules can offer hint points: fn(world) → Vector3[]
    F.petHint = (fn) => hints.push(fn);

    function adopt() {
      st.pet = true; F.save();
      F.sfx.heart(); try { HP.sfx.tweet(); } catch (e) {}
      F.toast('🦉💛', 'פִּיפּ בָּא אִתְּךָ!'); F.confetti(['💛', '🦉', '✨', '🪶'], 16);
      g.fx.burst(pos, [0xff9ad5, 0xffd34d, 0xffffff], 24, 5, 0.6);
      loopT = 1.2; setTimeout(() => F.award('pet'), 800);
    }
    F.always(function (dt, t, player, world) {
      const pp = player.position;
      if (!st.pet) {                                    // still waiting on the perch
        if (world !== 'inside') return;
        owl.position.copy(perchPos); owl.position.y += Math.abs(Math.sin(t * 3)) * 0.12;
        owl.rotation.y = Math.atan2(pp.x - PERCH.x, pp.z - PERCH.z);
        HP.animateOwl(owl, dt, t, 0.25, 2);
        const d = F.dist(pp, PERCH.x, PERCH.z);
        if (d < 12) { callT -= dt; if (callT <= 0) { callT = 3.5; try { HP.sfx.tweet(); } catch (e) {} F.say(tmp.copy(perchPos).setY(perchPos.y + 0.9).clone(), '🥺💛', 2, 'pet'); } }
        if (d < 2.3) adopt();
        return;
      }
      const sc = world === 'inside' ? g.inside.scene : g.scene;
      if (owl.parent !== sc) { sc.add(owl); pos.set(pp.x, pp.y + 3, pp.z); }
      // home spot: hovering just over the hero's right shoulder
      const f = g.facing, s = player.scale.y / 1.15;
      want.set(pp.x + Math.cos(f) * 1.25 - Math.sin(f) * 0.5, pp.y + 2.9 * s + Math.sin(t * 2.4) * 0.18, pp.z - Math.sin(f) * 1.25 - Math.cos(f) * 0.5);
      // hint: dart to a nearby treasure for a moment
      hintCd -= dt;
      if (hintT <= 0 && hintCd <= 0) {
        hintCd = 5 + Math.random() * 4;
        let best = null, bd = 16;
        const items = world === 'inside' ? g.inside.items : g.items;
        for (const it of items) { if (it.taken) continue; const d = it.o.position.distanceTo(pp); if (d > 4 && d < bd) { bd = d; best = it.o.position; } }
        for (const fn of hints) for (const v of (fn(world) || [])) { const d = v.distanceTo(pp); if (d > 3 && d < bd) { bd = d; best = v; } }
        if (best) { hintT = 2.4; owl.userData.hint = best; try { HP.sfx.tweet(); } catch (e) {} }
      }
      if (hintT > 0) {
        hintT -= dt; const h = owl.userData.hint;
        want.set(pp.x + (h.x - pp.x) * 0.55, Math.max(pp.y, h.y) + 2.6, pp.z + (h.z - pp.z) * 0.55);
      }
      if (g.score !== lastScore) { lastScore = g.score; loopT = 1.2; try { HP.sfx.tweet(); } catch (e) {} }
      const k = 1 - Math.exp(-dt * (hintT > 0 ? 3.2 : 5));
      tmp.copy(pos); pos.lerp(want, k);
      if (pos.distanceTo(pp) > 40) pos.copy(want);            // fast-travel: pop to the hero
      owl.position.copy(pos);
      if (loopT > 0) { loopT -= dt; const a = (1 - loopT / 1.2) * Math.PI * 2; owl.position.y += Math.sin(a) * 0.9; owl.rotation.z = a; } else owl.rotation.z = 0;
      const vx = pos.x - tmp.x, vz = pos.z - tmp.z;
      const yaw = Math.hypot(vx, vz) > 0.01 ? Math.atan2(vx, vz) : f;
      let dr = ((yaw - owl.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; owl.rotation.y += dr * Math.min(1, dt * 8);
      HP.animateOwl(owl, dt, t, 1, 5);
      tweetT -= dt; if (tweetT <= 0) { tweetT = 14 + Math.random() * 16; try { HP.sfx.tweet(); } catch (e) {} }
    });
    // the wand works on Pip too: a happy loop-the-loop and a chirp (so a cast is never a dud once he's with you)
    if (F.enchant) F.enchant(() => (st.pet ? [{ id: 'pip', obj: owl, r: 1, cast() { loopT = 1.2; F.sfx.heart(); try { HP.sfx.tweet(); } catch (e) {} return '💛'; } }] : []));
    F.mods.pet = { owl, perch: PERCH, has: () => !!st.pet, adopt, hinting: () => hintT > 0, looping: () => loopT > 0 };
  });
})();
