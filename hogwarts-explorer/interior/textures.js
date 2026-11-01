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
  const TX = {
    // mortared ashlar stone blocks (walls / floors of the halls)
    stone(rep = 3) {
      if (cache.stone) return clone(cache.stone, rep);
      const S = 256, mortar = '#2b2740';
      const col = cvs(S, (g, s) => {
        g.fillStyle = '#4a4668'; g.fillRect(0, 0, s, s);
        const rows = 4, bh = s / rows;
        for (let r = 0; r < rows; r++) {
          const off = (r % 2) * (s / 6);
          for (let x = -s / 6; x < s; x += s / 3) {
            const bx = x + off, by = r * bh;
            g.fillStyle = `hsl(258,16%,${26 + Math.random() * 10}%)`;
            g.fillRect(bx + 2, by + 2, s / 3 - 4, bh - 4);
          }
        }
        blobs(g, s, 90, 'rgba(20,16,36,A)', 2, 18, '0.5');
        blobs(g, s, 40, 'rgba(150,140,185,A)', 2, 10, '0.25');
      });
      const bump = cvs(S, (g, s) => {
        g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
        g.strokeStyle = mortar; g.lineWidth = 5;
        const rows = 4, bh = s / rows;
        for (let r = 0; r < rows; r++) {
          const off = (r % 2) * (s / 6); g.strokeRect(0, r * bh, s, 0.1);
          for (let x = -s / 6; x < s; x += s / 3) g.strokeRect(x + off, r * bh, s / 3, bh);
        }
        blobs(g, s, 60, 'rgba(40,40,40,A)', 2, 12, '0.5');
      });
      cache.stone = { col, bump };
      return clone(cache.stone, rep);
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
