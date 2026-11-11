/* The Sorting Hat + the four house hourglasses.
 * A grumbly old hat sits on a stool in the Entrance Hall. Walk up and tap 🎩: it asks where
 * your heart is, you pick a crest, it hums and haws (drum-roll), then SHOUTS your house —
 * confetti, fanfare, and from then on your robe wears the house colours and every lesson's
 * house points pour into your house's giant hourglass by the stairs (the other three keep
 * up a friendly race). The child can re-sort any time: it's their story. */
(function () {
  const F = window.HPFun, T = window.THREE;
  const NAMES = { gryf: 'גְּרִיפִינְדּוֹר', slyt: 'סְלִיתֶ׳רִין', rave: 'רֵייבֶנְקְלוֹ', huff: 'הַפְלְפַּאף' };
  const GEM = { gryf: 0xff3b4e, slyt: 0x2fe08a, rave: 0x4d8dff, huff: 0xffd23f };
  const HAT = { x: -9.5, z: 17 };
  const QUIPS = ['הממ... מעניין!', 'אני רואה אומץ...', 'ראש מלא רעיונות!', 'לב טוב. קשה, קשה...'];

  F.boot(function (g) {
    const HOUSES = HPI.HOUSES, st = F.store;
    F.badge('sorted', '🎩', 'מיון');
    const points = () => (window.HPLessons && HPLessons.progress ? HPLessons.progress.points() : 0);
    // the other houses keep pace so the race always feels alive (deterministic, no clock)
    function housePts(key) {
      const mine = points(), i = HOUSES.findIndex((h) => h.key === key);
      if (st.house === key) return mine;
      return Math.round(mine * [0.82, 0.9, 0.7, 0.76][i] + [25, 15, 35, 20][i]);
    }

    // ---------------- the hat on its stool ----------------
    const fy = F.floor(HAT.x, HAT.z);
    const grp = new T.Group(); grp.position.set(HAT.x, fy, HAT.z);
    const wood = new T.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85 });
    const seat = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.16, 14), wood); seat.position.y = 1.15; grp.add(seat);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, leg = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 1.15, 6), wood); leg.position.set(Math.cos(a) * 0.5, 0.57, Math.sin(a) * 0.5); leg.rotation.z = Math.cos(a) * 0.14; leg.rotation.x = -Math.sin(a) * 0.14; grp.add(leg); }
    const hat = new T.Group(); hat.position.y = 1.24; grp.add(hat);
    const felt = new T.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
    const brim = new T.Mesh(new T.CylinderGeometry(1.0, 1.08, 0.12, 18), felt); brim.position.y = 0.06; hat.add(brim);
    const low = new T.Mesh(new T.CylinderGeometry(0.5, 0.72, 0.8, 14), felt); low.position.y = 0.5; hat.add(low);
    const tipG = new T.Group(); tipG.position.y = 0.9; hat.add(tipG);       // the floppy point bends on its own pivot
    const mid = new T.Mesh(new T.CylinderGeometry(0.26, 0.5, 0.7, 12), felt); mid.position.y = 0.3; tipG.add(mid);
    const tip2 = new T.Group(); tip2.position.y = 0.62; tip2.rotation.z = 0.7; tipG.add(tip2);
    const tip = new T.Mesh(new T.ConeGeometry(0.26, 0.8, 10), felt); tip.position.y = 0.36; tip2.add(tip);
    // a face in the folds: two dark eye creases + a mouth flap that opens when it talks
    const dark = new T.MeshBasicMaterial({ color: 0x1c1108 });
    [-1, 1].forEach((s) => { const e = new T.Mesh(new T.BoxGeometry(0.26, 0.09, 0.06), dark); e.position.set(s * 0.24, 0.72, 0.56); e.rotation.z = s * -0.35; hat.add(e); });
    const mouth = new T.Mesh(new T.BoxGeometry(0.5, 0.1, 0.06), dark); mouth.position.set(0, 0.38, 0.68); hat.add(mouth);
    const halo = F.glow(0xffd98a, 4.2, 0.35); halo.position.y = 2; grp.add(halo);
    F.addInside(grp);
    if (HPI.light) HPI.light.blobShadow(g.inside.scene, HAT.x, fy, HAT.z, 1.3);
    F.poi('sortingHat', HAT.x, HAT.z + 1.8);
    const headPos = new T.Vector3(HAT.x, fy + 3.6, HAT.z);
    let talkT = 0, quipT = 3;

    // ---------------- the four hourglasses by the grand stair ----------------
    const glasses = {};
    function numTex(n, crest) {
      return HP.canvasTex(128, (c, s) => {
        c.clearRect(0, 0, s, s); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '54px serif'; c.fillText(crest, s / 2, 34);
        c.font = 'bold 44px Rubik,sans-serif'; c.lineWidth = 8; c.strokeStyle = '#1a0f33'; c.strokeText(n, s / 2, 92); c.fillStyle = '#ffe9a8'; c.fillText(n, s / 2, 92);
      });
    }
    [-11, -8.2, 8.2, 11].forEach((x, i) => {
      const h = HOUSES[i], z = HPI.L.EH.z0 + 1.15, G = new T.Group(); G.position.set(x, 0, z);
      const brass = new T.MeshStandardMaterial({ color: 0xb8902a, metalness: 0.6, roughness: 0.4 });
      [0.12, 4.9].forEach((y) => { const d = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 0.24, 16), brass); d.position.y = y; G.add(d); });
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5, p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 4.8, 6), brass); p.position.set(Math.cos(a) * 0.74, 2.5, Math.sin(a) * 0.74); G.add(p); }
      const glassM = new T.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false });
      const lower = new T.Mesh(new T.CylinderGeometry(0.16, 0.62, 2.2, 14, 1, true), glassM); lower.position.y = 1.35; G.add(lower);
      const upper = new T.Mesh(new T.CylinderGeometry(0.62, 0.16, 2.2, 14, 1, true), glassM); upper.position.y = 3.65; G.add(upper);
      const gemM = new T.MeshStandardMaterial({ color: GEM[h.key], emissive: GEM[h.key], emissiveIntensity: 0.75, roughness: 0.3 });
      const pile = new T.Mesh(new T.CylinderGeometry(0.3, 0.58, 1, 12), gemM); pile.position.y = 0.3; G.add(pile);     // scaled in y = points
      const store2 = new T.Mesh(new T.CylinderGeometry(0.58, 0.2, 0.9, 12), gemM); store2.position.y = 4.2; G.add(store2);
      const glow = F.glow(GEM[h.key], 3.4, 0.3); glow.position.y = 1.3; G.add(glow);
      const label = new T.Sprite(new T.SpriteMaterial({ map: numTex(0, h.crest), transparent: true, depthWrite: false, fog: false }));
      label.scale.setScalar(1.7); label.position.y = 6.1; G.add(label);
      F.addInside(G);
      if (HPI.light && HPI.light.addPool) HPI.light.addPool(x, z + 1, 2.6, GEM[h.key], 0.3);
      glasses[h.key] = { G, pile, glow, label, shown: -1, target: 0, crest: h.crest, x, z };
    });
    F.poi('hourglass', 8.2, HPI.L.EH.z0 + 3);
    function setShown(gl, v) {
      gl.shown = v; const k = Math.min(1, v / 400);            // 400 points fills the glass
      gl.pile.scale.y = 0.15 + k * 1.9; gl.pile.position.y = 0.26 + gl.pile.scale.y * 0.5;
      const m = gl.label.material; if (m.map) m.map.dispose(); m.map = numTex(Math.round(v), gl.crest); m.needsUpdate = true;
    }
    let gemT = 0;
    function tickGlasses(dt, t, p) {
      const near = F.dist(p, 0, 6) < 22;
      for (const k in glasses) {
        const gl = glasses[k]; gl.target = housePts(k);
        if (gl.shown < 0) setShown(gl, gl.target);
        else if (gl.shown !== gl.target && near) {
          // gems tumble in while you watch — a visible payoff for the lessons you just did
          const step = Math.max(1, Math.abs(gl.target - gl.shown) * dt * 1.4);
          setShown(gl, gl.shown < gl.target ? Math.min(gl.target, gl.shown + step) : Math.max(gl.target, gl.shown - step));
          gemT -= dt;
          if (gemT <= 0 && k === st.house) { gemT = 0.09; F.sfx.tink((gl.shown / 12) % 8); g.fx.trail(new T.Vector3(gl.x, 2.4, gl.z), GEM[k], 0.5); }
        }
        gl.glow.material.opacity = (k === st.house ? 0.5 : 0.22) + 0.1 * Math.sin(t * 2 + gl.x);
      }
      // standing by the hourglasses when YOUR house is in the lead: a little house-cup moment (once a day)
      if (near && st.house && glasses[st.house].shown === glasses[st.house].target && st.cupDay !== F.today()) {
        const mine = housePts(st.house), lead = HOUSES.every((h) => h.key === st.house || housePts(h.key) < mine);
        if (lead && mine > 0) {
          st.cupDay = F.today(); F.save();
          const h = HOUSES.find((x) => x.key === st.house);
          F.toast('🏆' + h.crest, NAMES[h.key] + ' מוֹבִיל!', 2800); F.confetti([h.crest, '🏆', '✨', '⭐'], 26); F.sfx.tada(); g.cheer(3);
        }
      }
    }

    // ---------------- wearing the house colours ----------------
    let scarf = null;
    function dress() {
      const h = HOUSES.find((x) => x.key === st.house); if (!h) return;
      const root = g.player.userData.root;
      if (!scarf) {
        scarf = new T.Group();
        const mA = new T.MeshStandardMaterial({ roughness: 0.8 }), mB = new T.MeshStandardMaterial({ roughness: 0.7 });
        const loop = new T.Mesh(new T.TorusGeometry(0.39, 0.13, 8, 20), mA); loop.rotation.x = Math.PI / 2; loop.position.y = 1.08; scarf.add(loop);
        for (let i = 0; i < 5; i++) { const seg = new T.Mesh(new T.BoxGeometry(0.19, 0.15, 0.09), i % 2 ? mB : mA); seg.position.set(0.14, 0.95 - i * 0.14, 0.36 + i * 0.012); scarf.add(seg); }
        const hem = new T.Mesh(new T.TorusGeometry(0.685, 0.05, 6, 24), mB); hem.rotation.x = Math.PI / 2; hem.position.y = 0.1; scarf.add(hem);
        scarf.userData = { mA, mB }; root.add(scarf);
        g.playerMats.push(mA, mB);                       // fade with the hero when the camera is close
      }
      scarf.userData.mA.color.setHex(h.field).multiplyScalar(1.35); scarf.userData.mB.color.setHex(h.key === 'huff' ? 0x2a2320 : h.trim);
    }
    if (st.house) dress();

    // ---------------- the ceremony ----------------
    const css = document.createElement('style');
    css.textContent = `#sortOv{position:fixed;inset:0;z-index:47;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;
      background:radial-gradient(ellipse at center,rgba(40,24,90,.75),rgba(5,3,25,.94));font-family:'Rubik',sans-serif;direction:rtl;text-align:center}
    #sortOv.on{display:flex}
    #sortOv .hat{font-size:150px;line-height:1;filter:drop-shadow(0 0 30px rgba(255,215,106,.6));transform-origin:50% 90%}
    #sortOv .hat.think{animation:sortThink .5s ease-in-out infinite}
    @keyframes sortThink{0%,100%{transform:rotate(-9deg) scale(1)}50%{transform:rotate(9deg) scale(1.06)}}
    #sortOv .q{color:#ffe9a8;font-size:34px;font-weight:bold;text-shadow:0 3px 0 #000;min-height:44px;padding:0 16px}
    #sortOv .row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;width:min(92vw,640px)}
    @media (max-aspect-ratio:1/1){#sortOv .row{grid-template-columns:repeat(2,1fr);width:min(86vw,420px)}}
    #sortOv .crest{aspect-ratio:1;border-radius:26px;border:5px solid #ffd76a;font-size:74px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.4);touch-action:manipulation;padding:0;font-family:inherit}
    #sortOv .crest:active{transform:translateY(4px)}
    #sortOv .big{font-size:min(15vw,96px);font-weight:bold;color:#fff;text-shadow:0 5px 0 #000,0 0 40px #ffd76a;animation:sortPop .6s cubic-bezier(.3,1.8,.5,1)}
    @keyframes sortPop{0%{transform:scale(0) rotate(-12deg)}100%{transform:scale(1) rotate(0)}}
    #sortOv .x{position:absolute;top:calc(18px + env(safe-area-inset-top));inset-inline-end:18px;width:60px;height:60px;border-radius:50%;border:4px solid #ffd76a;background:#3a2060;color:#fff;font-size:28px}`;
    document.head.appendChild(css);
    const ov = document.createElement('div'); ov.id = 'sortOv'; document.body.appendChild(ov);
    ov.addEventListener('pointerdown', (e) => e.stopPropagation());
    let busy = false;
    function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }
    function open() {
      if (g.modal) return;
      g.setModal(true); busy = false; ov.innerHTML = '';
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.addEventListener('click', close); ov.appendChild(x);
      const hatE = document.createElement('div'); hatE.className = 'hat'; hatE.textContent = '🎩'; ov.appendChild(hatE);
      const q = document.createElement('div'); q.className = 'q'; q.textContent = 'לְאָן הַלֵּב שֶׁלְּךָ הוֹלֵךְ?'; ov.appendChild(q);
      const row = document.createElement('div'); row.className = 'row'; ov.appendChild(row);
      HOUSES.forEach((h) => {
        const b = document.createElement('button'); b.className = 'crest'; b.dataset.k = h.key; b.textContent = h.crest;
        b.style.background = 'radial-gradient(circle at 40% 30%,' + hex(h.field) + ',#150b30)';
        b.addEventListener('click', () => choose(h, hatE, q, row));
        row.appendChild(b);
      });
      ov.classList.add('on'); try { HP.sfx.flip(); } catch (e) {}
    }
    function choose(h, hatE, q, row) {
      if (busy) return; busy = true;
      row.style.visibility = 'hidden'; hatE.classList.add('think');
      q.textContent = QUIPS[(Math.random() * QUIPS.length) | 0]; F.sfx.drum();
      setTimeout(() => {
        hatE.classList.remove('think'); hatE.textContent = h.crest;
        q.className = 'big'; q.textContent = NAMES[h.key] + '!';
        st.house = h.key; F.save(); dress(); if (F.hats) F.hats.unlock('wizard');
        F.sfx.tada(); try { HP.cheer(NAMES[h.key].replace(/[֑-ׇ׳]/g, '') + '!'); } catch (e) {}
        F.confetti([h.crest, '✨', '🎉', '⭐'], 26);
        for (const k in glasses) glasses[k].shown = -1;
        setTimeout(() => { close(); F.award('sorted'); g.cheer(3); }, 1900);
      }, 1400);
    }
    function close() { ov.classList.remove('on'); g.setModal(false); }

    F.inside(function (dt, t, player) {
      const p = player.position, d = F.dist(p, HAT.x, HAT.z);
      // the hat fidgets, and mutters when someone wanders near
      tipG.rotation.z = Math.sin(t * 1.3) * 0.12; tipG.rotation.x = Math.sin(t * 0.9) * 0.08;
      hat.scale.y = 1 + Math.sin(t * 2.2) * 0.025;
      if (talkT > 0) { talkT -= dt; mouth.scale.y = 1 + Math.abs(Math.sin(t * 16)) * 2.6; } else mouth.scale.y = 1;
      halo.material.opacity = 0.25 + 0.12 * Math.sin(t * 3);
      if (d < 9) {
        quipT -= dt;
        if (quipT <= 0) {
          quipT = 7 + Math.random() * 5; talkT = 1.6;
          const h = HOUSES.find((x) => x.key === st.house);
          F.say(headPos, h ? h.crest + ' ' + NAMES[h.key] + '!' : 'פְּסְסְט... בּוֹא נְמַיֵּן אוֹתְךָ! 🎩', 2.6, 'hat');
          F.sfx.tone(160, 0.12, 'sawtooth', 0.06, 0, 120);
        }
      }
      if (d < 3.4) F.offer('sort', '🎩', d, open);
      tickGlasses(dt, t, p);
    });
    F.mods.sorting = { open, pick(key) { const h = HOUSES.find((x) => x.key === key); if (!ov.classList.contains('on')) open(); choose(h, ov.querySelector('.hat'), ov.querySelector('.q'), ov.querySelector('.row')); }, house: () => st.house, housePts, glasses, pos: HAT };
  });
})();
