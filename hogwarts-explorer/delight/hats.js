/* Hats! Rewards you can WEAR. Each big discovery unlocks one (sorting → wizard hat in your
 * house colour, the mirror → crown, catching Peeves → jester cap, the owl-post parcel →
 * party hat, finding Trevor three times → Trevor rides on your head, lesson mastery → halo).
 * A new hat pops straight onto the hero's head; the wardrobe row in the 🎖️ sticker screen
 * lets the child swap between the ones they own. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const LIST = [
    { id: 'none', e: '🚫' }, { id: 'wizard', e: '🧙' }, { id: 'crown', e: '👑' }, { id: 'jester', e: '🃏' },
    { id: 'party', e: '🥳' }, { id: 'toad', e: '🐸' }, { id: 'halo', e: '😇' },
  ];
  const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
  const mk = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };
  const BUILD = {
    wizard(house) {
      const g = new T.Group(), col = house ? house.field : 0x4536a8, trim = house ? (house.key === 'huff' ? 0x2a2320 : house.trim) : 0xffd76a;
      const felt = M(col, { roughness: 0.95 }); felt.color.multiplyScalar(1.25);
      g.add(mk(new T.CylinderGeometry(0.86, 0.9, 0.07, 20), felt, 0, 0.5, 0));
      g.add(mk(new T.ConeGeometry(0.52, 1.25, 16), felt, 0, 1.14, 0));
      const band = mk(new T.TorusGeometry(0.5, 0.06, 6, 20), M(trim, { metalness: 0.3 }), 0, 0.56, 0); band.rotation.x = Math.PI / 2; g.add(band);
      const star = F.emojiSprite('⭐', 0.42); star.position.set(0, 1.0, 0.42); g.add(star);
      g.rotation.x = -0.12; return g;
    },
    crown() {
      const g = new T.Group(), gold = M(0xffcf40, { metalness: 0.7, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.5 });
      gold.side = T.DoubleSide; g.add(mk(new T.CylinderGeometry(0.46, 0.42, 0.24, 18, 1, true), gold, 0, 0.74, 0));
      const gems = [0xff3b4e, 0x4d8dff, 0x2fe08a, 0xff3b4e, 0x4d8dff, 0x2fe08a];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mk(new T.ConeGeometry(0.1, 0.3, 6), gold, Math.cos(a) * 0.44, 0.98, Math.sin(a) * 0.44)); g.add(mk(new T.SphereGeometry(0.06, 8, 6), M(gems[i], { emissive: gems[i], emissiveIntensity: 0.6 }), Math.cos(a) * 0.47, 0.74, Math.sin(a) * 0.47)); }
      const gl = F.glow(0xffe08a, 1.6, 0.35); gl.position.y = 0.9; g.add(gl); return g;
    },
    jester() {
      const g = new T.Group();
      g.add(mk(new T.CylinderGeometry(0.5, 0.56, 0.2, 16), M(0x6a2fb0), 0, 0.62, 0));
      [[-1, 0xe8352e], [1, 0x2e7de8]].forEach(([s, c]) => {
        const horn = new T.Group(); horn.position.set(s * 0.22, 0.7, 0); horn.rotation.z = -s * 0.75;
        horn.add(mk(new T.ConeGeometry(0.24, 0.85, 10), M(c), 0, 0.42, 0));
        horn.add(mk(new T.SphereGeometry(0.1, 10, 8), M(0xffd23f, { metalness: 0.6, roughness: 0.3 }), 0, 0.88, 0));
        horn.userData.s = s; g.add(horn);
      });
      g.userData.tick = (t) => { g.children.forEach((h) => { if (h.userData.s) h.rotation.z = -h.userData.s * (0.75 + Math.sin(t * 6 + h.userData.s) * 0.12); }); };
      return g;
    },
    party() {
      const g = new T.Group();
      const tex = HP.canvasTex(64, (c, s) => { ['#ff5a8a', '#ffd23f', '#4dd0ff', '#7cf07c'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * s / 4, s, s / 4); }); });
      g.add(mk(new T.ConeGeometry(0.34, 0.95, 14), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 1.08, 0));
      g.add(mk(new T.SphereGeometry(0.12, 10, 8), M(0xffffff), 0, 1.58, 0));
      g.rotation.z = 0.22; g.position.x = -0.1; return g;
    },
    toad() {
      const g = new T.Group(), gr = M(0x58b84a, { roughness: 0.55 });
      const b = mk(new T.SphereGeometry(0.3, 12, 10), gr, 0, 0.86, 0); b.scale.set(1.15, 0.8, 1.2); g.add(b);
      [-1, 1].forEach((s) => { g.add(mk(new T.SphereGeometry(0.11, 8, 8), M(0xfff6d8), s * 0.14, 1.08, 0.16)); g.add(mk(new T.SphereGeometry(0.055, 8, 6), M(0x1a1420), s * 0.14, 1.1, 0.25)); const leg = mk(new T.SphereGeometry(0.13, 8, 6), gr, s * 0.3, 0.72, -0.05); leg.scale.set(0.9, 0.5, 1.3); g.add(leg); });
      g.userData.tick = (t) => { const k = Math.max(0, Math.sin(t * 1.7)); b.scale.y = 0.8 + k * k * 0.12; g.position.y = (Math.sin(t * 1.7) > 0.96 ? 0.08 : 0); };
      return g;
    },
    halo() {
      const g = new T.Group();
      const ring = mk(new T.TorusGeometry(0.44, 0.06, 8, 24), new T.MeshBasicMaterial({ color: 0xfff0a0, fog: false }), 0, 1.15, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      const gl = F.glow(0xffe08a, 2, 0.5); gl.position.y = 1.15; g.add(gl);
      for (let i = 0; i < 3; i++) { const s = F.emojiSprite('⭐', 0.3); s.userData.i = i; g.add(s); }
      g.userData.tick = (t) => { ring.position.y = 1.15 + Math.sin(t * 2) * 0.05; g.children.forEach((c) => { if (c.userData.i != null) { const a = t * 1.6 + c.userData.i * 2.1; c.position.set(Math.cos(a) * 0.62, 1.15 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.62); } }); };
      return g;
    },
  };

  F.boot(function (g) {
    const st = F.store; st.hats = st.hats || []; st.hat = st.hat || 'none';
    const head = g.player.userData.head;
    let cur = null;
    function wear(id) {
      if (id !== 'none' && !st.hats.includes(id)) return false;
      if (cur) { head.remove(cur); cur.traverse((m) => { if (m.material) { const i = g.playerMats.indexOf(m.material); if (i >= 0) g.playerMats.splice(i, 1); } }); cur = null; }
      st.hat = id; F.save();
      if (id !== 'none' && BUILD[id]) {
        const house = window.HPI && HPI.HOUSES.find((h) => h.key === st.house);
        cur = BUILD[id](house); cur.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; m.raycast = function () {}; g.playerMats.push(m.material); } });
        head.add(cur);
      }
      render(); return true;
    }
    function unlock(id, quiet) {
      if (st.hats.includes(id)) { if (id === 'wizard' && st.hat === 'wizard') wear('wizard'); return false; }   // re-sorted → recolour
      st.hats.push(id); F.save(); wear(id);
      const h = LIST.find((x) => x.id === id);
      if (!quiet) setTimeout(() => { F.toast(h.e, 'כּוֹבַע חָדָשׁ!'); F.sfx.tada(); }, 2600);
      return true;
    }
    // ---- wardrobe row inside the sticker screen ----
    const css = document.createElement('style');
    css.textContent = `.hatRow{display:flex;gap:10px;justify-content:center;margin:14px 0 0;flex-wrap:wrap}
      .hatB{width:64px;height:64px;border-radius:18px;border:3px solid rgba(255,215,106,.4);background:rgba(20,12,50,.6);font-size:34px;
        display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;touch-action:manipulation;font-family:inherit}
      .hatB.lock{filter:grayscale(1) brightness(.5)} .hatB.on{border-color:#9effa0;background:rgba(80,160,100,.4);box-shadow:0 0 16px rgba(120,240,160,.6)}`;
    document.head.appendChild(css);
    let row = null;
    function render() {
      const panel = document.querySelector('#badges .bpanel'); if (!panel) return;
      if (!row) { row = document.createElement('div'); row.className = 'hatRow'; panel.insertBefore(row, panel.querySelector('#bclose')); }
      row.innerHTML = '';
      LIST.forEach((h) => {
        const own = h.id === 'none' || st.hats.includes(h.id);
        const b = document.createElement('button'); b.className = 'hatB' + (own ? '' : ' lock') + (st.hat === h.id ? ' on' : ''); b.dataset.hat = h.id;
        b.textContent = own ? h.e : '🔒';
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (own) { wear(h.id); try { HP.sfx.pop(); } catch (x) {} } else F.sfx.squeak(); });
        row.appendChild(b);
      });
    }
    render();
    if (st.hat !== 'none') wear(st.hat);
    F.always((dt, t) => { if (cur && cur.userData.tick) cur.userData.tick(t); });
    // the lesson halo: earned once every subject has at least two stars
    F.always(() => { if (!st.hats.includes('halo') && window.HPLessons && HPLessons.progress && HPLessons.LESSONS.every((l) => HPLessons.progress.stars(l.key) >= 2)) unlock('halo'); });
    F.hats = { wear, unlock, list: LIST, owned: () => st.hats.slice(), current: () => st.hat };
  });
})();
