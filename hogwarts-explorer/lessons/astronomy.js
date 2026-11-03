/* Astronomy with Professor Sinistra — connect the stars into a constellation. Three night
 * skies; tap the glowing dots in order (the next one pulses as a hint), a golden line links
 * each to the last and the shape sparkles + names itself when done. Gentle on wrong taps,
 * no penalty; bigger constellations at higher levels. Finish = starry sky + stars. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.astronomy = function (host) {
    const el = HPL.el, W = 360, H = 300;
    // constellations: {x,y} in 0..1, connected in array order
    const ALL = [
      { name: 'הכלב', pts: [{ x: .2, y: .3 }, { x: .4, y: .25 }, { x: .55, y: .45 }, { x: .72, y: .55 }, { x: .82, y: .78 }] },
      { name: 'הברבור', pts: [{ x: .5, y: .15 }, { x: .5, y: .4 }, { x: .22, y: .5 }, { x: .78, y: .55 }, { x: .5, y: .82 }] },
      { name: 'העקרב', pts: [{ x: .18, y: .22 }, { x: .34, y: .3 }, { x: .5, y: .42 }, { x: .64, y: .58 }, { x: .76, y: .74 }, { x: .6, y: .82 }] },
      { name: 'הדובה', pts: [{ x: .14, y: .62 }, { x: .3, y: .55 }, { x: .46, y: .5 }, { x: .6, y: .4 }, { x: .64, y: .22 }, { x: .82, y: .3 }, { x: .8, y: .5 }] },
    ];
    // higher level → bigger constellations
    const pool = host.level >= 3 ? ALL.slice() : host.level === 2 ? [ALL[1], ALL[2], ALL[3], ALL[0]] : [ALL[0], ALL[1], ALL[2], ALL[3]];
    const picks = pool.slice(0, 3);

    let round = 0, wrong = 0;
    const sky = el('div', { style: 'position:relative;width:90%;max-width:400px;height:' + H + 'px;border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#1a1b4b,#060616 75%);box-shadow:inset 0 0 40px rgba(0,0,0,.6),0 0 0 3px rgba(255,215,106,.4)' });
    const canvas = el('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none' });
    canvas.width = W; canvas.height = H;
    const nameEl = el('div', { style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.4);opacity:0;font-size:46px;font-weight:bold;color:#ffd76a;text-shadow:0 0 18px #ffd76a;transition:all .4s ease-out;pointer-events:none' });
    sky.appendChild(canvas);
    // faint background stars
    for (let k = 0; k < 26; k++) {
      const s = 1 + Math.random() * 2;
      sky.appendChild(el('div', { style: 'position:absolute;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:#fff;opacity:' + (.2 + Math.random() * .4) }));
    }
    sky.appendChild(nameEl);
    host.stage.appendChild(sky);

    const ctx = canvas.getContext('2d');

    function startRound() {
      host.setProgress(round, 3);
      if (round >= 3) return finish();
      const con = picks[round];
      let next = 0;
      nameEl.style.opacity = '0'; nameEl.style.transform = 'translate(-50%,-50%) scale(.4)';
      ctx.clearRect(0, 0, W, H);
      sky.querySelectorAll('.lsnStar').forEach((n) => n.remove());
      host.say('חברו את הכוכבים לפי הסדר ✦');

      const dots = con.pts.map((p, idx) => {
        const d = el('button', { class: 'lsnStar', style: starStyle(p) }, '✦');
        const hit = (ev) => { ev.preventDefault(); tap(idx); };
        d.addEventListener('click', hit);
        sky.appendChild(d);
        return d;
      });

      function pulse() {
        dots.forEach((d, idx) => {
          d.style.transform = 'translate(-50%,-50%)';
          d.style.animation = idx === next ? 'lsnStarPulse 1s ease-in-out infinite' : 'none';
        });
      }

      function tap(idx) {
        if (idx !== next) {
          wrong++; host.bad();
          host.say('אותו כוכב מאיר — התחילו מהבהיר ביותר ✦');
          const d = dots[idx]; d.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.25)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 300);
          return;
        }
        // correct, in order
        const d = dots[idx], p = con.pts[idx];
        d.style.animation = 'none';
        d.style.background = 'radial-gradient(circle at 40% 35%,#fff,#ffd76a 55%,#ff9a2a)';
        d.style.boxShadow = '0 0 22px #ffd76a,0 0 40px rgba(255,215,106,.6)';
        d.style.color = '#fff';
        if (idx > 0) drawLine(con.pts[idx - 1], p);
        const r = d.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
        host.good(r.left - pr.left + 22, r.top - pr.top + 22);
        next++;
        if (next >= con.pts.length) return complete();
        pulse();
      }

      function complete() {
        // sparkle the whole shape
        con.pts.forEach((p, k) => host.after(k * 90, () => {
          const r = sky.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
          host.good(r.left - pr.left + p.x * r.width, r.top - pr.top + p.y * r.height);
        }));
        nameEl.textContent = con.name;
        requestAnimationFrame(() => { nameEl.style.opacity = '1'; nameEl.style.transform = 'translate(-50%,-50%) scale(1)'; });
        host.say('זאת ' + con.name + '! ✨');
        round++;
        host.after(900, startRound);
      }

      pulse();
    }

    function starStyle(p) {
      return 'position:absolute;left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%;transform:translate(-50%,-50%);' +
        'width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;touch-action:manipulation;padding:0;' +
        'display:flex;align-items:center;justify-content:center;font-size:24px;color:#cfe0ff;font-family:inherit;' +
        'background:radial-gradient(circle at 40% 35%,#eaf2ff,#8fa8ff 60%,#4a5fb0);box-shadow:0 0 12px rgba(160,185,255,.7)';
    }

    function drawLine(a, b) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,215,106,.95)';
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke(); ctx.restore();
    }

    function finish() {
      host.confetti();
      host.say('שמיים מלאי כוכבים! 🔭');
      const stars = wrong <= 1 ? 3 : wrong <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    // local keyframe for the pulsing hint star
    if (!document.getElementById('lsnStarKf')) {
      const st = document.createElement('style'); st.id = 'lsnStarKf';
      st.textContent = '@keyframes lsnStarPulse{0%,100%{transform:translate(-50%,-50%) scale(1);box-shadow:0 0 12px rgba(160,185,255,.7)}50%{transform:translate(-50%,-50%) scale(1.3);box-shadow:0 0 26px #fff,0 0 42px rgba(160,185,255,.9)}}';
      document.head.appendChild(st);
    }

    startRound();
  };
})();
