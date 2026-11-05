/* Astronomy with Professor Sinistra — connect the stars into a constellation. A night sky per
 * round; tap the glowing dots IN ORDER, a golden line links each to the last and the shape
 * sparkles + names itself when done. Harder now: more & bigger constellations and more rounds at
 * higher level, and each lesson RAMPS (later rounds harder). Wrong taps COUNT — too many and the
 * sky goes dark (host.fail, retry) instead of a pity win. At higher levels the "which is next"
 * pulse hint is withheld (order inferred by brightness) or shown briefly then hidden (a memory
 * flash), and a gentle per-round timer adds a little starlight pressure. Finish = starry sky. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.astronomy = function (host) {
    const el = HPL.el, W = 360, H = 300;
    // constellations: {x,y} in 0..1, connected in array order. Ordered roughly small→large.
    const ALL = [
      { name: 'הכלב', pts: [{ x: .2, y: .3 }, { x: .4, y: .25 }, { x: .55, y: .45 }, { x: .72, y: .55 }, { x: .82, y: .78 }] },
      { name: 'הברבור', pts: [{ x: .5, y: .15 }, { x: .5, y: .4 }, { x: .22, y: .5 }, { x: .78, y: .55 }, { x: .5, y: .82 }] },
      { name: 'העקרב', pts: [{ x: .18, y: .22 }, { x: .34, y: .3 }, { x: .5, y: .42 }, { x: .64, y: .58 }, { x: .76, y: .74 }, { x: .6, y: .82 }] },
      { name: 'הדובה', pts: [{ x: .14, y: .62 }, { x: .3, y: .55 }, { x: .46, y: .5 }, { x: .6, y: .4 }, { x: .64, y: .22 }, { x: .82, y: .3 }, { x: .8, y: .5 }] },
      { name: 'הדרקון', pts: [{ x: .16, y: .78 }, { x: .28, y: .62 }, { x: .2, y: .44 }, { x: .36, y: .34 }, { x: .54, y: .4 }, { x: .66, y: .26 }, { x: .8, y: .34 }, { x: .84, y: .56 }] },
      { name: 'פגסוס', pts: [{ x: .22, y: .22 }, { x: .5, y: .18 }, { x: .5, y: .5 }, { x: .22, y: .5 }, { x: .22, y: .78 }, { x: .5, y: .78 }, { x: .76, y: .62 }, { x: .82, y: .38 }, { x: .7, y: .2 }] },
    ];

    const L = Math.max(1, Math.min(8, host.level | 0));
    // how many rounds this lesson: more at higher level
    const rounds = L <= 2 ? 3 : L <= 4 ? 4 : L <= 6 ? 5 : 6;
    // shuffle the pool so an attentive child can't memorise a fixed order between tries
    const pool = ALL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = host.rnd(0, i); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    // sort by size so difficulty can ramp within the lesson
    pool.sort((a, b) => a.pts.length - b.pts.length);
    // pick `rounds` constellations, ramping from the simplest upward; bigger pool window at high level
    const minSize = L <= 2 ? 0 : L <= 4 ? 1 : 2;
    const picks = [];
    for (let r = 0; r < rounds; r++) {
      // bias the index toward the end (bigger) for later rounds and higher levels
      const reach = minSize + Math.floor((pool.length - 1 - minSize) * ((r + 1) / rounds));
      const lo = Math.max(minSize, reach - 1);
      picks.push(pool[host.rnd(lo, Math.min(pool.length - 1, reach))]);
    }

    // mistakes allowed before the sky goes dark → fail (no trivial auto-win)
    const maxWrong = rounds + 4;

    let round = 0, wrong = 0, roundTimer = null;
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

    // test hook: the DOM element of the next star-dot to tap (in order), or null
    HPL._starNext = () => null;

    function startRound() {
      host.setProgress(round, rounds);
      if (round >= rounds) return finish();
      const con = picks[round];
      let next = 0, locked = false;
      nameEl.style.opacity = '0'; nameEl.style.transform = 'translate(-50%,-50%) scale(.4)';
      ctx.clearRect(0, 0, W, H);
      sky.querySelectorAll('.lsnStar').forEach((n) => n.remove());
      if (roundTimer) { roundTimer.stop(); roundTimer = null; }

      // difficulty for THIS round = live level (rises with success) + how deep we are
      const heat = host.lvl() + round; // 1..~15
      // withhold the live "next pulses" hint from ~heat 7; show only a brief memory flash from ~5
      const liveHint = heat < 7;
      const memoryFlash = !liveHint && heat < 10; // flash the sequence once, then hide
      // gentle speed timer kicks in at higher heat (never a harsh fail — just a nudge)
      const useTimer = heat >= 6;

      const dots = con.pts.map((p, idx) => {
        // brighter dots come first in the order — the natural fallback cue when no pulse hint
        const bright = 1 - idx / Math.max(1, con.pts.length - 1); // 1→0
        const d = el('button', { class: 'lsnStar', style: starStyle(p, bright) }, '✦');
        const hit = (ev) => { ev.preventDefault(); tap(idx); };
        d.addEventListener('click', hit);
        sky.appendChild(d);
        return d;
      });

      function refreshHook() {
        HPL._starNext = () => (next < dots.length ? dots[next] : null);
      }

      function pulse() {
        dots.forEach((d, idx) => {
          d.style.transform = 'translate(-50%,-50%)';
          d.style.animation = (liveHint && idx === next) ? 'lsnStarPulse 1s ease-in-out infinite' : 'none';
        });
      }

      function showNumbers(on) {
        dots.forEach((d, idx) => { d.textContent = on ? String(idx + 1) : '✦'; });
      }

      function beginPlay() {
        locked = false;
        refreshHook();
        if (liveHint) { host.say('חברו את הכוכבים לפי הסדר ✦'); pulse(); }
        else if (memoryFlash) host.say('זכרו את הסדר — ועכשיו חברו! ✦');
        else host.say('התחילו מהכוכב הבהיר ביותר אל הכהה ✦');
        if (useTimer) {
          const ms = Math.max(5000, 11000 - heat * 600) + con.pts.length * 900;
          roundTimer = host.timer(ms, () => { host.say('הזמן אזל — נסו שוב בלי לחץ ✦'); /* gentle: play continues */ });
        }
      }

      function tap(idx) {
        if (locked) return;
        if (idx !== next) {
          wrong++; host.bad(); host.hit(false);
          host.say('לא הכוכב הזה — הקשיבו לסדר ✦');
          const d = dots[idx]; d.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.25)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 300);
          if (wrong > maxWrong) return darken();
          return;
        }
        // correct, in order
        const d = dots[idx], p = con.pts[idx];
        d.style.animation = 'none';
        d.style.background = 'radial-gradient(circle at 40% 35%,#fff,#ffd76a 55%,#ff9a2a)';
        d.style.boxShadow = '0 0 22px #ffd76a,0 0 40px rgba(255,215,106,.6)';
        d.style.color = '#fff'; d.textContent = '✦';
        if (idx > 0) drawLine(con.pts[idx - 1], p);
        const r = d.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
        host.good(r.left - pr.left + 22, r.top - pr.top + 22);
        next++;
        refreshHook();
        if (next >= con.pts.length) return complete();
        pulse();
      }

      function complete() {
        locked = true; host.hit(true);   // a constellation finished → one notch harder on a roll
        HPL._starNext = () => null;
        if (roundTimer) { roundTimer.stop(); roundTimer = null; }
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

      // start: for the memory flash, number the stars briefly then hide and let the child recall
      if (memoryFlash) {
        locked = true;
        showNumbers(true);
        dots.forEach((d) => { d.style.animation = 'none'; });
        host.say('שננו את הסדר... ✦');
        const flashMs = Math.max(1400, 2600 - (heat - 5) * 300 + con.pts.length * 200);
        host.after(flashMs, () => { showNumbers(false); beginPlay(); });
      } else {
        beginPlay();
      }
    }

    function starStyle(p, bright) {
      // bright (1) = big & white-blue (easy to spot = first), dim (0) = smaller & faded
      const size = Math.round(38 + bright * 10); // 38..48px — all stay big touch targets
      const glow = Math.round(8 + bright * 10);
      const op = (0.55 + bright * 0.45).toFixed(2);
      return 'position:absolute;left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%;transform:translate(-50%,-50%);' +
        'width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:none;cursor:pointer;touch-action:manipulation;padding:0;' +
        'display:flex;align-items:center;justify-content:center;font-size:' + Math.round(20 + bright * 6) + 'px;color:#cfe0ff;font-family:inherit;opacity:' + op + ';' +
        'background:radial-gradient(circle at 40% 35%,#eaf2ff,#8fa8ff 60%,#4a5fb0);box-shadow:0 0 ' + glow + 'px rgba(160,185,255,.7)';
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

    function darken() {
      // too many wrong taps — gentle retry instead of a pity win
      HPL._starNext = () => null;
      if (roundTimer) { roundTimer.stop(); roundTimer = null; }
      host.bad();
      host.fail('העננים כיסו את השמיים — ננסה שוב? 🌧️✦');
    }

    function finish() {
      HPL._starNext = () => null;
      host.confetti();
      host.say('שמיים מלאי כוכבים! 🔭');
      // star rating from mistakes, scaled to how many rounds (harder lessons tolerate more slips)
      const stars = wrong <= 1 ? 3 : wrong <= Math.ceil(rounds / 2) + 1 ? 2 : 1;
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
