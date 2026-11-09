/* Little secrets tucked into the castle:
 *  1. The Mirror of Wishes (Trophy room) — step in front of it and your reflection appears
 *     wearing a golden crown, waving back at you. Linger a moment and the crown is yours.
 *  2. The Whispering Book — one book in the Library glows violet. Touch it and a hidden
 *     passage whisks you to the Common Room hearth; the Common Room shelf whisks you back.
 *  3. The gramophone (Common Room) — walk up and it plays a jaunty tune while notes float out.
 *  4. Wizard chess (Common Room) — the pieces hop about on their own when you come near. */
(function () {
  const F = window.HPFun, T = window.THREE;
  F.boot(function (g) {
    const st = F.store, L = HPI.L, scene = g.inside.scene;
    F.badge('mirror', '🪞', 'מַרְאָה'); F.badge('passage', '📖', 'מַעֲבָר סוֹדִי');
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
    const mk = (par, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };

    // ---------------- 1. Mirror of Wishes ----------------
    const MX = L.TRO.x1 - 0.42, MZ = -6;
    const mir = new T.Group(); mir.position.set(MX, 0, MZ); mir.rotation.y = -Math.PI / 2;
    const gold = M(0xd9b24a, { metalness: 0.7, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.4 });
    [[0, 5.2, 3.2, 0.3], [0, 0.35, 3.2, 0.3], [-1.6, 2.8, 0.3, 5.2], [1.6, 2.8, 0.3, 5.2]].forEach(([x, y, w, h]) => mk(mir, new T.BoxGeometry(w, h, 0.3), gold, x, y, 0));
    mk(mir, new T.ConeGeometry(0.5, 0.8, 4), gold, 0, 5.75, 0).rotation.y = Math.PI / 4;
    const glassM = new T.ShaderMaterial({
      uniforms: { t: { value: 0 }, k: { value: 0 } }, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'uniform float t; uniform float k; varying vec2 vUv; void main(){ vec2 p=vUv-0.5; float r=length(p); float sw=0.5+0.5*sin(p.x*9.0+p.y*7.0+t*1.3); vec3 a=mix(vec3(0.10,0.14,0.32),vec3(0.42,0.62,0.95),sw*0.5+0.25*k); a+=vec3(1.0,0.9,0.6)*k*smoothstep(0.55,0.0,r)*0.35; a+=vec3(1.0)*pow(max(0.0,sin((p.x+p.y)*5.0-t*0.8)),24.0)*0.35; gl_FragColor=vec4(a,1.0);} ',
    });
    mk(mir, new T.PlaneGeometry(2.9, 4.6), glassM, 0, 2.8, 0.05);
    const twin = HP.makeChibi('player'); twin.scale.set(1.25, 1.25, 0.06); twin.position.set(0, 0.55, 0.16); twin.visible = false;   // a flat "reflection"
    const crown = new T.Group(), th = twin.userData.head;
    const cg = M(0xffcf40, { metalness: 0.7, roughness: 0.25, emissive: 0x7a5200, emissiveIntensity: 0.8 });
    mk(crown, new T.CylinderGeometry(0.46, 0.42, 0.24, 16), cg, 0, 0.74, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mk(crown, new T.ConeGeometry(0.1, 0.3, 6), cg, Math.cos(a) * 0.44, 0.98, Math.sin(a) * 0.44); }
    th.add(crown); mir.add(twin);
    const mglow = F.glow(0x9fd0ff, 7, 0.25); mglow.position.set(0, 2.8, 0.6); mir.add(mglow);
    F.addInside(mir); F.poi('mirror', MX - 2.2, MZ);
    if (HPI.light.addPool) HPI.light.addPool(MX - 2, MZ, 3.4, 0x7fb0ff, 0.35);
    let gaze = 0, show = 0;
    F.inside(function (dt, t, player) {
      const p = player.position, d = F.dist(p, MX - 1.5, MZ);
      glassM.uniforms.t.value = t;
      const near = d < 4.2 && p.x < MX;
      show += ((near ? 1 : 0) - show) * Math.min(1, dt * 4); glassM.uniforms.k.value = show;
      twin.visible = show > 0.05;
      if (twin.visible) {
        twin.scale.set(1.25 * show, 1.25 * show, 0.06); twin.position.x = HPI.clamp(p.z - MZ, -0.9, 0.9);   // it follows you along the glass
        HP.animateChibi(twin, dt, t, st.mirror ? 0.25 + 0.75 * Math.max(0, Math.sin(t * 0.8)) : 1);
        crown.rotation.y = t;
      }
      mglow.material.opacity = 0.18 + 0.12 * Math.sin(t * 2) + show * 0.2;
      if (near && d < 3) {
        gaze += dt;
        if (gaze > 1.4 && !st.mirror) {
          st.mirror = true; F.save(); F.sfx.tada(); F.toast('👑', 'הַמַּרְאָה נָתְנָה לְךָ כֶּתֶר!'); F.confetti(['👑', '✨', '💛'], 18);
          g.fx.burst(p.clone().setY(p.y + 3), [0xffd34d, 0xffffff], 28, 6, 0.7); g.cheer(2.5);
          setTimeout(() => { F.award('mirror'); if (F.hats) F.hats.unlock('crown'); }, 900);
        }
      } else gaze = 0;
    });

    // ---------------- 2. the Whispering Book passage (Library ⇄ Common Room) ----------------
    const ends = [
      { x: 47, z: L.LIB.z0 + 1.0, y: 2.2, ry: 0, to: 'commonRoom', yaw: 0 },                       // on the Library's north shelves
      { x: L.CR.x1 - 0.95, z: -4, y: L.UP + 2.2, ry: -Math.PI / 2, to: 'library', yaw: 0 },      // on the Common Room bookshelf
    ];
    let warpCd = 0;
    ends.forEach((e) => {
      const b = new T.Group(); b.position.set(e.x, e.y, e.z); b.rotation.y = e.ry;
      const cover = M(0x7a3fd0, { emissive: 0x7a3fd0, emissiveIntensity: 0.9, roughness: 0.4 });
      mk(b, new T.BoxGeometry(0.34, 0.95, 0.6), cover, 0, 0, 0);
      const star = F.emojiSprite('✨', 0.5); star.position.set(0, 0.9, 0.2); b.add(star);
      const gl = F.glow(0xb07aff, 3.2, 0.5); gl.position.z = 0.3; b.add(gl);
      F.addInside(b); e.b = b; e.gl = gl; e.fy = e.y - 2.2;
      const sx = e.x + Math.sin(e.ry) * 1.6, sz = e.z + Math.cos(e.ry) * 1.6; e.sx = sx; e.sz = sz;
      F.poi('book-' + e.to, sx, sz);
      if (HPI.light.addPool) HPI.light.addPool(sx, sz, 2.6, 0x9a5cff, 0.4);
    });
    F.inside(function (dt, t, player) {
      const p = player.position; if (warpCd > 0) warpCd -= dt;
      for (const e of ends) {
        const d = F.dist(p, e.sx, e.sz);
        e.b.position.y = e.y + Math.sin(t * 2 + e.x) * 0.12; e.b.rotation.z = Math.sin(t * 3 + e.x) * 0.12;
        e.gl.material.opacity = 0.4 + 0.25 * Math.sin(t * 4) + (d < 5 ? 0.25 : 0);
        if (d < 1.5 && warpCd <= 0 && Math.abs(p.y - e.fy) < 2) {
          warpCd = 3; F.sfx.poof(); try { HP.sfx.whoosh(); HP.sfx.sparkle(); } catch (x) {}
          g.fx.burst(p.clone().setY(p.y + 1.5), [0xb07aff, 0xffffff, 0xff9ad5], 30, 7, 0.8);
          const dest = e.to;
          setTimeout(() => { g.fastTravel({ world: 'inside', key: dest, yaw: e.yaw, pitch: 0.15 }); F.toast('📖', 'מַעֲבָר סוֹדִי!', 1500); if (!st.passage) { st.passage = true; F.save(); setTimeout(() => F.award('passage'), 1200); } }, 200);
        }
      }
    });

    // ---------------- 3. gramophone + 4. wizard chess (Common Room) ----------------
    const Y = L.UP, GX = 9.2, GZ = -11.5;
    const gram = new T.Group(); gram.position.set(GX, Y, GZ);
    const wood = M(0x5a3a1e, { roughness: 0.85 });
    mk(gram, new T.BoxGeometry(1.0, 1.0, 1.0), wood, 0, 0.5, 0);
    mk(gram, new T.BoxGeometry(0.9, 0.3, 0.9), M(0x3a2414), 0, 1.15, 0);
    const disc = mk(gram, new T.CylinderGeometry(0.38, 0.38, 0.04, 20), M(0x15151a, { roughness: 0.3 }), 0, 1.33, 0);
    mk(gram, new T.CylinderGeometry(0.1, 0.1, 0.05, 12), M(0xe8352e), 0, 1.35, 0);
    const horn = mk(gram, new T.ConeGeometry(0.62, 1.1, 16, 1, true), M(0xd9b24a, { metalness: 0.7, roughness: 0.3, side: T.DoubleSide }), 0.25, 2.1, 0.1); horn.rotation.set(0.3, 0, -2.2);
    F.addInside(gram); F.poi('gramophone', GX + 1.6, GZ + 1.2);
    const TUNE = [659, 784, 880, 784, 659, 523, 587, 659, 0, 587, 523, 440, 523, 587, 659, 0];
    let playT = 0, noteT = 0, gramArmed = true;
    const CXp = 24.5, CZp = -11;
    const chess = new T.Group(); chess.position.set(CXp, Y, CZp);
    mk(chess, new T.CylinderGeometry(0.16, 0.3, 0.75, 10), wood, 0, 0.37, 0);
    const btex = HP.canvasTex(64, (c, s) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#e8dcc0' : '#3a2a20'; c.fillRect(i * 16, j * 16, 16, 16); } });
    mk(chess, new T.BoxGeometry(1.5, 0.1, 1.5), new T.MeshStandardMaterial({ map: btex, roughness: 0.6 }), 0, 0.8, 0);
    const pieces = [];
    for (let i = 0; i < 6; i++) {
      const white = i % 2 === 0, pm = M(white ? 0xf2ead8 : 0x2a2030, { roughness: 0.4 });
      const pc = new T.Group(); mk(pc, new T.CylinderGeometry(0.07, 0.13, 0.3, 8), pm, 0, 0.15, 0); mk(pc, new T.SphereGeometry(0.1, 8, 6), pm, 0, 0.36, 0);
      const hx = -0.56 + (i % 3) * 0.56, hz = white ? -0.56 : 0.56; pc.position.set(hx, 0.85, hz); chess.add(pc);
      pieces.push({ pc, hx, hz, tx: hx, tz: hz, hop: 0, wait: Math.random() * 2 });
    }
    F.addInside(chess); F.poi('chess', CXp - 1.6, CZp + 0.5);
    F.inside(function (dt, t, player) {
      const p = player.position, onFloor = Math.abs(p.y - Y) < 2;
      const dg = F.dist(p, GX, GZ);
      if (dg > 6) gramArmed = true;
      if (dg < 3.2 && gramArmed && playT <= 0 && onFloor) { gramArmed = false; playT = TUNE.length * 0.21 * 2; F.sfx.tune(TUNE.concat(TUNE), 0.21, 'triangle'); F.lastTune = t; }
      if (playT > 0) {
        playT -= dt; disc.rotation.y += dt * 5; horn.scale.setScalar(1 + Math.sin(t * 14) * 0.05); noteT -= dt;
        if (noteT <= 0) { noteT = 0.3; g.fx.burst(new T.Vector3(GX + 0.6, Y + 2.6, GZ + 0.3), [0xff9ad5, 0x9fd0ff, 0xffe08a], 2, 2.2, 0.8, 1.6, 2.5); }
        g.inside.npcs.forEach((n) => { if (n.who === 'ron') n.wave = Math.max(n.wave, 0.3); });      // Ron can't help dancing
      }
      if (F.dist(p, CXp, CZp) < 7 && onFloor) for (const q of pieces) {
        q.wait -= dt;
        if (q.wait <= 0 && q.hop <= 0) { q.wait = 1 + Math.random() * 2.5; q.hop = 0.5; q.fx0 = q.pc.position.x; q.fz0 = q.pc.position.z; q.tx = HPI.clamp(q.pc.position.x + (((Math.random() * 3) | 0) - 1) * 0.37, -0.56, 0.56); q.tz = HPI.clamp(q.pc.position.z + (((Math.random() * 3) | 0) - 1) * 0.37, -0.56, 0.56); }
        if (q.hop > 0) { q.hop -= dt; const k = 1 - Math.max(0, q.hop) / 0.5; q.pc.position.set(q.fx0 + (q.tx - q.fx0) * k, 0.85 + Math.sin(k * Math.PI) * 0.4, q.fz0 + (q.tz - q.fz0) * k); if (q.hop <= 0) F.sfx.tone(300 + Math.random() * 200, 0.05, 'square', 0.04); }
      }
    });
    F.mods.secrets = { mirror: { x: MX - 2.2, z: MZ }, ends, gram: { x: GX, z: GZ }, playing: () => playT > 0 };
  });
})();
