/* Transfiguration with Professor McGonagall — remember the spell, then cast it.
 * Each round the professor shows a few transformation cards ("🫖 ➜ 🐭") for a short time.
 * The pairs are DIFFERENT every round (shuffled from two pools), so this is real working
 * memory, not known pairs. Then the cards flip face-down and she quizzes them one by one:
 * "🫖 ➜ ?" — tap what it turns into; the object spins and morphs. From level 4 she also
 * asks BACKWARDS ("? ➜ 🐭"). More cards, less study time and more look-alike choices as
 * host.lvl() climbs; a slip flashes the right card again (you learn it) and counts a miss.
 * Too many misses → gentle retry. Test hook: HPL._transTarget() = emoji of the right button. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.transfiguration = function (host) {
    const el = HPL.el, L = host.level;
    const SRC = ['🫖', '🪵', '🔘', '🥚', '🌰', '🕯️', '🍐', '🧦', '🪨', '🥄', '📕', '🧢', '🔑', '🥕'];
    const TGT = ['🐭', '🦔', '🪲', '🐥', '🦉', '🐍', '🐰', '🐢', '🦊', '🐸', '🦋', '🐿️', '🦜', '🐙'];
    const N = 3 + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0);            // rounds
    let round = 0, misses = 0, correctNow = null, tmr = null, total = 0, asked = 0;
    const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);

    const cardsRow = el('div', { class: 'lsnRow', style: 'gap:10px;min-height:96px' });
    const ask = el('div', { style: 'font-size:64px;line-height:1.1;min-height:76px;color:#fff;font-weight:bold', dir: 'ltr' }, '');
    const row = el('div', { class: 'lsnRow', style: 'max-width:560px' });
    host.stage.appendChild(cardsRow); host.stage.appendChild(ask); host.stage.appendChild(row);
    HPL._transTarget = () => correctNow;

    function pairsFor() { const lv = host.lvl(); return Math.max(2, Math.min(5, 2 + Math.floor(lv / 2) + (round >= 2 ? 1 : 0))); }
    for (let r = 0; r < N; r++) total += 3;                       // progress pips (≈3 questions a round)

    function startRound() {
      if (round >= N) return finish();
      correctNow = null; row.innerHTML = ''; ask.textContent = '👀';
      const k = pairsFor(), lv = host.lvl();
      const src = shuffle(SRC).slice(0, k), tgt = shuffle(TGT).slice(0, k);
      const pairs = src.map((s, i) => [s, tgt[i]]);
      cardsRow.innerHTML = '';
      const cards = pairs.map(([s, t]) => {
        const c = el('div', { style: 'background:rgba(255,245,220,.95);border:3px solid #ffd76a;border-radius:16px;padding:6px 10px;font-size:40px;line-height:1.1;transition:transform .3s,background .3s;min-width:120px;text-align:center', dir: 'ltr' }, s + ' ➜ ' + t);
        c.dataset.s = s; c.dataset.t = t; cardsRow.appendChild(c); return c;
      });
      host.say('זִכְרוּ טוֹב: מָה הוֹפֵךְ לְמָה? 🐱');
      const study = Math.max(1600, k * (1500 - lv * 90) + 700);
      if (tmr) tmr.stop(); tmr = host.timer(study, () => { tmr = null; });
      host.after(study, () => {
        cards.forEach((c) => { c.textContent = '❓'; c.style.background = 'rgba(120,90,200,.6)'; c.style.transform = 'rotateY(180deg)'; });
        quiz(pairs, cards, shuffle(pairs).slice(0, Math.min(k, 3)), 0);
      });
    }

    function quiz(pairs, cards, qs, qi) {
      if (qi >= qs.length) { round++; host.setProgress(Math.min(total, round * 3), total); return host.after(500, startRound); }
      const lv = host.lvl();
      const [s, t] = qs[qi];
      const reverse = lv >= 4 && host.rnd(0, 2) === 0;
      ask.textContent = reverse ? '? ➜ ' + t : s + ' ➜ ?';
      host.say(reverse ? 'מָה הָפַךְ לָזֶה?' : 'לְמָה זֶה הוֹפֵךְ?');
      const correct = reverse ? s : t, pool = reverse ? SRC : TGT, mine = pairs.map((p) => p[reverse ? 0 : 1]);
      // choices: every card from this round (the tempting ones) + outsiders up to the count
      const need = Math.min(6, Math.max(mine.length + 1, 3 + (lv >= 3 ? 1 : 0) + (lv >= 6 ? 1 : 0)));
      const set = new Set(mine); const extra = shuffle(pool.filter((x) => !set.has(x)));
      while (set.size < need && extra.length) set.add(extra.pop());
      correctNow = correct; row.innerHTML = ''; row.style.pointerEvents = 'auto';
      shuffle([...set]).forEach((choice) => {
        const b = el('button', { class: 'lsnBtn' }, choice);
        b.addEventListener('click', () => {
          if (choice === correct) {
            row.style.pointerEvents = 'none'; correctNow = null; host.hit(true); asked++;
            const card = cards.find((c) => c.dataset.s === s);
            if (card) { card.textContent = s + ' ➜ ' + t; card.style.background = 'rgba(160,255,170,.95)'; card.style.transform = 'none'; }
            ask.textContent = s + ' ➜ ' + t;
            ask.animate([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(.2) rotate(360deg)' }, { transform: 'scale(1.2) rotate(720deg)' }, { transform: 'scale(1)' }], { duration: 620, easing: 'ease-out' });
            const r = ask.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + r.width / 2, r.top - pr.top + 20);
            host.setProgress(Math.min(total, round * 3 + qi + 1), total);
            host.after(820, () => quiz(pairs, cards, qs, qi + 1));
          } else {
            misses++; host.bad(); host.hit(false); host.say('לֹא בְּדִיּוּק... הִצִּיצוּ שׁוּב 👀');
            b.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300);
            // a quick peek at the right card — the slip teaches the pair
            const card = cards.find((c) => c.dataset.s === s);
            if (card) { const old = card.textContent; card.textContent = s + ' ➜ ' + t; card.style.transform = 'none'; host.after(900, () => { if (card.style.background.indexOf('160') < 0) { card.textContent = old; card.style.transform = 'rotateY(180deg)'; } }); }
            if (misses > N * 2 + 2) { correctNow = null; row.style.pointerEvents = 'none'; host.after(500, () => host.fail('הגלגול התפזר... בואו ננסה שוב 🐱')); }
          }
        });
        row.appendChild(b);
      });
    }

    function finish() {
      correctNow = null; if (tmr) { tmr.stop(); tmr = null; }
      row.innerHTML = ''; ask.textContent = '🐱✨';
      host.confetti(); host.say('זִכָּרוֹן שֶׁל פִּיל! גלגול מושלם 🐱');
      const stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      host.after(800, () => host.win(stars));
    }

    host.setProgress(0, total);
    startRound();
  };
})();
