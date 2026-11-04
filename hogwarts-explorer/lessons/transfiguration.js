/* Transfiguration with Professor McGonagall — shape-shift an object into another. A big
 * source emoji asks "turn it into...?"; the child taps one of several target buttons drawn
 * from classic pairs + trickier distractors. Right pick morphs the source: it spins and
 * shrinks to nothing while the target blooms up, with sparkles. Adaptive difficulty:
 * more rounds + more choices + REVERSE prompts ("which object turns into X?") as host.level
 * climbs, and each lesson also ramps (later rounds harder). Too many misses → gentle retry. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.transfiguration = function (host) {
    const el = HPL.el;
    // classic pairs: [source emoji, target emoji, hebrew source word, hebrew target word]
    const PAIRS = [
      ['🪵', '📍', 'הגפרור', 'הסיכה'],
      ['🫖', '🐭', 'הספל', 'העכבר'],
      ['🐭', '🦔', 'העכבר', 'הקיפוד'],
      ['🔘', '🪲', 'הכפתור', 'החיפושית'],
      ['🥚', '🐥', 'הביצה', 'האפרוח'],
      ['🌰', '🌳', 'הבלוט', 'העץ'],
      ['🕯️', '🐍', 'הנר', 'הנחש'],
      ['🍐', '🦉', 'האגס', 'הינשוף'],
      ['🧦', '🐰', 'הגרב', 'הארנב'],
      ['🪨', '🐢', 'הסלע', 'הצב'],
    ];
    // rounds + choice-count ramp with mastery; reverse prompts unlock at level 4
    const L = host.level;
    const N = Math.min(PAIRS.length, 5 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0) + (L >= 7 ? 1 : 0));
    const REVERSE = L >= 4;
    let i = 0, misses = 0, bonus = 0, tmr = null, correctNow = null;
    const order = PAIRS.slice().sort(() => Math.random() - 0.5).slice(0, N);

    // central morph element + choice row
    const morph = el('div', { style: 'position:relative;width:160px;height:160px;display:flex;align-items:center;justify-content:center' });
    const srcEl = el('div', { style: 'position:absolute;font-size:120px;line-height:1;will-change:transform,opacity' });
    const tgtEl = el('div', { style: 'position:absolute;font-size:120px;line-height:1;will-change:transform,opacity;transform:scale(0);opacity:0' });
    morph.appendChild(srcEl); morph.appendChild(tgtEl);
    const row = el('div', { class: 'lsnRow' });
    host.stage.appendChild(morph); host.stage.appendChild(row);

    // how many buttons this round: ramps with level AND within the lesson (later rounds harder)
    function choiceCount() {
      const base = 3 + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0); // 3..5 by level
      const ramp = i >= N - 2 ? 1 : 0;                       // last two rounds add one more
      return Math.min(6, base + ramp);
    }

    // build NEED buttons: the one correct answer + distractors from the SAME column
    // (sources for reverse prompts, targets for forward) so wrong options are plausible.
    function makeChoices(correct, col, need) {
      const others = PAIRS.map((p) => p[col]).filter((t) => t !== correct);
      const set = new Set([correct]);
      while (set.size < need && others.length) {
        set.add(others.splice(host.rnd(0, others.length - 1), 1)[0]);
      }
      return [...set].sort(() => Math.random() - 0.5);
    }

    function ask() {
      host.setProgress(i, N);
      if (i >= N) return finish();
      const [src, tgt, srcW, tgtW] = order[i];
      // reverse prompts appear from level 4, mixed in on the harder (later) rounds
      const reverse = REVERSE && i >= 1 && host.rnd(0, 1) === 0;
      // morph always shows source -> target; in reverse mode the child picks the SOURCE,
      // so we keep the source hidden until the morph plays and start from the target shown.
      if (reverse) {
        srcEl.textContent = src; srcEl.style.transform = 'scale(0)'; srcEl.style.opacity = '0';
        tgtEl.textContent = tgt; tgtEl.style.transform = 'scale(1)'; tgtEl.style.opacity = '1';
        host.say('איזה חפץ הופך ל ' + tgtW + '? 🐱');
      } else {
        srcEl.textContent = src; srcEl.style.transform = 'scale(1)'; srcEl.style.opacity = '1';
        tgtEl.textContent = tgt; tgtEl.style.transform = 'scale(0)'; tgtEl.style.opacity = '0';
        host.say('הפכו את ' + srcW + ' ל...?');
      }
      const correct = reverse ? src : tgt;      // emoji the right button must show
      correctNow = correct;                     // exact text the test hook must return
      const col = reverse ? 0 : 1;              // distractor column
      const need = choiceCount();
      row.innerHTML = '';
      // gentle timed bonus on harder rounds (level 5+, later rounds): timeout forfeits bonus only
      if (tmr) { tmr.stop(); tmr = null; }
      if (L >= 5 && i >= 2) {
        tmr = host.timer(6000 - Math.min(2000, (L - 5) * 400), () => { tmr = null; });
      }
      makeChoices(correct, col, need).forEach((choice) => {
        const b = el('button', { class: 'lsnBtn' }, choice);
        b.addEventListener('click', () => {
          if (choice === correct) {
            row.style.pointerEvents = 'none';
            if (tmr && tmr.left() > 0) { bonus++; } // beat the clock → bonus toward stars
            if (tmr) { tmr.stop(); tmr = null; }
            morphTo(reverse);
          } else {
            misses++; host.bad(); host.say('לא בדיוק... נסו שוב 🐱');
            b.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300);
          }
        });
        row.appendChild(b);
      });
    }

    function morphTo(reverse) {
      // in reverse we revealed the target; now show the chosen source springing into it
      if (reverse) { srcEl.style.transform = 'scale(1)'; srcEl.style.opacity = '1'; tgtEl.style.transform = 'scale(0)'; tgtEl.style.opacity = '0'; }
      // source spins + shrinks to 0 while target blooms up from 0 (~500ms cross-fade)
      srcEl.animate([
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'scale(0) rotate(360deg)', opacity: 0 },
      ], { duration: 500, easing: 'ease-in', fill: 'forwards' });
      tgtEl.animate([
        { transform: 'scale(0) rotate(-180deg)', opacity: 0 },
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      ], { duration: 500, delay: 160, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
      const r = morph.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
      const cx = r.left - pr.left + r.width / 2, cy = r.top - pr.top + r.height / 2;
      host.good(cx, cy);
      host.after(250, () => host.good(cx - 30, cy - 20));
      host.after(560, () => { host.say('מושלם! ✨'); i++; host.setProgress(i, N); });
      host.after(1050, () => { row.style.pointerEvents = 'auto'; ask(); });
    }

    function finish() {
      if (tmr) { tmr.stop(); tmr = null; }
      // too many misses → gentle retry, no pity win
      if (misses > N + 3) { host.fail('הגלגול התפזר... בואו ננסה שוב 🐱'); return; }
      host.confetti();
      host.say('גלגול מושלם! 🐱');
      // stars from misses, with a nudge up for timed-bonus pickups
      let stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      if (stars < 3 && bonus >= Math.ceil(N / 2)) stars++;
      host.after(800, () => host.win(stars));
    }

    // test hook: the current round's correct CHOICE emoji (source for reverse, target for
    // forward), so the walk-bot can tap the right button for real (exercising the morph +
    // scoring path). Must always equal the textContent of a button present in the row.
    HPL._transTarget = () => (i < N && correctNow != null ? correctNow : null);

    ask();
  };
})();
