/* Charms with Professor Flitwick — swish-and-flick to make a feather float. Over three
 * rounds the child drags a finger through a glowing dashed path, touching numbered
 * waypoints in order; finishing a path sends a feather drifting up with sparkles.
 * Gentle on lifts/misses (just resets the trail), more waypoints as level/round grow. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.charms = function (host) {
    const el = HPL.el, N = 3;
    const W = 360, H = 260, HIT = 34;
    let round = 0, retries = 0;

    // canvas trace area
    const wrap = el('div', { style: 'position:relative;width:86%;max-width:380px' });
    const cv = el('canvas', { width: String(W), height: String(H), style: 'width:100%;display:block;border-radius:18px;border:3px solid #ffd76a;background:#0b0824;touch-action:none;cursor:crosshair' });
    wrap.appendChild(cv); host.stage.appendChild(wrap);
    const ctx = cv.getContext('2d');

    // soft starfield baked once
    const stars = [];
    for (let k = 0; k < 46; k++) stars.push([host.rnd(4, W - 4), host.rnd(4, H - 4), Math.random() * 1.6 + 0.4]);

    let pts = [], trail = [], next = 0, dragging = false, done = false;

    // build a swish-and-flick path for this round; more points = harder
    function makePath(r) {
      const L = host.level, extra = (L - 1) + r; // 0..4
      const mx = 50, my = 40, iw = W - mx * 2, ih = H - my * 2;
      const n = Math.min(5, 3 + Math.floor(extra / 2)); // 3..5 waypoints
      const p = [];
      const loop = (r >= 2 && L >= 2); // later/harder rounds loop
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0 : k / (n - 1);
        let x, y;
        if (loop) { const a = t * Math.PI * 1.7 - 0.4; x = W / 2 + Math.cos(a) * iw * 0.34; y = H / 2 + Math.sin(a) * ih * 0.4; }
        else { x = mx + t * iw; y = my + ih * (0.5 + Math.sin(t * Math.PI * (1 + r)) * 0.42) - (k === n - 1 ? ih * 0.3 : 0); }
        p.push({ x: Math.max(mx, Math.min(W - mx, x)), y: Math.max(my, Math.min(H - my, y)) });
      }
      return p;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0b0824'; ctx.fillRect(0, 0, W, H);
      for (const s of stars) { ctx.globalAlpha = 0.5 + Math.random() * 0.3; ctx.fillStyle = '#cfc2ff'; ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      // target dashed polyline
      ctx.save(); ctx.setLineDash([9, 9]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,215,106,.55)'; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.restore();
      // finger trail
      if (trail.length > 1) {
        ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#8ad0ff';
        ctx.shadowColor = '#8ad0ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); trail.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.shadowBlur = 0;
      }
      // numbered waypoints
      pts.forEach((p, k) => {
        const hit = k < next;
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7);
        ctx.fillStyle = hit ? '#7ef0a0' : (k === next ? '#ffd76a' : 'rgba(255,255,255,.2)');
        ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#2a1a12'; ctx.font = 'bold 20px Rubik,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(hit ? '✓' : String(k + 1), p.x, p.y + 1);
      });
    }

    function pos(e) {
      const r = cv.getBoundingClientRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
    }
    function near(p, w) { return Math.hypot(p.x - w.x, p.y - w.y) <= HIT; }

    function start(e) { if (done) return; e.preventDefault(); dragging = true; trail = []; next = 0; move(e); }
    function move(e) {
      if (!dragging || done) return; e.preventDefault();
      const p = pos(e); trail.push(p);
      if (next < pts.length && near(p, pts[next])) {
        next++;
        try { HP.sfx.soft && HP.sfx.soft(); } catch (x) {}
        if (next >= pts.length) finishRound();
      }
      draw();
    }
    function end(e) {
      if (!dragging || done) return; dragging = false;
      if (next < pts.length) { // lifted early — gentle reset
        retries++; next = 0; trail = []; draw(); host.bad();
        host.say('עוד פעם, סְוִיש וּפְלִיק!');
      }
    }

    function finishRound() {
      done = true; dragging = false; draw();
      const w = pts[pts.length - 1];
      const pr = host.stage.getBoundingClientRect(), cr = cv.getBoundingClientRect();
      host.good(cr.left - pr.left + w.x * (cr.width / W), cr.top - pr.top + w.y * (cr.height / H));
      // feather floats up off the canvas
      const f = el('div', { style: 'position:absolute;left:' + (w.x / W * 100) + '%;top:' + (w.y / H * 100) + '%;font-size:46px;transform:translate(-50%,-50%);pointer-events:none;transition:all 1.4s ease-out;filter:drop-shadow(0 0 10px #8ad0ff)' }, '🪶');
      wrap.appendChild(f);
      requestAnimationFrame(() => { f.style.top = '-40px'; f.style.opacity = '0'; f.style.transform = 'translate(-50%,-50%) rotate(28deg)'; });
      host.after(1500, () => f.remove());
      round++; host.setProgress(round, N);
      if (round >= N) return host.after(900, finish);
      host.after(1100, next2);
    }

    function next2() {
      done = false; pts = makePath(round); trail = []; next = 0;
      host.say('סְוִיש וּפְלִיק! עקוב אחרי הנתיב');
      draw();
    }

    function finish() {
      host.confetti(); host.say('הנוצה מרחפת! 🪶');
      const stars = retries <= 1 ? 3 : retries <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);

    host.setProgress(0, N);
    next2();
  };
})();
