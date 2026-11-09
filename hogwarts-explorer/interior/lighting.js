/* Interior atmosphere: torch/fire flicker, a small pool of real point-lights that
 * follow the nearest flames to the player (so iPad never runs more than ~6 real
 * lights), cheap fake light-shafts, drifting dust motes, and the enchanted ceiling.
 * All flames themselves are emissive meshes + additive sprites — a "baked" glow that
 * reads everywhere without costing a draw-light each. */
(function (HPI) {
  const T = HPI.T;
  const flameTex = HP.glowTex;

  HPI.Lighting = function (scene, opts = {}) {
    const sources = [];                 // {pos, color, pri, flame, flicker}
    const POOL = opts.pool || 5;        // real point-lights (plus one hemi below)
    const pool = [];
    const hemi = new T.HemisphereLight(0x6a64a0, 0x2a2030, 0.88);   // a touch dimmer + cooler so the warm flame pools read
    scene.add(hemi);
    const fill = new T.AmbientLight(0x322e46, 0.35); scene.add(fill); // soft floor-level fill
    for (let i = 0; i < POOL; i++) {
      const pl = new T.PointLight(0xffb060, 0, 26, 2);
      pl.visible = false; scene.add(pl); pool.push(pl);
    }

    // a wall torch: iron bracket + glowing flame mesh + additive halo sprite
    function addTorch(x, y, z, color = 0xffa848, pri = 0) {
      const g = new T.Group(); g.position.set(x, y, z);
      const brMat = HPI.mat('iron', () => new T.MeshStandardMaterial({ color: 0x20201e, roughness: 0.7, metalness: 0.6 }));
      const stem = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 0.8, 6), brMat); stem.rotation.x = 0.5; stem.position.set(0, -0.2, 0.2); g.add(stem);
      const cup = new T.Mesh(new T.ConeGeometry(0.18, 0.3, 8, 1, true), brMat); cup.position.set(0, 0.1, 0.42); g.add(cup);
      const flame = new T.Mesh(new T.ConeGeometry(0.16, 0.5, 8), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false }));
      flame.position.set(0, 0.42, 0.42); g.add(flame);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: flameTex, color, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      halo.scale.setScalar(2.4); halo.position.copy(flame.position); g.add(halo);
      scene.add(g);
      sources.push({ pos: new T.Vector3(x, y + 0.4, z + 0.42), color, pri, flame, halo, ph: Math.random() * 7 });
    }

    // a hearth fire — a cluster of flame tongues + a strong, high-priority light
    function addFire(x, y, z, scale = 1) {
      const g = new T.Group(); g.position.set(x, y, z);
      for (let i = 0; i < 6; i++) {
        const f = new T.Mesh(new T.ConeGeometry(0.18 * scale, (0.5 + Math.random() * 0.5) * scale, 7),
          new T.MeshBasicMaterial({ color: i % 2 ? 0xffd05a : 0xff7a2a, transparent: true, opacity: 0.9, fog: false }));
        f.position.set((Math.random() - 0.5) * 0.9 * scale, 0.3 * scale, (Math.random() - 0.5) * 0.4 * scale);
        f.userData.ph = Math.random() * 7; f.userData.base = f.scale.y; g.add(f);
      }
      const halo = new T.Sprite(new T.SpriteMaterial({ map: flameTex, color: 0xff8a3a, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      halo.scale.setScalar(4 * scale); halo.position.y = 0.4 * scale; g.add(halo);
      scene.add(g);
      const src = { pos: new T.Vector3(x, y + 0.6, z), color: 0xff8030, pri: 40, flame: g, halo, ph: Math.random() * 7, fire: true };
      sources.push(src); return g;
    }

    // cheap volumetric shaft: a soft additive cone tilted from a window
    function addShaft(x, y, z, h = 10, r = 2.4, rot = 0) {
      const m = new T.Mesh(new T.ConeGeometry(r, h, 10, 1, true),
        new T.MeshBasicMaterial({ map: flameTex, color: 0xfff0c0, transparent: true, opacity: 0.08, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
      m.position.set(x, y, z); m.rotation.z = rot; scene.add(m); return m;
    }

    // drifting dust motes inside a box volume (additive points)
    function dust(cx, cy, cz, w, hgt, d, n = 160) {
      const pos = new Float32Array(n * 3), seed = [];
      for (let i = 0; i < n; i++) {
        const x = cx + (Math.random() - 0.5) * w, y = cy + Math.random() * hgt, z = cz + (Math.random() - 0.5) * d;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        seed.push({ x, y, z, p: Math.random() * 7 });
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.12, map: flameTex, color: 0xfff0d0, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
      scene.add(pts); pts.userData = { seed, n }; return pts;
    }
    const dusts = [];
    function addDust(...a) { const d = dust(...a); dusts.push(d); return d; }

    // enchanted ceiling — dark sky with drifting cloud bands + twinkling stars,
    // painted by a shader on a big flat plane high over the Great Hall.
    function enchantedCeiling(cx, cz, w, d, y) {
      const uni = { t: { value: 0 } };
      const m = new T.Mesh(new T.PlaneGeometry(w, d),
        new T.ShaderMaterial({
          uniforms: uni, side: T.DoubleSide, fog: false, transparent: true,
          vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
          fragmentShader: `uniform float t; varying vec2 vUv;
            float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
            void main(){ vec2 p=vUv;
              vec3 c=mix(vec3(0.02,0.02,0.08), vec3(0.08,0.07,0.22), p.y);
              float cl=sin(p.x*6.0+t*0.05)*0.5+sin(p.y*4.0-t*0.03)*0.5;
              c+=vec3(0.06,0.06,0.12)*smoothstep(0.2,1.0,cl);
              vec2 gp=floor(p*34.0); float st=h(gp);
              float tw=smoothstep(0.985,1.0,st)* (0.5+0.5*sin(t*2.0+st*30.0));
              c+=vec3(1.0,0.95,0.8)*tw;
              gl_FragColor=vec4(c,1.0);} `,
        }));
      m.rotation.x = Math.PI / 2; m.position.set(cx, y, cz); scene.add(m);
      ceilUni.push(uni); return m;
    }
    const ceilUni = [];

    // ---- "baked" light pools: every flame washes its wall and spills a warm pool on the
    //      floor. All of them live in ONE additive mesh (a single draw call) built lazily on
    //      the first frame, once every room has registered its walls — each quad is clipped
    //      against nearby walls so light never leaks into the room next door. ----
    const poolTex = (function () {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)');
      gr.addColorStop(0.7, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
    })();
    const extraPools = [];              // {x,z,r,color,a,y?} explicit pools (stained-glass patches…)
    function addPool(x, z, r, color, a = 0.5, y = null) { extraPools.push({ x, z, r, color, a, y }); }
    let poolMesh = null;
    const tc = new T.Color();
    function bakePools() {
      const pos = [], uv = [], col = [], idx = [];
      const nav = HPI.nav;
      function quad(p0, p1, p2, p3, u0, v0, u1, v1, color, a) {
        const n = pos.length / 3;
        pos.push(...p0, ...p1, ...p2, ...p3);
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        tc.setHex(color); for (let i = 0; i < 4; i++) col.push(tc.r * a, tc.g * a, tc.b * a);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3, n, n + 2, n + 1, n, n + 3, n + 2);   // both windings
      }
      // a floor pool centred (x,z), radius r, clipped to the walls around the sample point
      function floorPool(x, z, r, color, a, fy, sx, sz) {
        let x0 = x - r, x1 = x + r, z0 = z - r, z1 = z + r;
        for (const w of nav.wallsX) { if (sz < w.lo - 0.2 || sz > w.hi + 0.2) continue; if (w.c <= sx && w.c > x0 - 0.3) x0 = Math.max(x0, w.c + 0.3); if (w.c > sx && w.c < x1 + 0.3) x1 = Math.min(x1, w.c - 0.3); }
        for (const w of nav.wallsZ) { if (sx < w.lo - 0.2 || sx > w.hi + 0.2) continue; if (w.c <= sz && w.c > z0 - 0.3) z0 = Math.max(z0, w.c + 0.3); if (w.c > sz && w.c < z1 + 0.3) z1 = Math.min(z1, w.c - 0.3); }
        if (x1 - x0 < 0.4 || z1 - z0 < 0.4) return;
        const U = (v) => (v - (x - r)) / (2 * r), V = (v) => (v - (z - r)) / (2 * r);
        quad([x0, fy, z0], [x1, fy, z0], [x1, fy, z1], [x0, fy, z1], U(x0), V(z0), U(x1), V(z1), color, a);
      }
      for (const s of sources) {
        const px = s.pos.x, pz = s.pos.z, r = s.fire ? 7.5 : 4.6;
        // nearest wall within reach → this flame is wall-mounted: note the wall + its room-side normal
        let wall = null, bd = 1.5;
        for (const w of nav.wallsX) if (pz >= w.lo - 0.3 && pz <= w.hi + 0.3 && Math.abs(px - w.c) < bd) { bd = Math.abs(px - w.c); wall = { axis: 'x', c: w.c, n: px >= w.c ? 1 : -1 }; }
        for (const w of nav.wallsZ) if (px >= w.lo - 0.3 && px <= w.hi + 0.3 && Math.abs(pz - w.c) < bd) { bd = Math.abs(pz - w.c); wall = { axis: 'z', c: w.c, n: pz >= w.c ? 1 : -1 }; }
        const sx = wall && wall.axis === 'x' ? wall.c + wall.n * 0.9 : px, sz = wall && wall.axis === 'z' ? wall.c + wall.n * 0.9 : pz;
        const fy = nav.floorH(sx, sz), h = s.pos.y - fy;
        const fa = (s.fire ? 0.72 : 0.52) * HPI.clamp(1.25 - h / 9, 0.25, 1);
        floorPool(px, pz, r + Math.max(0, h - 4) * 0.35, s.color, fa, fy + 0.075, sx, sz);
        if (wall && !s.fire) {                    // wall wash behind the torch
          const wr = 3.1, y0 = Math.max(fy + 0.05, s.pos.y - wr - 0.4), y1 = s.pos.y + wr - 0.4, off = wall.c + wall.n * 0.29;
          const V0 = (y0 - (s.pos.y - wr - 0.4)) / (2 * wr);
          if (wall.axis === 'x') quad([off, y0, pz - wr], [off, y0, pz + wr], [off, y1, pz + wr], [off, y1, pz - wr], 0, V0, 1, 1, s.color, 0.44);
          else quad([px - wr, y0, off], [px + wr, y0, off], [px + wr, y1, off], [px - wr, y1, off], 0, V0, 1, 1, s.color, 0.44);
        }
      }
      for (const e of extraPools) floorPool(e.x, e.z, e.r, e.color, e.a, (e.y != null ? e.y : nav.floorH(e.x, e.z)) + 0.085, e.x, e.z);
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      poolMesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map: poolTex, vertexColors: true, transparent: true, depthWrite: false,
        blending: T.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      poolMesh.frustumCulled = false; poolMesh.renderOrder = 2; poolMesh.userData.cullSkip = true;
      poolMesh.raycast = function () {};          // never blocks the camera arm
      scene.add(poolMesh);
    }

    // ---- soft blob shadow that grounds a character on the floor (cheap fake contact shadow) ----
    const shadowTex = (function () {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.55, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
    })();
    const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    function blobShadow(parentScene, x, y, z, r = 1.1) {
      const m = new T.Mesh(new T.PlaneGeometry(2 * r, 2 * r), shadowMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.09, z); m.renderOrder = 3; m.raycast = function () {};
      (parentScene || scene).add(m); return m;
    }

    function update(player, t, dt) {
      if (!poolMesh) bakePools();
      poolMesh.material.color.setScalar(0.9 + 0.07 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 17.1));   // the whole castle breathes with the flames
      // flicker flames + halos
      for (const s of sources) {
        const f = 0.8 + 0.2 * Math.sin(t * 12 + s.ph) + 0.08 * Math.sin(t * 27 + s.ph * 2);
        if (s.halo) { s.halo.material.opacity = (s.fire ? 0.7 : 0.6) * f; s.halo.scale.setScalar((s.fire ? 4 : 2.4) * (0.9 + 0.15 * f)); }
        if (s.fire) { s.flame.children.forEach((c) => { if (c.isMesh) c.scale.y = c.userData.base * (0.7 + 0.5 * Math.abs(Math.sin(t * 9 + c.userData.ph))); }); }
        else if (s.flame.isMesh) { s.flame.scale.y = 0.8 + 0.3 * f; }
      }
      // assign the real light pool to the highest-scoring nearby sources
      for (const s of sources) s.score = s.pri - player.position.distanceTo(s.pos);
      sources.sort((a, b) => b.score - a.score);
      for (let i = 0; i < pool.length; i++) {
        const pl = pool[i], s = sources[i];
        if (s && s.score > -34) {
          pl.visible = true; pl.position.copy(s.pos); pl.color.setHex(s.color);
          const fl = 0.85 + 0.25 * Math.sin(t * 14 + s.ph);
          pl.intensity = (s.fire ? 3.0 : 1.9) * fl; pl.distance = s.fire ? 36 : 26;
        } else pl.visible = false;
      }
      // dust drift
      for (const d of dusts) {
        const pa = d.geometry.attributes.position, sd = d.userData.seed;
        for (let i = 0; i < d.userData.n; i++) {
          const s = sd[i];
          pa.setXYZ(i, s.x + Math.sin(t * 0.3 + s.p) * 0.5, s.y + Math.sin(t * 0.2 + s.p) * 0.3, s.z + Math.cos(t * 0.25 + s.p) * 0.5);
        }
        pa.needsUpdate = true;
      }
      for (const u of ceilUni) u.t.value = t;
    }

    return { addTorch, addFire, addShaft, addDust, enchantedCeiling, addPool, blobShadow, update, hemi, fill, sources };
  };
})(window.HPI);
