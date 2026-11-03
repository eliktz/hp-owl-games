/* Herbology with Professor Sprout — count & plant in the greenhouse. Two round types mix
 * over 5 rounds: "count" shows a cluster of seedlings and the child taps the right number
 * (correct + two near distractors); "plant" shows a target and a grid of empty pots the
 * child taps to fill, auto-confirming on match. Gentle on misses, finish = happy plants + stars. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.herbology = function (host) {
    const el = HPL.el, N = 5;
    const cap = host.level === 1 ? 5 : host.level === 2 ? 8 : 12;
    const seeds = ['🌱', '🪴'];
    let i = 0, misses = 0;

    const board = el('div', { class: 'lsnRow', style: 'max-width:640px;min-height:120px' });
    const big = el('div', { style: 'font-size:72px;font-weight:bold;color:#9ef0a0;text-shadow:0 3px 0 #1a5a1a', dir: 'ltr' }, '');
    const row = el('div', { class: 'lsnRow' });
    host.stage.appendChild(big); host.stage.appendChild(board); host.stage.appendChild(row);

    function next() { i++; host.setProgress(i, N); host.after(650, play); }

    function play() {
      host.setProgress(i, N);
      if (i >= N) return finish();
      board.innerHTML = ''; row.innerHTML = ''; big.textContent = '';
      // alternate round types, count first
      if (i % 2 === 0) countRound(); else plantRound();
    }

    // ---- Round A: count the seedlings shown ----
    function countRound() {
      const n = host.rnd(2, cap);
      host.say('כמה עציצים? ספרו!');
      const emo = seeds[host.rnd(0, 1)];
      board.style.fontSize = '46px';
      for (let k = 0; k < n; k++) board.appendChild(el('span', { style: 'line-height:1' }, emo));
      const set = new Set([n]);
      while (set.size < 3) { const d = n + host.rnd(-2, 2); if (d >= 1 && d !== n) set.add(d); }
      const choices = [...set].sort(() => Math.random() - 0.5);
      choices.forEach((c) => {
        const b = el('button', { class: 'lsnBtn', dir: 'ltr' }, String(c));
        b.addEventListener('click', () => {
          if (c === n) {
            b.style.pointerEvents = 'none';
            const r = b.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top);
            next();
          } else { misses++; host.bad(); b.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300); host.say('כמעט! ספרו שוב 🌱'); }
        });
        row.appendChild(b);
      });
    }

    // ---- Round B: plant exactly the target number ----
    function plantRound() {
      const target = host.rnd(2, cap);
      const pots = Math.min(12, Math.max(8, cap));
      host.say('שתלו ' + target + ' זרעים!');
      let planted = 0;
      const counter = el('div', { style: 'font-size:34px;font-weight:bold;color:#fff', dir: 'ltr' }, '0 / ' + target);
      big.textContent = String(target);
      board.style.fontSize = '0';
      const cells = [];
      for (let k = 0; k < pots; k++) {
        const pot = el('button', { class: 'lsnBtn', dir: 'ltr', style: 'font-size:40px' }, '🟤');
        pot.dataset.on = '';
        pot.addEventListener('click', () => {
          if (pot.dataset.on) { pot.dataset.on = ''; pot.textContent = '🟤'; planted--; }
          else {
            pot.dataset.on = '1'; pot.textContent = '🌱'; planted++;
            const r = pot.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top);
          }
          counter.textContent = planted + ' / ' + target;
          if (planted === target) { cells.forEach((c) => (c.style.pointerEvents = 'none')); host.say('מעולה! 🌿'); next(); }
          else if (planted > target) { host.bad(); host.say('יותר מדי! הורידו אחד 🌱'); }
        });
        cells.push(pot); board.appendChild(pot);
      }
      row.appendChild(counter);
    }

    function finish() {
      host.confetti();
      host.say('הצמחים מאושרים! 🌿');
      const stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    play();
  };
})();
