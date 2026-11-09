/* Peeves the prankster — a cackling little poltergeist in a jester cap who pops out of
 * thin air every so often, pulls a face, blows a raspberry and dares you to catch him.
 * Chase him down (or zap him with the wand) and he yelps, spins like a top, drops a
 * shower of treats and vanishes in a puff. Miss him and he just razzes you and floats
 * off — he'll be back. First catch earns the 🤡 sticker and his jester cap. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const TAUNTS = ['לֹא תִּתְפֹּס אוֹתִי! 😜', 'בּוּ!! 👻', 'נָה נָה נָה 🎵', 'פְּרְרְרְ! 😝', 'מִי פֹּה? אֲנִי! 🤪'];
  F.boot(function (g) {
    const st = F.store; st.peeves = st.peeves || 0;
    F.badge('peeves', '🤡', 'פִּיבְס');
    // ---- build him (solid cartoon colours so he reads clearly against stone) ----
    const P = new T.Group(); P.userData.noCam = true; P.visible = false;
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
    const add = (geo, mat, x, y, z, par) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.raycast = function () {}; (par || P).add(m); return m; };
    const skin = M(0xdff3ff, { emissive: 0x4a6a8a, emissiveIntensity: 0.35 });
    const body = add(new T.ConeGeometry(0.62, 1.3, 14), M(0xff8a2a), 0, 0.2, 0); body.rotation.x = Math.PI;      // tapering ghosty tail
    add(new T.SphereGeometry(0.6, 16, 12), M(0xff8a2a), 0, 0.85, 0).scale.set(1, 0.7, 0.9);
    const head = new T.Group(); head.position.y = 1.55; P.add(head);
    add(new T.SphereGeometry(0.55, 18, 14), skin, 0, 0, 0, head);
    [-1, 1].forEach((s) => { add(new T.SphereGeometry(0.15, 10, 8), M(0xffffff), s * 0.2, 0.1, 0.45, head); add(new T.SphereGeometry(0.07, 8, 6), M(0x101018), s * 0.2 + 0.03, 0.1, 0.57, head); });
    const grin = add(new T.TorusGeometry(0.22, 0.045, 6, 14, Math.PI), M(0x7a1a2a), 0, -0.12, 0.47, head); grin.rotation.z = Math.PI;
    const tongue = add(new T.BoxGeometry(0.16, 0.26, 0.06), M(0xff6a9a), 0, -0.3, 0.52, head);
    const bow = add(new T.BoxGeometry(0.5, 0.2, 0.1), M(0x2e7de8), 0, 1.02, 0.42); bow.rotation.z = 0.1;
    [[-1, 0xe8352e], [1, 0x2ecf6a]].forEach(([s, c]) => { const h = new T.Group(); h.position.set(s * 0.2, 0.42, 0); h.rotation.z = -s * 0.8; head.add(h); add(new T.ConeGeometry(0.22, 0.75, 10), M(c), 0, 0.36, 0, h); add(new T.SphereGeometry(0.09, 8, 6), M(0xffd23f, { metalness: 0.6, roughness: 0.3 }), 0, 0.78, 0, h); });
    const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.55, 0.95, 0); P.add(a); add(new T.CylinderGeometry(0.09, 0.07, 0.6, 8), M(0xff8a2a), 0, -0.3, 0, a); add(new T.SphereGeometry(0.12, 8, 6), skin, 0, -0.62, 0, a); a.userData.s = s; return a; });
    const halo = F.glow(0x9fe8ff, 3.6, 0.35); halo.position.y = 1; P.add(halo);
    g.inside.scene.add(P);

    let state = 'gone', timer = 22, life = 0, spin = 0, pop = 0, razzT = 0, room = null;
    const pos = P.position, vel = new T.Vector3(), headPos = new T.Vector3();
    function spawn() {
      if (state !== 'gone' || g.world !== 'inside') return false;
      const p = g.player.position, f = g.facing;
      room = HPI.cull.byKey[HPI.cull.roomOf(p.x, p.z)] || null;   // the room the hero is really in right now
      let x = p.x + Math.sin(f) * 6, z = p.z + Math.cos(f) * 6;
      if (room) { x = HPI.clamp(x, room.r.x0 + 1.5, room.r.x1 - 1.5); z = HPI.clamp(z, room.r.z0 + 1.5, room.r.z1 - 1.5); }
      pos.set(x, F.floor(x, z) + 1.3, z); P.visible = true; P.scale.setScalar(0.01);
      state = 'taunt'; life = 24; pop = 0; razzT = 1.2;
      F.sfx.poof(); setTimeout(() => F.sfx.giggle(), 250);
      g.fx.burst(pos, [0xffffff, 0x9fe8ff, 0xff8a2a], 20, 5, 0.6);
      return true;
    }
    function caught() {
      if (state !== 'taunt') return false;
      state = 'caught'; spin = 1.5; F.sfx.yelp(); st.peeves++; F.save();
      F.say(headPos.clone(), 'אוֹי! תָּפַסְתָּ אוֹתִי! 😵', 1.6, 'peeves');
      const n = 2 + ((Math.random() * 2) | 0);
      g.give(Math.random() < 0.5 ? 'snitch' : 'frog', n);
      g.fx.fireworks(pos.clone().setY(pos.y + 1.5), 3, 3); F.confetti(['🤡', '✨', '🎉', '🍬'], 16);
      F.toast('🤡', 'תָּפַסְתָּ אֶת פִּיבְס!');
      if (st.peeves === 1) setTimeout(() => { F.award('peeves'); if (F.hats) F.hats.unlock('jester'); }, 1700);
      return true;
    }
    function leave() { state = 'gone'; P.visible = false; timer = 40 + Math.random() * 40; F.sfx.poof(); g.fx.burst(pos, [0xffffff, 0x9fe8ff], 16, 4, 0.6); }
    if (F.enchant) F.enchant((world) => (world === 'inside' && state === 'taunt' ? [{ id: 'peeves', obj: P, r: 4, cast() { caught(); return '🤡'; } }] : []));
    if (F.petHint) F.petHint((world) => (world === 'inside' && state === 'taunt' ? [pos] : []));

    F.inside(function (dt, t, player) {
      if (state === 'gone') { timer -= dt; if (timer <= 0) { if (!spawn()) timer = 5; } return; }
      const p = player.position;
      pop = Math.min(1, pop + dt * 4);
      headPos.set(pos.x, pos.y + 2.9, pos.z);
      // idle silliness: bob, waggle arms + tongue, wobble the cap
      arms.forEach((a) => { a.rotation.z = a.userData.s * (2.4 + Math.sin(t * 9 + a.userData.s) * 0.5); });
      tongue.scale.y = 1 + Math.sin(t * 14) * 0.35; head.rotation.z = Math.sin(t * 5) * 0.25;
      halo.material.opacity = 0.3 + 0.1 * Math.sin(t * 4);
      if (state === 'caught') {
        spin -= dt; P.rotation.y += dt * 22; P.scale.setScalar(Math.max(0.01, spin / 1.5)); pos.y += dt * 1.2;
        if (spin <= 0) leave();
        return;
      }
      P.scale.setScalar(pop * (1 + Math.sin(t * 6) * 0.04));
      life -= dt; razzT -= dt;
      if (razzT <= 0) { razzT = 4.5 + Math.random() * 3; F.say(headPos.clone(), TAUNTS[(Math.random() * TAUNTS.length) | 0], 2.2, 'peeves'); Math.random() < 0.5 ? F.sfx.raspberry() : F.sfx.giggle(); }
      // flee: drift away from the hero, a touch slower than a run so he CAN be caught,
      // and stay inside the room he appeared in (so the chase never leads into a wall)
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz) || 1;
      const flee = d < 9 ? 7.2 : 0, wob = Math.sin(t * 1.7) * 2.5;
      vel.x += ((dx / d) * flee - (dz / d) * wob - vel.x) * Math.min(1, dt * 4);
      vel.z += ((dz / d) * flee + (dx / d) * wob - vel.z) * Math.min(1, dt * 4);
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      if (room) {
        const r = room.r;
        if (pos.x < r.x0 + 1.4) { pos.x = r.x0 + 1.4; vel.x = Math.abs(vel.x); } if (pos.x > r.x1 - 1.4) { pos.x = r.x1 - 1.4; vel.x = -Math.abs(vel.x); }
        if (pos.z < r.z0 + 1.4) { pos.z = r.z0 + 1.4; vel.z = Math.abs(vel.z); } if (pos.z > r.z1 - 1.4) { pos.z = r.z1 - 1.4; vel.z = -Math.abs(vel.z); }
      }
      pos.y = F.floor(pos.x, pos.z) + 1.2 + Math.sin(t * 3) * 0.35;
      P.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);          // always pulling a face AT you
      if (d < 2.3) caught();
      else if (life <= 0 || d > 45) { F.say(headPos.clone(), 'בַּיי בַּיי! 😝', 1.4, 'peeves'); F.sfx.raspberry(); leave(); }
    });
    F.mods.peeves = { spawn, caught, state: () => state, pos, count: () => st.peeves, soon(s) { timer = s || 0.1; } };
  });
})();
