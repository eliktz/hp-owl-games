/* Potions with Professor Snape — cauldron maths that gets properly challenging. The recipe
 * card asks for a number and the child taps the matching ingredient vial. Difficulty ramps
 * two ways: with mastery/school-day (host.level) AND within the brew (later questions are
 * harder). Question kinds unlock as it gets harder: add/sub → bigger numbers → times tables
 * → two-step recipes (a+b-c) → missing-number puzzles (7+?=12), with a timed-bonus sparkle
 * on the tricky ones. Gentle on misses; a truly rough brew offers a retry, never a free win. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.potions = function (host) {
    const el = HPL.el;
    const L = host.level;
    const N = 5 + Math.min(3, Math.max(0, L - 2));   // 5..8 questions as it gets harder
    const brews = ['#7ef0a0', '#a98aff', '#8ad0ff', '#ffd86a', '#ff8ad0', '#ff6a6a'];
    let i = 0, misses = 0, bonus = 0, tmr = null;

    // cauldron + recipe card + answer vials
    const cauldron = el('div', { style: 'position:relative;width:150px;height:110px' });
    const pot = el('div', { style: 'position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:140px;height:92px;background:linear-gradient(#2a2a30,#121216);border-radius:0 0 70px 70px;border:5px solid #15151a;box-shadow:inset 0 6px 0 rgba(0,0,0,.4)' });
    const brew = el('div', { style: 'position:absolute;top:10px;left:50%;transform:translateX(-50%);width:120px;height:26px;border-radius:50%;background:' + brews[0] + ';box-shadow:0 0 22px ' + brews[0] });
    pot.appendChild(brew); cauldron.appendChild(pot);
    const card = el('div', { style: 'font-size:44px;font-weight:bold;color:#fff;background:rgba(255,245,220,.12);border:3px solid #ffd76a;border-radius:16px;padding:8px 22px', dir: 'ltr' }, '');
    const vials = el('div', { class: 'lsnRow' });
    // a simple recipe strip: one slot per step, each revealing its ingredient as you solve it
    const ING = ['🍄', '🌿', '🐌', '🦎', '🕷️', '🌰', '🫐', '🐸'];
    const recipe = el('div', { class: 'lsnRow', style: 'gap:6px;margin-top:-4px' });
    const slots = [];
    for (let k = 0; k < N; k++) {
      const s = el('div', { style: 'width:34px;height:34px;border-radius:9px;border:2px solid rgba(255,215,106,.5);background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:22px;opacity:.5' }, '·');
      slots.push(s); recipe.appendChild(s);
    }
    host.stage.appendChild(cauldron); host.stage.appendChild(recipe); host.stage.appendChild(card); host.stage.appendChild(vials);
    function fillSlot(k) {
      if (k >= slots.length) return;
      const s = slots[k]; s.textContent = ING[k % ING.length]; s.style.opacity = '1'; s.style.borderColor = '#9effa0'; s.style.background = 'rgba(120,240,160,.2)';
      s.animate([{ transform: 'scale(.3)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.2,1.5,.4,1)' });
    }

    function bubble() {
      const b = el('div', { style: 'position:absolute;bottom:30px;left:' + (40 + Math.random() * 60) + 'px;width:' + (8 + Math.random() * 10) + 'px;height:' + (8 + Math.random() * 10) + 'px;border-radius:50%;background:rgba(255,255,255,.6);transition:all .8s ease-out' });
      pot.appendChild(b); requestAnimationFrame(() => { b.style.bottom = '80px'; b.style.opacity = '0'; });
      host.after(850, () => b.remove());
    }
    const bubbleTimer = setInterval(bubble, 420);

    // effective difficulty: live in-session level (rises with success) + a within-brew ramp
    function diff() { return host.lvl() + Math.floor(i / 2); }

    // pick a question kind allowed at this difficulty
    function pickKind(d) {
      const kinds = ['add', 'sub'];
      if (d >= 2) kinds.push('times', 'pattern');
      if (d >= 3) kinds.push('missing', 'two', 'div');
      if (d >= 4) kinds.push('times', 'two', 'div');   // weight the harder kinds higher
      return kinds[host.rnd(0, kinds.length - 1)];
    }

    function makeQ() {
      const d = diff();
      const kind = pickKind(d);
      const addMax = Math.min(9 + d * 3, 45);
      let ans, display, prompt, timed = false;
      if (kind === 'pattern') {
        // what comes next? a skip-counting / shrinking run (2,4,6,? … 30,25,20,?)
        const stp = host.rnd(2, Math.min(3 + d, 9)), down = d >= 3 && host.rnd(0, 1) === 1;
        const start = down ? stp * host.rnd(5, 8) : host.rnd(1, 6 + d);
        const seq = [0, 1, 2].map((k) => start + (down ? -1 : 1) * stp * k);
        ans = start + (down ? -1 : 1) * stp * 3; display = seq.join(', ') + ', ?'; prompt = 'מה הבא בתור?'; timed = d >= 5;
      } else if (kind === 'times') {
        const a = host.rnd(2, Math.min(3 + d, 9)), b = host.rnd(2, Math.min(5 + Math.floor(d / 2), 10));
        ans = a * b; display = a + ' × ' + b + ' = ?'; prompt = 'לוח הכפל: ' + a + ' כפול ' + b + '!';
        timed = d >= 4;
      } else if (kind === 'div') {
        // clean division: build from a known quotient so it always divides evenly
        const b = host.rnd(2, Math.min(3 + Math.floor(d / 2), 9)), q = host.rnd(2, Math.min(3 + d, 9));
        ans = q; display = (b * q) + ' ÷ ' + b + ' = ?'; prompt = 'חלקו שווה בשווה! ' + (b * q) + ' למושבות של ' + b;
        timed = d >= 5;
      } else if (kind === 'missing') {
        const b = host.rnd(2, addMax), c = host.rnd(b + 1, b + addMax); ans = c - b;   // b + ? = c
        display = b + ' + ? = ' + c; prompt = 'כמה טיפות חסרות?'; timed = d >= 5;
      } else if (kind === 'two') {
        const a = host.rnd(3, addMax), b = host.rnd(1, addMax);
        if (host.rnd(0, 1)) { const c = host.rnd(1, a + b); ans = a + b - c; display = a + ' + ' + b + ' − ' + c + ' = ?'; }
        else { const c = host.rnd(1, Math.max(1, a - 1)); const mid = a - c; ans = mid + b; display = a + ' − ' + c + ' + ' + b + ' = ?'; }
        prompt = 'מתכון בשני שלבים — חשבו לפי הסדר!'; timed = d >= 5;
      } else if (kind === 'sub') {
        const a = host.rnd(2, addMax), b = host.rnd(1, a); ans = a - b; display = a + ' − ' + b + ' = ?'; prompt = 'הורידו טיפות!';
      } else {
        const a = host.rnd(1, addMax), b = host.rnd(1, addMax); ans = a + b; display = a + ' + ' + b + ' = ?'; prompt = 'הוסיפו טיפות!';
      }
      // choices: correct + near distractors, more choices as it gets harder
      const nOpt = d >= 4 ? 4 : 3, spread = Math.max(3, Math.floor(ans * 0.25) + 2);
      const set = new Set([ans]);
      let guard = 0;
      while (set.size < nOpt && guard++ < 60) { const dd = ans + host.rnd(-spread, spread); if (dd >= 0 && dd !== ans) set.add(dd); }
      const choices = [...set].sort(() => Math.random() - 0.5);
      return { ans, display, prompt, choices, timed };
    }

    function clearTimer() { if (tmr) { tmr.stop(); tmr = null; } }

    function ask() {
      host.setProgress(i, N);
      if (i >= N) return finish();
      const q = makeQ();
      HPL._potAns = () => q.ans;   // test hook: current correct answer (recipes are now multi-format)
      host.say(q.prompt);
      card.textContent = q.display;
      vials.innerHTML = '';
      let beat = q.timed;   // still within the bonus window?
      if (q.timed) { clearTimer(); tmr = host.timer(Math.max(2600, 6500 - diff() * 350), () => { beat = false; host.say('נגמר הזמן לבונוס — אבל אפשר בנחת 😊'); }); }
      q.choices.forEach((c) => {
        const v = el('button', { class: 'lsnBtn', style: '', dir: 'ltr' }, String(c));
        v.addEventListener('click', () => {
          if (c === q.ans) {
            clearTimer();
            v.style.pointerEvents = 'none';
            const col = brews[i % brews.length]; brew.style.background = col; brew.style.boxShadow = '0 0 26px ' + col;
            const r = v.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
            host.good(r.left - pr.left + 40, r.top - pr.top);
            if (q.timed && beat) { bonus++; host.good(pr.width / 2, 40); host.say('מהיר! בונוס ⚡'); }
            fillSlot(i); host.hit(true);
            for (let k = 0; k < 6; k++) host.after(k * 40, bubble);
            i++; host.setProgress(i, N); host.after(650, ask);
          } else {
            misses++; host.bad(); host.hit(false);
            v.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300);
            host.say('כמעט! נסו שוב 😊');
          }
        });
        vials.appendChild(v);
      });
    }

    function finish() {
      clearInterval(bubbleTimer); clearTimer();
      if (misses >= N * 2) return host.fail('הדוד רתח יותר מדי... ננסה שוב בזהירות?');   // real retry, no free win
      host.say('השיקוי מוכן! 🫧');
      host.confetti();
      let stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      if (bonus >= Math.ceil(N / 2) && stars < 3) stars++;   // speed bonus can lift a star
      host.after(900, () => host.win(stars));
    }

    ask();
  };
})();
