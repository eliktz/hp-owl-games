/* Defence / Spells class — learn and cast three spells by tracing the wand pattern at a
 * target on a canvas (Lumos → Wingardium Leviosa → Expelliarmus). Each spell draws a bright
 * numbered dotted path; the child drags finger/mouse through the waypoints in order and the
 * spell's fun effect fires. Ends with a friendly duel + stars. Gentle: lift early = retry. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.spells = function (host) {
    const el = HPL.el, L = host.level;
    let si = 0, retries = 0, spellTimer = null;

    // canvas
    const canvas = el('canvas', { style: 'width:86%;max-width:380px;background:radial-gradient(ellipse at center,#1a1640,#07061e);border:4px solid #ffd76a;border-radius:20px;touch-action:none;cursor:crosshair' });
    canvas.width = 360; canvas.height = 260;
    const nameEl = el('div', { style: 'font-size:40px;font-weight:bold;color:#ffd76a;text-shadow:0 2px 0 #7a3b00', dir: 'rtl' }, '');
    const fx = el('div', { style: 'position:absolute;font-size:70px;pointer-events:none;opacity:0;transition:all 1s ease-out' }, '');
    host.stage.appendChild(nameEl); host.stage.appendChild(canvas); host.stage.appendChild(fx);
    const ctx = canvas.getContext('2d');

    // tighter hit radius + longer, denser paths + a tighter time limit on higher levels
    const HIT = Math.max(20, 38 - (L - 1) * 3);
    const NSP = L >= 4 ? 4 : 3;                 // a fourth spell once you're skilled

    // resample a polyline to `n` evenly-spaced waypoints → longer patterns to trace
    function densify(pts, n) {
      if (n <= pts.length) return pts.slice(0, Math.max(2, n));
      const seg = [], out = []; let total = 0;
      for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); total += d; }
      for (let j = 0; j < n; j++) {
        let t = total * j / (n - 1), k = 0;
        while (k < seg.length && t > seg[k]) { t -= seg[k]; k++; }
        if (k >= seg.length) { out.push(pts[pts.length - 1].slice()); continue; }
        const f = seg[k] ? t / seg[k] : 0;
        out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
      }
      return out;
    }

    // spells: name, dotted path waypoints, effect emoji + float direction
    function paths() {
      const base = [
        { name: 'לוּמוֹס', emoji: '💡', dir: [0, -70], dummy: false,
          pts: [[100, 210], [150, 150], [200, 80], [240, 40]] },
        { name: 'וִינְגַּרְדְיוּם לֶוִיוֹסָה', emoji: '🪶', dir: [0, -90], dummy: false,
          pts: [[70, 170], [150, 170], [230, 170], [270, 90], [250, 40]] },
        { name: 'אֶקְסְפֶּלִיאַרְמוּס', emoji: '🪄', dir: [60, -30], dummy: true,
          pts: [[60, 200], [140, 160], [220, 120], [290, 80]] },
        { name: 'פְּרוֹטֶגוֹ', emoji: '🛡️', dir: [0, -40], dummy: false,
          pts: [[180, 60], [120, 110], [140, 190], [230, 190], [250, 110], [180, 60]] },
      ].slice(0, NSP);
      // longer trace the higher the level: 4 → up to 8 waypoints
      return base.map((s, idx) => ({ ...s, pts: densify(s.pts, Math.min(8, 4 + (L - 1) + idx)) }));
    }
    const spells = paths();

    let cur, hit, trail, down = false;

    function timeMs() { return Math.max(3000, 4200 + cur.pts.length * 480 - L * 340); }
    function armTimer() { if (spellTimer) spellTimer.stop(); spellTimer = host.timer(timeMs(), onTimeout); }
    function onTimeout() {
      retries++; trail = []; hit = cur.pts.map(() => false); down = false; host.bad();
      if (retries > NSP + 4) { if (spellTimer) spellTimer.stop(); return host.fail('קצת מהיר היום — ננסה שוב?'); }
      host.say('מהר יותר! ✨'); draw(); armTimer();
    }

    function start(idx) {
      cur = spells[idx]; hit = cur.pts.map(() => false); trail = []; down = false;
      nameEl.textContent = cur.name;
      host.setProgress(idx, NSP);
      host.say(cur.dummy ? 'כוון לבובה הידידותית! 🙂' : 'מהר ובעדינות — עקוב אחרי הנקודות!');
      draw(); armTimer();
    }

    function draw() {
      ctx.clearRect(0, 0, 360, 260);
      // friendly smiling dummy target for Expelliarmus
      if (cur.dummy) {
        ctx.font = '70px serif'; ctx.textAlign = 'center';
        ctx.fillText('🙂', 300, 110);
        ctx.font = '26px serif'; ctx.fillText('🪄', 300, 150);
      }
      // dotted target path
      ctx.strokeStyle = 'rgba(255,215,106,.5)'; ctx.lineWidth = 5; ctx.setLineDash([3, 14]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cur.pts[0][0], cur.pts[0][1]);
      for (let k = 1; k < cur.pts.length; k++) ctx.lineTo(cur.pts[k][0], cur.pts[k][1]);
      ctx.stroke(); ctx.setLineDash([]);
      // numbered waypoint dots
      cur.pts.forEach((p, k) => {
        ctx.beginPath(); ctx.arc(p[0], p[1], 20, 0, 7);
        ctx.fillStyle = hit[k] ? '#7ef0a0' : '#ffd76a'; ctx.fill();
        ctx.fillStyle = '#2a1a12'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), p[0], p[1]);
      });
      // finger trail
      if (trail.length > 1) {
        ctx.strokeStyle = '#8ad0ff'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
        for (let k = 1; k < trail.length; k++) ctx.lineTo(trail[k].x, trail[k].y);
        ctx.stroke();
      }
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * 360 / r.width, y: (t.clientY - r.top) * 260 / r.height };
    }

    function begin(e) { e.preventDefault(); down = true; trail = []; move(e); }
    function move(e) {
      if (!down) return; e.preventDefault();
      const p = pos(e); trail.push(p);
      // next unhit waypoint must be reached in order
      const n = hit.indexOf(false);
      if (n >= 0) {
        const w = cur.pts[n];
        if (Math.hypot(p.x - w[0], p.y - w[1]) <= HIT) { hit[n] = true; try { HP.sfx.soft(); } catch (e2) {} }
      }
      draw();
      if (hit.indexOf(false) < 0) { down = false; success(); }
    }
    function end(e) {
      if (!down) return; e.preventDefault(); down = false;
      if (hit.indexOf(false) >= 0) { // lifted early
        retries++; trail = []; hit = cur.pts.map(() => false); host.bad();
        host.say('נסה שוב, תנופה ושליפה!'); draw();
      }
    }

    function success() {
      const r = canvas.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
      const last = cur.pts[cur.pts.length - 1];
      const fx0x = r.left - pr.left + last[0] * r.width / 360;
      const fx0y = r.top - pr.top + last[1] * r.height / 260;
      fx.textContent = cur.emoji;
      fx.style.transition = 'none'; fx.style.opacity = '1';
      fx.style.left = (fx0x - 35) + 'px'; fx.style.top = (fx0y - 35) + 'px';
      fx.style.transform = 'scale(.4)';
      requestAnimationFrame(() => {
        fx.style.transition = 'all 1s ease-out';
        fx.style.transform = 'scale(1.2)';
        fx.style.top = (fx0y - 35 + cur.dir[1]) + 'px';
        fx.style.left = (fx0x - 35 + cur.dir[0]) + 'px';
      });
      host.after(1100, () => { fx.style.opacity = '0'; });
      host.good(fx0x, fx0y);
      // a quick gold pulse on the spell name — "you cast it!"
      try { nameEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'cubic-bezier(.2,1.5,.4,1)' }); } catch (e) {}
      if (spellTimer) spellTimer.stop();
      if (cur.dummy) reactDummy();                 // the friendly target gets happily zapped
      si++; host.setProgress(si, NSP);
      if (si >= NSP) host.after(900, finish);
      else host.after(1100, () => start(si));
    }

    // Expelliarmus landed: the smiley dummy spins back dizzy (😵) then pops a happy ⭐,
    // its little wand flying off — a gentle, friendly "disarm" with no one hurt.
    function reactDummy() {
      const t0 = performance.now();
      (function spin(now) {
        const k = Math.min(1, (now - t0) / 900);
        ctx.clearRect(0, 0, 360, 260);
        ctx.save(); ctx.translate(300, 110); ctx.rotate(Math.sin(k * 12) * (1 - k) * 0.6);
        ctx.font = '70px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(k < 0.7 ? '😵' : '⭐', 0, 0); ctx.restore();
        // the disarmed wand tumbles up and away
        ctx.font = '26px serif'; ctx.fillText('🪄', 300 + k * 60, 150 - k * 70);
        if (k < 1) requestAnimationFrame(spin);
      })(t0);
    }

    function finish() {
      if (spellTimer) spellTimer.stop();
      fx.style.opacity = '0';
      host.confetti(); host.say('קוסם אמיתי! ✨');
      const stars = retries <= 1 ? 3 : retries <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    // test hook: expose the live canvas + current spell's waypoints so the walk-bot can
    // trace a real cast (dispatch pointer events through the dots) instead of shortcutting.
    HPL._spellProbe = () => ({ canvas, pts: cur ? cur.pts : [] });

    canvas.addEventListener('pointerdown', begin);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);
    canvas.addEventListener('touchstart', begin, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });

    start(0);
  };
})();
