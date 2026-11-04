/* Draws an original chibi professor avatar onto a 2D canvas, from the same palettes
 * the 3D chibi teachers use (defined here independently — no copied art). Used by the
 * lesson overlay for the teacher's greeting portrait + its little talking bob. */
(function () {
  const PAL = {
    snape:    { skin: '#e8d6c4', hair: '#15101a', robe: '#14121a', mouth: '#7a4030', long: true, brows: true },
    flitwick: { skin: '#f1d2b0', hair: '#e8e4ea', robe: '#3a2f5e', mouth: '#9a5540', beard: true, small: true },
    sprout:   { skin: '#e9b58a', hair: '#b9b2a6', robe: '#5a4326', mouth: '#9a5540', hat: '#6a5330' },
    sinistra: { skin: '#b98a66', hair: '#15100c', robe: '#1b2456', mouth: '#7a4030', stars: true },
    mcgon:    { skin: '#e6c3a0', hair: '#2a1d16', robe: '#1a4030', mouth: '#8a3f3c', glasses: true, hat: '#14110c', bun: true },
    defence:  { skin: '#e8c6a0', hair: '#bf9a5a', robe: '#5a4a32', mouth: '#9a5540' },
  };

  // mood: 0 = calm, up to ~1 = talking (mouth opens + tiny bob handled by caller)
  function draw(ctx, who, s, mood) {
    if (who === 'cat') return drawCat(ctx, s, mood);   // McGonagall's Animagus form
    const p = PAL[who] || PAL.defence;
    const cx = s / 2, cy = s * 0.5, hr = s * (p.small ? 0.3 : 0.27);
    ctx.clearRect(0, 0, s, s);
    // shoulders / robe
    ctx.fillStyle = p.robe;
    ctx.beginPath(); ctx.moveTo(cx - hr * 2.1, s); ctx.lineTo(cx - hr * 1.3, cy + hr * 0.5);
    ctx.lineTo(cx + hr * 1.3, cy + hr * 0.5); ctx.lineTo(cx + hr * 2.1, s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(p.robe, 1.3); ctx.fillRect(cx - hr * 0.5, cy + hr * 0.4, hr, s - (cy + hr * 0.4)); // collar gap
    // back hair halo
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(cx, cy - hr * 0.05, hr * (p.long ? 1.32 : 1.18), 0, 7); ctx.fill();
    if (p.long) ctx.fillRect(cx - hr * 1.3, cy, hr * 2.6, hr * 1.4);
    // face
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.ellipse(cx, cy, hr * 0.92, hr, 0, 0, 7); ctx.fill();
    // ears
    ctx.beginPath(); ctx.arc(cx - hr * 0.9, cy, hr * 0.18, 0, 7); ctx.arc(cx + hr * 0.9, cy, hr * 0.18, 0, 7); ctx.fill();
    // front hair / fringe
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(cx, cy - hr * 0.35, hr * 0.98, Math.PI * 1.04, Math.PI * 1.96); ctx.fill();
    if (p.bun) { ctx.beginPath(); ctx.arc(cx, cy - hr * 1.15, hr * 0.42, 0, 7); ctx.fill(); }
    // eyes
    const ey = cy - hr * 0.05, ex = hr * 0.38;
    ctx.fillStyle = '#fff'; eye(ctx, cx - ex, ey, hr * 0.2); eye(ctx, cx + ex, ey, hr * 0.2);
    ctx.fillStyle = '#1a140e';
    ctx.beginPath(); ctx.arc(cx - ex, ey + hr * 0.03, hr * 0.1, 0, 7); ctx.arc(cx + ex, ey + hr * 0.03, hr * 0.1, 0, 7); ctx.fill();
    if (p.brows) { ctx.strokeStyle = p.hair; ctx.lineWidth = hr * 0.09; brow(ctx, cx - ex, ey - hr * 0.3, ex); brow(ctx, cx + ex, ey - hr * 0.3, ex); }
    if (p.glasses) { ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = hr * 0.06; ring(ctx, cx - ex, ey, hr * 0.26); ring(ctx, cx + ex, ey, hr * 0.26); ctx.beginPath(); ctx.moveTo(cx - ex + hr * 0.26, ey); ctx.lineTo(cx + ex - hr * 0.26, ey); ctx.stroke(); }
    // rosy cheeks + nose
    ctx.fillStyle = 'rgba(255,150,170,.4)';
    ctx.beginPath(); ctx.arc(cx - ex * 1.3, ey + hr * 0.35, hr * 0.17, 0, 7); ctx.arc(cx + ex * 1.3, ey + hr * 0.35, hr * 0.17, 0, 7); ctx.fill();
    // mouth (opens with mood)
    ctx.fillStyle = p.mouth; ctx.strokeStyle = p.mouth; ctx.lineWidth = hr * 0.08;
    const my = cy + hr * 0.5, open = mood * hr * 0.22;
    if (open > hr * 0.04) { ctx.beginPath(); ctx.ellipse(cx, my, hr * 0.22, open, 0, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(cx, my - hr * 0.1, hr * 0.26, 0.2, Math.PI - 0.2); ctx.stroke(); }
    if (p.beard) { ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(cx, my + hr * 0.2, hr * 0.55, 0, Math.PI); ctx.fill(); }
    if (p.hat) { ctx.fillStyle = p.hat; ctx.beginPath(); ctx.moveTo(cx - hr * 1.2, cy - hr * 0.9); ctx.lineTo(cx + hr * 1.2, cy - hr * 0.9); ctx.lineTo(cx, cy - hr * 2.4); ctx.closePath(); ctx.fill(); ctx.fillRect(cx - hr * 1.3, cy - hr * 1.0, hr * 2.6, hr * 0.25); }
    if (p.stars) { ctx.fillStyle = '#ffe59a'; for (let i = 0; i < 5; i++) { ctx.font = (hr * 0.3) + 'px serif'; ctx.fillText('✦', cx - hr + i * hr * 0.5, cy + hr * 1.6); } }
  }
  // A chibi tabby cat (McGonagall's Animagus) — square spectacle-markings around the eyes
  // nod to her glasses; mood twitches the whiskers + opens a tiny meow.
  function drawCat(ctx, s, mood) {
    const cx = s / 2, cy = s * 0.52, hr = s * 0.3, fur = '#7a6a52', dark = '#4a3c2a';
    ctx.clearRect(0, 0, s, s);
    // ears (with pink inners)
    [-1, 1].forEach((d) => {
      ctx.fillStyle = fur; ctx.beginPath();
      ctx.moveTo(cx + d * hr * 0.75, cy - hr * 0.7); ctx.lineTo(cx + d * hr * 1.15, cy - hr * 1.5);
      ctx.lineTo(cx + d * hr * 0.2, cy - hr * 1.0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d98f9a'; ctx.beginPath();
      ctx.moveTo(cx + d * hr * 0.74, cy - hr * 0.8); ctx.lineTo(cx + d * hr * 0.95, cy - hr * 1.3);
      ctx.lineTo(cx + d * hr * 0.42, cy - hr * 0.95); ctx.closePath(); ctx.fill();
    });
    // head
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(cx, cy, hr * 1.02, hr * 0.92, 0, 0, 7); ctx.fill();
    // tabby forehead stripes
    ctx.strokeStyle = dark; ctx.lineWidth = hr * 0.08; ctx.lineCap = 'round';
    [-0.22, 0, 0.22].forEach((o) => { ctx.beginPath(); ctx.moveTo(cx + o * hr, cy - hr * 0.95); ctx.lineTo(cx + o * hr * 0.6, cy - hr * 0.5); ctx.stroke(); });
    // spectacle markings + big green eyes
    const ey = cy - hr * 0.05, ex = hr * 0.42;
    ctx.strokeStyle = dark; ctx.lineWidth = hr * 0.05;
    [-1, 1].forEach((d) => { ctx.strokeRect(cx + d * ex - hr * 0.26, ey - hr * 0.22, hr * 0.52, hr * 0.44); });
    ctx.beginPath(); ctx.moveTo(cx - hr * 0.16, ey); ctx.lineTo(cx + hr * 0.16, ey); ctx.stroke();
    ctx.fillStyle = '#8fd66a'; eye(ctx, cx - ex, ey, hr * 0.2); eye(ctx, cx + ex, ey, hr * 0.2);
    ctx.fillStyle = '#17120a'; const sl = hr * (0.05 + mood * 0.05);
    [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(cx + d * ex, ey, sl, hr * 0.17, 0, 0, 7); ctx.fill(); });
    // muzzle + pink nose + meow
    ctx.fillStyle = '#9b8a6f'; ctx.beginPath(); ctx.ellipse(cx, cy + hr * 0.45, hr * 0.5, hr * 0.34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d98f9a'; ctx.beginPath(); ctx.moveTo(cx - hr * 0.1, cy + hr * 0.3); ctx.lineTo(cx + hr * 0.1, cy + hr * 0.3); ctx.lineTo(cx, cy + hr * 0.42); ctx.closePath(); ctx.fill();
    const open = mood * hr * 0.14;
    if (open > hr * 0.03) { ctx.fillStyle = '#b05a5a'; ctx.beginPath(); ctx.ellipse(cx, cy + hr * 0.6, hr * 0.1, open, 0, 0, 7); ctx.fill(); }
    // whiskers (twitch with mood)
    ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = hr * 0.03; const tw = mood * hr * 0.08;
    [-1, 1].forEach((d) => { [-0.1, 0.05, 0.2].forEach((o, k) => { ctx.beginPath(); ctx.moveTo(cx + d * hr * 0.3, cy + hr * 0.45 + o * hr); ctx.lineTo(cx + d * hr * 1.3, cy + hr * (0.3 + o) - (k - 1) * tw); ctx.stroke(); }); });
  }
  function eye(c, x, y, r) { c.beginPath(); c.ellipse(x, y, r * 0.8, r, 0, 0, 7); c.fill(); }
  function brow(c, x, y, ex) { c.beginPath(); c.moveTo(x - ex * 0.5, y + 2); c.lineTo(x + ex * 0.5, y); c.stroke(); }
  function ring(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = Math.min(255, (n >> 16) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0; return 'rgb(' + r + ',' + g + ',' + b + ')'; }

  window.HPLessons = window.HPLessons || {};
  window.HPLessons.teacherAvatar = draw;
})();
