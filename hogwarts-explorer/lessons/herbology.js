/* Herbology with Professor Sprout — count & plant in the greenhouse, now with teeth.
 * Rounds ramp within the lesson and scale with host.level (HIGHER = HARDER). Types unlock
 * by level: "count" seedlings, "add"/"sub" two seedling groups, "which group has exactly N",
 * rows×columns multiplication at high level, and the hands-on "plant exactly N" (with a
 * missing-number variant up top). Answers are tappable number buttons with near distractors
 * (more choices higher up). Some rounds get an optional timed bonus (timeout just forfeits it).
 * No pity win: too many mistakes → host.fail() re-runs the lesson. Stars from mistakes. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.herbology = function (host) {
    const el = HPL.el;
    const L = host.level;                               // 1..8, bigger = harder
    const rounds = 5 + Math.floor(L / 2);              // 5..9 rounds
    const cap = L <= 1 ? 5 : L <= 2 ? 8 : L <= 3 ? 12 : L <= 5 ? 18 : 25; // seedling cap
    const seeds = ['🌱', '🪴', '🌸', '🌻'];
    const maxMistakes = rounds + 3;                    // over this → fail(), no pity win
    let i = 0, misses = 0;

    const board = el('div', { class: 'lsnRow', style: 'max-width:680px;min-height:120px;flex-wrap:wrap;justify-content:center' });
    const big = el('div', { style: 'font-size:60px;font-weight:bold;color:#9ef0a0;text-shadow:0 3px 0 #1a5a1a;min-height:64px', dir: 'ltr' }, '');
    const row = el('div', { class: 'lsnRow', style: 'flex-wrap:wrap;justify-content:center' });
    host.stage.appendChild(big); host.stage.appendChild(board); host.stage.appendChild(row);

    let curTimer = null;                               // active timed-bonus bar, if any

    // test hook for the Playwright bot — points at the CURRENT round's answer
    HPL._herbAnswer = () => null;

    function next() { i++; host.setProgress(i, rounds); host.after(650, play); }

    function miss(msg, b) {
      misses++; host.bad(); host.say(msg || 'כמעט! נסו שוב 🌱');
      if (b) b.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300);
      if (misses > maxMistakes) { stopTimer(); host.after(500, () => host.fail('אופס, הצמחים קצת התבלבלו — ננסה שוב! 🌿')); return true; }
      return false;
    }

    function stopTimer() { if (curTimer) { curTimer.stop(); curTimer = null; } }

    // how many choice buttons to show (correct + distractors), grows with level
    function choiceCount() { return L <= 2 ? 3 : L <= 4 ? 4 : 5; }

    // build a set of near distractors around the answer
    function distractors(answer, hi) {
      const set = new Set([answer]);
      let guard = 0;
      while (set.size < choiceCount() && guard++ < 60) {
        const spread = L <= 3 ? 2 : 3;
        const d = answer + host.rnd(-spread, spread);
        if (d >= 1 && d <= hi + 4 && d !== answer) set.add(d);
      }
      // top up with anything legal if spread was too tight
      let fill = 1;
      while (set.size < choiceCount() && fill <= hi + 4) { if (fill !== answer) set.add(fill); fill++; }
      return [...set].sort(() => Math.random() - 0.5);
    }

    // render tappable number buttons; correct one wins, wrong ones gently retry
    function numberButtons(answer, hi) {
      HPL._herbAnswer = () => answer;
      distractors(answer, hi).forEach((c) => {
        const b = el('button', { class: 'lsnBtn', dir: 'ltr' }, String(c));
        b.addEventListener('click', () => {
          if (c === answer) {
            stopTimer();
            [...row.querySelectorAll('button')].forEach((x) => (x.style.pointerEvents = 'none'));
            const r = b.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top);
            next();
          } else { miss('כמעט! ספרו שוב 🌱', b); }
        });
        row.appendChild(b);
      });
    }

    // scatter n seedlings of one kind into a container
    function scatter(container, n, emo, size) {
      container.style.fontSize = (size || 42) + 'px';
      for (let k = 0; k < n; k++) container.appendChild(el('span', { style: 'line-height:1' }, emo));
    }

    // optionally start a gentle timed bonus on a round (only mid/high level, some rounds)
    function maybeTimer() {
      if (L >= 3 && Math.random() < 0.5) {
        const ms = Math.max(5000, 11000 - L * 700);
        curTimer = host.timer(ms, () => { curTimer = null; host.say('הזמן נגמר — אבל אפשר עדיין לענות! ⏳'); });
      }
    }

    function play() {
      stopTimer();
      host.setProgress(i, rounds);
      if (i >= rounds) return finish();
      board.innerHTML = ''; row.innerHTML = ''; big.textContent = '';
      board.style.fontSize = '42px';

      // ramp: later rounds pull from the harder end of the unlocked pool
      const frac = i / rounds;                          // 0..~1 through the lesson
      const pool = [];
      pool.push('count');                               // always available
      if (L >= 2) { pool.push('add'); pool.push('plant'); }
      if (L >= 3) pool.push('which');
      if (L >= 4) pool.push('sub');
      if (L >= 5) pool.push('mult');

      let type;
      if (i === 0) type = 'count';                      // warm up
      else if (frac >= 0.6 && pool.length > 1) {
        // back third: favor the hardest unlocked types
        const hard = pool.filter((t) => t === 'mult' || t === 'sub' || t === 'which' || t === 'add');
        const bag = hard.length ? hard : pool;
        type = bag[host.rnd(0, bag.length - 1)];
      } else {
        type = pool[host.rnd(0, pool.length - 1)];
      }

      if (type === 'plant') plantRound(frac);
      else if (type === 'add') opRound('+', frac);
      else if (type === 'sub') opRound('-', frac);
      else if (type === 'which') whichRound(frac);
      else if (type === 'mult') multRound(frac);
      else countRound(frac);
    }

    // ---- Round: count the seedlings shown ----
    function countRound(frac) {
      const lo = Math.max(2, Math.floor(cap * 0.3 * frac));
      const n = host.rnd(Math.max(2, lo), cap);
      host.say('כמה פרחים? ספרו! 🌼');
      maybeTimer();
      scatter(board, n, seeds[host.rnd(0, seeds.length - 1)], n > 14 ? 34 : 44);
      numberButtons(n, cap);
    }

    // ---- Round: addition / subtraction of two seedling groups ----
    function opRound(op, frac) {
      const top = Math.max(4, Math.floor(cap * (0.5 + 0.5 * frac)));
      let a, b, answer;
      if (op === '+') {
        a = host.rnd(1, Math.max(2, Math.floor(top / 2)));
        b = host.rnd(1, Math.max(2, Math.floor(top / 2)));
        answer = a + b;
      } else {
        a = host.rnd(2, top);
        b = host.rnd(1, Math.max(1, a - 1));           // keep it non-negative
        answer = a - b;
      }
      host.say(a + ' ' + op + ' ' + b + ' פרחים — כמה? 🌸');
      maybeTimer();
      big.textContent = a + ' ' + op + ' ' + b + ' = ?';
      const g1 = el('div', { class: 'lsnRow', style: 'flex-wrap:wrap;justify-content:center;background:rgba(0,80,0,.25);border-radius:14px;padding:6px' });
      const g2 = el('div', { class: 'lsnRow', style: 'flex-wrap:wrap;justify-content:center;background:rgba(0,80,0,.25);border-radius:14px;padding:6px' });
      scatter(g1, a, '🌱', 32);
      scatter(g2, b, '🌸', 32);
      const sign = el('div', { style: 'font-size:48px;color:#fff;font-weight:bold' }, op);
      board.style.fontSize = '0';
      board.appendChild(g1); board.appendChild(sign); board.appendChild(g2);
      numberButtons(answer, Math.max(cap, a + b));
    }

    // ---- Round: which pot-group has exactly N ----
    function whichRound(frac) {
      const target = host.rnd(Math.max(2, Math.floor(cap * 0.3)), cap);
      host.say('איזו קבוצה יש בה בדיוק ' + target + '? 🪴');
      maybeTimer();
      big.textContent = String(target);
      board.style.fontSize = '0';
      HPL._herbAnswer = () => target;
      const groups = choiceCount();
      // one correct group + others with near-but-wrong counts
      const counts = new Set([target]);
      let guard = 0;
      while (counts.size < groups && guard++ < 60) {
        const d = target + host.rnd(-3, 3);
        if (d >= 1 && d !== target) counts.add(d);
      }
      const list = [...counts].sort(() => Math.random() - 0.5);
      list.forEach((cnt) => {
        const emo = seeds[host.rnd(0, seeds.length - 1)];
        const g = el('button', { class: 'lsnBtn', style: 'font-size:' + (cnt > 10 ? 20 : 26) + 'px;max-width:200px;flex-wrap:wrap;line-height:1', dir: 'ltr' });
        for (let k = 0; k < cnt; k++) g.appendChild(el('span', {}, emo));
        g.addEventListener('click', () => {
          if (cnt === target) {
            stopTimer();
            [...board.querySelectorAll('button')].forEach((x) => (x.style.pointerEvents = 'none'));
            const r = g.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top); next();
          } else { miss('לא זו — ספרו שוב 🌱', g); }
        });
        board.appendChild(g);
      });
    }

    // ---- Round: multiplication shown as rows × columns ----
    function multRound(frac) {
      const r = host.rnd(2, Math.min(5, 2 + Math.floor(L / 2)));
      const c = host.rnd(2, Math.min(6, 2 + Math.floor(L / 2)));
      const answer = r * c;
      host.say(r + ' שורות של ' + c + ' — כמה פרחים? ✖️');
      maybeTimer();
      big.textContent = r + ' × ' + c + ' = ?';
      board.style.fontSize = '0';
      const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(' + c + ',1fr);gap:6px;font-size:' + (answer > 15 ? 26 : 34) + 'px' });
      for (let k = 0; k < answer; k++) grid.appendChild(el('span', { style: 'line-height:1' }, '🌻'));
      board.appendChild(grid);
      numberButtons(answer, Math.max(cap, answer));
    }

    // ---- Round: plant exactly the target number (missing-number variant up top) ----
    function plantRound(frac) {
      const top = Math.max(4, Math.floor(cap * (0.5 + 0.5 * frac)));
      const target = host.rnd(3, top);
      // missing-number variant at high level: start with some pre-planted pots
      const preset = L >= 5 && Math.random() < 0.5 ? host.rnd(1, Math.max(1, target - 1)) : 0;
      const pots = Math.min(30, Math.max(target + 4, Math.max(8, cap)));
      if (preset) host.say('כבר יש ' + preset + ' — שתלו עד ' + target + '! 🌿');
      else host.say('שתלו בדיוק ' + target + ' זרעים! 🌱');
      HPL._herbAnswer = () => ({ plant: target });
      maybeTimer();
      let planted = preset;
      const counter = el('div', { style: 'font-size:32px;font-weight:bold;color:#fff', dir: 'ltr' }, planted + ' / ' + target);
      big.textContent = String(target);
      board.style.fontSize = '0';
      const cells = [];
      for (let k = 0; k < pots; k++) {
        const on = k < preset;
        const pot = el('button', { class: 'lsnBtn', dir: 'ltr', style: 'font-size:38px' }, on ? '🌱' : '🟤');
        pot.dataset.on = on ? '1' : '';
        pot.addEventListener('click', () => {
          if (pot.dataset.on) { pot.dataset.on = ''; pot.textContent = '🟤'; planted--; }
          else {
            pot.dataset.on = '1'; pot.textContent = '🌱'; planted++;
            const r = pot.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top);
          }
          counter.textContent = planted + ' / ' + target;
          if (planted === target) { stopTimer(); cells.forEach((c) => (c.style.pointerEvents = 'none')); host.say('מעולה! 🌿'); next(); }
          else if (planted > target) { if (!miss('יותר מדי! הורידו אחד 🌱')) { /* keep playing */ } }
        });
        cells.push(pot); board.appendChild(pot);
      }
      row.appendChild(counter);
    }

    function finish() {
      stopTimer();
      HPL._herbAnswer = () => null;
      host.confetti();
      host.say('הצמחים מאושרים! 🌿');
      const stars = misses <= 1 ? 3 : misses <= 4 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    play();
  };
})();
