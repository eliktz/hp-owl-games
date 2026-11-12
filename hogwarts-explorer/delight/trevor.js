/* Trevor the runaway toad — hide-and-seek that never ends. Trevor is hiding in one of a
 * dozen nooks around the castle. You can HEAR him before you see him: his ribbit gets
 * louder as you get warmer, and a little "קְוָה!" pops up when you are close. Find him and
 * he does a happy flip, gives you a chocolate frog, then — poof — hops off to hide
 * somewhere new. First find: 🐸 sticker. Third find: Trevor rides on your head. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const SPOTS = [[10.5, 30], [-16, 5], [43.5, 36], [26, -12], [-37, -24], [-16, -3], [15.5, 13.5], [10, -18],
    [29, -42], [56, -16], [56, -34], [42, -12], [60.5, -16], [56, -56], [-12, -46]];
  F.boot(function (g) {
    const st = F.store; st.trevor = st.trevor || 0;
    F.badge('trevor', '🐸', 'טְרֶווֹר');
    SPOTS.forEach((s, i) => F.poi('trevor' + i, s[0], s[1]));
    const G = new T.Group(); G.userData.noCam = true;
    const gr = new T.MeshStandardMaterial({ color: 0x58b84a, roughness: 0.55, emissive: 0x143a10, emissiveIntensity: 0.5 });
    const mk = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.raycast = function () {}; G.add(o); return o; };
    const body = mk(new T.SphereGeometry(0.42, 14, 12), gr, 0, 0.36, 0); body.scale.set(1.15, 0.8, 1.2);
    const throat = mk(new T.SphereGeometry(0.2, 10, 8), new T.MeshStandardMaterial({ color: 0xd8e8a0, roughness: 0.6 }), 0, 0.26, 0.36);
    [-1, 1].forEach((s) => { mk(new T.SphereGeometry(0.15, 10, 8), new T.MeshStandardMaterial({ color: 0xfff6d8 }), s * 0.2, 0.66, 0.2); mk(new T.SphereGeometry(0.075, 8, 6), new T.MeshStandardMaterial({ color: 0x1a1420 }), s * 0.2, 0.69, 0.32); const leg = mk(new T.SphereGeometry(0.18, 8, 6), gr, s * 0.42, 0.14, -0.08); leg.scale.set(0.9, 0.5, 1.35); });
    const glow = F.glow(0x9effa0, 2.4, 0.35); glow.position.y = 0.5; G.add(glow);
    G.scale.setScalar(1.25); g.inside.scene.add(G);
    let idx = -1, ribT = 2, hop = 0, hopT = 3, found = 0, base = 0;
    const top = new T.Vector3();
    function hide(avoid) {
      let n; do { n = (Math.random() * SPOTS.length) | 0; } while (n === idx || (avoid && Math.hypot(SPOTS[n][0] - avoid.x, SPOTS[n][1] - avoid.z) < 30));
      idx = n; const s = SPOTS[n]; base = F.floor(s[0], s[1]);
      G.position.set(s[0], base, s[1]); G.rotation.set(0, Math.random() * 6.3, 0); G.visible = true; found = 0;
    }
    hide(HPI.L.spawn);
    function find() {
      if (found > 0) return false;
      found = 1.6; st.trevor++; F.save();
      F.sfx.ribbit(1.4); F.sfx.tada(); g.give('frog', 1); g.cheer(2);
      F.toast('🐸', st.trevor === 1 ? 'מָצָאתָ אֶת טְרֶווֹר!' : 'שׁוּב מָצָאתָ! ×' + st.trevor);
      F.confetti(['🐸', '💚', '✨', '🍀'], 16);
      g.fx.burst(G.position.clone().setY(base + 1), [0x9effa0, 0xffffff, 0xffe08a], 26, 6, 0.7);
      if (st.trevor === 1) setTimeout(() => F.award('trevor'), 1500);
      if (st.trevor === 3 && F.hats) F.hats.unlock('toad');
      return true;
    }
    if (F.petHint) F.petHint((world) => (world === 'inside' && found <= 0 && F.dist(g.player.position, G.position.x, G.position.z) < 13 ? [G.position] : []));
    // a wand cast when he is hiding nearby makes Trevor leap high with a loud ribbit — a playful
    // way to flush him out of his nook (as in the HD game)
    if (F.enchant) F.enchant((world) => (world === 'inside' && found <= 0 && F.dist(g.player.position, G.position.x, G.position.z) < 12
      ? [{ id: 'toad', obj: G, r: 1, pri: zapped > 0 ? 0 : 5, cast() { zapped = 8; hop = 0.9; leap = 2.2; F.sfx.ribbit(1.5); return '🐸'; } }] : []));
    let leap = 0.7, zapped = 0;      // zapped: for a few seconds after a leap he stops outranking the things around him, so the next cast can reach them
    F.inside(function (dt, t, player) {
      const p = player.position, d = F.dist(p, G.position.x, G.position.z);
      if (zapped > 0) zapped -= dt;
      throat.scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * 0.35);
      glow.material.opacity = 0.25 + 0.15 * Math.sin(t * 3);
      if (found > 0) {                              // caught: a victory flip, then off to a new nook
        found -= dt; const k = 1 - found / 1.6;
        G.position.y = base + Math.sin(k * Math.PI) * 2.4; G.rotation.x = k * Math.PI * 4;
        if (found <= 0) { F.sfx.poof(); g.fx.burst(G.position, [0xffffff, 0x9effa0], 14, 4, 0.6); G.rotation.x = 0; hide(p); }
        return;
      }
      hopT -= dt; if (hopT <= 0) { hopT = 2 + Math.random() * 3; hop = 0.45; }
      if (hop > 0) { hop -= dt; G.position.y = base + Math.sin(Math.max(0, Math.min(1, 1 - hop / (leap > 1 ? 0.9 : 0.45))) * Math.PI) * leap; if (hop <= 0) leap = 0.7; } else G.position.y = base;
      if (d < 18 && Math.abs(p.y - base) < 5) {
        ribT -= dt;
        if (ribT <= 0) {
          ribT = 1.6 + d * 0.12; F.sfx.ribbit(HPI.clamp(1.5 - d / 13, 0.12, 1.4));
          if (d < 10) F.say(top.set(G.position.x, base + 1.7, G.position.z).clone(), 'קְוָה! 🐸', 1.2, 'trevor');
        }
      }
      if (d < 1.9 && Math.abs(p.y - base) < 2.5) find();
    });
    F.mods.trevor = { find, hide, spots: SPOTS, where: () => ({ i: idx, x: G.position.x, z: G.position.z }), count: () => st.trevor };
  });
})();
