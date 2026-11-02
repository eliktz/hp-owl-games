/* map/mapart.js — original hand-drawn-style parchment map, drawn entirely in code
 * (no copied artwork). Returns an <svg> string on a 1000×720 canvas; HTML location
 * markers are layered on top by map.js, so this is purely the illustrated backdrop:
 * aged parchment, inked castle + towers, lake, forest, paths, courtyard, compass.
 * Palette is warm sepia ink on toasted vellum to feel like a wizard's chart. */
(function () {
  const INK = '#5a4327', INK2 = '#7a5b34', GOLD = '#b9842f';

  // a slightly wavy polyline → gives strokes a quill-drawn wobble
  function wig(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '); }

  // a little pine tree at (x,y) scaled by s
  function tree(x, y, s) {
    const w = 11 * s, h = 22 * s;
    return `<g stroke="${INK}" stroke-width="1.4" stroke-linejoin="round">`
      + `<path d="M${x} ${y - h} L${x - w} ${y} L${x + w} ${y} Z" fill="#8bab73"/>`
      + `<path d="M${x} ${y - h * 1.4} L${x - w * 0.7} ${y - h * 0.5} L${x + w * 0.7} ${y - h * 0.5} Z" fill="#9cba84"/>`
      + `<rect x="${x - 2 * s}" y="${y}" width="${4 * s}" height="${7 * s}" fill="#7a5b34" stroke="none"/></g>`;
  }

  // a stone tower: body + battlements + conical roof
  function tower(x, y, w, h, roof) {
    const b = [];
    for (let i = 0; i <= w; i += w / 4) b.push(`<rect x="${x + i - w / 10}" y="${y - h - 6}" width="${w / 8}" height="7" fill="#c9b184" stroke="${INK}" stroke-width="1"/>`);
    return `<g>`
      + `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="#d8c293" stroke="${INK}" stroke-width="1.6"/>`
      + b.join('')
      + (roof ? `<path d="M${x - 3} ${y - h - 6} L${x + w / 2} ${y - h - 6 - roof} L${x + w + 3} ${y - h - 6} Z" fill="#8a5a3a" stroke="${INK}" stroke-width="1.4"/>` : '')
      + `<rect x="${x + w / 2 - 3} " y="${y - h * 0.55}" width="6" height="10" rx="2" fill="#4a3a26"/></g>`;
  }

  function svg() {
    const trees = [];
    // forest sweep across the lower-left (deterministic jitter, no randomness)
    for (let i = 0; i < 46; i++) {
      const a = i * 2.3;
      const x = 120 + (i % 10) * 24 + Math.sin(a) * 10;
      const y = 470 + Math.floor(i / 10) * 30 + Math.cos(a * 1.7) * 12;
      trees.push(tree(x, y, 0.8 + (i % 3) * 0.18));
    }
    // a few pines hugging the right edge too (forest wraps the grounds)
    for (let i = 0; i < 8; i++) trees.push(tree(905 + Math.sin(i) * 12, 300 + i * 40, 0.7));

    const stars = [];
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 8, y = 120; // decorative ink stars near the compass
      stars.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="${GOLD}"/>`);
    }

    return `<svg viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="mapsvg">
<defs>
  <radialGradient id="pg" cx="50%" cy="42%" r="75%">
    <stop offset="0%" stop-color="#f3e2b7"/><stop offset="60%" stop-color="#e7cf96"/>
    <stop offset="100%" stop-color="#cdae73"/>
  </radialGradient>
  <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#8fcfe0"/><stop offset="100%" stop-color="#4f9fc4"/>
  </linearGradient>
  <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="6"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0 0.1  0 0 0 0.09 0"/></filter>
</defs>

<!-- torn parchment sheet -->
<g filter="url(#rough)">
  <path d="M26 20 Q500 6 974 22 Q992 360 972 700 Q500 714 28 700 Q10 360 26 20 Z" fill="url(#pg)" stroke="${INK}" stroke-width="3"/>
</g>
<rect x="0" y="0" width="1000" height="720" filter="url(#grain)" opacity="0.5" pointer-events="none"/>
<!-- inner decorative frame -->
<path d="M40 40 Q500 30 960 42 Q968 360 958 680 Q500 690 44 680 Q34 360 40 40 Z" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-dasharray="1 10" stroke-linecap="round"/>

<!-- title banner (Hebrew) -->
<g>
  <path d="M330 44 q170 -16 340 0 l-14 34 q-156 12 -312 0 Z" fill="#7a2f33" stroke="${INK}" stroke-width="1.6"/>
  <text x="500" y="72" text-anchor="middle" font-family="serif" font-size="30" fill="#ffe9b0" font-weight="bold">מפת הוגוורטס</text>
</g>

<!-- lake -->
<g filter="url(#rough)">
  <path d="M70 400 q-14 -60 60 -70 q80 -12 120 26 q40 44 -8 92 q-70 54 -140 20 q-44 -22 -32 -68 Z" fill="url(#water)" stroke="${INK}" stroke-width="1.8"/>
</g>
<path d="M95 405 q40 10 90 2 M85 440 q60 14 140 2 M110 470 q40 8 90 0" fill="none" stroke="#e8f6fb" stroke-width="1.4" opacity="0.7" stroke-linecap="round"/>

<!-- winding paths (quill-wobbled) -->
<g fill="none" stroke="${INK2}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9" opacity="0.8">
  <path d="${wig([[500, 300], [498, 340], [520, 380], [540, 420]])}"/>
  <path d="${wig([[540, 300], [640, 340], [740, 390]])}"/>
  <path d="${wig([[500, 330], [380, 360], [280, 300]])}"/>
  <path d="${wig([[560, 420], [660, 500], [700, 540]])}"/>
  <path d="${wig([[460, 420], [360, 480], [300, 520]])}"/>
</g>

${trees.join('')}

<!-- forest label plate -->
<text x="250" y="640" text-anchor="middle" font-family="serif" font-size="17" fill="${INK}" opacity="0.8">היער האסור</text>

<!-- greenhouse -->
<g stroke="${INK}" stroke-width="1.5">
  <path d="M206 300 l34 -26 l34 26 l0 34 l-68 0 Z" fill="#bfe6c6"/>
  <path d="M240 274 l0 60 M206 312 l68 0" stroke="#5f8a66"/>
</g>

<!-- courtyard: ringed stone circle + fountain -->
<g>
  <circle cx="500" cy="324" r="40" fill="#e3cf9e" stroke="${INK}" stroke-width="2"/>
  <circle cx="500" cy="324" r="40" fill="none" stroke="${GOLD}" stroke-width="1" stroke-dasharray="3 6"/>
  <circle cx="500" cy="324" r="10" fill="#9fc6d8" stroke="${INK}" stroke-width="1.4"/>
</g>

<!-- the castle: a huddle of towers + a long great hall -->
<g>
  <rect x="350" y="150" width="120" height="70" rx="3" fill="#d8c293" stroke="${INK}" stroke-width="1.8"/>
  <path d="M350 150 L410 120 L470 150 Z" fill="#8a5a3a" stroke="${INK}" stroke-width="1.4"/>
  ${tower(460, 230, 40, 110, 40)}
  ${tower(540, 220, 34, 120, 34)}
  ${tower(600, 236, 46, 96, 40)}
  ${tower(700, 230, 42, 110, 44)}
  ${tower(420, 226, 30, 90, 30)}
  <rect x="488" y="150" width="60" height="50" rx="3" fill="#d8c293" stroke="${INK}" stroke-width="1.6"/>
</g>

<!-- Hagrid's hut: round thatched cottage -->
<g stroke="${INK}" stroke-width="1.6">
  <ellipse cx="800" cy="400" rx="34" ry="26" fill="#9a6b3e"/>
  <path d="M762 392 q38 -40 76 0 Z" fill="#b98a4a"/>
  <rect x="792" y="392" width="16" height="22" fill="#5a3b22"/>
  <path d="M820 372 q6 -14 0 -22" fill="none" stroke="#999" stroke-width="2"/>
</g>

<!-- Quidditch pitch: oval + goal hoops -->
<g stroke="${INK}" stroke-width="1.6">
  <ellipse cx="700" cy="565" rx="70" ry="38" fill="#8fb972"/>
  <ellipse cx="700" cy="565" rx="70" ry="38" fill="none" stroke="#e9f3dd" stroke-width="1.2"/>
  ${[650, 700, 750].map((hx) => `<circle cx="${hx}" cy="535" r="7" fill="none" stroke="${GOLD}" stroke-width="2.4"/><line x1="${hx}" y1="542" x2="${hx}" y2="560" stroke="${GOLD}" stroke-width="2.4"/>`).join('')}
</g>

<!-- compass rose -->
<g transform="translate(92 150)">
  <circle r="34" fill="none" stroke="${INK}" stroke-width="1.6"/>
  <path d="M0 -42 L8 0 L0 42 L-8 0 Z" fill="${INK}"/>
  <path d="M-42 0 L0 -8 L42 0 L0 8 Z" fill="${INK2}"/>
  <text x="0" y="-46" text-anchor="middle" font-family="serif" font-size="14" fill="${INK}">צ</text>
</g>
${stars.join('')}
</svg>`;
  }

  window.HPMapArt = { svg };
})();
