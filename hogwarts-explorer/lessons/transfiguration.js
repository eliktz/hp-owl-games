/* Transfiguration with Professor McGonagall — shape-shift an object into another. A big
 * source emoji asks "turn it into...?"; the child taps one of 3 target buttons (4 at
 * level 3) drawn from classic pairs + distractors. Right pick morphs the source: it spins
 * and shrinks to nothing while the target blooms up, with sparkles. 5 rounds = stars. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.transfiguration = function (host) {
    const el = HPL.el, N = 5;
    // classic pairs: [source emoji, target emoji, hebrew prompt word]
    const PAIRS = [
      ['🪵', '📍', 'הגפרור'],
      ['🫖', '🐭', 'הספל'],
      ['🐭', '🦔', 'העכבר'],
      ['🔘', '🪲', 'הכפתור'],
      ['🥚', '🐥', 'הביצה'],
      ['🌰', '🌳', 'הבלוט'],
      ['🕯️', '🐍', 'הנר'],
    ];
    const NEED = host.level >= 3 ? 4 : 3;
    let i = 0, misses = 0;
    const order = PAIRS.slice().sort(() => Math.random() - 0.5).slice(0, N);

    // central morph element + choice row
    const morph = el('div', { style: 'position:relative;width:160px;height:160px;display:flex;align-items:center;justify-content:center' });
    const srcEl = el('div', { style: 'position:absolute;font-size:120px;line-height:1;will-change:transform,opacity' });
    const tgtEl = el('div', { style: 'position:absolute;font-size:120px;line-height:1;will-change:transform,opacity;transform:scale(0);opacity:0' });
    morph.appendChild(srcEl); morph.appendChild(tgtEl);
    const row = el('div', { class: 'lsnRow' });
    host.stage.appendChild(morph); host.stage.appendChild(row);

    function makeChoices(target) {
      const others = PAIRS.map((p) => p[1]).filter((t) => t !== target);
      const set = new Set([target]);
      while (set.size < NEED && others.length) {
        const d = others.splice(host.rnd(0, others.length - 1), 1)[0];
        set.add(d);
      }
      return [...set].sort(() => Math.random() - 0.5);
    }

    function ask() {
      host.setProgress(i, N);
      if (i >= N) return finish();
      const [src, tgt, word] = order[i];
      // reset morph element to the fresh source
      srcEl.textContent = src; srcEl.style.transform = 'scale(1)'; srcEl.style.opacity = '1';
      tgtEl.textContent = tgt; tgtEl.style.transform = 'scale(0)'; tgtEl.style.opacity = '0';
      host.say('הפכו את ' + word + ' ל...?');
      row.innerHTML = '';
      makeChoices(tgt).forEach((choice) => {
        const b = el('button', { class: 'lsnBtn' }, choice);
        b.addEventListener('click', () => {
          if (choice === tgt) {
            row.style.pointerEvents = 'none';
            morphTo();
          } else {
            misses++; host.bad(); host.say('לא בדיוק... נסו שוב 🐱');
            b.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300);
          }
        });
        row.appendChild(b);
      });
    }

    function morphTo() {
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
      host.confetti();
      host.say('גלגול מושלם! 🐱');
      const stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    // test hook: the current round's correct target emoji, so the walk-bot can tap the
    // right morph button for real (exercising the morph animation + scoring path).
    HPL._transTarget = () => (i < N && order[i] ? order[i][1] : null);

    ask();
  };
})();
