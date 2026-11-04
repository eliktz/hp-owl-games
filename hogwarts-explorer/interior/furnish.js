/* Shared furnishings + living delights for the new wings: chalkboards, student desks,
 * a teacher's podium, drifting ghosts, suits of armour that wave, levitating objects,
 * and chatty portraits that pop a short Hebrew joke now and then. All original, built
 * from primitives + canvas text — no copied art. Each "living" helper pushes its own
 * per-frame tick onto HPI.builders so rooms stay declarative. */
(function (HPI) {
  const T = HPI.T;

  // ---- a mounted chalkboard with a chalk-drawn Hebrew word/number ----
  function board(scene, x, y, z, rotY, label) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
    const frameM = new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#3a2614').map, roughness: 0.9 });
    const slate = new T.Mesh(new T.PlaneGeometry(4.4, 2.6), new T.MeshStandardMaterial({ map: chalkTex(label), roughness: 0.95 }));
    slate.position.z = 0.06; g.add(slate);
    g.add(frameBox(4.8, 0.3, 1.4, frameM));
    g.add(frameBox(4.8, 0.3, -1.4, frameM, true));
    scene.add(g); return g;
  }
  function frameBox(w, th, off, m, horiz) {
    const b = new T.Mesh(new T.BoxGeometry(horiz ? w : th, horiz ? th : 3, 0.18), m);
    b.position.set(0, horiz ? off : 0, 0); if (!horiz) b.position.x = off * (w / 2.8); return b;
  }
  function chalkTex(label) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 150; const g = c.getContext('2d');
    g.fillStyle = '#1c2a22'; g.fillRect(0, 0, 256, 150);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.strokeRect(6, 6, 244, 138);
    g.fillStyle = '#f3efe0'; g.font = 'bold 54px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label || '✦', 128, 78);
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(30 + i * 45, 128); g.lineTo(55 + i * 45, 128); g.stroke(); }
    const t = new T.CanvasTexture(c); return t;
  }

  // ---- a small student desk + stool (no collision: kids glide past furniture) ----
  function desk(scene, x, y, z, rotY) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
    const wm = new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#4a3016').map, roughness: 0.85 });
    const top = new T.Mesh(new T.BoxGeometry(1.5, 0.12, 0.9), wm); top.position.y = 0.95; g.add(top);
    [-1, 1].forEach((s) => [-1, 1].forEach((t) => { const leg = new T.Mesh(new T.BoxGeometry(0.1, 0.9, 0.1), wm); leg.position.set(s * 0.65, 0.45, t * 0.35); g.add(leg); }));
    const stool = new T.Mesh(new T.CylinderGeometry(0.28, 0.3, 0.1, 10), wm); stool.position.set(0, 0.6, 0.85); g.add(stool);
    const sl = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.6, 8), wm); sl.position.set(0, 0.3, 0.85); g.add(sl);
    scene.add(g); return g;
  }
  function deskRows(scene, cx, cz, floorY, rows, cols, rotY) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      desk(scene, cx + (c - (cols - 1) / 2) * 2.2, floorY, cz + r * 2.4, rotY);
  }

  // ---- teacher's podium (a sturdy lectern) ----
  function podium(scene, x, y, z, rotY) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
    const wm = new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#2e1d10').map, roughness: 0.9 });
    g.add(mesh(new T.BoxGeometry(1.3, 1.4, 0.9), wm, 0, 0.7, 0));
    const slope = new T.Mesh(new T.BoxGeometry(1.4, 0.1, 1), wm); slope.position.set(0, 1.45, 0); slope.rotation.x = -0.4; g.add(slope);
    scene.add(g); return g;
  }
  function mesh(geo, m, x, y, z) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); return o; }

  // ---- a drifting friendly ghost (translucent, bobs along a looping path) ----
  function ghost(scene, pts, floorY) {
    const g = new T.Group();
    const gm = new T.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.32, roughness: 0.4, emissive: 0x335577, emissiveIntensity: 0.4, depthWrite: false });
    const body = new T.Mesh(new T.ConeGeometry(0.75, 2, 16, 1, true), gm); body.position.y = 1; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.55, 16, 14), gm); head.position.y = 2; g.add(head);
    [-1, 1].forEach((s) => { const e = new T.Mesh(new T.SphereGeometry(0.09, 8, 8), new T.MeshBasicMaterial({ color: 0x1a2a3a })); e.position.set(s * 0.2, 2.05, 0.48); g.add(e); });
    const halo = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0x9fd8ff, transparent: true, opacity: 0.25, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    halo.scale.setScalar(4); halo.position.y = 1.4; g.add(halo);
    scene.add(g);
    const ph = Math.random() * 7;
    HPI.builders.push((t) => {
      const u = (t * 0.06 + ph) % 1, i = Math.floor(u * pts.length), a = pts[i], b = pts[(i + 1) % pts.length], f = u * pts.length - i;
      g.position.set(a[0] + (b[0] - a[0]) * f, floorY + 1.4 + Math.sin(t * 1.3 + ph) * 0.4, a[1] + (b[1] - a[1]) * f);
      g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      gm.opacity = 0.22 + 0.12 * Math.sin(t * 2 + ph);
    });
    return g;
  }

  // ---- a suit of armour that stands guard and waves now and then ----
  function armour(scene, x, y, z, rotY) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
    const steel = new T.MeshStandardMaterial({ color: 0x9aa2b0, metalness: 0.85, roughness: 0.35 });
    g.add(mesh(new T.CylinderGeometry(0.45, 0.55, 1.3, 14), steel, 0, 1.3, 0));   // torso
    g.add(mesh(new T.SphereGeometry(0.34, 16, 14), steel, 0, 2.15, 0));            // helm
    g.add(mesh(new T.BoxGeometry(0.5, 0.08, 0.1), new T.MeshBasicMaterial({ color: 0x0a0a0a }), 0, 2.15, 0.3)); // visor slit
    [-1, 1].forEach((s) => g.add(mesh(new T.SphereGeometry(0.22, 10, 8), steel, s * 0.52, 1.75, 0)));           // pauldrons
    [-1, 1].forEach((s) => g.add(mesh(new T.CylinderGeometry(0.1, 0.1, 1, 8), steel, s * 0.6, 0.6, 0)));        // legs
    const arm = new T.Group(); arm.position.set(0.52, 1.75, 0); g.add(arm);
    const fore = new T.Mesh(new T.CylinderGeometry(0.12, 0.1, 1, 8), steel); fore.position.y = -0.5; arm.add(fore);
    const spear = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.6, 6), new T.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }));
    spear.position.set(-0.62, 1.3, 0); g.add(spear);
    scene.add(g);
    const ph = Math.random() * 7; let waveT = 2 + Math.random() * 6;
    HPI.builders.push((t, dt) => {
      waveT -= dt;
      const waving = waveT < 1.2 && waveT > 0;
      arm.rotation.z = waving ? Math.sin((1.2 - waveT) * 9) * 0.9 : -0.1;
      if (waveT <= 0) waveT = 4 + Math.random() * 7;
      g.position.y = y + Math.sin(t * 0.8 + ph) * 0.02;
    });
    return g;
  }

  // ---- a chatty portrait: a gilded frame that pops a Hebrew joke bubble on a timer ----
  function jokePortrait(scene, x, y, z, rotY, jokes) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
    const gold = new T.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.5, roughness: 0.45, emissive: 0x3a2c08, emissiveIntensity: 0.4 });
    const fw = 2, fh = 2.6;
    [[0, fh / 2, fw, 0.3], [0, -fh / 2, fw, 0.3], [-fw / 2, 0, 0.3, fh], [fw / 2, 0, 0.3, fh]].forEach(([bx, by, w, h]) =>
      g.add(mesh(new T.BoxGeometry(w, h, 0.35), gold, bx, by, 0)));
    const face = new T.Mesh(new T.PlaneGeometry(fw - 0.3, fh - 0.3), new T.MeshStandardMaterial({ map: faceTex(), roughness: 0.9, emissive: 0x15110a, emissiveIntensity: 0.5 }));
    face.position.z = -0.08; g.add(face);
    const bubble = new T.Sprite(new T.SpriteMaterial({ map: null, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    bubble.scale.set(4.4, 2.4, 1); bubble.position.set(0, fh / 2 + 1.6, 0.4); g.add(bubble);
    scene.add(g);
    let sayT = 3 + Math.random() * 8, cur = null, show = 0;
    HPI.builders.push((t, dt) => {
      sayT -= dt;
      if (sayT <= 0) { cur = bubbleTex(jokes[Math.floor(Math.random() * jokes.length)]); bubble.material.map = cur; bubble.material.needsUpdate = true; show = 3.2; sayT = 9 + Math.random() * 10; }
      if (show > 0) { show -= dt; bubble.material.opacity = Math.min(1, show) * Math.min(1, (3.2 - show) * 4); }
      else bubble.material.opacity = 0;
    });
    return g;
  }
  function faceTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 46, 8, 64, 64, 80); grd.addColorStop(0, '#6a5436'); grd.addColorStop(1, '#2a1c2e');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e8c49a'; g.beginPath(); g.arc(64, 60, 26, 0, 7); g.fill();          // head
    g.fillStyle = '#4a3550'; g.fillRect(34, 86, 60, 42);                                 // robe
    g.fillStyle = '#1a140e'; g.beginPath(); g.arc(54, 58, 4, 0, 7); g.arc(74, 58, 4, 0, 7); g.fill(); // eyes
    g.strokeStyle = '#8a3f2c'; g.lineWidth = 3; g.beginPath(); g.arc(64, 66, 10, 0.2, Math.PI - 0.2); g.stroke(); // smile
    return new T.CanvasTexture(c);
  }
  function bubbleTex(text) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 170; const g = c.getContext('2d');
    g.clearRect(0, 0, 320, 170);
    roundRect(g, 10, 10, 300, 120, 24); g.fillStyle = 'rgba(40,25,90,.92)'; g.fill(); g.strokeStyle = '#ffd76a'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 30px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    wrap(g, text, 160, 56, 270, 36);
    g.fillStyle = 'rgba(40,25,90,.92)'; g.beginPath(); g.moveTo(140, 128); g.lineTo(180, 128); g.lineTo(150, 160); g.closePath(); g.fill();
    return new T.CanvasTexture(c);
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, cx, cy, maxw, lh) {
    const words = text.split(' '); let line = '', lines = [];
    for (const w of words) { if (g.measureText(line + w).width > maxw && line) { lines.push(line); line = w + ' '; } else line += w + ' '; }
    lines.push(line);
    const y0 = cy - (lines.length - 1) * lh / 2; lines.forEach((l, i) => g.fillText(l.trim(), cx, y0 + i * lh));
  }

  // ---- a levitating object that gently bobs + spins (wonder prop) ----
  function levitate(scene, obj, x, y, z) {
    obj.position.set(x, y, z); scene.add(obj);
    const ph = Math.random() * 7;
    HPI.builders.push((t) => { obj.position.y = y + Math.sin(t * 1.4 + ph) * 0.3; obj.rotation.y += 0.01; });
    return obj;
  }

  // ---- a hanging room sign: gold-rimmed violet plaque (house style) with an emoji +
  //      a Hebrew room name, slung from a little bar on two chains. Pure wayfinding. ----
  function sign(scene, x, y, z, rotY, text, icon) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
    const plaque = new T.Mesh(new T.PlaneGeometry(3, 1),
      new T.MeshStandardMaterial({ map: signTex(text, icon), transparent: true, roughness: 0.8, emissive: 0x241845, emissiveIntensity: 0.6, side: T.DoubleSide }));
    plaque.position.z = 0.06; g.add(plaque);
    const ironM = new T.MeshStandardMaterial({ color: 0x20201e, metalness: 0.6, roughness: 0.5 });
    [-1, 1].forEach((s) => { const ch = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.7, 6), ironM); ch.position.set(s * 1.1, 0.72, 0); g.add(ch); });
    const bar = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.7, 6), ironM); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.07, 0); g.add(bar);
    scene.add(g); return g;
  }
  function signTex(text, icon) {
    const c = document.createElement('canvas'); c.width = 330; c.height = 112; const g = c.getContext('2d');
    g.clearRect(0, 0, 330, 112);
    roundRect(g, 6, 6, 318, 100, 20); g.fillStyle = 'rgba(40,25,90,.93)'; g.fill(); g.strokeStyle = '#ffd76a'; g.lineWidth = 6; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '46px serif'; g.fillText(icon || '', 58, 58);
    g.fillStyle = '#ffe9b0'; g.font = 'bold 36px Rubik, sans-serif'; g.fillText(text, 192, 60);
    return new T.CanvasTexture(c);
  }

  // ---- a hanging iron lantern: warm glowing pane + additive halo on a chain (cheap,
  //      no pooled light). Adds a lived-in glow to long corridors + stair hall. ----
  function lantern(scene, x, y, z, color = 0xffc070) {
    const g = new T.Group(); g.position.set(x, y, z);
    const ironM = new T.MeshStandardMaterial({ color: 0x1c1c1a, metalness: 0.6, roughness: 0.5 });
    const chain = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.2, 6), ironM); chain.position.y = 0.8; g.add(chain);
    const cage = new T.Mesh(new T.BoxGeometry(0.42, 0.6, 0.42), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, transparent: true, opacity: 0.55, roughness: 0.4 }));
    g.add(cage);
    [0.35, -0.35].forEach((o) => { const cap = new T.Mesh(new T.ConeGeometry(0.3, 0.22, 4), ironM); cap.position.y = o; cap.rotation.y = Math.PI / 4; if (o < 0) cap.rotation.x = Math.PI; g.add(cap); });
    const halo = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    halo.scale.setScalar(1.8); g.add(halo);
    scene.add(g);
    const ph = Math.random() * 7;
    HPI.builders.push((t) => { halo.material.opacity = 0.45 + 0.18 * Math.sin(t * 6 + ph); g.rotation.z = Math.sin(t * 0.5 + ph) * 0.03; });
    return g;
  }

  // ---- a tall arched window set into a wall: a backlit day/night sky pane behind stone
  //      mullions, with a sill + a soft shaft of light so the room feels lit from outside.
  //      `axis` 'x' means the wall runs along z (window faces ±x), 'z' the opposite.
  function window3(scene, light, x, y, z, axis, dir, mode, w = 2.2, h = 4, color) {
    const g = new T.Group(); g.position.set(x, y, z);
    if (axis === 'x') g.rotation.y = Math.PI / 2;            // face along x
    // 'auto' tracks the school clock so a window never shows night in a daytime castle
    if (mode === 'auto' || mode == null) mode = (HPI.skyMode ? HPI.skyMode() : 'day');
    const pane = new T.Mesh(new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: HPI.tex.sky(mode), side: T.DoubleSide, fog: false }));
    pane.position.z = 0.02 * dir; g.add(pane);
    const stoneM = new T.MeshStandardMaterial({ color: 0x3a3658, roughness: 0.95 });
    // arched top (thin ribbed frame) + mullion cross + sill
    const arch = HPI.kit.pointedArch(g, 0, 0, w + 0.5, 1.1, 'z', stoneM); arch.position.y = h / 2 - 0.2;
    g.add(mesh(new T.BoxGeometry(0.16, h, 0.16), stoneM, 0, 0, 0));        // vertical mullion
    g.add(mesh(new T.BoxGeometry(w, 0.16, 0.16), stoneM, 0, 0, 0));        // horizontal mullion
    [-1, 1].forEach((s) => g.add(mesh(new T.BoxGeometry(0.22, h + 0.3, 0.22), stoneM, s * (w / 2 + 0.05), 0, 0))); // jambs
    g.add(mesh(new T.BoxGeometry(w + 0.7, 0.3, 0.6), stoneM, 0, -h / 2 - 0.1, 0.18 * dir)); // sill
    scene.add(g);
    if (light) light.addShaft(x - (axis === 'x' ? dir * 2.5 : 0), y - 1, z - (axis === 'z' ? dir * 2.5 : 0), h * 1.4, 1.8, 0);
    return g;
  }

  // ---- a floor rug laid flat (woven texture), lifted a hair above the stone ----
  function rug(scene, x, z, w, d, floorY, field, border) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d),
      new T.MeshStandardMaterial({ map: HPI.tex.rug(field, border), roughness: 0.96 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, (floorY || 0) + 0.04, z); scene.add(m); return m;
  }

  // ---- a wall bookshelf: oak frame with rows of painted book-spine texture ----
  function bookshelf(scene, x, y, z, rotY, w = 3, floors = 3) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
    const wm = new T.MeshStandardMaterial({ map: HPI.tex.wood(1, '#2e1d10').map, roughness: 0.9 });
    const h = floors * 1.1 + 0.3;
    g.add(mesh(new T.BoxGeometry(w, h, 0.5), wm, 0, h / 2 - 0.15, -0.15)); // back box
    [-1, 1].forEach((s) => g.add(mesh(new T.BoxGeometry(0.14, h, 0.56), wm, s * (w / 2), h / 2 - 0.15, 0)));
    for (let f = 0; f <= floors; f++) g.add(mesh(new T.BoxGeometry(w, 0.12, 0.56), wm, 0, f * 1.1, 0));
    const booksM = new T.MeshStandardMaterial({ map: HPI.tex.books(), roughness: 0.85 });
    for (let f = 0; f < floors; f++) g.add(mesh(new T.BoxGeometry(w - 0.3, 0.9, 0.42), booksM, 0, f * 1.1 + 0.6, 0.02));
    scene.add(g); return g;
  }

  HPI.furnish = { board, deskRows, desk, podium, ghost, armour, jokePortrait, levitate, mesh, sign, lantern, window3, rug, bookshelf };
})(window.HPI);
