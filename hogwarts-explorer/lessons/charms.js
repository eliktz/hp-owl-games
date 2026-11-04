/* Charms with Professor Flitwick — swish-and-flick to make a feather float. Over several
 * rounds the child drags a finger through a glowing dashed path, touching numbered
 * waypoints in order; finishing a path sends a feather drifting up with sparkles.
 * Adaptive difficulty: higher host.level + later rounds → more rounds, longer/denser
 * paths, tighter hit radius, looping figures, and a speed timer. Gentle on lifts/misses
 * and timeouts (just resets the round, counts a retry); too many resets → host.fail(). */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.charms = function (host) {
    const el = HPL.el, L = host.level;
    const W = 360, H = 260;
    // more rounds as you climb: 3 at level 1 → 5 at the top
    const N = Math.min(5, 3 + Math.floor((L - 1) / 3));
    // tighter target as skill grows (shrinks further per round below)
    const HIT0 = Math.max(18, 34 - (L - 1) * 2);
    // speed pressure arrives at level 3+
    const TIMED = L >= 3;
    const MAX_RESETS = N + 4; // too many flubs → gentle fail instead of pity win
    let round = 0, retries = 0, roundTimer = null;

    // canvas trace area
    const wrap = el('div', { style: 'position:relative;width:86%;max-width:380px' });
    const cv = el('canvas', { width: String(W), height: String(H), style: 'width:100%;display:block;border-radius:18px;border:3px solid #ffd76a;background:#0b0824;touch-action:none;cursor:crosshair' });
    wrap.appendChild(cv); host.stage.appendChild(wrap);
    const ctx = cv.getContext('2d');

    // soft starfield baked once
    const stars = [];
    for (let k = 0; k < 46; k++) stars.push([host.rnd(4, W - 4), host.rnd(4, H - 4), Math.random() * 1.6 + 0.4]);

    let pts = [], trail = [], next = 0, dragging = false, done = false, HIT = HIT0;

    // resample a polyline to `n` evenly-spaced waypoints → denser, longer patterns to trace
    function densify(src, n) {
      if (n <= src.length) return src.slice(0, Math.max(2, n));
      const seg = []; let total = 0;
      for (let k = 1; k < src.length; k++) { const d = Math.hypot(src[k].x - src[k - 1].x, src[k].y - src[k - 1].y); seg.push(d); total += d; }
      const out = [];
      for (let j = 0; j < n; j++) {
        let t = total * j / (n - 1), k = 0;
        while (k < seg.length && t > seg[k]) { t -= seg[k]; k++; }
        if (k >= seg.length) { out.push({ x: src[src.length - 1].x, y: src[src.length - 1].y }); continue; }
        const f = seg[k] ? t / seg[k] : 0;
        out.push({ x: src[k].x + (src[k + 1].x - src[k].x) * f, y: src[k].y + (src[k + 1].y - src[k].y) * f });
      }
      return out;
    }

    // build a swish-and-flick path for this round; more points + looping = harder.
    // difficulty ramps with level AND round (later rounds are harder than earlier ones).
    function makePath(r) {
      const diff = (L - 1) + r;            // overall difficulty for this round, 0..~11
      const mx = 46, my = 38, iw = W - mx * 2, ih = H - my * 2;
      // base control points, then densify → waypoint count 4..9
      const n = Math.min(9, 4 + Math.floor(diff * 0.7));
      const loop = (L >= 4 ? r >= 1 : L >= 2 && r >= 2); // loops arrive sooner at higher levels
      const base = [];
      const bn = Math.max(4, Math.min(6, 3 + Math.floor(diff / 3)));
      for (let k = 0; k < bn; k++) {
        const t = bn === 1 ? 0 : k / (bn - 1);
        let x, y;
        if (loop) {
          // figure / spiral that wraps further round as it gets harder
          const a = t * Math.PI * (1.6 + diff * 0.14) - 0.4;
          const rad = 0.3 + 0.08 * (1 - t);
          x = W / 2 + Math.cos(a) * iw * (rad + 0.06);
          y = H / 2 + Math.sin(a) * ih * (rad + 0.12);
        } else {
          // wavier (more humps) the harder it gets
          x = mx + t * iw;
          y = my + ih * (0.5 + Math.sin(t * Math.PI * (1 + r + diff * 0.2)) * 0.42) - (k === bn - 1 ? ih * 0.3 : 0);
        }
        base.push({ x: Math.max(mx, Math.min(W - mx, x)), y: Math.max(my, Math.min(H - my, y)) });
      }
      return densify(base, n);
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
      // numbered waypoints (smaller dots when the hit radius is tight → reads as harder)
      const dotR = Math.max(12, HIT * 0.5);
      pts.forEach((p, k) => {
        const hit = k < next;
        ctx.beginPath(); ctx.arc(p.x, p.y, dotR, 0, 7);
        ctx.fillStyle = hit ? '#7ef0a0' : (k === next ? '#ffd76a' : 'rgba(255,255,255,.2)');
        ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#2a1a12'; ctx.font = 'bold ' + Math.round(dotR * 1.2) + 'px Rubik,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(hit ? '✓' : String(k + 1), p.x, p.y + 1);
      });
    }

    function pos(e) {
      const r = cv.getBoundingClientRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
    }
    function near(p, w) { return Math.hypot(p.x - w.x, p.y - w.y) <= HIT; }

    // count a flub (early lift / timeout) and bail to a gentle retry if it piles up
    function flub() {
      retries++;
      if (retries > MAX_RESETS) { stopTimer(); return host.fail('קֶסֶם קָשֶׁה היום — ננסה שוב?'), true; }
      return false;
    }

    function stopTimer() { if (roundTimer) { roundTimer.stop(); roundTimer = null; } }
    // time budget scales with path length but shrinks with level → real pressure up top
    function timeMs() { return Math.max(3200, 4200 + pts.length * 520 - L * 360 - round * 300); }
    function armTimer() {
      if (!TIMED) return;
      stopTimer();
      roundTimer = host.timer(timeMs(), onTimeout);
    }
    function onTimeout() {
      roundTimer = null;
      if (done) return;
      dragging = false; next = 0; trail = []; draw(); host.bad();
      if (flub()) return;
      host.say('מהר יותר! סְוִיש וּפְלִיק ✨');
      armTimer();
    }

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
      if (next < pts.length) { // lifted early — gentle reset, counts toward retry tally
        next = 0; trail = []; draw(); host.bad();
        if (flub()) return;
        host.say('עוד פעם, סְוִיש וּפְלִיק!');
      }
    }

    function finishRound() {
      done = true; dragging = false; stopTimer(); draw();
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
      // tighten the hit radius a touch each round within the lesson
      HIT = Math.max(14, HIT0 - round * 2);
      host.say(round === 0 ? 'סְוִיש וּפְלִיק! עקוב אחרי הנתיב' : 'יפה! נתיב ארוך יותר — קדימה!');
      draw(); armTimer();
    }

    function finish() {
      stopTimer();
      host.confetti(); host.say('הנוצה מרחפת! 🪶');
      // stars reflect performance (resets + timeouts)
      const stars = retries <= 1 ? 3 : retries <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    // test hook: expose the live canvas + the CURRENT round's waypoints ({x,y} in canvas
    // pixel coords) so the walk-bot can trace a real swish-and-flick through the dots
    // instead of shortcutting. Mirrors lessons/spells.js HPL._spellProbe.
    HPL._charmsProbe = () => ({ canvas: cv, pts: pts });

    cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);

    host.setProgress(0, N);
    next2();
  };
})();
