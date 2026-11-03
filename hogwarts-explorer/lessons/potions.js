/* Potions with Professor Snape — a quick cauldron-maths brew. A recipe card asks for a
 * sum (add / take-away / times, easy→hard over three levels; numbers shown left-to-right),
 * the child taps the ingredient vial with the right answer and it pours in with a
 * colourful bubble. Gentle on misses, 5 questions per brew, finish = potion + stars. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.potions = function (host) {
    const el = HPL.el, N = 5;
    const brews = ['#7ef0a0', '#a98aff', '#8ad0ff', '#ffd86a', '#ff8ad0'];
    let i = 0, misses = 0;

    // cauldron + recipe card + answer vials
    const cauldron = el('div', { style: 'position:relative;width:150px;height:110px' });
    const pot = el('div', { style: 'position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:140px;height:92px;background:linear-gradient(#2a2a30,#121216);border-radius:0 0 70px 70px;border:5px solid #15151a;box-shadow:inset 0 6px 0 rgba(0,0,0,.4)' });
    const brew = el('div', { style: 'position:absolute;top:10px;left:50%;transform:translateX(-50%);width:120px;height:26px;border-radius:50%;background:' + brews[0] + ';box-shadow:0 0 22px ' + brews[0] });
    pot.appendChild(brew); cauldron.appendChild(pot);
    const card = el('div', { style: 'font-size:46px;font-weight:bold;color:#fff;background:rgba(255,245,220,.12);border:3px solid #ffd76a;border-radius:16px;padding:8px 22px', dir: 'ltr' }, '');
    const vials = el('div', { class: 'lsnRow' });
    host.stage.appendChild(cauldron); host.stage.appendChild(card); host.stage.appendChild(vials);

    function bubble() {
      const b = el('div', { style: 'position:absolute;bottom:30px;left:' + (40 + Math.random() * 60) + 'px;width:' + (8 + Math.random() * 10) + 'px;height:' + (8 + Math.random() * 10) + 'px;border-radius:50%;background:rgba(255,255,255,.6);transition:all .8s ease-out' });
      pot.appendChild(b); requestAnimationFrame(() => { b.style.bottom = '80px'; b.style.opacity = '0'; });
      host.after(850, () => b.remove());
    }
    const bubbleTimer = setInterval(bubble, 420);

    function makeQ() {
      const L = host.level;
      let a, b, op, ans;
      const ops = L === 1 ? ['+', '-'] : L === 2 ? ['+', '-', '+'] : ['+', '-', '×'];
      op = ops[host.rnd(0, ops.length - 1)];
      if (op === '×') { a = host.rnd(2, L >= 3 ? 5 : 3); b = host.rnd(2, 5); ans = a * b; }
      else if (op === '+') { const max = L === 1 ? 9 : L === 2 ? 14 : 20; a = host.rnd(1, max); b = host.rnd(1, Math.max(1, max - a)); ans = a + b; }
      else { const max = L === 1 ? 10 : L === 2 ? 16 : 20; a = host.rnd(2, max); b = host.rnd(1, a); ans = a - b; }
      const opHe = op === '+' ? 'הוסף' : op === '-' ? 'הורד' : 'פי';
      const opWord = op === '×' ? 'כפול' : op;
      // 3 answer choices: correct + two near distractors
      const set = new Set([ans]);
      while (set.size < 3) { const d = ans + host.rnd(-3, 3); if (d >= 0 && d !== ans) set.add(d); }
      const choices = [...set].sort(() => Math.random() - 0.5);
      return { a, b, op: opWord, opHe, ans, choices };
    }

    function ask() {
      host.setProgress(i, N);
      if (i >= N) return finish();
      const q = makeQ();
      host.say(q.opHe + ' ' + q.a + ' ' + q.op + ' ' + q.b + ' טיפות!');
      card.textContent = q.a + ' ' + q.op + ' ' + q.b + ' = ?';
      vials.innerHTML = '';
      q.choices.forEach((c) => {
        const v = el('button', { class: 'lsnBtn', style: '', dir: 'ltr' }, String(c));
        v.addEventListener('click', () => {
          if (c === q.ans) {
            v.style.pointerEvents = 'none';
            brew.style.background = brews[i % brews.length]; brew.style.boxShadow = '0 0 26px ' + brews[i % brews.length];
            const r = v.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top);
            for (let k = 0; k < 6; k++) host.after(k * 40, bubble);
            i++; host.setProgress(i, N); host.after(650, ask);
          } else { misses++; host.bad(); v.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300); host.say('כמעט! נסה שוב 😊'); }
        });
        vials.appendChild(v);
      });
    }

    function finish() {
      clearInterval(bubbleTimer);
      host.say('השיקוי מוכן! 🫧');
      host.confetti();
      const stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      host.after(900, () => host.win(stars));
    }

    ask();
  };
})();
