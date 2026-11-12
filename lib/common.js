/* Shared helpers for the Owl Post games: owls, sky, castle, sparkles, sounds, UI.
   Everything is built from three.js primitives + procedural audio. No external art. */
(function () {
  const HP = (window.HP = {});
  const rand = (a, b) => a + Math.random() * (b - a);
  HP.rand = rand;
  HP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  HP.lerp = (a, b, t) => a + (b - a) * t;

  // viewport size, preferring the visual viewport (iOS Safari toolbars / safe areas)
  HP.viewport = function () {
    const vv = window.visualViewport;
    return { w: Math.round((vv && vv.width) || window.innerWidth), h: Math.round((vv && vv.height) || window.innerHeight) };
  };

  // distance a perspective camera needs so a box of half-extents (halfW x halfH) just fits,
  // in whichever orientation we're in — keeps owls/cards big in portrait instead of tiny.
  HP.fitDistance = function (fov, halfW, halfH) {
    const { w, h } = HP.viewport();
    const a = w / h;
    const vfov = (fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * a);
    return Math.max(halfH / Math.tan(vfov / 2), halfW / Math.tan(hfov / 2));
  };
  HP.isPortrait = function () { const { w, h } = HP.viewport(); return h >= w; };

  /* ---------------- renderer / scene ---------------- */
  HP.setup = function (opts = {}) {
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2); // cap at 2 for iPad perf
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(dpr());
    const vp0 = HP.viewport();
    renderer.setSize(vp0.w, vp0.h);
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(opts.fogColor || 0x1a1450, opts.fogNear || 40, opts.fogFar || 140);
    const camera = new THREE.PerspectiveCamera(opts.fov || 50, vp0.w / vp0.h, 0.1, 600);
    const hemi = new THREE.HemisphereLight(0xc9d2ff, 0x5a4a75, 1.25);
    scene.add(hemi);
    const moonLight = new THREE.DirectionalLight(0xfff1d0, 1.0);
    moonLight.position.set(-10, 20, 15);
    scene.add(moonLight);
    const warm = new THREE.PointLight(0xffb060, 0.6, 60);
    warm.position.set(0, 5, 12);
    scene.add(warm);
    function resize() {
      const { w, h } = HP.viewport();
      renderer.setPixelRatio(dpr());
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (opts.onResize) opts.onResize();
    }
    window.addEventListener('resize', resize);
    // iOS reports stale dimensions right after an orientation flip — re-measure a beat later.
    window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 250); setTimeout(resize, 600); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    return { renderer, scene, camera, resize };
  };

  /* ---------------- textures ---------------- */
  function canvasTex(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  HP.canvasTex = canvasTex;
  HP.glowTex = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
  HP.starTex = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.15, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 ? 4 : 30;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
  });

  /* ---------------- sky ---------------- */
  HP.makeSky = function (scene, opts = {}) {
    const top = new THREE.Color(opts.top || 0x0b0a2e), mid = new THREE.Color(opts.mid || 0x2b1d6b), bot = new THREE.Color(opts.bottom || 0xff9a6b);
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: top }, mid: { value: mid }, bot: { value: bot } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.12 ? mix(mid, top, smoothstep(0.12,0.7,h)) : mix(bot, mid, smoothstep(-0.15,0.12,h)); gl_FragColor=vec4(c,1.0);} ',
    });
    const sky = new THREE.Mesh(geo, mat);
    scene.add(sky);
    // stars
    const n = opts.stars || 900, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const palette = [0xffffff, 0xfff3c4, 0xc9d8ff, 0xffe08a];
    for (let i = 0; i < n; i++) {
      const th = rand(0, Math.PI * 2), ph = rand(0.08, 1.45), r = 350;
      pos[i * 3] = r * Math.cos(th) * Math.cos(ph);
      pos[i * 3 + 1] = r * Math.sin(ph) - 20;
      pos[i * 3 + 2] = r * Math.sin(th) * Math.cos(ph);
      const c = new THREE.Color(palette[i % palette.length]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 5, map: HP.starTex, vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(stars);
    // moon
    const moon = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(18, 40), new THREE.MeshBasicMaterial({ color: 0xfff4cf, fog: false }));
    moon.add(disc);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HP.glowTex, color: 0xffe9a8, transparent: true, opacity: 0.55, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(90, 90, 1);
    moon.add(glow);
    for (let i = 0; i < 4; i++) {
      const cr = new THREE.Mesh(new THREE.CircleGeometry(rand(1.5, 3.5), 20), new THREE.MeshBasicMaterial({ color: 0xf0e2b0, fog: false }));
      cr.position.set(rand(-10, 10), rand(-10, 10), 0.1);
      moon.add(cr);
    }
    moon.position.copy(opts.moonPos || new THREE.Vector3(60, 70, -300));
    scene.add(moon);
    return { sky, stars, moon, update(t) { stars.material.size = 5 + Math.sin(t * 2) * 0.6; } };
  };

  /* ---------------- castle silhouette ---------------- */
  HP.makeCastle = function (opts = {}) {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: opts.color || 0x2a2550, roughness: 1 });
    const roof = new THREE.MeshStandardMaterial({ color: opts.roof || 0x1b1740, roughness: 1 });
    const win = new THREE.MeshBasicMaterial({ color: 0xffc85a, fog: false });
    const winGeo = new THREE.PlaneGeometry(0.5, 0.8);
    function tower(x, z, r, h, cone) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 16), stone);
      t.position.set(x, h / 2, z);
      g.add(t);
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, cone, 16), roof);
      c.position.set(x, h + cone / 2, z);
      g.add(c);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ color: [0xb5272d, 0xe6b422, 0x2f6fc0, 0x2e8b57][Math.floor(Math.random() * 4)], side: THREE.DoubleSide }));
      flag.position.set(x + 0.6, h + cone + 0.4, z);
      g.add(flag);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), roof);
      pole.position.set(x, h + cone + 0.2, z);
      g.add(pole);
      const rows = Math.floor(h / 2.2);
      for (let i = 0; i < rows; i++) {
        if (Math.random() < 0.35) continue;
        const w = new THREE.Mesh(winGeo, win);
        w.position.set(x, 1.5 + i * 2.2, z + r + 0.02);
        g.add(w);
      }
    }
    function hall(x, z, w, h, d) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
      b.position.set(x, h / 2, z);
      g.add(b);
      const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, d * 0.75, w, 4, 1), roof);
      rf.rotation.z = Math.PI / 2;
      rf.rotation.x = Math.PI / 4;
      rf.scale.set(1, 1, 0.8);
      rf.position.set(x, h + d * 0.3, z);
      g.add(rf);
      for (let i = 0; i < w / 1.6; i++) for (let j = 0; j < h / 2.4 - 0.5; j++) {
        if (Math.random() < 0.4) continue;
        const ww = new THREE.Mesh(winGeo, win);
        ww.position.set(x - w / 2 + 0.8 + i * 1.6, 1.4 + j * 2.4, z + d / 2 + 0.02);
        g.add(ww);
      }
    }
    hall(0, 0, 14, 7, 5);
    hall(-11, -2, 8, 5, 4);
    hall(10, -1, 7, 6, 4);
    tower(-7.5, 1.5, 1.6, 13, 6);
    tower(7.5, 1.5, 1.5, 11, 5);
    tower(0, -2.5, 2.2, 17, 8);
    tower(-15, -1, 1.2, 9, 4);
    tower(14, 0, 1.3, 10, 4.5);
    tower(3.5, 2.6, 1, 9, 4);
    // rocky hill under the castle
    const hill = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 1 }));
    hill.scale.set(1.2, 0.3, 0.6);
    hill.position.y = -5.8;
    g.add(hill);
    return g;
  };

  /* ---------------- owls ---------------- */
  HP.makeOwl = function (kind) {
    const isPig = kind === 'pig';
    const C = isPig
      ? { body: 0x7a706c, belly: 0xbdb2a6, face: 0xcfc4b6, iris: 0xffb020, wing: 0x6a605c, speck: 0x5a4a40 }
      : { body: 0xffffff, belly: 0xfafaff, face: 0xffffff, iris: 0xffd21f, wing: 0xf3f3fa, speck: 0x5b5b6b };
    const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    const owl = new THREE.Group();
    const root = new THREE.Group(); // inner group for bobbing
    owl.add(root);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mat(C.body));
    body.scale.set(1, 1.12, 0.95);
    root.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), mat(C.belly));
    belly.scale.set(0.95, 1.05, 0.6);
    belly.position.set(0, -0.12, 0.48);
    root.add(belly);
    const head = new THREE.Group();
    head.position.y = 1.15;
    root.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 20), mat(C.body));
    skull.scale.set(1.08, 0.95, 0.95);
    head.add(skull);
    const eyeWhite = mat(0xffffff, 0.3), pupilM = mat(0x111122, 0.2), irisM = mat(C.iris, 0.35), shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyes = [];
    [-1, 1].forEach((s) => {
      const disc = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), mat(C.face));
      disc.scale.set(1, 1, 0.45);
      disc.position.set(s * 0.36, 0.02, 0.62);
      head.add(disc);
      const eye = new THREE.Group();
      eye.position.set(s * 0.33, 0.05, 0.74);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), irisM);
      iris.scale.z = 0.6;
      eye.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(isPig ? 0.17 : 0.15, 16, 12), pupilM);
      pupil.position.z = 0.1;
      pupil.scale.z = 0.5;
      eye.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), shineM);
      shine.position.set(0.06, 0.08, 0.2);
      eye.add(shine);
      head.add(eye);
      eyes.push(eye);
      if (isPig) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), mat(C.body));
        tuft.position.set(s * 0.55, 0.72, 0.1);
        tuft.rotation.z = -s * 0.45;
        head.add(tuft);
      }
    });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 10), mat(isPig ? 0x3a3030 : 0x30303a, 0.4));
    beak.position.set(0, -0.2, 0.86);
    beak.rotation.x = Math.PI * 0.62;
    head.add(beak);
    // cheeks
    [-1, 1].forEach((s) => {
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff9eb5, transparent: true, opacity: 0.55 }));
      ch.position.set(s * 0.58, -0.25, 0.62);
      ch.scale.z = 0.3;
      head.add(ch);
    });
    // wings
    const wings = [];
    [-1, 1].forEach((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.8, 0.25, -0.05);
      const w = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat(C.wing));
      w.scale.set(1.0, 0.16, 0.55);
      w.position.set(s * 0.9, 0, 0);
      pivot.add(w);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), mat(isPig ? 0x5e5048 : 0xe8e8f2));
      tip.scale.set(0.9, 0.12, 0.5);
      tip.position.set(s * 1.6, -0.02, -0.12);
      pivot.add(tip);
      root.add(pivot);
      wings.push(pivot);
    });
    // tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat(C.wing));
    tail.scale.set(0.8, 0.2, 0.9);
    tail.position.set(0, -0.75, -0.75);
    tail.rotation.x = -0.6;
    root.add(tail);
    // feet
    [-1, 1].forEach((s) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(0xf2a33a, 0.5));
      f.scale.set(1, 0.6, 1.3);
      f.position.set(s * 0.32, -1.1, 0.35);
      root.add(f);
    });
    // speckles (Hedwig has a few dark spots, Pig has light flecks)
    const speckM = mat(isPig ? 0xe0d0b8 : C.speck);
    for (let i = 0; i < (isPig ? 14 : 10); i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), speckM);
      const th = rand(-1.2, 1.2), ph = rand(-0.6, 0.5);
      sp.position.set(Math.sin(th) * Math.cos(ph) * 1.0, Math.sin(ph) * 1.1, Math.cos(th) * Math.cos(ph) * 0.95);
      if (sp.position.z > 0.55 && Math.abs(sp.position.x) < 0.5) sp.position.z -= 0.1;
      root.add(sp);
    }
    owl.userData = { root, head, wings, eyes, kind, flapPhase: Math.random() * 6, blink: 0, nextBlink: rand(1, 4) };
    owl.scale.setScalar(isPig ? 0.55 : 1);
    return owl;
  };

  // flap: 0 = wings folded, 1 = full flapping. speed in flaps/sec
  HP.animateOwl = function (owl, dt, t, flap = 1, speed = 2.5) {
    const u = owl.userData;
    u.flapPhase += dt * speed * Math.PI * 2;
    const a = Math.sin(u.flapPhase);
    u.wings.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      const folded = -1.25; // hang down along body
      const open = a * 0.85 + 0.15;
      w.rotation.z = s * HP.lerp(folded, open, flap);
      w.rotation.y = s * HP.lerp(0.25, 0, flap);
    });
    u.root.position.y = flap > 0.5 ? -a * 0.12 : Math.sin(t * 2) * 0.03;
    // blink
    u.nextBlink -= dt;
    if (u.nextBlink < 0) { u.blink = 0.15; u.nextBlink = rand(1.5, 4.5); }
    if (u.blink > 0) u.blink -= dt;
    const sy = u.blink > 0 ? 0.1 : 1;
    u.eyes.forEach((e) => (e.scale.y = sy));
  };

  /* ---------------- props ---------------- */
  HP.makeLetter = function () {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 0.08), new THREE.MeshStandardMaterial({ color: 0xf6e7c1, roughness: 0.9 }));
    g.add(paper);
    const flapGeo = new THREE.BufferGeometry();
    flapGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.7, 0.475, 0.05, 0.7, 0.475, 0.05, 0, -0.05, 0.05], 3));
    flapGeo.computeVertexNormals();
    g.add(new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ color: 0xe8d29f, side: THREE.DoubleSide })));
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xc0262d, roughness: 0.4 }));
    seal.rotation.x = Math.PI / 2;
    seal.position.set(0, -0.03, 0.08);
    g.add(seal);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HP.glowTex, color: 0xffe2a0, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(3, 3, 1);
    g.add(glow);
    return g;
  };

  HP.makeSnitch = function () {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.8, roughness: 0.25, emissive: 0x6a4a00 }));
    g.add(ball);
    const wingM = new THREE.MeshStandardMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, emissive: 0x554422 });
    const wings = [];
    [-1, 1].forEach((s) => {
      const p = new THREE.Group();
      p.position.x = s * 0.3;
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), wingM);
      w.scale.set(1.4, 0.45, 1);
      w.position.x = s * 0.6;
      w.rotation.x = -Math.PI / 2;
      p.add(w);
      g.add(p);
      wings.push(p);
    });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HP.glowTex, color: 0xffd34d, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(2.4, 2.4, 1);
    g.add(glow);
    g.userData.wings = wings;
    return g;
  };
  HP.animateSnitch = function (s, t) {
    s.userData.wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * Math.sin(t * 40) * 0.6));
  };

  HP.makeCloud = function (scale = 1, opacity = 0.9) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xe9e6ff, roughness: 1, transparent: true, opacity, emissive: 0x2a2850 });
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.8, 1.4), 14, 10), m);
      s.position.set((i - n / 2) * 0.9 + rand(-0.2, 0.2), rand(-0.2, 0.5) - Math.abs(i - n / 2) * 0.12, rand(-0.4, 0.4));
      g.add(s);
    }
    g.scale.setScalar(scale);
    return g;
  };

  /* ---------------- chibi guest characters (three.js primitives only, no copyrighted art) ----------------
     Cute stylized young-wizard friends who cameo on celebrations. Built entirely from procedural
     primitives — NO franchise art is used. Each reads as a *generic* chibi student / gentle giant
     through original proportions, hair shapes, house-scarf colours and signature props:
       harry    — tousled near-black hair, round glasses, faint lightning scar, glowing wand
       ron      — ginger side-swept hair + freckles
       hermione — big bushy brown hair down past the shoulders
       hagrid   — bearded giant in a moleskin coat with a big belt (no scarf/glasses)
       player   — the explorable-world hero: violet + gold robe so he reads clearly as "you"
     Deliberately low-poly so a few can pop in together on an iPad without hurting FPS.
     Chibi proportions: a big round head on a short body, short mitten arms, little boots.
     Each faces +z; animateChibi() blends an idle (0) <-> cheer (1) pose. */
  HP.makeChibi = function (who) {
    const P = {
      harry:    { skin: 0xf2c9a0, hair: 0x14100c, robe: 0x272437, eye: 0x3f8a4b, glasses: true, scar: true, wand: true, scarf: 'gryf', hairStyle: 'messy' },
      ron:      { skin: 0xf5cb9c, hair: 0xcf5a1e, robe: 0x272437, eye: 0x4273ad, freckles: true,                         scarf: 'gryf', hairStyle: 'swept' },
      hermione: { skin: 0xe8b587, hair: 0x6a4322, robe: 0x272437, eye: 0x5a3a1e,                                          scarf: 'gryf', hairStyle: 'bushy' },
      hagrid:   { skin: 0xd9a26e, hair: 0x2a1d12, robe: 0x5a3d26, eye: 0x2d1d10, beard: true, big: true,                                hairStyle: 'wild'  },
      player:   { skin: 0xf0c49a, hair: 0x4a3420, robe: 0x4536a8, eye: 0x4a3526, trim: 0xffd76a,                                        hairStyle: 'neat'  },
      // ---- original chibi teachers (defined by palette + silhouette, no copied art) ----
      snape:    { skin: 0xe8d6c4, hair: 0x100c10, robe: 0x14121a, eye: 0x2a2630, trim: 0x2a2630,                                        hairStyle: 'bushy' },
      flitwick: { skin: 0xf1d2b0, hair: 0xe8e4ea, robe: 0x3a2f5e, eye: 0x4a6a9a, beard: true,                                          hairStyle: 'wild'  },
      sprout:   { skin: 0xe9b58a, hair: 0xb9b2a6, robe: 0x5a4326, eye: 0x4a3a20, trim: 0x8a6a2a,                                        hairStyle: 'wild'  },
      sinistra: { skin: 0x8a5e44, hair: 0x14100c, robe: 0x1b2456, eye: 0x2a2018, trim: 0xb08a2e,                                        hairStyle: 'bushy' },
      mcgon:    { skin: 0xe6c3a0, hair: 0x2a1d16, robe: 0x1a4030, eye: 0x4a3526, glasses: true, trim: 0x8a1a2a,                          hairStyle: 'bushy' },
      // ---- corridor patrol (hogwarts-explorer/delight/patrol.js) ----
      filch:      { skin: 0xe2c8b0, hair: 0x8a8478, robe: 0x4a3b2c, eye: 0x4a4a52, trim: 0x6a5a3a, hairStyle: 'wild' },
      dumbledore: { skin: 0xf0d2b4, hair: 0xf2f0f4, robe: 0x5a3f9a, eye: 0x5a8ac0, beard: true, glasses: true, trim: 0xd9b24a, hairStyle: 'wild' },
      defence:  { skin: 0xe8c6a0, hair: 0xbf9a5a, robe: 0x5a4a32, eye: 0x7a9a6a, trim: 0x8a7a3a, wand: true,                            hairStyle: 'swept' },
    }[who] || {};
    const big = !!P.big;
    const rand = HP.rand;
    const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    const skinM = mat(P.skin, 0.75), hairM = mat(P.hair, 0.95), robeM = mat(P.robe, 0.9);
    const trimM = mat(P.trim || 0xe0b23a, 0.6);

    const chibi = new THREE.Group();
    const root = new THREE.Group(); // inner group carries the happy bounce
    chibi.add(root);

    // ---- proportions (big head, short body = chibi) ----
    const headR = big ? 0.95 : 0.68;
    const bodyH = big ? 1.9 : 1.12;
    const topR = big ? 0.85 : 0.40; // shoulder radius (Hagrid is burly, not a wide cone)
    const botR = big ? 1.02 : 0.66; // hem radius

    // ---- body / robe ----
    const body = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, bodyH, 20, 1), robeM);
    body.position.y = bodyH / 2;
    root.add(body);
    // soft rounded shoulders so arms don't look stuck on
    [-1, 1].forEach((s) => { const sh = new THREE.Mesh(new THREE.SphereGeometry(topR * 0.6, 12, 10), robeM); sh.position.set(s * topR * 0.7, bodyH - topR * 0.35, 0); root.add(sh); });
    // a little hem flare at the bottom of the robe
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(botR, botR * 1.05, bodyH * 0.14, 20), robeM);
    hem.position.y = bodyH * 0.07; root.add(hem);

    if (big) { // Hagrid's big belt + buckle on the moleskin coat
      // size the belt off the robe radius at each height (+5% margin) so it wraps the
      // cone cleanly at every point instead of z-fighting it
      const robeR = (y) => botR + (topR - botR) * (y / bodyH);
      const by = bodyH * 0.4, bh = 0.34;
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(robeR(by + bh / 2) * 1.05, robeR(by - bh / 2) * 1.05, bh, 24), mat(0x2a1c12, 0.85));
      belt.position.y = by; root.add(belt);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.14), mat(0xc29a34, 0.45));
      buckle.position.set(0, by, robeR(by) * 1.05); root.add(buckle); // sits proud of the belt
    }

    // ---- neck ----
    const neckH = big ? 0.22 : 0.16;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.42, headR * 0.5, neckH, 12), skinM);
    neck.position.y = bodyH + neckH / 2 - 0.02; root.add(neck);

    // ---- head ----
    const head = new THREE.Group();
    head.position.y = bodyH + neckH + headR * 0.78;
    root.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 18), skinM);
    skull.scale.set(1, 1.03, 0.98); head.add(skull);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.18, 10, 8), skinM); e.scale.set(0.7, 1, 0.7); e.position.set(s * headR * 0.97, -headR * 0.02, 0); head.add(e); }); // ears

    // ---- big expressive eyes (white + coloured iris + pupil + catch-light + soft upper lid) ----
    const eyeColor = P.eye || 0x4a3526;
    const eyes = [];
    const eyeY = -headR * 0.05, eyeX = headR * 0.34, eyeZ = headR * 0.80;
    [-1, 1].forEach((s) => {
      const eye = new THREE.Group(); eye.position.set(s * eyeX, eyeY, eyeZ); head.add(eye);
      const w = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.24, 16, 14), mat(0xffffff, 0.25));
      w.scale.set(0.95, 1.12, 0.55); eye.add(w);
      // iris sits a touch low so a sliver of white shows up top -> friendly, awake look (not a bare black ball)
      const iris = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.145, 16, 14), mat(eyeColor, 0.3));
      iris.scale.set(0.95, 0.95, 0.5); iris.position.set(0, -headR * 0.03, headR * 0.11); eye.add(iris);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.07, 10, 8), mat(0x0e0a06, 0.15));
      pup.position.set(0, -headR * 0.03, headR * 0.16); eye.add(pup);
      const cl = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cl.position.set(-s * headR * 0.055, headR * 0.05, headR * 0.19); eye.add(cl);
      // thin dark lash-line arcing over the top: gives the eye a warm, defined shape
      const lid = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.026, 8, 18, Math.PI), mat(0x241812, 0.5));
      lid.position.set(0, headR * 0.015, headR * 0.15); eye.add(lid);
      eyes.push(eye);
    });

    // ---- eyebrows: only the giant gets big bushy brows; the kids read fine from their big eyes
    //      alone (separate brows just merged into the fringe and looked like a unibrow) ----
    if (big) {
      const browM = mat(P.hair, 0.95);
      [-1, 1].forEach((s) => {
        const br = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.2, 10, 8), browM);
        br.scale.set(1.5, 0.7, 0.7); br.position.set(s * eyeX, headR * 0.26, headR * 0.82); br.rotation.z = -s * 0.15; head.add(br);
      });
    }

    // ---- tiny nose + happy smile ----
    const nose = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.08, 8, 8), mat(P.skin, 0.7));
    nose.scale.set(1, 0.8, 0.8); nose.position.set(0, -headR * 0.12, headR * 0.93); head.add(nose);
    if (!big) { // Hagrid's beard covers the mouth
      const smile = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.045, 8, 18, Math.PI), mat(0x8a3f2c, 0.6));
      smile.rotation.z = Math.PI; smile.position.set(0, -headR * 0.32, headR * 0.82); head.add(smile);
    }
    [-1, 1].forEach((s) => { const ch = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff9eb5, transparent: true, opacity: 0.45 })); ch.scale.set(1, 0.7, 0.3); ch.position.set(s * headR * 0.5, -headR * 0.2, headR * 0.72); head.add(ch); }); // rosy cheeks

    // ---- hair ---------------------------------------------------------------
    // The HAIRLINE is kept high above the eyes so the forehead shows and the face
    // reads open & friendly. (The old low fringe dipped over the eyes and looked
    // like a helmet / mask.) Built from soft rounded lumps — no sharp cones. ----
    const hairGeo = new THREE.SphereGeometry(1, 12, 10); // reused soft lump
    // one soft hair lump; optional z-rotation gives a lock a lean
    const tuft = (x, y, z, rx, ry, rz, rot) => {
      const m = new THREE.Mesh(hairGeo, hairM);
      m.scale.set(rx, ry, rz); m.position.set(x, y, z);
      if (rot) m.rotation.z = rot;
      head.add(m); return m;
    };
    const style = P.hairStyle;
    const bushy = style === 'bushy', wild = style === 'wild';
    const HL = headR * 0.42;                 // front hairline height (well above eye-top ~0.22)
    const crownR = headR * ((bushy || wild) ? 1.12 : 1.04);

    // crown cap — polar length chosen so its front rim sits AT the hairline, never
    // over the brow (a deeper cap left a hard flat rim-line across the forehead).
    // Pushed back a touch so the forehead stays open; volume comes from the lumps below.
    const crown = new THREE.Mesh(new THREE.SphereGeometry(crownR, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.375), hairM);
    crown.position.set(0, headR * ((bushy || wild) ? 0.06 : 0), -headR * 0.03); head.add(crown);

    // back + sides: soft lumps filling the nape and above the ears. All kept behind
    // the face plane (z small/negative) so they frame the face without masking it.
    const sm = (bushy || wild) ? 0.46 : 0.33;   // side/back lump size
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.16 + 0.68 * i / 10);            // sweep around the back of the skull
      const x = Math.cos(a) * headR * (bushy || wild ? 1.0 : 0.9);
      const z = -Math.sin(a) * headR * 0.6 - headR * 0.14;
      tuft(x, headR * (0.2 - 0.16 * Math.sin(a)), z, headR * sm, headR * (sm + 0.06), headR * sm);
    }
    [-1, 1].forEach((s) => tuft(s * headR * 0.86, headR * 0.06, -headR * 0.02, headR * (sm * 0.9), headR * (sm + 0.1), headR * (sm + 0.08))); // temple hair above the ears

    // fringe — soft bangs sitting at the hairline across the forehead (per character)
    if (style === 'messy') {        // Harry: uneven tufts, a gap on the right for the scar + crown cowlicks
      for (let i = 0; i < 7; i++) {
        const x = (-0.6 + i * 0.2) * headR;
        if (x > headR * 0.1 && x < headR * 0.4) continue;    // leave the scar gap
        tuft(x, HL + rand(0, 0.07) * headR, headR * 0.78, headR * 0.17, headR * (0.13 + rand(0, 0.05)), headR * 0.15, rand(-0.35, 0.35));
      }
      for (let i = 0; i < 5; i++) tuft((-0.34 + i * 0.17) * headR, headR * (0.74 + rand(0, 0.12)), headR * (0.08 + rand(-0.04, 0.1)), headR * 0.1, headR * 0.18, headR * 0.1, rand(-0.35, 0.35));
    } else if (style === 'swept') { // Ron: fringe swept to one side
      for (let i = 0; i < 7; i++) { const x = (-0.58 + i * 0.2) * headR; tuft(x + headR * 0.05, HL + headR * 0.02, headR * 0.78, headR * 0.19, headR * 0.13, headR * 0.15, 0.4); }
    } else if (bushy) {             // Hermione: full soft fringe + long waves falling past the shoulders
      for (let i = 0; i < 7; i++) { const x = (-0.6 + i * 0.2) * headR; tuft(x, HL + headR * 0.03, headR * 0.74, headR * 0.2, headR * 0.15, headR * 0.17, rand(-0.15, 0.15)); }
      for (let i = 0; i < 10; i++) { const s = i < 5 ? -1 : 1; const k = i % 5; tuft(s * headR * (0.8 + 0.04 * k), headR * (-0.22 - 0.3 * k), headR * (0.3 - 0.11 * k), headR * 0.36, headR * 0.4, headR * 0.34); }
    } else if (wild) {              // Hagrid: shaggy forelocks framing the brow
      for (let i = 0; i < 7; i++) { const x = (-0.62 + i * 0.21) * headR; tuft(x, HL + rand(0, 0.06) * headR, headR * 0.72, headR * 0.22, headR * (0.17 + rand(0, 0.06)), headR * 0.2, rand(-0.4, 0.4)); }
    } else {                        // player: neat even fringe
      for (let i = 0; i < 7; i++) { const x = (-0.6 + i * 0.2) * headR; tuft(x, HL + headR * 0.02, headR * 0.8, headR * 0.17, headR * 0.13, headR * 0.15, (i - 3) * 0.05); }
    }

    if (P.beard) { // Hagrid: one big soft beard (wide at the cheeks, tapering to a rounded point) + a trim moustache
      const bb = new THREE.Mesh(hairGeo, hairM); bb.scale.set(headR * 0.8, headR * 1.0, headR * 0.62); bb.position.set(0, -headR * 1.02, headR * 0.44); head.add(bb); // main beard body (kept below the cheeks)
      [-1, 1].forEach((s) => tuft(s * headR * 0.62, -headR * 0.3, headR * 0.5, headR * 0.24, headR * 0.46, headR * 0.3)); // cheek fur linking hair to beard
      for (let i = 0; i < 9; i++) { const a = rand(-1.0, 1.0); tuft(Math.sin(a) * headR * 0.48, -headR * (0.7 + rand(0, 0.6)), Math.cos(a) * headR * 0.3 + headR * 0.5, headR * 0.26, headR * 0.28, headR * 0.24); } // soft surface lumps
      tuft(0, -headR * 0.42, headR * 0.84, headR * 0.34, headR * 0.1, headR * 0.2); // trim moustache under the nose
    }

    if (P.freckles) for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.028, 6, 6), mat(0xb5703a, 0.6)); f.position.set(rand(-0.55, 0.55) * headR, -headR * 0.12 + rand(-0.06, 0.06) * headR, headR * 0.9); head.add(f); }

    if (P.glasses) { // Harry's round glasses: a frame over each eye + bridge + temple arms
      const gm = new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.35, metalness: 0.4 });
      [-1, 1].forEach((s) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.26, headR * 0.04, 10, 20), gm);
        r.position.set(s * eyeX, eyeY, headR * 0.86); head.add(r);
        const temple = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.5, headR * 0.03, headR * 0.03), gm);
        temple.position.set(s * headR * 0.6, eyeY + headR * 0.04, headR * 0.5); temple.rotation.y = s * 0.6; head.add(temple);
      });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.22, headR * 0.035, headR * 0.035), gm);
      bridge.position.set(0, eyeY + headR * 0.02, headR * 0.88); head.add(bridge);
    }
    if (P.scar) { // lightning-bolt scar in the fringe gap on the forehead
      const sm = new THREE.MeshStandardMaterial({ color: 0xb5532e, roughness: 0.55, emissive: 0x5a1e00, emissiveIntensity: 0.5 });
      const seg = [0.55, -0.55, 0.55]; let yy = headR * 0.42;
      seg.forEach((rot, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.05, headR * 0.17, headR * 0.035), sm); b.position.set(headR * 0.28 + (i - 1) * headR * 0.04, yy, headR * 0.92); b.rotation.z = rot; head.add(b); yy -= headR * 0.13; });
    }

    // ---- arms (short mittened sleeves; one waves, both go up to cheer) ----
    const shoulderY = bodyH - (big ? 0.42 : 0.26), shoulderX = topR + (big ? 0.16 : 0.1);
    const armLen = big ? 0.95 : 0.56, armR = big ? 0.2 : 0.12;
    const arms = [];
    [-1, 1].forEach((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * shoulderX, shoulderY, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(armR * 0.8, armR, armLen, 10), robeM);
      arm.position.y = -armLen / 2; pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(armR * 1.25, 10, 8), skinM);
      hand.position.y = -armLen; pivot.add(hand);
      pivot.userData.hand = hand;
      pivot.rotation.z = s * 0.14; // rest: arms hang close to the body
      root.add(pivot); arms.push(pivot);
    });
    const waveArm = arms[1], otherArm = arms[0];

    // ---- house scarf (generic scarlet-and-gold stripes) or a plain collar ----
    if (P.scarf === 'gryf') {
      const red = mat(0x8e1b24, 0.8), gold = mat(0xe0b23a, 0.6);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(topR * 0.92, 0.12, 8, 20), red);
      loop.rotation.x = Math.PI / 2; loop.position.y = bodyH - 0.06; root.add(loop);
      [-1, 1].forEach((s) => { for (let i = 0; i < 5; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.08), i % 2 ? gold : red); seg.position.set(s * 0.12, bodyH - 0.18 - i * 0.14, topR * 0.85 + 0.02); root.add(seg); } });
    } else if (!big) { // player: gold collar trim to match the robe
      const collar = new THREE.Mesh(new THREE.TorusGeometry(topR * 0.92, 0.1, 8, 18), trimM);
      collar.rotation.x = Math.PI / 2; collar.position.y = bodyH - 0.05; root.add(collar);
    }

    if (P.wand) { // Harry holds a little glowing wand in the waving hand
      const wand = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.8, 8), mat(0x3a2414, 0.7));
      stick.position.y = 0.4; wand.add(stick);
      const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HP.glowTex, color: 0xfff0a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      tipGlow.scale.set(0.9, 0.9, 1); tipGlow.position.y = 0.85; wand.add(tipGlow);
      waveArm.userData.hand.add(wand);
    }

    // little boots peeking under the robe
    [-1, 1].forEach((s) => { const boot = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.3 : 0.19, 10, 8), mat(0x2a1c12, 0.8)); boot.scale.set(1, 0.7, 1.4); boot.position.set(s * (big ? 0.45 : 0.28), big ? 0.16 : 0.1, big ? 0.5 : 0.3); root.add(boot); });

    chibi.userData = { root, head, eyes, arms, waveArm, otherArm, who, t: rand(0, 6), waveBaseR: waveArm.rotation.z, waveBaseL: otherArm.rotation.z };
    return chibi;
  };

  // idle (0) <-> cheer (1) pose blend. idle = gentle breathing + sway; cheer = arms up, waving, bouncing.
  HP.animateChibi = function (chibi, dt, t, wave = 1) {
    const u = chibi.userData;
    u.t += dt;
    const w = HP.clamp(wave, 0, 1);
    const swing = Math.sin(u.t * 9);
    const breathe = Math.sin(u.t * 2.2);
    u.root.position.y = breathe * 0.015 * (1 - w) + Math.abs(Math.sin(u.t * 5)) * 0.12 * w; // breathe when idle, hop when cheering
    u.waveArm.rotation.z = u.waveBaseR + (1 - w) * Math.sin(u.t * 2) * 0.08 + w * (2.25 + swing * 0.5); // raise overhead + wave
    u.otherArm.rotation.z = u.waveBaseL - (1 - w) * Math.sin(u.t * 2 + 1) * 0.08 - w * (2.0 + Math.sin(u.t * 9 + 1) * 0.35);
    u.head.rotation.z = swing * 0.12 * w;
    u.head.rotation.y = Math.sin(u.t * (0.8 + w)) * (0.08 + 0.04 * w); // subtle look-around / excited turn
    u.head.rotation.x = breathe * 0.03 * (1 - w);
  };

  // Cameo controller: a chibi that pops in, cheers for a moment, then pops out.
  // Usage: const c = HP.makeCameo(chibi, {scale:1}); c.pop(3); ... c.update(dt,t) each frame.
  HP.makeCameo = function (chibi, opts = {}) {
    const base = opts.scale || 1;
    chibi.visible = false;
    chibi.scale.setScalar(0.0001);
    const st = { show: 0, target: 0, hold: 0 };
    return {
      chibi,
      get active() { return st.show > 0.01 || st.target > 0; },
      pop(dur = 3) { st.target = 1; st.hold = dur; chibi.visible = true; },
      hide() { st.target = 0; st.hold = 0; },
      update(dt, t) {
        if (st.hold > 0) { st.hold -= dt; if (st.hold <= 0) st.target = 0; }
        st.show += (st.target - st.show) * Math.min(1, dt * 7);
        if (st.show < 0.01 && st.target === 0) { chibi.visible = false; return; }
        chibi.visible = true;
        const overshoot = 1 + 0.12 * Math.sin(Math.min(1, st.show) * Math.PI); // springy entrance
        chibi.scale.setScalar(Math.max(0.0001, base * st.show * overshoot));
        HP.animateChibi(chibi, dt, t, Math.min(1, st.show * 1.1));
      },
    };
  };

  /* ---------------- particles ---------------- */
  // shared adaptive-quality signal (1 = full, down to 0.35 if the device can't keep up)
  HP.perf = { fps: 60, quality: 1 };
  HP.Particles = function (scene, max = 600) {
    const pool = [];
    const mats = {};
    function mat(color) {
      if (!mats[color]) mats[color] = new THREE.SpriteMaterial({ map: HP.starTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      return mats[color];
    }
    this.burst = function (pos, colors = [0xffd34d, 0xffffff, 0xff9ad5, 0x8fd3ff], n = 30, speed = 6, size = 0.7, life = 1.2, gravity = -4) {
      n = Math.max(1, Math.round(n * HP.perf.quality)); // thin out fireworks when FPS is low
      for (let i = 0; i < n; i++) {
        let p = pool.find((q) => !q.alive);
        if (!p) {
          if (pool.length >= max) return;
          const s = new THREE.Sprite(mat(0xffffff));
          p = { s, v: new THREE.Vector3(), alive: false };
          pool.push(p);
          scene.add(s);
        }
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.s.material = mat(c);
        p.s.position.copy(pos);
        const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        p.v.copy(dir).multiplyScalar(rand(0.3, 1) * speed);
        p.life = p.max = life * rand(0.6, 1.2);
        p.size = size * rand(0.6, 1.3);
        p.g = gravity;
        p.alive = true;
        p.s.visible = true;
      }
    };
    this.trail = function (pos, color = 0xfff2b0, size = 0.5) {
      this.burst(pos, [color], 1, 0.6, size, 0.7, 0.5);
    };
    this.update = function (dt) {
      // smooth FPS estimate; drop quality if we dip, recover slowly when smooth again
      if (dt > 0) {
        HP.perf.fps = HP.perf.fps * 0.9 + (1 / dt) * 0.1;
        const q = HP.perf.quality;
        if (HP.perf.fps < 40 && q > 0.35) HP.perf.quality = Math.max(0.35, q - 0.02);
        else if (HP.perf.fps > 55 && q < 1) HP.perf.quality = Math.min(1, q + 0.004);
      }
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; p.s.visible = false; continue; }
        p.v.y += p.g * dt;
        p.v.multiplyScalar(1 - dt * 0.8);
        p.s.position.addScaledVector(p.v, dt);
        const k = p.life / p.max;
        p.s.scale.setScalar(p.size * (0.4 + k) * (1 + 0.3 * Math.sin(p.life * 30)));
        p.s.material.opacity = Math.min(1, k * 1.5);
      }
    };
    // celebration: big multi-burst firework show
    this.fireworks = function (center, spread = 8, count = 6) {
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const p = center.clone().add(new THREE.Vector3(rand(-spread, spread), rand(-spread * 0.3, spread * 0.6), rand(-2, 2)));
          const palettes = [[0xff5a5a, 0xffd34d], [0x7cf0ff, 0xffffff], [0xff9ad5, 0xc59bff], [0x8cff9e, 0xffff8a]];
          this.burst(p, palettes[i % palettes.length], 45, 9, 0.9, 1.5, -3);
          HP.sfx.boom();
        }, i * 260);
      }
    };
  };

  /* ---------------- procedural sound ---------------- */
  const sfx = (HP.sfx = {});
  let ctx = null, master = null;
  let muted = localStorage.getItem('hpMuted') === '1';
  function kick() {
    // iOS unlock trick: play one silent buffer inside the user gesture
    try {
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, 22050);
      b.connect(ctx.destination);
      b.start(0);
    } catch (e) { /* ignore */ }
  }
  sfx.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      kick();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  };
  sfx.setMuted = function (m) {
    muted = m;
    localStorage.setItem('hpMuted', m ? '1' : '0');
    if (master) master.gain.value = m ? 0 : 0.5;
  };
  sfx.isMuted = () => muted;
  function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol = 0.2, when = 0, freq = 800, q = 1, type = 'bandpass') {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  let chimeIdx = 0;
  sfx.chime = function () { // rising sparkle notes as you keep collecting
    const f = PENTA[chimeIdx % PENTA.length];
    chimeIdx++;
    tone(f, 0.35, 'triangle', 0.25);
    tone(f * 2, 0.25, 'sine', 0.08, 0.04);
  };
  sfx.resetChime = () => (chimeIdx = 0);
  sfx.sparkle = function () { for (let i = 0; i < 4; i++) tone(1200 + Math.random() * 1400, 0.15, 'sine', 0.06, i * 0.05); };
  sfx.pop = function () { tone(500, 0.12, 'sine', 0.3, 0, 1100); };
  sfx.poof = function () { noise(0.35, 0.18, 0, 600, 0.7); tone(300, 0.25, 'sine', 0.12, 0, 160); };
  sfx.whoosh = function () { noise(0.4, 0.12, 0, 1200, 0.5); };
  sfx.boing = function () { tone(220, 0.35, 'sine', 0.25, 0, 520); };
  sfx.boom = function () { noise(0.6, 0.25, 0, 300, 0.6, 'lowpass'); sfx.sparkle(); };
  sfx.hoot = function (high = false) {
    const b = high ? 900 : 420;
    tone(b, 0.18, 'sine', 0.25, 0, b * 0.85);
    tone(b * 0.95, 0.32, 'sine', 0.25, 0.22, b * 0.75);
  };
  sfx.tweet = function () { // Pig's excited squeaky twitter
    for (let i = 0; i < 5; i++) tone(1500 + Math.random() * 600, 0.07, 'square', 0.04, i * 0.07, 2400);
  };
  sfx.flip = function () { tone(700, 0.08, 'triangle', 0.18, 0, 1000); };
  sfx.soft = function () { tone(392, 0.25, 'sine', 0.15); tone(330, 0.3, 'sine', 0.15, 0.12); };
  sfx.fanfare = function () {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.13, 0.26, 0.4, 0.62, 0.75];
    notes.forEach((n, i) => { tone(n, i === 5 ? 0.7 : 0.2, 'triangle', 0.22, times[i]); tone(n / 2, 0.2, 'sine', 0.1, times[i]); });
  };
  // gentle looping background tune (music box)
  let musicTimer = null;
  sfx.music = function (on = true) {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (!on) return;
    const melody = [659, 0, 784, 659, 587, 523, 0, 587, 659, 0, 523, 440, 494, 0, 392, 0];
    let i = 0;
    musicTimer = setInterval(() => {
      const n = melody[i % melody.length];
      if (n) tone(n, 0.5, 'sine', 0.05), tone(n * 2, 0.3, 'triangle', 0.015);
      if (i % 4 === 0) tone([131, 165, 147, 110][Math.floor(i / 4) % 4], 1.0, 'sine', 0.05);
      i++;
    }, 330);
  };

  /* ---------------- spoken Hebrew cheer (optional, graceful fallback) ---------------- */
  // A short kid-friendly "כל הכבוד!" style cheer via the Web Speech API in Hebrew.
  // No-ops silently if speechSynthesis / a Hebrew voice is missing, or if muted.
  let heVoices = [];
  const loadVoices = () => { try { heVoices = (window.speechSynthesis.getVoices() || []); } catch (e) { /* ignore */ } };
  if ('speechSynthesis' in window) {
    loadVoices();
    try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { /* ignore */ }
  }
  const CHEERS = ['כל הכבוד!', 'מעולה!', 'וואו!', 'יש!', 'כל הכבוד לך!', 'איזה יופי!', 'מהמם!'];
  let lastCheer = 0;
  sfx.cheer = HP.cheer = function (text) {
    if (muted || !('speechSynthesis' in window)) return;
    const now = (window.performance && performance.now()) || 0;
    if (now - lastCheer < 1200) return; // don't talk over ourselves
    lastCheer = now;
    try {
      const phrases = Array.isArray(text) ? text : (text ? [text] : CHEERS);
      const say = phrases[Math.floor(Math.random() * phrases.length)];
      const u = new SpeechSynthesisUtterance(say);
      u.lang = 'he-IL'; u.rate = 1.0; u.pitch = 1.3; u.volume = 0.9;
      if (!heVoices.length) loadVoices();
      const v = heVoices.find((x) => /he([-_]|$)/i.test(x.lang)) || heVoices.find((x) => /iw/i.test(x.lang));
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* unsupported — stay silent */ }
  };

  /* ---------------- personal bests (shown as 🏆 on the games menu) ---------------- */
  // HP.best(key)        → the stored best (0 if none)
  // HP.best(key, value) → stores value if it beats the best; returns true when it is a new record
  HP.best = function (key, value) {
    let b = 0; try { b = +localStorage.getItem('hpBest.' + key) || 0; } catch (e) { /* private mode */ }
    if (value == null) return b;
    if (value <= b) return false;
    try { localStorage.setItem('hpBest.' + key, value); } catch (e) { /* private mode */ }
    return true;
  };

  /* ---------------- UI ---------------- */
  HP.ui = function (opts) {
    const css = document.createElement('style');
    css.textContent = `
      html,body{margin:0;padding:0;width:100%;height:100%;height:100dvh;overflow:hidden;position:fixed;inset:0;background:#0b0a2e;font-family:'Rubik','Arial Hebrew','Heebo',system-ui,'Trebuchet MS',sans-serif;touch-action:none;overscroll-behavior:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
      canvas{display:block;touch-action:none}
      .hp-btn{position:fixed;top:calc(14px + env(safe-area-inset-top));width:72px;height:72px;border-radius:50%;border:4px solid #ffd76a;background:rgba(40,25,90,.75);color:#fff;font-size:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;box-shadow:0 4px 14px rgba(0,0,0,.4);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
      .hp-btn:active{transform:scale(.92)}
      .hp-score{position:fixed;top:calc(14px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);padding:8px 26px;border-radius:40px;background:rgba(40,25,90,.75);border:4px solid #ffd76a;color:#fff;font-size:44px;font-weight:bold;z-index:10;display:flex;gap:14px;align-items:center;text-shadow:0 2px 0 #000}
      .hp-score .pop{animation:hpPop .35s}
      @keyframes hpPop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
      .hp-start{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;background:radial-gradient(ellipse at center,rgba(30,20,80,.25),rgba(5,3,25,.7));color:#fff;text-align:center;cursor:pointer}
      .hp-title{font-size:min(9vw,72px);font-weight:bold;color:#ffd76a;text-shadow:0 4px 0 #7a3b00,0 0 30px rgba(255,200,80,.6);margin:0 10px 10px}
      .hp-play{width:150px;height:150px;border-radius:50%;background:linear-gradient(#ffe48a,#ffb020);border:6px solid #fff;font-size:80px;display:flex;align-items:center;justify-content:center;color:#7a3b00;box-shadow:0 0 40px rgba(255,210,90,.8);animation:hpPulse 1.2s infinite;margin:18px}
      @keyframes hpPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
      .hp-hint{font-size:40px;opacity:.95;letter-spacing:6px}
      .hp-banner{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%) scale(0);font-size:min(14vw,120px);z-index:15;pointer-events:none;transition:transform .35s cubic-bezier(.3,1.8,.5,1);text-shadow:0 0 30px #ffd76a}
      .hp-banner.show{transform:translate(-50%,-50%) scale(1)}
    `;
    document.head.appendChild(css);
    // RTL layout: home/back lives top-right (natural start of a Hebrew line), mute top-left.
    const home = document.createElement('a');
    home.className = 'hp-btn';
    home.style.right = 'calc(14px + env(safe-area-inset-right))';
    home.href = opts.home || '../index.html';
    home.textContent = '🏰';
    home.title = 'חזרה לתפריט';
    home.style.textDecoration = 'none';
    document.body.appendChild(home);
    const mute = document.createElement('div');
    mute.className = 'hp-btn';
    mute.style.left = 'calc(14px + env(safe-area-inset-left))';
    mute.id = 'muteBtn';
    const setIcon = () => (mute.textContent = sfx.isMuted() ? '🔇' : '🔊');
    setIcon();
    mute.addEventListener('pointerdown', (e) => { e.stopPropagation(); sfx.init(); sfx.setMuted(!sfx.isMuted()); setIcon(); });
    document.body.appendChild(mute);
    const score = document.createElement('div');
    score.className = 'hp-score';
    score.innerHTML = `<span>${opts.icon || '⭐'}</span><span id="scoreNum">0</span>`;
    document.body.appendChild(score);
    const num = score.querySelector('#scoreNum');
    const banner = document.createElement('div');
    banner.className = 'hp-banner';
    document.body.appendChild(banner);
    const start = document.createElement('div');
    start.className = 'hp-start';
    start.id = 'startScreen';
    start.innerHTML = `<div class="hp-title">${opts.title}</div><div class="hp-play">▶</div><div class="hp-hint">${opts.hint || ''}</div>`;
    document.body.appendChild(start);
    start.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sfx.init();
      start.style.display = 'none';
      opts.onStart && opts.onStart();
    });
    window.addEventListener('keydown', (e) => {
      if (start.style.display !== 'none' && (e.key === 'Enter' || e.key === ' ')) { sfx.init(); start.style.display = 'none'; opts.onStart && opts.onStart(); }
    });
    let bannerT = null;
    return {
      setScore(v) {
        num.textContent = v;
        num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
      },
      setIcon(i) { score.firstElementChild.textContent = i; },
      banner(text, ms = 1600) {
        banner.textContent = text;
        banner.classList.add('show');
        clearTimeout(bannerT);
        bannerT = setTimeout(() => banner.classList.remove('show'), ms);
      },
      started: () => start.style.display === 'none',
    };
  };

  /* ---------------- input: keys + pointer ---------------- */
  HP.input = function () {
    const keys = {};
    const st = { keys, pointer: null, down: false };
    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); });
    window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));
    const set = (e) => (st.pointer = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1, px: e.clientX, py: e.clientY });
    window.addEventListener('pointerdown', (e) => { st.down = true; set(e); });
    window.addEventListener('pointermove', (e) => { if (st.down || e.pointerType === 'mouse') set(e); });
    window.addEventListener('pointerup', () => (st.down = false));
    window.addEventListener('pointercancel', () => (st.down = false));
    st.axis = function () {
      let x = 0, y = 0;
      if (keys['arrowleft'] || keys['a']) x -= 1;
      if (keys['arrowright'] || keys['d']) x += 1;
      if (keys['arrowup'] || keys['w']) y += 1;
      if (keys['arrowdown'] || keys['s']) y -= 1;
      return { x, y, any: x !== 0 || y !== 0 };
    };
    return st;
  };

  // project a normalized-device pointer onto the z = planeZ plane
  HP.pointerToPlane = function (camera, p, planeZ = 0) {
    const v = new THREE.Vector3(p.x, p.y, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (planeZ - camera.position.z) / dir.z;
    return camera.position.clone().addScaledVector(dir, t);
  };

  /* ---------------- iPad / touch hardening ---------------- */
  // These run on every game page (which loads this file) to make Safari behave like a
  // native fullscreen game: no pinch-zoom, no double-tap zoom, no rubber-band scroll,
  // no long-press callout. The menu page handles its own (lighter) locking inline.
  HP.lockTouch = function () {
    const stop = (e) => e.preventDefault();
    // pinch-zoom (iOS Safari gesture events)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
    // multi-touch pinch + rubber-band: the whole page is a canvas game, nothing should scroll
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || e.cancelable) e.preventDefault(); }, { passive: false });
    // double-tap-to-zoom
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = e.timeStamp || performance.now();
      if (now - lastTouch < 350) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
    document.addEventListener('dblclick', stop, { passive: false });
    // long-press callout / context menu
    document.addEventListener('contextmenu', stop);
  };
  if (document.readyState !== 'loading') HP.lockTouch();
  else document.addEventListener('DOMContentLoaded', HP.lockTouch);

  // Unlock/resume WebAudio on the very first user interaction (iOS requires a gesture),
  // and resume again whenever the app comes back to the foreground.
  const unlock = () => sfx.init();
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sfx.init(); });

  window.__hpErrors = [];
  window.addEventListener('error', (e) => window.__hpErrors.push(String(e.message)));
})();
