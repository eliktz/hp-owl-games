/* Owl post! Once every real day, the first time you step into the Great Hall, Hedwig
 * swoops down the hall and drops a ribboned parcel. Walk into it and it bursts open:
 * treats, confetti and (the first time) a party hat. A reason to come back tomorrow. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const DROP = { x: -22, z: 22 };
  F.boot(function (g) {
    const st = F.store;
    F.badge('gift', '🎁', 'דֹּאַר יַנְשׁוּפִים');
    F.poi('gift', DROP.x, DROP.z);
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o || {}));
    const box = new T.Group(); box.userData.noCam = true; box.visible = false;
    const cols = [0xe8352e, 0x2e7de8, 0x2ecf6a, 0xb04de8];
    const wrap = M(cols[(Math.random() * 4) | 0]);
    const b = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 1.1), wrap); b.position.y = 0.45; box.add(b);
    const rib = M(0xffd23f, { metalness: 0.4, roughness: 0.35 });
    const r1 = new T.Mesh(new T.BoxGeometry(1.14, 0.94, 0.22), rib); r1.position.y = 0.45; box.add(r1);
    const r2 = new T.Mesh(new T.BoxGeometry(0.22, 0.94, 1.14), rib); r2.position.y = 0.45; box.add(r2);
    [-1, 1].forEach((s) => { const bow = new T.Mesh(new T.TorusGeometry(0.2, 0.07, 6, 12), rib); bow.position.set(s * 0.2, 1.05, 0); bow.rotation.y = Math.PI / 2; bow.rotation.x = s * 0.5; box.add(bow); });
    const glow = F.glow(0xffe08a, 4, 0.5); glow.position.y = 0.7; box.add(glow);
    box.traverse((m) => { if (m.isMesh) m.raycast = function () {}; });
    g.inside.scene.add(box);
    const owl = HP.makeOwl('hedwig'); owl.scale.setScalar(0.6); owl.visible = false; owl.userData.noCam = true;
    owl.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; m.raycast = function () {}; } });
    g.inside.scene.add(owl);
    let state = st.giftDay === F.today() ? 'done' : 'wait', fly = 0;
    const FLY = 3.4;
    function deliver() { if (state !== 'wait') return false; state = 'fly'; fly = 0; owl.visible = true; box.visible = true; try { HP.sfx.hoot(); } catch (e) {} return true; }
    function open() {
      if (state !== 'landed') return false;
      state = 'done'; st.giftDay = F.today(); st.gifts = (st.gifts || 0) + 1; F.save();
      box.visible = false; F.sfx.tada();
      g.give('snitch', 2); g.give('frog', 2);
      g.fx.fireworks(new T.Vector3(DROP.x, 4, DROP.z), 5, 5); F.confetti(['🎁', '🎉', '✨', '🍬', '⭐'], 26);
      F.toast('🎁', 'דֹּאַר יַנְשׁוּפִים! מָחָר יַגִּיעַ עוֹד 🦉', 2800); g.cheer(3);
      if (st.gifts === 1) setTimeout(() => { F.award('gift'); if (F.hats) F.hats.unlock('party'); }, 1200);
      return true;
    }
    if (F.petHint) F.petHint((world) => (world === 'inside' && state === 'landed' ? [box.position] : []));
    F.inside(function (dt, t, player) {
      if (state === 'done') return;
      const p = player.position;
      if (state === 'wait') { if (HPI.cull.current === 'GH') deliver(); return; }
      if (state === 'fly') {
        fly += dt; const k = Math.min(1, fly / FLY);
        // Hedwig glides in from the head of the hall, dips to drop the parcel, climbs away
        const ox = -52 + (DROP.x + 52) * Math.min(1, k * 1.6), oy = 12 - Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 7 + Math.max(0, k - 0.62) * 22;
        owl.position.set(k < 0.62 ? ox : DROP.x + (k - 0.62) * 40, oy, DROP.z + Math.sin(k * 6) * 1.5);
        owl.rotation.y = Math.PI / 2; HP.animateOwl(owl, dt, t, 1, 4);
        if (k < 0.62) box.position.set(owl.position.x, owl.position.y - 1.2, owl.position.z);
        else { const fk = Math.min(1, (k - 0.62) / 0.3); box.position.set(DROP.x, 5 * (1 - fk * fk), DROP.z); box.rotation.y = fk * 6; }
        if (k >= 1) { state = 'landed'; owl.visible = false; box.position.set(DROP.x, 0, DROP.z); F.sfx.boing(); g.fx.burst(box.position, [0xffe08a, 0xffffff], 18, 5, 0.6); }
        return;
      }
      // landed: wiggle invitingly until opened
      box.rotation.z = Math.sin(t * 9) * (Math.sin(t * 1.5) > 0.6 ? 0.12 : 0); box.position.y = Math.abs(Math.sin(t * 2.2)) * 0.18;
      glow.material.opacity = 0.4 + 0.2 * Math.sin(t * 4);
      if (F.dist(p, DROP.x, DROP.z) < 2) open();
    });
    F.mods.gift = { deliver, open, state: () => state, drop: DROP, reset() { state = 'wait'; st.giftDay = ''; } };
  });
})();
