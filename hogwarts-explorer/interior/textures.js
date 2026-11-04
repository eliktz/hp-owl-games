/* Procedural canvas textures for the castle interior — all drawn here at runtime,
 * no downloaded images. Each returns a THREE.CanvasTexture; many also hand back a
 * matching grayscale bumpMap so the stone/wood reads with a little surface relief. */
(function (HPI) {
  const T = HPI.T;
  function cvs(size, draw) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size); return c;
  }
  function tex(canvas, rep = 1) {
    const t = new T.CanvasTexture(canvas);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep);
    t.anisotropy = 4; return t;
  }
  // value-noise-ish mottling used by several surfaces
  function blobs(g, s, n, col, rmin, rmax, a) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = rmin + Math.random() * (rmax - rmin);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', '0'));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }

  const cache = {};
  // ashlar-stone palettes, so each part of the castle reads with its own mood:
  // the violet main halls, the cold damp dungeon, warm brown library/kitchens, and
  // the blue night-stone of the towers. Each keeps the same block layout, re-tinted.
  const STONE = {
    hall:    { fill: '#4a4668', hue: 258, sat: 16, lo: 27, mortar: '#2b2740', dark: '20,16,36', lite: '150,140,185' },
    dungeon: { fill: '#39434c', hue: 196, sat: 12, lo: 18, mortar: '#192530', dark: '8,14,20',   lite: '120,150,160' },
    warm:    { fill: '#574a3e', hue: 30,  sat: 18, lo: 26, mortar: '#2c2118', dark: '28,18,8',    lite: '200,170,120' },
    tower:   { fill: '#3e3f63', hue: 232, sat: 22, lo: 24, mortar: '#1e1f38', dark: '10,12,30',   lite: '150,160,210' },
    charm:   { fill: '#45587e', hue: 212, sat: 22, lo: 30, mortar: '#20293f', dark: '14,20,38',   lite: '170,190,235' },
    sage:    { fill: '#44584a', hue: 150, sat: 15, lo: 28, mortar: '#202c25', dark: '14,26,18',   lite: '165,205,175' },
  };
  const TX = {
    // mortared ashlar stone blocks (walls / floors). `variant` picks a palette above.
    // Quarried-granite look: tight running-bond courses, each block lightly flecked with
    // fine LOW-CONTRAST grain + a couple of faint sedimentary striations and a soft
    // top-left bevel. Deliberately subtle — no dark craters, no big "cheese" blobs.
    stone(rep = 3, variant = 'hall') {
      const P = STONE[variant] || STONE.hall, ck = 'stone_' + variant;
      if (cache[ck]) return clone(cache[ck], rep);
      const S = 256, rows = 4, cols = 3, bh = S / rows, bw = S / cols;
      const block = (g, bx, by, light) => {
        g.fillStyle = `hsl(${P.hue},${P.sat}%,${light}%)`;
        g.fillRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
        // fine granite grain — many tiny, very low-contrast flecks (never reads as holes)
        for (let i = 0; i < 18; i++) {
          const x = bx + 2 + Math.random() * (bw - 4), y = by + 2 + Math.random() * (bh - 4);
          g.fillStyle = `hsla(${P.hue},${P.sat}%,${light + (Math.random() - 0.5) * 14}%,0.09)`;
          g.fillRect(x, y, 0.6 + Math.random() * 1.1, 0.6 + Math.random() * 1.1);
        }
        // a couple of faint horizontal striations (quarried sedimentary banding)
        for (let i = 0; i < 2; i++) {
          const y = by + 4 + Math.random() * (bh - 8);
          g.strokeStyle = `hsla(${P.hue},${P.sat}%,${light - 6}%,0.10)`; g.lineWidth = 1;
          g.beginPath(); g.moveTo(bx + 2, y); g.lineTo(bx + bw - 2, y + (Math.random() - 0.5) * 3); g.stroke();
        }
        // soft chiselled bevel: highlight along top+left, shadow along bottom+right
        g.fillStyle = `hsla(${P.hue},${P.sat}%,${light + 13}%,0.40)`;
        g.fillRect(bx + 1.5, by + 1.5, bw - 3, 1.4); g.fillRect(bx + 1.5, by + 1.5, 1.4, bh - 3);
        g.fillStyle = `rgba(${P.dark},0.34)`;
        g.fillRect(bx + 1.5, by + bh - 2.5, bw - 3, 1.4); g.fillRect(bx + bw - 2.5, by + 1.5, 1.4, bh - 3);
      };
      const col = cvs(S, (g, s) => {
        g.fillStyle = P.mortar; g.fillRect(0, 0, s, s);            // recessed mortar fills the joints
        for (let r = 0; r < rows; r++) {
          const off = (r % 2) * (bw / 2);
          for (let c = -1; c <= cols; c++) block(g, c * bw + off, r * bh, P.lo + 2 + Math.random() * 6);
        }
      });
      const bump = cvs(S, (g, s) => {
        g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, s);
        g.strokeStyle = '#3a3a3a'; g.lineWidth = 4;                // mortar grooves sit lower
        for (let r = 0; r < rows; r++) {
          const off = (r % 2) * (bw / 2); g.beginPath(); g.moveTo(0, r * bh); g.lineTo(s, r * bh); g.stroke();
          for (let c = -1; c <= cols; c++) { const bx = c * bw + off; g.beginPath(); g.moveTo(bx, r * bh); g.lineTo(bx, r * bh + bh); g.stroke(); }
        }
      });
      cache[ck] = { col, bump };
      return clone(cache[ck], rep);
    },
    // polished marble for the entrance-hall floor + grand staircase
    marble(rep = 2) {
      const col = cvs(256, (g, s) => {
        g.fillStyle = '#9b96b0'; g.fillRect(0, 0, s, s);
        blobs(g, s, 60, 'rgba(130,124,152,A)', 10, 60, '0.5');
        g.strokeStyle = 'rgba(60,54,82,0.4)'; g.lineWidth = 1.2;
        for (let i = 0; i < 10; i++) { // grey veins
          g.beginPath(); let x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y);
          for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
          g.stroke();
        }
      });
      return { map: tex(col, rep) };
    },
    // dark oak planks for tables, benches, shelves, doors
    wood(rep = 2, tint = '#3a2618') {
      const col = cvs(256, (g, s) => {
        g.fillStyle = tint; g.fillRect(0, 0, s, s);
        for (let p = 0; p < 6; p++) {
          const y0 = (p / 6) * s;
          g.fillStyle = `hsl(26,38%,${14 + Math.random() * 8}%)`; g.fillRect(0, y0 + 1, s, s / 6 - 2);
          g.strokeStyle = 'rgba(10,6,2,0.6)'; g.lineWidth = 2;
          for (let k = 0; k < 5; k++) { // grain streaks
            g.beginPath(); g.moveTo(0, y0 + Math.random() * (s / 6));
            g.bezierCurveTo(s * 0.3, y0 + Math.random() * (s / 6), s * 0.7, y0 + Math.random() * (s / 6), s, y0 + Math.random() * (s / 6));
            g.stroke();
          }
        }
      });
      const bump = cvs(256, (g, s) => { g.fillStyle = '#7d7d7d'; g.fillRect(0, 0, s, s); for (let p = 1; p < 6; p++) { g.strokeStyle = '#303030'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, p * s / 6); g.lineTo(s, p * s / 6); g.stroke(); } });
      return { map: tex(col, rep), bump: tex(bump, rep) };
    },
    // house banner — coloured field, gold border, simple painted crest
    banner(field, crest) {
      const c = cvs(128, (g, s) => {
        const grd = g.createLinearGradient(0, 0, 0, s);
        grd.addColorStop(0, shade(field, 1.15)); grd.addColorStop(1, shade(field, 0.7));
        g.fillStyle = grd; g.fillRect(0, 0, s, s);
        g.strokeStyle = '#d9b24a'; g.lineWidth = 8; g.strokeRect(6, 6, s - 12, s - 12);
        g.font = '64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(crest, s / 2, s * 0.52);
      });
      return new T.CanvasTexture(c);
    },
    // stained-glass window — leaded panes in jewel tones that glow when backlit
    stained(hue) {
      const c = cvs(128, (g, s) => {
        g.fillStyle = '#10101a'; g.fillRect(0, 0, s, s);
        const n = 4, cell = s / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const light = 45 + Math.random() * 35, h = (hue + (Math.random() - 0.5) * 50 + 360) % 360;
          g.fillStyle = `hsl(${h},85%,${light}%)`;
          g.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
        }
        // leading
        g.strokeStyle = '#05050a'; g.lineWidth = 5;
        for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, s); g.moveTo(0, i * cell); g.lineTo(s, i * cell); g.stroke(); }
      });
      return new T.CanvasTexture(c);
    },
    // a window view: 'day' = sunny blue sky with clouds + sun, 'night' = starry sky + moon.
    // Backlit (MeshBasic, fog:false) so it glows like real glass against the dim stone.
    sky(mode = 'day') {
      const c = cvs(128, (g, s) => {
        const grd = g.createLinearGradient(0, 0, 0, s);
        if (mode === 'night') { grd.addColorStop(0, '#0a0b28'); grd.addColorStop(1, '#241a52'); }
        else { grd.addColorStop(0, '#6fb7ef'); grd.addColorStop(0.6, '#bfe3ff'); grd.addColorStop(1, '#eaf6ff'); }
        g.fillStyle = grd; g.fillRect(0, 0, s, s);
        if (mode === 'night') {
          for (let i = 0; i < 70; i++) { g.globalAlpha = 0.3 + Math.random() * 0.7; g.fillStyle = '#eef'; const r = Math.random() * 1.4 + 0.3; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill(); }
          g.globalAlpha = 1; g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(s * 0.72, s * 0.26, 13, 0, 7); g.fill();
          g.fillStyle = '#241a52'; g.beginPath(); g.arc(s * 0.78, s * 0.22, 11, 0, 7); g.fill(); // crescent bite
        } else {
          g.fillStyle = 'rgba(255,250,210,0.95)'; g.beginPath(); g.arc(s * 0.74, s * 0.26, 14, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.9)';
          [[0.28, 0.4, 16], [0.5, 0.62, 20], [0.2, 0.7, 13]].forEach(([x, y, r]) => {
            for (const [dx, dy, rr] of [[0, 0, 1], [0.6, 0.1, 0.8], [-0.6, 0.1, 0.8], [0.3, -0.2, 0.7]])
              { g.beginPath(); g.arc((x + dx * r / s) * s, (y + dy * r / s) * s, r * rr, 0, 7); g.fill(); }
          });
        }
      });
      return new T.CanvasTexture(c);
    },
    // a woven rug: coloured field, patterned border + a simple central medallion
    rug(field = '#5a2740', border = '#d9b24a') {
      const c = cvs(128, (g, s) => {
        g.fillStyle = shade(field, 0.9); g.fillRect(0, 0, s, s);
        g.fillStyle = field; g.fillRect(8, 8, s - 16, s - 16);
        g.strokeStyle = border; g.lineWidth = 4; g.strokeRect(12, 12, s - 24, s - 24);
        g.strokeStyle = shade(border, 0.7); g.lineWidth = 2; g.strokeRect(20, 20, s - 40, s - 40);
        // central medallion
        g.save(); g.translate(s / 2, s / 2); g.strokeStyle = border; g.lineWidth = 3;
        for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -s * 0.22); g.lineTo(s * 0.12, 0); g.lineTo(0, s * 0.22); g.stroke(); }
        g.fillStyle = border; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.restore();
        // corner diamonds
        [[26, 26], [s - 26, 26], [26, s - 26], [s - 26, s - 26]].forEach(([x, y]) => { g.fillStyle = border; g.save(); g.translate(x, y); g.rotate(0.78); g.fillRect(-4, -4, 8, 8); g.restore(); });
      });
      return new T.CanvasTexture(c);
    },
    // a shelf-worth of colourful book spines
    books() {
      const c = cvs(256, (g, s) => {
        g.fillStyle = '#17110c'; g.fillRect(0, 0, s, s);
        let x = 0;
        while (x < s) {
          const w = 8 + Math.random() * 16, h = s * (0.78 + Math.random() * 0.2);
          g.fillStyle = `hsl(${Math.random() * 360},${40 + Math.random() * 30}%,${22 + Math.random() * 24}%)`;
          g.fillRect(x + 1, s - h, w - 2, h);
          g.fillStyle = 'rgba(210,180,90,0.7)'; // gilt band
          g.fillRect(x + 1, s - h * 0.8, w - 2, 2);
          x += w;
        }
      });
      return tex(c, 1);
    },
  };

  function clone(src, rep) { return { map: tex(src.col, rep), bump: tex(src.bump, rep) }; }
  function shade(hex, f) {
    const c = new T.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString();
  }
  HPI.tex = TX;
  // house palette reused by banners, flames, carpets everywhere inside
  HPI.HOUSES = [
    { key: 'gryf', field: 0x7a1420, trim: 0xd9b24a, crest: '🦁' },
    { key: 'slyt', field: 0x1a5236, trim: 0xc9cdd2, crest: '🐍' },
    { key: 'rave', field: 0x1b3a6b, trim: 0xb08a2e, crest: '🦅' },
    { key: 'huff', field: 0xb8902a, trim: 0x2a2320, crest: '🦡' },
  ];
})(window.HPI);
