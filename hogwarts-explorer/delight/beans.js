/* Every-flavour beans 🫘 — bowls of jelly beans around the castle. Eat one and… who knows!
 * A random flavour (yum or YUCK) and a random silly spell for a few seconds: grow giant,
 * shrink tiny, go bouncy, turn rainbow, zoom, hiccup bubbles or glitter. Pure giggles;
 * nothing can go wrong and it wears off by itself. Try three for the 🫘 sticker. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const BOWLS = [{ x: 17, z: -7, y: 0.82 }, { x: -40, z: 22, y: 1.25, stand: true }, { x: -26.5, z: -22.5, y: 1.25, stand: true }];
  const FLAVOURS = [['🍓', 'תּוּת!', 1], ['🍫', 'שׁוֹקוֹלָד!', 1], ['🍋', 'חָמוּץ!!', 0], ['🧦', 'גַּרְבַּיִם?! אִיכְס', 0], ['🌶️', 'חָרִיף!!!', 0], ['🧀', 'גְּבִינָה מַסְרִיחָה', 0],
    ['🍉', 'אֲבַטִּיחַ!', 1], ['🥦', 'בְּרוֹקוֹלִי...', 0], ['🍿', 'פּוֹפְּקוֹרְן!', 1], ['🐟', 'דָּג?! בְּלֶע', 0], ['🍭', 'סֻכָּרִיָּה!', 1], ['👃', 'אוֹי לֹא... נַזֶּלֶת', 0]];
  const EFFECTS = ['giant', 'tiny', 'bouncy', 'rainbow', 'zoom', 'hiccup', 'glitter'];
  const ICON = { giant: '🦒', tiny: '🐭', bouncy: '🐸', rainbow: '🌈', zoom: '⚡', hiccup: '🫧', glitter: '✨' };
  const DUR = 9;
  F.boot(function (g) {
    const st = F.store; st.beans = st.beans || 0;
    F.badge('beans', '🫘', 'סוכריות');
    const cols = [0xff5a6a, 0xffd23f, 0x4dd0ff, 0x7cf07c, 0xc58bff, 0xff9a3c, 0xffffff, 0x7a4a2a];
    const bowls = BOWLS.map((b) => {
      const fy = F.floor(b.x, b.z), G = new T.Group(); G.position.set(b.x, fy, b.z);
      if (b.stand) { const ped = F.mesh(new T.CylinderGeometry(0.28, 0.42, 1.2, 10), 0x4a3a5e, 0, 0.6, 0); G.add(ped); }
      const bowl = new T.Mesh(new T.SphereGeometry(0.62, 16, 10, 0, 6.3, Math.PI / 2, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.6, side: T.DoubleSide }));
      bowl.position.y = b.y + 0.62; G.add(bowl);
      const im = new T.InstancedMesh(new T.SphereGeometry(0.13, 8, 6), new T.MeshStandardMaterial({ roughness: 0.35 }), 16);
      const d = new T.Object3D(), c = new T.Color();
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.3, r = Math.random() * 0.4; d.position.set(Math.cos(a) * r, b.y + 0.3 + Math.random() * 0.32, Math.sin(a) * r); d.scale.set(1, 0.75, 1.3); d.rotation.set(Math.random() * 3, Math.random() * 3, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.setHex(cols[i % cols.length])); }
      G.add(im);
      const glow = F.glow(0xff9ad5, 2.6, 0.4); glow.position.y = b.y + 0.7; G.add(glow);
      const tag = F.emojiSprite('🫘', 0.9); tag.position.y = b.y + 1.6; G.add(tag);
      F.addInside(G); F.poi('beans', b.x, b.z + 1.5);
      return { b, glow, tag, armed: true, y: fy + b.y };
    });

    let fx = null, left = 0, last = null, hicT = 0, hopT = 0, trail = 0;
    const baseScale = g.player.scale.x, tint = new T.Color(), robeMats = [];
    g.playerMats.forEach((m) => { if (m.color && m.color.getHex() === 0x4536a8) robeMats.push(m); });
    function end() {
      if (!fx) return; fx = null; left = 0;
      g.tune.speed = 1; g.tune.jump = 1;
      robeMats.forEach((m) => { m.color.setHex(0x4536a8); m.emissive && m.emissive.setHex(0); });
      F.sfx.poof();
    }
    function eat(kind) {
      if (fx) end();
      const fl = FLAVOURS[(Math.random() * FLAVOURS.length) | 0];
      let pool = EFFECTS.filter((e) => e !== last);
      fx = kind || pool[(Math.random() * pool.length) | 0]; last = fx; left = DUR;
      F.sfx.munch(); setTimeout(() => (fl[2] ? F.sfx.giggle(true) : F.sfx.burp()), 380);
      F.toast(fl[0] + ICON[fx], fl[1], 1900);
      g.fx.burst(g.player.position.clone().setY(g.player.position.y + 2), [0xff9ad5, 0xffd23f, 0x4dd0ff, 0x7cf07c], 22, 5, 0.6);
      if (fx === 'tiny') g.tune.speed = 1.25; if (fx === 'giant') g.tune.speed = 0.9;
      if (fx === 'bouncy') g.tune.jump = 1.75; if (fx === 'zoom') g.tune.speed = 1.7;
      st.beans++; F.save(); if (st.beans === 3) setTimeout(() => F.award('beans'), 1200);
      F.lastBean = fx;
    }
    F.inside(function (dt, t, player) {
      const p = player.position;
      for (const bw of bowls) {
        const d = F.dist(p, bw.b.x, bw.b.z);
        bw.glow.material.opacity = 0.3 + 0.15 * Math.sin(t * 3 + bw.b.x); bw.tag.position.y = bw.b.y + 1.6 + Math.sin(t * 2 + bw.b.z) * 0.12;
        if (d > 3.2) bw.armed = true;
        if (d < 1.9 && bw.armed && Math.abs(p.y - (bw.y - bw.b.y)) < 2) { bw.armed = false; eat(); }
      }
    });
    F.always(function (dt, t, player) {
      const want = fx === 'giant' ? 1.75 : fx === 'tiny' ? 0.45 : 1;
      const s = player.scale.x / baseScale, ns = s + (want - s) * Math.min(1, dt * 6);
      if (Math.abs(ns - s) > 1e-4) player.scale.setScalar(baseScale * ns);
      if (!fx) return;
      left -= dt; const pp = player.position;
      if (fx === 'rainbow') robeMats.forEach((m) => m.color.setHSL((t * 0.6) % 1, 0.85, 0.55));
      if (fx === 'glitter') { robeMats.forEach((m) => m.emissive && m.emissive.setHSL(0.13, 1, 0.25 + 0.15 * Math.sin(t * 9))); if (Math.random() < 0.5) g.fx.trail(pp.clone().add(new T.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 3, (Math.random() - 0.5) * 1.4)), 0xffe08a, 0.45); }
      if (fx === 'zoom') { trail -= dt; if (trail <= 0) { trail = 0.04; g.fx.trail(pp.clone().setY(pp.y + 0.6), 0x7cf0ff, 0.5); } }
      if (fx === 'hiccup') { hicT -= dt; if (hicT <= 0) { hicT = 0.9 + Math.random() * 0.5; F.sfx.hic(); g.cheer(0.25); g.fx.burst(pp.clone().setY(pp.y + 2.6), [0xbfe8ff, 0xffffff, 0xff9ad5], 7, 1.6, 0.7, 1.6, 2.2); } }
      if (fx === 'bouncy') { hopT -= dt; if (hopT <= 0 && g.grounded) { hopT = 0.25; g.jump(); } }
      if (left <= 0) end();
    });
    F.mods.beans = { eat, end, bowls: BOWLS, current: () => fx, count: () => st.beans, effects: EFFECTS };
  });
})();
